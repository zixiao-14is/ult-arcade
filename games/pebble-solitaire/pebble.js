// Pebble Solitaire: canvas drawing, input, menu. Rules live in rules.js (PebbleSolitaire).
(function () {
  const { SIZE, at, isHole, newBoard, jumpsFrom, play, unplay, result } = PebbleSolitaire;
  const C = { bg: '#000', hole: '#2a2a2a', pebble: '#e6e6e6', text: '#e6e6e6', dim: '#7a7a7a', off: '#3a3a3a', pick: '#ffd76a', target: '#9fe89f', bad: '#ff7b7b' };
  const FONT = 'Consolas, "Cascadia Mono", Menlo, "DejaVu Sans Mono", monospace';
  const TOP = 64, BOTTOM = 72;
  const TOUCH = matchMedia('(pointer: coarse)').matches;   // phones: tap hints instead of keys
  const BUTTONS = [
    { label: 'UNDO', act: undo }, { label: 'RESTART', act: newGame }, { label: 'MENU', act: () => { scene = 'menu'; } },
  ];

  // localStorage can throw (private mode, file:// in some browsers), so fall back to memory.
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('pebble:' + k); return v == null ? d : JSON.parse(v); } catch { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem('pebble:' + k, JSON.stringify(v)); } catch {} },
  };

  const cv = document.getElementById('cv'), g = cv.getContext('2d');
  let W = 0, H = 0, cell = 40, cx = 0, cy = 0;
  let scene = 'menu', board = null, history = [], over = null, picked = -1, cursor = at(3, 3), keyboard = false;
  let drag = null, hover = -1, note = '', noteUntil = 0;
  let best = store.get('best', null);

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = Math.max(20, Math.floor(Math.min((W - 16) / 7.6, (H - TOP - BOTTOM) / 7.6)));
    cx = W / 2; cy = TOP + (H - TOP - BOTTOM) / 2;
  }
  const px = i => cx + (i % SIZE - 3) * cell;
  const py = i => cy + (Math.floor(i / SIZE) - 3) * cell;
  const targetsOf = i => (i < 0 ? [] : jumpsFrom(board, i));

  // ---------- game flow ----------
  function newGame() {
    board = newBoard();
    history = []; over = null; picked = -1; drag = null; note = '';
    cursor = at(3, 3);
    scene = 'play';
  }
  function jump(m) {
    play(board, m);
    history.push(m);
    picked = -1; drag = null;
    cursor = m.to;
    over = result(board);
    if (over) saveBest();
  }
  function undo() {
    if (!history.length) return;
    unplay(board, history.pop());
    over = null; picked = -1; drag = null;
  }
  function saveBest() {
    // fewest pebbles wins, and finishing in the centre beats one pebble anywhere else
    const rank = r => r.left * 2 - (r.perfect ? 1 : 0);
    if (!best || rank(over) < rank(best)) { best = { left: over.left, perfect: over.perfect }; store.set('best', best); }
  }
  function say(s) { note = s; noteUntil = performance.now() + 1400; }
  function pick(i) {
    if (!board[i]) return false;
    if (!jumpsFrom(board, i).length) { picked = -1; say("that pebble can't jump right now"); return false; }
    picked = i;
    return true;
  }

  // ---------- input ----------
  addEventListener('resize', resize);
  addEventListener('keydown', e => {
    const k = e.code;
    const move = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] }[k];
    if (move || k === 'Space') e.preventDefault();
    if (scene === 'menu') {
      if (e.repeat) return;
      if (k === 'Enter' || k === 'Space') { if (board && !over) scene = 'play'; else newGame(); }
      else if (k === 'Escape' && window.parent !== window) window.parent.postMessage('exit-game', '*');
      return;
    }
    keyboard = true;
    if (move) {
      const c = cursor % SIZE + move[0], r = Math.floor(cursor / SIZE) + move[1];
      if (isHole(c, r)) cursor = at(c, r);
      return;
    }
    if (e.repeat) return;
    if (k === 'Escape') { if (picked >= 0) picked = -1; else scene = 'menu'; }
    else if (k === 'KeyU') undo();
    else if (k === 'KeyR') newGame();
    else if (k === 'Enter' || k === 'Space') {
      if (over) return newGame();
      const m = targetsOf(picked).find(t => t.to === cursor);
      if (m) jump(m);
      else if (cursor === picked) picked = -1;
      else pick(cursor);
    }
  });
  function holeAt(e) {
    const c = Math.round((e.clientX - cx) / cell) + 3, r = Math.round((e.clientY - cy) / cell) + 3;
    if (!isHole(c, r)) return -1;
    const i = at(c, r);
    return Math.hypot(e.clientX - px(i), e.clientY - py(i)) < cell * 0.48 ? i : -1;
  }
  function buttonRects() {
    const w = Math.min(92, (W - 32) / 3), h = 26, y = H - 62, x0 = W / 2 - (w * 3 + 16) / 2;
    return BUTTONS.map((b, n) => ({ ...b, x: x0 + n * (w + 8), y, w, h }));
  }
  function buttonAt(e) { return buttonRects().find(b => e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h); }

  // A pebble can be clicked and then its landing spot clicked, or dragged straight there.
  cv.addEventListener('pointerdown', e => {
    keyboard = false;
    if (scene === 'menu') { if (board && !over) scene = 'play'; else newGame(); return; }
    const b = buttonAt(e);
    if (b) return b.act();
    if (over) return;
    const i = holeAt(e);
    if (i < 0) { picked = -1; return; }
    const m = targetsOf(picked).find(t => t.to === i);
    if (m) return jump(m);
    const again = i === picked;
    if (pick(i)) drag = { i, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, again };
    else if (!board[i]) picked = -1;
  });
  addEventListener('pointermove', e => {
    if (drag) { drag.x = e.clientX; drag.y = e.clientY; }
    hover = scene === 'play' ? holeAt(e) : -1;
    const clickable = scene === 'menu' || buttonAt(e) || (!over && hover >= 0 && (board[hover] || targetsOf(picked).some(t => t.to === hover)));
    cv.style.cursor = clickable ? 'pointer' : 'default';
  });
  addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag, moved = Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6;
    drag = null;
    const m = targetsOf(d.i).find(t => t.to === holeAt(e));
    if (m) jump(m);
    else if (!moved && d.again) picked = -1;   // clicking the picked pebble again puts it down
  });

  // ---------- drawing ----------
  function text(s, x, y, size, color, align = 'center', weight = '') {
    g.font = `${weight} ${size}px ${FONT}`;
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(s, x, y);
  }
  function circle(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }
  function ring(x, y, color) { g.strokeStyle = color; g.lineWidth = 2; circle(x, y, cell * 0.43); g.stroke(); }
  function drawBoard() {
    const targets = targetsOf(picked);
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (!isHole(c, r)) continue;
      const i = at(c, r), x = px(i), y = py(i);
      g.fillStyle = board[i] && !(drag && drag.i === i) ? C.pebble : C.hole;
      circle(x, y, cell * 0.36); g.fill();
      if (targets.some(t => t.to === i)) ring(x, y, C.target);
      if (i === picked || (over && over.perfect && board[i])) ring(x, y, C.pick);
      else if (keyboard && i === cursor) ring(x, y, C.text);
      else if (!keyboard && i === hover && !over && board[i]) ring(x, y, C.dim);
    }
    if (drag) { g.fillStyle = C.pebble; circle(drag.x, drag.y, cell * 0.36); g.fill(); }
  }
  function endText() {
    if (over.perfect) return 'PERFECT! ONE PEBBLE, RIGHT IN THE CENTRE';
    if (over.left === 1) return 'ONE LEFT! NOW TRY TO FINISH IN THE CENTRE';
    return `NO JUMPS LEFT: ${over.left} PEBBLES`;
  }
  function bestText() { return best ? `BEST ${best.left}${best.perfect ? ' CENTRE' : ''}` : 'BEST -'; }
  function drawHud(now) {
    const left = board.reduce((a, v) => a + v, 0), size = Math.min(20, (W - 16) / 26);
    if (over) text(endText(), W / 2, 22, size, over.perfect ? C.pick : C.text, 'center', 'bold');
    else if (now < noteUntil) text(note, W / 2, 22, size, C.bad, 'center', 'bold');
    else text(picked >= 0 ? 'NOW PICK WHERE IT LANDS' : 'PICK A PEBBLE TO JUMP', W / 2, 22, size, C.text, 'center', 'bold');
    text(`PEBBLES ${left}  ·  JUMPS ${history.length}  ·  ${bestText()}`, W / 2, 46, Math.min(14, (W - 16) / 30), C.dim);
    for (const b of buttonRects()) {
      const off = b.label === 'UNDO' && !history.length;
      g.strokeStyle = off ? C.off : C.dim; g.lineWidth = 1;
      g.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
      text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 13, off ? C.off : C.text);
    }
    text(TOUCH ? 'tap a pebble, then where it lands · or drag it' : 'click or drag · arrows + ENTER · U undo · R restart · ESC menu', W / 2, H - 16, Math.min(12, (W - 16) / 36), C.dim);
  }
  function drawMenu() {
    const s = Math.min(1, W / 620);
    text('PEBBLE SOLITAIRE', W / 2, H * 0.32, 52 * s, C.text, 'center', 'bold');
    text('jump over pebbles to remove them. leave just one.', W / 2, H * 0.32 + 44 * s, Math.min(15, (W - 16) / 30), C.dim);
    const go = board && !over ? 'continue' : 'start';
    text(TOUCH ? `TAP to ${go}` : `ENTER / SPACE or click  ${go}`, W / 2, H * 0.55, 18 * Math.max(s, 0.8), C.text);
    if (best) text(bestText(), W / 2, H * 0.55 + 30, 15, C.pick);
    if (window.parent !== window && !TOUCH) text('ESC back to the arcade', W / 2, H * 0.55 + 58, 13, C.dim);
  }

  function frame(now) {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    if (scene === 'menu') drawMenu();
    else { drawBoard(); drawHud(now); }
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
