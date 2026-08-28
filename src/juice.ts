import { clamp, lerp } from "./math";
import { log } from "./debug";

const SHAKE_CAP = 5;
/** Miss red flash: ~125ms from full to gone. */
const HURT_DECAY = 8;

export class Juice {
  hitstop = 0;
  punchX = 0;
  punchY = 0;
  punchVX = 0;
  punchVY = 0;
  shake = 0;
  flash = 0;
  /** 1 → 0 red flash on miss (orb, ring, and universe). */
  hurt = 0;
  invert = 0;
  shockwave = 0;
  shockwaveMax = 0;
  ring = 0;

  get offsetX(): number {
    const s = Math.min(this.shake, SHAKE_CAP);
    const jitter = s > 0.15 ? (Math.random() - 0.5) * s : 0;
    return this.punchX + jitter;
  }

  get offsetY(): number {
    const s = Math.min(this.shake, SHAKE_CAP);
    const jitter = s > 0.15 ? (Math.random() - 0.5) * s : 0;
    return this.punchY + jitter;
  }

  update(dt: number): void {
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
    }

    this.punchVX += -this.punchX * 80 * dt;
    this.punchVY += -this.punchY * 80 * dt;
    this.punchVX *= Math.pow(0.0004, dt);
    this.punchVY *= Math.pow(0.0004, dt);
    this.punchX += this.punchVX * dt;
    this.punchY += this.punchVY * dt;

    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt * 3.6);
    const hurtBefore = this.hurt;
    this.hurt = Math.max(0, this.hurt - dt * HURT_DECAY);
    if (hurtBefore > 0.01 && this.hurt <= 0.01) {
      log("juice miss red flash done");
    }
    this.invert = Math.max(0, this.invert - dt * 7);
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
      this.hurt = 0;
      this.hitstop = 0.028;
      this.punchY -= 7;
      this.shake = 3.2;
      this.flash = 0.28;
      this.ring = 0.001;
    } else if (kind === "good") {
      this.hurt = 0;
      this.hitstop = 0.016;
      this.punchY -= 4;
      this.shake = 1.8;
      this.flash = 0.14;
      this.ring = 0.001;
    } else {
      this.hitstop = 0.028;
      this.punchY += 5;
      this.shake = 2.4;
      this.flash = 0;
      this.hurt = 1;
      log("juice miss red flash", { hurt: this.hurt, decayPerSec: HURT_DECAY, hitstop: this.hitstop });
    }
    log("juice punch", { kind, shake: this.shake, punchY: Number(this.punchY.toFixed(2)) });
  }

  streak(): void {
    this.hitstop = 0.03;
    this.flash = 0.38;
    this.shockwave = 0;
    this.shockwaveMax = 1;
    this.ring = 0.001;
    this.shake = 2.6;
    log("juice streak", { shake: this.shake });
  }

  silence(): void {
    this.hitstop = 0.018;
    this.punchY += 2;
    this.shake = 1.2;
    this.flash = 0.1;
    this.ring = 0.001;
  }

  voidHit(): void {
    this.hitstop = 0.04;
    this.punchY += 6;
    this.shake = 3.4;
    this.flash = 0.12;
    this.invert = 0.22;
  }

  bang(): void {
    this.hitstop = 0.07;
    this.shake = 4.5;
    this.flash = 0.85;
    this.invert = 0.28;
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
    this.flash = 0;
    this.hurt = 0;
    this.invert = 0;
    this.shockwave = 0;
    this.shockwaveMax = 0;
    this.ring = 0;
  }

  drawOverlays(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number): void {
    if (this.hurt > 0.01) {
      const a = this.hurt;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(160, Math.hypot(w, h) * 0.55));
      g.addColorStop(0, `rgba(255, 64, 48, ${a * 0.9})`);
      g.addColorStop(0.18, `rgba(255, 28, 22, ${a * 0.5})`);
      g.addColorStop(0.55, `rgba(200, 12, 16, ${a * 0.22})`);
      g.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (this.flash > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(140, Math.hypot(w, h) * 0.32));
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.35, `rgba(255,255,255,${this.flash * 0.32})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.ring > 0) {
      const r = lerp(10, 180, easeOut(this.ring));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${1 - this.ring})`;
      ctx.lineWidth = lerp(3.2, 0.8, this.ring);
      ctx.stroke();
    }

    if (this.shockwaveMax > 0) {
      const r = lerp(12, Math.hypot(w, h), easeOut(this.shockwave));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${(1 - this.shockwave) * 0.7})`;
      ctx.lineWidth = lerp(7, 1, this.shockwave);
      ctx.stroke();
    }

    if (this.invert > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${clamp(this.invert * 0.22, 0, 0.22)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
