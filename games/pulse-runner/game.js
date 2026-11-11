// Pulse Runner: canvas drawing, input, music, menus. Needs engine.js loaded first.
const PulseRunner = (() => {
  const { PHYS, LEVELS, newState, cloneState, step } = PulseEngine;
  const cv = document.getElementById('c'), g = cv.getContext('2d');
  let W = 0, H = 0, T = 40, active = false, onClose = null;
  const TOUCH = matchMedia('(pointer: coarse)').matches;   // phones: tap hints, and the launcher's back button replaces Esc
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // at least 16 tiles across, so a phone held upright still sees the obstacles coming in time
    T = Math.min(H / 13, W / 16);
  }
  addEventListener('resize', resize); resize();

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('pulse:' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('pulse:' + k, JSON.stringify(v)); } catch {} },
  };

  // ---------- music (original, generated live) ----------
  const Music = {
    ctx: null, timer: null, startAt: 0, bpm: 120, master: null,
    init() {
      if (this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    },
    start(m) {
      this.init(); this.stop();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.m = m; this.bpm = m.bpm;
      this.bus = this.ctx.createGain(); this.bus.connect(this.master);
      // seeded melody so each level always has the same tune
      let seed = m.seed;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const penta = [0, 3, 5, 7, 10, 12, 15];
      this.melody = Array.from({ length: 32 }, () => rnd() < 0.3 ? null : penta[Math.floor(rnd() * penta.length)]);
      this.startAt = this.ctx.currentTime + 0.05;
      this.next = 0;
      this.timer = setInterval(() => this.schedule(), 25);
      this.schedule();
    },
    stop() {
      clearInterval(this.timer); this.timer = null;
      if (this.bus) { const b = this.bus; b.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); setTimeout(() => b.disconnect(), 400); this.bus = null; }
    },
    beat() { return this.ctx && this.timer ? (this.ctx.currentTime - this.startAt) * this.bpm / 60 : -1; },
    freq: n => 440 * Math.pow(2, (n - 69) / 12),
    tone(type, f, t, dur, vol, cutoff) {
      const c = this.ctx, o = c.createOscillator(), gn = c.createGain();
      o.type = type; o.frequency.value = f;
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (cutoff) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; o.connect(fl); node = fl; }
      node.connect(gn); gn.connect(this.bus); o.start(t); o.stop(t + dur + 0.02);
    },
    hit(kind, t) {
      const c = this.ctx, gn = c.createGain();
      if (kind === 'kick') {
        const o = c.createOscillator();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        gn.gain.setValueAtTime(0.9, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(gn); gn.connect(this.bus); o.start(t); o.stop(t + 0.2); return;
      }
      const s = c.createBufferSource(), f = c.createBiquadFilter();
      s.buffer = this.noise;
      f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const dur = kind === 'hat' ? 0.04 : 0.16;
      gn.gain.setValueAtTime(kind === 'hat' ? 0.18 : 0.35, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(gn); gn.connect(this.bus); s.start(t); s.stop(t + dur);
    },
    schedule() {
      if (!this.bus) return;
      const sixteenth = 60 / this.bpm / 4, m = this.m;
      while (this.startAt + this.next * sixteenth < this.ctx.currentTime + 0.12) {
        const i = this.next, t = this.startAt + i * sixteenth, st = i % 16;
        const chord = m.prog[Math.floor(i / 32) % m.prog.length], root = m.root + chord;
        if (st % 4 === 0) this.hit('kick', t);
        if (st === 4 || st === 12) this.hit('snare', t);
        if (st % 4 === 2) this.hit('hat', t);
        if (st % 2 === 0) this.tone('sawtooth', this.freq(root + (st % 8 === 6 ? 12 : 0)), t, sixteenth * 1.8, 0.16, 700);
        const arp = [0, 3, 7, 12][i % 4];
        this.tone('square', this.freq(root + 24 + arp), t, sixteenth * 0.9, 0.035, 3000);
        if (i >= 64 && st % 2 === 0) {
          const n = this.melody[(i / 2) % 32];
          if (n !== null) this.tone('triangle', this.freq(m.root + 24 + chord % 12 + n), t, sixteenth * 2.2, 0.12);
        }
        this.next++;
      }
    },
    sfx(type) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, prevBus = this.bus;
      this.bus = this.master;
      if (type === 'die') { this.hit('snare', t); this.tone('sawtooth', 200, t, 0.35, 0.25, 900); }
      if (type === 'win') [0, 4, 7, 12].forEach((n, k) => this.tone('square', this.freq(72 + n), t + k * 0.09, 0.3, 0.08));
      this.bus = prevBus;
    },
  };

  // ---------- input ----------
  let held = false, pressed = false;
  function press() { if (!held) pressed = true; held = true; Music.init(); }
  function release() { if (!botPlaying()) held = false; }   // while the bot plays, the button is its
  const JUMP_KEYS = [' ', 'ArrowUp', 'w', 'W'];
  const COLS = 3;
  addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); return onEscape(); }
    if (scene === 'play' && (e.key === 'p' || e.key === 'P')) return togglePause();
    if (paused) {   // looking around the level: arrows scroll (Shift = faster), Home / End jump to the start / finish
      const k = e.key, by = e.shiftKey ? 60 : 12;
      if (k === 'ArrowLeft') viewX -= by;
      if (k === 'ArrowRight') viewX += by;
      if (k === 'Home') viewX = -10;
      if (k === 'End') viewX = lv.end;
      clampView(); e.preventDefault(); return;
    }
    if (JUMP_KEYS.includes(e.key)) { e.preventDefault(); if (!e.repeat) { if (!botPlaying()) press(); onAction(); } }
    if (scene === 'menu') {
      const n = LEVELS.length;
      if (e.key >= '1' && e.key <= String(n)) startLevel(+e.key - 1);
      if (e.key === 'p' || e.key === 'P') practice = !practice;
      if (e.key === 'b' || e.key === 'B') bot = !bot;
      if (e.key === 'ArrowLeft') sel = (sel + n - 1) % n;
      if (e.key === 'ArrowRight') sel = (sel + 1) % n;
      if (e.key === 'ArrowDown') sel = Math.min(n - 1, sel + COLS);
      if (e.key === 'ArrowUp') sel = Math.max(0, sel - COLS);
      if (e.key === 'Enter') startLevel(sel);
    }
  });
  addEventListener('keyup', e => { if (active && JUMP_KEYS.includes(e.key)) release(); });
  cv.addEventListener('pointerdown', e => {
    if (paused) { drag = { x: e.clientX, v: viewX }; return; }   // paused: drag to look through the level
    if (!botPlaying()) press();
    onAction(); onPointer(e.clientX, e.clientY);
  });
  cv.addEventListener('pointermove', e => { if (drag) { viewX = drag.v - (e.clientX - drag.x) / T; clampView(); } });
  cv.addEventListener('wheel', e => { if (paused) { e.preventDefault(); viewX += (e.deltaY + e.deltaX) / T; clampView(); } }, { passive: false });
  addEventListener('pointerup', () => { drag = null; release(); });
  addEventListener('pointercancel', release);
  addEventListener('blur', release);

  // ---------- game state ----------
  let scene = 'menu', sel = 0, practice = false;
  let lv, s, attempts = 0, deadTimer = 0, checkpoints = [], cpTimer = 0, rot = 0;
  let particles = [], trail = [], winTimer = 0, flash = 0;
  // P pauses a run; while paused you can drag (or scroll, or use the arrow keys) to look through the whole level
  let paused = false, viewX = 0, drag = null;
  // the bot replays a solved run from bot.js (made by make-bot.js); it always starts from the beginning
  let bot = false, botTick = 0, botNext = 0, botWon = false;
  const botPlan = () => (typeof PulseBot !== 'undefined' && lv && PulseBot[lv.name]) || null;
  const botPlaying = () => bot && scene === 'play' && !!botPlan();
  function togglePause() {
    if (s.dead || s.won) return;
    paused = !paused; drag = null;
    if (paused) { viewX = camX; if (!botPlaying()) held = false; if (Music.ctx) Music.ctx.suspend(); }   // the bot keeps its button
    else if (Music.ctx) Music.ctx.resume();
  }
  function unpause() { if (paused) { paused = false; drag = null; if (Music.ctx) Music.ctx.resume(); } }
  function clampView() { viewX = Math.max(-10, Math.min(lv.end - (W / T) * 0.5, viewX)); }
  const loadBest = k => { const a = store.get(k, []); return LEVELS.map((_, i) => a[i] || 0); };
  const best = loadBest('best'), bestPractice = loadBest('bestP');

  function startLevel(i) {
    sel = i; lv = LEVELS[i]; attempts = 0; checkpoints = []; held = false; unpause();
    scene = 'play'; respawn(true);
  }
  function respawn(fresh) {
    attempts++;
    particles = []; trail = []; deadTimer = 0; cpTimer = 0;
    botTick = 0; botNext = 0;
    if (botPlaying()) { held = false; pressed = false; }
    if (practice && !botPlaying() && checkpoints.length && !fresh) {
      s = cloneState(checkpoints[checkpoints.length - 1]);
    } else {
      s = newState(); checkpoints = [];
      Music.start(lv.music);
    }
    rot = 0;
  }
  function onEscape() {
    if (scene === 'play' || scene === 'win') { unpause(); Music.stop(); scene = 'menu'; }
    else close();
  }
  function onAction() {
    if (scene === 'win' && winTimer > 0.8) scene = 'menu';
  }
  function onPointer(x, y) {
    if (scene !== 'menu') return;
    for (const b of menuButtons) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) b.fn();
  }

  function die() {
    Music.sfx('die');
    if (!practice) Music.stop();
    const pct = Math.min(100, Math.floor(s.x / lv.end * 100));
    const arr = practice ? bestPractice : best;
    if (pct > arr[sel] && !botPlaying()) { arr[sel] = pct; store.set(practice ? 'bestP' : 'best', arr); }
    const cx = s.x + 0.5, cy = s.y + 0.5;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 9;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.5, c: Math.random() < 0.5 ? lv.color : lv.color2 });
    }
    flash = 1;
  }
  function win() {
    Music.stop(); Music.sfx('win');
    const arr = practice ? bestPractice : best;
    botWon = botPlaying();   // (before the scene changes: botPlaying() only counts during play)
    if (!botWon) { arr[sel] = 100; store.set(practice ? 'bestP' : 'best', arr); }
    scene = 'win'; winTimer = 0;
  }

  // ---------- update ----------
  const DT = 1 / 240;
  let acc = 0, last = performance.now();
  function frame(now) {
    if (!active) return;
    const real = paused ? 0 : Math.min(0.1, (now - last) / 1000); last = now;   // paused: everything holds still
    if (scene === 'play' && paused) { /* looking around */ }
    else if (scene === 'play') {
      if (s.dead) {
        deadTimer += real;
        if (deadTimer > 0.9) respawn(false);
      } else {
        acc += real;
        while (acc >= DT && !s.dead && !s.won) {
          if (botPlaying()) {   // the bot's button for this tick
            const plan = botPlan(); pressed = false;
            while (botNext < plan.length && plan[botNext] <= botTick) { held = botNext % 2 === 0; if (held) pressed = true; botNext++; }
          }
          step(s, lv, DT, held, pressed); pressed = false; acc -= DT; botTick++;
          if (s.dead) die();
        }
        if (s.won) win();
        if (practice && !s.dead) {
          cpTimer += real;
          if (cpTimer > 1.6 && (s.ground || s.mode === 'ship')) { checkpoints.push(cloneState(s)); cpTimer = 0; }
        }
        if (s.mode === 'cube') {
          if (s.ground) rot += (Math.round(rot / 90) * 90 - rot) * Math.min(1, real * 20);
          else rot += 420 * real * s.grav;
        } else rot = -Math.atan2(s.vy, lv.speed) * 180 / Math.PI;
        if (s.mode === 'ship' || !s.ground) trail.push({ x: s.x + 0.5, y: s.y + 0.5, life: 0.3 });
      }
    } else { acc = 0; pressed = false; }
    if (scene === 'win') winTimer += real;
    for (const p of particles) { p.x += p.vx * real; p.y += p.vy * real; p.vy -= 12 * real; p.life -= real; }
    particles = particles.filter(p => p.life > 0);
    for (const t of trail) t.life -= real;
    trail = trail.filter(t => t.life > 0);
    flash = Math.max(0, flash - real * 3);

    draw();
    requestAnimationFrame(frame);
  }

  // ---------- drawing ----------
  let camX = 0;
  const sx = x => (x - camX) * T, sy = y => H / 2 + (4.5 - y) * T;   // the 13-tile track sits in the middle of the screen
  function glow(color, blur) { g.shadowColor = color; g.shadowBlur = blur; }

  function beatPulse() {
    const b = Music.beat();
    return b < 0 ? 0 : Math.exp(-(b % 1) * 5);
  }

  function drawBackground(level, scroll) {
    const pulse = beatPulse();
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, level.bg[0]); grd.addColorStop(1, level.bg[1]);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // parallax grid
    g.strokeStyle = level.color; g.globalAlpha = 0.06 + pulse * 0.08; g.lineWidth = 1;
    const gs = T * 2, off = -(scroll * T * 0.3) % gs;
    g.beginPath();
    for (let x = off; x < W; x += gs) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y < H; y += gs) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
    // big drifting rings
    g.globalAlpha = 0.07 + pulse * 0.06; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const rx = ((i * 0.31 * W - scroll * T * 0.12) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
      g.beginPath(); g.arc(rx, H * (0.25 + 0.12 * i), T * (2 + i) * (1 + pulse * 0.08), 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  }

  function drawWorld() {
    const pulse = beatPulse();
    camX = paused ? viewX : s.x - (W / T) * 0.3;
    drawBackground(lv, s.x);

    // floor
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, sy(0), W, H - sy(0));
    glow(lv.color, 12 + pulse * 18); g.strokeStyle = lv.color; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, sy(0)); g.lineTo(W, sy(0)); g.stroke();
    // ceiling: shown when flying or flipped
    if (s.mode === 'ship' || s.grav === -1 || paused) {
      g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, sy(PHYS.CEIL));
      glow(lv.color, 12 + pulse * 18); g.beginPath(); g.moveTo(0, sy(PHYS.CEIL)); g.lineTo(W, sy(PHYS.CEIL)); g.stroke();
    }
    g.shadowBlur = 0;

    const minX = camX - 3, maxX = camX + W / T + 3, time = performance.now() / 1000;
    for (let i = 0; i < lv.objs.length; i++) {
      const o = lv.objs[i];
      if (o.x + (o.w || 1) < minX || o.x > maxX) continue;
      const X = sx(o.x), Y = sy(o.y);
      if (o.t === 'block') {
        const top = sy(o.y + o.h), w = o.w * T, h = o.h * T;
        g.fillStyle = 'rgba(5,8,20,0.92)'; g.fillRect(X, top, w, h);
        g.strokeStyle = lv.color; g.globalAlpha = 0.25; g.lineWidth = 1;
        g.beginPath();
        for (let k = 1; k < o.w; k++) { g.moveTo(X + k * T, top); g.lineTo(X + k * T, top + h); }
        for (let k = 1; k < o.h; k++) { g.moveTo(X, top + k * T); g.lineTo(X + w, top + k * T); }
        if (o.slab) { g.moveTo(X + 4, top + h / 2); g.lineTo(X + w - 4, top + h / 2); }
        g.stroke(); g.globalAlpha = 1;
        glow(lv.color, 8 + pulse * 10); g.lineWidth = 2; g.strokeRect(X + 1, top + 1, w - 2, h - 2); g.shadowBlur = 0;
      } else if (o.t === 'spike' || o.t === 'hang') {
        g.beginPath();
        if (o.t === 'spike') { g.moveTo(X + 2, Y); g.lineTo(X + T / 2, Y - T * 0.9); g.lineTo(X + T - 2, Y); }
        else { const t0 = sy(o.y + 1); g.moveTo(X + 2, t0); g.lineTo(X + T / 2, t0 + T * 0.9); g.lineTo(X + T - 2, t0); }
        g.closePath();
        g.fillStyle = '#0a0a12'; g.fill();
        glow(lv.color2, 10); g.strokeStyle = lv.color2; g.lineWidth = 2; g.stroke(); g.shadowBlur = 0;
      } else if (o.t === 'pad') {
        glow('#ffe14d', 14); g.fillStyle = '#ffe14d';
        g.beginPath(); g.ellipse(X + T / 2, Y, T * 0.45, T * 0.22, 0, Math.PI, 0); g.fill(); g.shadowBlur = 0;
      } else if (o.t === 'orb') {
        const used = s.used.has(i);
        glow('#ff7af5', used ? 0 : 18); g.strokeStyle = used ? '#553355' : '#ff7af5'; g.lineWidth = 3;
        g.beginPath(); g.arc(sx(o.x), sy(o.y), T * (0.42 + Math.sin(time * 6) * 0.04), 0, Math.PI * 2); g.stroke();
        g.fillStyle = used ? '#331a33' : '#ffd6fb'; g.beginPath(); g.arc(sx(o.x), sy(o.y), T * 0.16, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
      } else if (o.t === 'portal') {
        const c = { ship: '#ff3df2', cube: '#5aff7d', flip: '#ffd23d', norm: '#3db8ff' }[o.k];
        glow(c, 22); g.strokeStyle = c; g.lineWidth = 4;
        g.beginPath(); g.ellipse(sx(o.x), sy(o.y), T * 0.45, T * 1.6, 0, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 2; g.globalAlpha = 0.5;
        g.beginPath(); g.ellipse(sx(o.x), sy(o.y), T * 0.25, T * 1.2 * (0.8 + 0.2 * Math.sin(time * 5)), 0, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1; g.shadowBlur = 0;
        g.fillStyle = c; g.font = `bold ${T * 0.35}px Consolas, monospace`; g.textAlign = 'center';
        g.fillText({ ship: 'FLY', cube: 'RUN', flip: '↕', norm: '↕' }[o.k], sx(o.x), sy(o.y) - T * 1.85);
      }
    }

    // checkpoints
    if (practice) for (const c of checkpoints) {
      g.save(); g.translate(sx(c.x + 0.5), sy(c.y + 0.5)); g.rotate(Math.PI / 4);
      g.strokeStyle = '#5aff7d'; g.lineWidth = 2; g.globalAlpha = 0.7; g.strokeRect(-T * 0.2, -T * 0.2, T * 0.4, T * 0.4); g.restore();
    }

    // trail
    for (const t of trail) {
      g.globalAlpha = t.life / 0.3 * 0.5; g.fillStyle = lv.color;
      const r = T * 0.18 * (t.life / 0.3);
      g.fillRect(sx(t.x) - r, sy(t.y) - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;

    if (!s.dead) drawPlayer(sx(s.x + 0.5), sy(s.y + 0.5), rot, s.mode, lv);

    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c;
      g.fillRect(sx(p.x) - 3, sy(p.y) - 3, 6, 6);
    }
    g.globalAlpha = 1;

    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.25})`; g.fillRect(0, 0, W, H); }
    drawHud();
  }

  function drawPlayer(cx, cy, angle, mode, level) {
    g.save(); g.translate(cx, cy); g.rotate(angle * Math.PI / 180);
    const r = T / 2, pulse = beatPulse();
    if (mode === 'ship') {
      glow(level.color, 16);
      g.fillStyle = '#081018'; g.strokeStyle = level.color; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(r * 1.3, 0); g.lineTo(-r * 0.9, -r * 0.75); g.lineTo(-r * 0.5, 0); g.lineTo(-r * 0.9, r * 0.75); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = level.color2; g.beginPath(); g.arc(r * 0.15, 0, r * 0.25, 0, Math.PI * 2); g.fill();
    } else {
      glow(level.color, 14 + pulse * 10);
      g.fillStyle = '#081018'; g.strokeStyle = level.color; g.lineWidth = 3;
      const k = r * 0.92;
      g.beginPath(); g.roundRect ? g.roundRect(-k, -k, k * 2, k * 2, r * 0.22) : g.rect(-k, -k, k * 2, k * 2);
      g.fill(); g.stroke();
      // inner pulse core: diamond + dot
      g.shadowBlur = 0; g.strokeStyle = level.color2; g.lineWidth = 2;
      const d = r * (0.5 + pulse * 0.08);
      g.beginPath(); g.moveTo(0, -d); g.lineTo(d, 0); g.lineTo(0, d); g.lineTo(-d, 0); g.closePath(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r * 0.13, 0, Math.PI * 2); g.fill();
    }
    g.restore(); g.shadowBlur = 0;
  }

  function drawHud() {
    const pct = Math.min(100, s.x / lv.end * 100);
    const bw = Math.min(W * 0.5, 420), bx = (W - bw) / 2, by = 14;
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(bx, by, bw, 8);
    g.fillStyle = lv.color; g.fillRect(bx, by, bw * pct / 100, 8);
    g.fillStyle = '#fff'; g.font = '14px Consolas, monospace'; g.textAlign = 'left';
    g.fillText(Math.floor(pct) + '%', bx + bw + 10, by + 9);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    if (!TOUCH) g.fillText('ESC menu', 14, 22);
    if (practice && !botPlaying()) { g.fillStyle = '#5aff7d'; g.fillText('PRACTICE', TOUCH ? 50 : 14, TOUCH ? 26 : 42); }
    if (botPlaying()) { g.fillStyle = '#ffd23d'; g.fillText('BOT PLAYING', TOUCH ? 50 : 14, TOUCH ? 26 : 42); }
    if (!TOUCH && !paused) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.textAlign = 'right'; g.fillText('P pause', W - 14, 22); g.textAlign = 'left'; }
    if (paused) drawPauseOverlay();
    // attempt counter floats in the world near the start
    const ax = sx(4);
    if (ax > -400) {
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `bold ${T * 0.7}px Consolas, monospace`;
      g.fillText('Attempt ' + attempts, ax, sy(5));
    }
  }

  // paused: a strip at the bottom shows the whole level, the part on screen, and where you are
  function drawPauseOverlay() {
    const bh = 64, y0 = H - bh;
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, y0, W, bh);
    const mx = 16, mw = W - 32, my = y0 + 34, toX = x => mx + Math.max(0, Math.min(1, x / lv.end)) * mw;
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(mx, my, mw, 10);
    for (const o of lv.objs) if (o.t === 'portal') {   // mode changes, coloured like their portals
      g.fillStyle = { ship: '#ff3df2', cube: '#5aff7d', flip: '#ffd23d', norm: '#3db8ff' }[o.k]; g.fillRect(toX(o.x) - 1, my - 3, 2, 16);
    }
    const a = toX(viewX), b = toX(viewX + W / T);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(a, my - 5, Math.max(4, b - a), 20);   // what's on screen
    g.fillStyle = lv.color; g.beginPath(); g.arc(toX(s.x), my + 5, 5, 0, Math.PI * 2); g.fill();   // you
    g.fillStyle = '#fff'; g.font = 'bold 14px Consolas, monospace'; g.textAlign = 'center';
    const pctView = Math.max(0, Math.min(100, Math.round((viewX + W / T / 2) / lv.end * 100)));
    g.fillText(`PAUSED · viewing ${pctView}% · drag, scroll or ←/→ to look around · P to resume`, W / 2, y0 + 20);
    g.textAlign = 'left';
  }

  let menuButtons = [];
  function drawMenu() {
    const time = performance.now() / 1000, L = LEVELS[sel];
    drawBackground(L, time * 4);
    g.textAlign = 'center';
    glow(L.color, 30); g.fillStyle = '#fff';
    g.font = `bold ${Math.min(W / 9, 76)}px Consolas, monospace`;
    g.fillText('PULSE RUNNER', W / 2, H * 0.15);
    g.shadowBlur = 0;
    g.font = '14px Consolas, monospace'; g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText(TOUCH ? 'TAP to jump  ·  hold to fly' : 'SPACE / CLICK / TAP to jump  ·  hold to fly  ·  ESC back', W / 2, H * 0.15 + 30);

    menuButtons = [];
    const rows = Math.ceil(LEVELS.length / COLS), top = H * 0.25;
    // cards shrink so every row, the practice button and the hint line still fit on short screens
    const gap = 14, cw = Math.min(240, (W - 40 - gap * (COLS - 1)) / COLS);
    const ch = Math.max(48, Math.min(130, H * 0.2, (H - top - 100 - gap * (rows - 1)) / rows));
    LEVELS.forEach((l, i) => {
      const row = Math.floor(i / COLS), inRow = Math.min(COLS, LEVELS.length - row * COLS);   // a short last row is centred
      const x = (W - (inRow * cw + (inRow - 1) * gap)) / 2 + (i % COLS) * (cw + gap), y = top + row * (ch + gap);
      const on = i === sel, special = l.diff === 'IMPOSSIBLE';
      g.fillStyle = on ? 'rgba(255,255,255,0.08)' : special ? 'rgba(60,0,0,0.55)' : 'rgba(0,0,0,0.4)'; g.fillRect(x, y, cw, ch);
      if (on || special) glow(l.color, special ? 14 + 12 * (0.5 + 0.5 * Math.sin(time * 4)) : 20);   // the special level throbs
      g.strokeStyle = l.color; g.lineWidth = on ? 3 : special ? 2.5 : 1.5; g.strokeRect(x, y, cw, ch); g.shadowBlur = 0;
      g.fillStyle = l.color; g.font = `bold ${Math.min(cw / 10, 20)}px Consolas, monospace`;
      g.fillText(l.name, x + cw / 2, y + ch * 0.28);
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = `${Math.min(cw / 15, 13)}px Consolas, monospace`;
      g.fillText(`${i + 1} · ${l.diff}`, x + cw / 2, y + ch * 0.46);
      const bb = practice ? bestPractice[i] : best[i];
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x + 14, y + ch * 0.62, cw - 28, 6);
      g.fillStyle = l.color; g.fillRect(x + 14, y + ch * 0.62, (cw - 28) * bb / 100, 6);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText('best ' + bb + '%', x + cw / 2, y + ch * 0.85);
      menuButtons.push({ x, y, w: cw, h: ch, fn: () => startLevel(i) });
    });
    const py = top + rows * (ch + gap) + 16, pw = Math.min(200, (W - 52) / 2);
    const toggle = (x, on, color, label, fn) => {
      g.strokeStyle = on ? color : 'rgba(255,255,255,0.4)'; g.lineWidth = 2; g.strokeRect(x, py, pw, 36);
      g.fillStyle = on ? color : 'rgba(255,255,255,0.7)'; g.font = '14px Consolas, monospace';
      g.fillText(label, x + pw / 2, py + 23);
      menuButtons.push({ x, y: py, w: pw, h: 36, fn });
    };
    toggle(W / 2 - pw - 6, practice, '#5aff7d', `${TOUCH ? '' : '[P] '}PRACTICE: ${practice ? 'ON' : 'OFF'}`, () => { practice = !practice; });
    toggle(W / 2 + 6, bot, '#ffd23d', `${TOUCH ? '' : '[B] '}BOT: ${bot ? 'ON' : 'OFF'}`, () => { bot = !bot; });
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillText(TOUCH ? (bot ? 'tap a level to watch the bot play it' : 'tap a level to play') : bot ? 'pick a level to watch the bot play it  ·  P pauses' : `1-${LEVELS.length} or click a level  ·  arrows + ENTER  ·  P pauses a run  ·  ESC arcade`, W / 2, py + 64);
  }

  function drawWin() {
    drawWorld();
    g.fillStyle = `rgba(0,0,0,${Math.min(0.7, winTimer)})`; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; glow(lv.color, 30); g.fillStyle = '#fff';
    g.font = `bold ${Math.min(W / 12, 64)}px Consolas, monospace`;
    g.fillText(botWon ? 'THE BOT BEAT IT' : lv.diff === 'IMPOSSIBLE' && !practice ? 'YOU BEAT ASIAN MODE' : 'LEVEL COMPLETE', W / 2, H * 0.42); g.shadowBlur = 0;
    g.font = '18px Consolas, monospace'; g.fillStyle = lv.color;
    g.fillText(`${lv.name}  ·  ${attempts} attempt${attempts === 1 ? '' : 's'}${practice ? '  ·  practice' : ''}`, W / 2, H * 0.42 + 40);
    if (winTimer > 0.8) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(TOUCH ? 'tap to continue' : 'press SPACE / tap to continue', W / 2, H * 0.42 + 80); }
  }

  // A level with a `blur` setting blurs the whole screen for a moment every few seconds of the run. It goes by how far
  // you are (not the clock), so it hits the same spots every attempt. Never while paused, so you can look around clearly.
  function blurNow() {
    const b = scene === 'play' && !paused && lv && lv.blur;
    if (!b) return 0;
    const t = s.x / lv.speed, phase = t % b.every, fade = Math.min(0.25, b.length / 3);
    if (t < b.every || phase >= b.length) return 0;
    return b.px * Math.min(1, phase / fade, (b.length - phase) / fade);
  }
  let blurShown = '';
  function draw() {
    const bl = blurNow(), f = bl > 0.3 ? `blur(${bl.toFixed(1)}px)` : '';
    if (f !== blurShown) { cv.style.filter = f; blurShown = f; }   // CSS blur on the canvas: cheap, and only while it's on
    g.clearRect(0, 0, W, H);
    if (scene === 'menu') drawMenu();
    else if (scene === 'play') drawWorld();
    else drawWin();
  }

  function open(closeCallback) {
    onClose = closeCallback;
    active = true; scene = 'menu'; held = false;
    cv.style.display = 'block'; resize();
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function close() {
    Music.stop();
    active = false;
    cv.style.display = 'none';
    if (onClose) onClose();
  }
  return { open, levels: LEVELS };
})();
