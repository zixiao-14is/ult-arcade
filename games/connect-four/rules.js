// Connect 4 rules. No DOM, so it also runs in Node: node -e "require('./rules.js')".
(function (root) {
  const COLS = 7, ROWS = 6, NEED = 4;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  // board: flat array of COLS * ROWS cells, each 'R', 'Y' or ''. Row 0 is the top.
  const newBoard = () => Array(COLS * ROWS).fill('');
  const at = (c, r) => r * COLS + c;

  // the row a disc dropped in column c ends up on, or -1 if the column is full
  function landingRow(b, c) {
    for (let r = ROWS - 1; r >= 0; r--) if (!b[at(c, r)]) return r;
    return -1;
  }

  // Call after a disc lands at (c, r): only lines through that disc can be new.
  // returns null while the game is going, { player: 'R'|'Y', line } on a win, { player: null } on a draw
  function result(b, c, r) {
    const who = b[at(c, r)], line = new Set();
    for (const [dx, dy] of DIRS) {
      const run = [at(c, r)];
      for (const s of [1, -1]) {
        let x = c + dx * s, y = r + dy * s;
        while (x >= 0 && x < COLS && y >= 0 && y < ROWS && b[at(x, y)] === who) {
          run.push(at(x, y));
          x += dx * s; y += dy * s;
        }
      }
      if (run.length >= NEED) run.forEach(i => line.add(i));
    }
    if (line.size) return { player: who, line: [...line] };
    return b.includes('') ? null : { player: null, line: [] };
  }

  root.Connect4 = { COLS, ROWS, newBoard, at, landingRow, result };
  if (typeof module !== 'undefined') module.exports = root.Connect4;
})(typeof window !== 'undefined' ? window : globalThis);
