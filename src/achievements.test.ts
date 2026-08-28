import { earnedAchievements, type AchievementSnap } from "./achievements";

const early: AchievementSnap = {
  score: 8000,
  combo: 16,
  peakCombo: 16,
  depth: 1,
  hearts: 3,
  perfects: 14,
  silences: 2,
  universes: 0,
  perfectStreak: 12,
  found: 5,
  runs: 0,
};

const afterBang: AchievementSnap = { ...early, universes: 1, score: 12000, perfectStreak: 12 };
const secondBang: AchievementSnap = { ...afterBang, universes: 2, depth: 2, score: 28000, perfectStreak: 12 };
const depth5: AchievementSnap = {
  ...afterBang,
  depth: 5,
  hearts: 3,
  combo: 52,
  peakCombo: 52,
  score: 120_000,
  silences: 26,
  perfects: 100,
  found: 8,
  universes: 4,
};

function ids(snap: AchievementSnap): string[] {
  return [...earnedAchievements(snap)];
}

const earlyIds = ids(early);
if (earlyIds.length !== 0) {
  throw new Error(`first-universe pre-bang should earn nothing, got ${earlyIds.join(",")}`);
}

const bangIds = ids(afterBang);
if (bangIds.join(",") !== "A_UNIVERSE") {
  throw new Error(`first bang should only be A_UNIVERSE (even with ×3), got ${bangIds.join(",")}`);
}

const carryIds = ids(secondBang);
if (!carryIds.includes("A_UNIVERSE") || !carryIds.includes("CARRY") || !carryIds.includes("DEEPER")) {
  throw new Error(`second bang with ×3 should earn A_UNIVERSE + DEEPER + CARRY, got ${carryIds.join(",")}`);
}

const deepIds = ids(depth5);
for (const need of [
  "A_UNIVERSE",
  "DEEPER",
  "FASTER",
  "VOIDS",
  "TIGHT",
  "COMBO_50",
  "SCORE_100K",
  "STILL",
  "KISSES_100",
  "UNBROKEN",
  "CATALOG",
  "CARRY",
]) {
  if (!deepIds.includes(need)) {
    throw new Error(`depth 5 full run missing ${need}: ${deepIds.join(",")}`);
  }
}

console.log("[Nothing] achievement rules ok", {
  early: earlyIds,
  bang: bangIds,
  secondBang: carryIds,
  depth5: deepIds,
});
