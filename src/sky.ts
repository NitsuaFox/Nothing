import { log } from "./debug";
import { clamp, rand, whiteToRed } from "./math";

export type SkyStar = {
  u: number;
  v: number;
  size: number;
  phase: number;
  alpha: number;
};

const SKY_KEY = "nothing:sky";
const MAX_STARS = 70;

function loadRemnants(): SkyStar[] {
  try {
    const raw = localStorage.getItem(SKY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SkyStar[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_STARS) : [];
  } catch {
    return [];
  }
}

function saveRemnants(stars: SkyStar[]): void {
  try {
    localStorage.setItem(SKY_KEY, JSON.stringify(stars.slice(0, MAX_STARS)));
    log("sky saved", { stars: stars.length });
  } catch (error) {
    log("sky save failed", { error: String(error) });
  }
}

export class Sky {
  remnants: SkyStar[] = loadRemnants();
  born: SkyStar[] = [];
  time = 0;

  plant(w: number, h: number, x: number, y: number, size: number, alpha: number): void {
    if (w <= 0 || h <= 0) return;
    if (this.born.length >= MAX_STARS) this.born.shift();
    this.born.push({
      u: clamp(x / w, 0.04, 0.96),
      v: clamp(y / h, 0.04, 0.96),
      size,
      phase: rand(0, Math.PI * 2),
      alpha,
    });
  }

  plantBurst(w: number, h: number, cx: number, cy: number, count: number, spread: number): void {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(spread * 0.3, spread);
      this.plant(w, h, cx + Math.cos(a) * d, cy + Math.sin(a) * d, rand(0.7, 1.8), rand(0.28, 0.55));
    }
  }

  carry(frac: number): void {
    const keepCount = Math.round(this.born.length * clamp(frac, 0, 1));
    const shuffled = [...this.born].sort(() => Math.random() - 0.5);
    const keep = shuffled.slice(0, keepCount);
    const rest = shuffled.slice(keepCount).map((star) => ({
      ...star,
      alpha: star.alpha * 0.38,
      size: star.size * 0.85,
    }));
    this.remnants = [...this.remnants, ...rest].slice(-MAX_STARS);
    this.born = keep;
    saveRemnants(this.remnants);
    log("sky carry", { keep: keep.length, remnants: this.remnants.length });
  }

  collapse(): void {
    const keep = this.born.filter(() => Math.random() < 0.62).map((star) => ({
      ...star,
      alpha: star.alpha * 0.38,
      size: star.size * 0.85,
    }));
    this.remnants = [...this.remnants, ...keep].slice(-MAX_STARS);
    this.born = [];
    saveRemnants(this.remnants);
    log("sky collapse", { remnants: this.remnants.length });
  }

  clearBorn(): void {
    this.born = [];
  }

  update(dt: number): void {
    this.time += dt;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, redFlash = 0): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    this.drawList(ctx, w, h, this.remnants, 0.55, redFlash);
    this.drawList(ctx, w, h, this.born, 1, redFlash);
    ctx.restore();
  }

  private drawList(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    list: SkyStar[],
    mul: number,
    redFlash: number,
  ): void {
    for (const star of list) {
      const twinkle = 0.65 + 0.35 * Math.sin(this.time * 2.1 + star.phase);
      ctx.fillStyle = whiteToRed(redFlash, star.alpha * twinkle * mul);
      ctx.beginPath();
      ctx.arc(star.u * w, star.v * h, star.size * (1 + redFlash * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
