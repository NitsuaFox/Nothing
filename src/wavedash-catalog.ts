import type { DiscoveryId } from "./progress";

/** Wavedash project id from the Developer Portal. */
export const WAVEDASH_GAME_ID = "wd_770959de815da6fe71ce8f5efaa1f62caa5200f7071b8480c0b4dcf72b3af3b1";

export const CLOUD_SAVE_PATH = "saves/nothing.json";

export const BOARDS = {
  score: "high-scores",
  depth: "depth",
  combo: "combo",
} as const;

export type BoardName = (typeof BOARDS)[keyof typeof BOARDS];

export const STATS = {
  runs: "RUNS",
  bestScore: "BEST_SCORE",
  bestDepth: "BEST_DEPTH",
  bestCombo: "BEST_COMBO",
  perfects: "TOTAL_PERFECTS",
  silences: "TOTAL_SILENCES",
  universes: "UNIVERSES",
  discoveries: "DISCOVERIES",
} as const;

export const ACHIEVEMENTS = {
  firstLight: "FIRST_LIGHT",
  spark: "SPARK",
  star: "STAR",
  giant: "GIANT",
  singularity: "SINGULARITY",
  universe: "A_UNIVERSE",
  silence: "SILENCE",
  voidTaken: "VOID_TAKEN",
  resonance: "RESONANCE",
  streakX2: "STREAK_X2",
  streakX3: "STREAK_X3",
  deeper: "DEEPER",
  depth5: "DEPTH_5",
  combo25: "COMBO_25",
  catalog: "CATALOG",
  runs10: "RUNS_10",
  score1k: "SCORE_1K",
  score10k: "SCORE_10K",
} as const;

export type AchievementId = (typeof ACHIEVEMENTS)[keyof typeof ACHIEVEMENTS];

export const ACHIEVEMENT_TITLE: Record<string, string> = {
  FIRST_LIGHT: "FIRST LIGHT",
  SPARK: "SPARK",
  STAR: "STAR",
  GIANT: "GIANT",
  SINGULARITY: "SINGULARITY",
  A_UNIVERSE: "A UNIVERSE",
  SILENCE: "SILENCE",
  VOID_TAKEN: "VOID",
  RESONANCE: "RESONANCE",
  STREAK_X2: "×2",
  STREAK_X3: "×3",
  DEEPER: "DEEPER",
  DEPTH_5: "FIVE DEEP",
  COMBO_25: "25",
  CATALOG: "CATALOG",
  RUNS_10: "TEN VOIDS",
  SCORE_1K: "A THOUSAND",
  SCORE_10K: "TEN THOUSAND",
};

export const DISCOVERY_ACHIEVEMENT: Record<DiscoveryId, AchievementId> = {
  spark: ACHIEVEMENTS.spark,
  star: ACHIEVEMENTS.star,
  giant: ACHIEVEMENTS.giant,
  singularity: ACHIEVEMENTS.singularity,
  universe: ACHIEVEMENTS.universe,
  silence: ACHIEVEMENTS.silence,
  voidtaken: ACHIEVEMENTS.voidTaken,
  resonance: ACHIEVEMENTS.resonance,
};
