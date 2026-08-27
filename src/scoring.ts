export type Rank = { at: number; name: string; shake: number; burst: number };

export const RANKS: Rank[] = [
  { at: 4, name: "WARM", shake: 12, burst: 22 },
  { at: 7, name: "HOT", shake: 18, burst: 34 },
  { at: 10, name: "BLAZE", shake: 26, burst: 48 },
  { at: 15, name: "INFERNO", shake: 34, burst: 64 },
  { at: 22, name: "SINGULAR", shake: 44, burst: 84 },
  { at: 30, name: "NOTHING", shake: 56, burst: 120 },
];

export function streakMultiplier(combo: number, perfectStreak: number): number {
  let mul = 1 + combo * 0.08 + perfectStreak * 0.12;
  if (combo >= 4) mul *= 1.15;
  if (combo >= 7) mul *= 1.25;
  if (combo >= 10) mul *= 1.35;
  if (combo >= 15) mul *= 1.5;
  if (combo >= 22) mul *= 1.8;
  if (combo >= 30) mul *= 2.5;
  return mul;
}

export function rankFor(combo: number): Rank | null {
  let found: Rank | null = null;
  for (const rank of RANKS) {
    if (combo >= rank.at) found = rank;
  }
  return found;
}

export function nextRank(combo: number): Rank | null {
  for (const rank of RANKS) {
    if (combo < rank.at) return rank;
  }
  return null;
}

export function rankJustHit(prevCombo: number, combo: number): Rank | null {
  const now = rankFor(combo);
  if (!now) return null;
  const before = rankFor(prevCombo);
  if (!before || before.name !== now.name) return now;
  return null;
}

export function formatMul(n: number): string {
  return `×${n.toFixed(n >= 10 ? 1 : 2)}`;
}

export function liveMultiplier(combo: number, perfectStreak: number, depth: number, relicMul: number): number {
  return Math.max(1, combo) * depth * relicMul * streakMultiplier(combo, perfectStreak);
}

export function scoreGain(opts: {
  base: number;
  combo: number;
  perfectStreak: number;
  depth: number;
  relicMul: number;
}): { gained: number; math: string; streakMul: number } {
  const combo = Math.max(1, opts.combo);
  const streakMul = streakMultiplier(opts.combo, opts.perfectStreak);
  const gained = Math.max(0, Math.round(opts.base * combo * opts.depth * opts.relicMul * streakMul));
  const math = `${opts.base} × c${combo} × d${opts.depth} × s${streakMul.toFixed(2)} × r${opts.relicMul.toFixed(2)}`;
  return { gained, math, streakMul };
}
