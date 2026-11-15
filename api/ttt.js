// POST /api/ttt  { token, do, ... }: online Tic-Tac-Toe with a queue and Elo ratings. Website only: the Android
// app doesn't include it. `token` is the visitor's secret token from visitor.js, so a player is a visitor number.
//
//   do: 'me'                       -> { me: { id, elo, games, w, d, l }, game }   (game: the one you are playing, if any)
//       'queue'  { ticket? }       -> { state: 'waiting', ticket } or { state: 'game', game }   (waits up to 8 s)
//       'leave'  { ticket }        -> { state: 'left' } or { state: 'game', game }  (paired just before leaving)
//       'watch'  { id, v }         -> { game }   (waits up to 8 s for a newer version than v, or the game's end)
//       'move'   { id, cell 0-8 }, 'resign', 'offer' (a draw), 'accept', 'decline'   { id }  -> { game }
// Every answer also has `now`, the server's clock, so the page runs the clocks in step with it.
//
// Rules: you are paired with whoever else is queueing, X or O at random, X moves first. Each player has a 3-minute
// chess clock for the whole game; it runs only on your turn, and running out loses. If a side doesn't make its first
// move within 30 s the game is aborted and no Elo changes (so a player who left doesn't cost the other one 3 minutes).
// A draw offer stays open until the other player accepts, declines, or makes a move (which declines it); you can
// offer again once a move has been made since your last offer. Resigning loses.
//
// Elo, the classic formula: expected score E = 1 / (1 + 10^((opponent - you) / 400)), new rating = old + K (S - E)
// with K = 32 and S = 1 for a win, 0.5 for a draw, 0 for a loss. Everyone starts at exactly 1000. Ratings are whole
// numbers: the change is rounded, and the two players' changes always add up to zero.
//
// Keys (in the same database as the visitor numbers, see _lib.js):
//   ttt:wait            the one ticket waiting for an opponent: { t: ticket, id: visitor number, at }
//   ttt:claim:<ticket>  set once, when that ticket is paired (to the other ticket) or cancelled ('left')
//   ttt:match:<ticket>  the game that ticket was paired into
//   ttt:g:<game id>     a game; every change is a compare-and-set, so two changes at once can't both happen
//   ttt:active:<id>     the game that visitor is playing
//   ttt:elo:<id>        that visitor's rating and record { elo, games, w, d, l }
const crypto = require('crypto');
const { redis, sha, body, send } = require('./_lib');

const CLOCK = +process.env.TTT_CLOCK_MS || 3 * 60e3;   // each player's time for the whole game (tests shorten these)
const FIRST = +process.env.TTT_FIRST_MS || 30e3;       // time for each side's first move before the game is aborted
const HOLD = +process.env.TTT_WAIT_MS || 8000;         // how long one 'queue' or 'watch' call waits for news
const K = 32, START = 1000, FRESH = 3000, POLL = 250;
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const other = s => s === 'X' ? 'O' : 'X';
const newId = n => crypto.randomBytes(n).toString('base64url');
const json = raw => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
const record = raw => json(raw) || { elo: START, games: 0, w: 0, d: 0, l: 0 };
const expected = (r, opp) => 1 / (1 + Math.pow(10, (opp - r) / 400));

// the visitor number a token belongs to
async function who(token) {
  if (typeof token !== 'string' || !/^[\w-]{20,80}$/.test(token)) fail(401, 'No visitor token.');
  const [id] = await redis(['GET', 'ult:tok:' + sha(token)]);
  if (!id) fail(401, 'Unknown visitor.');
  return +id;
}

// ---------- the game ----------
function finish(g, winner, reason, line = []) { g.status = 'over'; g.offer = null; g.result = { winner, reason, line }; }

// a clock that ran out, or a first move that never came
function settle(g, now) {
  if (g.status !== 'play') return false;
  const used = now - g.turnAt;
  if (g.moves < 2 && used >= FIRST) { finish(g, null, 'aborted'); return true; }
  if (used >= g.clock[g.turn]) { g.clock[g.turn] = 0; finish(g, other(g.turn), 'time'); return true; }
  return false;
}

// what a player asked for; returns false when it changes nothing
function act(g, side, what, b, now) {
  const them = other(side);
  switch (what) {
    case 'move': {
      const cell = b.cell;
      if (g.turn !== side) fail(409, "It isn't your turn.");
      if (!Number.isInteger(cell) || cell < 0 || cell > 8 || g.board[cell]) fail(400, 'That square is taken.');
      g.clock[side] -= now - g.turnAt;
      g.board[cell] = side; g.moves++;
      if (g.offer === them) g.offer = null;   // moving declines their draw offer
      const line = LINES.find(l => l.every(i => g.board[i] === side));
      if (line) finish(g, side, 'line', line);
      else if (g.moves === 9) finish(g, null, 'draw');
      else { g.turn = them; g.turnAt = now; }
      return true;
    }
    case 'resign': finish(g, them, 'resign'); return true;
    case 'offer':
      if (g.offer === them) { finish(g, null, 'agreed'); return true; }   // both offered: that's a draw
      if (g.offer === side) return false;
      if (g.offerMove[side] === g.moves) fail(409, 'Make a move before offering a draw again.');
      g.offer = side; g.offerMove[side] = g.moves;
      return true;
    case 'accept':
      if (g.offer !== them) fail(409, 'There is no draw offer to accept.');
      finish(g, null, 'agreed'); return true;
    case 'decline':
      if (g.offer !== them) return false;
      g.offer = null; return true;
  }
  fail(400, 'Unknown action.');
}

