export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function easeOutCubic(t: number): number {
  const x = 1 - t;
  return 1 - x * x * x;
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Mix white toward a hot red. `t` 0 = white, 1 = red. */
export function whiteToRed(t: number, alpha: number): string {
  const k = clamp(t, 0, 1);
  const g = Math.round(lerp(255, 28, k));
  const b = Math.round(lerp(255, 20, k));
  return `rgba(255,${g},${b},${alpha})`;
}
