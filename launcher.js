// ULT Arcade, the launcher on every device: a loading screen, then a low-res pixel-art grid of games.
// Tap or click a game; on a computer the arrow keys + Enter (or the number keys) work too.
// Phones have no Esc key, so the back button (and the phone's own back gesture) sends Esc to the open game,
// and each game does what Esc does there: pause, back to its menu, or back here.
(function (root) {
  const FONT = {
    A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227', J: '11152',
    K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222',
    U: '55557', V: '55522', W: '55775', X: '55255', Y: '55222', Z: '71247', 0: '75557', 1: '26227', 2: '61247', 3: '61216',
    4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757', 9: '75711', '.': '00002', '-': '00700', '!': '22202',
  };
  const C = { bg: '#0b0b1a', star: '#3a3a6a', card: '#16162c', edge: '#2e2e58', hi: '#44447a', text: '#e6e6e6', dim: '#7a7a9a', gold: '#ffd76a' };
  // each game's card: accent colour and a little picture drawn with rectangles
  const CARDS = {
    pulserunner: { color: '#7fd7ff', draw: (p, x, y) => {
      p('#2c2c58', x, y + 18, 24, 2);
      p('#7fd7ff', x + 3, y + 10, 8, 8); p('#0b0b1a', x + 5, y + 12, 2, 2); p('#0b0b1a', x + 8, y + 12, 2, 2);
      for (let i = 0; i < 4; i++) p('#ff7bd6', x + 15 + i, y + 17 - i * 2, 7 - i * 2, 1 + i * 2 > 0 ? 1 : 1), p('#ff7bd6', x + 18 - i, y + 11 + i * 2, 1 + i * 2, 2);
    } },
    snake: { color: '#9fe89f', draw: (p, x, y) => {
      for (let i = 0; i < 5; i++) p('#9fe89f', x + 1 + i * 4, y + 14, 3, 3);
      for (let i = 1; i < 3; i++) p('#9fe89f', x + 1, y + 14 - i * 4, 3, 3);
      p('#eaffea', x + 17, y + 14, 3, 3);
      p('#ff7b7b', x + 19, y + 5, 4, 4); p('#9fe89f', x + 21, y + 3, 1, 2);
    } },
    tictactoe: { color: '#ff9ad5', draw: (p, x, y) => {
      p('#44447a', x + 7, y + 1, 1, 20); p('#44447a', x + 15, y + 1, 1, 20); p('#44447a', x + 1, y + 7, 22, 1); p('#44447a', x + 1, y + 14, 22, 1);
      for (let i = 0; i < 4; i++) { p('#7fd7ff', x + 2 + i, y + 2 + i, 1, 1); p('#7fd7ff', x + 5 - i, y + 2 + i, 1, 1); }
      p('#ff9ad5', x + 17, y + 9, 4, 1); p('#ff9ad5', x + 17, y + 12, 4, 1); p('#ff9ad5', x + 16, y + 10, 1, 2); p('#ff9ad5', x + 21, y + 10, 1, 2);
      for (let i = 0; i < 4; i++) { p('#7fd7ff', x + 9 + i, y + 16 + i, 1, 1); p('#7fd7ff', x + 12 - i, y + 16 + i, 1, 1); }
    } },
    connect4: { color: '#ffd76a', draw: (p, x, y) => {
      p('#1c3f9e', x, y + 2, 24, 20);
      const disc = ['....', '.Y..', 'RY.R', 'RRYY'];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const k = disc[r][c];
        p(k === 'R' ? '#ff7b7b' : k === 'Y' ? '#ffd76a' : '#0b0b1a', x + 2 + c * 6, y + 4 + r * 5, 4, 3);
      }
    } },
    onlyup: { color: '#f4a868', draw: (p, x, y) => {
      p('#a8703c', x + 1, y + 20, 10, 2); p('#a84030', x + 13, y + 13, 10, 2); p('#5c6878', x + 3, y + 5, 9, 2);
      p('#d82800', x + 16, y + 3, 4, 2); p('#fcbc94', x + 16, y + 5, 4, 2); p('#d82800', x + 15, y + 7, 6, 3); p('#2038b0', x + 16, y + 10, 4, 3);
    } },
    pebble: { color: '#e6e6e6', draw: (p, x, y) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        if (!((c >= 2 && c <= 4) || (r >= 2 && r <= 4))) continue;
        p(r === 3 && c === 3 ? '#2a2a2a' : '#e6e6e6', x + 1 + c * 3, y + 1 + r * 3, 2, 2);
      }
    } },
  };

  let cv, g, games, open, close, frame, backBtn;
  let VW = 180, VH = 320, scale = 2, cards = [], cols = 2, pressed = -1, gameOpen = false, skipPop = false;
  let sel = -1, hover = -1;   // keyboard choice and the card under the mouse (computers)
  const MOUSE = !matchMedia('(pointer: coarse)').matches;

  function text(s, x, y, color, size = 1, align = 'left') {
    s = String(s).toUpperCase();
    const w = (s.length * 4 - 1) * size;
    if (align === 'center') x -= Math.floor(w / 2);
    x = Math.round(x); y = Math.round(y);   // half-pixel positions would blur every letter
    // a drop shadow only on big text: on 1-pixel letters it fills in the gaps and makes them unreadable
    for (const [ox, col] of size > 1 ? [[1, '#000'], [0, color]] : [[0, color]]) {
      g.fillStyle = col;
      for (let i = 0; i < s.length; i++) {
        const glyph = FONT[s[i]];
        if (!glyph) continue;
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
          if (+glyph[r] & (4 >> c)) g.fillRect(x + ox + (i * 4 + c) * size, y + ox + r * size, size, size);
      }
    }
  }
  const px = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

  function layout() {
    // Low-res on purpose: the whole screen is drawn small and scaled up with hard pixel edges.
    scale = Math.max(2, Math.floor(Math.min(innerWidth / 190, innerHeight / 200)));
    VW = Math.ceil(innerWidth / scale); VH = Math.ceil(innerHeight / scale);
    cv.width = VW; cv.height = VH;
    cv.style.width = VW * scale + 'px'; cv.style.height = VH * scale + 'px';
    cols = VW >= 250 ? 3 : 2;
    const rows = Math.ceil(games.length / cols), gap = 6;
    const top = Math.max(38, Math.floor(VH * 0.16)), bottom = 16;
    const w = Math.min(96, Math.floor((VW - gap * (cols + 1)) / cols));
    const h = Math.max(44, Math.min(84, Math.floor((VH - top - bottom - gap * (rows - 1)) / rows)));
    const x0 = Math.floor((VW - (w * cols + gap * (cols - 1))) / 2);
    const y0 = Math.max(top, Math.floor((VH - (h * rows + gap * (rows - 1))) / 2) + 14);   // centre the grid on tall screens
    cards = games.map((game, i) => ({ game, x: x0 + (i % cols) * (w + gap), y: y0 + Math.floor(i / cols) * (h + gap), w, h }));
  }

  // twinkling stars and faint scanlines behind everything, for the old-screen look
  function backdrop(now) {
    px(C.bg, 0, 0, VW, VH);
    for (let i = 0; i < 40; i++) {
      const sx = (i * 73) % VW, sy = (i * 151) % VH;
      if ((Math.floor(now / 600) + i) % 7) px(C.star, sx, sy, 1, 1);
    }
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < VH; y += 2) g.fillRect(0, y, VW, 1);
  }

  // The loading screen shown once when the app opens, then the game cards fade in.
  const LOAD_MS = 1800, FADE_MS = 320, SEGMENTS = 12;
  let loadStart = 0;
  const loading = now => now - loadStart < LOAD_MS;
  function drawLoading(now) {
    backdrop(now);
    const f = Math.min(1, (now - loadStart) / LOAD_MS);
    const big = Math.max(4, Math.min(10, Math.floor(VW * 0.55 / 11)));   // "ULT" is 11 pixels wide
    let y = Math.floor(VH * 0.3);
    text('ULT', VW / 2 + Math.ceil(big / 2), y + Math.ceil(big / 2), '#7fd7ff', big, 'center');
    text('ULT', VW / 2, y, C.gold, big, 'center');
    y += 5 * big + 10;
    text('ARCADE', VW / 2, y, C.text, 2, 'center');
    text('BY ULT GAMES', VW / 2, y + 16, C.gold, 1, 'center');
    // a chunky bar that fills one block at a time, quickly at first and slower near the end
    const w = Math.min(120, VW - 40), bx = Math.floor((VW - w) / 2), by = Math.floor(VH * 0.68);
    const filled = Math.floor(SEGMENTS * (1 - (1 - f) * (1 - f)) + 0.0001);
    px(C.edge, bx, by, w, 10);
    px(C.bg, bx + 1, by + 1, w - 2, 8);
    const seg = Math.floor((w - 4) / SEGMENTS), sx = bx + 2 + Math.floor((w - 4 - seg * SEGMENTS) / 2);   // whole-pixel blocks, all the same width
    for (let i = 0; i < filled; i++) px(i === filled - 1 ? '#ffffff' : '#7fd7ff', sx + i * seg, by + 2, seg - 1, 6);
    text('LOADING' + '...'.slice(0, Math.floor(now / 300) % 4), bx, by + 15, C.dim, 1);
  }

  function draw(now) {
    if (loading(now)) { drawLoading(now); requestAnimationFrame(draw); return; }
    backdrop(now);
    const titleSize = VW >= 160 ? 3 : 2;
    text('ULT ARCADE', VW / 2, Math.max(8, cards[0].y - 30), '#7fd7ff', titleSize, 'center');
    text(MOUSE ? 'CLICK A GAME' : 'TAP A GAME', VW / 2, cards[0].y - 11, C.dim, 1, 'center');
    const last = cards[cards.length - 1];
    if (MOUSE && last.y + last.h + 14 < VH) text('OR ARROWS AND ENTER', VW / 2, last.y + last.h + 8, C.dim, 1, 'center');
    cards.forEach((c, i) => {
      const meta = CARDS[c.game.id] || { color: C.text, draw() {} };
      const down = i === pressed, lit = i === sel || i === hover;
      px(down || lit ? meta.color : C.edge, c.x, c.y, c.w, c.h);
      px(down ? C.hi : C.card, c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      px(C.hi, c.x + 1, c.y + 1, c.w - 2, 1);
      // the 24x24 picture is drawn at double size when the card has room for it
      const k = c.w >= 64 && c.h >= 70 ? 2 : 1, iconH = 24 * k;
      const ix = Math.floor(c.x + c.w / 2 - 12 * k), iy = c.y + Math.max(3, Math.floor((c.h - iconH - 10) / 2));
      meta.draw((col, x, y, w, h) => px(col, ix + x * k, iy + y * k, w * k, h * k), 0, 0);
      text(c.game.name, c.x + c.w / 2, iy + iconH + 4, meta.color, 1, 'center');
    });
    // fade in from black in four steps, like an old console
    const fade = 1 - (now - loadStart - LOAD_MS) / FADE_MS;
    if (fade > 0) { g.fillStyle = `rgba(0,0,0,${Math.ceil(fade * 4) / 4})`; g.fillRect(0, 0, VW, VH); }
    if (!gameOpen) requestAnimationFrame(draw);
  }

  function cardAt(e) {
    const x = e.clientX / scale, y = e.clientY / scale;
    return cards.findIndex(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
  }

  function launch(i) {
    gameOpen = true; hover = -1; cv.style.cursor = '';
    cv.style.display = 'none';
    backBtn.style.display = 'block';
    window.history.pushState({ game: true }, '');
    open(cards[i].game, () => {
      gameOpen = false;
      backBtn.style.display = 'none';
      cv.style.display = 'block';
      window.focus();   // keys come back to the arcade
      if (window.history.state && window.history.state.game) { skipPop = true; window.history.back(); }
      requestAnimationFrame(draw);
    });
  }

  // Back = Esc inside the game. If the game can't be reached, just close it.
  function back() {
    try {
      const w = frame.contentWindow;
      w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    } catch { close(); }
  }

  function start(opts) {
    ({ games, open, close, frame } = opts);
    cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;image-rendering:pixelated;touch-action:none;user-select:none;z-index:1';
    document.body.appendChild(cv);
    g = cv.getContext('2d');

    backBtn = document.createElement('button');
    backBtn.setAttribute('aria-label', 'back');
    backBtn.style.cssText = 'position:fixed;z-index:20;display:none;left:calc(6px + env(safe-area-inset-left));top:calc(6px + env(safe-area-inset-top));' +
      'width:34px;height:34px;padding:0;border:2px solid rgba(255,255,255,.35);background:rgba(0,0,0,.5);cursor:pointer;touch-action:none';
    backBtn.innerHTML = '<svg viewBox="0 0 7 7" width="18" height="18" shape-rendering="crispEdges" style="display:block;margin:auto">' +
      '<path fill="#fff" d="M3 1h1v1H3zM2 2h1v1H2zM1 3h5v1H1zM2 4h1v1H2zM3 5h1v1H3z"/></svg>';
    backBtn.addEventListener('pointerdown', e => { e.preventDefault(); back(); });
    document.body.appendChild(backBtn);

    addEventListener('popstate', () => {
      if (skipPop) { skipPop = false; return; }
      if (!gameOpen) return;
      back();
      // the game handled it without closing (paused, or went back to its own menu): keep a step to go back to
      setTimeout(() => { if (gameOpen) window.history.pushState({ game: true }, ''); });
    });
    cv.addEventListener('pointerdown', e => { pressed = loading(performance.now()) ? -1 : cardAt(e); });
    cv.addEventListener('pointerup', e => {
      const i = cardAt(e);
      if (i >= 0 && i === pressed) launch(i);
      pressed = -1;
    });
    cv.addEventListener('pointercancel', () => { pressed = -1; });
    cv.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      hover = loading(performance.now()) ? -1 : cardAt(e);
      cv.style.cursor = hover >= 0 ? 'pointer' : '';
      if (hover >= 0) sel = -1;
    });
    cv.addEventListener('pointerleave', () => { hover = -1; });
    // keyboard: arrows move around the grid, Enter / Space opens, 1-9 open a game directly
    addEventListener('keydown', e => {
      const n = cards.length, k = e.key;
      if (gameOpen) { if (k === 'Escape') back(); return; }   // (normally the game itself has the keys)
      if (loading(performance.now())) return;
      const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[k];
      if (move) { e.preventDefault(); sel = sel < 0 ? 0 : Math.max(0, Math.min(n - 1, sel + move)); hover = -1; }
      else if ((k === 'Enter' || k === ' ') && sel >= 0) { e.preventDefault(); launch(sel); }
      else if (/^[1-9]$/.test(k) && +k <= n) launch(+k - 1);
    });
    addEventListener('resize', layout);
    layout();
    loadStart = performance.now();
    requestAnimationFrame(draw);
  }

  root.ArcadeLauncher = { start };
})(window);
