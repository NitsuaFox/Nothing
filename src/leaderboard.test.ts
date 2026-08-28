import { didBeatBoard, nearLeaderboard, standingScore, type RankRow } from "./leaderboard";

function row(partial: Partial<RankRow> & { name: string; score: number }): RankRow {
  return {
    rank: partial.rank ?? 0,
    name: partial.name,
    score: partial.score,
    userId: partial.userId ?? partial.name,
    mine: Boolean(partial.mine),
    friend: Boolean(partial.friend),
  };
}

if (didBeatBoard(90000, 80000) !== true) throw new Error("90k should beat 80k");
if (didBeatBoard(80000, 80000) !== false) throw new Error("tie is not a beat");
if (didBeatBoard(5000, 80000) !== false) throw new Error("5k should not beat 80k");
if (didBeatBoard(120, 0) !== true) throw new Error("first score should beat empty board");

if (standingScore(5000, 80000, false) !== 80000) {
  throw new Error(`miss should show board 80k, got ${standingScore(5000, 80000, false)}`);
}
if (standingScore(90000, 80000, true) !== 90000) {
  throw new Error(`beat should show run 90k, got ${standingScore(90000, 80000, true)}`);
}
if (standingScore(120, 0, true) !== 120) {
  throw new Error("first standing should be the run");
}

const pool: RankRow[] = [
  row({ rank: 1, name: "VOID", score: 180, userId: "ghost-void" }),
  row({ rank: 2, name: "YOU", score: 80, userId: "local", mine: true }),
  row({ rank: 3, name: "SPARK", score: 40, userId: "ghost-spark" }),
  row({ rank: 4, name: "RING", score: 24, userId: "ghost-ring" }),
  row({ rank: 5, name: "KISS", score: 12, userId: "ghost-kiss" }),
];

const miss = nearLeaderboard({
  rows: pool,
  score: standingScore(10, 80, false),
  name: "YOU",
  userId: "local",
  rank: 2,
});
const missMe = miss.find((r) => r.mine);
if (!missMe || missMe.score !== 80) {
  throw new Error(`miss recap should keep board 80, got ${JSON.stringify(miss)}`);
}
if (missMe.rank !== 2) throw new Error(`miss recap rank should stay 2, got ${missMe.rank}`);

const beat = nearLeaderboard({
  rows: pool.filter((r) => !r.mine),
  score: standingScore(200, 80, true),
  name: "YOU",
  userId: "local",
  rank: 1,
});
const beatMe = beat.find((r) => r.mine);
if (!beatMe || beatMe.score !== 200) {
  throw new Error(`beat recap should show 200, got ${JSON.stringify(beat)}`);
}
if (beatMe.rank !== 1) throw new Error(`beat recap should be #1, got ${beatMe.rank}`);

const wrongOld = nearLeaderboard({
  rows: pool,
  score: 10,
  name: "YOU",
  userId: "local",
  rank: 5,
});
const wrongMe = wrongOld.find((r) => r.mine);
if (!wrongMe || wrongMe.score !== 10) {
  throw new Error("sanity: passing the run score still shows the run (the old bug)");
}

console.log("[Nothing] leaderboard recap rules ok", {
  miss: miss.map((r) => `${r.rank}:${r.mine ? "YOU" : r.name}:${r.score}`),
  beat: beat.map((r) => `${r.rank}:${r.mine ? "YOU" : r.name}:${r.score}`),
});
