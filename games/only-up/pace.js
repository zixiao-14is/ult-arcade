// Measures the climb with simulated players on the real engine, so changes to the level can be checked:
//   node games/only-up/pace.js [runs]
// It first proves every jump on the route can be made, then plays the whole game with imperfect players:
// they misjudge where they jump from and aim, make the odd big mistake, stop to look before each jump, and
// try to steer onto something when they fall. The numbers are a model of a player, not a real person.
const { PW, STEP, LEVEL: lv, rng, newState, cloneState, step, isGone, platX, platY } = require('./engine.js');
const plats = lv.plats;

const SKILLS = {
  'above average': { launch: 2.4, aim: 1.7, slip: 0.015, think: 0.85 },
  average: { launch: 3.5, aim: 2.5, slip: 0.03, think: 1.1 },
  'below average': { launch: 5, aim: 3.6, slip: 0.05, think: 1.4 },
};

function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }

// One attempted jump: optionally wait, optionally walk back for a run-up, run to L (relative to the platform), jump.
function makeExec(plan, from) {
  return { ...plan, from, phase: plan.wait > 0 ? 'wait' : plan.back !== null ? 'back' : 'run', clock: 0, lag: 0, l: false, r: false };
}
function steer(s, ex) {
  // people don't react every tick, so the steering only updates every 50 ms
  if ((ex.lag -= STEP) > 0) return;
  ex.lag = 0.05;
  const T = plats[ex.target];
  const e = platX(T, s.t) + T.w / 2 + ex.aimErr - (s.x + PW / 2);
  const stop = s.vx * s.vx / (2 * 620);
  ex.l = ex.r = false;
  if (Math.abs(e) < 2) return;
  if (s.vx * e > 0 && stop >= Math.abs(e)) { if (e > 0) ex.l = true; else ex.r = true; }
  else if (e > 0) ex.r = true; else ex.l = true;
}
// returns [left, right, held, pressed]
function act(s, ex) {
  if (ex.phase === 'air') { steer(s, ex); return [ex.l, ex.r, true, false]; }
  const p = plats[ex.from], rel = s.x - platX(p, s.t);
  ex.clock += STEP;
  if (ex.phase === 'wait') {
    if (ex.clock >= ex.wait) ex.phase = ex.back !== null ? 'back' : 'run';
    return [false, false, false, false];
  }
  if (ex.clock > ex.wait + 5) { ex.dir = undefined; ex.L = rel; }   // sliding around on ice: just go from here
  if (ex.phase === 'back') {
    if (Math.abs(rel - ex.back) < 1.5) ex.phase = 'run';
    else return [rel > ex.back, rel < ex.back, false, false];
  }
  if (ex.dir === undefined) ex.dir = rel < ex.L ? 1 : -1;
  if (ex.dir * (rel - ex.L) >= -0.5) { ex.phase = 'air'; return [ex.dir < 0, ex.dir > 0, true, true]; }
  return [ex.dir < 0, ex.dir > 0, false, false];
}

