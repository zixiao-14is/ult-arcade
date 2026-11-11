# Pulse Terminal

A small browser game launcher dressed up as a terminal. Type a command and the game opens full screen.

**Play it:** https://zixiao-14is.github.io/ult-arcade/ (on an iPhone, open it in Safari, then Share → Add to Home Screen)
**Android app:** download `ULT-Arcade.apk` from the [latest release](https://github.com/zixiao-14is/ult-arcade/releases/latest)

| Game | Command | What it is |
| --- | --- | --- |
| Pulse Runner | `/game-run --pulserunner` | Neon rhythm auto-runner with music generated live in the browser, 7 levels including the near-impossible Asian Mode |
| Snake | `/game-run --snake` | Classic snake with a local top-10 leaderboard |
| Tic-Tac-Toe | `/game-run --tictactoe` | 2 players on one keyboard, or a perfect minimax bot |
| Connect 4 | `/game-run --connect4` | The classic 7×6 board game, 2 players on one keyboard |
| Only Up | `/game-run --onlyup` | Retro climbing game with no checkpoints, about 30 minutes to the top |
| Pebble Solitaire | `/game-run --pebble` | The classic 33-hole cross board puzzle: jump pebbles until one is left |

Plain HTML, CSS and JavaScript. No build step, no dependencies, nothing to install. It runs straight from disk or a USB stick.

On a phone there's no terminal. You get **ULT Arcade** by ULT Games instead: a short pixel-art loading screen, then a low-res screen of game cards to tap, and every game has touch controls. It also comes as an Android app, and it can be added to an iPhone home screen. See [Phones](#phones).

## Quick start

Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari), then type a command from the table above, for example:

```
/game-run --snake
```

Every game also works on its own: open its `index.html` inside `games/` directly.

## File layout

```
.
├── index.html                 The terminal: command parser + GAMES registry, opens games in an <iframe>
├── launcher.js                The phone launcher (ULT Arcade) and its loading screen, shown instead of the terminal on phones
├── manifest.webmanifest       Lets phones add the games to the home screen
├── sw.js                      Offline support for the home-screen version
├── icons/                     App icons (made by app/scripts/make-icons.js)
├── app/                       Android app project (Capacitor), see "Phones"
├── .tools/                    Java, Android SDK and Gradle for building the app; safe to delete
└── games/
    ├── pulse-runner/
    │   ├── index.html         Page that loads the three scripts below
    │   ├── engine.js          Physics + level data (PulseEngine), no DOM, runs headless in Node
    │   ├── bot.js             The bot's solved runs for every level (made by make-bot.js)
    │   ├── game.js            PulseRunner: canvas drawing, input, music, menus, pause, bot
    │   └── make-bot.js        Node tool: solves every level and writes bot.js (not part of the game)
    ├── snake/
    │   ├── index.html
    │   └── snake.js           The whole game + leaderboard
    ├── tic-tac-toe/
    │   ├── index.html         Menu + board markup
    │   ├── style.css
    │   ├── bot.js             Rules + minimax bot, no DOM, runs in Node
    │   └── tictactoe.js       Menus, board, input
    ├── connect-four/
    │   ├── index.html         Page that loads the two scripts below
    │   ├── rules.js           Rules (Connect4), no DOM, runs in Node
    │   └── connect4.js        Canvas drawing, input, menu
    ├── only-up/
    │   ├── index.html         Page that loads the two scripts below
    │   ├── engine.js          Physics + generated level (OnlyUp), no DOM, runs in Node
    │   ├── game.js            Low-res drawing, input, sound, saving
    │   └── pace.js            Node tool, not loaded by the game: checks every jump and estimates climb time
    └── pebble-solitaire/
        ├── index.html         Page that loads the two scripts below
        ├── rules.js           Rules (PebbleSolitaire), no DOM, runs in Node
        └── pebble.js          Canvas drawing, input, menu
```

