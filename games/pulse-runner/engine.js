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

  // The special level. It breaks the normal design rules on purpose. It flips upside down straight away, then from the
  // first second switches every 1.5 seconds between running upside down and flying upside down (where holding takes
  // you DOWN), for 38 rounds.
  // Every jump is a triple spike under a low spike, with a window of about 21 ms: more than one 60 fps frame, so it
  // can always be done, but only with near-perfect timing. A solver plays the whole level through to prove it.
  function asianMode() {
    const L = builder(), C = PHYS.CEIL;
    let up = false;   // gravity flipped: everything is built mirrored, in the coordinates of the side you stand on
    const sp = (x, n = 1, y = 0) => up ? L.hang(x, n, C - 1 - y) : L.spikes(x, n, y);
    const cap = (x, n, h) => up ? L.spikes(x, n, C - h - 0.5) : L.hang(x, n, h - 0.5);   // spikes from height h up
    const blk = (x, y, w, h) => L.block(x, up ? C - y - h : y, w, h);
    const flip = x => { L.portal(x, up ? 'norm' : 'flip', 5); up = !up; };
    const tri = x => sp(x, 3);

    // The pieces are placed one after another at the cursor x.
    let x = 3;
    // one column of a spike-lined tunnel: centre c, opening `open`
    const column = (cx, c, open) => {
      const lo = c - open / 2, hi = c + open / 2;
      if (lo - 0.5 > 0) blk(cx, 0, 1, lo - 0.5);
      if (lo >= 0.5) sp(cx, 1, lo - 0.5);   // lower than that a spike would stick up too far; the floor itself is safe
      cap(cx, 1, hi);
      if (hi + 0.5 < C) blk(cx, hi + 0.5, 1, C - hi - 0.5);
    };
    // One 3-second round: 1.5 s (18 tiles) running, then 1.5 s flying.
    const round = (jumpH, peak, gap, pinch) => {
      // run: a low roof where you land from the flight (no jumping there, so you can't just keep holding),
      // then one triple under a low spike
      L.portal(x, 'cube');
      cap(x, 6, 1.75);
      tri(x + 9); cap(x + 9, 1, jumpH);
      x += 18;
      // fly: 4 tiles to take off, then a 12-tile tunnel that climbs to `peak` and comes back down, maybe with a pinch at the top
      L.portal(x, 'ship');
      const len = 12, t0 = x + 4;
      for (let i = 0; i < len; i++) {
        // climb over tiles 0-3, flat at the top for 4-6, come down over 7-11
        const c = i < 4 ? 1 + (peak - 1) * i / 4 : i < 7 ? peak : peak + (0.6 - peak) * (i - 6) / 5;
        let open = gap + Math.max(0, 3 - i) * 0.35;   // a wider mouth to get in
        if (pinch && i === 5) open = pinch;   // the middle of the flat top
        column(t0 + i, c, open);
      }
      x += 18;
    };

    // upside down from the start (the fall up to the ceiling takes about 5 tiles), then 38 rounds of run / fly, 1.5 s each
    flip(x); x = 12;
    for (let r = 0; r < 38; r++) round(ROUND_JUMP[r % ROUND_JUMP.length], ROUND_PEAK[r % ROUND_PEAK.length], ROUND_GAP, r % 2 ? ROUND_PINCH : 0);
    // last run to the finish
    L.portal(x, 'cube'); cap(x, 6, 1.75); tri(x + 9); cap(x + 9, 1, ROUND_JUMP[0]); x += 18;
    return level('Asian Mode', 'IMPOSSIBLE', 12, x + 6, L, '#ff2e2e', '#ffd23d', ['#3a0606', '#0a0101'], { bpm: 174, root: 38, prog: [0, 1, 5, 6], seed: 888 });
  }
  // tuning for the rounds (changed by the level tools)
  const ROUND_JUMP = [2.74], ROUND_PEAK = [2.5, 2.1, 2.8], ROUND_GAP = 1.35, ROUND_PINCH = 1.0;

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
