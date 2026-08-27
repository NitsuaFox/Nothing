# Nothing

A universe from a single point.

Black screen. A small white orb. Tap when the pulse ring kisses it. Perfect hits create matter. Misses get sucked back into the void. Fill a universe until it bangs, carry your combo deeper, and chase the high score until the void takes you.

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

## Run

Each universe is a floor. Fill the mass bar until it bangs. Combo and streak **carry** into the next universe, which opens with a free kiss. Score is run-long.

Combo multiplies every hit. A perfect streak adds a clean extra multiplier: **×1.5** at 4, **×2** at 8, **×3** at 12. Depth multiplies on top.

You have **three lives**, shown as dots. A miss (or letting a create pulse die) costs one. Tapping a **VOID** pulse costs one. Letting a void pass is **SILENCE** — that is free, and it pays. The first universe cannot kill you. From depth 2, the last pip ends the run. Entropy still eats idle mass.

Deeper floors get meaner. No shop, no pick — just a word:

- Depth 2 **FASTER** — the ring quickens
- Depth 3 **VOIDS** — dashed traps more often
- Depth 4 **TIGHT** — a smaller kiss
- Depth 5+ **DEEPER** — those stack, and bangs need more mass

Death screens the score, peak combo, and a row of discoveries (found words vs dots). Tap to start a new run. Best score and best depth stay in this browser. If the Wavedash SDK is present, the score is submitted to `high-scores`.

## How it feels

- **Perfect** — ring meets the orb. A small punch, pitch-up pop, combo.
- **Good** — close. Smaller burst, combo holds.
- **Miss** — too early, too late, or you let the pulse die. Combo dumps, one life.
- **Void pulses** — dashed hollow ring. Let it pass for **SILENCE**. Tap it and the void takes a life.
- **Resonance** — perfects in a row. Extra matter, a chord.
- **Streak** — 4 / 8 / 12 perfects. ×1.5, ×2, ×3 and a chord.
- **Bang** — the universe detonates. Tap to go deeper, combo still in your pocket.

Sounds are synthesized with the Web Audio API — there are no audio files. The first tap unlocks audio (browser autoplay rules).