// Try a plan on a copy of the game with no mistakes. Returns how safely it lands (px from the nearer edge) or -1.
function trial(s0, plan, from) {
  const s = cloneState(s0), ex = makeExec(plan, from);
  for (let n = 0; n < 960; n++) {
    const [l, r, h, c] = act(s, ex);
    step(s, lv, STEP, l, r, h, c);
    if (s.touch >= 0) {
      if (s.touch < plan.target) return -1;
      const T = plats[s.touch], x = platX(T, s.t);
      return Math.min(s.x + PW - x, x + T.w - s.x);
    }
    if (s.on < 0 && s.y < plats[plan.target].y - 40 && s.vy < 0) return -1;
  }
  return -1;
}
const planCache = new Map();
function planFrom(s, from) {
  const p = plats[from], T = plats[from + 1];
  if (!T) return null;
  const zone = lv.zones[T.zone], timed = p.move || T.move || zone.wind;
  // the best launch depends on which way you're coming from, so only reuse a plan from about the same spot
  const key = from + ':' + Math.round((s.x - platX(p, s.t)) / 8) + ':' + Math.round(s.vx / 30);
  if (!timed && planCache.has(key)) return planCache.get(key);
  const clean = cloneState(s);
  clean.cr = {};   // plan as if crumbled platforms are back; the player waits for them before jumping
  const period = (T.move && T.move.period) || (p.move && p.move.period) || (zone.wind && zone.wind.period) || 1;
  const waits = timed ? [0, 1, 2, 3, 4, 5, 6, 7].map(i => i * period / 8) : [0];
  const room = p.w - PW, px = platX(p, s.t);
  const dirTo = platX(T, s.t) + T.w / 2 > px + p.w / 2 ? 1 : -1;
  // people can run right to the edge, and hang up to a body width over it
  const lo = Math.max(2 - PW, room > 200 ? T.x - p.x - 70 : 2 - PW), hi = Math.min(room + PW - 2, room > 200 ? T.x - p.x + 70 : room + PW - 2);
  const stepL = Math.max(2, (hi - lo) / 16);
  const backs = room >= 16 && room <= 200 ? [null, dirTo > 0 ? 0 : room] : [null];
  // A sensible player launches from the middle of the range of spots that work, not the one that lands best,
  // and takes the first moment that leaves room for error rather than waiting for the perfect one.
  let best = null, bestRun = -1;
  search: for (const wait of waits) for (const back of backs) {
    let run = 0, runStart = 0;
    const check = end => {
      const width = (run - 1) * stepL;
      if (run > 0 && width > bestRun) { bestRun = width; best = { wait, back, L: runStart + width / 2, target: from + 1, aimErr: 0, margin: width }; }
    };
    for (let L = lo; L <= hi; L += stepL) {
      if (trial(clean, { wait, L, back, target: from + 1, aimErr: 0 }, from) >= 0) { if (!run) runStart = L; run++; }
      else { check(); run = 0; }
    }
    check();
    if (bestRun >= 10) break search;
  }
  if (!timed && best) planCache.set(key, best);
  return best;
}

// When falling, look for something below to steer onto, like a person would
function catchAim(s) {
  const reachX = v => (v / 320) * 92;
  let bestX = null, bestY = -Infinity;
  for (let i = Math.min(plats.length - 1, 1 + binAbove(s.y)); i >= 0; i--) {
    const p = plats[i];
    if (p.y > s.y) continue;
    const drop = s.y - p.y;
    if (drop > 160) break;
    if (isGone(s, i)) continue;
    const x = platX(p, s.t), near = Math.max(x - s.x, s.x - (x + p.w), 0);
    if (near <= reachX(drop) && p.y > bestY) { bestY = p.y; bestX = x + p.w / 2; }
  }
  return bestX;
}
function binAbove(y) {
  let lo = 0, hi = plats.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (plats[m].y <= y + 40) lo = m; else hi = m - 1; }
  return lo;
}

// Play the whole game. Returns finish time plus attempts and passes for each zone.
function play(skill, seed, limit) {
  const r = rng(seed), s = newState();
  const zones = lv.zones.map(() => ({ tries: 0, passes: 0, time: 0 }));
  const tries = new Array(plats.length).fill(0), passes = new Array(plats.length).fill(0);
  let ex = null, think = 0.5, catchX = null, catchClock = 0, stuck = 0;
  const thinkTime = extra => skill.think * (0.6 + r() * 0.9) + extra;
  while (!s.won && s.t < limit) {
    let input = [false, false, false, false];
    if (s.on >= 0 && !ex) {
      if (plats[s.on].type === 'crumble') think = Math.min(think, 0.2);
      if (T_gone(s, s.on + 1)) think = Math.max(think, 0.2);
      if ((think -= STEP) <= 0) {
        const plan = planFrom(s, s.on);
        if (plan) {
          const big = r() < skill.slip ? 3 : 1;
          ex = makeExec({ wait: plan.wait, back: plan.back, target: plan.target, L: plan.L + gauss(r) * skill.launch * big,
            aimErr: gauss(r) * skill.aim * big }, s.on);
          if (plan.wait > 0) ex.wait = Math.max(0, plan.wait + gauss(r) * 0.06 * big);
          zones[plats[plan.target].zone].tries++;
          tries[plan.target]++;
        } else { stuck++; think = 0.5; }
      }
    } else if (s.on < 0 && !ex) {
      // falling: steer towards something to catch
      if ((catchClock -= STEP) <= 0) { catchX = catchAim(s); catchClock = 0.15; }
      if (catchX !== null) {
        const e = catchX - (s.x + PW / 2);
        if (Math.abs(e) > 2) input = [e < 0, e > 0, false, false];
      }
    }
    if (ex) input = act(s, ex);
    // anyone stopped on ice holds the opposite way so they don't slide off
    if (s.on >= 0 && plats[s.on].type === 'ice' && (!ex || ex.phase === 'wait') && Math.abs(s.vx) > 4) input = [s.vx > 0, s.vx < 0, false, false];
    const y0 = plats[Math.min(plats.length - 1, Math.max(0, ex ? ex.target : s.on))].zone;
    step(s, lv, STEP, input[0], input[1], input[2], input[3]);
    zones[y0].time += STEP;
    if (s.touch >= 0) {
      const hit = s.touch;
      if (ex && hit >= ex.target) { zones[plats[ex.target].zone].passes++; passes[ex.target]++; }
      ex = null;
      if (plats[hit].type === 'spring' && plats[hit + 1]) {
        ex = makeExec({ wait: 0, back: null, L: 0, target: hit + 1, aimErr: gauss(r) * skill.aim }, hit);
        ex.phase = 'air';
        zones[plats[hit + 1].zone].tries++;
        tries[hit + 1]++;
      }
      think = thinkTime(s.drop > 0 ? 1 + r() * 2 : 0);
    } else if (ex && ex.phase === 'air' && s.on < 0 && s.vy < 0 && s.y < plats[ex.target].y - 16) {
      ex = null;   // missed: now we're just falling
    } else if (ex && ex.phase !== 'air' && s.on < 0 && s.y < plats[ex.from].y - 16) {
      ex = null;   // walked or slid off the edge
    }
  }
  return { won: s.won, time: s.t, falls: s.falls, zones, stuck, tries, passes };
}
function T_gone(s, i) { return i < plats.length && isGone(s, i); }

