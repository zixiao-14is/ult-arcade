// Node tool (not loaded by the game): solves every Pulse Runner level and writes the inputs to bot.js,
// which the in-game BOT replays. Run it after changing a level:   node games/pulse-runner/make-bot.js
//
// It plays at 60 fps like a person would: each frame it may hold or release the button. A beam search keeps up to
// BEAM different player states per frame (merging near-identical ones), so it explores many ways through at once.
const fs = require('fs');
const path = require('path');
require('./engine.js');
const { LEVELS, newState, cloneState, step } = globalThis.PulseEngine;
const DT = 1 / 240, K = 4, BEAM = 1500;   // 4 physics ticks per 60 fps frame

const key = (s, held) => `${Math.round(s.y * 24)}|${Math.round(s.vy * 3)}|${s.mode}|${s.grav}|${s.ground ? 1 : 0}|${s.coyote > 0 ? 1 : 0}|${s.buffer > 0 ? 1 : 0}|${held ? 1 : 0}|${s.used.size}`;

function solve(lv) {
  let layer = [{ s: newState(), held: false, toggles: 0, parent: -1 }];
  const layers = [];
  for (let f = 0; f < 1e5; f++) {
    const next = new Map();
    for (let pi = 0; pi < layer.length; pi++) {
      const n = layer[pi];
      for (const held of [n.held, !n.held]) {
        const s = cloneState(n.s);
        for (let k = 0; k < K && !s.dead && !s.won; k++) step(s, lv, DT, held, held && !n.held && k === 0);
        if (s.dead) continue;
        const c = { s, held, toggles: n.toggles + (held !== n.held), parent: pi };
        if (s.won) { layers.push(layer); return toTicks(layers, c); }
        const id = key(s, held), old = next.get(id);
        if (!old || c.toggles < old.toggles) next.set(id, c);
      }
    }
    if (!next.size) return null;
    layers.push(layer);
    let arr = [...next.values()];
    if (arr.length > BEAM) {   // keep a spread of heights, not just the first ones found
      arr.sort((a, b) => a.s.y - b.s.y || a.s.vy - b.s.vy);
      arr = Array.from({ length: BEAM }, (_, i) => arr[Math.floor(i * arr.length / BEAM)]);
    }
    layer = arr;
  }
  return null;
}
// walk back through the parents: the frames where the button changed, as physics tick numbers
function toTicks(layers, last) {
  const held = [last.held];
  let pi = last.parent;
  for (let f = layers.length - 1; f > 0; f--) { const n = layers[f][pi]; held.push(n.held); pi = n.parent; }
  held.reverse();
  const ticks = []; let prev = false;
  held.forEach((h, f) => { if (h !== prev) { ticks.push(f * K); prev = h; } });
  return ticks;
}
// replay exactly the way the game does
function replay(lv, ticks) {
  const s = newState(); let i = 0, held = false;
  for (let t = 0; t < 1e6 && !s.dead && !s.won; t++) {
    let pressed = false;
    while (i < ticks.length && ticks[i] <= t) { held = i % 2 === 0; if (held) pressed = true; i++; }
    step(s, lv, DT, held, pressed);
  }
  return s.won;
}

const out = {};
for (const lv of LEVELS) {
  const t0 = Date.now();
  const ticks = solve(lv);
  if (!ticks || !replay(lv, ticks)) { console.error(`${lv.name}: NOT SOLVED`); process.exitCode = 1; continue; }
  out[lv.name] = ticks;
  console.log(`${lv.name.padEnd(14)} solved: ${ticks.length / 2 | 0} presses (${Date.now() - t0} ms)`);
}
const file = path.join(__dirname, 'bot.js');
fs.writeFileSync(file,
  '// Made by make-bot.js. For each level: the physics ticks (240 per second) where the bot presses and releases.\n' +
  '// Even entries are presses, odd entries releases. Rerun make-bot.js after changing a level.\n' +
  'const PulseBot = ' + JSON.stringify(out).replace(/\],"/g, '],\n  "').replace('{"', '{\n  "').replace(/\]\}$/, ']\n}') + ';\n');
console.log('wrote', path.relative(process.cwd(), file));
