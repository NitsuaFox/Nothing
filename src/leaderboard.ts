import { log } from "./debug";

let lastNearKey = "";

export const NEAR_UP = 1;
export const NEAR_DOWN = 2;

export type RankRow = {
  rank: number;
  name: string;
  score: number;
  userId: string;
  mine: boolean;
  friend: boolean;
  depth?: number;
  combo?: number;
};

function betterThan(a: RankRow, b: RankRow): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.rank > 0 && b.rank > 0 && a.rank !== b.rank) return a.rank < b.rank;
  return a.name.localeCompare(b.name) < 0;
}

function dedupe(rows: RankRow[]): RankRow[] {
  const byId = new Map<string, RankRow>();
  const orphan: RankRow[] = [];
  for (const row of rows) {
    const key = row.userId || "";
    if (!key) {
      orphan.push(row);
      continue;
    }
    const prev = byId.get(key);
    if (!prev || betterThan(row, prev)) byId.set(key, row);
  }
  return [...byId.values(), ...orphan];
}

function estimateRank(others: RankRow[], me: RankRow): number {
  return others.filter((row) => betterThan(row, me)).length + 1;
}

/** True only when this run strictly beats the kept board score. Ties stay red. */
export function didBeatBoard(runScore: number, previousBoard: number): boolean {
  return runScore > Math.max(0, previousBoard);
}

/**
 * Score to show on the recap leaderboard row.
 * Beat: the new kept best (this run). Miss: the actual board best, not this run.
 */
export function standingScore(runScore: number, previousBoard: number, improved: boolean): number {
  if (improved) return Math.max(runScore, Math.max(0, previousBoard));
  return Math.max(0, previousBoard);
}

/**
 * People next to the player's kept board score: one better, this row, two worse.
 * Do not pass this run's score unless it actually became the board best.
 */
export function nearLeaderboard(opts: {
  rows: RankRow[];
  score: number;
  name: string;
  userId: string;
  rank?: number | null;
  up?: number;
  down?: number;
}): RankRow[] {
  const up = opts.up ?? NEAR_UP;
  const down = opts.down ?? NEAR_DOWN;
  const others = dedupe(opts.rows).filter((row) => {
    if (opts.userId && row.userId === opts.userId) return false;
    if (row.mine) return false;
    return true;
  });

  const me: RankRow = {
    rank: 0,
    name: opts.name.trim() || "YOU",
    score: opts.score,
    userId: opts.userId,
    mine: true,
    friend: false,
  };
  const guessed = estimateRank(others, me);
  const given = opts.rank && opts.rank > 0 ? opts.rank : 0;
  me.rank = given || guessed;

  const higher = others.filter((row) => betterThan(row, me)).sort((a, b) => (betterThan(a, b) ? 1 : -1));
  const lower = others.filter((row) => betterThan(me, row)).sort((a, b) => (betterThan(a, b) ? -1 : 1));
  const above = higher.slice(0, up).reverse();
  const below = lower.slice(0, down);
  const slice = [...above, me, ...below];
  const meIndex = slice.findIndex((row) => row.mine);
  const stamped =
    me.rank > 0 && meIndex >= 0
      ? slice.map((row, i) => ({ ...row, rank: me.rank + (i - meIndex) }))
      : slice;
  const key = `${me.score}|${me.rank}|${stamped.map((row) => `${row.rank}:${row.name}:${row.score}`).join(",")}`;
  if (key !== lastNearKey) {
    lastNearKey = key;
    log("leaderboard near", {
      score: me.score,
      rank: me.rank,
      guessed,
      given: given || null,
      up: above.map((row) => `${row.rank}:${row.name}:${row.score}`),
      down: below.map((row) => `${row.rank}:${row.name}:${row.score}`),
      shown: stamped.map((row) => `${row.rank}:${row.mine ? "YOU" : row.name}:${row.score}`),
      pool: others.length,
    });
  }

  return stamped;
}

export function aroundOffset(rank: number, up = NEAR_UP): number {
  const r = Math.max(1, Math.floor(rank));
  return Math.max(0, r - 1 - up);
}

export function aroundLimit(up = NEAR_UP, down = NEAR_DOWN): number {
  return up + 1 + down;
}
