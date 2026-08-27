import { AudioEngine, type TapKind } from "./audio";
import { log } from "./debug";
import { Juice } from "./juice";
import { clamp, lerp } from "./math";
import {
  KISS,
  baseOrbRadius,
  drawOrb,
  drawPulseRing,
  pulseExpandEnd,
  pulseMaxRadius,
  pulseRadius,
} from "./orb";
import { Particles } from "./particles";
import { DISCOVERY_LABEL, loadFound, loadHidepth, loadHiscore, loadLives, loadRuns, saveFound, saveHidepth, saveHiscore, saveLives, saveRuns, type DiscoveryId } from "./progress";
import { type Relic, type RelicId, modsFrom, rollDraft } from "./relics";
import { Sky } from "./sky";
import type { Phase, PulseKind } from "./types";
import { submitScore } from "./wavedash";

const TITLE_FADE_END = 4.6;

function loadBest(): number {
  return loadHiscore();
}

function saveBest(score: number): void {
  saveHiscore(score);
}

function phaseFor(mass: number, banging: boolean, sparkMin: number): Phase {
  if (banging) return "bang";
  const table: { phase: Phase; min: number }[] = [
    { phase: "singularity", min: 22 },
    { phase: "giant", min: 15 },
    { phase: "star", min: 8 },
    { phase: "spark", min: sparkMin },
    { phase: "void", min: 0 },
  ];
  for (const row of table) {
    if (mass >= row.min) return row.phase;
  }
  return "void";
}

function strokeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 5;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
}

export class Game {
  readonly audio = new AudioEngine();
  readonly juice = new Juice();
  readonly particles = new Particles();
  readonly sky = new Sky();
  found = loadFound();
  lives = loadLives();
  discoveredThisRun: DiscoveryId[] = [];
  perfectStreak = 0;
  silences = 0;
  pulseIndex = 0;
  pulseKind: PulseKind = "create";
  whisper = "";
  whisperLife = 0;
  mode: "play" | "draft" | "dead" = "play";
  depth = 1;
  relics: RelicId[] = [];
  draft: Relic[] = [];
  createMissStreak = 0;
  voidStrikes = 0;
  universeFresh = true;
  deathReason = "";
  bestDepth = loadHidepth();
  runsPlayed = loadRuns();
  scorePop = 0;

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
  cycleArmed = false;
  awaitingFirstPulse = true;

  timeSinceTap = 0;
  entropyActive = false;
  bangT = 0;
  banging = false;
  bangScore = 0;
  bangHeadline = "A  U N I V E R S E";
  newBest = false;

  titleAlpha = 0;
  comboPop = 0;
  squashX = 1;
  squashY = 1;
  densify = 0;
  hitLabel = "";
  hitLabelLife = 0;
  windowGlow = 0;

  muted = false;

