import { log } from "./debug";

/** Insets from the viewport edge, in CSS pixels. */
export type SafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type HudMode = "landscape" | "portrait";

/**
 * Locked HUD design spaces.
 * Landscape is 16:9 (desktop). Portrait is 9:16 (phones).
 * The active space is contained in the safe viewport and scaled uniformly.
 */
export const HUD_LANDSCAPE = { w: 1920, h: 1080 } as const;
export const HUD_PORTRAIT = { w: 1080, h: 1920 } as const;

type HudSpec = {
  w: number;
  h: number;
  pad: number;
  scoreSize: number;
  plusSize: number;
  bestSize: number;
  comboSize: number;
  comboMulSize: number;
  depthSize: number;
  whisperSize: number;
  hitLabelSize: number;
  muteSize: number;
  muteInset: number;
  massW: number;
  massH: number;
  massBottom: number;
  comboBottom: number;
  heartGap: number;
  heartR: number;
  tapBottom: number;
  tapSize: number;
  toastGap: number;
  toastSize: number;
  bangScoreSize: number;
  bangSubSize: number;
  bangHintSize: number;
  bangScoreDy: number;
  bangSubDy: number;
  bangHintDy: number;
  deadScoreSize: number;
  deadScoreDy: number;
  deadLine2Dy: number;
  deadLine2Size: number;
  deadLine3Dy: number;
  deadLine3Size: number;
  deadIdentDy: number;
  discoverDy: number;
  discoverSize: number;
  discoverCols: number;
  boardLimit: number;
  boardRowH: number;
  boardAlign: "center" | "right";
  boardDy: number;
  menuBoardLimit: number;
  menuBoardRowH: number;
  menuNameSize: number;
  playSize: number;
  playDy: number;
  playHitW: number;
  playHitH: number;
  titleSize: number;
  studioSize: number;
  strokeScore: number;
  strokeHit: number;
};

/** 16:9 desktop HUD, authored at 1920×1080. */
const LANDSCAPE_SPEC: HudSpec = {
  w: HUD_LANDSCAPE.w,
  h: HUD_LANDSCAPE.h,
  pad: 48,
  scoreSize: 44,
  plusSize: 18,
  bestSize: 14,
  comboSize: 48,
  comboMulSize: 26,
  depthSize: 14,
  whisperSize: 16,
  hitLabelSize: 22,
  muteSize: 40,
  muteInset: 8,
  massW: 360,
  massH: 6,
  massBottom: 22,
  comboBottom: 56,
  heartGap: 16,
  heartR: 4.5,
  tapBottom: 36,
  tapSize: 16,
  toastGap: 28,
  toastSize: 14,
  bangScoreSize: 72,
  bangSubSize: 18,
  bangHintSize: 16,
  bangScoreDy: -8,
  bangSubDy: 40,
  bangHintDy: 70,
  deadScoreSize: 72,
  deadScoreDy: -64,
  deadLine2Dy: 8,
  deadLine2Size: 18,
  deadLine3Dy: 40,
  deadLine3Size: 16,
  deadIdentDy: 62,
  discoverDy: 96,
  discoverSize: 13,
  discoverCols: 8,
  boardLimit: 8,
  boardRowH: 20,
  boardAlign: "right",
  boardDy: -70,
  menuBoardLimit: 6,
  menuBoardRowH: 18,
  menuNameSize: 13,
  playSize: 20,
  playDy: 173,
  playHitW: 302,
  playHitH: 86,
  titleSize: 168,
  studioSize: 42,
  strokeScore: 8,
  strokeHit: 6,
};

