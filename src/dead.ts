import { log } from "./debug";
import { clamp } from "./math";
import {
  ACT_IDS,
  DISCOVERY_BLURB,
  DISCOVERY_LABEL,
  PHASE_IDS,
  type DiscoveryId,
} from "./progress";
import { nearLeaderboard, type RankRow } from "./leaderboard";
import { clipName, fillTracked, fitTrackedSize, font, formatScore, strokeText } from "./ui";

export type DeadView = {
  w: number;
  h: number;
  cx: number;
  safe: { top: number; right: number; bottom: number; left: number };
  compact: boolean;
  ui: number;
  pad: number;
  tapY: number;
  score: number;
  best: number;
  newBest: boolean;
  depth: number;
  peakCombo: number;
  deathReason: string;
  username: string;
  userId: string;
  submittedRank: number | null;
  board: RankRow[];
  around: RankRow[];
  found: ReadonlySet<DiscoveryId>;
  discoveredThisRun: readonly DiscoveryId[];
};

const KIND_TITLE: Record<"phase" | "act", string> = {
  phase: "PHASES OF THE ORB",
  act: "WHAT YOU DID",
};

const KIND_HINT: Record<"phase" | "act", string> = {
  phase: "how far this universe grew",
  act: "rare things that can happen",
};

let lastDeadKey = "";

export function deathHeadline(reason: string): string {
  if (reason === "void") return "YOU TAPPED A VOID";
  if (reason === "entropy") return "THE MASS RAN OUT";
  if (reason === "miss") return "THE VOID TOOK YOU";
  return "RUN OVER";
}

