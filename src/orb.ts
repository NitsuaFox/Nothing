import { lerp } from "./math";
import type { Phase } from "./types";

export function baseOrbRadius(mass: number): number {
  return 7 + mass * 0.42;
}

export const KISS = 0.8;

export function pulseExpandEnd(kiss = KISS): number {
  return kiss * 0.48;
}

export function pulseMaxRadius(orbR: number, w: number, h: number): number {
  const cap = Math.min(w, h) * 0.32;
  return Math.min(cap, 28 + orbR * 4.2);
}

export function pulseRadius(
  progress: number,
  orbR: number,
  maxR: number,
  kiss: number,
): number {
  const expandEnd = pulseExpandEnd(kiss);
  if (progress <= expandEnd) {
    const t = progress / expandEnd;
    const e = 1 - Math.pow(1 - t, 2);
    return lerp(orbR * 1.15, maxR, e);
  }
  if (progress <= kiss) {
    const t = (progress - expandEnd) / (kiss - expandEnd);
    const e = t * t;
    return lerp(maxR, orbR, e);
  }
  const t = (progress - kiss) / Math.max(0.0001, 1 - kiss);
  return lerp(orbR, orbR * 0.2, t);
}

export function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  phase: Phase,
  breathe: number,
  squashX: number,
  squashY: number,
  densify: number,
): void {
  const r = Math.max(1.4, radius * breathe);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squashX, squashY);

  ctx.globalCompositeOperation = "lighter";
  const glowR = r * (2.8 + densify * 4);
  const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, glowR);
  glow.addColorStop(0, `rgba(255,255,255,${0.55 + densify * 0.35})`);
  glow.addColorStop(0.22, `rgba(255,255,255,${0.16 + densify * 0.2})`);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();

  if (phase === "star" || phase === "giant" || phase === "singularity") {
    const rays = phase === "singularity" ? 14 : phase === "giant" ? 10 : 7;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
      ctx.lineTo(Math.cos(a) * r * (2.4 + densify), Math.sin(a) * r * (2.4 + densify));
      ctx.stroke();
    }
  }

  if (phase === "singularity") {
    ctx.fillStyle = "rgba(255,80,80,0.35)";
    ctx.beginPath();
    ctx.arc(-1.1, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(80,160,255,0.35)";
    ctx.beginPath();
    ctx.arc(1.1, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawPulseRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  kissHint: boolean,
  kind: "create" | "void" = "create",
): void {
  if (alpha <= 0.01 || radius <= 0.5) return;
  ctx.save();
  if (kind === "void") {
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    if (radius > 8) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, radius - 6), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.28})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = kissHint ? 3.4 : 1.6;
    ctx.stroke();
  }
  ctx.restore();
}