/** Fixed 9:16 phone HUD, authored at 1080×1920 so iPhone-width is ~0.36×. */
const PORTRAIT_SPEC: HudSpec = {
  w: HUD_PORTRAIT.w,
  h: HUD_PORTRAIT.h,
  pad: 56,
  scoreSize: 88,
  plusSize: 39,
  bestSize: 33,
  comboSize: 100,
  comboMulSize: 55,
  depthSize: 33,
  whisperSize: 42,
  hitLabelSize: 55,
  muteSize: 144,
  muteInset: 22,
  massW: 470,
  massH: 14,
  massBottom: 50,
  comboBottom: 150,
  heartGap: 50,
  heartR: 14,
  tapBottom: 70,
  tapSize: 44,
  toastGap: 61,
  toastSize: 33,
  bangScoreSize: 133,
  bangSubSize: 42,
  bangHintSize: 36,
  bangScoreDy: -22,
  bangSubDy: 111,
  bangHintDy: 194,
  deadScoreSize: 133,
  deadScoreDy: -249,
  deadLine2Dy: -78,
  deadLine2Size: 39,
  deadLine3Dy: -22,
  deadLine3Size: 36,
  deadIdentDy: 28,
  discoverDy: 100,
  discoverSize: 30,
  discoverCols: 4,
  boardLimit: 4,
  boardRowH: 44,
  boardAlign: "center",
  boardDy: 255,
  menuBoardLimit: 3,
  menuBoardRowH: 44,
  menuNameSize: 33,
  playSize: 44,
  playDy: 192,
  playHitW: 443,
  playHitH: 133,
  titleSize: 199,
  studioSize: 61,
  strokeScore: 16,
  strokeHit: 12,
};

export type HudLayout = {
  mode: HudMode;
  portrait: boolean;
  scale: number;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  cx: number;
  cy: number;
  pad: number;
  muteX: number;
  muteY: number;
  muteSize: number;
  scoreX: number;
  scoreY: number;
  scoreSize: number;
  plusSize: number;
  bestSize: number;
  bestY: number;
  depthY: number;
  depthSize: number;
  whisperY: number;
  whisperSize: number;
  hitLabelSize: number;
  comboX: number;
  comboY: number;
  comboSize: number;
  comboMulSize: number;
  massX: number;
  massY: number;
  massW: number;
  massH: number;
  heartX: number;
  heartY: number;
  heartGap: number;
  heartR: number;
  tapY: number;
  tapSize: number;
  toastY: number;
  toastSize: number;
  bangScoreSize: number;
  bangSubSize: number;
  bangHintSize: number;
  bangScoreDy: number;
  bangSubDy: number;
  bangHintDy: number;
  deadScoreSize: number;
  deadScoreDy: number;
  deadLine2Y: number;
  deadLine2Size: number;
  deadLine3Y: number;
  deadLine3Size: number;
  deadIdentY: number;
  discoverY: number;
  discoverSize: number;
  discoverCols: number;
  boardX: number;
  boardY: number;
  boardAlign: "center" | "right";
  boardLimit: number;
  boardRowH: number;
  menuBoardX: number;
  menuBoardY: number;
  menuBoardAlign: "center" | "right";
  menuBoardLimit: number;
  menuBoardRowH: number;
  menuNameX: number;
  menuNameY: number;
  menuNameSize: number;
  playX: number;
  playY: number;
  playSize: number;
  playHitW: number;
  playHitH: number;
  titleSize: number;
  studioSize: number;
  strokeScore: number;
  strokeHit: number;
};

export type HudLayoutOpts = {
  coarse?: boolean;
};

function pickMode(innerW: number, innerH: number): HudMode {
  return innerH > innerW ? "portrait" : "landscape";
}

function specFor(mode: HudMode): HudSpec {
  return mode === "portrait" ? PORTRAIT_SPEC : LANDSCAPE_SPEC;
}

function round(n: number): number {
  return Math.round(n);
}

function size(n: number, min = 10): number {
  return Math.max(min, round(n));
}

/**
 * Fit a locked design rect inside the safe viewport (contain / letterbox).
 * World rendering still uses the full canvas; only HUD chrome lives here.
 */
