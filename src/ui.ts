const UI_FONT = "ui-sans-serif, system-ui, sans-serif";

export function font(weight: number, size: number): string {
  return `${weight} ${size}px ${UI_FONT}`;
}

export function strokeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width = 5): void {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = width;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
}

/** Centered fill with even tracking. Canvas letterSpacing is too uneven across browsers. */
export function fillTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void {
  const chars = [...text];
  if (chars.length === 0) return;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + tracking * Math.max(0, chars.length - 1);
  let cursor = x - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cursor, y);
    cursor += widths[i] + tracking;
  }
  ctx.textAlign = prevAlign;
}

export function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  const chars = [...text];
  if (chars.length === 0) return 0;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  return widths.reduce((sum, w) => sum + w, 0) + tracking * Math.max(0, chars.length - 1);
}

export function fitTrackedSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  maxSize: number,
  maxWidth: number,
  trackingRatio: number,
): { size: number; tracking: number } {
  let size = maxSize;
  let tracking = size * trackingRatio;
  ctx.font = font(weight, size);
  while (size > 22 && trackedWidth(ctx, text, tracking) > maxWidth) {
    size -= 2;
    tracking = size * trackingRatio;
    ctx.font = font(weight, size);
  }
  return { size, tracking };
}
