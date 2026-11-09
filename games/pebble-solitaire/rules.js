// Pebble Solitaire rules on the 33-hole cross board. No DOM, so it also runs in Node: node -e "require('./rules.js')".
(function (root) {
  const SIZE = 7, CENTRE = 24;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const at = (c, r) => r * SIZE + c;
  const isHole = (c, r) => c >= 0 && c < SIZE && r >= 0 && r < SIZE && ((c >= 2 && c <= 4) || (r >= 2 && r <= 4));

  // board: flat array of SIZE * SIZE cells, 1 for a pebble, 0 for an empty hole or the corners with no hole
  function newBoard() {
    const b = Array(SIZE * SIZE).fill(0);
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (isHole(c, r)) b[at(c, r)] = 1;
    b[CENTRE] = 0;
    return b;
  }

  // every jump the pebble at index i can make: over a neighbour, into the empty hole straight behind it
  function jumpsFrom(b, i) {
    if (!b[i]) return [];
    const c = i % SIZE, r = Math.floor(i / SIZE), out = [];
    for (const [dx, dy] of DIRS) {
      if (!isHole(c + dx * 2, r + dy * 2)) continue;
      const over = at(c + dx, r + dy), to = at(c + dx * 2, r + dy * 2);
      if (b[over] && !b[to]) out.push({ from: i, over, to });
    }
    return out;
  }

  function play(b, m) { b[m.from] = 0; b[m.over] = 0; b[m.to] = 1; }
  function unplay(b, m) { b[m.from] = 1; b[m.over] = 1; b[m.to] = 0; }

  // returns null while a jump is left, otherwise { left, perfect }: perfect is one pebble left, in the centre
  function result(b) {
    let left = 0;
    for (let i = 0; i < b.length; i++) {
      if (!b[i]) continue;
      if (jumpsFrom(b, i).length) return null;
      left++;
    }
    return { left, perfect: left === 1 && !!b[CENTRE] };
  }

  root.PebbleSolitaire = { SIZE, CENTRE, at, isHole, newBoard, jumpsFrom, play, unplay, result };
  if (typeof module !== 'undefined') module.exports = root.PebbleSolitaire;
})(typeof window !== 'undefined' ? window : globalThis);