function mergeRows(view: DeadView): RankRow[] {
  const seen = new Set<string>();
  const out: RankRow[] = [];
  for (const row of [...view.around, ...view.board]) {
    const key = row.userId || `${row.name}:${row.rank}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function logDeadOnce(view: DeadView, near: RankRow[]): void {
  const key = [
    view.score,
    view.depth,
    view.deathReason,
    near.map((row) => `${row.rank}:${row.name}`).join(","),
    [...view.found].join(","),
  ].join("|");
  if (key === lastDeadKey) return;
  lastDeadKey = key;
  log("dead screen", {
    reason: view.deathReason,
    headline: deathHeadline(view.deathReason),
    score: view.score,
    best: view.best,
    newBest: view.newBest,
    depth: view.depth,
    peakCombo: view.peakCombo,
    rank: view.submittedRank,
    near: near.map((row) => ({
      rank: row.rank,
      name: row.name,
      score: row.score,
      mine: row.mine,
    })),
    found: [...view.found],
    thisRun: [...view.discoveredThisRun],
    compact: view.compact,
    size: { w: view.w, h: view.h },
  });
}

export function drawDeadScreen(ctx: CanvasRenderingContext2D, view: DeadView): void {
  const near = nearLeaderboard({
    rows: mergeRows(view),
    score: view.score,
    name: view.username,
    userId: view.userId,
    rank: view.submittedRank,
  });
  logDeadOnce(view, near);

  const inset = view.compact ? view.pad : Math.max(view.pad, Math.round(view.w * 0.07));
  const left = view.safe.left + inset;
  const right = view.w - view.safe.right - inset;
  const top = view.safe.top + (view.compact ? 52 : Math.max(view.pad, 20));
  const bottom = view.tapY - (view.compact ? 22 : 36);
  const width = Math.max(120, right - left);
  const tall = Math.max(160, bottom - top);
  const wide = !view.compact && view.w >= 860 && tall >= 380;
  const thisRun = new Set(view.discoveredThisRun);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, view.w, view.h);

  const scoreBlock = drawScoreBlock(ctx, view, view.cx, top, width, tall, wide);

  if (wide) {
    const actH = 92;
    const gap = 48;
    const splitY = scoreBlock.bottom + 22;
    const mainH = Math.max(120, bottom - splitY - actH);
    const colW = (width - gap) / 2;
    drawNearBlock(ctx, view, near, left, splitY, colW, mainH);
    drawDiscoveryGroup(ctx, view, { kind: "phase", ids: PHASE_IDS }, thisRun, left + colW + gap, splitY, colW, mainH, "stack");
    drawDiscoveryGroup(ctx, view, { kind: "act", ids: ACT_IDS }, thisRun, left, splitY + mainH + 10, width, actH, "row");
  } else {
    const splitY = scoreBlock.bottom + (view.compact ? 14 : 20);
    const nearH = clamp(tall * 0.26, 84, 140);
    drawNearBlock(ctx, view, near, left, splitY, width, nearH);
    const discY = splitY + nearH + (view.compact ? 10 : 16);
    drawDiscoveryBlock(ctx, view, left, discY, width, bottom - discY, thisRun);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.4;
  ctx.font = font(500, view.compact ? 14 : 16);
  ctx.fillText("TAP", view.cx, view.tapY);
  ctx.restore();
}

function drawScoreBlock(
  ctx: CanvasRenderingContext2D,
  view: DeadView,
  cx: number,
  top: number,
  width: number,
  tall: number,
  wide: boolean,
): { bottom: number } {
  const minDim = Math.min(view.w, view.h);
  const headline = deathHeadline(view.deathReason);
  let y = top + (view.compact ? 10 : 14);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";

  ctx.globalAlpha = 0.55;
  const headSize = clamp(minDim * 0.028 * view.ui, 12, 18);
  ctx.font = font(600, headSize);
  fillTracked(ctx, headline, cx, y, 6);
  y += headSize + (view.compact ? 16 : 20);

  ctx.globalAlpha = 0.5;
  const scoreLabel = view.compact ? 11 : 13;
  ctx.font = font(600, scoreLabel);
  fillTracked(ctx, "SCORE", cx, y, 10);
  y += scoreLabel + (view.compact ? 8 : 10);

  const scoreText = formatScore(view.score);
  const budget = tall * (wide ? 0.22 : view.compact ? 0.18 : 0.2);
  const maxScore = clamp(
    Math.min(minDim * (wide ? 0.15 : view.compact ? 0.12 : 0.16), budget),
    view.compact ? 40 : 52,
    wide ? 124 : 100,
  );
  const fitted = fitTrackedSize(ctx, scoreText, 800, maxScore, width * 0.92, 0.08);
  const scoreY = y + fitted.size * 0.5;
  ctx.globalAlpha = 1;
  ctx.font = font(800, fitted.size);
  strokeText(ctx, scoreText, cx, scoreY, Math.max(8, fitted.size * 0.08));
  y = scoreY + fitted.size * 0.5 + (view.compact ? 14 : 18);

  ctx.globalAlpha = view.newBest ? 0.82 : 0.48;
  ctx.font = font(600, view.compact ? 13 : 15);
  const kicker = view.newBest ? "NEW BEST" : `BEST ${formatScore(view.best)}`;
  ctx.fillText(kicker, cx, y);
  y += view.compact ? 20 : 24;

  ctx.globalAlpha = 0.42;
  ctx.font = font(500, view.compact ? 12 : 14);
  ctx.fillText(`DEPTH ${view.depth}   ·   PEAK COMBO ${view.peakCombo}`, cx, y);
  y += view.compact ? 12 : 16;

  ctx.restore();
  return { bottom: y };
}

function drawNearBlock(
  ctx: CanvasRenderingContext2D,
  view: DeadView,
  near: RankRow[],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (h < 48) return;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";

  ctx.textAlign = "left";
  ctx.globalAlpha = 0.34;
  ctx.font = font(600, view.compact ? 10 : 11);
  ctx.fillText("NEAR YOUR SCORE", x, y);
  ctx.globalAlpha = 0.28;
  ctx.font = font(500, view.compact ? 10 : 11);
  ctx.textAlign = "right";
  ctx.fillText("1 above · 2 below", x + w, y);

  const rowTop = y + (view.compact ? 18 : 22);
  const rows = near.slice(0, 4);
  const rowH = Math.min(view.compact ? 22 : 28, Math.max(18, (h - (view.compact ? 22 : 28)) / Math.max(1, rows.length)));
  const nameMax = view.compact ? 10 : 16;

  rows.forEach((row, i) => {
    const ry = rowTop + i * rowH + rowH / 2;
    if (ry > y + h - 4) return;
    if (row.mine) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - 6, ry - rowH / 2 + 1, w + 12, rowH - 2);
    }
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = row.mine ? 0.95 : 0.48;
    ctx.font = font(row.mine ? 700 : 500, view.compact ? 12 : 14);
    ctx.textAlign = "left";
    const rank = row.rank > 0 ? `#${row.rank}` : "·";
    ctx.fillText(rank, x, ry);
    const mark = row.mine ? "" : row.friend ? " *" : "";
    ctx.fillText(clipName(row.name, nameMax) + mark, x + (view.compact ? 36 : 48), ry);
    ctx.textAlign = "right";
    ctx.fillText(formatScore(row.score), x + w, ry);
  });

  ctx.restore();
}

