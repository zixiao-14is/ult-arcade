// Online play for Tic-Tac-Toe: a ranked queue against other people, with Elo and a 3-minute chess clock each.
// Website only: the Android app's copy of the games leaves this file out (app/scripts/build-www.js), and it also
// switches itself off inside the app. The rules and the Elo maths live on the server: api/ttt.js.
(function () {
  let inApp = false;
  try { inApp = !!(window.Capacitor || (window.parent !== window && window.parent.Capacitor)); } catch { }
  if (inApp || !location.protocol.startsWith('http')) return;

  const $ = id => document.getElementById(id);
  const TOUCH = matchMedia('(pointer: coarse)').matches;
  const get = k => { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const name = id => 'ULT #' + String(id).padStart(6, '0');
  const other = s => s === 'X' ? 'O' : 'X';
  const clock = ms => {
    ms = Math.max(0, ms);
    if (ms < 10000) return (Math.floor(ms / 100) / 10).toFixed(1);   // the last 10 seconds in tenths
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  // ---------- page parts ----------
  const css = document.createElement('style');
  css.textContent = `
    /* the board shrinks so the players, buttons and result always fit on the screen */
    #online { --cell: max(56px, min(24vw, calc((100vh - 400px) / 3), 130px)); }
    body.onl-playing h1 { display: none; }
    .onl-big { font-size: 20px; font-weight: bold; margin: 16px 0 6px; }
    .onl-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    .onl-btn { background: transparent; border: 1px solid var(--line); padding: 9px 14px; }
    .onl-btn:hover:not(:disabled), .onl-btn:focus-visible { border-color: var(--ok); background: rgba(159, 232, 159, .06); outline: none; }
    .onl-btn.arm { border-color: #ff6b6b; color: #ff6b6b; }
    .onl-btn:disabled { opacity: .4; cursor: default; }
    .onl-plr { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 8px auto;
      width: calc(var(--cell) * 3 + 12px); max-width: 100%; font-size: 15px; text-align: left; }
    .onl-plr.X { color: var(--x); } .onl-plr.O { color: var(--o); }
    .onl-plr .clock { font-size: 22px; font-weight: bold; padding: 2px 10px; border: 1px solid var(--line); min-width: 4.4em; text-align: center; color: var(--text); }
    .onl-plr.turn .clock { border-color: currentColor; background: rgba(255, 255, 255, .07); }
    .onl-plr .clock.low { color: #ff6b6b; }
    #onl-status { min-height: 1.5em; margin: 6px 0 8px; font-size: 18px; font-weight: bold; }
    #onl-board { display: grid; grid-template-columns: repeat(3, var(--cell)); grid-template-rows: repeat(3, var(--cell));
      gap: 6px; justify-content: center; background: var(--line); width: max-content; margin: 0 auto; }
    #onl-board .cell.pending { opacity: .45; }
    #onl-offer { margin-top: 12px; color: var(--gold); }
    #onl-offer .onl-btn { padding: 5px 10px; margin-left: 6px; }
    #onl-err { min-height: 1.4em; margin-top: 10px; font-size: 13px; color: #ff6b6b; }
  `;
  document.head.appendChild(css);

  const sec = document.createElement('section');
  sec.id = 'online'; sec.className = 'hidden';
  sec.innerHTML = `
    <div id="onl-queue">
      <div class="onl-big">LOOKING FOR AN OPPONENT</div>
      <div class="dim">waiting <span id="onl-wait">0:00</span></div>
      <div id="onl-me" class="dim"></div>
      <div class="onl-row"><button class="onl-btn" id="onl-cancel">CANCEL</button></div>
    </div>
    <div id="onl-game" class="hidden">
      <div class="onl-plr" id="onl-top"><span class="who"></span><span class="clock"></span></div>
      <div id="onl-status"></div>
      <div id="onl-board"></div>
      <div class="onl-plr" id="onl-you"><span class="who"></span><span class="clock"></span></div>
      <div id="onl-offer" class="hidden">They offer a draw<button class="onl-btn" id="onl-accept">ACCEPT</button><button class="onl-btn" id="onl-decline">DECLINE</button></div>
      <div class="onl-row" id="onl-acts"><button class="onl-btn" id="onl-draw">OFFER DRAW</button><button class="onl-btn" id="onl-resign">RESIGN</button></div>
      <div id="onl-result" class="hidden">
        <div class="onl-big" id="onl-restxt"></div>
        <div id="onl-why" class="dim"></div>
        <div id="onl-elo"></div>
        <div class="onl-row"><button class="onl-btn" id="onl-again">PLAY AGAIN</button><button class="onl-btn" id="onl-menu">MENU</button></div>
      </div>
      <div class="dim help" id="onl-help"></div>
    </div>
    <div id="onl-err"></div>`;
  document.querySelector('main').appendChild(sec);

  const opt = document.createElement('button');
  opt.className = 'opt';
  opt.innerHTML = '<kbd>4</kbd><span>PLAY ONLINE · RANKED<small id="onl-info">vs a real person · Elo · 3 min each</small></span>';
  document.querySelector('#menu .options').appendChild(opt);
  $('menuhelp').textContent = $('menuhelp').textContent.replace('1 / 2 / 3', '1 / 2 / 3 / 4');

  const cells = [];
  for (let i = 0; i < 9; i++) {
    const c = document.createElement('button');
    c.className = 'cell';
    c.setAttribute('aria-label', 'square ' + (i + 1));
    c.addEventListener('click', () => move(i));
    $('onl-board').appendChild(c);
    cells.push(c);
  }
  $('onl-help').textContent = TOUCH ? 'tap a square' : '1-9 or click a square';

  // ---------- talking to the server ----------
  let me = null, offset = 0;   // offset: the server's clock minus ours
  const serverNow = () => Date.now() + offset;
  function newToken() {
    const b = crypto.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // our visitor number and token (visitor.js normally has them already; made here if this page was opened on its own)
  async function ensureMe(fresh) {
    me = get('ult:visitor');
    if (!fresh && me && me.token && me.id) return me;
    const token = (!fresh && me && me.token) || newToken();
    set('ult:visitor', { token });
    const r = await fetch('/api/visit', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ token, device: TOUCH ? 'phone/tablet' : 'computer' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error(j.error || 'Could not reach the server.');
    me = { id: j.id, token: j.token }; set('ult:visitor', me);
    return me;
  }
  async function call(data, signal, retried) {
    if (!me) await ensureMe();
    let r;
    try { r = await fetch('/api/ttt', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ token: me.token, ...data }), signal }); }
    catch (e) { if (e.name === 'AbortError') throw e; throw new Error('No connection to the server.'); }
    const j = await r.json().catch(() => ({}));
    if (typeof j.now === 'number') offset = j.now - Date.now();
    if (r.status === 401 && !retried) { await ensureMe(true); return call(data, signal, true); }   // the server forgot us: new number
    if (!r.ok) throw new Error(j.error || 'Server error ' + r.status + '.');
    return j;
  }
  const err = t => { $('onl-err').textContent = t || ''; };

  // ---------- screens ----------
  let state = 'off', run = 0, ctrl = null;   // run: bumped to stop whatever loop is going
  let ticket = null, queuedAt = 0, g = null, side = null, pending = null, sending = false, resignArm = 0;
  function show(s) {
    state = s; run++;
    if (ctrl) ctrl.abort(); ctrl = null;
    const on = s !== 'off';
    $('menu').classList.toggle('hidden', on);
    sec.classList.toggle('hidden', !on);
    if (on) document.body.dataset.online = '1'; else delete document.body.dataset.online;
    document.body.classList.toggle('onl-playing', s === 'game');
    $('onl-queue').classList.toggle('hidden', s !== 'queue');
    $('onl-game').classList.toggle('hidden', s !== 'game');
    err('');
  }
  function toMenu() { show('off'); info(); }

  // the menu line: your rating, or a game to go back to
  async function info() {
    try {
      const r = await call({ do: 'me' });
      const m = r.me;
      $('onl-info').textContent = r.game ? 'you have a game going · REJOIN' :
        `your Elo ${m.elo} · ${m.w} won · ${m.d} drawn · ${m.l} lost`;
      $('onl-me').textContent = `${name(m.id)} · Elo ${m.elo}`;
    } catch { }
  }

  async function queue() {
    show('queue'); queuedAt = Date.now(); ticket = null;
    const my = run;
    try { await ensureMe(); } catch (e) { return err(e.message); }
    $('onl-me').textContent = name(me.id);
    info();
    while (state === 'queue' && run === my) {
      ctrl = new AbortController();
      try {
        const r = await call({ do: 'queue', ticket }, ctrl.signal);
        if (run !== my) return;
        err('');
        if (r.state === 'game') return startGame(r.game);
        ticket = r.state === 'waiting' ? r.ticket : null;
      } catch (e) {
        if (run !== my) return;
        err(e.message); await sleep(1500);
      }
    }
  }
  async function cancel() {
    const t = ticket;
    toMenu();
    if (!t) return;
    try { const r = await call({ do: 'leave', ticket: t }); if (r.state === 'game' && state === 'off') startGame(r.game); }   // paired just in time
    catch { }
  }
  // closing the page while queueing: tell the server, so nobody gets paired with an empty chair
  addEventListener('pagehide', () => {
    if (state === 'queue' && ticket && me) navigator.sendBeacon('/api/ttt', new Blob([JSON.stringify({ token: me.token, do: 'leave', ticket })], { type: 'text/plain' }));
  });

  function startGame(game) {
    show('game');
    g = game; side = g.players.X.id === me.id ? 'X' : 'O'; pending = null; resignArm = 0;
    render();
    watch();
  }
  // wait for the other player (the server answers as soon as anything changes)
  async function watch() {
    const my = run;
    while (state === 'game' && run === my && g.status === 'play') {
      ctrl = new AbortController();
      try { const r = await call({ do: 'watch', id: g.id, v: g.v }, ctrl.signal); if (run !== my) return; take(r.game); err(''); }
      catch (e) { if (run !== my) return; err(e.message); await sleep(1000); }
    }
  }
  function take(game) {
    if (g && game.id === g.id && game.v <= g.v) return;
    g = game; pending = null; render();
  }
  async function act(data) {
    if (sending) return;
    sending = true; render();
    try { const r = await call({ id: g.id, ...data }); take(r.game); err(''); }
    catch (e) { pending = null; err(e.message); }
    sending = false; render();
  }
  function move(i) {
    if (state !== 'game' || g.status !== 'play' || g.turn !== side || g.board[i] || pending !== null || sending) return;
    pending = i;
    act({ do: 'move', cell: i });
  }

  // ---------- drawing ----------
  function playerRow(el, s) {
    const p = g.players[s], you = s === side;
    el.className = 'onl-plr ' + s + (g.status === 'play' && g.turn === s ? ' turn' : '');
    el.querySelector('.who').textContent = `${s} · ${name(p.id)}${you ? ' (you)' : ''} · ${p.elo}`;
  }
  function timeLeft(s) {
    let t = g.clock[s];
    if (g.status === 'play' && g.turn === s) t -= serverNow() - g.turnAt;
    return t;
  }
  function clocks() {
    if (state === 'queue') { const s = Math.floor((Date.now() - queuedAt) / 1000); $('onl-wait').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    if (state !== 'game' || !g) return;
    for (const [id, s] of [['onl-top', other(side)], ['onl-you', side]]) {
      const c = $(id).querySelector('.clock'), t = timeLeft(s);
      c.textContent = clock(t);
      c.classList.toggle('low', t < 20000 && g.status === 'play');
    }
    if (g.status === 'play') $('onl-status').textContent = statusLine();
  }
  setInterval(clocks, 100);
  function statusLine() {
    const mine = g.turn === side;
    let t = mine ? `YOUR MOVE (${side})` : 'THEIR MOVE...';
    if (g.moves < 2) {   // a side that never makes its first move aborts the game
      const left = Math.max(0, g.first - (serverNow() - g.turnAt));
      t += mine ? ` · first move within ${Math.ceil(left / 1000)} s` : ` · they have ${Math.ceil(left / 1000)} s to start`;
    }
    return t;
  }
  function render() {
    if (state !== 'game' || !g) return;
    playerRow($('onl-top'), other(side));
    playerRow($('onl-you'), side);
    const over = g.status !== 'play', line = over && g.result.line || [];
    cells.forEach((c, i) => {
      const v = g.board[i] || (pending === i ? side : '');
      c.className = 'cell' + (v ? ' ' + v : '') + (pending === i ? ' pending' : '') + (line.includes(i) ? ' win' : '');
      c.innerHTML = v || `<span class="n">${i + 1}</span>`;
      c.disabled = over || !!g.board[i] || g.turn !== side || pending !== null;
    });
    $('onl-acts').classList.toggle('hidden', over);
    $('onl-offer').classList.toggle('hidden', over || g.offer !== other(side));
    const d = $('onl-draw');
    d.textContent = g.offer === side ? 'DRAW OFFERED' : 'OFFER DRAW';
    d.disabled = sending || g.offer === side || g.offerMove[side] === g.moves;
    d.title = g.offerMove[side] === g.moves && g.offer !== side ? 'make a move first' : '';
    const rz = $('onl-resign');
    rz.textContent = resignArm > Date.now() ? 'SURE? CLICK AGAIN' : 'RESIGN';
    rz.classList.toggle('arm', resignArm > Date.now());
    rz.disabled = sending;
    $('onl-result').classList.toggle('hidden', !over);
    $('onl-help').classList.toggle('hidden', over);
    const st = $('onl-status');
    if (!over) { st.style.color = `var(--${g.turn.toLowerCase()})`; st.textContent = statusLine(); }
    else {
      const r = g.result, won = r.winner === side, e = r.elo && r.elo[side];
      st.textContent = '';
      $('onl-restxt').textContent = r.reason === 'aborted' ? 'GAME ABORTED' : !r.winner ? 'DRAW' : won ? 'YOU WIN' : 'YOU LOSE';
      $('onl-restxt').style.color = r.reason === 'aborted' || !r.winner ? 'var(--gold)' : won ? 'var(--ok)' : '#ff6b6b';
      $('onl-why').textContent = {
        line: won ? 'three in a row' : 'they got three in a row', draw: 'the board is full', agreed: 'draw agreed',
        resign: won ? 'they resigned' : 'you resigned', time: won ? 'their time ran out' : 'your time ran out',
        aborted: 'the first move never came, so nothing counts',
      }[r.reason];
      $('onl-elo').textContent = e ? `Elo ${e.before} → ${e.after} (${e.change >= 0 ? '+' : ''}${e.change})` : 'Elo unchanged';
    }
    clocks();
  }

  // ---------- buttons and keys ----------
  opt.addEventListener('click', queue);
  $('onl-cancel').addEventListener('click', cancel);
  $('onl-again').addEventListener('click', queue);
  $('onl-menu').addEventListener('click', toMenu);
  $('onl-draw').addEventListener('click', () => act({ do: 'offer' }));
  $('onl-accept').addEventListener('click', () => act({ do: 'accept' }));
  $('onl-decline').addEventListener('click', () => act({ do: 'decline' }));
  $('onl-resign').addEventListener('click', () => {
    if (resignArm > Date.now()) { resignArm = 0; act({ do: 'resign' }); return; }
    resignArm = Date.now() + 3000; render();
    setTimeout(render, 3050);
  });
  addEventListener('keydown', e => {
    if (state === 'off') { if (e.key === '4' && !$('menu').classList.contains('hidden')) queue(); return; }
    const k = e.key;
    if (state === 'queue') { if (k === 'Escape') cancel(); return; }
    if (g.status === 'play') {
      if (/^[1-9]$/.test(k)) move(+k - 1);
      else if (k === 'Escape') err('To leave this game, resign first.');
      return;
    }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); queue(); }
    else if (k === 'Escape') toMenu();
  });

  info();
})();
