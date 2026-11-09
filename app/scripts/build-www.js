// Copies the games from the project folder into www/, which is what goes inside the app.
// The project folder stays the one place to edit them; run this (or npm run sync) after any change.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const www = path.resolve(__dirname, '..', 'www');
const FILES = ['index.html', 'launcher.js'];
const SKIP = new Set(['pace.js']);   // Node tools that the games never load

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(www, f));
fs.cpSync(path.join(root, 'games'), path.join(www, 'games'), {
  recursive: true,
  filter: src => !SKIP.has(path.basename(src)),
});
let count = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : count++; })(www);
console.log(`copied ${count} files into www/`);
