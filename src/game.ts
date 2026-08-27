import { AudioEngine, type TapKind } from "./audio";
import { log } from "./debug";
import { depthMods, depthWord, type DepthMods } from "./depth";
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
import {
  DISCOVERY_LABEL,
  DISCOVERY_ORDER,
  loadFound,
  loadHidepth,
  loadHiscore,
  loadRuns,
  saveFound,
  saveHidepth,
  saveHiscore,
  saveRuns,
  type DiscoveryId,
} from "./progress";
import { formatMul, scoreGain, streakJustHit, streakMul } from "./scoring";
import { Sky } from "./sky";
import type { Phase, PulseKind } from "./types";
import { submitScore } from "./wavedash";

const TITLE_FADE_END = 4.6;
const MAX_HEARTS = 3;

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

function strokeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width = 5): void {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = width;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
}

const UI_FONT = "ui-sans-serif, system-ui, sans-serif";

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${UI_FONT}`;
}

export class Game {
  readonly audio = new AudioEngine();
  readonly juice = new Juice();
  readonly particles = new Particles();
  readonly sky = new Sky();
  found = loadFound();
  hearts = MAX_HEARTS;
  discoveredThisRun: DiscoveryId[] = [];
  perfectStreak = 0;
  silences = 0;
  pulseIndex = 0;
  pulseKind: PulseKind = "create";
  whisper = "";
  whisperLife = 0;
  mode: "play" | "dead" = "play";
  depth = 1;
  pointerX = 0;
  pointerY = 0;
  universeFresh = true;
  deathReason = "";
  bestDepth = loadHidepth();
  runsPlayed = loadRuns();
  scorePop = 0;
  lastGain = 0;
  mulFlash = 0;

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
      hearts: this.hearts,
      remnants: this.sky.remnants.length,
      found: [...this.found],
    });
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.cx = w / 2;
    this.cy = h / 2;
    const hud = this.hudLayout();
    log("resize", {
      w,
      h,
      remnants: this.sky.remnants.length,
      found: this.found.size,
      score: { x: hud.scoreX, y: hud.scoreY },
      combo: { x: hud.comboX, y: hud.comboY },
      mass: { x: hud.massX, y: hud.massY, w: hud.massW },
      hearts: { x: hud.heartX, y: hud.heartY },
    });
  }

  private hudLayout() {
    const pad = Math.max(28, Math.round(Math.min(this.w, this.h) * 0.045));
    const massW = Math.min(Math.round(this.w * 0.32), 360);
    const mute = this.muteRect();
    return {
      pad,
      scoreX: pad,
      scoreY: pad + 22,
      bestY: pad + 58,
      depthY: pad + 22,
      whisperY: pad + 72,
      comboX: pad,
      comboY: this.h - pad - 56,
      massW,
      massX: this.cx - massW / 2,
      massY: this.h - pad - 10,
      heartX: mute.x - 18,
      heartY: mute.y + mute.s / 2,
    };
  }

  private kissWindows(): { perfectGap: number; goodGap: number } {
    const orbR = this.orbRadius();
    const maxR = pulseMaxRadius(orbR, this.w, this.h);
    const scale = Math.max(24, maxR - orbR) / 52;
    const mods = this.mods();
    return {
      perfectGap: mods.perfectGap * scale,
      goodGap: mods.goodGap * scale,
    };
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
      log("first tap — universe begins", { depth: this.depth, hearts: this.hearts });
      return;
    }

    if (this.banging) {
      if (this.bangT > 0.55) {
        log("bang skipped → descend", { bangT: Number(this.bangT.toFixed(2)), combo: this.combo });
        this.descend();
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
      this.universeFresh = false;
      this.applyTap("perfect", 0, 0);
      log("first tap — universe begins", { depth: this.depth, hearts: this.hearts });
      this.beginNextCycle(1.6);
      return;
    }

    if (this.universeFresh) {
      this.universeFresh = false;
      this.hitThisCycle = true;
      this.applyTap("perfect", 0, 0);
      log("first light", { depth: this.depth, combo: this.combo, pStreak: this.perfectStreak });
      this.beginNextCycle(0.35);
      return;
    }

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

    const orbR = this.orbRadius();
    const maxR = pulseMaxRadius(orbR, this.w, this.h);
    const ringR = pulseRadius(progress, orbR, maxR, KISS);
    const gap = Math.abs(ringR - orbR);
    const errorMs = (progress - KISS) * this.period * 1000;
    const windows = this.kissWindows();

    let kind: TapKind;
    if (progress <= KISS) {
      if (gap > windows.goodGap) {
        log("tap ignored — ring still far", { gapPx: Number(gap.toFixed(1)), goodGap: Number(windows.goodGap.toFixed(1)) });
        return;
      }
      kind = gap <= windows.perfectGap ? "perfect" : "good";
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

  movePointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  update(dt: number): void {
    this.wallTime += dt;
    const frozen = this.juice.hitstop > 0;
    this.juice.update(dt);

    this.updateTitle();
    this.comboPop = Math.max(0, this.comboPop - dt * 2.8);
    this.hitLabelLife = Math.max(0, this.hitLabelLife - dt);
    this.whisperLife = Math.max(0, this.whisperLife - dt);
    this.sky.update(dt);
    this.scorePop = Math.max(0, this.scorePop - dt * 1.8);
    this.mulFlash = Math.max(0, this.mulFlash - dt * 1.15);
    this.squashX = lerp(this.squashX, 1, 1 - Math.pow(0.0002, dt));
    this.squashY = lerp(this.squashY, 1, 1 - Math.pow(0.0002, dt));
    const timeScale = frozen ? 0.08 : this.phase === "singularity" ? 0.55 : this.phase === "bang" ? 0.7 : 1;
    const gdt = dt * timeScale;
    this.gameTime += gdt;

    this.particles.update(dt, this.cx, this.cy);

    if (this.mode === "dead") return;

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
      const windows = this.kissWindows();
      const nearKiss = contracting && p <= KISS + 0.08 && gap <= windows.goodGap;
      const voidPulse = this.pulseKind === "void";
      this.windowGlow = voidPulse ? 0 : nearKiss ? clamp(1 - gap / windows.goodGap, 0, 1) : 0;
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
    if (this.mode === "dead") this.drawDead(ctx);
    this.drawMute(ctx);
    this.drawHearts(ctx);
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
    const prevPerfect = this.perfectStreak;

    if (kind === "perfect") {
      this.combo += 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      this.perfectStreak += 1;
      const add = (1 + Math.min(this.combo, 24) * 0.04) * mods.hitMassMul;
      this.mass += add;
      this.massCreated += add;
      this.squashX = 1.28 + Math.min(this.combo, 20) * 0.012;
      this.squashY = 0.72;
      this.particles.spawnBurst(this.cx, this.cy, 22 + Math.min(this.combo, 40), 280 + this.combo * 14, r);
      this.sky.plantBurst(this.w, this.h, this.cx, this.cy, this.perfectStreak % mods.resonanceEvery === 0 ? 3 : 1, 40 + this.combo * 3);
      this.comboPop = 1;
      this.grantScore(12, prevPerfect);
      if (this.perfectStreak > 0 && this.perfectStreak % mods.resonanceEvery === 0) {
        this.hitLabel = "RESONANCE";
        this.mass += 0.6 * mods.hitMassMul;
        this.massCreated += 0.6;
        this.grantScore(48, this.perfectStreak);
        this.audio.resonance(this.combo);
        this.discover("resonance");
        log("resonance", { streak: this.perfectStreak, combo: this.combo });
      }
    } else if (kind === "good") {
      this.combo += 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      this.perfectStreak = 0;
      const add = 0.55 * mods.hitMassMul;
      this.mass += add;
      this.massCreated += add;
      this.squashX = 1.14;
      this.squashY = 0.84;
      this.particles.spawnBurst(this.cx, this.cy, 14 + Math.min(this.combo, 16), 200 + this.combo * 6, r);
      this.sky.plantBurst(this.w, this.h, this.cx, this.cy, 1, 28);
      this.comboPop = 0.85;
      this.grantScore(6, prevPerfect);
    } else {
      this.combo = 0;
      this.perfectStreak = 0;
      this.mass = Math.max(0, this.mass - 0.45);
      this.squashX = 0.78;
      this.squashY = 1.22;
      this.particles.vacuumToward(this.cx, this.cy, ["orbit"]);
      this.particles.spawnBurst(this.cx, this.cy, 10, 90, r);
      this.lastGain = 0;
      this.loseLife("miss");
    }

    const tempo = mods.tempoFromCombo ? lerp(1.18, 0.58, clamp(this.combo / 32, 0, 1)) : 1.05;
    this.period = (this.phase === "giant" ? tempo * 1.16 : tempo) * mods.periodMul;
    this.juice.punch(kind);
    this.audio.tap(kind, this.combo);

    log(
      `tap kind=${kind} combo=${this.combo} pStreak=${this.perfectStreak} mul=${streakMul(this.perfectStreak)} gapPx=${gap.toFixed(1)} windowMs=${errorMs.toFixed(1)} mass=${this.mass.toFixed(2)} score=${this.score} depth=${this.depth} hearts=${this.hearts}`,
    );

    if (this.mode === "play" && this.mass >= this.bangNeed() && !this.banging) this.startBang();
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
        const windows = this.kissWindows();
        log("pulse armed", {
          index: this.pulseIndex,
          kind: this.pulseKind,
          depth: this.depth,
          maxR: Number(pulseMaxRadius(this.orbRadius(), this.w, this.h).toFixed(1)),
          perfectGap: Number(windows.perfectGap.toFixed(1)),
          goodGap: Number(windows.goodGap.toFixed(1)),
        });
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
    this.grantScore(8 + mods.silenceCombo * 6, this.perfectStreak);
    this.discover("silence");
    log("silence", {
      silences: this.silences,
      combo: this.combo,
      mul: streakMul(this.perfectStreak),
      mass: Number(this.mass.toFixed(2)),
      score: this.score,
      hearts: this.hearts,
    });
    if (this.mode === "play" && this.mass >= this.bangNeed() && !this.banging) this.startBang();
  }

  private applyVoidStrike(errorMs: number, gap: number): void {
    this.combo = 0;
    this.perfectStreak = 0;
    this.mass = Math.max(0, this.mass - 1.4);
    this.hitLabel = "VOID";
    this.hitLabelLife = 1.3;
    this.squashX = 0.72;
    this.squashY = 1.28;
    this.particles.vacuumToward(this.cx, this.cy, ["orbit", "burst"]);
    this.juice.voidHit();
    this.audio.voidHit();
    this.discover("voidtaken");
    log(`tap kind=void gapPx=${gap.toFixed(1)} windowMs=${errorMs.toFixed(1)} mass=${this.mass.toFixed(2)} hearts=${this.hearts}`);
    this.loseLife("void");
  }

  private discover(id: DiscoveryId): void {
    if (this.found.has(id)) return;
    this.found.add(id);
    this.discoveredThisRun.push(id);
    saveFound(this.found);
    this.whisper = DISCOVERY_LABEL[id];
    this.whisperLife = 1.8;
    log("discovery", { id, label: DISCOVERY_LABEL[id], found: this.found.size });
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
    this.mass = Math.max(0, this.mass - 2.4 * dt);
    if (this.mass <= 0) this.checkEntropyDeath();
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
    this.grantScore(Math.round(80 + this.sky.born.length * 2), this.perfectStreak);
    this.bangScore = this.score;
    this.newBest = this.bangScore > this.best;
    this.universes += 1;
    this.discover("universe");
    const nextWord = depthWord(this.depth + 1);
    this.bangHeadline = this.newBest ? "N E W" : nextWord || `DEPTH ${this.depth + 1}`;
    this.juice.bang();
    this.audio.bang();
    this.particles.spawnStars(this.cx, this.cy, 90);
    this.sky.collapse();
    log("bang", {
      score: this.bangScore,
      depth: this.depth,
      next: this.depth + 1,
      word: nextWord,
      combo: this.combo,
      pStreak: this.perfectStreak,
      hearts: this.hearts,
      bangMass: mods.bangMass,
    });
  }

  private updateBang(dt: number): void {
    this.bangT += dt;
    this.densify = this.bangT < 0.55 ? lerp(0.4, 1, this.bangT / 0.55) : lerp(1, 0, clamp((this.bangT - 0.55) / 0.4, 0, 1));
    if (this.bangT > 2.5) {
      this.descend();
    }
  }

  private resetUniverse(hard: boolean): void {
    const mods = this.mods();
    log("reset universe", {
      hard,
      depth: this.depth,
      word: depthWord(this.depth),
      combo: this.combo,
      pStreak: this.perfectStreak,
      hearts: this.hearts,
      periodMul: Number(mods.periodMul.toFixed(3)),
    });
    this.banging = false;
    this.bangT = 0;
    this.mass = mods.startMass;
    this.massCreated = 0;
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
    this.particles.trimOrbiters(0);
    this.sky.clearBorn();
    if (hard) this.particles.clear();
    this.juice.reset();
  }

  mods(): DepthMods {
    return depthMods(this.depth);
  }

  private bangNeed(): number {
    return this.mods().bangMass;
  }

  private grantScore(base: number, prevPerfect: number): number {
    const g = scoreGain({
      base,
      combo: Math.max(1, this.combo),
      perfectStreak: this.perfectStreak,
      depth: this.depth,
    });
    this.score += g.gained;
    this.lastGain = g.gained;
    this.scorePop = 1;
    const stepped = streakJustHit(prevPerfect, this.perfectStreak);
    if (stepped) {
      this.mulFlash = 1.15;
      this.juice.streak();
      this.audio.rankUp();
      log("streak", {
        mul: stepped,
        perfects: this.perfectStreak,
        combo: this.combo,
        gained: g.gained,
        score: this.score,
        depth: this.depth,
      });
    } else {
      log("score", {
        base,
        combo: this.combo,
        streak: g.streak,
        depth: this.depth,
        gained: g.gained,
        score: this.score,
      });
    }
    return g.gained;
  }

  private loseLife(reason: "miss" | "void"): void {
    const before = this.hearts;
    this.hearts = Math.max(0, this.hearts - 1);
    log("life", { reason, before, hearts: this.hearts, depth: this.depth, lethal: this.depth >= 2 });
    if (this.mode !== "play" || this.banging) return;
    if (this.depth >= 2 && this.hearts <= 0) this.die(reason);
  }

  private checkEntropyDeath(): void {
    if (this.mode !== "play" || this.banging) return;
    if (this.depth < 2) return;
    if (this.mass > 0) return;
    this.die("entropy");
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
      peakCombo: this.peakCombo,
      hearts: this.hearts,
      found: this.found.size,
      best: this.best,
      newBest: this.newBest,
    });
  }

  private startRun(): void {
    log("run start");
    this.mode = "play";
    this.depth = 1;
    this.hearts = MAX_HEARTS;
    this.score = 0;
    this.peakCombo = 0;
    this.silences = 0;
    this.discoveredThisRun = [];
    this.universes = 0;
    this.deathReason = "";
    this.started = false;
    this.awaitingFirstPulse = true;
    this.banging = false;
    this.mass = 0;
    this.combo = 0;
    this.perfectStreak = 0;
    this.phase = "void";
    this.pulseIndex = 0;
    this.hitThisCycle = false;
    this.cycleArmed = false;
    this.universeFresh = true;
    this.particles.clear();
    this.juice.reset();
    this.lastGain = 0;
    this.mulFlash = 0;
  }

  private descend(): void {
    if (!this.banging) return;
    const carried = this.combo;
    const carriedStreak = this.perfectStreak;
    this.depth += 1;
    this.bestDepth = Math.max(this.bestDepth, this.depth);
    saveHidepth(this.bestDepth);
    if (this.hearts <= 0) {
      this.hearts = 1;
      log("life restored for descent", { hearts: this.hearts, depth: this.depth });
    }
    const word = depthWord(this.depth);
    this.whisper = word;
    this.whisperLife = 1.8;
    this.mode = "play";
    this.resetUniverse(false);
    log("combo-carry", {
      combo: carried,
      pStreak: carriedStreak,
      mul: streakMul(carriedStreak),
      depth: this.depth,
      word,
      hearts: this.hearts,
    });
    this.universeFresh = false;
    this.applyTap("perfect", 0, 0);
    this.beginNextCycle(0.45);
    log("first light", { depth: this.depth, combo: this.combo, pStreak: this.perfectStreak, auto: true });
  }

  private drawDead(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = font(700, 72);
    strokeText(ctx, String(this.score), this.cx, this.cy - 64, 10);
    ctx.font = font(600, 18);
    ctx.globalAlpha = 0.85;
    ctx.fillText(this.newBest ? "N E W  B E S T" : `DEPTH ${this.depth}`, this.cx, this.cy + 8);
    ctx.globalAlpha = 0.45;
    ctx.font = font(500, 16);
    ctx.fillText(`BEST ${this.best}   ·   PEAK ${this.peakCombo}`, this.cx, this.cy + 40);

    ctx.font = font(500, 13);
    const gap = Math.min(92, (this.w - 80) / DISCOVERY_ORDER.length);
    const rowW = gap * (DISCOVERY_ORDER.length - 1);
    const x0 = this.cx - rowW / 2;
    DISCOVERY_ORDER.forEach((id, i) => {
      const known = this.found.has(id);
      ctx.globalAlpha = known ? 0.7 : 0.22;
      ctx.fillText(known ? DISCOVERY_LABEL[id] : "·", x0 + i * gap, this.cy + 84);
    });

    ctx.globalAlpha = 0.4;
    ctx.font = font(500, 16);
    ctx.fillText("TAP  TO  BEGIN", this.cx, this.h - 48);
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
    const hud = this.hudLayout();
    ctx.save();
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";

    if (this.titleAlpha > 0.01 && !this.banging && !this.started) {
      ctx.textAlign = "center";
      ctx.globalAlpha = this.titleAlpha;
      ctx.font = font(500, 18);
      ctx.fillText("N O T H I N G", this.cx, this.cy - 52);
      ctx.globalAlpha = 1;
    }

    if (this.mode === "play" && this.started && !this.banging) {
      ctx.textAlign = "left";
      ctx.globalAlpha = 0.92;
      ctx.font = font(800, 44);
      strokeText(ctx, String(this.score), hud.scoreX, hud.scoreY, 8);
      if (this.scorePop > 0.08 && this.lastGain > 0) {
        ctx.globalAlpha = clamp(this.scorePop, 0, 0.85);
        ctx.font = font(700, 18);
        ctx.fillText(`+${this.lastGain}`, hud.scoreX, hud.bestY);
      } else if (this.best > 0) {
        ctx.globalAlpha = 0.4;
        ctx.font = font(500, 14);
        ctx.fillText(`best ${this.best}`, hud.scoreX, hud.bestY);
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = "center";
      ctx.globalAlpha = 0.45;
      ctx.font = font(600, 14);
      ctx.fillText(`DEPTH ${this.depth}`, this.cx, hud.depthY);
      ctx.globalAlpha = 1;
    }

    if (this.whisperLife > 0 && this.whisper !== this.hitLabel && this.mode === "play" && this.hitLabelLife <= 0) {
      ctx.textAlign = "center";
      ctx.globalAlpha = clamp(this.whisperLife / 0.5, 0, 0.7);
      ctx.font = font(600, 16);
      ctx.fillText(this.whisper, this.cx, hud.whisperY);
      ctx.globalAlpha = 1;
    }

    if (!this.banging && this.hitLabelLife > 0 && this.mode === "play") {
      ctx.textAlign = "center";
      ctx.globalAlpha = clamp(this.hitLabelLife / 0.4, 0, 1);
      ctx.font = font(700, 22);
      strokeText(ctx, this.hitLabel, this.cx, hud.whisperY, 6);
      ctx.globalAlpha = 1;
    }

    if (this.combo >= 1 && !this.banging && this.mode === "play") {
      const mul = streakMul(this.perfectStreak);
      const s = 1 + this.comboPop * 0.18;
      ctx.save();
      ctx.textAlign = "left";
      ctx.translate(hud.comboX, hud.comboY);
      ctx.scale(s, s);
      ctx.font = font(800, 48);
      ctx.globalAlpha = 0.95;
      const comboText = String(this.combo);
      const comboW = ctx.measureText(comboText).width;
      strokeText(ctx, comboText, 0, 0, 8);
      const label = formatMul(mul);
      if (label) {
        ctx.font = font(700, 26);
        ctx.globalAlpha = 0.75 + this.mulFlash * 0.25;
        ctx.fillText(label, comboW + 16, 1);
      }
      ctx.restore();
    }

    if (this.mode === "play" && this.started && !this.banging) {
      const need = this.bangNeed();
      const t = clamp(this.mass / Math.max(0.001, need), 0, 1);
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(hud.massX, hud.massY, hud.massW, 5);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#fff";
      ctx.fillRect(hud.massX, hud.massY, hud.massW * t, 5);
      ctx.globalAlpha = 1;
    }

    if (this.banging && this.bangT > 0.75 && this.mode === "play") {
      const fade = clamp((this.bangT - 0.75) / 0.25, 0, 1) * (this.bangT > 2.4 ? 1 - clamp((this.bangT - 2.4) / 0.6, 0, 1) : 1);
      ctx.globalAlpha = fade;
      ctx.textAlign = "center";
      ctx.font = font(800, 72);
      ctx.fillStyle = "#fff";
      strokeText(ctx, String(this.bangScore), this.cx, this.cy - 8, 10);
      ctx.font = font(600, 18);
      ctx.fillText(this.bangHeadline, this.cx, this.cy + 40);
      if (this.bangT > 0.55) {
        ctx.globalAlpha = fade * 0.55;
        ctx.font = font(500, 16);
        ctx.fillText("TAP  TO  GO  DEEPER", this.cx, this.cy + 70);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawHearts(ctx: CanvasRenderingContext2D): void {
    if (this.mode !== "play" || !this.started) return;
    const hud = this.hudLayout();
    const gap = 16;
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < MAX_HEARTS; i++) {
      const x = hud.heartX - (MAX_HEARTS - 1 - i) * gap;
      const y = hud.heartY;
      const filled = i < this.hearts;
      ctx.globalAlpha = filled ? (this.hearts === 1 ? 0.9 : 0.7) : 0.22;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      if (filled) ctx.fill();
      else ctx.stroke();
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
