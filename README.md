# ULT Arcade

A small retro game arcade by ULT Games for the browser, phones and Android: a pixel-art screen of game cards. Tap or click a game and it opens full screen.

**Play it:** https://ult-arcade.vercel.app (on an iPhone, open it in Safari, then Share → Add to Home Screen)
**Android app:** download `ULT-Arcade.apk` from the [latest release](https://github.com/zixiao-14is/ult-arcade/releases/latest)

The website is hosted on **Vercel** and updates by itself about a minute after every push to `main`. The repository is connected to the Vercel project `ult-arcade`. It's a plain static site with no build step (`vercel.json`), and `.vercelignore` keeps `app/`, the Node tools, the README and Vercel's private files off it. To publish by hand: `npx vercel deploy --prod`.

There's also a GitHub Pages copy at https://zixiao-14is.github.io/ult-arcade/, published by `.github/workflows/pages.yml`, but it only updates when GitHub Actions is running for the account.

| Game | What it is |
| --- | --- |
| Pulse Runner | Neon rhythm auto-runner with music generated live in the browser, 7 levels including Asian Mode, 17 minutes that only a bot can beat |
| Snake | Classic snake with a local top-10 leaderboard |
| Tic-Tac-Toe | 2 players on one keyboard, or a perfect minimax bot |
| Connect 4 | The classic 7×6 board game, 2 players on one keyboard |
| Only Up | Retro climbing game with no checkpoints, about 30 minutes to the top |
| Pebble Solitaire | The classic 33-hole cross board puzzle: jump pebbles until one is left |

Plain HTML, CSS and JavaScript. No build step, no dependencies, nothing to install. It runs straight from disk or a USB stick.

Every game has keyboard and touch controls. The arcade also comes as an Android app, and it can be added to an iPhone home screen. See [Phones](#phones).

## Quick start

Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari). After a short "ULT ARCADE" loading screen you get the game cards:

| Input | Action |
| --- | --- |
| Tap or click a card | Play that game |
| `←` `→` `↑` `↓` then `Enter` (or `Space`) | Pick a card with the keyboard |
| `1`–`6` | Open a game directly |
| `Esc` on a game's main menu, or the ← button top left | Back to the arcade |

Every game also works on its own: open its `index.html` inside `games/` directly.

## File layout

```
.
├── index.html                 The arcade page: GAMES list, opens games in an <iframe>
├── launcher.js                The arcade itself (ArcadeLauncher): loading screen, game cards, back button
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

Each game lives in its own folder with everything it needs (HTML, scripts, styles, any assets). Opening a card loads that folder's `index.html` into a full-screen `<iframe>` on top of the arcade. When you press **Esc** on a game's main menu (or the back button), the game sends `postMessage('exit-game')` and the arcade closes the iframe and shows the cards again.

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
| `Esc` | Back to the menu, or back to the arcade from the menu |

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

The special level: possible, but not for a human.

- **17 minutes long** (12,294 tiles, about 45 times a normal level), with no checkpoints outside practice mode.
- **No loop and no warm-up.** A seeded random mix of **running**, **running upside down**, **flying** and **flying upside down** (where holding takes you *down*), switching every 1.5 to 4.5 seconds in an order you can't predict. Every flight starts from the top of a jump.
- **Every column has a spike under you and a spike over you**, hugging one perfect run. The level is built backwards from that run: first the button presses are made up (random waits between jumps, random climbs and dives), then the spikes are placed tight around that path, and around the same path with any *one* press a single physics tick off.
- So **every press has a window of 2 physics ticks: 8.3 ms.** That's the nearest the 240 Hz physics gets to 10 ms without going over. One tick off still works; two ticks off hits a spike. There are **1,452 such presses**, about one every 0.7 s, and 4 of them are tighter still (4.2 ms).
- **The screen blurs every 1.5 seconds** for 0.6 s (8 px). It goes by how far you are, so it always lands on the same spots. It only changes the picture, not the physics.
- **The portals are invisible.** They still work, but nothing is drawn and the pause strip doesn't mark them, so the 290 mode changes come with no warning (48 into flying, 45 back to running, 197 that flip gravity). 72 of them need the button changed 8 to 33 ms after the change, far quicker than anyone can react (about 200 ms), so they can only be played from memory.

**Presses count to the physics tick.** The game keeps the exact moment of every press and release and applies it at the 1/240 s tick it fell in, not at the next screen frame. On a 60 Hz screen a frame is 4 ticks, so without this an 8 ms window would sometimes be impossible to hit at all. Now it only takes perfect timing.

How do we know it's possible? The perfect run it's built from beats the whole level (`make-bot.js` checks it), and the in-game **BOT** (press `B` in the menu) plays it, all 17 minutes. Every press was also tested from 6 ticks early to 6 ticks late with everything else unchanged, which is where the 8.3 ms figure comes from.

How hard is it? Say a player aims every press at the middle of its window, and their presses land with a given timing spread (standard deviation). The chance of hitting all 1,452 in one run, before counting the blur or screen and controller lag:

| Timing spread | One press in its window | Whole level in one attempt |
| --- | --- | --- |
| 10 ms (very good) | 32% | 1 in 10⁷¹³ |
| 5 ms (best rhythm-game players, on a great day) | 60% | 1 in 10³²⁸ |
| 3 ms (better than any human) | 84% | 1 in 10¹¹⁴ |
| 2 ms | 96% | 1 in 10²⁴ |
| 1 ms (a machine) | 99.99% | about 4 in 5 |

That table already assumes a player who knows the whole level by heart. Without the portals you can't sight-read it at all: anyone who hasn't memorised all 290 hidden mode changes dies at the first flight they don't see coming, which is within the first few seconds.

For scale: there are about 10⁸⁰ atoms in the observable universe. Practice mode still works, so you can play it in pieces. Its best score is kept separately, and the bot's runs never count toward your best.

### Objects

- **Spikes**: touch one and you die. Also hang from the ceiling (`hang`) for flipped-gravity sections.
- **Cubes**: 1×1 blocks on the grid. Land on top; hitting a side (or the underside, in normal gravity) kills you.
- **Slabs**: as wide as a cube, half as tall. Can sit on the ground, on cubes, or float in the air.
- **Jump pads** (yellow): launch you higher automatically.
- **Jump orbs** (pink rings): press while touching one for a mid-air jump.
- **Portals**: `FLY` switches to ship mode (hold to rise, release to fall), `RUN` switches back to the cube, and `↕` flips gravity or sets it back to normal.
- **Coyote time**: a jump still works for 80 ms after running off an edge.
- **Practice mode**: drops a checkpoint about every 1.6 seconds, and you respawn at the last one instead of the start. Practice bests are tracked apart from normal bests.

Best percentages are saved in `localStorage` under the keys `pulse:best` and `pulse:bestP`, and attempts per level under `pulse:tries`.

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

Asian Mode breaks these rules on purpose (see above). It keeps one rule of its own: its perfect run must beat it.

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
| `Esc` | Back to the menu, or back to the arcade from the menu |

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
| `Esc` | Back to the menu, or back to the arcade from the menu |

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
| `Esc` | Back to the menu, or back to the arcade from the menu |

The score (red wins, draws, yellow wins) is kept until you go back to the menu.

## Only Up

The only point of the game is to go up. There's no menu and no difficulty setting: it loads straight onto the ground and you start climbing a 1,700 m tower of 488 platforms. There are no checkpoints, so a missed jump drops you until something catches you, and you climb that part again.

| Input | Action |
| --- | --- |
| `←` `→` or `A` `D`, or hold the on-screen arrow buttons | Move |
| `Space`, `↑` or `W`, or tap the JUMP button or anywhere else on the screen | Jump (hold to go higher, tap for a short hop) |
| `Esc` or `P` | Pause (`Esc` again goes back to the arcade) |
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
| `Esc` or the MENU button | Put the pebble down, or back to the menu (your game is kept). `Esc` on the menu goes back to the arcade |

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

Asian Mode (`asianMode()` in `engine.js`) is generated instead, every time the game loads (about 0.1 s), from a seeded random generator, so it always comes out the same. It first plays a perfect run on a copy of the level with only its portals, then measures where the player can be in each column on that run and on every "one press one tick off" version of it, and puts a spike just under and just over that. Flights use the "one tick off" direction that ends up higher, so all of a flight's near-misses sit on one side of the perfect path and its gap stays one tick wide. `lv.plan` holds the perfect run. Solid `fill` objects behind the spikes are only drawn, never hit. A level with the difficulty name `IMPOSSIBLE` gets the throbbing red card in the menu.

### The bot

`games/pulse-runner/make-bot.js` is a Node tool (it isn't loaded by the game or copied into the app). It solves every level with a beam search at 60 fps (Asian Mode brings its own perfect run, which it just checks) and writes the button presses to `bot.js`, which the in-game bot replays tick for tick. **After changing any level, run it again** (about 20 seconds), or the bot will crash into the changed part:

```
node games/pulse-runner/make-bot.js
```

## Adding a new game

1. Make a folder for it, for example `games/my-game/`, with an `index.html` and whatever scripts, styles and assets it needs. Use relative paths inside the folder.
2. To let **Esc** return to the arcade, send this from the game (usually on its main menu):
   ```js
   if (window.parent !== window) window.parent.postMessage('exit-game', '*');
   ```
3. Register it in the `GAMES` array at the top of the script in `index.html`:
   ```js
   { id: 'mygame', name: 'My Game', file: 'games/my-game/index.html', desc: 'One line about it.' },
   ```
   Its card appears in the arcade in that position.

Then:

4. Add touch controls, and since phones have no Esc key, handle it the same way: the back button sends the game an `Escape` keydown.
5. Give it a card picture in `CARDS` in `launcher.js` (24×24 pixels drawn with rectangles). Without one, the card shows just the name.
6. Add its files to `FILES` in `sw.js` and change `VERSION`, so the home-screen version works offline.
7. Rebuild the Android app (see [Phones](#phones)).

## Phones

Phones get the same arcade as computers: a "ULT ARCADE, BY ULT GAMES" loading screen for about 2 seconds, then the game cards. Tap a game to play it.

Phones have no Esc key, so a back button sits in the top-left corner while a game is open (on computers too). It does whatever Esc does in that game: pause, go back to the game's menu, or go back to the arcade. The phone's own back gesture, or the browser's back button, does the same.

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

## Visitors, stats and /admin

Every browser that opens the arcade gets the next **visitor number** from the server, kept on that device. It shows faintly in the bottom-right corner, on the arcade and inside every game, as `ULT #000042`. The arcade then sends that visitor's stats: device type (computer, phone/tablet or Android app), visits, time played and opens per game, Pulse Runner bests and attempts per level, Snake best and top 10, Only Up best time, Pebble Solitaire best, and whether cheats are on. It sends them on load, when a game closes, every minute while a game is open, and when the tab is hidden. No name, email or IP address is stored. Snake's top 10 does include whatever names players typed for it.

**`/admin`** (for example https://ult-arcade.vercel.app/admin) logs in as `admin` and shows every visitor with their stats. Click a visitor for everything they sent, or a column title to sort. Its **cheat panel** changes only the browser it's used in:

- **Invincible**: in Pulse Runner, spikes and walls can't kill you.
- **Start at %**: every Pulse Runner level starts that far in, reached by playing the bot's run.
- **Set all Pulse Runner levels to 100%**, and **Reset all my scores**.

While Invincible or Start at is on, Pulse Runner shows **CHEATS ON** and saves no best scores.

### How it works

The server part is a few Vercel functions in `api/` (Node, no packages):

| File | What it does |
| --- | --- |
| `api/visit.js` | `POST {token}`: gives a new browser the next number and a secret token, or counts a returning visit |
| `api/stats.js` | `POST {token, stats}`: saves that visitor's latest stats |
| `api/admin/login.js` / `logout.js` | Checks the username and password, then sets or clears a signed admin cookie (12 hours, HttpOnly). At most 10 tries per 15 minutes from one place. |
| `api/admin/visitors.js` | Every visitor record, for the admin page only |
| `api/_lib.js` | Database calls, the admin cookie, request limits |

`visitor.js` is the browser side and `admin/index.html` the admin page. The Android app sends its stats to the website too.

### Setting it up on Vercel (once)

1. **Database:** in the Vercel dashboard, open the `ult-arcade` project → **Storage** → **Create Database** → **Neon** (Postgres; the free plan is plenty) → connect it to the project. Vercel adds its address as `DATABASE_URL` by itself, and the first visit creates the one table it needs (`ult_kv`). Upstash for Redis works too.
2. **Admin password:** run this in the project folder and type the password when it asks. It's stored as a private Vercel setting, never in the code or on GitHub:
   ```
   npx vercel env add ADMIN_PASSWORD production
   ```
3. Redeploy, or push, so the functions pick up both.

Until both are done, the arcade works as before, just without a visitor number, and `/admin` says what's missing.
