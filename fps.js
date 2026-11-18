// FPS counter for ULT Arcade, computers only (not phones, tablets or the Android app).
// It sits faintly in the top-right corner of the arcade and stays on top of every game, like the visitor number.
// Games run in a same-page iframe, which shares this page's frames, so counting this page's frames counts the game's.
// It updates twice a second: frames drawn in the last half second, turned into frames per second.
(function (root) {
  function start() {
    if (root.Capacitor || matchMedia('(pointer: coarse)').matches) return;   // PC only
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;z-index:30;pointer-events:none;right:calc(8px + env(safe-area-inset-right));' +
      'top:calc(8px + env(safe-area-inset-top));font:bold 13px/1 Consolas,Menlo,monospace;letter-spacing:1px;' +
      'padding:4px 7px;border-radius:5px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18);' +
      'color:rgba(255,255,255,.62);text-shadow:0 1px 0 rgba(0,0,0,.8)';
    el.textContent = '-- FPS';
    document.body.appendChild(el);

    let frames = 0, since = performance.now();
    function tick(now) {
      frames++;
      const dt = now - since;
      if (dt >= 500) {
        el.textContent = Math.round(frames * 1000 / dt) + ' FPS';
        frames = 0; since = now;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // a hidden tab draws no frames: start counting afresh when it comes back, so the first number isn't a low one
    addEventListener('visibilitychange', () => { frames = 0; since = performance.now(); });
  }

  root.FpsCounter = { start };
})(window);
