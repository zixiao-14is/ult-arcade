// Snake: classic snake with a local leaderboard. No DOM needed until open() is called.
(function (root) {
  // the field is 24x18 on a wide screen and turned upright to 18x24 on a tall one, like a phone
  let COLS = 24, ROWS = 18;
  const TOUCH = matchMedia('(pointer: coarse)').matches;   // phones: tap hints, and the HUD sits below the launcher's back button
  const HUD_Y = TOUCH ? 62 : 28;
  const START_MS = 130, MIN_MS = 60, SPEEDUP_MS = 2;   // tick gets faster with every apple
  const BOARD_SIZE = 10, NAME_MAX = 10;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEYDIR = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  const C = { bg: '#000', grid: '#0b1a10', wall: '#9fe89f', snake: '#9fe89f', head: '#eaffea', food: '#ff7b7b', text: '#e6e6e6', dim: '#7a7a7a', acc: '#7fd7ff', gold: '#ffd76a' };
  const FONT = 'Consolas, "Cascadia Mono", Menlo, "DejaVu Sans Mono", monospace';

  // localStorage can throw (private mode, file:// in some browsers), so fall back to memory.
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('snake:' + k); return v == null ? d : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem('snake:' + k, JSON.stringify(v)); } catch {} },
  };
  const board = {
    list() { const l = store.get('leaderboard', []); return Array.isArray(l) ? l : []; },
    qualifies(score) { const l = this.list(); return score > 0 && (l.length < BOARD_SIZE || score > l[l.length - 1].score); },
    add(entry) {
      const l = this.list();
      l.push(entry);
      l.sort((a, b) => b.score - a.score || a.time - b.time);
      l.length = Math.min(l.length, BOARD_SIZE);
      store.set('leaderboard', l);
      return l.indexOf(entry);
    },
    clear() { store.set('leaderboard', []); },
  };

  let cv, g, W = 0, H = 0, cell = 20, ox = 0, oy = 0;
  let active = false, onClose = null, scene = 'menu', raf = 0, last = 0, acc = 0;
  let snake, dir, queue, food, score, tickMs, grow, dead, deathFlash;
  let name = '', highlight = -1, confirmClear = false, touchStart = null;
  // phones get an arrow pad under the field; pad is its centre and button size, padH the strip it sits in
  let pad = { x: 0, y: 0, b: 0 }, padH = 0, pressed = null, pressedAt = 0;

  function setup() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:none;touch-action:none;user-select:none;background:#000;z-index:10';
    document.body.appendChild(cv);
    g = cv.getContext('2d');
    addEventListener('resize', resize);
    addEventListener('keydown', onKey);
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointerup', onPointerUp);
  }
  function resize() {
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hud = HUD_Y + 28;
    padH = TOUCH ? Math.round(Math.min(H * 0.32, 250)) : 0;
    cell = Math.max(8, Math.floor(Math.min((W - 32) / COLS, (H - hud - 24 - padH) / ROWS)));
    ox = Math.floor((W - cell * COLS) / 2);
    oy = Math.floor(hud + (H - hud - padH - cell * ROWS) / 2);
    const b = Math.floor(Math.min(padH / 3.3, W / 4.5, 76));
    pad = { x: W / 2, y: H - padH / 2 - 6, b };
  }

  // ---------- game logic ----------
  function newGame() {
    [COLS, ROWS] = H > W ? [18, 24] : [24, 18];
    resize();
    const cx = Math.floor(COLS / 2) - 2, cy = Math.floor(ROWS / 2);
    snake = [[cx + 2, cy], [cx + 1, cy], [cx, cy]];
    dir = 'right'; queue = []; score = 0; tickMs = START_MS; grow = 0; dead = false; acc = 0;
    placeFood();
    scene = 'play';
  }
  function placeFood() {
    const free = [];
    const taken = new Set(snake.map(([x, y]) => y * COLS + x));
    for (let i = 0; i < COLS * ROWS; i++) if (!taken.has(i)) free.push(i);
    if (!free.length) { food = null; return; }
    const i = free[Math.floor(Math.random() * free.length)];
    food = [i % COLS, Math.floor(i / COLS)];
  }
  function turn(d) {
    // queue up to two turns so quick inputs aren't lost, but never reverse into yourself
    const prev = queue.length ? queue[queue.length - 1] : dir;
    const [px, py] = DIRS[prev], [nx, ny] = DIRS[d];
    if (d === prev || (px + nx === 0 && py + ny === 0) || queue.length >= 2) return;
    queue.push(d);
  }
  function tick() {
    if (queue.length) dir = queue.shift();
    const [dx, dy] = DIRS[dir];
    const [hx, hy] = snake[0];
    // no walls: leaving one edge brings you back in from the opposite edge
    const nx = (hx + dx + COLS) % COLS, ny = (hy + dy + ROWS) % ROWS;
    // the tail moves out of the way this tick unless we're growing
    const body = grow > 0 ? snake : snake.slice(0, -1);
    if (body.some(([x, y]) => x === nx && y === ny)) return die();
    snake.unshift([nx, ny]);
    if (food && nx === food[0] && ny === food[1]) {
      score += 10; grow += 1;
      tickMs = Math.max(MIN_MS, tickMs - SPEEDUP_MS);
      placeFood();
      if (!food) return die();  // filled the board: you win, game over anyway
    }
    if (grow > 0) grow--; else snake.pop();
  }
  function die() {
    dead = true; deathFlash = 1;
    highlight = -1; confirmClear = false;
    const best = store.get('best', 0);
    if (score > best) store.set('best', score);
    if (board.qualifies(score)) { name = store.get('lastName', ''); scene = 'entry'; }
    else scene = 'over';
  }
  function saveEntry() {
    const n = name.trim() || 'PLAYER';
    if (name.trim()) store.set('lastName', n);  // only remember a name the player actually typed
    highlight = board.add({ name: n, score, length: snake.length, time: Date.now() });
    scene = 'board';
  }

  // ---------- input ----------
  function onKey(e) {
    if (!active) return;
    const k = e.code;
    if (scene === 'entry') {
      e.preventDefault();
      if (e.key === 'Enter') saveEntry();
      else if (e.key === 'Escape') scene = 'over';
      else if (e.key === 'Backspace') name = name.slice(0, -1);
      else if (e.key.length === 1 && /[\w .\-]/.test(e.key) && name.length < NAME_MAX) name += e.key.toUpperCase();
      return;
    }
    if (KEYDIR[k] || k === 'Space') e.preventDefault();
    if (scene === 'play') {
      if (KEYDIR[k]) turn(KEYDIR[k]);
      else if (k === 'KeyP' || k === 'Space') scene = 'paused';
      else if (k === 'Escape') scene = 'menu';
    } else if (scene === 'paused') {
      if (k === 'KeyP' || k === 'Space' || k === 'Enter') { scene = 'play'; last = performance.now(); }
      else if (k === 'Escape') scene = 'menu';
    } else if (scene === 'menu') {
      if (k === 'Enter' || k === 'Space') newGame();
      else if (k === 'KeyL') { highlight = -1; confirmClear = false; scene = 'board'; }
      else if (k === 'Escape') close();
    } else if (scene === 'over') {
      if (k === 'Enter' || k === 'Space' || k === 'KeyR') newGame();
      else if (k === 'KeyL') scene = 'board';
      else if (k === 'Escape') scene = 'menu';
    } else if (scene === 'board') {
      if (k === 'KeyC') {
        if (confirmClear) { board.clear(); highlight = -1; confirmClear = false; } else confirmClear = true;
      } else if (k === 'Enter' || k === 'Space') newGame();
      else if (k === 'Escape' || k === 'KeyL') { confirmClear = false; scene = 'menu'; }
      else confirmClear = false;
    }
  }
  // which arrow of the pad a touch is on: anything near the pad counts, by whichever way it leans from the centre
  function padDir(x, y) {
    const dx = x - pad.x, dy = y - pad.y, d = Math.hypot(dx, dy);
    if (!padH || d > pad.b * 1.9 || d < pad.b * 0.3) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  function onPointerDown(e) {
    const d = scene === 'play' ? padDir(e.clientX, e.clientY) : null;
    // turn the moment the arrow is pressed, not on release, so it feels like a real button
    if (d) { turn(d); pressed = d; pressedAt = performance.now(); touchStart = null; return; }
    touchStart = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!active || !touchStart) return;
    touchStart = null;
    if (scene === 'play') {
      // tapping the field pauses; a tap that just misses the arrows does nothing
      if (e.clientY < H - padH) scene = 'paused';
    } else if (scene === 'paused') { scene = 'play'; last = performance.now(); }
    else if (scene === 'entry') {
      // no physical keyboard on most touch devices: ask with a native prompt instead
      const n = window.prompt('New high score! Your name:', name);
      if (n !== null) { name = n.toUpperCase().replace(/[^\w .\-]/g, '').slice(0, NAME_MAX); saveEntry(); }
    } else if (scene === 'menu' && e.clientY > H * 0.72) { highlight = -1; scene = 'board'; }
    else if (scene === 'board' && e.clientY > H - 70) scene = 'menu';
    else newGame();
  }

  // ---------- drawing ----------
  function text(s, x, y, size, color, align = 'center', weight = '') {
    g.font = `${weight} ${size}px ${FONT}`;
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(s, x, y);
  }
  function drawField() {
    g.fillStyle = C.grid;
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++)
      if ((x + y) % 2) g.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    g.strokeStyle = C.wall; g.lineWidth = 2;
    g.shadowColor = C.wall; g.shadowBlur = 10;
    g.setLineDash([6, 6]);  // dashed border: the edges are open
    g.strokeRect(ox - 2, oy - 2, cell * COLS + 4, cell * ROWS + 4);
    g.setLineDash([]);
    g.shadowBlur = 0;

    if (food) {
      const t = performance.now() / 300;
      const r = cell * (0.32 + Math.sin(t) * 0.04);
      g.fillStyle = C.food; g.shadowColor = C.food; g.shadowBlur = 12;
      g.beginPath(); g.arc(ox + (food[0] + 0.5) * cell, oy + (food[1] + 0.5) * cell, r, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
    }

    const pad = Math.max(1, Math.round(cell * 0.08));
    snake.forEach(([x, y], i) => {
      g.fillStyle = dead && deathFlash > 0 && Math.floor(deathFlash * 8) % 2 ? C.food : (i === 0 ? C.head : C.snake);
      g.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i / (snake.length * 1.6));
      g.fillRect(ox + x * cell + pad, oy + y * cell + pad, cell - pad * 2, cell - pad * 2);
    });
    g.globalAlpha = 1;

    // eyes, so you can tell which way the head is facing
    const [hx, hy] = snake[0], [dx, dy] = DIRS[dir];
    const cx = ox + (hx + 0.5) * cell, cy = oy + (hy + 0.5) * cell, e = cell * 0.18;
    g.fillStyle = '#000';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + dx * e + dy * e * s, cy + dy * e + dx * e * s, Math.max(1.5, cell * 0.08), 0, Math.PI * 2);
      g.fill();
    }
  }
  function drawHud() {
    const top = HUD_Y;
    text(`SCORE ${score}`, ox, top, 18, C.text, 'left', 'bold');
    text(`LENGTH ${snake.length}`, W / 2, top, 16, C.dim);
    text(`BEST ${Math.max(store.get('best', 0), score)}`, ox + cell * COLS, top, 18, C.gold, 'right', 'bold');
  }
  function drawPad() {
    const { x, y, b } = pad, now = performance.now();
    const ARROWS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (const [d, [ax, ay]] of Object.entries(ARROWS)) {
      const cx = x + ax * b * 1.08, cy = y + ay * b * 1.08, h = b / 2;
      const lit = pressed === d && now - pressedAt < 160;
      g.fillStyle = lit ? 'rgba(159,232,159,0.35)' : 'rgba(159,232,159,0.08)';
      g.strokeStyle = lit ? C.head : 'rgba(159,232,159,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(cx - h, cy - h, b, b, 10); g.fill(); g.stroke();
      // triangle pointing the arrow's way
      const t = b * 0.22;
      g.fillStyle = lit ? C.head : C.snake;
      g.beginPath();
      g.moveTo(cx + ax * t, cy + ay * t);
      g.lineTo(cx - ax * t * 0.6 - ay * t, cy - ay * t * 0.6 - ax * t);
      g.lineTo(cx - ax * t * 0.6 + ay * t, cy - ay * t * 0.6 + ax * t);
      g.closePath(); g.fill();
    }
  }
  function shade(alpha = 0.72) { g.fillStyle = `rgba(0,0,0,${alpha})`; g.fillRect(0, 0, W, H); }
  function drawMenu() {
    const s = Math.min(1, W / 520);
    text('SNAKE', W / 2, H * 0.24, 72 * s, C.snake, 'center', 'bold');
    text('eat the apples. don\'t bite yourself.', W / 2, H * 0.24 + 56 * s, 15, C.dim);
    text('go off an edge to come back the other side.', W / 2, H * 0.24 + 56 * s + 22, 15, C.dim);
    // little demo snake
    const n = 9, sz = Math.min(22, W / 24), t = Math.floor(performance.now() / 140);
    for (let i = 0; i < n; i++) {
      g.globalAlpha = 1 - i / (n * 1.4);
      g.fillStyle = i === 0 ? C.head : C.snake;
      g.fillRect(W / 2 + ((t - i) % 14 - 7) * sz, H * 0.46, sz - 2, sz - 2);
    }
    g.globalAlpha = 1;
    if (TOUCH) {
      text('TAP to start', W / 2, H * 0.6, 18, C.text);
      text('arrows to steer · tap the field to pause', W / 2, H * 0.6 + 30, 13, C.dim);
      text('tap here for the leaderboard', W / 2, H * 0.8, 16, C.acc);   // the bottom of the screen opens it
    } else {
      text('ENTER / SPACE  start', W / 2, H * 0.6, 18, C.text);
      text('L  leaderboard', W / 2, H * 0.6 + 30, 18, C.acc);
      text('ARROWS / WASD move · P pause' + (window.parent !== window ? ' · ESC back to the arcade' : ''), W / 2, H * 0.6 + 72, 13, C.dim);
    }
    const top = board.list()[0];
    if (top) text(`TOP: ${top.name}  ${top.score}`, W / 2, H * 0.9, 16, C.gold);
  }
  function drawBoard() {
    const l = board.list();
    const w = Math.min(520, W - 32), x0 = (W - w) / 2;
    text('LEADERBOARD', W / 2, 64, 34, C.gold, 'center', 'bold');
    let y = 120;
    text('#', x0, y, 14, C.dim, 'left'); text('NAME', x0 + 40, y, 14, C.dim, 'left');
    text('LEN', x0 + w - 110, y, 14, C.dim, 'right'); text('SCORE', x0 + w, y, 14, C.dim, 'right');
    y += 14;
    g.fillStyle = C.dim; g.fillRect(x0, y, w, 1);
    const rowH = Math.min(36, (H - y - 110) / BOARD_SIZE);
    for (let i = 0; i < BOARD_SIZE; i++) {
      const r = l[i], yy = y + rowH * (i + 0.5) + 6;
      const hl = i === highlight;
      if (hl) { g.fillStyle = 'rgba(159,232,159,0.14)'; g.fillRect(x0 - 8, yy - rowH / 2, w + 16, rowH); }
      const col = hl ? C.head : i === 0 ? C.gold : i < 3 ? C.acc : C.text;
      text(String(i + 1).padStart(2), x0, yy, 17, r ? col : C.dim, 'left');
      text(r ? r.name : '---', x0 + 40, yy, 17, r ? col : C.dim, 'left', hl ? 'bold' : '');
      text(r ? String(r.length) : '', x0 + w - 110, yy, 17, C.dim, 'right');
      text(r ? String(r.score) : '', x0 + w, yy, 17, r ? col : C.dim, 'right', 'bold');
    }
    const by = H - 48;
    if (confirmClear) text('press C again to erase every score', W / 2, by, 15, C.food);
    else text(TOUCH ? 'tap here to go back' : 'ENTER play · ESC menu · C clear', W / 2, by, 14, C.dim);
  }
  function drawOver(entry) {
    shade();
    text('GAME OVER', W / 2, H * 0.3, 48, C.food, 'center', 'bold');
    text(`score ${score}   length ${snake.length}`, W / 2, H * 0.3 + 48, 18, C.text);
    if (entry) {
      text('NEW HIGH SCORE! enter your name', W / 2, H * 0.52, 18, C.gold, 'center', 'bold');
      const blink = Math.floor(performance.now() / 500) % 2 ? '_' : ' ';
      g.strokeStyle = C.gold; g.lineWidth = 1;
      const bw = Math.min(320, W - 40);
      g.strokeRect(W / 2 - bw / 2, H * 0.52 + 24, bw, 44);
      text(name + blink, W / 2, H * 0.52 + 46, 24, C.head, 'center', 'bold');
      text(TOUCH ? 'tap to type your name' : 'ENTER save · ESC skip', W / 2, H * 0.52 + 96, 14, C.dim);
    } else {
      text(TOUCH ? 'tap to play again' : 'ENTER play again · L leaderboard · ESC menu', W / 2, H * 0.56, 15, C.dim);
    }
  }

  function frame(now) {
    if (!active) return;
    const dt = Math.min(250, now - last); last = now;
    if (scene === 'play') {
      acc += dt;
      while (acc >= tickMs && scene === 'play') { acc -= tickMs; tick(); }
    }
    if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - dt / 900);

    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    if (scene === 'menu') drawMenu();
    else if (scene === 'board') drawBoard();
    else {
      drawHud(); drawField();
      if (padH && (scene === 'play' || scene === 'paused')) drawPad();
      if (scene === 'paused') { shade(0.55); text('PAUSED', W / 2, H / 2, 40, C.text, 'center', 'bold'); text(TOUCH ? 'tap to resume' : 'P / SPACE resume · ESC menu', W / 2, H / 2 + 40, 14, C.dim); }
      else if (scene === 'over') drawOver(false);
      else if (scene === 'entry') drawOver(true);
    }
    raf = requestAnimationFrame(frame);
  }

  function open(closeCallback) {
    setup();
    onClose = closeCallback || null;
    active = true; scene = 'menu';
    cv.style.display = 'block'; resize();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function close() {
    if (onClose) {
      active = false; cancelAnimationFrame(raf);
      cv.style.display = 'none';
      const cb = onClose; onClose = null; cb();
    } else if (window.parent !== window) {
      window.parent.postMessage('exit-game', '*');
    }
  }

  root.Snake = { open, board };
})(typeof window !== 'undefined' ? window : globalThis);
