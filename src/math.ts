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