export function hudFrame(
  viewW: number,
  viewH: number,
  safe: SafeArea,
  designW: number,
  designH: number,
): { x: number; y: number; w: number; h: number; scale: number } {
  const innerW = Math.max(1, viewW - safe.left - safe.right);
  const innerH = Math.max(1, viewH - safe.top - safe.bottom);
  const scale = Math.min(innerW / designW, innerH / designH);
  const w = designW * scale;
  const h = designH * scale;
  return {
    x: safe.left + (innerW - w) / 2,
    y: safe.top + (innerH - h) / 2,
    w,
    h,
    scale,
  };
}

export function layoutHud(viewW: number, viewH: number, safe: SafeArea, opts: HudLayoutOpts = {}): HudLayout {
  const innerW = Math.max(1, viewW - safe.left - safe.right);
  const innerH = Math.max(1, viewH - safe.top - safe.bottom);
  const mode = pickMode(innerW, innerH);
  const spec = specFor(mode);
  const frame = hudFrame(viewW, viewH, safe, spec.w, spec.h);
  const s = frame.scale;
  const x = (dx: number) => frame.x + dx * s;
  const y = (dy: number) => frame.y + dy * s;
  const coarse = opts.coarse === true;
  const muteMin = coarse ? 48 : 32;
  const muteSize = Math.max(spec.muteSize * s, muteMin);
  const muteRight = x(spec.w - spec.muteInset);
  const muteTop = y(spec.muteInset);
  const muteX = muteRight - muteSize;
  const muteY = muteTop;
  const pad = spec.pad * s;
  const scoreSize = size(spec.scoreSize * s, 16);
  const comboSize = size(spec.comboSize * s, 16);
  const massW = Math.max(48, spec.massW * s);
  const massH = Math.max(3, spec.massH * s);
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  const rightX = frame.x + frame.w - pad;
  const leftX = frame.x + pad;
  const portrait = mode === "portrait";
  const boardAlign = spec.boardAlign;
  const boardX = boardAlign === "right" ? rightX : cx;
  const menuBoardY = portrait ? frame.y + frame.h - pad - spec.menuBoardRowH * s * 3.2 : muteY + muteSize + 36 * s;

  return {
    mode,
    portrait,
    scale: s,
    frameX: frame.x,
    frameY: frame.y,
    frameW: frame.w,
    frameH: frame.h,
    cx,
    cy,
    pad,
    muteX,
    muteY,
    muteSize,
    scoreX: leftX,
    scoreY: y(spec.pad + spec.scoreSize * 0.5),
    scoreSize,
    plusSize: size(spec.plusSize * s, 11),
    bestSize: size(spec.bestSize * s, 10),
    bestY: y(spec.pad + spec.scoreSize * 0.5 + spec.scoreSize * 0.82),
    depthY: y(spec.pad + spec.scoreSize * 0.5),
    depthSize: size(spec.depthSize * s, 10),
    whisperY: y(spec.pad + spec.scoreSize * 1.7),
    whisperSize: size(spec.whisperSize * s, 11),
    hitLabelSize: size(spec.hitLabelSize * s, 13),
    comboX: leftX,
    comboY: y(spec.h - spec.comboBottom),
    comboSize,
    comboMulSize: size(spec.comboMulSize * s, 12),
    massX: cx - massW / 2,
    massY: y(spec.h - spec.massBottom) - massH / 2,
    massW,
    massH,
    heartX: muteX - Math.max(14, spec.heartGap * s),
    heartY: muteY + muteSize / 2,
    heartGap: Math.max(12, spec.heartGap * s),
    heartR: Math.max(3.5, spec.heartR * s),
    tapY: y(spec.h - spec.tapBottom),
    tapSize: size(spec.tapSize * s, 12),
    toastY: y(spec.pad + spec.scoreSize * 1.7 + spec.toastGap),
    toastSize: size(spec.toastSize * s, 10),
    bangScoreSize: size(spec.bangScoreSize * s, 28),
    bangSubSize: size(spec.bangSubSize * s, 12),
    bangHintSize: size(spec.bangHintSize * s, 11),
    bangScoreDy: spec.bangScoreDy * s,
    bangSubDy: spec.bangSubDy * s,
    bangHintDy: spec.bangHintDy * s,
    deadScoreSize: size(spec.deadScoreSize * s, 28),
    deadScoreDy: spec.deadScoreDy * s,
    deadLine2Y: spec.deadLine2Dy * s,
    deadLine2Size: size(spec.deadLine2Size * s, 12),
    deadLine3Y: spec.deadLine3Dy * s,
    deadLine3Size: size(spec.deadLine3Size * s, 11),
    deadIdentY: spec.deadIdentDy * s,
    discoverY: spec.discoverDy * s,
    discoverSize: size(spec.discoverSize * s, 10),
    discoverCols: spec.discoverCols,
    boardX,
    boardY: cy + spec.boardDy * s,
    boardAlign,
    boardLimit: spec.boardLimit,
    boardRowH: Math.max(14, spec.boardRowH * s),
    menuBoardX: portrait ? cx : rightX,
    menuBoardY,
    menuBoardAlign: portrait ? "center" : "right",
    menuBoardLimit: spec.menuBoardLimit,
    menuBoardRowH: Math.max(14, spec.menuBoardRowH * s),
    menuNameX: rightX,
    menuNameY: muteY + muteSize + 18 * s,
    menuNameSize: size(spec.menuNameSize * s, 11),
    playX: cx,
    playY: cy + spec.playDy * s,
    playSize: size(spec.playSize * s, 13),
    playHitW: Math.max(coarse ? 160 : 120, spec.playHitW * s),
    playHitH: Math.max(coarse ? 48 : 40, spec.playHitH * s),
    titleSize: size(spec.titleSize * s, 48),
    studioSize: size(spec.studioSize * s, 18),
    strokeScore: Math.max(3, spec.strokeScore * s),
    strokeHit: Math.max(3, spec.strokeHit * s),
  };
}

