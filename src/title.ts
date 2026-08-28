import { log } from "./debug";
import type { HudLayout } from "./hud";
import { clamp, easeInCubic, easeOutCubic } from "./math";
import type { SplashPhase } from "./types";
import { fillTracked, fitTrackedSize, font } from "./ui";

/**
 * Boot title card, in seconds from splash start.
 * Studio first (no star), then NOTHING huge, then both die and the point remains.
 */
const STUDIO_IN = 0.45;
const STUDIO_FULL = 1.25;
const STUDIO_HOLD = 2.4;
const STUDIO_OUT = 3.1;

const TITLE_IN = 3.3;
const TITLE_FULL = 4.5;
const TITLE_HOLD = 6.6;
const TITLE_OUT = 7.85;

const ORB_IN = 7.4;
const ORB_FULL = 8.5;
const MENU_IN = 8.2;
const MENU_FULL = 9.05;

export const SPLASH_END = 9.05;
export const SKIP_FADE = 0.45;
export const MENU_CLICK_LOCK = 0.4;

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

export function playPromptRect(hud: HudLayout): { x: number; y: number; w: number; h: number } {
  return {
    x: hud.playX - hud.playHitW / 2,
    y: hud.playY - hud.playHitH / 2,
    w: hud.playHitW,
    h: hud.playHitH,
  };
}

export function hitPlayPrompt(px: number, py: number, hud: HudLayout): boolean {
  const r = playPromptRect(hud);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawTitleCards(
  ctx: CanvasRenderingContext2D,
  hud: HudLayout,
  worldCx: number,
  worldCy: number,
  look: TitleLook,
): void {
  if (look.studioAlpha <= 0.01 && look.titleAlpha <= 0.01) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";

  const maxW = hud.frameW;

  if (look.studioAlpha > 0.01) {
    ctx.globalAlpha = look.studioAlpha;
    const { size, tracking } = fitTrackedSize(ctx, "WHATTODOGAMES", 500, hud.studioSize, maxW * 0.86, 0.42);
    ctx.font = font(500, size);
    fillTracked(ctx, "WHATTODOGAMES", worldCx, worldCy, tracking);
  }

  if (look.titleAlpha > 0.01) {
    const label = "NOTHING";
    ctx.globalAlpha = look.titleAlpha;
    const { size, tracking } = fitTrackedSize(ctx, label, 800, hud.titleSize, maxW * 0.9, 0.22);
    ctx.font = font(800, size);
    fillTracked(ctx, label, worldCx, worldCy, tracking);
  }

  ctx.restore();
}

export function drawMainMenu(
  ctx: CanvasRenderingContext2D,
  hud: HudLayout,
  alpha: number,
  best: number,
  hoverPlay: boolean,
  wallTime: number,
): void {
  if (alpha <= 0.01) return;

  const pulse = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(wallTime * 2.05));

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";

  ctx.globalAlpha = alpha * (hoverPlay ? 0.92 : pulse * 0.55);
  ctx.font = font(600, hud.playSize);
  fillTracked(ctx, "PLAY", hud.playX, hud.playY, Math.max(6, 10 * hud.scale));

  if (best > 0) {
    ctx.globalAlpha = alpha * 0.32;
    ctx.font = font(500, hud.bestSize);
    const bestY = Math.min(hud.frameY + hud.frameH - hud.pad, hud.playY + hud.playSize * 2.1);
    ctx.fillText(`best ${best}`, hud.playX, bestY);
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