function drawDiscoveryBlock(
  ctx: CanvasRenderingContext2D,
  view: DeadView,
  x: number,
  y: number,
  w: number,
  h: number,
  thisRun: Set<DiscoveryId>,
): void {
  if (h < 56) return;
  const twoCol = w >= 420 && h < 240;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";

  if (twoCol) {
    const gap = 28;
    const colW = (w - gap) / 2;
    drawDiscoveryGroup(ctx, view, { kind: "phase", ids: PHASE_IDS }, thisRun, x, y, colW, h, "stack");
    drawDiscoveryGroup(ctx, view, { kind: "act", ids: ACT_IDS }, thisRun, x + colW + gap, y, colW, h, "stack");
  } else {
    const phaseH = h * 0.62;
    drawDiscoveryGroup(ctx, view, { kind: "phase", ids: PHASE_IDS }, thisRun, x, y, w, phaseH, "stack");
    drawDiscoveryGroup(ctx, view, { kind: "act", ids: ACT_IDS }, thisRun, x, y + phaseH, w, h - phaseH, "stack");
  }

  ctx.restore();
}

function clipBlurb(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (maxW < 12) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function drawDiscoveryGroup(
  ctx: CanvasRenderingContext2D,
  view: DeadView,
  group: { kind: "phase" | "act"; ids: DiscoveryId[] },
  thisRun: Set<DiscoveryId>,
  x: number,
  y: number,
  w: number,
  h: number,
  flow: "stack" | "row",
): void {
  if (h < 32) return;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.globalAlpha = 0.34;
  ctx.font = font(600, view.compact ? 10 : 11);
  ctx.fillText(KIND_TITLE[group.kind], x, y);
  ctx.globalAlpha = 0.26;
  ctx.font = font(500, view.compact ? 10 : 11);
  ctx.fillText(KIND_HINT[group.kind], x, y + (view.compact ? 12 : 14));

  if (flow === "row") {
    const start = y + (view.compact ? 28 : 34);
    const colW = w / Math.max(1, group.ids.length);
    group.ids.forEach((id, i) => {
      const cx = x + i * colW;
      drawDiscoveryLine(ctx, view, id, thisRun, cx, start, colW - 12, true);
    });
    ctx.restore();
    return;
  }

  const start = y + (view.compact ? 28 : 32);
  const rowH = Math.min(view.compact ? 16 : 22, Math.max(14, (h - (view.compact ? 32 : 38)) / Math.max(1, group.ids.length)));
  group.ids.forEach((id, i) => {
    const ry = start + i * rowH;
    if (ry > y + h - 6) return;
    drawDiscoveryLine(ctx, view, id, thisRun, x, ry, w, false);
  });
  ctx.restore();
}

function drawDiscoveryLine(
  ctx: CanvasRenderingContext2D,
  view: DeadView,
  id: DiscoveryId,
  thisRun: Set<DiscoveryId>,
  x: number,
  y: number,
  w: number,
  stacked: boolean,
): void {
  const known = view.found.has(id);
  const fresh = thisRun.has(id);
  ctx.textAlign = "left";
  ctx.globalAlpha = known ? (fresh ? 0.9 : 0.7) : 0.2;
  ctx.font = font(known ? 600 : 500, view.compact ? 11 : 13);
  const label = known ? DISCOVERY_LABEL[id] : "·";
  ctx.fillText(label, x, y);
  ctx.globalAlpha = known ? 0.42 : 0.16;
  ctx.font = font(500, view.compact ? 10 : 12);
  const blurb = known ? DISCOVERY_BLURB[id] : "not yet";
  if (stacked) {
    ctx.fillText(clipBlurb(ctx, blurb, w), x, y + (view.compact ? 14 : 16));
    return;
  }
  const blurbX = x + (view.compact ? 92 : 118);
  ctx.fillText(clipBlurb(ctx, blurb, x + w - blurbX), blurbX, y);
}
