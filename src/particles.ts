import { rand } from "./math";

export type ParticleKind = "burst" | "orbit" | "vacuum" | "star";

export type Floater = {
  x: number;
  y: number;
  vy: number;
  text: string;
  life: number;
  maxLife: number;
  size: number;
};

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
  floaters: Floater[] = [];

  spawnFloater(x: number, y: number, text: string, size = 22): void {
    this.floaters.push({
      x,
      y,
      vy: size > 20 ? -78 : -42,
      text,
      life: size > 20 ? 1.05 : 1.25,
      maxLife: size > 20 ? 1.05 : 1.25,
      size,
    });
  }

  spawnBurst(cx: number, cy: number, count: number, speed: number, radius = 8): void {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const mag = rand(speed * 0.55, speed);
      const dist = radius + rand(2, 10);
      this.list.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        life: rand(0.45, 1.05),
        maxLife: 1.05,
        size: rand(1.8, 4.4),
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

  vacuumToward(cx: number, cy: number, kinds: ParticleKind[] = ["orbit", "burst"]): void {
    for (const p of this.list) {
      if (p.kind === "star") continue;
      if (!kinds.includes(p.kind)) continue;
      p.kind = "vacuum";
      p.life = Math.min(p.life, 0.55);
      p.maxLife = 0.55;
      const dx = cx - p.x;
      const dy = cy - p.y;
      p.vx = dx * 3.2;
      p.vy = dy * 3.2;
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
    this.floaters.length = 0;
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
        p.vx *= Math.pow(0.28, dt);
        p.vy *= Math.pow(0.28, dt);
      }

      if (p.kind === "star") {
        p.vx *= Math.pow(0.55, dt);
        p.vy *= Math.pow(0.55, dt);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= Math.pow(0.55, dt);
      if (f.life <= 0) this.floaters.splice(i, 1);
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

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const f of this.floaters) {
      const fade = Math.max(0, f.life / f.maxLife);
      ctx.globalAlpha = fade;
      ctx.font = `700 ${f.size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = Math.max(3, f.size * 0.18);
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = "#fff";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
}
