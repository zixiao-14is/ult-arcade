// Only Up: low-res canvas drawing, input, sound, saving. Physics and the level live in engine.js (OnlyUp).
(function () {
  const { WORLD_W, PW, PH, STEP, LEVEL, newState, step, isGone, platX, platY, zoneAt, windAt } = OnlyUp;
  const plats = LEVEL.plats, zones = LEVEL.zones;
  const inFrame = window.parent !== window;
  const TOUCH = matchMedia('(pointer: coarse)').matches;   // phones: touch signs and buttons, and the launcher's back button pauses

  // localStorage can throw (private mode, file:// in some browsers), so fall back to memory.
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('onlyup:' + k); return v == null ? d : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem('onlyup:' + k, JSON.stringify(v)); } catch {} },
    del(k) { delete mem[k]; try { localStorage.removeItem('onlyup:' + k); } catch {} },
  };

  const cv = document.getElementById('cv'), g = cv.getContext('2d');
  // The game draws to a tiny canvas that the browser scales up with hard pixel edges. ox is where the tower's
  // left wall sits on it, since a wide screen shows scenery on both sides of the tower.
  // ui is the text size: doubled on a phone, where the tower's width leaves the pixels too small to read
  let VIEW_W = WORLD_W, VIEW_H = 240, ox = 0, scale = 1, ui = 1;

  // ---------- colours ----------
  const C = { white: '#fff', black: '#000', dim: '#8890a0', gold: '#f8c838', red: '#ff7b7b', panel: 'rgba(0,0,0,.82)' };
  const SKY = ['#5c94fc', '#6ca0f0', '#f4a868', '#a868b8', '#4c3488', '#1c3a70', '#1a1c34', '#05050f', '#000008'];
  // body, top edge, shadow
  const MAT = {
    ground: ['#8c5c30', '#80cc58', '#5c3818'], crate: ['#a8703c', '#d8a860', '#6c4420'], brick: ['#a84030', '#e08060', '#6c2418'],
    girder: ['#5c6878', '#94a4b4', '#2c3440'], cloud: ['#e8ecf8', '#ffffff', '#a8b0d0'], stone: ['#787068', '#a8a090', '#484038'],
    snow: ['#a8bcd4', '#ffffff', '#6878a0'], iron: ['#484c60', '#7c8498', '#20242c'], rock: ['#6c6478', '#a098ac', '#38324a'],
    ice: ['#70c8f0', '#d8f4ff', '#3878b0'], spring: ['#c04040', '#f8c838', '#702020'], goal: ['#f8c838', '#fff0a0', '#a87810'],
  };

  // ---------- 3x5 pixel font: each digit is one row, read as 3 bits ----------
  const FONT = {
    A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227', J: '11152',
    K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222',
    U: '55553', V: '55522', W: '55775', X: '55255', Y: '55222', Z: '71247', 0: '75557', 1: '26227', 2: '61247', 3: '61216',
    4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757', 9: '75711', '.': '00002', ',': '00024', ':': '02020',
    '-': '00700', '!': '22202', '?': '61202', "'": '22000', '/': '11244', '+': '02720', '<': '12421', '>': '42124',
  };
  function textW(s, size = 1) { return (s.length * 4 - 1) * size; }
  function text(s, x, y, color, size = 1, align = 'left', shadow = true) {
    s = String(s).toUpperCase();
    if (align === 'center') x -= Math.floor(textW(s, size) / 2);
    else if (align === 'right') x -= textW(s, size);
    x = Math.round(x); y = Math.round(y);
    const passes = shadow ? [[1, 1, C.black], [0, 0, color]] : [[0, 0, color]];
    for (const [ox, oy, col] of passes) {
      g.fillStyle = col;
      for (let i = 0; i < s.length; i++) {
        const glyph = FONT[s[i]];
        if (!glyph) continue;
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
          if (+glyph[r] & (4 >> c)) g.fillRect(x + ox + (i * 4 + c) * size, y + oy + r * size, size, size);
      }
    }
  }

  // ---------- player sprite, 8x12 ----------
  const PAL = { r: '#d82800', s: '#fcbc94', k: '#201810', b: '#2038b0', w: '#fff' };
  const HEAD = ['..rrrr..', '.rrrrrrr', '..ssss..', '..sskk..', '..ssss..'];
  const SPRITES = {
    idle: [...HEAD, '.rrrrrr.', 's.rrrr.s', '..rrrr..', '..bbbb..', '..b..b..', '..b..b..', '.kk..kk.'],
    run1: [...HEAD, '.rrrrrs.', 's.rrrr..', '..rrrr..', '..bbbb..', '.bb..bb.', 'kb....b.', '......kk'],
    run2: [...HEAD, '.rrrrrr.', '.srrrrs.', '..rrrr..', '..bbbb..', '...bb...', '...bb...', '...kk...'],
    up: ['s.rrrr.s', 'r.rrrrrr', 'r.ssss.r', 'r.sskk.r', 'r.ssss.r', '.rrrrrr.', '..rrrr..', '..rrrr..', '..bbbb..', '.bb..bb.', '.kk..kk.', '........'],
    fall: [...HEAD, 's.rrrr.s', 'r.rrrr.r', '..rrrr..', '..bbbb..', '.b....b.', 'kk....kk', '........'],
  };
  function drawPlayer(x, y) {
    const v = s.on < 0 ? (s.vy > 0 ? 'up' : 'fall') : Math.abs(s.vx) > 12 ? (Math.floor(s.t * 10) % 2 ? 'run1' : 'run2') : 'idle';
    const rows = SPRITES[v];
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < 8; c++) {
      const col = PAL[rows[r][s.face > 0 ? c : 7 - c]];
      if (col) { g.fillStyle = col; g.fillRect(x + c, y + r, 1, 1); }
    }
  }

  // ---------- game state ----------
  const SAVE_VERSION = 1;
  let s, cam = 0, camF = 0, focus = 0, look = 0, paused = false, confirmReset = false, banner = 0, bannerZone = null, fellText = 0, fellBy = 0, saveClock = 0;
  let parts = [];
  const keys = {};
  let jumpLatch = false, touchUI = TOUCH;
  const touches = new Map();
  let bestTime = store.get('bestTime', 0), muted = store.get('muted', false);

  function fresh() {
    s = newState();
    parts = []; bannerZone = null; banner = 0; fellText = 0;
    snapCamera();
    store.del('save');
  }
  function load() {
    const sv = store.get('save', null);
    if (sv && sv.v === SAVE_VERSION && sv.s) { s = sv.s; s.cr = {}; snapCamera(); bannerZone = zoneAt(LEVEL, s.y); }
    else fresh();
  }
  // with touch buttons on screen, lift the whole view above them so they never cover the player
  function padBottom() { return touchUI ? Math.ceil((innerHeight - buttons().left.y + 4) / scale) : 0; }
  function snapCamera() {
    focus = s.y; look = 0;
    camF = Math.max(-16, focus - VIEW_H * 0.35) - padBottom();
    cam = Math.round(camF);
  }
  // The camera follows the platform you're standing on, not the jump, so the world holds still while you're in the
  // air and eases up once you land. It only chases you if you leave the normal jump range: down when you've missed,
  // up when a spring launches you. cam is a whole number so everything on screen moves together.
  function updateCamera(dt) {
    if (s.on >= 0) focus = plats[s.on].y;   // its resting height, so a bobbing platform doesn't bob the view
    else if (s.y < focus - 30) focus = s.y + 30;
    else if (s.y > focus + 90) focus = s.y - 90;
    const falling = s.on < 0 && s.lastGroundY - s.y > 40;
    look += ((falling ? VIEW_H * 0.25 : 0) - look) * Math.min(1, dt * 3);   // look ahead so you can see where you'll land
    const target = Math.max(-16, focus - VIEW_H * 0.35 - look) - padBottom();
    camF += (target - camF) * (1 - Math.exp(-dt * 6));
    camF = Math.min(camF, Math.max(-16, s.y - 20) - padBottom());   // a long fall must never outrun the screen
    cam = Math.round(camF);
  }
  // No checkpoints: this saves exactly where you are, even mid-fall, so reloading can't undo a fall.
  function save() { if (s && !s.won) store.set('save', { v: SAVE_VERSION, s }); }

  // ---------- sound ----------
  let ac = null;
  function beep(freq, dur, slide = 0, vol = 0.04) {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), a = ac.createGain(), t = ac.currentTime;
      o.type = 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      a.gain.setValueAtTime(vol, t);
      a.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(a); a.connect(ac.destination);
      o.start(t); o.stop(t + dur);
    } catch {}
  }

  // ---------- input ----------
  const JUMP = { Space: 1, ArrowUp: 1, KeyW: 1 };
  addEventListener('keydown', e => {
    const k = e.code;
    if (JUMP[k] || k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowDown') e.preventDefault();
    if (e.repeat) return;
    if (k === 'KeyM') { muted = !muted; store.set('muted', muted); return; }
    if (k === 'KeyF') {
      const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      if (p) p.catch(() => {});
      return;
    }
    if (s.won) {
      if (k === 'Enter' || k === 'KeyR' || k === 'Space') fresh();
      else if (k === 'Escape' && inFrame) window.parent.postMessage('exit-game', '*');
      return;
    }
    if (paused) {
      if (k === 'KeyR') {
        if (confirmReset) { fresh(); paused = false; confirmReset = false; } else confirmReset = true;
        return;
      }
      confirmReset = false;
      if (k === 'Enter' || k === 'KeyP' || JUMP[k]) paused = false;
      else if (k === 'Escape') {
        if (inFrame) { save(); window.parent.postMessage('exit-game', '*'); } else paused = false;
      }
      return;
    }
    keys[k] = true;
    if (JUMP[k]) jumpLatch = true;
    if (k === 'Escape' || k === 'KeyP') { paused = true; confirmReset = false; save(); }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    touches.clear();
    if (s && !s.won) { paused = true; save(); }
  });
  addEventListener('pagehide', save);

  // Touch: two arrow buttons bottom-left move, and a touch anywhere else jumps (a JUMP button bottom-right shows where).
  // Button rects are in CSS pixels; a finger can slide from one arrow to the other without lifting.
  function buttons() {
    const b = Math.round(Math.max(56, Math.min(88, Math.min(innerWidth, innerHeight) * 0.18)));
    const m = 14, y = innerHeight - m - b - 8;
    return {
      left: { x: m, y, w: b, h: b },
      right: { x: m + b + 10, y, w: b, h: b },
      jump: { x: innerWidth - m - b * 1.3, y, w: b * 1.3, h: b },
    };
  }
  function inRect(r, x, y, slop = 0) { return x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop; }
  function touchZone(e) {
    const bt = buttons();
    if (inRect(bt.left, e.clientX, e.clientY, 8)) return 'left';
    if (inRect(bt.right, e.clientX, e.clientY, 8)) return 'right';
    return 'jump';
  }
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') {
      if (s.won) fresh(); else if (paused) { paused = false; confirmReset = false; }
      return;
    }
    touchUI = true;
    if (s.won) return fresh();
    if (paused) {
      // no R or M keys on a phone: tap those lines of the pause screen instead
      const line = pauseLineAt(e.clientY / scale);
      if (line === 'reset') { if (confirmReset) { fresh(); paused = false; confirmReset = false; } else confirmReset = true; }
      else if (line === 'sound') { muted = !muted; store.set('muted', muted); }
      else { paused = false; confirmReset = false; }
      return;
    }
    const z = touchZone(e);
    touches.set(e.pointerId, z);
    if (z === 'jump') jumpLatch = true;
  });
  cv.addEventListener('pointermove', e => {
    const z = touches.get(e.pointerId);
    if (z !== 'left' && z !== 'right') return;   // a jump stays a jump wherever the finger goes
    const bt = buttons();
    if (inRect(bt.left, e.clientX, e.clientY, 8)) touches.set(e.pointerId, 'left');
    else if (inRect(bt.right, e.clientX, e.clientY, 8)) touches.set(e.pointerId, 'right');
  });
  addEventListener('pointerup', e => touches.delete(e.pointerId));
  addEventListener('pointercancel', e => touches.delete(e.pointerId));
  function touching(z) { for (const v of touches.values()) if (v === z) return true; return false; }

  // Android app only: with the phone sideways, the phone's own volume buttons walk left and right.
  // app/android/.../MainActivity.java catches them, but only while we say so, and sends 'volumekey' events here.
  // A web page (or an iPhone) never gets the volume buttons, so there this does nothing.
  const volumeBridge = (() => { try { return window.AndroidVolumeKeys || window.parent.AndroidVolumeKeys || null; } catch { return null; } })();
  const vol = { up: false, down: false };
  let volumeOn = false;
  function setVolumeKeys(on) {
    if (on === volumeOn) return;
    volumeOn = on;
    if (!on) vol.up = vol.down = false;
    try { if (volumeBridge) volumeBridge.setActive(on); } catch {}
  }
  addEventListener('volumekey', e => { if (volumeOn) vol[e.detail.key] = e.detail.down; });
  addEventListener('pagehide', () => setVolumeKeys(false));
  // The button nearer the player's left hand moves left. Phones have them on the right edge, volume up nearer the
  // top, so with the top turned to the left (angle 90) volume up is on the left; turned the other way (270) it flips.
  function volumeLeftRight() {
    const o = screen.orientation;
    const angle = o && typeof o.angle === 'number' ? o.angle : ((window.orientation || 0) + 360) % 360;
    return angle === 270 ? [vol.down, vol.up] : [vol.up, vol.down];
  }

  // ---------- simulation ----------
  function tick() {
    const [volLeft, volRight] = volumeLeftRight();
    const left = keys.ArrowLeft || keys.KeyA || touching('left') || volLeft;
    const right = keys.ArrowRight || keys.KeyD || touching('right') || volRight;
    const held = keys.Space || keys.ArrowUp || keys.KeyW || touching('jump');
    const wasOn = s.on, vyBefore = s.vy;
    step(s, LEVEL, STEP, left, right, held, jumpLatch);
    jumpLatch = false;
    if (s.jumped) { beep(330, 0.1, 280); dust(s.x + PW / 2, s.y, 4); }
    if (s.touch >= 0) {
      const p = plats[s.touch];
      if (p.type === 'spring') { beep(220, 0.22, 620, 0.05); dust(s.x + PW / 2, s.y, 8); }
      else if (vyBefore < -120) { beep(110, 0.08, -40); dust(s.x + PW / 2, s.y, 6); }
      if (p.type === 'crumble') beep(90, 0.14, -30);
      if (s.drop > 0) { fellBy = s.drop; fellText = 2.4; beep(160, 0.4, -120, 0.05); }
      if (s.won) win();
    }
    if (wasOn >= 0 && s.on < 0 && !s.jumped && plats[wasOn].type === 'crumble') dust(s.x + PW / 2, s.y, 8);
    const z = zoneAt(LEVEL, s.y);
    if (z !== bannerZone) {
      // only announce a zone the first time you reach it, not when you fall back into it
      if (s.y >= s.best - 1 || bannerZone === null) banner = 3;
      bannerZone = z;
    }
    if ((saveClock += STEP) > 1) { saveClock = 0; save(); }
  }
  function win() {
    if (!bestTime || s.t < bestTime) { bestTime = s.t; store.set('bestTime', bestTime); }
    store.del('save');
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 0, 0.05), i * 130));
    for (let i = 0; i < 60; i++) parts.push({ x: Math.random() * WORLD_W, y: s.y + 120 + Math.random() * 100, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, life: 6, c: ['#f8c838', '#ff7b7b', '#7fd7ff', '#fff'][i % 4] });
  }
  function dust(x, y, n) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: Math.random() * 40, life: 0.3 + Math.random() * 0.3, c: '#d8d8d8', g: 120 });
  }

  // ---------- drawing ----------
  const sy = wy => Math.round(VIEW_H - (wy - cam));
  function hash(n) { n = Math.imul(n ^ 0x5bd1e995, 0x2c1b3c6d); n ^= n >>> 13; n = Math.imul(n, 0x297a2d39); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function rgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
  const SKY_RGB = SKY.map(rgb), skyCache = new Map();
  function skyAt(wy) {
    // banded every 48 px, like an old game with a short palette
    const band = Math.floor(Math.max(0, wy) / 48);
    if (skyCache.has(band)) return skyCache.get(band);
    const y = band * 48;
    let i = zones.length - 1;
    while (i > 0 && y < zones[i].y0) i--;
    const end = i + 1 < zones.length ? zones[i + 1].y0 : LEVEL.top;
    const f = Math.min(1, (y - zones[i].y0) / Math.max(1, end - zones[i].y0)), a = SKY_RGB[i], b = SKY_RGB[i + 1];
    const col = `rgb(${a.map((v, n) => Math.round(v + (b[n] - v) * f)).join(',')})`;
    skyCache.set(band, col);
    return col;
  }
  function drawSky() {
    for (let py = 0; py < VIEW_H; py += 4) {
      g.fillStyle = skyAt(cam + VIEW_H - py);
      g.fillRect(0, py, VIEW_W, 4);
    }
  }
  function drawScenery() {
    const frostY = zones[4].y0, topY = zones[7].y0;
    // stars fade in high up
    if (cam + VIEW_H > frostY) {
      const par = cam * 0.3, first = Math.floor(par / 30);
      g.fillStyle = cam > zones[5].y0 ? '#ffffff' : '#c8c8e0';
      for (let c = first; c < first + Math.ceil(VIEW_H / 30) + 2; c++) {
        for (let n = 0; n < 3; n++) {
          const wy = c * 30 + hash(c * 7 + n) * 30;
          if (wy / 0.3 < frostY) continue;
          g.fillRect(Math.floor(hash(c * 13 + n * 3) * VIEW_W), Math.round(VIEW_H - (wy - par)), 1, 1);
        }
      }
    }
    // the planet you left behind, once you're in orbit
    if (cam + VIEW_H > topY) {
      const r = 34, cx = Math.round(VIEW_W * 0.78), cy =Math.round(VIEW_H * 0.5 + (cam - topY) * 0.02);
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.floor(Math.sqrt(r * r - dy * dy));
        g.fillStyle = dy < -18 ? '#3868c8' : dy < 4 ? '#2c8c58' : dy < 16 ? '#3868c8' : '#284890';
        g.fillRect(cx - half, cy + dy, half * 2, 1);
      }
    }
    // clouds drift by in the lower half of the climb
    if (cam < frostY) {
      const par = cam * 0.6, first = Math.floor(par / 70);
      for (let c = first - 1; c < first + Math.ceil(VIEW_H / 70) + 2; c++) {
        if (c < 1) continue;
        const wy = c * 70, px = Math.floor((hash(c) * (VIEW_W + 60) + s.t * (2 + hash(c + 9) * 3)) % (VIEW_W + 60)) - 30;
        const py = Math.round(VIEW_H - (wy - par)), w = 14 + Math.floor(hash(c + 3) * 20);
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.fillRect(px, py, w, 4);
        g.fillRect(px + 4, py - 3, w - 8, 3);
      }
    }
    // a city skyline at the bottom
    if (cam < 280) {
      const base = Math.round(VIEW_H + cam * 0.5);
      for (let i = 0; i * 18 - 6 < VIEW_W; i++) {
        const w = 12 +Math.floor(hash(i) * 12), x = i * 18 - 6, h = 30 + Math.floor(hash(i + 40) * 90);
        g.fillStyle = i % 2 ? '#4a78c8' : '#4068b4';
        g.fillRect(x, base - h, w, h);
        g.fillStyle = '#d8d890';
        for (let wy = 4; wy < h - 4; wy += 6) for (let wx = 2; wx < w - 2; wx += 4)
          if (hash(i * 97 + wy * 13 + wx) < 0.25) g.fillRect(x + wx, base - h + wy, 2, 2);
      }
    }
  }
  function drawWind(z) {
    if (!z.wind) return;
    const v = windAt(z, s.t);
    g.fillStyle = 'rgba(255,255,255,.45)';
    for (let i = 0; i < 26; i++) {
      const y = Math.floor(hash(i + 300) * VIEW_H), speed = 40 + hash(i + 400) * 60;
      const x = (hash(i + 500) * VIEW_W + s.t * speed * Math.sign(v || 1) * Math.min(1, Math.abs(v) / 10 + 0.1) * 4) % VIEW_W;
      g.fillRect(Math.floor((x + VIEW_W) % VIEW_W), y, 3 + Math.floor(Math.abs(v) / 5), 1);
    }
  }
  // On a screen wider than the tower, show the walls you can't go past, in the current zone's material
  function drawWalls() {
    if (ox <= 0) return;
    for (const wx of [ox - 8, ox + WORLD_W]) {
      for (let band = Math.max(0, Math.floor(cam / 8) - 1); band * 8 < cam + VIEW_H; band++) {
        const [body, top, dark] = MAT[zoneAt(LEVEL, band * 8).mat], py = sy((band + 1) * 8);
        g.fillStyle = body; g.fillRect(wx, py, 8, 8);
        g.fillStyle = dark; g.fillRect(wx, py + 7, 8, 1);
        g.fillStyle = top; g.fillRect(wx + (band % 2 ? 1 : 5), py + 2, 2, 1);
      }
    }
  }
  function drawPlatform(p, i) {
    const wx = platX(p, s.t), wy = platY(p, s.t);
    const py = sy(wy);
    if (py < -8 || py > VIEW_H + 8) return;
    let x = Math.round(wx) + ox;
    const w = Math.round(p.w), kind = p.type === 'normal' ? p.mat : p.type === 'crumble' ? p.mat : p.type;
    const [body, top, dark] = MAT[kind] || MAT[p.mat];
    if (p.type === 'crumble' && isGone(s, i)) {
      // show where it'll come back, so nothing is a surprise
      g.fillStyle = 'rgba(255,255,255,.18)';
      for (let n = 0; n < w; n += 4) g.fillRect(x + n, py, 2, 1);
      return;
    }
    if (p.type === 'crumble' && s.cr[i] !== undefined) x += Math.floor(s.t * 40) % 2 ? 1 : -1;
    if (p.type === 'ground') {
      g.fillStyle = body; g.fillRect(0, py, VIEW_W, VIEW_H - py);
      g.fillStyle = dark;
      for (let n = 0; n < VIEW_W; n += 8) g.fillRect(n + (n % 16 ? 4 : 0), py + 8, 2, 2);
      g.fillStyle = top; g.fillRect(0, py, VIEW_W, 3);
      return;
    }
    const h = p.type === 'spring' ? 4 : 6;
    if (kind === 'cloud') {
      g.fillStyle = dark; g.fillRect(x + 1, py + 4, w - 2, 2);
      g.fillStyle = body; g.fillRect(x, py + 1, w, 3);
      g.fillStyle = top;
      g.fillRect(x + 1, py, w - 2, 1);
      for (let n = 3; n < w - 4; n += 7) g.fillRect(x + n, py - 1, 4, 1);
    } else {
      g.fillStyle = body; g.fillRect(x, py, w, h);
      g.fillStyle = dark; g.fillRect(x, py + h - 1, w, 1);
      if (kind === 'crate' || kind === 'brick' || kind === 'stone') for (let n = 7; n < w; n += 8) g.fillRect(x + n, py + 1, 1, h - 2);
      if (kind === 'brick') for (let n = 3; n < w; n += 8) g.fillRect(x + n, py + 3, 1, 1);
      if (kind === 'girder' || kind === 'iron') for (let n = 2; n < w - 1; n += 5) g.fillRect(x + n, py + 2, 1, 1);
      if (kind === 'rock') for (let n = 3; n < w - 1; n += 6) g.fillRect(x + n, py + 2 + (n % 2), 2, 1);
      g.fillStyle = top; g.fillRect(x, py, w, 1);
    }
    if (p.type === 'crumble') {
      g.fillStyle = C.black;
      for (let n = 3; n < w - 1; n += 6) g.fillRect(x + n, py + 1 + (n % 3), 1, 3);
    }
    if (p.type === 'ice') {
      g.fillStyle = C.white;
      for (let n = 2; n < w - 2; n += 7) g.fillRect(x + n, py + 2, 2, 1);
    }
    if (p.type === 'spring') {
      g.fillStyle = dark;
      for (let n = 3; n < w - 2; n += 4) g.fillRect(x + n, py - 3, 2, 3);
      g.fillStyle = top; g.fillRect(x + 1, py - 4, w - 2, 1);
    }
    if (p.type === 'goal') {
      const fx = x + w / 2;
      g.fillStyle = C.white; g.fillRect(fx, py - 26, 1, 26);
      const wave = Math.floor(s.t * 4) % 2;
      g.fillStyle = C.red;
      g.fillRect(fx + 1, py - 26 + wave, 10, 3); g.fillRect(fx + 1, py - 23, 8, 2 + wave);
      text('THE TOP', fx, py - 36, C.gold, 1, 'center');
    }
  }
  function drawSigns() {
    // the ground tells you everything: no menu, you just start climbing
    const y = sy(0);
    if (y > VIEW_H + 120) return;
    text('ONLY UP', VIEW_W / 2, y - 92 - 40 * (ui - 1), C.white, 4, 'center');
    text('THERE ARE NO CHECKPOINTS.', VIEW_W / 2, y - 58 - 30 * (ui - 1), C.white, ui, 'center');
    if (TOUCH) {
      text('HOLD THE ARROWS TO MOVE.', ox + 8, y - 16 - 24 * ui, C.white, ui);
      text('TAP JUMP OR ANYWHERE', ox + 8, y - 16 - 16 * ui, C.white, ui);
      text('ELSE TO JUMP. BACK PAUSES.', ox + 8, y - 16 - 8 * ui, C.white, ui);
    } else {
      text('ARROWS OR A D TO MOVE', ox + 8, y - 30, C.white);
      text('SPACE OR W TO JUMP', ox + 8, y - 22, C.white);
      text('ESC PAUSE  M SOUND  F FULLSCREEN', ox + 8, y - 14, C.white);
    }
  }
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  function drawHud(z) {
    const m = y => Math.floor(y / 8);
    const hx = TOUCH ? Math.ceil(46 / scale) : 4;   // clear of the launcher's back button
    const row = 4 + 7 * ui;
    text(`HEIGHT ${m(s.y)}M`, hx, 4, C.white, ui);
    text(`BEST ${m(s.best)}M`, hx, row, C.gold, ui);
    text(mmss(s.t), VIEW_W - 12, 4, C.white, ui, 'right');
    text(`FALLS ${s.falls}`, VIEW_W - 12, row, s.falls ? C.red : C.dim, ui, 'right');
    // how far up the tower you are, and your best
    const bx = VIEW_W - 6, by = 4, bh = VIEW_H - 8;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(bx, by, 3, bh);
    const mark = (y, col) => { g.fillStyle = col; g.fillRect(bx - 1, by + bh - 2 - Math.round(Math.min(1, y / LEVEL.top) * (bh - 2)), 5, 2); };
    mark(s.best, C.gold); mark(s.y, C.white);
    if (banner > 0) text(z.name, VIEW_W / 2, 40, C.white, 2, 'center');
    if (fellText > 0 && Math.floor(fellText * 5) % 5) text(`FELL ${m(fellBy)}M`, VIEW_W / 2, 58, C.red, 2, 'center');
    if (touchUI) drawButtons();
  }
  function drawButtons() {
    // the rects are in CSS pixels; the canvas is low-res, so divide by scale
    const bt = buttons();
    const box = (r, held, label) => {
      const x = Math.round(r.x / scale), y = Math.round(r.y / scale), w = Math.round(r.w / scale), h = Math.round(r.h / scale);
      g.fillStyle = held ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.35)'; g.fillRect(x, y, w, h);
      g.fillStyle = held ? C.white : 'rgba(255,255,255,.6)';
      g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
      const size = label.length > 1 ? ui : 2 * ui;
      text(label, x + w / 2, y + h / 2 - 2.5 * size, C.white, size, 'center');
    };
    box(bt.left, touching('left'), '<');
    box(bt.right, touching('right'), '>');
    box(bt.jump, touching('jump'), 'JUMP');
  }
  function panel(h) {
    g.fillStyle = C.panel; g.fillRect(0, 0, VIEW_W, VIEW_H);
    return Math.floor((VIEW_H - h) / 2);
  }
  // which tappable line of the pause screen a tap at low-res height ly hits
  // the panel's lines: the first starts 28 below the title, then one every 10 (or 20 with doubled text)
  const lineY = (top, n) => top + 28 + n * 10 * ui;
  function pauseLineAt(ly) {
    const top = Math.floor((VIEW_H - 70 * ui) / 2), mid = n => lineY(top, n) + 2.5 * ui;
    if (Math.abs(ly - mid(2)) <= 5 * ui) return 'reset';
    if (Math.abs(ly - mid(3)) <= 5 * ui) return 'sound';
    return null;
  }
  function drawPause() {
    const y = panel(70 * ui), cx = VIEW_W / 2;
    text('PAUSED', cx, y, C.white, 3, 'center');
    if (TOUCH) {
      text('TAP TO KEEP CLIMBING', cx, lineY(y, 0), C.white, ui, 'center');
      text('BACK AGAIN TO LEAVE', cx, lineY(y, 1), C.dim, ui, 'center');
      text(confirmReset ? 'TAP AGAIN TO CONFIRM' : 'TAP HERE TO RESTART', cx, lineY(y, 2), confirmReset ? C.red : C.white, ui, 'center');
      text(muted ? 'SOUND OFF  TAP HERE' : 'SOUND ON  TAP HERE', cx, lineY(y, 3), C.white, ui, 'center');
      return;
    }
    text('ENTER KEEP CLIMBING', cx, y + 28, C.white, 1, 'center');
    if (inFrame) text('ESC BACK TO TERMINAL  YOUR CLIMB IS SAVED', cx, y + 38, C.dim, 1, 'center');
    text(confirmReset ? 'PRESS R AGAIN TO START AGAIN FROM THE GROUND' : 'R START AGAIN', cx, y + 48, confirmReset ? C.red : C.dim, 1, 'center');
    text(muted ? 'M SOUND IS OFF' : 'M SOUND IS ON', cx, y + 58, C.dim, 1, 'center');
  }
  function drawWin() {
    const y = panel(70 * ui), cx = VIEW_W / 2;
    text('YOU MADE IT', cx, y, C.gold, 3, 'center');
    text(`TIME ${mmss(s.t)}   FALLS ${s.falls}`, cx, lineY(y, 0), C.white, ui, 'center');
    if (bestTime) text(`BEST TIME ${mmss(bestTime)}`, cx, lineY(y, 1), C.gold, ui, 'center');
    text(TOUCH ? 'TAP TO CLIMB AGAIN' : 'ENTER CLIMB AGAIN' + (inFrame ? '  ESC BACK TO TERMINAL' : ''), cx, lineY(y, 2) + 6, C.dim, ui, 'center');
  }
  function draw() {
    const z = zoneAt(LEVEL, s.y);
    drawSky();
    drawScenery();
    drawSigns();
    drawWalls();
    for (let i = 0; i < plats.length; i++) drawPlatform(plats[i], i);
    drawWind(z);
    for (const p of parts) { g.fillStyle = p.c; g.fillRect(Math.round(p.x) + ox, sy(p.y), 1, 1); }
    // round relative to a moving platform, so the player doesn't jitter against it
    const under = s.on >= 0 && plats[s.on].move ? platX(plats[s.on], s.t) : 0;
    drawPlayer(Math.round(under) + Math.round(s.x - under) + ox, sy(s.y) - PH);
    drawHud(z);
    if (s.won) drawWin();
    else if (paused) drawPause();
  }

  // ---------- main loop ----------
  function resize() {
    // Fill the whole window. At least the tower's full width and 240 rows always fit, and any screen shape just
    // shows more around them, so the jumps are the same everywhere. Whole-number scaling keeps every pixel the same size.
    const raw = Math.min(innerWidth / WORLD_W, innerHeight / 240);
    scale = raw >= 2 ? Math.floor(raw) : raw;
    ui = TOUCH && scale < 2 ? 2 : 1;
    VIEW_W = Math.ceil(innerWidth / scale); VIEW_H = Math.ceil(innerHeight / scale);
    ox = Math.floor((VIEW_W - WORLD_W) / 2);
    cv.width = VIEW_W; cv.height = VIEW_H;
    cv.style.width = VIEW_W * scale + 'px'; cv.style.height = VIEW_H * scale + 'px';
  }
  let last = 0, acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    // volume buttons are controls only while actually climbing with the phone sideways
    setVolumeKeys(!paused && !s.won && innerWidth > innerHeight && document.visibilityState === 'visible');
    if (!paused && !s.won) {
      acc += dt;
      while (acc >= STEP && !s.won) { acc -= STEP; tick(); }
    }
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy -= p.g * dt; p.life -= dt; }
    parts = parts.filter(p => p.life > 0);
    if (!paused) { banner = Math.max(0, banner - dt); fellText = Math.max(0, fellText - dt); }
    updateCamera(dt);
    draw();
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  resize();
  load();
  last = performance.now();
  requestAnimationFrame(frame);
})();
