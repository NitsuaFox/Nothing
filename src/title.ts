import { log } from "./debug";
import { clamp, easeInCubic, easeOutCubic } from "./math";
import type { SplashPhase } from "./types";
import { fillTracked, fitTrackedSize, font } from "./ui";

/**
 * Boot title card, in seconds from splash start.
 * Studio first (no star), then NOTHING huge, then both die and the point remains.
 */
const STUDIO_IN = 0.4;
const STUDIO_FULL = 1.15;
const STUDIO_HOLD = 2.15;
const STUDIO_OUT = 2.85;

const TITLE_IN = 3.05;
const TITLE_FULL = 4.05;
const TITLE_HOLD = 5.35;
const TITLE_OUT = 6.55;

const ORB_IN = 6.15;
const ORB_FULL = 7.15;
const MENU_IN = 6.85;
const MENU_FULL = 7.7;

export const SPLASH_END = 7.7;
export const SKIP_FADE = 0.42;

export type TitleLook = {
  phase: SplashPhase;
  studioAlpha: number;
  titleAlpha: number;
  orbAlpha: number;
  menuAlpha: number;
  skyAlpha: number;
};

function envelope(t: number, fadeInStart: number, fadeInEnd: number, fadeOutStart: number, fadeOutEnd: number): number {
  if (t < fadeInStart) return 0;
  if (t < fadeInEnd) {
    return easeOutCubic(clamp((t - fadeInStart) / Math.max(0.0001, fadeInEnd - fadeInStart), 0, 1));
  }
  if (t < fadeOutStart) return 1;
  if (t < fadeOutEnd) {
    return 1 - easeInCubic(clamp((t - fadeOutStart) / Math.max(0.0001, fadeOutEnd - fadeOutStart), 0, 1));
  }
  return 0;
}

function rise(t: number, start: number, end: number): number {
  if (t < start) return 0;
  if (t >= end) return 1;
  return easeOutCubic(clamp((t - start) / Math.max(0.0001, end - start), 0, 1));
}

export function splashPhaseAt(t: number): SplashPhase {
  if (t < STUDIO_IN) return "black";
  if (t < STUDIO_OUT) return "studio";
  if (t < TITLE_OUT) return "title";
  if (t < SPLASH_END) return "orb";
  return "done";
}

export function titleLook(splashT: number): TitleLook {
  const t = splashT;
  return {
    phase: splashPhaseAt(t),
    studioAlpha: envelope(t, STUDIO_IN, STUDIO_FULL, STUDIO_HOLD, STUDIO_OUT),
    titleAlpha: envelope(t, TITLE_IN, TITLE_FULL, TITLE_HOLD, TITLE_OUT),
    orbAlpha: rise(t, ORB_IN, ORB_FULL),
    menuAlpha: rise(t, MENU_IN, MENU_FULL),
    skyAlpha: rise(t, ORB_IN, MENU_FULL),
  };
}

export function menuLook(): TitleLook {
  return {
    phase: "done",
    studioAlpha: 0,
    titleAlpha: 0,
    orbAlpha: 1,
    menuAlpha: 1,
    skyAlpha: 1,
  };
}

export function playPromptRect(cx: number, cy: number, minDim: number): { x: number; y: number; w: number; h: number } {
  const w = Math.max(160, minDim * 0.28);
  const h = Math.max(44, minDim * 0.08);
  const playY = cy + minDim * 0.16;
  return { x: cx - w / 2, y: playY - h / 2, w, h };
}

export function hitPlayPrompt(px: number, py: number, cx: number, cy: number, minDim: number): boolean {
  const r = playPromptRect(cx, cy, minDim);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawTitleCards(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  look: TitleLook,
): void {
  if (look.studioAlpha <= 0.01 && look.titleAlpha <= 0.01) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";

  const minDim = Math.min(w, h);

  if (look.studioAlpha > 0.01) {
    const maxSize = clamp(minDim * 0.028, 13, 22);
    ctx.globalAlpha = look.studioAlpha;
    const { size, tracking } = fitTrackedSize(ctx, "WHATTODOGAMES", 500, maxSize, w * 0.86, 0.42);
    ctx.font = font(500, size);
    fillTracked(ctx, "WHATTODOGAMES", cx, cy, tracking);
  }

  if (look.titleAlpha > 0.01) {
    const label = "NOTHING";
    const maxSize = clamp(minDim * 0.16, 64, 128);
    ctx.globalAlpha = look.titleAlpha;
    const { size, tracking } = fitTrackedSize(ctx, label, 800, maxSize, w * 0.9, 0.22);
    ctx.font = font(800, size);
    fillTracked(ctx, label, cx, cy, tracking);
  }

  ctx.restore();
}

export function drawMainMenu(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  alpha: number,
  best: number,
  hoverPlay: boolean,
  wallTime: number,
): void {
  if (alpha <= 0.01) return;

  const minDim = Math.min(w, h);
  const pulse = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(wallTime * 2.05));
  const playY = cy + minDim * 0.16;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";

  ctx.globalAlpha = alpha * (hoverPlay ? 0.92 : pulse * 0.55);
  ctx.font = font(600, clamp(minDim * 0.028, 14, 20));
  fillTracked(ctx, "PLAY", cx, playY, 10);

  if (best > 0) {
    ctx.globalAlpha = alpha * 0.32;
    ctx.font = font(500, 13);
    ctx.fillText(`best ${best}`, cx, Math.min(h - 36, playY + 42));
  }

  ctx.restore();
}

let lastLoggedPhase: SplashPhase | "" = "";

export function logSplashPhase(phase: SplashPhase, splashT: number): void {
  if (phase === lastLoggedPhase) return;
  lastLoggedPhase = phase;
  log("splash phase", { phase, t: Number(splashT.toFixed(2)) });
}

export function resetSplashLog(): void {
  lastLoggedPhase = "";
}