Each game lives in its own folder with everything it needs (HTML, scripts, styles, any assets). `/game-run` loads that folder's `index.html` into a full-screen `<iframe>` on top of the terminal. When you press **Esc** on a game's main menu, the game sends `postMessage('exit-game')` and the terminal closes the iframe and gives you the prompt back.

## The terminal

Commands start with `/`:

| Command | What it does |
| --- | --- |
| `/help` | List commands |
| `/game-library --all` | List every game |
| `/game-library <search>` | Search game names, descriptions and tags |
| `/game-run --<id>` | Launch a game (aliases work too, e.g. `--pulse`) |
| `/clear` | Clear the screen (also `Ctrl+L`) |

The up and down arrows step through command history.

## Pulse Runner

You're a glowing cube that runs forward on its own. Time your jumps to the beat to get past spikes, blocks and portals, and reach 100%.

### Controls

| Input | Action |
| --- | --- |
| `Space`, `↑`, `W`, click or tap | Jump (hold to keep jumping, or to climb in ship mode) |
| `1`–`7` or click a card | Start a level |
| Arrow keys then `Enter` | Pick a level from the menu |
| `P` (menu) | Toggle practice mode |
| `B` (menu) | Toggle the bot: pick a level and watch it play a perfect run |
| `P` (during a run) | Pause. While paused, drag, scroll the mouse wheel or use `←` `→` (`Shift` = faster, `Home` / `End` = start / finish) to look through the whole level. `P` again to carry on |
| `Esc` | Back to the menu, or back to the terminal from the menu |

### Levels

| # | Name | Difficulty | Speed (tiles/s) | BPM |
| --- | --- | --- | --- | --- |
| 1 | Neon Drift | Easy | 10.4 | 128 |
| 2 | Skyline Steps | Easy | 10.4 | 120 |
| 3 | Static Bloom | Normal | 11.2 | 140 |
| 4 | Pulse Cascade | Normal | 11.2 | 134 |
| 5 | Overclock | Hard | 12 | 156 |
| 6 | Hyperdrive | Hard | 12 | 160 |
| 7 | **Asian Mode** | **Impossible** | 12 | 174 |

### Asian Mode

The special level. Every jump is possible, but only with near-perfect timing, every single time.

- **About 2 minutes long** (1,388 tiles, about 5 times a normal level), with no checkpoints outside practice mode.
- A short normal-gravity warm-up, then it flips upside down for good and **switches every 1.5 seconds** between **running upside down** and **flying upside down** (where holding the button takes you *down*), for 36 rounds.
- **Every run** lands you under a low roof, so you can't just keep holding the button. Let go, then jump a **triple spike with a spike right above it**. Jump a hair early and you hit the spike above, a hair late and you land on the triple. The window is about **21 ms**: just over one frame at 60 fps.
- **Every flight** is a spike-lined tunnel that climbs and comes back down. Every other one has a pinch in the middle only one tile tall.
- The warm-up has its own triples: low ceilings (29 ms) and pairs (triple, one-tile gap, triple).

How do we know it's possible? A solver beats it at 60 fps, pressing or releasing only on frame boundaries, from **all four ways a frame can line up with the 240 Hz physics**. The in-game **BOT** (press `B` in the menu) replays a solved run, so you can watch it finish in one attempt.

How hard is it? Each press's timing window is measured, and the chance of hitting all of them in one run is worked out for a player with a given timing accuracy (plus up to a frame of screen delay):

| Player's timing accuracy | Expected attempts to win once |
| --- | --- |
| ±8 ms (rhythm-game world class) | about 500,000 |
| ±10 ms (elite) | about 100 million |
| ±15 ms (very good) | about 10¹⁴ |
| ±25 ms (most people) | about 10²⁸ (never) |

Practice mode works here too, so you can learn it one round at a time. Its best score is kept separately, and the win screen only says *YOU BEAT ASIAN MODE* for a real run, not a practice or bot one. The bot's runs never count toward your best.

