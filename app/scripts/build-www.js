// Copies the games from the project folder into www/, which is what goes inside the app.
// The project folder stays the one place to edit them; run this (or npm run sync) after any change.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const www = path.resolve(__dirname, '..', 'www');
const FILES = ['index.html', 'launcher.js', 'visitor.js'];
const SKIP = new Set(['pace.js', 'make-bot.js']);   // Node tools that the games never load
// Website-only features: left out of the app, together with the line of the page that loads them
const WEB_ONLY = { 'games/tic-tac-toe/online.js': 'games/tic-tac-toe/index.html' };   // Tic-Tac-Toe's online play

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(www, f));
const webOnly = new Set(Object.keys(WEB_ONLY).map(f => path.join(root, f)));
fs.cpSync(path.join(root, 'games'), path.join(www, 'games'), {
  recursive: true,
  filter: src => !SKIP.has(path.basename(src)) && !webOnly.has(src),
});
for (const [file, page] of Object.entries(WEB_ONLY)) {
  const p = path.join(www, page), name = path.basename(file);
  const html = fs.readFileSync(p, 'utf8'), out = html.split('\n').filter(l => !l.includes(`src="${name}"`)).join('\n');
  if (out === html) throw new Error(`${page} has no <script src="${name}"> line to remove`);
  fs.writeFileSync(p, out);
}
let count = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : count++; })(www);
console.log(`copied ${count} files into www/`);
