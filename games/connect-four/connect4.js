// Connect 4: canvas drawing, input, menu. Rules live in rules.js (Connect4).
(function () {
  const { COLS, ROWS, newBoard, at, landingRow, result } = Connect4;
  const C = { bg: '#000', board: '#1c3f9e', R: '#ff7b7b', Y: '#ffd76a', text: '#e6e6e6', dim: '#7a7a7a', win: '#fff' };
  const NAME = { R: 'RED', Y: 'YELLOW' };
  const FONT = 'Consolas, "Cascadia Mono", Menlo, "DejaVu Sans Mono", monospace';
  const GRAVITY = 110;   // cells per second squared
  const HOVER_Y = -1.1;  // the row the waiting disc sits on, just above the board
  const TOP = 56, BOTTOM = 72;
  const TOUCH = matchMedia('(pointer: coarse)').matches;   // phones: tap hints instead of keys

  const cv = document.getElementById('cv'), g = cv.getContext('2d');
  let W = 0, H = 0, cell = 40, ox = 0, oy = 0;
  let scene = 'menu', last = 0;
  let board, turn, first, over, falling, lastDrop, cursor = 3;
  let score = { R: 0, Y: 0, D: 0 };

  const other = p => (p === 'R' ? 'Y' : 'R');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // one extra row of height for the disc waiting above the board
    cell = Math.max(12, Math.floor(Math.min((W - 32) / COLS, (H - TOP - BOTTOM) / (ROWS + 1))));
    ox = Math.floor((W - cell * COLS) / 2);
    oy = Math.floor(TOP + cell + (H - TOP - BOTTOM - cell * (ROWS + 1)) / 2);
  }

  // ---------- game flow ----------
  function start() {
    score = { R: 0, Y: 0, D: 0 };
    first = 'R';
    scene = 'play';
    newRound();
  }
  function newRound() {
    board = newBoard();
    turn = first; over = null; falling = null; lastDrop = -1;
  }
  function nextRound() {
    first = other(first);   // going first is a real advantage, so players swap each round
    newRound();
  }
  // New drops wait until the falling disc has landed, so a double click can't play the other player's turn too.
  function drop(c) {
    if (over || falling) return;
    const r = landingRow(board, c);
    if (r >= 0) falling = { c, r, who: turn, y: HOVER_Y, v: 0 };
  }
  function land() {
    const { c, r, who } = falling;
    falling = null;
    board[at(c, r)] = who;
    lastDrop = at(c, r);
    over = result(board, c, r);
    if (over) score[over.player || 'D']++;
    else turn = other(who);
  }

  // ---------- input ----------
  addEventListener('resize', resize);
  addEventListener('keydown', e => {
    const k = e.code;
    const move = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[k];
    if (move || k === 'Space' || k === 'ArrowDown' || k === 'ArrowUp') e.preventDefault();
    if (scene === 'menu') {
      if (e.repeat) return;
      if (k === 'Enter' || k === 'Space') start();
      else if (k === 'Escape' && window.parent !== window) window.parent.postMessage('exit-game', '*');
      return;
    }
    if (move) { cursor = Math.max(0, Math.min(COLS - 1, cursor + move)); return; }
    if (e.repeat) return;   // holding a key must not fill up a column
    if (k === 'Escape') scene = 'menu';
    else if (k === 'KeyR') newRound();
    else if (over) { if (k === 'Enter' || k === 'Space') nextRound(); }
    else if (/^[1-7]$/.test(e.key)) { cursor = +e.key - 1; drop(cursor); }
    else if (k === 'Enter' || k === 'Space' || k === 'ArrowDown' || k === 'KeyS') drop(cursor);
  });
  function columnAt(e) {
    const c = Math.floor((e.clientX - ox) / cell);
    return c >= 0 && c < COLS ? c : -1;
  }
  cv.addEventListener('pointermove', e => { const c = columnAt(e); if (c >= 0) cursor = c; });
  cv.addEventListener('pointerdown', e => {
    if (scene === 'menu') return start();
    if (over) return nextRound();
    const c = columnAt(e);
    if (c >= 0) { cursor = c; drop(c); }
  });

  // ---------- drawing ----------
  function text(s, x, y, size, color, align = 'center', weight = '') {
    g.font = `${weight} ${size}px ${FONT}`;
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(s, x, y);
  }
  function disc(x, y, who, size) {
    g.fillStyle = C[who];
    g.beginPath(); g.arc(x, y, size * 0.42, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = Math.max(1, size * 0.04);
    g.beginPath(); g.arc(x, y, size * 0.29, 0, Math.PI * 2); g.stroke();
  }
  const cx = c => ox + (c + 0.5) * cell;
  const cy = r => oy + (r + 0.5) * cell;

  // Discs are drawn first and the board on top with holes cut in it, so they fall behind the front of the board.
  function drawBoard() {
    if (!over && !falling) {
      const r = landingRow(board, cursor);
      if (r >= 0) {
        disc(cx(cursor), cy(HOVER_Y), turn, cell);
        g.globalAlpha = 0.22;
        disc(cx(cursor), cy(r), turn, cell);
        g.globalAlpha = 1;
      }
    }
    const line = over && over.player ? over.line : null;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = at(c, r);
      if (!board[i]) continue;
      g.globalAlpha = line && !line.includes(i) ? 0.4 : 1;
      disc(cx(c), cy(r), board[i], cell);
    }
    g.globalAlpha = 1;
    if (falling) disc(cx(falling.c), cy(falling.y), falling.who, cell);

    const pad = cell * 0.12, hole = cell * 0.4;
    g.fillStyle = C.board;
    g.beginPath();
    g.roundRect(ox - pad, oy - pad, cell * COLS + pad * 2, cell * ROWS + pad * 2, cell * 0.16);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      g.moveTo(cx(c) + hole, cy(r));
      g.arc(cx(c), cy(r), hole, 0, Math.PI * 2);
    }
    g.fill('evenodd');

    if (line) {
      g.strokeStyle = C.win; g.lineWidth = Math.max(2, cell * 0.07);
      g.shadowColor = C.win; g.shadowBlur = 8 + Math.sin(performance.now() / 180) * 6;
      for (const i of line) {
        g.beginPath(); g.arc(cx(i % COLS), cy(Math.floor(i / COLS)), hole * 0.9, 0, Math.PI * 2); g.stroke();
      }
      g.shadowBlur = 0;
    } else if (lastDrop >= 0 && !over) {
      // a small dot on the last disc, so you can see what the other player just did
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.beginPath(); g.arc(cx(lastDrop % COLS), cy(Math.floor(lastDrop / COLS)), cell * 0.07, 0, Math.PI * 2); g.fill();
    }
  }
  function drawHud() {
    const size = Math.min(20, (W - 16) / 21);
    if (over) {
      const who = over.player;
      text((who ? `${NAME[who]} WINS!` : "IT'S A DRAW") + (TOUCH ? '  ·  TAP to play again' : '  ·  ENTER to play again'), W / 2, TOP / 2, size, who ? C[who] : C.text, 'center', 'bold');
    } else {
      text(`${NAME[turn]} TO MOVE`, W / 2, TOP / 2, size, C[turn], 'center', 'bold');
    }
    const y = H - 50, gap = Math.min(120, W * 0.3);
    text(`RED ${score.R}`, W / 2 - gap, y, 16, C.R, 'center', 'bold');
    text(`DRAW ${score.D}`, W / 2, y, 16, C.dim, 'center', 'bold');
    text(`YELLOW ${score.Y}`, W / 2 + gap, y, 16, C.Y, 'center', 'bold');
    text(TOUCH ? 'tap a column to drop a disc' : '1-7 or click a column · arrows + ENTER · R new round · ESC menu', W / 2, H - 20, Math.min(13, (W - 16) / 35), C.dim);
  }
  function drawMenu() {
    const s = Math.min(1, W / 520), t = performance.now() / 300;
    // same length strings in a monospace font, so the two halves line up as one title
    text('CONNECT  ', W / 2, H * 0.26, 64 * s, C.R, 'center', 'bold');
    text('        4', W / 2, H * 0.26, 64 * s, C.Y, 'center', 'bold');
    text(`get four in a row. 2 players, one ${TOUCH ? 'phone' : 'keyboard'}.`, W / 2, H * 0.26 + 52 * s, Math.min(15, (W - 16) / 24), C.dim);
    const size = Math.min(56, W / 7);
    for (let i = 0; i < 4; i++)
      disc(W / 2 + (i - 1.5) * size, H * 0.5 + Math.sin(t - i * 0.7) * size * 0.14, i % 2 ? 'Y' : 'R', size);
    text(TOUCH ? 'TAP to start' : 'ENTER / SPACE or click  start', W / 2, H * 0.66, 18 * Math.max(s, 0.8), C.text);
    if (window.parent !== window && !TOUCH) text('ESC back to the arcade', W / 2, H * 0.66 + 34, 13, C.dim);
  }

  function frame(now) {
    const dt = (now - last) / 1000; last = now;
    if (scene === 'play' && falling) {
      falling.v += GRAVITY * dt;
      falling.y += falling.v * dt;
      if (falling.y >= falling.r) land();
    }
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    if (scene === 'menu') drawMenu();
    else { drawHud(); drawBoard(); }
    requestAnimationFrame(frame);
  }

  resize();
  last = performance.now();
  requestAnimationFrame(frame);
})();