### Objects

- **Spikes**: touch one and you die. Also hang from the ceiling (`hang`) for flipped-gravity sections.
- **Cubes**: 1×1 blocks on the grid. Land on top; hitting a side (or the underside, in normal gravity) kills you.
- **Slabs**: as wide as a cube, half as tall. Can sit on the ground, on cubes, or float in the air.
- **Jump pads** (yellow): launch you higher automatically.
- **Jump orbs** (pink rings): press while touching one for a mid-air jump.
- **Portals**: `FLY` switches to ship mode (hold to rise, release to fall), `RUN` switches back to the cube, and `↕` flips gravity or sets it back to normal.
- **Coyote time**: a jump still works for 80 ms after running off an edge.
- **Practice mode**: drops a checkpoint about every 1.6 seconds, and you respawn at the last one instead of the start. Practice bests are tracked apart from normal bests.

Best percentages are saved in `localStorage` under the keys `pulse:best` and `pulse:bestP`.

### Level design rules

Measured from the physics (jump timing window = how long a player has to press):

| Obstacle | Window at Easy speed |
| --- | --- |
| 1 / 2 / 3 spikes | 324 / 229 / 133 ms |
| 4 spikes | 37 ms (not allowed) |
| Step up ½ / 1 / 1½ / 2 blocks | 423 / 369 / 299 / 207 ms |
| Step up 2½ / 3 blocks | 49 ms / impossible (not allowed) |

So every level follows:

- At most **3 spikes in a row**, everywhere (including under pads and orbs).
- A single jump climbs at most **2 blocks**.
- Ship-mode openings are at least **4 tiles** tall.
- Leave room to land between obstacles before the next jump.

Every level is checked with a solver that may only press or release every 150 ms (roughly human precision) and must beat the level from 5 different timing offsets.

Asian Mode breaks these rules on purpose (see above). It keeps one rule of its own: it must stay beatable at 60 fps whichever way the frames line up with the physics.

### Music

There are no audio files. `Music` builds every track with the Web Audio API: kick, snare and hi-hat from oscillators and filtered noise, a sawtooth bass, a square-wave arpeggio, and a pentatonic melody from a seeded random generator, so each level always plays the same tune. The background grid, rings and player all pulse on the beat.

## Snake

The classic. Eat apples to grow, and don't run into your own tail. There are no walls: go off one edge and you come back in from the opposite edge. Each apple is worth 10 points and makes the snake a little faster.

| Input | Action |
| --- | --- |
| `↑ ↓ ← →` or `W A S D`, or the on-screen arrows on a phone | Steer |
| `Enter` / `Space` | Start, or play again |
| `P` / `Space` | Pause |
| `L` | Leaderboard (from the menu or the game-over screen) |
| `C` twice | Clear the leaderboard (on the leaderboard screen) |
| `Esc` | Back to the menu, or back to the terminal from the menu |

### Leaderboard

The top 10 scores are kept with name, length and score. If a run makes the top 10 you're asked for a name (up to 10 characters). The last name you typed is filled in next time. It's saved in `localStorage` under `snake:leaderboard`, with your best score in `snake:best`, so it's local to that browser.

## Tic-Tac-Toe

Get three in a row. Pick a mode from the menu:

| Key | Mode |
| --- | --- |
| `1` | 2 players: take turns on one keyboard |
| `2` | vs Bot, you are X (you go first) |
| `3` | vs Bot, you are O (the bot goes first) |

| Input | Action |
| --- | --- |
| `1`–`9` or click | Place your mark (squares are numbered left to right, top to bottom) |
| Arrow keys / `W A S D` then `Enter` | Move the highlight and place |
| `Enter` | Next round, once a round is over |
| `R` | Restart the round |
| `Esc` | Back to the menu, or back to the terminal from the menu |