function checkRoute() {
  let bad = 0, tight = [];
  for (let i = 0; i < plats.length - 1; i++) {
    const s = newState();
    s.on = i; s.y = platY(plats[i], 0); s.lastGroundY = s.y; s.x = platX(plats[i], 0) + plats[i].w / 2 - PW / 2;
    if (plats[i].type === 'spring') continue;   // springs launch you, checked in the playthroughs
    const plan = planFrom(s, i);
    if (!plan) { bad++; console.log(`  NO WAY from platform ${i} (${plats[i].type}) to ${i + 1} (${plats[i + 1].type}) in ${lv.zones[plats[i + 1].zone].name}`); }
    else if (plan.margin < 3) tight.push(i);
  }
  console.log(`route: ${plats.length} platforms, top at ${Math.round(lv.top / 8)} m, ${bad} impossible jumps, ${tight.length} with under 3 px to spare`);
  return bad;
}
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
module.exports = { SKILLS, gauss, makeExec, act, planFrom, play };

if (require.main === module) {
  const runs = +process.argv[2] || 12;
  if (checkRoute()) process.exitCode = 1;
  for (const [name, skill] of Object.entries(SKILLS)) {
    const res = [];
    for (let i = 0; i < runs; i++) res.push(play(skill, 1000 + i * 37, 4 * 3600));
    const done = res.filter(x => x.won), times = res.map(x => x.time).sort((a, b) => a - b);
    const med = times[Math.floor(times.length / 2)];
    const falls = res.reduce((a, x) => a + x.falls, 0) / runs, stuck = res.reduce((a, x) => a + x.stuck, 0);
    console.log(`\n${name}: finished ${done.length}/${runs}, median ${mmss(med)}, range ${mmss(times[0])} to ${mmss(times[times.length - 1])}, ${falls.toFixed(0)} falls, stuck ${stuck}`);
    lv.zones.forEach((z, zi) => {
      const tries = res.reduce((a, x) => a + x.zones[zi].tries, 0), passes = res.reduce((a, x) => a + x.zones[zi].passes, 0);
      const time = res.reduce((a, x) => a + x.zones[zi].time, 0) / runs;
      console.log(`  ${z.name.padEnd(11)} jumps made ${String(Math.round(100 * passes / Math.max(1, tries))).padStart(3)}%   avg time ${mmss(time)}`);
    });
    // the jumps that are hardest for this player, since one bad jump can eat the whole climb
    const hard = plats.map((p, i) => {
      const t = res.reduce((a, x) => a + x.tries[i], 0), ok = res.reduce((a, x) => a + x.passes[i], 0);
      return { i, t, rate: ok / Math.max(1, t) };
    }).filter(x => x.t >= 10).sort((a, b) => a.rate - b.rate).slice(0, 6);
    console.log('  hardest: ' + hard.map(x => `#${x.i} ${plats[x.i].type} ${Math.round(x.rate * 100)}% of ${x.t}`).join(', '));
  }
}
