import { log } from "./debug";
import { ACHIEVEMENTS, ACHIEVEMENT_TITLE, type AchievementId } from "./wavedash-catalog";

/** Run snapshot used to decide which Wavedash achievements have been earned. */
export type AchievementSnap = {
  score: number;
  combo: number;
  peakCombo: number;
  depth: number;
  hearts: number;
  perfects: number;
  silences: number;
  universes: number;
  perfectStreak: number;
  found: number;
  runs: number;
};

/**
 * Real goals. Nothing here can pop on the first few kisses.
 * Discoveries (spark / star / silence whispers) are not achievements.
 */
export function earnedAchievements(snap: AchievementSnap): AchievementId[] {
  const out: AchievementId[] = [];
  if (snap.universes >= 1) out.push(ACHIEVEMENTS.universe);
  if (snap.depth >= 2) out.push(ACHIEVEMENTS.deeper);
  if (snap.depth >= 3) out.push(ACHIEVEMENTS.faster);
  if (snap.depth >= 4) out.push(ACHIEVEMENTS.voids);
  if (snap.depth >= 5) out.push(ACHIEVEMENTS.tight);
  if (snap.depth >= 10) out.push(ACHIEVEMENTS.depth10);
  if (Math.max(snap.combo, snap.peakCombo) >= 50) out.push(ACHIEVEMENTS.combo50);
  if (Math.max(snap.combo, snap.peakCombo) >= 100) out.push(ACHIEVEMENTS.combo100);
  if (snap.score >= 100_000) out.push(ACHIEVEMENTS.score100k);
  if (snap.score >= 1_000_000) out.push(ACHIEVEMENTS.score1m);
  if (snap.silences >= 25) out.push(ACHIEVEMENTS.still);
  if (snap.perfects >= 100) out.push(ACHIEVEMENTS.kisses);
  // First bang almost always has ×3 if you filled the mass bar clean. Carry means you kept it into the next bang.
  if (snap.universes >= 2 && snap.perfectStreak >= 12) out.push(ACHIEVEMENTS.carry);
  if (snap.depth >= 5 && snap.hearts >= 3) out.push(ACHIEVEMENTS.unbroken);
  if (snap.found >= 8) out.push(ACHIEVEMENTS.catalog);
  if (snap.runs >= 10) out.push(ACHIEVEMENTS.runs10);
  return out;
}

export function logAchievementCheck(snap: AchievementSnap, earned: AchievementId[]): void {
  log("achievement check", {
    score: snap.score,
    combo: snap.combo,
    peak: snap.peakCombo,
    depth: snap.depth,
    hearts: snap.hearts,
    perfects: snap.perfects,
    silences: snap.silences,
    universes: snap.universes,
    pStreak: snap.perfectStreak,
    found: snap.found,
    runs: snap.runs,
    earned: earned.map((id) => ACHIEVEMENT_TITLE[id] ?? id),
  });
}