// Elo for a game that just ended (an aborted game changes nothing)
async function rate(g) {
  if (g.result.reason === 'aborted') { g.result.elo = null; return; }
  const [rows] = await redis(['MGET', 'ttt:elo:' + g.players.X.id, 'ttt:elo:' + g.players.O.id]);
  const [rx, ro] = rows.map(record);
  const sx = g.result.winner === 'X' ? 1 : g.result.winner === 'O' ? 0 : 0.5;
  const dx = Math.round(K * (sx - expected(rx.elo, ro.elo)));
  g.result.elo = { X: { before: rx.elo, change: dx, after: rx.elo + dx }, O: { before: ro.elo, change: -dx, after: ro.elo - dx } };
}
// add the change to the player's saved rating (compare-and-set, in case two of their games end at once)
async function saveRating(id, change, outcome) {
  const key = 'ttt:elo:' + id;
  for (let i = 0; i < 10; i++) {
    const [raw] = await redis(['GET', key]);
    const r = record(raw);
    r.elo += change; r.games++; r[outcome]++;
    const [ok] = raw === null ? [(await redis(['SET', key, JSON.stringify(r), 'NX']))[0] === 'OK'] : await redis(['CAS', key, raw, JSON.stringify(r)]);
    if (ok) return;
  }
}

// read a game, let `change` alter it, and save it only if nobody else saved a change in the meantime (else again)
async function update(id, change) {
  for (let tries = 0; tries < 12; tries++) {
    const [raw] = await redis(['GET', 'ttt:g:' + id]);
    if (!raw) fail(404, 'That game is gone.');
    const g = JSON.parse(raw), now = Date.now();
    let changed = settle(g, now);
    if (!changed && change && g.status === 'play') changed = change(g, now) !== false;
    if (!changed) return g;
    const ended = g.status === 'over';
    if (ended) await rate(g);
    g.v++;
    const [ok] = await redis(['CAS', 'ttt:g:' + id, raw, JSON.stringify(g)]);
    if (!ok) continue;
    if (ended) {
      const { X, O } = g.players, e = g.result.elo, out = s => g.result.winner === s ? 'w' : g.result.winner ? 'l' : 'd';
      if (e) await Promise.all([saveRating(X.id, e.X.change, out('X')), saveRating(O.id, e.O.change, out('O'))]);
      await redis(['DEL', 'ttt:active:' + X.id], ['DEL', 'ttt:active:' + O.id], ['EXPIRE', 'ttt:g:' + id, 2 * 86400]);
    }
    return g;
  }
  fail(503, 'Busy, try again.');
}

async function create(a, b) {
  const [rows] = await redis(['MGET', 'ttt:elo:' + a, 'ttt:elo:' + b]);
  const [ra, rb] = rows.map(record);
  const aIsX = crypto.randomInt(2) === 0, now = Date.now();
  const [X, O] = aIsX ? [{ id: a, elo: ra.elo }, { id: b, elo: rb.elo }] : [{ id: b, elo: rb.elo }, { id: a, elo: ra.elo }];
  const g = {
    id: newId(9), v: 1, status: 'play', players: { X, O }, board: Array(9).fill(''), turn: 'X', moves: 0,
    clock: { X: CLOCK, O: CLOCK }, turnAt: now, start: now, first: FIRST, offer: null, offerMove: { X: -1, O: -1 }, result: null,
  };
  await redis(['SET', 'ttt:g:' + g.id, JSON.stringify(g)], ['SET', 'ttt:active:' + a, g.id], ['SET', 'ttt:active:' + b, g.id]);
  return g;
}

// the game this visitor is in the middle of, if any (ended first if its clock has run out)
async function activeGame(me) {
  const [id] = await redis(['GET', 'ttt:active:' + me]);
  if (!id) return null;
  const g = await update(id).catch(() => null);
  return g && g.status === 'play' ? g : null;
}

