/** Wavedash project id from the Developer Portal. */
export const WAVEDASH_GAME_ID = "j97b4r6g42zdxc5v540d2cn1gs8d8r69";

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

/** Proper goals — none of these fire in the first ten seconds of a run. */
export const ACHIEVEMENTS = {
  universe: "A_UNIVERSE",
  deeper: "DEEPER",
  faster: "FASTER",
  voids: "VOIDS",
  tight: "TIGHT",
  depth10: "DEPTH_10",
  combo50: "COMBO_50",
  combo100: "COMBO_100",
  score100k: "SCORE_100K",
  score1m: "SCORE_1M",
  still: "STILL",
  kisses: "KISSES_100",
  carry: "CARRY",
  unbroken: "UNBROKEN",
  catalog: "CATALOG",
  runs10: "RUNS_10",
} as const;

export type AchievementId = (typeof ACHIEVEMENTS)[keyof typeof ACHIEVEMENTS];

export const ACHIEVEMENT_TITLE: Record<string, string> = {
  A_UNIVERSE: "A UNIVERSE",
  DEEPER: "DEEPER",
  FASTER: "FASTER",
  VOIDS: "VOIDS",
  TIGHT: "TIGHT",
  DEPTH_10: "TEN DEEP",
  COMBO_50: "FIFTY",
  COMBO_100: "HUNDRED",
  SCORE_100K: "A HUNDRED THOUSAND",
  SCORE_1M: "A MILLION",
  STILL: "STILL",
  KISSES_100: "A HUNDRED KISSES",
  CARRY: "CARRY",
  UNBROKEN: "UNBROKEN",
  CATALOG: "CATALOG",
  RUNS_10: "TEN VOIDS",
};
