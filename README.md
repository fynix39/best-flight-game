# best-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/fynix39/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/fynix39/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sky Courier — Island Run** — a bush-pilot mail game, built for the make.fun best-flight-game bounty. You are the courier pilot of a small island chain: thread the glowing mail rings, mind the fuel gauge, and put the plane down gently on the strip at the far end. Three sorties — a calm dawn run, a gusty sunset run, and a night run under the lighthouse beam.

## How to play

- **↑ / ↓** — pitch the nose up / down
- **← / →** — throttle down / up
- **F** — flaps (slower, more lift, for the final approach)
- **Mouse** — hold the button and the plane steers toward the pointer; scroll wheel adjusts the throttle
- **P** — pause · **M** — mute · **R** — retry · **Enter** — start / menu

Fly through every mail ring (+250 points, +10 fuel each), then land on the runway: touch down gently — slow, level, sinking less than 3.6 m/s — for the landing bonus. Hit the hills or ditch in the sea and you lose a heart and go back to the last ring; three hearts lost ends the sortie. Run out of fuel and the engine quits — glide her in. Stars: land (1), all rings (2), all rings with 40% fuel left (3).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests — the game is plain static files under `game/`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library in `vendor/makefun-game.ts`.

## Screenshots

The four images in `screenshots/` are real renders of the game's own code, taken in a browser from deterministic scenes (`shots.json`): a mid-flight ring run (the cover), the title screen, a gusty sunset sortie low over the sea, and a mission-complete landing. Each scene plays the real rules forward from a seeded world with an autopilot pilot (`game/src/shots.js`).

## Layout

- `game/index.html` — the page and canvas
- `game/src/config.js` — tuning: plane, landing, scoring, the three sorties
- `game/src/random.js` — seeded random numbers
- `game/src/world.js` — the island chain: terrain, rings, runway, scenery
- `game/src/flight.js` — the rules: physics, rings, landings, crashes, scoring
- `game/src/particles.js` — ring bursts, exhaust, smoke, crash fire
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised sound effects (WebAudio, no files)
- `game/src/render.js` — all the drawing: sky, sea, terrain, plane, HUD, instruments, screens
- `game/src/shots.js` — deterministic screenshot scenes and the autopilot
- `game/src/main.js` — the game loop and screens
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes the dossier)
- `serve.ts` — a tiny static server for local play
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=jvcw07av&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