export function hudSnapshot(hud: HudLayout): Record<string, unknown> {
  return {
    mode: hud.mode,
    scale: Number(hud.scale.toFixed(3)),
    frame: {
      x: round(hud.frameX),
      y: round(hud.frameY),
      w: round(hud.frameW),
      h: round(hud.frameH),
    },
    score: { x: round(hud.scoreX), y: round(hud.scoreY), size: hud.scoreSize },
    combo: { x: round(hud.comboX), y: round(hud.comboY), size: hud.comboSize },
    mass: { x: round(hud.massX), y: round(hud.massY), w: round(hud.massW) },
    hearts: { x: round(hud.heartX), y: round(hud.heartY), r: Number(hud.heartR.toFixed(1)) },
    mute: { x: round(hud.muteX), y: round(hud.muteY), s: round(hud.muteSize) },
    play: { x: round(hud.playX), y: round(hud.playY), size: hud.playSize },
  };
}

export function logHudLayout(why: string, viewW: number, viewH: number, safe: SafeArea, hud: HudLayout): void {
  log("hud layout", {
    why,
    view: { w: viewW, h: viewH },
    aspect: Number((viewW / Math.max(1, viewH)).toFixed(3)),
    locked: hud.mode === "portrait" ? "9:16" : "16:9",
    huddebug: hudDebugEnabled(),
    dump: "copy(window.nothing.hud)",
    safe,
    ...hudSnapshot(hud),
  });
}

export const EMPTY_SAFE: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

export function hudDebugEnabled(): boolean {
  return typeof window !== "undefined" && /(?:\?|&)huddebug=1(?:&|$)/.test(window.location.search);
}

export function drawHudDebug(ctx: CanvasRenderingContext2D, hud: HudLayout): void {
  if (!hudDebugEnabled()) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(hud.frameX + 0.5, hud.frameY + 0.5, hud.frameW - 1, hud.frameH - 1);
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(
    `HUD ${hud.mode} ${hud.mode === "portrait" ? "9:16" : "16:9"} ×${hud.scale.toFixed(2)}`,
    hud.frameX + 8,
    hud.frameY + 8,
  );
  ctx.restore();
}
