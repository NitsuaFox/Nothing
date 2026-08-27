import { rand } from "./math";

export type ParticleKind = "burst" | "orbit" | "vacuum" | "star";

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: ParticleKind;
  angle: number;
  orbitR: number;
  spin: number;
};

export class Particles {
  list: Particle[] = [];

  spawnBurst(cx: number, cy: number, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const mag = rand(speed * 0.45, speed);
      this.list.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        life: rand(0.28, 0.7),
        maxLife: 0.7,
        size: rand(1.2, 3.2),
        kind: "burst",
        angle,
        orbitR: 0,
        spin: 0,
      });
    }
  }

  spawnOrbiters(cx: number, cy: number, count: number, radius: number): void {
    const existing = this.list.filter((p) => p.kind === "orbit").length;
    const need = Math.max(0, count - existing);
    for (let i = 0; i < need; i++) {
      const angle = rand(0, Math.PI * 2);
      const r = radius * rand(1.8, 3.4);
      this.list.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        life: 999,
        maxLife: 999,
        size: rand(1, 2.1),
        kind: "orbit",
        angle,
        orbitR: r,
        spin: rand(0.7, 1.8) * (Math.random() < 0.5 ? -1 : 1),
      });
    }
  }

  vacuumToward(cx: number, cy: number): void {
    for (const p of this.list) {
      if (p.kind === "star") continue;
      p.kind = "vacuum";
      p.life = Math.min(p.life, 0.45);
      p.maxLife = 0.45;
      const dx = cx - p.x;
      const dy = cy - p.y;
      p.vx = dx * 4;
      p.vy = dy * 4;
    }
  }

  spawnStars(cx: number, cy: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const dist = rand(20, 520);
      this.list.push({
        x: cx + Math.cos(angle) * dist * 0.15,
        y: cy + Math.sin(angle) * dist * 0.15,
        vx: Math.cos(angle) * rand(80, 340),
        vy: Math.sin(angle) * rand(80, 340),
        life: rand(1.1, 2.2),
        maxLife: 2.2,
        size: rand(0.8, 2.4),
        kind: "star",
        angle,
        orbitR: 0,
        spin: 0,
      });
    }
  }

  trimOrbiters(keep: number): void {
    let count = 0;
    for (const p of this.list) {
      if (p.kind !== "orbit") continue;
      count += 1;
      if (count > keep) {
        p.kind = "vacuum";
        p.life = 0.3;
        p.maxLife = 0.3;
      }
    }
  }

  clear(): void {
    this.list.length = 0;
  }

  update(dt: number, cx: number, cy: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }

      if (p.kind === "orbit") {
        p.angle += p.spin * dt;
        p.x = cx + Math.cos(p.angle) * p.orbitR;
        p.y = cy + Math.sin(p.angle) * p.orbitR;
        continue;
      }

      if (p.kind === "vacuum") {
        p.vx += (cx - p.x) * 18 * dt;
        p.vy += (cy - p.y) * 18 * dt;
      }

      if (p.kind === "burst") {
        p.vx *= Math.pow(0.12, dt);
        p.vy *= Math.pow(0.12, dt);
      }

      if (p.kind === "star") {
        p.vx *= Math.pow(0.55, dt);
        p.vy *= Math.pow(0.55, dt);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.list) {
      const fade = p.kind === "orbit" ? 0.85 : Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
