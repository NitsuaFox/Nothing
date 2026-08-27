# Nothing

A universe from a single point.

Black screen. A small white orb. Tap when the pulse ring kisses it. Perfect hits create matter. Misses get sucked back into the void. Fill the silence and it all collapses into a Big Bang — then you start from nothing again.

Built as a tiny browser game for [Wavedash](https://docs.wavedash.com/getting-started/introduction): open a link, play immediately.

## Play

```bash
npm install
npm run dev
```

Opens at [http://127.0.0.1:4177](http://127.0.0.1:4177).

| Input | Action |
| --- | --- |
| Click / tap anywhere | Create (time it with the ring) |
| Space | Create |
| M or the speaker | Mute |

No tutorial. The first tap always lands. After that, the ring is the game.

## Build

```bash
npm run build
```

Static output lands in `dist/`. That folder is what you upload to Wavedash (`upload_dir = "./dist"`). Call `Wavedash.init()` is already handled when the host injects the SDK; locally the handshake no-ops so you can play without the CLI.

Publish flow (from Wavedash docs):

1. `npm run build`
2. `wavedash init` (writes `wavedash.toml` with your real `game_id`)
3. Set `upload_dir = "./dist"`
4. `wavedash build push` then publish the build

## How it feels

- **Perfect** — ring meets the orb. Hitstop, punch, pitch-up pop, combo.
- **Good** — close. Smaller burst, combo holds.
- **Miss** — too early, too late, or you let the pulse die. Matter vacuums inward.
- **Entropy** — stop tapping and the universe unravels.
- **Bang** — enough mass and time slows, then everything becomes light.

Score is mass created this universe plus peak combo. Best is stored in this browser (`localStorage`). Universe count is for the session.

Sounds are synthesized with the Web Audio API — there are no audio files. The first tap unlocks audio (browser autoplay rules).
