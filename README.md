# Nothing

A universe from a single point.

Black screen. A small white orb. Tap when the pulse ring kisses it. Perfect hits create matter. Misses get sucked back into the void. Bang, take a relic, go deeper. Chase the high score until the void takes you.

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
| Tap a numbered card, or 1 / 2 / 3 | Pick a relic after a bang |
| M or the speaker | Mute |

No tutorial. The first tap always lands. After that, the ring is the game.

After a bang, tap once to skip to the draft. On a wide screen the three cards sit in a row. Tap one, or press `1` `2` `3`. Miss-clicks do nothing.

## Run

Each universe is a floor. Fill it until it bangs. Then pick **one of three relics** and descend. Score is run-long.

Combo multiplies every hit. A perfect streak adds a clean extra multiplier: **×1.5** at 4, **×2** at 8, **×3** at 12. Depth and relics multiply on top. No formula dump, no named ranks.

The first universe cannot kill you. After that:

- Three missed create pulses in a row
- Three **VOID** strikes
- Entropy eating the last of your mass

Death screens the score. Tap to start a new run. Best score and best depth stay in this browser. If the Wavedash SDK is present, the score is submitted to `high-scores`.

## Relics

Eighteen laws. Commons from depth 1, uncommons from 2, rares from 3. **PURE** can stack.

Examples: Afterimage (wider kiss), Quiet (silence pays), Greed (+30% score, faster entropy), Umbral (more voids, richer silence), Memory (half your sky survives the bang).

## How it feels

- **Perfect** — ring meets the orb. A small punch, pitch-up pop, combo.
- **Good** — close. Smaller burst, combo holds.
- **Miss** — too early, too late, or you let the pulse die.
- **Void pulses** — dashed hollow ring. Let it pass for **SILENCE**. Tap it and the void takes.
- **Resonance** — perfects in a row. Extra matter, a chord.
- **Streak** — 4 / 8 / 12 perfects. ×1.5, ×2, ×3 and a chord.
- **Bang** — tap through the score, pick a relic. Depth +1.

Sounds are synthesized with the Web Audio API — there are no audio files. The first tap unlocks audio (browser autoplay rules).
