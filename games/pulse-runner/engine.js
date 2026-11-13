// Pulse Runner engine: physics + level data, no DOM (can run headless in Node).
(function (root) {
  const PHYS = { G: 88, JUMP: 20.5, PAD: 28, ORB: 19, SHIP_A: 42, SHIP_MAX: 9.5, CEIL: 10, COYOTE: 0.08, BUFFER: 0.15 };

  // ---- level builder ----
  // block(x, y, w, h): a grid of 1x1 cubes.  slabs(x, n, y): n half-height 1-wide slabs, can float at any y.
  function builder() {
    const o = [];
    return {
      o,
      spike: (x, y = 0) => o.push({ t: 'spike', x, y }),
      spikes: (x, n, y = 0) => { for (let i = 0; i < n; i++) o.push({ t: 'spike', x: x + i, y }); },
      hang: (x, n = 1, y = PHYS.CEIL - 1) => { for (let i = 0; i < n; i++) o.push({ t: 'hang', x: x + i, y }); },
      block: (x, y, w = 1, h = 1) => o.push({ t: 'block', x, y, w, h }),
      slabs: (x, n, y = 0) => { for (let i = 0; i < n; i++) o.push({ t: 'block', x: x + i, y, w: 1, h: 0.5, slab: true }); },
      pad: (x, y = 0) => o.push({ t: 'pad', x, y }),
      orb: (x, y) => o.push({ t: 'orb', x, y }),
      portal: (x, k, y = 4) => o.push({ t: 'portal', x, k, y }),
    };
  }
  // Objects are kept sorted by x so step() only looks at the ones near the player (long levels stay fast).
  const level = (name, diff, speed, end, L, color, color2, bg, music) => {
    const objs = L.o.slice().sort((a, b) => a.x - b.x);
    return { name, diff, speed, end, objs, maxW: Math.max(1, ...objs.map(o => o.w || 1)), color, color2, bg, music };
  };

  function neonDrift() {
    const L = builder();
    L.spike(16); L.spikes(26, 2);
    L.block(36, 0, 3, 1); L.spike(43);
    L.slabs(50, 2); L.block(52, 0, 2, 1); L.block(54, 0, 2, 1); L.slabs(54, 2, 1);
    L.spikes(64, 2);
    L.block(72, 0, 2, 1); L.block(74, 0, 2, 2);
    L.spike(83);
    L.pad(90); L.spikes(92, 3);
    L.spikes(104, 3); L.orb(104.5, 2.6);
    L.portal(116, 'ship');
    L.block(126, 0, 1, 4); L.block(136, 6, 1, 4); L.block(146, 0, 1, 5); L.block(157, 5, 1, 5);
    L.block(166, 0, 1, 3); L.block(166, 7, 1, 3);
    L.portal(174, 'cube');
    L.spike(184); L.block(191, 0, 4, 1); L.spike(197);
    L.spikes(206, 2);
    L.portal(216, 'flip', 5);
    L.hang(228); L.hang(238, 2);
    L.portal(248, 'norm', 5);
    L.spike(260); L.spikes(268, 2);
    return level('Neon Drift', 'EASY', 10.4, 284, L, '#21e6ff', '#ff3df2', ['#071a3a', '#020611'], { bpm: 128, root: 45, prog: [0, 8, 3, 10], seed: 7 });
  }

  function skylineSteps() {
    const L = builder();
    L.spike(16);
    L.spikes(25, 2); L.slabs(24, 4, 1);
    L.slabs(36, 2, 1); L.spikes(38, 2); L.slabs(41, 2, 2); L.spikes(43, 2); L.slabs(46, 2, 3);
    L.spike(58);
    L.pad(66); L.spikes(68, 2); L.slabs(70, 3, 3);
    L.spikes(82, 2);
    L.spikes(90, 3); L.orb(90.5, 2.6);
    L.portal(100, 'ship');
    L.block(110, 0, 1, 4); L.block(118, 6, 1, 4); L.block(126, 3, 2, 2); L.block(135, 0, 1, 5); L.block(144, 5, 1, 5);
    L.portal(152, 'cube');
    L.slabs(160, 2, 1); L.spikes(162, 2); L.slabs(164, 2, 1);
    L.spike(174); L.spikes(182, 3);
    L.portal(192, 'flip', 5);
    L.hang(202, 2); L.slabs(210, 2, 9); L.hang(218, 3);
    L.portal(228, 'norm', 5);
    L.spike(238); L.slabs(245, 3, 1); L.spikes(246, 2);
    return level('Skyline Steps', 'EASY', 10.4, 262, L, '#b18cff', '#5df2d6', ['#1a0f3a', '#05030f'], { bpm: 120, root: 48, prog: [0, 5, 9, 7], seed: 3 });
  }

  function staticBloom() {
    const L = builder();
    L.spikes(16, 2); L.spikes(26, 3);
    L.block(36, 0, 2, 1); L.block(38, 0, 2, 1); L.slabs(38, 2, 1); L.block(40, 0, 2, 2); L.spikes(42, 2); L.block(44, 0, 3, 2);
    L.spikes(53, 3);
    L.pad(61); L.spikes(63, 2); L.block(65, 3, 3, 1);
    L.spikes(78, 2);
    L.spikes(86, 3); L.orb(86.5, 2.6); L.spikes(92, 2);
    L.portal(100, 'flip', 5);
    L.hang(110, 2); L.block(118, 9, 3, 1); L.hang(126, 3);
    L.portal(136, 'norm', 5);
    L.spikes(146, 3);
    L.portal(154, 'ship');
    for (let i = 0; i < 4; i++) { L.block(162 + i * 10, 0, 1, [3, 5, 3, 5][i]); L.block(167 + i * 10, [7, 6, 7, 6][i], 1, [3, 4, 3, 4][i]); }
    L.block(204, 0, 10, 3); L.block(204, 7, 10, 3);
    L.portal(220, 'cube');
    L.spike(228); L.block(234, 0, 2, 1); L.block(238, 0, 2, 2); L.block(242, 0, 2, 2); L.slabs(242, 2, 2); L.spikes(244, 3); L.block(247, 0, 2, 2);
    L.spikes(257, 3);
    L.pad(266); L.spikes(268, 3);
    L.spikes(280, 2);
    return level('Static Bloom', 'NORMAL', 11.2, 296, L, '#7dff5a', '#ffd23d', ['#0b2a17', '#020a05'], { bpm: 140, root: 43, prog: [0, 5, 8, 7], seed: 21 });
  }

  function pulseCascade() {
    const L = builder();
    L.spikes(16, 2); L.spikes(25, 3);
    L.block(34, 0, 2, 1); L.slabs(38, 2, 2); L.spikes(37, 3); L.block(42, 0, 2, 2);
    L.spikes(51, 3);
    L.slabs(58, 2, 1); L.spikes(60, 2); L.slabs(62, 2, 2); L.spikes(64, 2); L.slabs(66, 2, 3);
    L.spikes(78, 3); L.orb(78.5, 2.6); L.spikes(83, 2);
    L.pad(92); L.spikes(94, 3); L.slabs(97, 3, 2);
    L.portal(108, 'flip', 5);
    L.hang(116, 3); L.block(123, 9, 2, 1); L.hang(130, 2);
    L.portal(138, 'norm', 5);
    L.spikes(146, 3);
    L.portal(154, 'ship');
    L.block(164, 0, 1, 4); L.block(164, 8, 1, 2);
    L.block(173, 0, 1, 2); L.block(173, 6, 1, 4);
    L.block(182, 3, 2, 2);
    L.block(191, 0, 1, 5); L.block(191, 9, 1, 1);
    L.block(200, 0, 1, 2); L.block(200, 6, 1, 4);
    L.portal(208, 'cube');
    L.spike(216); L.block(222, 0, 2, 1); L.block(226, 0, 2, 2); L.slabs(230, 2, 2.5); L.spikes(230, 2);
    L.spikes(240, 3);
    L.spikes(250, 2); L.spikes(257, 3);
    return level('Pulse Cascade', 'NORMAL', 11.2, 272, L, '#3db8ff', '#ff8a3d', ['#06223a', '#01060d'], { bpm: 134, root: 41, prog: [0, 7, 9, 5], seed: 55 });
  }

  function overclock() {
    const L = builder();
    L.spikes(14, 3); L.spikes(22, 3);
    L.block(30, 0, 3, 1); L.spikes(33, 2); L.block(35, 0, 3, 2);
    L.spikes(47, 3); L.orb(47.5, 2.6); L.spikes(53, 3); L.orb(53.5, 2.6); L.spikes(60, 2);
    L.portal(64, 'flip', 5);
    L.hang(72, 3); L.block(79, 9, 2, 1); L.hang(84, 3); L.hang(93, 3);
    L.portal(101, 'norm', 5);
    L.spikes(109, 3);
    L.portal(117, 'ship');
    for (let i = 0; i < 6; i++) { const g = [3, 5, 2, 5, 3, 4][i]; L.block(127 + i * 8, 0, 1, g); L.block(127 + i * 8, g + 4, 1, 6 - g); }
    L.block(177, 0, 14, 4); L.block(177, 8, 14, 2);
    L.portal(195, 'cube');
    L.spikes(203, 3);
    L.pad(211); L.spikes(213, 3);
    L.block(223, 0, 2, 1); L.spikes(225, 2); L.block(227, 0, 2, 2); L.spikes(229, 2); L.block(231, 0, 3, 3);
    L.spikes(241, 3);
    L.portal(250, 'flip', 5); L.hang(258, 3); L.hang(266, 3); L.portal(274, 'norm', 5);
    L.spikes(282, 3); L.spikes(290, 3);
    return level('Overclock', 'HARD', 12, 306, L, '#ff4d6d', '#ffae3d', ['#2e0716', '#0a0105'], { bpm: 156, root: 40, prog: [0, 3, 10, 8], seed: 99 });
  }

  function hyperdrive() {
    const L = builder();
    L.spikes(14, 3); L.spikes(21, 3);
    L.block(29, 0, 3, 1); L.spikes(32, 2); L.block(34, 0, 3, 2); L.spikes(37, 2); L.block(39, 0, 3, 2);
    L.spikes(48, 3);
    L.slabs(57, 2, 1); L.spikes(59, 3); L.slabs(62, 2, 2.5); L.spikes(64, 3); L.slabs(67, 2, 1.5);
    L.spikes(77, 3); L.orb(77.5, 2.6); L.spikes(83, 2);
    L.portal(90, 'flip', 5);
    L.hang(98, 3); L.block(105, 9, 2, 1); L.hang(110, 3);
    L.portal(120, 'norm', 5);
    L.spikes(128, 3);
    L.portal(136, 'ship');
    for (let i = 0; i < 6; i++) { const g = [2, 5, 3, 6, 2, 4][i]; L.block(146 + i * 9, 0, 1, g); L.block(146 + i * 9, g + 4, 1, 6 - g); }
    L.portal(204, 'cube');
    L.pad(212); L.spikes(214, 3); L.slabs(218, 3, 2);
    L.spikes(230, 3); L.spikes(237, 3);
    return level('Hyperdrive', 'HARD', 12, 254, L, '#ffe14d', '#ff3d7f', ['#2a2206', '#090701'], { bpm: 160, root: 38, prog: [0, 10, 8, 7], seed: 77 });
  }

  // The special level: 17 minutes of a random (but always the same) mix of running, running upside down, flying and
  // flying upside down, with no loop and no warm-up.
  // It is built backwards from one perfect run. First the perfect button presses are made up (random waits between
  // jumps, random climbs and dives when flying), then every column of the level gets a spike below and a spike above
  // that hug the path of that perfect run AND of the same run with any ONE press a single physics tick off.
  // So every press has a window of 2 ticks = 8.3 ms: one tick off still works, two ticks off hits a spike.
  // The bot plays the perfect run (lv.plan, copied into bot.js), which proves the level can be beaten.
  function asianMode() {
    const C = PHYS.CEIL, SPEED = 12, DT = 1 / 240, LENGTH = 17 * 60 * 240, EPS = 0.002;
    // seeded random numbers (mulberry32): the level comes out exactly the same in every browser
    let seed = 888;
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
    const randi = (lo, hi) => lo + Math.floor((hi - lo + 1) * rnd());

    // ---- 1) the perfect run, on a copy of the level that has only the portals (nothing else changes the path) ----
    const portals = [], sim = { speed: SPEED, end: Infinity, objs: portals, maxW: 1 };
    const plan = [], snaps = [];   // plan: ticks where the button changes (even = press, odd = release), as in bot.js
    const xs = [], ys = [], vys = [];   // the perfect run after every tick
    const s = newState(); let t = 0, held = false, before = { ...s };
    const tick = () => { before = { ...s }; step(s, sim, DT, held, false); t++; xs.push(s.x); ys.push(s.y); vys.push(s.vy); };
    const setHeld = h => { if (h === held) return; snaps.push({ prev: { ...before }, now: { ...s } }); plan.push(t); held = h; };
    // a portal the player goes through on the next tick
    const portal = k => portals.push({ t: 'portal', x: s.x + 0.5 + SPEED * DT / 2, k, y: s.grav === 1 ? 4 : 5 });
    let type = 'run';
    const enter = k => {
      const up = k.endsWith('Up'), fly = k.startsWith('fly');
      if (up !== (s.grav === -1)) portal(up ? 'flip' : 'norm');
      if (fly !== (s.mode === 'ship')) portal(fly ? 'ship' : 'cube');
      type = k;
    };
    // running: land, then jump after a random wait (0.08-0.58 s), tap for 6 ticks, land, again
    const run = until => {
      setHeld(false);
      tick(); while (!s.ground) tick();   // (one tick first: a portal you just went through may still be moving you)
      while (t < until) {
        for (let i = randi(20, 140); i > 0; i--) tick();
        setHeld(true); for (let i = 0; i < 6; i++) tick(); setHeld(false);
        while (!s.ground) tick();
      }
    };
    // a jump whose top is where you take off into a flight (taking off from the floor would be too easy: the floor is safe)
    const launch = () => {
      for (let i = randi(20, 140); i > 0; i--) tick();
      setHeld(true); for (let i = 0; i < 6; i++) tick(); setHeld(false);
      while (s.vy * s.grav > 0) tick();
    };
    // flying: climbs and dives of 0.48-0.63 s, each long enough to reach full speed, kept between 1.2 and 7.8
    // (never near the floor or the roof: those are safe to touch, so there would be no spike to hit)
    const fits = (h, D, min, max) => {
      const c = cloneState(s);
      for (let i = 0; i < D + 60; i++) { step(c, sim, DT, i < D ? h : !h, false); if (c.y < min || c.y > max) return false; }
      return true;
    };
    const fly = until => {
      for (let i = randi(2, 8); i > 0; i--) tick();
      while (t < until) {
        const pref = s.y < 3 ? 1 : s.y > 6 ? -1 : rnd() < 0.5 ? 1 : -1, mid = s.y < 4.5 ? 1 : -1;
        let pick = null;
        for (const [min, max] of [[1.2, 7.8], [0.6, 8.4]]) {
          for (const dir of [pref, -pref]) for (let k = 0; k < 6 && !pick; k++) {
            const D = randi(116, 150), h = dir === s.grav;
            if (fits(h, D, min, max)) pick = { h, D };
          }
          if (pick) break;
        }
        // nothing long enough fits: a shorter move towards the middle
        for (let D = 108; !pick && D >= 24; D -= 12) if (fits(mid === s.grav, D, 0.6, 8.4)) pick = { h: mid === s.grav, D };
        if (!pick) pick = { h: mid === s.grav, D: 60 };
        setHeld(pick.h);
        for (let i = 0; i < pick.D; i++) tick();
      }
    };
    for (let i = 0; i < 120; i++) tick();   // half a second to get going
    run(t + randi(360, 1080));
    while (t < LENGTH) {
      const options = ['run', 'runUp', 'fly', 'flyUp'].filter(k => k !== type), next = options[randi(0, 2)];
      if (next.startsWith('fly') && s.mode === 'cube') launch();
      enter(next);
      (type.startsWith('fly') ? fly : run)(t + randi(360, 1080));   // 1.5-4.5 s each
    }
    if (s.mode === 'ship') { enter(s.grav === 1 ? 'run' : 'runUp'); run(t); }
    for (let i = 0; i < 60; i++) tick();
    const end = s.x;

    // ---- 2) where the player may be, column by column ----
    const cols = Math.ceil(end) + 3, lo = new Float64Array(cols).fill(Infinity), hi = new Float64Array(cols).fill(-Infinity);
    // the same test as the spike hit box in step(): which columns a player at x overlaps
    const mark = (x, y) => {
      const ax = x + 0.15;
      for (let c = Math.max(0, Math.floor(x - 0.6)); c <= x + 0.6 && c < cols; c++) {
        const bx = c + 0.3;
        if (ax < bx + 0.4 && ax + 0.7 > bx) { if (y < lo[c]) lo[c] = y; if (y > hi[c]) hi[c] = y; }
      }
    };
    mark(0, 0);
    for (let k = 0; k < xs.length; k++) mark(xs[k], ys[k]);
    // the perfect run with press i moved by d ticks; stops once it is back on the perfect path
    const offRun = (i, d) => {
      const e = plan[i] + d, k0 = Math.min(plan[i], e), c = cloneState(d < 0 ? snaps[i].prev : snaps[i].now);
      let h = i % 2 === 1, j = i;
      const path = [];
      for (let k = k0; k < xs.length && k < k0 + 4000; k++) {
        while (j < plan.length && (j === i ? e : plan[j]) <= k) { h = j % 2 === 0; j++; }
        step(c, sim, DT, h, false);
        path.push(c.x, c.y);
        if (k > Math.max(plan[i], e) && c.y === ys[k] && c.vy === vys[k]) break;
      }
      return path;
    };
    for (let i = 0; i < plan.length; i++) {
      if (snaps[i].now.mode === 'cube' && i % 2 === 1) continue;   // letting go while running doesn't change the jump
      // One tick off can leave you a little higher or lower for the rest of a flight. Use whichever direction puts
      // you higher, so all those paths sit on the same side of the perfect one and the gap stays one tick wide.
      let d = 1, far = 0;
      const p = offRun(i, 1);
      for (let k = 0; k < p.length / 2; k++) { const diff = p[k * 2 + 1] - ys[plan[i] + k]; if (Math.abs(diff) > Math.abs(far)) far = diff; }
      if (far < 0) d = -1;
      const path = d === 1 ? p : offRun(i, d);
      for (let k = 0; k < path.length; k += 2) mark(path[k], path[k + 1]);
    }

    // ---- 3) the spikes: tips just under your feet and just over your head ----
    const L = builder();
    for (const p of portals) L.portal(p.x, p.k, p.y);
    for (let c = 0; c < cols; c++) {
      if (lo[c] === Infinity) continue;
      const below = lo[c] + 0.15 - 0.5 - EPS, above = hi[c] + 0.35 + EPS;
      if (below >= 0) { L.spike(c, below); if (below > 0.05) L.o.push({ t: 'fill', x: c, y: 0, w: 1, h: below }); }
      if (above + 1 <= C) { L.hang(c, 1, above); if (above + 1 < C - 0.05) L.o.push({ t: 'fill', x: c, y: above + 1, w: 1, h: C - above - 1 }); }
    }
    const lv = level('Asian Mode', 'IMPOSSIBLE', SPEED, end, L, '#ff2e2e', '#ffd23d', ['#3a0606', '#0a0101'], { bpm: 174, root: 38, prog: [0, 1, 5, 6], seed: 888 });
    lv.plan = plan;   // the perfect run (make-bot.js checks it and writes it to bot.js)
    // the screen blurs for 'length' seconds every 'every' seconds into the run (by position, so always the same spots).
    // Only the picture: the physics don't change, so the level is exactly as possible as without it.
    lv.blur = { every: 1.5, length: 0.6, px: 8 };
    // the portals still work but aren't drawn (nor marked on the pause strip): you get no warning before running
    // turns into flying or gravity flips
    lv.hidePortals = true;
    return lv;
  }

  const LEVELS = [neonDrift(), skylineSteps(), staticBloom(), pulseCascade(), overclock(), hyperdrive(), asianMode()];

  // ---- simulation ----
  function newState() {
    return { x: 0, y: 0, vy: 0, grav: 1, mode: 'cube', ground: true, coyote: PHYS.COYOTE, dead: false, won: false, buffer: 0, used: new Set() };
  }
  function cloneState(s) { return { ...s, used: new Set(s.used) }; }

  const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  function step(s, lv, dt, held, pressed) {
    if (s.dead || s.won) return;
    const P = PHYS, x0 = s.x, y0 = s.y;
    s.buffer = pressed ? P.BUFFER : Math.max(0, s.buffer - dt);
    s.x += lv.speed * dt;

    // first object that could touch the player (objects are sorted by x; the widest block sets how far back to look)
    const objs = lv.objs, near = s.x - 1 - lv.maxW;
    let first = 0, hi = objs.length;
    while (first < hi) { const m = (first + hi) >> 1; if (objs[m].x < near) first = m + 1; else hi = m; }

    for (let i = first; i < objs.length && objs[i].x <= s.x + 2; i++) {
      const o = objs[i];
      if (o.t !== 'portal' || !(x0 + 0.5 < o.x && s.x + 0.5 >= o.x)) continue;
      if (o.k === 'ship') { s.mode = 'ship'; s.vy *= 0.4; }
      else if (o.k === 'cube') { s.mode = 'cube'; }
      else if (o.k === 'flip' && s.grav === 1) { s.grav = -1; s.vy *= 0.5; s.coyote = 0; }
      else if (o.k === 'norm' && s.grav === -1) { s.grav = 1; s.vy *= 0.5; s.coyote = 0; }
    }

    if (s.mode === 'cube') {
      // coyote time: a jump still works for a moment after running off an edge
      if (held && s.coyote > 0) { s.vy = P.JUMP * s.grav; s.coyote = 0; s.buffer = 0; }
      s.vy -= P.G * s.grav * dt;
      s.vy = Math.max(-30, Math.min(30, s.vy));
    } else {
      s.vy += (held ? 1 : -1) * P.SHIP_A * s.grav * dt;
      s.vy = Math.max(-P.SHIP_MAX, Math.min(P.SHIP_MAX, s.vy));
    }
    s.y += s.vy * dt;
    s.ground = false;

    if (s.y < 0) { s.y = 0; s.vy = Math.max(s.vy, 0); s.ground = s.grav === 1; }
    if (s.y > P.CEIL - 1) { s.y = P.CEIL - 1; s.vy = Math.min(s.vy, 0); s.ground = s.grav === -1; }

    for (let i = first; i < objs.length && objs[i].x <= s.x + 2; i++) {
      const o = objs[i];
      if (o.x + (o.w || 1) < s.x - 1) continue;
      if (o.t === 'block') {
        if (!overlap(s.x, s.y, 1, 1, o.x, o.y, o.w, o.h)) continue;
        const canTop = s.grav === 1 || s.mode === 'ship', canBot = s.grav === -1 || s.mode === 'ship';
        if (canTop && y0 >= o.y + o.h - 0.25 && s.vy <= 0) { s.y = o.y + o.h; s.vy = 0; s.ground = s.grav === 1; }
        else if (canBot && y0 + 1 <= o.y + 0.25 && s.vy >= 0) { s.y = o.y - 1; s.vy = 0; s.ground = s.grav === -1; }
        else { s.dead = true; return; }
      } else if (o.t === 'spike' || o.t === 'hang') {
        const hy = o.t === 'spike' ? o.y : o.y + 0.5;
        if (overlap(s.x + 0.15, s.y + 0.15, 0.7, 0.7, o.x + 0.3, hy, 0.4, 0.5)) { s.dead = true; return; }
      } else if (o.t === 'pad') {
        if (s.mode === 'cube' && !s.used.has(i) && overlap(s.x, s.y, 1, 1, o.x, o.y, 1, 0.4)) { s.vy = P.PAD * s.grav; s.ground = false; s.coyote = 0; s.used.add(i); }
      } else if (o.t === 'orb') {
        const dx = s.x + 0.5 - o.x, dy = s.y + 0.5 - o.y;
        if (s.mode === 'cube' && s.buffer > 0 && !s.used.has(i) && dx * dx + dy * dy < 1.8) { s.vy = P.ORB * s.grav; s.ground = false; s.coyote = 0; s.buffer = 0; s.used.add(i); }
      }
    }
    s.coyote = s.ground ? P.COYOTE : Math.max(0, s.coyote - dt);
    if (s.x >= lv.end) s.won = true;
  }

  root.PulseEngine = { PHYS, LEVELS, newState, cloneState, step, builder, level };
})(typeof window !== 'undefined' ? window : globalThis);