// ---------- the queue ----------
async function queue(me, b, res) {
  const playing = await activeGame(me);
  if (playing) return { state: 'game', game: playing };
  let ticket = typeof b.ticket === 'string' && /^[\w-]{10,40}$/.test(b.ticket) ? b.ticket : newId(12);
  const stop = Date.now() + HOLD;
  let gone = false, claimedSince = 0;
  res.on('close', () => { if (!res.writableEnded) gone = true; });   // the player closed the page
  for (;;) {
    const [m, claim] = await redis(['GET', 'ttt:match:' + ticket], ['GET', 'ttt:claim:' + ticket]);
    if (m) return { state: 'game', game: await update(m) };
    if (claim === 'left') return { state: 'left' };
    if (claim) {   // someone is pairing us right now: the game appears in a moment
      claimedSince = claimedSince || Date.now();
      if (Date.now() - claimedSince > 3000) { ticket = newId(12); claimedSince = 0; }   // they never finished: start over
      if (gone || Date.now() > stop) return { state: 'waiting', ticket };
      await sleep(100); continue;
    }
    // take whoever is waiting; pair with them if they're someone else and still there
    const [rawW] = await redis(['GETDEL', 'ttt:wait']), w = json(rawW);
    if (w && w.t !== ticket && w.id !== me && Date.now() - w.at < FRESH) {
      const [took] = await redis(['SET', 'ttt:claim:' + w.t, ticket, 'NX'], ['EXPIRE', 'ttt:claim:' + w.t, 600]);
      if (took === 'OK') {
        const [mine] = await redis(['SET', 'ttt:claim:' + ticket, w.t, 'NX'], ['EXPIRE', 'ttt:claim:' + ticket, 600]);
        if (mine === 'OK') {
          const g = await create(w.id, me);
          await redis(['SET', 'ttt:match:' + w.t, g.id], ['EXPIRE', 'ttt:match:' + w.t, 600],
            ['SET', 'ttt:match:' + ticket, g.id], ['EXPIRE', 'ttt:match:' + ticket, 600]);
          return { state: 'game', game: g };
        }
        // we were paired (or left) a moment ago ourselves: put them back
        await redis(['DEL', 'ttt:claim:' + w.t], ['SET', 'ttt:wait', rawW], ['EXPIRE', 'ttt:wait', 5]);
        continue;
      }
      // they were just taken by someone else: wait ourselves
    }
    if (gone) return { state: 'waiting', ticket };
    await redis(['SET', 'ttt:wait', JSON.stringify({ t: ticket, id: me, at: Date.now() })], ['EXPIRE', 'ttt:wait', 5]);
    if (Date.now() > stop) return { state: 'waiting', ticket };
    await sleep(POLL);
  }
}

async function leave(b) {
  const t = b.ticket;
  if (typeof t !== 'string' || !/^[\w-]{10,40}$/.test(t)) return { state: 'left' };
  const [ok] = await redis(['SET', 'ttt:claim:' + t, 'left', 'NX'], ['EXPIRE', 'ttt:claim:' + t, 600]);
  if (ok === 'OK') return { state: 'left' };
  for (let i = 0; i < 30; i++) {   // paired just before leaving: hand over the game
    const [m, claim] = await redis(['GET', 'ttt:match:' + t], ['GET', 'ttt:claim:' + t]);
    if (m) return { state: 'game', game: await update(m) };
    if (claim === 'left' || !claim) return { state: 'left' };
    await sleep(100);
  }
  return { state: 'left' };
}

// wait for something to happen in a game: a move, an offer, its end, or a clock running out
async function watch(b, res) {
  if (typeof b.id !== 'string') fail(400, 'Which game?');
  const stop = Date.now() + HOLD;
  let gone = false;
  res.on('close', () => { if (!res.writableEnded) gone = true; });
  for (;;) {
    const g = await update(b.id);
    if (g.v !== b.v || g.status !== 'play' || gone || Date.now() >= stop) return { game: g };
    const left = g.turnAt + Math.min(g.clock[g.turn], g.moves < 2 ? g.first : Infinity) - Date.now();
    await sleep(Math.max(20, Math.min(POLL, left + 5, stop - Date.now())));
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req, 2000);
    const me = await who(b.token);
    let out;
    switch (b.do) {
      case 'me': {
        const [raw] = await redis(['GET', 'ttt:elo:' + me]);
        out = { me: { id: me, ...record(raw) }, game: await activeGame(me) };
        break;
      }
      case 'queue': out = await queue(me, b, res); break;
      case 'leave': out = await leave(b); break;
      case 'watch': out = await watch(b, res); break;
      case 'move': case 'resign': case 'offer': case 'accept': case 'decline': {
        if (typeof b.id !== 'string') fail(400, 'Which game?');
        out = {
          game: await update(b.id, (g, now) => {
            const side = g.players.X.id === me ? 'X' : g.players.O.id === me ? 'O' : null;
            if (!side) fail(403, 'You are not playing in this game.');
            return act(g, side, b.do, b, now);
          }),
        };
        break;
      }
      default: fail(400, 'Unknown action.');
    }
    send(res, 200, { ...out, now: Date.now() });
  } catch (e) {
    send(res, e.status || 500, { error: e.message, now: Date.now() });
  }
};
