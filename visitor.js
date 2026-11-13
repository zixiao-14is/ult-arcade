// Visitor numbers and stats for ULT Arcade.
// The first time a browser (or the Android app) opens the arcade, the server gives it the next visitor number, and
// that number is shown faintly in the bottom-right corner of the screen from then on, also inside the games.
// The arcade then sends that visitor's game stats (best scores, attempts, time played per game) to the server,
// where the admin page (/admin) shows them. No name, email or IP address is kept: just the number and the stats.
(function (root) {
  const API = root.Capacitor ? 'https://ult-arcade.vercel.app' : '';   // the Android app talks to the website
  const ONLINE = !!root.Capacitor || location.protocol.startsWith('http');
  const get = k => { try { const v = localStorage.getItem(k); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let me = get('ult:visitor') || null;   // { id, token }: token proves to the server which number is ours
  let mark = null, open = null, lastSent = 0;

  function watermark() {
    if (!me || !me.id) return;
    if (!mark) {
      mark = document.createElement('div');
      mark.setAttribute('aria-hidden', 'true');
      mark.style.cssText = 'position:fixed;z-index:30;pointer-events:none;right:calc(6px + env(safe-area-inset-right));' +
        'bottom:calc(5px + env(safe-area-inset-bottom));font:bold 11px/1 Consolas,Menlo,monospace;letter-spacing:1px;' +
        'color:rgba(255,255,255,.32);text-shadow:0 1px 0 rgba(0,0,0,.8)';
      document.body.appendChild(mark);
    }
    mark.textContent = 'ULT #' + String(me.id).padStart(6, '0');
  }

  // every game's numbers this device has, read from what the games already save
  function collect() {
    return {
      device: root.Capacitor ? 'android app' : matchMedia('(pointer: coarse)').matches ? 'phone/tablet' : 'computer',
      play: get('ult:play') || {},   // per game: how often opened and seconds played
      pulse: { best: get('pulse:best') || [], practice: get('pulse:bestP') || [], tries: get('pulse:tries') || [] },
      snake: { best: get('snake:best') || 0, leaderboard: (get('snake:leaderboard') || []).slice(0, 10) },
      onlyup: { bestTime: get('onlyup:bestTime') || 0, climbing: !!get('onlyup:save') },
      pebble: { best: get('pebble:best') || null },
      cheats: get('ult:cheats') || null,
    };
  }

  function post(path, data, beacon) {
    const body = JSON.stringify(data);
    // sent as plain text, so the Android app's request needs no extra permission round trip
    if (beacon && navigator.sendBeacon) return navigator.sendBeacon(API + path, new Blob([body], { type: 'text/plain' }));
    return fetch(API + path, { method: 'POST', headers: { 'content-type': 'text/plain' }, body, keepalive: true })
      .then(r => r.ok ? r.json() : null).catch(() => null);
  }
  function send(force, beacon) {
    if (!ONLINE || !me || !me.token) return;
    const now = Date.now();
    if (!force && now - lastSent < 20000) return;
    lastSent = now;
    post('/api/stats', { token: me.token, stats: collect() }, beacon);
  }

  // time played: counted while a game is open
  function addTime() {
    if (!open) return;
    const play = get('ult:play') || {}, p = play[open.id] || (play[open.id] = { opens: 0, seconds: 0 });
    const now = Date.now();
    p.seconds = Math.round(p.seconds + (now - open.since) / 1000);
    open.since = now;
    set('ult:play', play);
  }
  function opened(id) {
    const play = get('ult:play') || {}, p = play[id] || (play[id] = { opens: 0, seconds: 0 });
    p.opens++;
    set('ult:play', play);
    open = { id, since: Date.now() };
  }
  function closed() { addTime(); open = null; send(true); }

  async function start() {
    watermark();
    if (!ONLINE) return;
    const r = await post('/api/visit', { token: me && me.token, device: collect().device });
    if (r && r.id && r.token) { me = { id: r.id, token: r.token }; set('ult:visitor', me); watermark(); send(true); }
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { addTime(); send(true, true); } });
    setInterval(() => { if (open) { addTime(); send(false); } }, 60000);
  }

  root.Visitor = { start, opened, closed };
})(window);
