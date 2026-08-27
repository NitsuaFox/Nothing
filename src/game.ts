import { AudioEngine, type TapKind } from "./audio";
import { log } from "./debug";
import { Juice } from "./juice";
import { clamp, lerp } from "./math";
import { baseOrbRadius, drawOrb, drawPulseRing, pulseMaxRadius, pulseRadius } from "./orb";
import { Particles } from "./particles";
import type { Phase } from "./types";

const BEST_KEY = "nothing:best";
const KISS = 0.82;
const BANG_MASS = 28;
const TITLE_FADE_END = 4.6;

const PHASE_AT: { phase: Phase; min: number }[] = [
  { phase: "singularity", min: 22 },
  { phase: "giant", min: 15 },
  { phase: "star", min: 8 },
  { phase: "spark", min: 3 },
  { phase: "void", min: 0 },
];

function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
    log("best saved", { score });
  } catch (error) {
    log("best save failed", { error: String(error) });
  }
}

function phaseFor(mass: number, banging: boolean): Phase {
  if (banging) return "bang";
  for (const row of PHASE_AT) {
    if (mass >= row.min) return row.phase;
  }
  return "void";
}

export class Game {
  readonly audio = new AudioEngine();
  readonly juice = new Juice();
  readonly particles = new Particles();

  w = 1;
  h = 1;
  cx = 0.5;
  cy = 0.5;

  started = false;
  mass = 0;
  massCreated = 0;
  combo = 0;
  peakCombo = 0;
  score = 0;
  best = loadBest();
  universes = 0;
  phase: Phase = "void";

  gameTime = 0;
  wallTime = 0;
  cycleStart = 0;
  period = 1.12;
  hitThisCycle = false;
  awaitingFirstPulse = true;

  timeSinceTap = 0;
  entropyActive = false;
  bangT = 0;
  banging = false;
  bangScore = 0;
  newBest = false;

  titleAlpha = 0;
  comboPop = 0;
  squashX = 1;
  squashY = 1;
  densify = 0;

  muted = false;

  constructor() {
    log("game construct", { best: this.best });
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.cx = w / 2;
    this.cy = h / 2;
    log("resize", { w, h });
  }

  muteRect(): { x: number; y: number; s: number } {
    const s = 44;
    return { x: this.w - s - 10, y: 10, s };
  }

  async tap(x: number, y: number): Promise<void> {
    const mute = this.muteRect();
    if (x >= mute.x && x <= mute.x + mute.s && y >= mute.y && y <= mute.y + mute.s) {
      this.toggleMute();
      return;
    }

    await this.audio.unlock();

    if (this.banging) {
      if (this.bangT > 2.1) {
        this.resetUniverse(false);
      }
      return;
    }

    this.timeSinceTap = 0;
    if (this.entropyActive) {
      this.entropyActive = false;
      log("entropy end");
    }

    if (!this.started) {
      this.started = true;
      this.awaitingFirstPulse = false;
      this.cycleStart = this.gameTime;
      this.hitThisCycle = true;
      this.applyTap("perfect", 0);
      log("first tap — universe begins");
      this.beginNextCycle(0.08);
      return;
    }

    if (this.hitThisCycle) {
      log("tap ignored — already hit this pulse");
      return;
    }

    const progress = this.cycleProgress();
    const errorMs = (progress - KISS) * this.period * 1000;
    const perfectMs = this.perfectWindowMs();
    const goodMs = perfectMs * 2.35;
    const abs = Math.abs(errorMs);

    let kind: TapKind;
    if (abs <= perfectMs / 2) kind = "perfect";
    else if (abs <= goodMs / 2) kind = "good";
    else kind = "miss";

    this.hitThisCycle = true;
    this.applyTap(kind, errorMs);
    this.beginNextCycle(kind === "miss" ? 0.16 : 0.05);
  }

  toggleMute(): void {
    this.muted = this.audio.toggleMute();
  }

