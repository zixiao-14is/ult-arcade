// Lets the games work offline once the site has been opened, so they can be added to a phone's home screen
// and played like an app. Every file is saved on install; after that the saved copy is used straight away
// and quietly refreshed from the network, so updates show up on the next launch.
// When you add a game or a file, list it here and bump VERSION so phones fetch the new set.
const VERSION = 'ult-arcade-7';
const FILES = [
  './', 'index.html', 'launcher.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'games/pulse-runner/index.html', 'games/pulse-runner/engine.js', 'games/pulse-runner/bot.js', 'games/pulse-runner/game.js',
  'games/snake/index.html', 'games/snake/snake.js',
  'games/tic-tac-toe/index.html', 'games/tic-tac-toe/style.css', 'games/tic-tac-toe/bot.js', 'games/tic-tac-toe/tictactoe.js',
  'games/connect-four/index.html', 'games/connect-four/rules.js', 'games/connect-four/connect4.js',
  'games/only-up/index.html', 'games/only-up/engine.js', 'games/only-up/game.js',
  'games/pebble-solitaire/index.html', 'games/pebble-solitaire/rules.js', 'games/pebble-solitaire/pebble.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const saved = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; });
    if (saved) { fresh.catch(() => {}); return saved; }
    return fresh;
  }));
});
