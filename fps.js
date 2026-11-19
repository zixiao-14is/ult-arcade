// Frame rate on computers (not phones, tablets or the Android app): the FPS counter and the settings panel.
//
// FPS counter: sits faintly in the top-right corner of the arcade and stays on top of every game, like the visitor
// number. Games run in a same-page iframe, which shares this page's frames, so counting this page's frames counts the
// game's. It updates twice a second: frames drawn in the last half second, turned into frames per second.
// F3 shows or hides it, on the arcade and inside any game; the choice is remembered under ult:fps.
//
// Settings (the gear button at the top left of the arcade): the FPS counter, and the frame rate.
//   Screen (default): games draw once per screen refresh, as browsers normally do (60 Hz screen = 60 FPS).
//   Uncapped: each game's requestAnimationFrame is swapped for one that runs again as soon as the last frame is done,
//   so games draw as many frames as the computer can. The screen still only shows its refresh rate, but each picture
//   it shows is the newest one drawn, so what you see is a little more recent. Costs one CPU core while a game runs.
//   Remembered under ult:uncap; it applies to the next game opened.
(function (root) {
  const KEY = 'F3';
  const load = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v === 'on'; } catch { return def; } };
  const save = (k, on) => { try { localStorage.setItem(k, on ? 'on' : 'off'); } catch {} };

  function start(frame) {
    if (root.Capacitor || matchMedia('(pointer: coarse)').matches) return;   // PC only
    const box = 'font:bold 13px/1 Consolas,Menlo,monospace;letter-spacing:1px;border-radius:5px;' +
      'background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.62);text-shadow:0 1px 0 rgba(0,0,0,.8)';
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;z-index:30;pointer-events:none;right:calc(8px + env(safe-area-inset-right));' +
      'top:calc(8px + env(safe-area-inset-top));padding:4px 7px;' + box;
    document.body.appendChild(el);

    // ---------- the counter ----------
    let on = false, frames = 0, gameFrames = 0, since = 0, raf = 0;
    function tick(now) {
      frames++;
      const dt = now - since;
      if (dt >= 500) {
        const n = gameFrames || frames;   // uncapped: the game's own frames, which aren't tied to this page's
        el.textContent = Math.round(n * 1000 / dt) + ' FPS';
        frames = 0; gameFrames = 0; since = now;
      }
      raf = requestAnimationFrame(tick);
    }
    function restart() { frames = 0; gameFrames = 0; since = performance.now(); }
    function show(v) {
      on = v;
      el.style.display = on ? '' : 'none';
      cancelAnimationFrame(raf);
      if (on) { el.textContent = '-- FPS'; restart(); raf = requestAnimationFrame(tick); }   // hidden: counts nothing
      refresh();
    }
    // a hidden tab draws no frames: start counting afresh when it comes back, so the first number isn't a low one
    addEventListener('visibilitychange', restart);

    // ---------- uncapped frame rate ----------
    let uncapped = load('ult:uncap', false);
    const FIRST = 1e9;   // our frame numbers start here, so they never mix with the browser's own
    function uncap(win) {
      // frame.contentWindow stays the same object when the iframe loads another page, so the game is told apart by
      // its document: once that's gone (game closed), its loop stops instead of running on unseen
      const doc = win.document, perf = win.performance, log = win.console;
      const nativeRaf = win.requestAnimationFrame.bind(win), nativeCancel = win.cancelAnimationFrame.bind(win);
      const ch = new MessageChannel();   // a message runs as soon as possible, unlike setTimeout's 4 ms minimum
      let queue = new Map(), id = FIRST, waiting = false;
      function run() {
        waiting = false;
        if (frame.contentDocument !== doc) { queue.clear(); return; }   // that game was closed
        const q = queue; queue = new Map();
        if (!q.size) return;
        const now = perf.now();   // the game's own clock: an iframe's starts when the game loaded
        gameFrames++;
        for (const cb of q.values()) { try { cb(now); } catch (e) { log.error(e); } }
      }
      ch.port1.onmessage = run;
      function wake() {
        if (waiting) return;
        waiting = true;
        if (doc.hidden) nativeRaf(run);   // a hidden tab pauses, as normal, instead of burning the CPU
        else ch.port2.postMessage(0);
      }
      win.requestAnimationFrame = cb => { queue.set(++id, cb); wake(); return id; };
      win.cancelAnimationFrame = n => { if (n > FIRST) queue.delete(n); else nativeCancel(n); };
    }

    // F3 toggles the counter. Keys pressed in a game go to the game's page, not this one, so listen there too (on
    // every load). Capture phase, so a game can't swallow it first; preventDefault stops the browser's own F3 (find).
    function onKey(e) {
      if (e.key !== KEY || e.repeat) return;
      e.preventDefault();
      show(!on); save('ult:fps', on);
    }
    addEventListener('keydown', onKey, true);
    if (frame) frame.addEventListener('load', () => {
      try {
        const w = frame.contentWindow;
        w.addEventListener('keydown', onKey, true);
        // the game's first frame was asked for while it loaded; every one after that goes through ours
        if (uncapped && w.location.href !== 'about:blank') uncap(w);
      } catch {}   // file:// pages can't be reached
    });

    // ---------- settings panel ----------
    const css = document.createElement('style');
    css.textContent = `
      .ult-gear{position:fixed;z-index:20;left:calc(6px + env(safe-area-inset-left));top:calc(6px + env(safe-area-inset-top));
        width:34px;height:34px;padding:0;border:2px solid rgba(255,255,255,.35);background:rgba(0,0,0,.5);cursor:pointer}
      .ult-gear:hover,.ult-gear:focus-visible{border-color:#7fd7ff;outline:none}
      .ult-set{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(5,5,15,.72)}
      .ult-set.open{display:flex}
      .ult-set .box{width:min(440px,calc(100vw - 32px));box-sizing:border-box;padding:18px 20px 16px;background:#16162c;
        border:2px solid #2e2e58;box-shadow:0 0 0 2px #0b0b1a;font:14px/1.45 Consolas,Menlo,monospace;color:#e6e6e6}
      .ult-set h2{margin:0 0 14px;font-size:18px;letter-spacing:3px;color:#7fd7ff}
      .ult-set .row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 6px}
      .ult-set .row small{color:#7a7a9a}
      .ult-set .seg{display:flex}
      .ult-set button.opt{font:bold 13px Consolas,Menlo,monospace;letter-spacing:1px;padding:6px 10px;cursor:pointer;
        background:#0b0b1a;color:#7a7a9a;border:2px solid #2e2e58}
      .ult-set .seg button.opt+button.opt{border-left:0}
      .ult-set button.opt.on{color:#0b0b1a;background:#7fd7ff;border-color:#7fd7ff}
      .ult-set button.opt:focus-visible{outline:2px solid #ffd76a;outline-offset:1px}
      .ult-set p{margin:4px 0 0;color:#7a7a9a;font-size:12px}
      .ult-set .close{display:block;margin:16px 0 0 auto}`;
    document.head.appendChild(css);

    const gear = document.createElement('button');
    gear.className = 'ult-gear';
    gear.title = 'settings'; gear.setAttribute('aria-label', 'settings');
    gear.innerHTML = '<svg viewBox="0 0 9 9" width="20" height="20" shape-rendering="crispEdges" style="display:block;margin:auto">' +
      '<path fill="#fff" d="M3 0h3v1h1v1h1v1h1v3H8v1H7v1H6v1H3V8H2V7H1V6H0V3h1V2h1V1h1zM4 3v1H3v1h1v1h1V5h1V4H5V3z"/></svg>';
    document.body.appendChild(gear);

    const panel = document.createElement('div');
    panel.className = 'ult-set';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'settings');
    panel.innerHTML = `<div class="box">
      <h2>SETTINGS</h2>
      <div class="row"><span>FPS counter <small>(F3)</small></span>
        <span class="seg"><button class="opt" data-fps="1">ON</button><button class="opt" data-fps="0">OFF</button></span></div>
      <div class="row"><span>Frame rate</span>
        <span class="seg"><button class="opt" data-cap="1">SCREEN</button><button class="opt" data-cap="0">UNCAPPED</button></span></div>
      <p>Screen: games draw once per screen refresh, the normal way.<br>
        Uncapped: games draw as many frames as the computer can. The screen still only shows its refresh rate,
        but each picture is the newest one, so it reacts a little sooner. Uses more power. Starts with the next game you open.</p>
      <button class="opt close">CLOSE</button></div>`;
    document.body.appendChild(panel);

    function refresh() {
      for (const b of panel.querySelectorAll('[data-fps]')) b.classList.toggle('on', (b.dataset.fps === '1') === on);
      for (const b of panel.querySelectorAll('[data-cap]')) b.classList.toggle('on', (b.dataset.cap === '0') === uncapped);
    }
    const isOpen = () => panel.classList.contains('open');
    function openPanel() { refresh(); panel.classList.add('open'); panel.querySelector('.opt.on').focus(); }
    function closePanel() { panel.classList.remove('open'); gear.focus(); }
    gear.addEventListener('click', openPanel);
    panel.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (e.target === panel || (b && b.classList.contains('close'))) return closePanel();
      if (!b) return;
      if (b.dataset.fps) { show(b.dataset.fps === '1'); save('ult:fps', on); }
      if (b.dataset.cap) { uncapped = b.dataset.cap === '0'; save('ult:uncap', uncapped); refresh(); }
    });
    // while it's open, keys belong to it: Esc closes it, and the arcade behind it doesn't see arrows or Enter
    addEventListener('keydown', e => {
      if (!isOpen()) return;
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); closePanel(); }
    }, true);

    show(load('ult:fps', true));
    root.FpsCounter.gameOpen = open => { gear.style.display = open ? 'none' : ''; if (open) panel.classList.remove('open'); };
  }

  root.FpsCounter = { start, gameOpen() {} };
})(window);