  update(dt: number): void {
    this.wallTime += dt;
    this.juice.rumble = this.phase === "giant" ? 1.6 : this.phase === "singularity" ? 2.4 : 0;
    const frozen = this.juice.hitstop > 0;
    this.juice.update(dt);

    this.updateTitle();
    this.comboPop = Math.max(0, this.comboPop - dt * 2.8);
    this.squashX = lerp(this.squashX, 1, 1 - Math.pow(0.0002, dt));
    this.squashY = lerp(this.squashY, 1, 1 - Math.pow(0.0002, dt));
    const timeScale = frozen ? 0.08 : this.phase === "singularity" ? 0.55 : this.phase === "bang" ? 0.7 : 1;
    const gdt = dt * timeScale;
    this.gameTime += gdt;

    this.particles.update(frozen ? dt * 0.2 : gdt, this.cx, this.cy);

    if (this.banging) {
      this.updateBang(gdt);
      return;
    }

    this.timeSinceTap += gdt;
    this.updateEntropy(gdt);
    this.updatePulse();
    this.syncPhase();
    this.audio.setMass(this.mass, this.phase);

    const wantOrbit =
      this.phase === "spark" ? 4 : this.phase === "star" ? 8 : this.phase === "giant" ? 13 : this.phase === "singularity" ? 18 : 0;
    if (wantOrbit > 0) {
      this.particles.spawnOrbiters(this.cx, this.cy, wantOrbit, this.orbRadius());
    } else {
      this.particles.trimOrbiters(0);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.w, this.h);

    const ox = this.juice.offsetX;
    const oy = this.juice.offsetY;
    const cx = this.cx + ox;
    const cy = this.cy + oy;
    const orbR = this.visualOrbRadius();

    this.particles.draw(ctx);

    if (this.started && !this.banging) {
      ctx.beginPath();
      ctx.arc(cx, cy, this.orbRadius() + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (this.started && !this.banging && !this.awaitingFirstPulse && this.gameTime >= this.cycleStart) {
      const p = this.cycleProgress();
      const maxR = pulseMaxRadius(this.orbRadius(), this.w, this.h);
      const ringR = pulseRadius(p, this.orbRadius(), maxR, KISS);
      const nearKiss = Math.abs(p - KISS) < 0.08;
      const alpha = p > 0.97 ? 0 : p < 0.04 ? p / 0.04 : nearKiss ? 1 : 0.72;
      drawPulseRing(ctx, cx, cy, ringR, alpha, nearKiss);
    }

    drawOrb(
      ctx,
      cx,
      cy,
      orbR,
      this.phase,
      1 + Math.sin(this.wallTime * 2.2) * 0.055,
      this.squashX,
      this.squashY,
      this.densify,
    );

    this.juice.drawOverlays(ctx, this.w, this.h, cx, cy);
    this.drawHud(ctx);
    this.drawMute(ctx);
  }

  private cycleProgress(): number {
    if (this.period <= 0) return 1;
    return clamp((this.gameTime - this.cycleStart) / this.period, 0, 1.5);
  }

  private perfectWindowMs(): number {
    return lerp(90, 46, clamp(this.combo / 28, 0, 1));
  }

  private orbRadius(): number {
    return baseOrbRadius(this.mass);
  }

  private visualOrbRadius(): number {
    if (!this.banging) return this.orbRadius() * (1 - this.densify * 0.45);
    if (this.bangT < 0.55) {
      return lerp(this.orbRadius(), 2.2, this.bangT / 0.55);
    }
    if (this.bangT < 0.7) {
      return lerp(2.2, Math.max(this.w, this.h), (this.bangT - 0.55) / 0.15);
    }
    return 7;
  }

  private applyTap(kind: TapKind, errorMs: number): void {
    if (kind === "perfect") {
      this.combo += 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      const add = 1 + Math.min(this.combo, 24) * 0.04;
      this.mass += add;
      this.massCreated += add;
      this.squashX = 1.18;
      this.squashY = 0.82;
      this.particles.spawnBurst(this.cx, this.cy, 14 + Math.min(this.combo, 18), 220 + this.combo * 8);
      this.comboPop = 1;
    } else if (kind === "good") {
      const add = 0.45;
      this.mass += add;
      this.massCreated += add;
      this.squashX = 1.08;
      this.squashY = 0.9;
      this.particles.spawnBurst(this.cx, this.cy, 8, 160);
      this.comboPop = 0.7;
    } else {
      this.combo = 0;
      this.mass = Math.max(0, this.mass - 1.15);
      this.squashX = 0.82;
      this.squashY = 1.18;
      this.particles.vacuumToward(this.cx, this.cy);
      this.particles.spawnBurst(this.cx, this.cy, 5, 70);
    }

    this.score = Math.floor(this.massCreated * 10 + this.peakCombo * 5);
    this.period = lerp(1.12, 0.52, clamp(this.combo / 32, 0, 1));
    this.juice.punch(kind);
    this.audio.tap(kind, this.combo);

    log(`tap kind=${kind} combo=${this.combo} windowMs=${errorMs.toFixed(1)} mass=${this.mass.toFixed(2)} score=${this.score}`);

    if (this.mass >= BANG_MASS && !this.banging) {
      this.startBang();
    }
  }

  private beginNextCycle(delay: number): void {
    this.cycleStart = this.gameTime + delay;
    this.hitThisCycle = false;
  }

  private updatePulse(): void {
    if (!this.started || this.awaitingFirstPulse) return;
    if (this.gameTime < this.cycleStart) return;
    const progress = this.cycleProgress();
    if (progress >= 1 && !this.hitThisCycle) {
      this.hitThisCycle = true;
      this.applyTap("miss", (1 - KISS) * this.period * 1000);
      log("pulse timeout miss");
      this.beginNextCycle(0.12);
    }
  }

  private updateEntropy(dt: number): void {
    if (!this.started || this.mass <= 0) return;
    if (this.timeSinceTap < 1.8) return;
    if (!this.entropyActive) {
      this.entropyActive = true;
      log("entropy start", { mass: Number(this.mass.toFixed(2)) });
    }
    this.mass = Math.max(0, this.mass - 2.4 * dt);
    if (Math.random() < dt * 6) {
      this.particles.vacuumToward(this.cx, this.cy);
    }
  }

  private syncPhase(): void {
    const next = phaseFor(this.mass, this.banging);
    if (next !== this.phase) {
      log("phase", { from: this.phase, to: next, mass: Number(this.mass.toFixed(2)) });
      this.phase = next;
      this.densify = next === "singularity" ? 0.7 : 0;
    }
    if (this.phase === "singularity") {
      this.densify = lerp(this.densify, 0.85, 0.08);
    } else if (!this.banging) {
      this.densify = lerp(this.densify, 0, 0.12);
    }
  }

  private startBang(): void {
    this.banging = true;
    this.bangT = 0;
    this.phase = "bang";
    this.bangScore = this.score;
    this.newBest = this.bangScore > this.best;
    if (this.newBest) {
      this.best = this.bangScore;
      saveBest(this.best);
    }
    this.universes += 1;
    this.juice.bang();
    this.audio.bang();
    this.particles.spawnStars(this.cx, this.cy, 90);
    log("bang", { score: this.bangScore, peakCombo: this.peakCombo, universes: this.universes, newBest: this.newBest });
  }

  private updateBang(dt: number): void {
    this.bangT += dt;
    this.densify = this.bangT < 0.55 ? lerp(0.4, 1, this.bangT / 0.55) : lerp(1, 0, clamp((this.bangT - 0.55) / 0.4, 0, 1));
    if (this.bangT > 3.2) {
      this.resetUniverse(false);
    }
  }

  private resetUniverse(hard: boolean): void {
    log("reset universe", { hard, universes: this.universes });
    this.banging = false;
    this.bangT = 0;
    this.mass = 0;
    this.massCreated = 0;
    this.combo = 0;
    this.peakCombo = 0;
    this.score = 0;
    this.phase = "void";
    this.started = true;
    this.awaitingFirstPulse = false;
    this.hitThisCycle = false;
    this.cycleStart = this.gameTime + 0.25;
    this.period = 1.12;
    this.timeSinceTap = 0;
    this.entropyActive = false;
    this.densify = 0;
    this.particles.trimOrbiters(0);
    if (hard) this.particles.clear();
    this.juice.reset();
  }

  private updateTitle(): void {
    const t = this.wallTime;
    if (t < 0.5) this.titleAlpha = 0;
    else if (t < 1.6) this.titleAlpha = (t - 0.5) / 1.1;
    else if (t < 3.1) this.titleAlpha = 1;
    else if (t < TITLE_FADE_END) this.titleAlpha = 1 - (t - 3.1) / (TITLE_FADE_END - 3.1);
    else this.titleAlpha = 0;
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";

    if (this.titleAlpha > 0.01 && !this.banging) {
      ctx.globalAlpha = this.titleAlpha;
      ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("N O T H I N G", this.cx, this.cy - 42);
      ctx.globalAlpha = 1;
    }

    if (this.combo >= 2 && !this.banging) {
      const s = 1 + this.comboPop * 0.45;
      ctx.save();
      ctx.translate(this.cx, this.cy + this.orbRadius() + 36);
      ctx.scale(s, s);
      ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
      ctx.globalAlpha = 0.92;
      ctx.fillText(String(this.combo), 0, 0);
      ctx.restore();
    }

    ctx.globalAlpha = 0.35;
    ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    const bestLabel = this.best > 0 ? `best ${this.best}` : "";
    if (bestLabel) ctx.fillText(bestLabel, 16, this.h - 18);
    ctx.textAlign = "right";
    if (this.universes > 0) {
      ctx.fillText(`${this.universes} universe${this.universes === 1 ? "" : "s"}`, this.w - 16, this.h - 18);
    }
    ctx.globalAlpha = 1;

    if (this.banging && this.bangT > 0.75) {
      const fade = clamp((this.bangT - 0.75) / 0.25, 0, 1) * (this.bangT > 2.4 ? 1 - clamp((this.bangT - 2.4) / 0.6, 0, 1) : 1);
      ctx.globalAlpha = fade;
      ctx.textAlign = "center";
      ctx.font = "700 56px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(String(this.bangScore), this.cx, this.cy - 8);
      ctx.font = "500 12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(this.newBest ? "N E W" : "A  U N I V E R S E", this.cx, this.cy + 32);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawMute(ctx: CanvasRenderingContext2D): void {
    const { x, y, s } = this.muteRect();
    const cx = x + s / 2;
    const cy = y + s / 2;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx - 3, cy - 5);
    ctx.lineTo(cx - 3, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 1, cy, 6, -0.6, 0.6);
    ctx.stroke();
    if (this.muted) {
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 9);
      ctx.lineTo(cx + 8, cy - 9);
      ctx.stroke();
    }
    ctx.restore();
  }
}
