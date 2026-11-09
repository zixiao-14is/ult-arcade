// Tic-Tac-Toe rules + minimax bot. No DOM, so it also runs in Node: node -e "require('./bot.js')".
//
// Plain brute force is plenty here: the whole game tree from an empty board is only ~550k positions,
// so a full minimax search takes a few milliseconds and the bot plays perfectly (it can't be beaten).
(function (root) {
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  // board: array of 9 cells, each 'X', 'O' or ''.
  // returns null while the game is going, { player: 'X'|'O', line } on a win, { player: null } on a draw
  function winner(b) {
    for (const line of LINES) {
      const [a, c, d] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line };
    }
    return b.includes('') ? null : { player: null, line: [] };
  }

  // Minimax: try every move, assume the opponent always answers with their best move.
  // Wins score 10 - depth so the bot wins as fast as it can and loses as slowly as it can.
  function bestMove(board, me) {
    const b = board.slice(), them = me === 'X' ? 'O' : 'X';
    let nodes = 0;
    function search(turn, depth) {
      nodes++;
      const w = winner(b);
      if (w) return w.player === me ? 10 - depth : w.player ? depth - 10 : 0;
      let best = turn === me ? -Infinity : Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i]) continue;
        b[i] = turn;
        const s = search(turn === me ? them : me, depth + 1);
        b[i] = '';
        best = turn === me ? Math.max(best, s) : Math.min(best, s);
      }
      return best;
    }
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    let bestScore = -Infinity, ties = [];
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = me;
      const s = search(them, 1);
      b[i] = '';
      if (s > bestScore) { bestScore = s; ties = [i]; } else if (s === bestScore) ties.push(i);
    }
    const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    // several moves are often equally good; pick one at random so games don't all look the same
    const move = ties.length ? ties[Math.floor(Math.random() * ties.length)] : -1;
    return { move, score: bestScore, nodes, ms };
  }

  root.TicTacToe = { LINES, winner, bestMove };
  if (typeof module !== 'undefined') module.exports = root.TicTacToe;
})(typeof window !== 'undefined' ? window : globalThis);
