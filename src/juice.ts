import { clamp, lerp } from "./math";

export class Juice {
  hitstop = 0;
  punchX = 0;
  punchY = 0;
  punchVX = 0;
  punchVY = 0;
  shake = 0;
  rumble = 0;
  flash = 0;
  invert = 0;
  shockwave = 0;
  shockwaveMax = 0;
  ring = 0;

  get offsetX(): number {
    const jitter = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 2 : 0;
    const rumble = this.rumble > 0 ? (Math.random() - 0.5) * this.rumble : 0;
    return this.punchX + jitter + rumble;
  }

  get offsetY(): number {
    const jitter = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 2 : 0;
    const rumble = this.rumble > 0 ? (Math.random() - 0.5) * this.rumble : 0;
    return this.punchY + jitter + rumble;
  }

  update(dt: number): void {
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
    }

    this.punchVX += -this.punchX * 70 * dt;
    this.punchVY += -this.punchY * 70 * dt;
    this.punchVX *= Math.pow(0.0008, dt);
    this.punchVY *= Math.pow(0.0008, dt);
    this.punchX += this.punchVX * dt;
    this.punchY += this.punchVY * dt;

    this.shake = Math.max(0, this.shake - dt * 16);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.invert = Math.max(0, this.invert - dt * 6);
    if (this.ring > 0) {
      this.ring += dt * 4.2;
      if (this.ring > 1) this.ring = 0;
    }

    if (this.shockwaveMax > 0) {
      this.shockwave += dt * 1.35;
      if (this.shockwave > 1) {
        this.shockwave = 0;
        this.shockwaveMax = 0;
      }
    }
  }

  punch(kind: "perfect" | "good" | "miss"): void {
    if (kind === "perfect") {
      this.hitstop = 0.03;
      this.punchY -= 14;
      this.shake = 14;
      this.flash = 0.42;
      this.ring = 0.001;
    } else if (kind === "good") {
      this.hitstop = 0.018;
      this.punchY -= 8;
      this.shake = 8;
      this.flash = 0.22;
      this.ring = 0.001;
    } else {
      this.hitstop = 0.034;
      this.punchY += 8;
      this.shake = 10;
      this.flash = 0.1;
      this.invert = 0.2;
    }
  }

  bang(): void {
    this.hitstop = 0.08;
    this.shake = 18;
    this.flash = 1;
    this.invert = 0.5;
    this.shockwave = 0;
    this.shockwaveMax = 1;
  }

  reset(): void {
    this.hitstop = 0;
    this.punchX = 0;
    this.punchY = 0;
    this.punchVX = 0;
    this.punchVY = 0;
    this.shake = 0;
    this.rumble = 0;
    this.flash = 0;
    this.invert = 0;
    this.shockwave = 0;
    this.shockwaveMax = 0;
    this.ring = 0;
  }

  drawOverlays(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number): void {
    if (this.flash > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 90);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.35, `rgba(255,255,255,${this.flash * 0.45})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.ring > 0) {
      const r = lerp(10, 120, easeOut(this.ring));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${1 - this.ring})`;
      ctx.lineWidth = lerp(4, 0.8, this.ring);
      ctx.stroke();
    }

    if (this.shockwaveMax > 0) {
      const r = lerp(12, Math.hypot(w, h), easeOut(this.shockwave));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${1 - this.shockwave})`;
      ctx.lineWidth = lerp(10, 1, this.shockwave);
      ctx.stroke();
    }

    if (this.invert > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${clamp(this.invert * 0.35, 0, 0.35)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