  constructor() {
    log("game construct", {
      best: this.best,
      bestDepth: this.bestDepth,
      lives: this.lives,
      remnants: this.sky.remnants.length,
      found: [...this.found],
    });
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.cx = w / 2;
    this.cy = h / 2;
    log("resize", { w, h, remnants: this.sky.remnants.length, found: this.found.size });
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

    void this.audio.unlock();

    if (this.mode === "dead") {
      this.startRun();
      this.started = true;
      this.awaitingFirstPulse = false;
      this.universeFresh = false;
      this.applyTap("perfect", 0, 0);
      this.beginNextCycle(1.6);
      log("first tap — universe begins", { depth: this.depth });
      return;
    }

    if (this.mode === "draft") {
      this.tryPickDraft(x, y);
      return;
    }

    if (this.banging) return;

    this.timeSinceTap = 0;
    if (this.entropyActive) {
      this.entropyActive = false;
      log("entropy end");
    }

    if (!this.started) {
      this.started = true;
      this.awaitingFirstPulse = false;
      this.universeFresh = false;
      this.applyTap("perfect", 0, 0);
      log("first tap — universe begins", { depth: this.depth });
      this.beginNextCycle(1.6);
      return;
    }

    if (this.universeFresh && this.mods().firstPulseFree) {
      this.universeFresh = false;
      this.hitThisCycle = true;
      this.applyTap("perfect", 0, 0);
      log("first light");
      this.beginNextCycle(0.35);
      return;
    }
    this.universeFresh = false;

    if (!this.cycleArmed || this.hitThisCycle) {
      log("tap ignored — pulse not open");
      return;
    }

    const progress = this.cycleProgress();
    const expandEnd = pulseExpandEnd(KISS);
    if (progress < expandEnd) {
      log("tap ignored — ring still expanding", { progress: Number(progress.toFixed(3)) });
      return;
    }

    const mods = this.mods();
    const orbR = this.orbRadius();
    const maxR = pulseMaxRadius(orbR, this.w, this.h);
    const ringR = pulseRadius(progress, orbR, maxR, KISS);
    const gap = Math.abs(ringR - orbR);
    const errorMs = (progress - KISS) * this.period * 1000;

    let kind: TapKind;
    if (progress <= KISS) {
      if (gap > mods.goodGap) {
        log("tap ignored — ring still far", { gapPx: Number(gap.toFixed(1)) });
        return;
      }
      kind = gap <= mods.perfectGap ? "perfect" : "good";
    } else if (errorMs <= 140) {
      kind = "perfect";
    } else if (errorMs <= 280) {
      kind = "good";
    } else {
      kind = "miss";
    }

    this.hitThisCycle = true;
    if (this.pulseKind === "void") {
      this.applyVoidStrike(errorMs, gap);
    } else {
      this.applyTap(kind, errorMs, gap);
    }
    this.beginNextCycle(kind === "miss" || this.pulseKind === "void" ? 0.2 : 0.1);
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
    this.hitLabelLife = Math.max(0, this.hitLabelLife - dt);
    this.whisperLife = Math.max(0, this.whisperLife - dt);
    this.sky.update(dt);
    this.scorePop = Math.max(0, this.scorePop - dt * 1.8);
    this.squashX = lerp(this.squashX, 1, 1 - Math.pow(0.0002, dt));
    this.squashY = lerp(this.squashY, 1, 1 - Math.pow(0.0002, dt));
    const mods = this.mods();
    const timeScale =
      frozen ? 0.08 : this.phase === "singularity" ? 0.55 * mods.alwaysSlow : this.phase === "bang" ? 0.7 : 1 * mods.alwaysSlow;
    const gdt = dt * timeScale;
    this.gameTime += gdt;

    this.particles.update(dt, this.cx, this.cy);

    if (this.mode === "draft" || this.mode === "dead") return;

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
      (this.phase === "spark" ? 4 : this.phase === "star" ? 8 : this.phase === "giant" ? 13 : this.phase === "singularity" ? 18 : 0) +
      this.mods().extraOrbit;
    if (wantOrbit > 0) {
      this.particles.spawnOrbiters(this.cx, this.cy, wantOrbit, this.orbRadius());
    } else {
      this.particles.trimOrbiters(0);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.w, this.h);
    this.sky.draw(ctx, this.w, this.h);

    const ox = this.juice.offsetX;
    const oy = this.juice.offsetY;
    const cx = this.cx;
    const cy = this.cy;
    const orbR = this.visualOrbRadius();
    this.windowGlow = 0;

    ctx.save();
    ctx.translate(ox, oy);

    if (this.started && !this.banging && this.mode === "play") {
      ctx.beginPath();
      ctx.arc(cx, cy, this.orbRadius() + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (this.started && !this.banging && this.mode === "play" && this.cycleArmed && this.gameTime >= this.cycleStart) {
      const p = this.cycleProgress();
      const maxR = pulseMaxRadius(this.orbRadius(), this.w, this.h);
      const ringR = pulseRadius(p, this.orbRadius(), maxR, KISS);
      const gap = Math.abs(ringR - this.orbRadius());
      const contracting = p >= pulseExpandEnd(KISS);
      const mods = this.mods();
      const nearKiss = contracting && p <= KISS + 0.08 && gap <= mods.goodGap;
      const voidPulse = this.pulseKind === "void";
      this.windowGlow = voidPulse ? 0 : nearKiss ? clamp(1 - gap / mods.goodGap, 0, 1) : 0;
      const alpha = p > 0.97 ? 0 : p < 0.04 ? p / 0.04 : nearKiss && !voidPulse ? 1 : 0.7;
      drawPulseRing(ctx, cx, cy, ringR, alpha, nearKiss && !voidPulse, this.pulseKind);
    }

    drawOrb(
      ctx,
      cx,
      cy,
      orbR,
      this.phase,
      1 + Math.sin(this.wallTime * 2.2) * 0.055 + this.windowGlow * 0.12,
      this.squashX,
      this.squashY,
      this.densify + this.windowGlow * 0.35 + clamp((this.combo - 8) / 28, 0, 0.4),
    );

    this.particles.draw(ctx);
    ctx.restore();

    this.juice.drawOverlays(ctx, this.w, this.h, cx + ox, cy + oy);
    this.drawHud(ctx);
    if (this.mode === "draft") this.drawDraft(ctx);
    if (this.mode === "dead") this.drawDead(ctx);
    this.drawMute(ctx);
  }

  private cycleProgress(): number {
    if (this.period <= 0) return 1;
    return clamp((this.gameTime - this.cycleStart) / this.period, 0, 1.5);
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

  private applyTap(kind: TapKind, errorMs: number, gap: number): void {
    const r = this.orbRadius();
    const mods = this.mods();
    this.hitLabel = kind === "perfect" ? "PERFECT" : kind === "good" ? "GOOD" : "MISS";
    this.hitLabelLife = 1.5;

    if (kind === "perfect") {
      this.combo += 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      this.perfectStreak += 1;
      this.createMissStreak = 0;
      const add = (1 + Math.min(this.combo, 24) * 0.04) * mods.hitMassMul;
      this.mass += add;
      this.massCreated += add;
      this.squashX = 1.28;
      this.squashY = 0.72;
      this.particles.spawnBurst(this.cx, this.cy, 22 + Math.min(this.combo, 20), 280 + this.combo * 10, r);
      this.sky.plantBurst(this.w, this.h, this.cx, this.cy, this.perfectStreak % mods.resonanceEvery === 0 ? 3 : 1, 40 + this.combo * 3);
      this.comboPop = 1;
      this.addScore(12 * this.combo);
      if (this.perfectStreak > 0 && this.perfectStreak % mods.resonanceEvery === 0) {
        this.hitLabel = "RESONANCE";
        this.mass += 0.6 * mods.hitMassMul;
        this.massCreated += 0.6;
        this.addScore(40);
        this.audio.resonance(this.combo);
        this.discover("resonance");
        log("resonance", { streak: this.perfectStreak, combo: this.combo });
      }
    } else if (kind === "good") {
      this.combo += 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      this.perfectStreak = 0;
      this.createMissStreak = 0;
      const add = 0.55 * mods.hitMassMul;
      this.mass += add;
      this.massCreated += add;
      this.squashX = 1.14;
      this.squashY = 0.84;
      this.particles.spawnBurst(this.cx, this.cy, 14, 200, r);
      this.sky.plantBurst(this.w, this.h, this.cx, this.cy, 1, 28);
      this.comboPop = 0.85;
      this.addScore(6 * this.combo);
    } else {
      if (mods.missHalveCombo) this.combo = Math.floor(this.combo / 2);
      else this.combo = 0;
      this.perfectStreak = 0;
      this.createMissStreak += 1;
      this.mass = Math.max(0, this.mass - 0.45);
      this.squashX = 0.78;
      this.squashY = 1.22;
      this.particles.vacuumToward(this.cx, this.cy, ["orbit"]);
      this.particles.spawnBurst(this.cx, this.cy, 10, 90, r);
    }

    const tempo = mods.tempoFromCombo ? lerp(1.18, 0.58, clamp(this.combo / 32, 0, 1)) : 1.05;
    this.period = (this.phase === "giant" ? tempo * 1.16 : tempo) * mods.periodMul;
    this.juice.punch(kind);
    this.audio.tap(kind, this.combo);

    log(
      `tap kind=${kind} combo=${this.combo} gapPx=${gap.toFixed(1)} windowMs=${errorMs.toFixed(1)} mass=${this.mass.toFixed(2)} score=${this.score} depth=${this.depth}`,
    );

    if (kind === "miss") this.checkDeath("miss");
    if (this.mass >= this.bangNeed() && !this.banging) this.startBang();
  }

  private beginNextCycle(delay: number): void {
    this.cycleStart = this.gameTime + delay;
    this.hitThisCycle = true;
    this.cycleArmed = false;
    log("pulse queued", { delay });
  }

  private updatePulse(): void {
    if (!this.started || this.awaitingFirstPulse) return;

    if (!this.cycleArmed) {
      if (this.gameTime >= this.cycleStart) {
        this.cycleArmed = true;
        this.cycleStart = this.gameTime;
        this.hitThisCycle = false;
        this.pulseIndex += 1;
        this.pulseKind = this.nextPulseKind();
        if (this.pulseKind === "void") this.audio.pulseCue("void");
        log("pulse armed", { index: this.pulseIndex, kind: this.pulseKind });
      }
      return;
    }

    if (this.hitThisCycle) return;
    if (this.cycleProgress() >= 1) {
      this.hitThisCycle = true;
      if (this.pulseKind === "void") {
        this.applySilence();
      } else {
        this.applyTap("miss", (1 - KISS) * this.period * 1000, 999);
        log("pulse timeout miss");
      }
      this.beginNextCycle(0.2);
    }
  }

  private nextPulseKind(): PulseKind {
    if (this.pulseIndex < 5) return "create";
    const base = this.phase === "singularity" ? 3 : this.phase === "giant" ? 4 : 5;
    const every = Math.max(2, Math.round(base * this.mods().voidEveryMul));
    return this.pulseIndex % every === 0 ? "void" : "create";
  }

  private applySilence(): void {
    const mods = this.mods();
    this.silences += 1;
    this.createMissStreak = 0;
    this.combo += mods.silenceCombo;
    this.peakCombo = Math.max(this.peakCombo, this.combo);
    this.mass += mods.silenceMass;
    this.massCreated += mods.silenceMass;
    this.hitLabel = "SILENCE";
    this.hitLabelLife = 1.4;
    this.comboPop = 0.9;
    this.squashX = 0.92;
    this.squashY = 1.08;
    this.sky.plantBurst(this.w, this.h, this.cx, this.cy, 2, 70);
    this.juice.silence();
    this.audio.silence();
    this.addScore(22 * Math.max(1, this.combo));
    this.discover("silence");
    log("silence", { silences: this.silences, combo: this.combo, mass: Number(this.mass.toFixed(2)), score: this.score });
    if (this.mass >= this.bangNeed() && !this.banging) this.startBang();
  }

  private applyVoidStrike(errorMs: number, gap: number): void {
    this.combo = 0;
    this.perfectStreak = 0;
    this.voidStrikes += 1;
    this.mass = Math.max(0, this.mass - 1.4);
    this.hitLabel = "VOID";
    this.hitLabelLife = 1.3;
    this.squashX = 0.72;
    this.squashY = 1.28;
    this.particles.vacuumToward(this.cx, this.cy, ["orbit", "burst"]);
    this.juice.voidHit();
    this.audio.voidHit();
    this.discover("voidtaken");
    log(`tap kind=void strikes=${this.voidStrikes} gapPx=${gap.toFixed(1)} windowMs=${errorMs.toFixed(1)} mass=${this.mass.toFixed(2)}`);
    this.checkDeath("void");
  }

  private discover(id: DiscoveryId): void {
    if (this.found.has(id)) return;
    this.found.add(id);
    this.discoveredThisRun.push(id);
    saveFound(this.found);
    this.whisper = DISCOVERY_LABEL[id];
    this.whisperLife = 1.8;
    log("discovery", { id, label: DISCOVERY_LABEL[id] });
  }

  private setPhaseWhisper(phase: Phase): void {
    if (phase === "spark") this.discover("spark");
    if (phase === "star") this.discover("star");
    if (phase === "giant") this.discover("giant");
    if (phase === "singularity") this.discover("singularity");
    if (phase === "spark" || phase === "star" || phase === "giant" || phase === "singularity") {
      this.whisper = DISCOVERY_LABEL[phase];
      this.whisperLife = 1.6;
      this.audio.phaseSting(phase);
    }
  }

  private updateEntropy(dt: number): void {
    if (!this.started || this.mass <= 0) return;
    if (this.timeSinceTap < 3.2) return;
    if (!this.entropyActive) {
      this.entropyActive = true;
      log("entropy start", { mass: Number(this.mass.toFixed(2)) });
    }
    this.mass = Math.max(0, this.mass - 2.4 * dt * this.mods().entropyMul);
    if (this.mass <= 0) this.checkDeath("entropy");
    if (Math.random() < dt * 6) {
      this.particles.vacuumToward(this.cx, this.cy);
    }
  }

  private syncPhase(): void {
    const next = phaseFor(this.mass, this.banging, this.mods().sparkMin);
    if (next !== this.phase) {
      log("phase", { from: this.phase, to: next, mass: Number(this.mass.toFixed(2)) });
      this.phase = next;
      this.densify = next === "singularity" ? 0.7 : 0;
      this.setPhaseWhisper(next);
    }
    if (this.phase === "singularity") {
      this.densify = lerp(this.densify, 0.85, 0.08);
    } else if (!this.banging) {
      this.densify = lerp(this.densify, 0, 0.12);
    }
  }

  private startBang(): void {
    const mods = this.mods();
    this.banging = true;
    this.bangT = 0;
    this.phase = "bang";
    this.addScore(80 * this.depth * mods.bangScoreMul + this.sky.born.length * 2 * mods.skyScoreMul);
    this.bangScore = this.score;
    this.newBest = this.bangScore > this.best;
    this.universes += 1;
    this.lives += 1;
    saveLives(this.lives);
    this.discover("universe");
    const story = [...this.discoveredThisRun].reverse().find((id) => id !== "universe");
    this.bangHeadline = this.newBest ? "N E W" : story ? DISCOVERY_LABEL[story] : `DEPTH ${this.depth}`;
    this.juice.bang();
    this.audio.bang();
    this.particles.spawnStars(this.cx, this.cy, 90);
    if (mods.keepSky > 0) this.sky.carry(mods.keepSky);
    else this.sky.collapse();
    log("bang", {
      score: this.bangScore,
      depth: this.depth,
      relics: this.relics,
      peakCombo: this.peakCombo,
      silences: this.silences,
    });
  }

  private updateBang(dt: number): void {
    this.bangT += dt;
    this.densify = this.bangT < 0.55 ? lerp(0.4, 1, this.bangT / 0.55) : lerp(1, 0, clamp((this.bangT - 0.55) / 0.4, 0, 1));
    if (this.bangT > 2.5) {
      this.openDraft();
    }
  }

  private resetUniverse(hard: boolean): void {
    log("reset universe", { hard, depth: this.depth, relics: this.relics.length });
    const mods = this.mods();
    this.banging = false;
    this.bangT = 0;
    this.mass = mods.startMass;
    this.massCreated = 0;
    this.combo = 0;
    this.perfectStreak = 0;
    this.pulseIndex = 0;
    this.pulseKind = "create";
    this.phase = this.mass >= mods.sparkMin ? "spark" : "void";
    this.started = true;
    this.awaitingFirstPulse = false;
    this.hitThisCycle = false;
    this.cycleArmed = false;
    this.cycleStart = this.gameTime + 0.45;
    this.period = 1.12 * mods.periodMul;
    this.timeSinceTap = 0;
    this.entropyActive = false;
    this.densify = 0;
    this.universeFresh = true;
    this.createMissStreak = 0;
    this.particles.trimOrbiters(0);
    if (mods.keepSky <= 0) this.sky.clearBorn();
    if (hard) this.particles.clear();
    this.juice.reset();
  }

  mods() {
    return modsFrom(this.relics);
  }

  pickRelic(index: number): void {
    if (this.mode !== "draft") return;
    const relic = this.draft[index];
    if (!relic) return;
    this.relics.push(relic.id);
    log("relic taken", { id: relic.id, name: relic.name, depth: this.depth + 1, relics: this.relics });
    this.whisper = relic.name;
    this.whisperLife = 1.6;
    this.depth += 1;
    this.mode = "play";
    this.draft = [];
    this.resetUniverse(false);
  }

  private bangNeed(): number {
    return this.mods().bangMass + (this.depth - 1) * 3;
  }

  private addScore(base: number): void {
    const gained = Math.max(0, Math.round(base * this.mods().scoreMul * this.depth));
    this.score += gained;
    this.scorePop = 1;
  }

  private lethal(): boolean {
    return this.depth >= 2;
  }

  private checkDeath(reason: "miss" | "void" | "entropy"): void {
    if (this.mode !== "play" || this.banging || !this.lethal()) return;
    if (reason === "miss" && this.createMissStreak < 3) return;
    if (reason === "void" && this.voidStrikes < 3) return;
    if (reason === "entropy" && this.mass > 0) return;
    this.die(reason);
  }

  private die(reason: string): void {
    if (this.mode === "dead") return;
    this.mode = "dead";
    this.banging = false;
    this.cycleArmed = false;
    this.deathReason = reason;
    this.runsPlayed += 1;
    saveRuns(this.runsPlayed);
    this.newBest = this.score > this.best;
    if (this.newBest) {
      this.best = this.score;
      saveBest(this.best);
    }
    if (this.depth > this.bestDepth) {
      this.bestDepth = this.depth;
      saveHidepth(this.bestDepth);
    }
    this.sky.collapse();
    this.juice.voidHit();
    this.audio.voidHit();
    submitScore(this.score);
    log("run over", {
      reason,
      score: this.score,
      depth: this.depth,
      relics: this.relics,
      best: this.best,
      newBest: this.newBest,
    });
  }

  private startRun(): void {
    log("run start");
    this.mode = "play";
    this.depth = 1;
    this.relics = [];
    this.draft = [];
    this.score = 0;
    this.peakCombo = 0;
    this.silences = 0;
    this.voidStrikes = 0;
    this.createMissStreak = 0;
    this.discoveredThisRun = [];
    this.universes = 0;
    this.deathReason = "";
    this.started = false;
    this.awaitingFirstPulse = true;
    this.banging = false;
    this.mass = 0;
    this.combo = 0;
    this.phase = "void";
    this.pulseIndex = 0;
    this.hitThisCycle = false;
    this.cycleArmed = false;
    this.universeFresh = true;
    this.particles.clear();
    this.juice.reset();
  }

  private openDraft(): void {
    this.banging = false;
    this.mode = "draft";
    this.draft = rollDraft(this.depth + 1, this.relics);
    this.cycleArmed = false;
    log("draft", { depth: this.depth + 1, choices: this.draft.map((r) => r.id) });
  }

  private tryPickDraft(x: number, y: number): void {
    const cards = this.draftLayout();
    const hit = cards.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (hit >= 0) this.pickRelic(hit);
    else this.pickRelic(1);
  }

  private draftLayout(): { relic: Relic; x: number; y: number; w: number; h: number }[] {
    const w = Math.min(460, this.w - 48);
    const h = 68;
    const x = this.cx - w / 2;
    const startY = this.cy - 20;
    return this.draft.map((relic, i) => ({ relic, x, y: startY + i * 76, w, h }));
  }

  private drawDraft(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.55;
    ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(`DEPTH ${this.depth + 1}`, this.cx, this.cy - 118);
    ctx.globalAlpha = 0.9;
    ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("TAKE ONE", this.cx, this.cy - 96);
    ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
    strokeText(ctx, String(this.score), this.cx, this.cy - 62);

    for (const card of this.draftLayout()) {
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.font = "700 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(card.relic.name, this.cx, card.y + 24);
      ctx.globalAlpha = 0.55;
      ctx.font = "500 12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(card.relic.line, this.cx, card.y + 46);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawDead(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = "700 56px ui-sans-serif, system-ui, sans-serif";
    strokeText(ctx, String(this.score), this.cx, this.cy - 18);
    ctx.font = "500 12px ui-sans-serif, system-ui, sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillText(this.newBest ? "N E W  B E S T" : `DEPTH ${this.depth}`, this.cx, this.cy + 28);
    ctx.globalAlpha = 0.4;
    ctx.fillText(this.newBest ? `DEPTH ${this.depth}` : `BEST ${this.best}`, this.cx, this.cy + 48);
    if (this.relics.length > 0) {
      ctx.fillText(this.relics.slice(0, 8).join("  ·  "), this.cx, this.cy + 72);
    }
    ctx.globalAlpha = 0.35;
    ctx.fillText("TAP  TO  BEGIN", this.cx, this.h - 36);
    ctx.restore();
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

    if (this.titleAlpha > 0.01 && !this.banging && !this.started) {
      ctx.globalAlpha = this.titleAlpha;
      ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("N O T H I N G", this.cx, this.cy - 42);
      ctx.globalAlpha = 1;
    }

    if (this.whisperLife > 0 && this.whisper !== this.hitLabel && this.mode === "play") {
      ctx.globalAlpha = clamp(this.whisperLife / 0.5, 0, 0.7);
      ctx.font = "500 12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(this.whisper, this.cx, Math.max(36, this.cy - this.orbRadius() - 64));
      ctx.globalAlpha = 1;
    }

    if (!this.banging && this.hitLabelLife > 0 && this.mode === "play") {
      ctx.globalAlpha = clamp(this.hitLabelLife / 0.4, 0, 1);
      ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
      strokeText(ctx, this.hitLabel, this.cx, this.cy - this.orbRadius() - 36);
      ctx.globalAlpha = 1;
    }

    if (this.combo >= 1 && !this.banging && this.mode === "play") {
      const s = 1 + this.comboPop * 0.55;
      ctx.save();
      ctx.translate(this.cx, this.cy + this.orbRadius() + 42);
      ctx.scale(s, s);
      ctx.font = "700 36px ui-sans-serif, system-ui, sans-serif";
      ctx.globalAlpha = 0.95;
      strokeText(ctx, String(this.combo), 0, 0);
      ctx.restore();
    }

    if (this.mode === "play" && this.started) {
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.4 + this.scorePop * 0.5;
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(String(this.score), this.cx, 28);
      ctx.globalAlpha = 0.28;
      ctx.font = "500 10px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(`DEPTH ${this.depth}`, this.cx, 44);
    }

    ctx.globalAlpha = 0.35;
    ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    const bestLabel = this.best > 0 ? `best ${this.best}` : "";
    if (bestLabel) ctx.fillText(bestLabel, 16, this.h - 18);
    ctx.textAlign = "right";
    if (this.relics.length > 0) {
      ctx.fillText(`${this.relics.length} relic${this.relics.length === 1 ? "" : "s"}`, this.w - 16, this.h - 18);
    } else if (this.universes > 0) {
      ctx.fillText(`${this.universes} universe${this.universes === 1 ? "" : "s"}`, this.w - 16, this.h - 18);
    }
    ctx.globalAlpha = 1;

    if (this.banging && this.bangT > 0.75 && this.mode === "play") {
      const fade = clamp((this.bangT - 0.75) / 0.25, 0, 1) * (this.bangT > 2.4 ? 1 - clamp((this.bangT - 2.4) / 0.6, 0, 1) : 1);
      ctx.globalAlpha = fade;
      ctx.textAlign = "center";
      ctx.font = "700 56px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(String(this.bangScore), this.cx, this.cy - 8);
      ctx.font = "500 12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(this.bangHeadline, this.cx, this.cy + 32);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawMute(ctx: CanvasRenderingContext2D): void {
    const { x, y, s } = this.muteRect();
    const cx = x + s / 2;
    const cy = y + s / 2;
    ctx.save();
    ctx.globalAlpha = 0.42;
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
