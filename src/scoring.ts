/** Clean streak gates. No stacked rank math. */
export const STREAKS = [
  { at: 4, mul: 1.5 },
  { at: 8, mul: 2 },
  { at: 12, mul: 3 },
] as const;

export function streakMul(perfectStreak: number): number {
  let mul = 1;
  for (const row of STREAKS) {
    if (perfectStreak >= row.at) mul = row.mul;
  }
  return mul;
}

export function formatMul(n: number): string {
  if (n <= 1) return "";
  if (Number.isInteger(n)) return `×${n}`;
  return `×${n}`;
}

export function streakJustHit(prevPerfect: number, perfectStreak: number): number | null {
  const before = streakMul(prevPerfect);
  const now = streakMul(perfectStreak);
  if (now > before) return now;
  return null;
}

export function scoreGain(opts: {
  base: number;
  combo: number;
  perfectStreak: number;
  depth: number;
}): { gained: number; streak: number } {
  const combo = Math.max(1, opts.combo);
  const streak = streakMul(opts.perfectStreak);
  const gained = Math.max(0, Math.round(opts.base * combo * streak * opts.depth));
  return { gained, streak };
}
