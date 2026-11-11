// Tic-Tac-Toe: menus, board, input. Rules and the bot live in bot.js (TicTacToe).
(function () {
  const { winner, bestMove } = TicTacToe;
  const $ = id => document.getElementById(id);
  const menu = $('menu'), game = $('game'), boardEl = $('board'), statusEl = $('status'), botinfo = $('botinfo');
  const BOT_DELAY = 380;   // ms, so the bot's reply doesn't feel instant and jarring
  const TOUCH = matchMedia('(pointer: coarse)').matches;   // phones: tap hints, and tap to play the next round

  let mode = null, human = null;   // human: 'X' | 'O' vs the bot, null in 2-player
  let board, turn, over, overAt = 0, cursor = 4, botTimer = 0;
  let score = { X: 0, O: 0, D: 0 };

  const cells = [];
  for (let i = 0; i < 9; i++) {
    const c = document.createElement('button');
    c.className = 'cell';
    c.setAttribute('aria-label', 'square ' + (i + 1));
    c.addEventListener('click', () => { cursor = i; play(i); });
    boardEl.appendChild(c);
    cells.push(c);
  }
  document.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => start(b.dataset.mode)));
  if (TOUCH) {
    $('menuhelp').textContent = 'tap to pick';
    document.querySelector('[data-mode="2p"] small').textContent = 'take turns on one phone';
    document.querySelector('#game .help').textContent = 'tap a square';
  } else if (window.parent !== window) $('menuhelp').textContent += ' · ESC back to the arcade';
  // with no Enter key, tapping anywhere once a round is over starts the next one
  game.addEventListener('click', () => { if (over && performance.now() - overAt > 350) newRound(); });

  const botTurn = () => human && turn !== human && !over;

  function start(m) {
    mode = m;
    human = m === 'botX' ? 'X' : m === 'botO' ? 'O' : null;
    score = { X: 0, O: 0, D: 0 };
    $('lx').textContent = human === 'X' ? 'YOU (X)' : human === 'O' ? 'BOT (X)' : 'X';
    $('lo').textContent = human === 'O' ? 'YOU (O)' : human === 'X' ? 'BOT (O)' : 'O';
    menu.classList.add('hidden');
    game.classList.remove('hidden');
    newRound();
  }
  function toMenu() {
    clearTimeout(botTimer);
    mode = null;
    game.classList.add('hidden');
    menu.classList.remove('hidden');
  }
  function newRound() {
    clearTimeout(botTimer);
    board = Array(9).fill('');
    turn = 'X'; over = false; cursor = 4;
    botinfo.textContent = '';
    render();
    if (botTurn()) botTimer = setTimeout(botMove, BOT_DELAY);
  }

  function play(i) {
    if (over || board[i] || botTurn()) return;
    place(i);
    if (botTurn()) botTimer = setTimeout(botMove, BOT_DELAY);
  }
  function botMove() {
    if (!botTurn()) return;
    const r = bestMove(board, turn);
    botinfo.textContent = `bot searched ${r.nodes.toLocaleString()} positions in ${r.ms.toFixed(1)} ms`;
    place(r.move);
  }
  function place(i) {
    board[i] = turn;
    const w = winner(board);
    if (w) {
      over = w; overAt = performance.now();
      score[w.player || 'D']++;
    } else turn = turn === 'X' ? 'O' : 'X';
    render();
  }

  function render() {
    cells.forEach((c, i) => {
      c.className = 'cell' + (board[i] ? ' ' + board[i] : '') + (i === cursor && !over && !TOUCH ? ' cursor' : '') +
        (over && over.line.includes(i) ? ' win' : '');
      c.innerHTML = board[i] || `<span class="n">${i + 1}</span>`;
      c.disabled = !!over || !!board[i];
    });
    if (over) {
      const who = over.player;
      statusEl.textContent = !who ? "IT'S A DRAW" : human ? (who === human ? 'YOU WIN!' : 'THE BOT WINS') : `${who} WINS!`;
      statusEl.style.color = !who ? 'var(--gold)' : `var(--${who.toLowerCase()})`;
      statusEl.textContent += TOUCH ? '  ·  TAP to play again' : '  ·  ENTER to play again';
    } else {
      statusEl.textContent = human ? (turn === human ? `YOUR TURN (${turn})` : 'BOT IS THINKING...') : `${turn} TO MOVE`;
      statusEl.style.color = `var(--${turn.toLowerCase()})`;
    }
    $('sx').textContent = score.X; $('so').textContent = score.O; $('sd').textContent = score.D;
  }

  addEventListener('keydown', e => {
    if (mode === null) {
      if (e.key === '1') start('2p');
      else if (e.key === '2') start('botX');
      else if (e.key === '3') start('botO');
      else if (e.key === 'Escape' && window.parent !== window) window.parent.postMessage('exit-game', '*');
      return;
    }
    const k = e.key;
    if (k === 'Escape') return toMenu();
    if (k === 'r' || k === 'R') return newRound();
    if (over) { if (k === 'Enter' || k === ' ') { e.preventDefault(); newRound(); } return; }
    if (/^[1-9]$/.test(k)) { cursor = +k - 1; return play(cursor); }
    const moves = { ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1, w: -3, s: 3, a: -1, d: 1 };
    if (k in moves) {
      e.preventDefault();
      const d = moves[k], col = cursor % 3;
      if ((d === -1 && col > 0) || (d === 1 && col < 2) || (Math.abs(d) === 3 && cursor + d >= 0 && cursor + d < 9)) cursor += d;
      render();
    } else if (k === 'Enter' || k === ' ') { e.preventDefault(); play(cursor); }
  });
})();
