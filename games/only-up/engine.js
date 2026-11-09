// Only Up: physics + level data (OnlyUp). No DOM, so it also runs headless in Node (see pace.js).
//
// Units are low-res pixels, y is height above the ground (up is positive), and x/y are the player's left edge
// and feet. Every platform is one-way: you jump up through it and land on top. The level is generated from a
// fixed seed, so everyone climbs the same tower, and the platform order is the intended route.
(function (root) {
  const WORLD_W = 320, PW = 8, PH = 12, STEP = 1 / 120;
  const PHYS = {
    gravity: 760, jumpV: 262, jumpCut: 0.45, maxFall: 320, springV: 420,
    run: 92, groundAccel: 900, friction: 1100, airAccel: 620, airDrag: 120, iceAccel: 300, iceFriction: 140,
    coyote: 0.07, buffer: 0.08,        // seconds of forgiveness on leaving a ledge / pressing jump early
    crumbleHold: 1, crumbleBack: 4,    // seconds until a crumbling platform goes, and until it comes back
    fallMin: 64,                       // a drop bigger than this counts as a fall
  };

  // Scales the whole climb. This is the knob pace.js measures: 1 step is roughly 1 jump.
  const LENGTH = 1.2;
  const SEED = 8675309;

  // d is how far each gap is as a fraction of the longest possible jump, rise is how high in pixels.
  // move, spring, crumble and ice are the chance of a platform being that kind.
  // Every 10th step is a wide ledge against a wall, left and right in turn, about as wide as ledge. They aren't
  // checkpoints, but they catch most falls and get narrower on the way up. Without them one slip can cost hundreds
  // of steps, and climbing stops adding up.
  const LEDGE_EVERY = 10;
  const ZONES = [
    { name: 'THE YARD', mat: 'crate', steps: 30, ledge: 130, w: [40, 64], d: [0.2, 0.45], rise: [14, 26] },
    { name: 'ROOFTOPS', mat: 'brick', steps: 45, ledge: 120, w: [28, 44], d: [0.35, 0.6], rise: [18, 30] },
    { name: 'SCAFFOLD', mat: 'girder', steps: 50, ledge: 110, w: [20, 32], d: [0.45, 0.65], rise: [20, 32], move: 0.25 },
    { name: 'THE CLOUDS', mat: 'cloud', steps: 55, ledge: 100, w: [20, 30], d: [0.45, 0.65], rise: [18, 32], move: 0.35, spring: 0.08 },
    { name: 'THE RUINS', mat: 'stone', steps: 50, ledge: 90, w: [16, 26], d: [0.5, 0.68], rise: [20, 32], crumble: 0.4 },
    { name: 'FROSTLINE', mat: 'snow', steps: 55, ledge: 90, w: [22, 32], d: [0.5, 0.66], rise: [18, 30], ice: 0.55 },
    { name: 'THE STORM', mat: 'iron', steps: 60, ledge: 80, w: [14, 22], d: [0.48, 0.66], rise: [20, 34], move: 0.2, wind: { amp: 34, period: 5.5 } },
    { name: 'ORBIT', mat: 'rock', steps: 60, ledge: 70, w: [12, 16], d: [0.64, 0.8], rise: [30, 56], g: 0.6, move: 0.3, crumble: 0.2 },
  ];

  function rng(seed) {   // mulberry32
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // the longest gap (edge to edge) a jump of this rise can clear, with no margin to spare
  function reach(rise, gScale, v) {
    const g = PHYS.gravity * gScale, disc = v * v - 2 * g * rise;
    if (disc < 0) return 0;
    return PHYS.run * (v + Math.sqrt(disc)) / g + PW - 6;
  }

  function buildLevel() {
    const rnd = rng(SEED), range = ([a, b]) => a + rnd() * (b - a);
    const plats = [{ x: 0, y: 0, w: WORLD_W, type: 'ground', mat: 'ground', zone: 0 }];
    let cur = { x: 150, y: 0, w: 20, type: 'ground' }, dir = 1, side = -1;

    // reaches from where the route arrives over to the wall, so a fall on that side always meets one eventually
    function ledge(z, zi) {
      const rise = range(z.rise), gap = range(z.d) * reach(rise, z.g || 1, PHYS.jumpV) * 0.6, most = z.ledge * 1.6;
      let x, w;
      if (side > 0) {
        x = Math.min(cur.x + cur.w + gap, WORLD_W - 2 - z.ledge);
        w = Math.min(most, WORLD_W - 2 - x);
      } else {
        const right = Math.max(cur.x - gap, 2 + z.ledge);
        w = Math.min(most, right - 2);
        x = right - w;
      }
      cur = { x, y: cur.y + rise, w, type: 'normal', mat: z.mat, zone: zi };
      plats.push(cur);
      side = -side;
    }

    function place(z, zi, type, w, rise, v, wantMove) {
      // a long jump onto a tiny platform at the top of your reach is a wall, not a challenge, so those come in closer
      const gap = range(z.d) * reach(rise, z.g || 1, v) * (w < 16 && rise > 44 ? 0.8 : 1);
      let ax = 0, ay = 0;
      if (wantMove) { if (rnd() < 0.7) ax = Math.round(range([16, 36])); else ay = Math.round(range([10, 18])); }
      // gaps are measured to the closest point a moving platform gets to, and from the middle of a moving start
      const at = (d, a) => (d > 0 ? cur.x + cur.w + gap + a : cur.x - gap - w - a);
      const fits = (x, a) => x - a >= 2 && x + w + a <= WORLD_W - 2;
      if (!fits(at(dir, ax), ax)) {
        if (fits(at(-dir, ax), ax)) dir = -dir;
        else { ax = 0; if (!fits(at(dir, 0), 0)) dir = -dir; }
      }
      // a wide ledge may not fit beside the last platform; sliding it over only makes the jump shorter
      const x = Math.max(2 + ax, Math.min(WORLD_W - 2 - w - ax, at(dir, ax)));
      const p = { x, y: cur.y + rise + ay, w, type, mat: z.mat, zone: zi };
      if (ax || ay) p.move = { ax, ay, period: range([3, 5]), phase: rnd() * Math.PI * 2 };
      plats.push(p);
      cur = p;
    }

    ZONES.forEach((z, zi) => {
      z.y0 = cur.y;
      const steps = Math.round(z.steps * LENGTH);
      for (let i = 0; i < steps; i++) {
        const afterSpring = cur.type === 'spring', r = rnd();
        if (i % LEDGE_EVERY === 0 && (i > 0 || zi > 0) && !afterSpring && !cur.move) { ledge(z, zi); continue; }
        // head across for the next ledge; before that, wander
        if (i % LEDGE_EVERY >= LEDGE_EVERY - 6) dir = side;
        else if (rnd() < 0.12) dir = -dir;
        const v = afterSpring ? PHYS.springV : PHYS.jumpV;
        const rise = afterSpring ? range([70, 100]) : range(z.rise);
        let type = 'normal';
        if (!afterSpring) {
          if (r < (z.spring || 0) && !cur.move) type = 'spring';
          else if (r < (z.crumble || 0)) type = 'crumble';
          else if (r < (z.ice || 0)) type = 'ice';
        }
        // nothing that makes you wait for the right moment next to a crumbling platform: it would drop you first
        const wantMove = !cur.move && !afterSpring && type === 'normal' && cur.type !== 'crumble' && rnd() < (z.move || 0);
        place(z, zi, type, type === 'spring' ? 16 : Math.round(range(z.w)), rise, v, wantMove);
      }
    });
    const last = ZONES[ZONES.length - 1];
    place(last, ZONES.length - 1, 'goal', 64, 30, PHYS.jumpV, false);

    // Buckets by height, so collisions only look at the platforms nearby
    const buckets = {};
    plats.forEach((p, i) => {
      const ay = p.move ? p.move.ay : 0;
      for (let k = bucket(p.y - ay); k <= bucket(p.y + ay); k++) (buckets[k] = buckets[k] || []).push(i);
    });
    return { plats, zones: ZONES, buckets, top: cur.y };
  }
  function bucket(y) { return Math.floor(y / 64); }

  function platX(p, t) { return p.move ? p.x + p.move.ax * Math.sin(2 * Math.PI * t / p.move.period + p.move.phase) : p.x; }
  function platY(p, t) { return p.move ? p.y + p.move.ay * Math.sin(2 * Math.PI * t / p.move.period + p.move.phase) : p.y; }
  function zoneAt(lv, y) {
    for (let i = lv.zones.length - 1; i > 0; i--) if (y >= lv.zones[i].y0) return lv.zones[i];
    return lv.zones[0];
  }
  function windAt(z, t) { return z.wind ? z.wind.amp * Math.sin(2 * Math.PI * t / z.wind.period) : 0; }

  // crumbling platforms: s.cr[i] is when the player first stood on it
  function isGone(s, i) {
    const t0 = s.cr[i];
    if (t0 === undefined) return false;
    const age = s.t - t0;
    if (age > PHYS.crumbleHold + PHYS.crumbleBack) { delete s.cr[i]; return false; }
    return age > PHYS.crumbleHold;
  }

  function newState() {
    return { x: 100, y: 0, vx: 0, vy: 0, on: 0, face: 1, t: 0, coyote: 0, buffer: 0, cuttable: false, cr: {},
      lastGroundY: 0, best: 0, falls: 0, won: false, touch: -1, drop: 0, jumped: false };
  }
  function cloneState(s) { return { ...s, cr: { ...s.cr } }; }

  function approach(v, to, by) { return v < to ? Math.min(to, v + by) : Math.max(to, v - by); }

  // Advance one tick. Afterwards s.touch is the platform landed on this tick (or -1), s.drop how far you just fell
  // (0 if it wasn't a fall) and s.jumped whether you jumped.
  function step(s, lv, dt, left, right, held, pressed) {
    const P = PHYS, plats = lv.plats;
    s.t += dt; s.touch = -1; s.drop = 0; s.jumped = false;
    const z = zoneAt(lv, s.y), g = P.gravity * (z.g || 1);

    if (s.on >= 0) {   // ride whatever you're standing on, unless it just crumbled away
      const p = plats[s.on];
      if (isGone(s, s.on)) { s.on = -1; s.vy = 0; }
      else { s.x += platX(p, s.t) - platX(p, s.t - dt); s.y = platY(p, s.t); }
    }
    const ground = s.on >= 0 ? plats[s.on] : null, ice = ground && ground.type === 'ice';
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir) {
      s.face = dir;
      s.vx = approach(s.vx, dir * P.run, (ground ? (ice ? P.iceAccel : P.groundAccel) : P.airAccel) * dt);
    } else {
      s.vx = approach(s.vx, 0, (ground ? (ice ? P.iceFriction : P.friction) : P.airDrag) * dt);
    }

    s.buffer = pressed ? P.buffer : Math.max(0, s.buffer - dt);
    s.coyote = ground ? P.coyote : Math.max(0, s.coyote - dt);
    if (s.buffer > 0 && s.coyote > 0) {
      s.vy = P.jumpV; s.on = -1; s.coyote = 0; s.buffer = 0; s.cuttable = true; s.jumped = true;
    }
    if (!held && s.cuttable && s.vy > 0) { s.vy *= P.jumpCut; s.cuttable = false; }   // let go early for a short hop

    if (s.on < 0) s.vy = Math.max(-P.maxFall, s.vy - g * dt);
    const prev = s.y;
    s.x += (s.vx + (s.on < 0 ? windAt(z, s.t) : 0)) * dt;   // wind only pushes you while you're in the air
    if (s.x < 0) { s.x = 0; s.vx = 0; } else if (s.x > WORLD_W - PW) { s.x = WORLD_W - PW; s.vx = 0; }

    if (s.on >= 0) {
      const p = plats[s.on], px = platX(p, s.t);
      if (s.x + PW <= px || s.x >= px + p.w) { s.on = -1; s.vy = 0; }
    } else {
      s.y += s.vy * dt;
      if (s.vy <= 0) land(s, lv, prev, dt);
    }
  }

  function land(s, lv, prev, dt) {
    const P = PHYS, plats = lv.plats;
    let hit = -1, top = -Infinity;
    for (let k = bucket(s.y); k <= bucket(prev); k++) {
      const list = lv.buckets[k];
      if (!list) continue;
      for (const i of list) {
        const p = plats[i], ty = platY(p, s.t);
        if (ty <= top || s.y > ty || prev < platY(p, s.t - dt) - 0.01) continue;
        const px = platX(p, s.t);
        if (s.x + PW <= px || s.x >= px + p.w || isGone(s, i)) continue;
        hit = i; top = ty;
      }
    }
    if (hit < 0) return;
    const p = plats[hit];
    s.y = top; s.touch = hit; s.cuttable = false;
    const fell = s.lastGroundY - s.y;
    if (fell > P.fallMin) { s.falls++; s.drop = fell; }
    s.lastGroundY = s.y;
    if (s.y > s.best) s.best = s.y;
    if (p.type === 'spring') { s.vy = P.springV; return; }
    s.on = hit; s.vy = 0;
    if (p.type === 'crumble' && s.cr[hit] === undefined) s.cr[hit] = s.t;
    if (p.type === 'goal') s.won = true;
  }

  const LEVEL = buildLevel();
  root.OnlyUp = { WORLD_W, PW, PH, STEP, PHYS, LEVEL, rng, newState, cloneState, step, isGone, platX, platY, zoneAt, windAt };
  if (typeof module !== 'undefined') module.exports = root.OnlyUp;
})(typeof window !== 'undefined' ? window : globalThis);
