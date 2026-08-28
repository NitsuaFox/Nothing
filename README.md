# Nothing

A universe from a single point.

Black screen. A small white orb. Tap when the pulse ring kisses it. Perfect hits create matter. Misses get sucked back into the void. Fill a universe until it bangs, carry your combo deeper, and chase the high score until the void takes you.

Built as a tiny browser game for [Wavedash](https://docs.wavedash.com/getting-started/introduction): open a link, play immediately.

Game id: `j97b4r6g42zdxc5v540d2cn1gs8d8r69` (`wavedash.toml`). Portal: [wavedash.com/dev-portal/w2d/nothing](https://wavedash.com/dev-portal/w2d/nothing).

## Wavedash

The SDK is injected on Wavedash. Local Vite play uses a stub so identity, boards, and unlocks still work.

| Feature | What it does |
| --- | --- |
| Identity | Shows your Wavedash username (or `YOU` locally) on the waiting-dot menu and death screen |
| Leaderboards | `high-scores`, `depth`, and `combo` — created at runtime, best kept, shown on the waiting-dot menu + death |
| Achievements | Real run goals in `wavedash/catalog.json` (bang, floors, combo 50/100, score 100k/1M, depth 10) — not first-kiss pops |
| Stats | Runs, best score/depth/combo, perfects, silences, universes, discoveries |
| Cloud save | Syncs found words, best score, best depth, and run count across devices |
| Presence | Friends see `DEPTH n` / `BANG` / `VOID` |
| Mute | In-game speaker follows the Wavedash mute button |
| Overlay | `Tab` opens the Wavedash overlay |

After `wavedash auth login`:

```bash
npm run wavedash:catalog
wavedash build push -m "Nothing"
```

Or import `wavedash/catalog.json` in Developer Portal → Achievements → Import JSON. Leaderboards create themselves the first time the game boots on Wavedash.

## Play

```bash
npm install
npm run dev
```

Opens at [http://127.0.0.1:4177](http://127.0.0.1:4177).

Boot is a title screen: **WHATTODOGAMES**, then **NOTHING**, then just a point. Tap (or **PLAY**) to begin. Score, combo, and the rest of the HUD stay off until the universe has started. After a run, tap the death screen to return to that waiting point.

| Input | Action |
| --- | --- |
| Click / tap anywhere | Skip the title, play from the menu, or create (time it with the ring) |
| Space | Same as a tap |
| M or the speaker | Mute |
| Tab | Wavedash overlay (friends, settings) |

No tutorial. The first tap of a run always lands. After that, the ring is the game.

Wavedash achievements are run goals, not first-kiss trophies. Nothing pops until you bang a universe. After that: depth floors, combo 50/100, score 100k/1M, 25 silences, 100 perfects, a second bang while holding ×3, depth 5 with 3 hearts, the full whisper catalog, ten runs. `npm run test:achievements` checks the rules. Paste `window.nothing.debugState()` from the console if an unlock looks wrong.

## Run

Each universe is a floor. Fill the mass bar until it bangs. Combo and streak **carry** into the next universe, which opens with a free kiss. Score is run-long.

Combo multiplies every hit. A perfect streak adds a clean extra multiplier: **×1.5** at 4, **×2** at 8, **×3** at 12. Depth multiplies on top.

You have **three lives**, shown as dots. A miss (or letting a create pulse die) costs one. Tapping a **VOID** pulse costs one. Letting a void pass is **SILENCE** — that is free, and it pays. The last pip ends the run on every depth, including the first universe. Entropy still eats idle mass, and an empty bar is death.

Deeper floors get meaner. No shop, no pick — just a word:

- Depth 2 **FASTER** — the ring quickens
- Depth 3 **VOIDS** — dashed traps more often
- Depth 4 **TIGHT** — a smaller kiss
- Depth 5+ **DEEPER** — those stack, and bangs need more mass

Death screens the score, peak combo, your name, rank, and a row of discoveries (found words vs dots). Tap to return to the waiting point. Best score and best depth stay in this browser and sync to Wavedash cloud saves when the SDK is present. Scores go to `high-scores` (plus `depth` and `combo`).

## How it feels

- **Perfect** — ring meets the orb. A small punch, pitch-up pop, combo.
- **Good** — close. Smaller burst, combo holds.
- **Miss** — too early, too late, or you let the pulse die. Combo dumps, one life.
- **Void pulses** — dashed hollow ring. Let it pass for **SILENCE**. Tap it and the void takes a life.
- **Resonance** — perfects in a row. Extra matter, a chord.
- **Streak** — 4 / 8 / 12 perfects. ×1.5, ×2, ×3 and a chord.
- **Bang** — the universe detonates. Tap to go deeper, combo still in your pocket.

Sounds are synthesized with the Web Audio API — there are no audio files. The first tap unlocks audio (browser autoplay rules).