The score (X wins, draws, O wins) is kept until you go back to the menu.

### The bot

`bot.js` uses **minimax**: it tries every possible move, then every reply, all the way to the end of the game, and assumes both sides always pick their best move. A win scores `10 - depth` and a loss `depth - 10`, so it wins as fast as possible and loses as slowly as possible. When several moves are equally good it picks one at random, so games vary.

It's plain brute force, with no alpha-beta pruning and no caching, because tic-tac-toe is tiny. From an empty board there are only 549,945 positions to check, which takes about 50 ms in JavaScript, and every move after that is under a millisecond. The game shows how many positions the bot searched for each move. The bot plays perfectly, so the best you can do is a draw.

To test it in Node:

```bash
node -e "const T=require('./games/tic-tac-toe/bot.js'); console.log(T.bestMove(Array(9).fill(''), 'X'))"
```

## Connect 4

The classic board game for 2 players on one keyboard. Take turns dropping discs into a 7×6 board; the first to get four in a row (across, up or diagonally) wins. If the board fills up, it's a draw. Red goes first in the first round, then the players swap who starts each round.

| Input | Action |
| --- | --- |
| `1`–`7` or click a column | Drop a disc |
| `← →` or `A D` then `Enter`, `Space`, `↓` or `S` | Pick a column and drop |
| `Enter` / `Space` / click | Start, or next round once a round is over |
| `R` | Restart the round |
| `Esc` | Back to the menu, or back to the terminal from the menu |

The score (red wins, draws, yellow wins) is kept until you go back to the menu.

## Only Up

The only point of the game is to go up. There's no menu and no difficulty setting: it loads straight onto the ground and you start climbing a 1,700 m tower of 488 platforms. There are no checkpoints, so a missed jump drops you until something catches you, and you climb that part again.

| Input | Action |
| --- | --- |
| `←` `→` or `A` `D`, or hold the on-screen arrow buttons | Move |
| `Space`, `↑` or `W`, or tap the JUMP button or anywhere else on the screen | Jump (hold to go higher, tap for a short hop) |
| `Esc` or `P` | Pause (`Esc` again goes back to the terminal) |
| `R` twice, while paused | Start again from the ground |
| `M` | Sound on or off |
| `F` | Browser fullscreen on or off |

The game always fills the window. The tower stays the same width on every screen so the jumps don't change, and wider screens show scenery on both sides of it.

| Zone | What's new |
| --- | --- |
| The Yard | Wide crates, to learn the jump |
| Rooftops | Narrower, longer gaps |
| Scaffold | Moving girders |
| The Clouds | More moving platforms, and springs |
| The Ruins | Crumbling stone: it goes 1 second after you land and returns 4 seconds later |
| Frostline | Ice: you keep sliding, so hold the opposite way to stop |
| The Storm | Wind pushes you while you're in the air, changing direction every few seconds |
| Orbit | Low gravity, tiny platforms and the longest jumps |

Your climb is saved exactly where you are about once a second and when you leave, even mid-fall, so closing the game can't undo a fall. It's saved in `localStorage` under `onlyup:save`, with your fastest finish in `onlyup:bestTime`.

### Changing the level

Platforms are one-way, so you jump up through them and land on top. The level is generated from a fixed seed in `engine.js`, so everyone climbs the same tower. `ZONES` sets each zone's size and difficulty, and `LENGTH` scales the whole climb.

After changing them, run:

```bash
node games/only-up/pace.js
```

It tries every jump on the route with the real physics and reports any that are impossible, then plays the whole game with simulated players who misjudge jumps and pause to look. It's a model of a player, not a real person, so treat its times as an estimate. Currently, over 12 runs each:

| Simulated player | Median time | Falls |
| --- | --- | --- |
| Above average | 17 min | 8 |
| Average | 29 min | 29 |
| Below average | over 3 hours (5 of 12 runs didn't finish within the 4 hour limit) | 301 |

Falls are an average per run. The tool also lists each player's hardest jumps. Fix any jump far below the rest, because one jump that's too hard can take up more time than the rest of the climb put together.

## Pebble Solitaire

The classic one-player puzzle, also known as peg solitaire. The 33-hole cross board starts full except for the centre. A pebble jumps straight over a neighbour (up, down, left or right, never diagonally) into the empty hole behind it, and the jumped pebble is removed. The game ends when no jumps are left. Leaving one pebble is a great result, and leaving it in the centre is a perfect game.

| Input | Action |
| --- | --- |
| Click or tap a pebble, then where it lands, or drag it there | Jump |
| Arrow keys / `W A S D` then `Enter` / `Space` | Move the highlight, pick a pebble, then pick where it lands |
| `U` or the UNDO button | Take back a jump, as many as you like |
| `R` or the RESTART button | Start again |
| `Esc` or the MENU button | Put the pebble down, or back to the menu (your game is kept). `Esc` on the menu goes back to the terminal |

Your best result is saved in `localStorage` under `pebble:best`.

## How it's built

### Pulse Runner engine

`PulseEngine` (in `games/pulse-runner/engine.js`) exposes:

- `PHYS`: physics constants (gravity, jump speed, pad and orb strength, ship acceleration and top speed, ceiling height, coyote time)
- `LEVELS`: the seven levels
- `newState()` / `cloneState(s)`: create or copy a player state (`cloneState` is used for practice checkpoints)
- `step(state, level, dt, held, pressed)`: advance the simulation by one tick
- `builder()` / `level(...)`: the level-building helpers below, so tools can build test levels

The game calls `step` at a fixed 240 Hz, separate from the render frame rate, so physics behaves the same on any display. `level()` sorts a level's objects by `x`, and `step` only looks at the ones near the player, so a long level like Asian Mode costs no more per tick than a short one.

### Making levels

Levels are written in code with a small builder. Units are tiles; `x` is distance along the track and `y` is height above the floor.

```js
const L = builder();
L.spike(16);              // one spike
L.spikes(26, 3);          // three spikes in a row (max 3)
L.block(36, 0, 3, 1);     // cubes at x=36, y=0, 3 wide, 1 tall
L.slabs(50, 2, 1.5);      // 2 slabs side by side, floating at y=1.5
L.pad(90);                // jump pad
L.orb(104.5, 2.6);        // jump orb
L.hang(228, 2);           // spikes hanging from the ceiling
L.portal(116, 'ship');    // 'ship' | 'cube' | 'flip' | 'norm'
```

Wrap it with `level(name, diff, speed, end, L, color, color2, bg, music)` and add it to the `LEVELS` array. The menu and best scores pick up new levels automatically, and the menu centres a short last row of cards.

Asian Mode (`asianMode()` in `engine.js`) is built a different way: from pieces (`pair`, `low`, `turn`, and `round` for one 1.5 s run plus 1.5 s flight) placed one after another by a cursor. Everything is built in the coordinates of the side you stand on, so it's mirrored automatically while gravity is flipped. `ROUND_JUMP`, `ROUND_PEAK`, `ROUND_GAP` and `ROUND_PINCH` tune the rounds. A level with the difficulty name `IMPOSSIBLE` gets the throbbing red card in the menu.

### The bot

`games/pulse-runner/make-bot.js` is a Node tool (it isn't loaded by the game or copied into the app). It solves every level with a beam search at 60 fps and writes the button presses to `bot.js`, which the in-game bot replays tick for tick. **After changing any level, run it again** (about 20 seconds), or the bot will crash into the changed part:

```
node games/pulse-runner/make-bot.js
```

## Adding a new game

1. Make a folder for it, for example `games/my-game/`, with an `index.html` and whatever scripts, styles and assets it needs. Use relative paths inside the folder.
2. To let **Esc** return to the terminal, send this from the game (usually on its main menu):
   ```js
   if (window.parent !== window) window.parent.postMessage('exit-game', '*');
   ```
3. Register it in the `GAMES` array at the top of the script in `index.html`:
   ```js
   { id: 'mygame', alias: ['my-game'], name: 'My Game', file: 'games/my-game/index.html',
     tags: 'puzzle casual', desc: 'One-line description shown in /game-library.' },
   ```

It can then be launched with `/game-run --mygame`.

For phones, also:

4. Add touch controls, and since phones have no Esc key, handle it the same way: the back button sends the game an `Escape` keydown.
5. Give it a card picture in `CARDS` in `launcher.js` (24×24 pixels drawn with rectangles). Without one, the card shows just the name.
6. Add its files to `FILES` in `sw.js` and change `VERSION`, so the home-screen version works offline.
7. Rebuild the Android app (see [Phones](#phones)).

## Phones

When the page opens on a phone (a touch screen under 820 px on its short side), or inside the Android app, `index.html` shows the ULT Arcade launcher instead of the terminal: a "ULT ARCADE, BY ULT GAMES" loading screen for about 2 seconds, then the game cards. Tap a game to play it. To see it on a computer, add `?phone` to the address, for example `index.html?phone`.

Phones have no Esc key, so a back button sits in the top-left corner while a game is open. It does whatever Esc does in that game: pause, go back to the game's menu, or go back to the launcher. The phone's own back gesture does the same.

| Game | Touch controls |
| --- | --- |
| Pulse Runner | Tap to jump, hold to fly. Tap a level card to play |
| Snake | Arrow pad under the field (up, down, left, right). Tap the field to pause. Tap the bottom of the menu for the leaderboard |
| Tic-Tac-Toe | Tap a square. Tap anywhere for the next round |
| Connect 4 | Tap a column |
| Only Up | Hold the `<` `>` buttons at the bottom left to move (you can slide between them). Tap JUMP, or anywhere else on the screen, to jump. In the Android app, with the phone turned sideways, the phone's volume buttons also walk: hold the one nearer your left hand to go left and the other to go right (it follows which way you turned the phone). They only do this while you are climbing; when paused, upright, or outside Only Up they change the volume as usual. Web pages and iPhones never receive the volume buttons, so this is Android-app only. The view sits above the buttons so they never cover you. The pause screen has tap-to-restart and sound buttons |
| Pebble Solitaire | Tap a pebble then where it lands, or drag it |

On a tall phone screen, Snake's field turns upright (18×24 instead of 24×18) and Pulse Runner shows at least 16 tiles ahead.

### Android app

`app/` wraps the games in an Android app with [Capacitor](https://capacitorjs.com). The finished file is `app/dist/ULT-Arcade.apk`. Copy it to an Android phone and open it to install. The phone will ask you to allow installing apps from that source. The app runs offline, full screen, with the phone's status bar hidden.

To rebuild it after changing a game:

```bash
cd app
npm run apk
```

That copies the games into `app/www` and builds with the Java, Android SDK and Gradle in `.tools/`, without changing anything else on the computer. It's a debug build, signed with a development key: fine for installing on your own phones, but the Google Play Store needs a release build signed with your own key. The app is called ULT Arcade (package `com.ultgames.arcade`), set in `app/capacitor.config.json`. `npm run sync` copies the games in without building, and `node scripts/make-icons.js` redraws the app icon and start-up screen.

### iPhone

Apple only allows iPhone apps to be built on a Mac with Xcode, so there's no iPhone app file. Instead, the games are an installable web app:

1. Put this folder on any website with HTTPS. Static hosts such as GitHub Pages, Netlify or Cloudflare Pages work, and no server code is needed.
2. On the iPhone, open the site in Safari, tap Share, then **Add to Home Screen**.

It then opens from the home screen full screen with the ULT Arcade icon, and works offline after the first visit. The same works on Android from Chrome's menu.
