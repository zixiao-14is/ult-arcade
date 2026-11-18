// FPS counter for ULT Arcade, computers only (not phones, tablets or the Android app).
// It sits faintly in the top-right corner of the arcade and stays on top of every game, like the visitor number.
// Games run in a same-page iframe, which shares this page's frames, so counting this page's frames counts the game's.
// It updates twice a second: frames drawn in the last half second, turned into frames per second.
// F3 shows or hides it, on the arcade and inside any game; the choice is remembered under ult:fps.
(function (root) {
  const KEY = 'F3';
  const get = () => { try { return localStorage.getItem('ult:fps') !== 'off'; } catch { return true; } };
  const save = on => { try { localStorage.setItem('ult:fps', on ? 'on' : 'off'); } catch {} };

  function start(frame) {
    if (root.Capacitor || matchMedia('(pointer: coarse)').matches) return;   // PC only
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;z-index:30;pointer-events:none;right:calc(8px + env(safe-area-inset-right));' +
      'top:calc(8px + env(safe-area-inset-top));font:bold 13px/1 Consolas,Menlo,monospace;letter-spacing:1px;' +
      'padding:4px 7px;border-radius:5px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18);' +
      'color:rgba(255,255,255,.62);text-shadow:0 1px 0 rgba(0,0,0,.8)';
    document.body.appendChild(el);

    let on = false, frames = 0, since = 0, raf = 0;
    function tick(now) {
      frames++;
      const dt = now - since;
      if (dt >= 500) {
        el.textContent = Math.round(frames * 1000 / dt) + ' FPS';
        frames = 0; since = now;
      }
      raf = requestAnimationFrame(tick);
    }
    function restart() { frames = 0; since = performance.now(); }
    function show(v) {
      on = v;
      el.style.display = on ? '' : 'none';
      cancelAnimationFrame(raf);
      if (on) { el.textContent = '-- FPS'; restart(); raf = requestAnimationFrame(tick); }   // hidden: counts nothing
    }
    show(get());
    // a hidden tab draws no frames: start counting afresh when it comes back, so the first number isn't a low one
    addEventListener('visibilitychange', restart);

    // F3 toggles. Keys pressed in a game go to the game's page, not this one, so listen there too (on every load).
    // Capture phase, so a game can't swallow it first; preventDefault stops the browser's own F3 (find).
    function onKey(e) {
      if (e.key !== KEY || e.repeat) return;
      e.preventDefault();
      show(!on); save(on);
    }
    addEventListener('keydown', onKey, true);
    if (frame) frame.addEventListener('load', () => {
      try { frame.contentWindow.addEventListener('keydown', onKey, true); } catch {}   // file:// pages can't be reached
    });
  }

  root.FpsCounter = { start };
})(window);
