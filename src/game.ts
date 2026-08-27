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
import { formatMul, scoreGain, streakJustHit, streakMul } from "./scoring";
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
  draftHover = -1;
  pointerX = 0;
  pointerY = 0;
  createMissStreak = 0;
  voidStrikes = 0;
  universeFresh = true;
  deathReason = "";
  bestDepth = loadHidepth();
  runsPlayed = loadRuns();
  scorePop = 0;
  lastGain = 0;
  mulFlash = 0;
  pickFlash = 0;

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
    const hud = this.hudLayout();
    log("resize", {
      w,
      h,
      remnants: this.sky.remnants.length,
      found: this.found.size,
      score: { x: hud.scoreX, y: hud.scoreY },
      combo: { x: hud.comboX, y: hud.comboY },
      mass: { x: hud.massX, y: hud.massY, w: hud.massW },
      draftWide: w >= 720,
    });
  }

  private hudLayout() {
    const pad = Math.max(28, Math.round(Math.min(this.w, this.h) * 0.045));
    const massW = Math.min(Math.round(this.w * 0.32), 360);
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
      relicX: this.w - pad,
      relicY: this.h - pad - 18,
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
      log("first tap — universe begins", { depth: this.depth });
      return;
    }

    if (this.mode === "draft") {
      this.tryPickDraft(x, y);
      return;
    }

    if (this.banging) {
      if (this.bangT > 0.55) {
        log("bang skipped → draft", { bangT: Number(this.bangT.toFixed(2)), x, y });
        this.openDraft();
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
    if (this.mode === "draft") this.draftHover = this.hitDraftIndex(x, y);
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
    this.pickFlash = Math.max(0, this.pickFlash - dt * 1.7);
    this.squashX = lerp(this.squashX, 1, 1 - Math.pow(0.0002, dt));
    this.squashY = lerp(this.squashY, 1, 1 - Math.pow(0.0002, dt));
    const mods = this.mods();
    const timeScale =
      frozen ? 0.08 : this.phase === "singularity" ? 0.55 * mods.alwaysSlow : this.phase === "bang" ? 0.7 : 1 * mods.alwaysSlow;
    const gdt = dt * timeScale;
    this.gameTime += gdt;

    this.particles.update(dt, this.cx, this.cy);
    if (this.mode === "draft") this.draftHover = this.hitDraftIndex(this.pointerX, this.pointerY);

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
      this.densify + this.windowGlow * 0.35 + clamp((this.combo - 8) / 28, 0, 0.4) + this.pickFlash * 0.5,
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
    const prevPerfect = this.perfectStreak;

    if (kind === "perfect") {
      this.combo += 1;
      this.peakCombo = Math.max(this.peakCombo, this.combo);
      this.perfectStreak += 1;
      this.createMissStreak = 0;
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
      this.createMissStreak = 0;
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
      if (mods.missHalveCombo) this.combo = Math.floor(this.combo / 2);
      else this.combo = 0;
      this.perfectStreak = 0;
      this.createMissStreak += 1;
      this.mass = Math.max(0, this.mass - 0.45);
      this.squashX = 0.78;
      this.squashY = 1.22;
      this.particles.vacuumToward(this.cx, this.cy, ["orbit"]);
      this.particles.spawnBurst(this.cx, this.cy, 10, 90, r);
      this.lastGain = 0;
    }

    const tempo = mods.tempoFromCombo ? lerp(1.18, 0.58, clamp(this.combo / 32, 0, 1)) : 1.05;
    this.period = (this.phase === "giant" ? tempo * 1.16 : tempo) * mods.periodMul;
    this.juice.punch(kind);
    this.audio.tap(kind, this.combo);

    log(
      `tap kind=${kind} combo=${this.combo} pStreak=${this.perfectStreak} mul=${streakMul(this.perfectStreak)} gapPx=${gap.toFixed(1)} windowMs=${errorMs.toFixed(1)} mass=${this.mass.toFixed(2)} score=${this.score} depth=${this.depth}`,
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
        const windows = this.kissWindows();
        log("pulse armed", {
          index: this.pulseIndex,
          kind: this.pulseKind,
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
    this.grantScore(8 + mods.silenceCombo * 6, this.perfectStreak);
    this.discover("silence");
    log("silence", {
      silences: this.silences,
      combo: this.combo,
      mul: streakMul(this.perfectStreak),
      mass: Number(this.mass.toFixed(2)),
      score: this.score,
    });
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
    this.grantScore(Math.round(80 * mods.bangScoreMul + this.sky.born.length * 2 * mods.skyScoreMul), this.perfectStreak);
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
    if (!relic) {
      log("pickRelic ignored", { index, draftLen: this.draft.length });
      return;
    }
    this.relics.push(relic.id);
    log("relic taken", { id: relic.id, name: relic.name, depth: this.depth + 1, relics: this.relics });
    this.whisper = relic.name;
    this.whisperLife = 1.8;
    this.depth += 1;
    this.bestDepth = Math.max(this.bestDepth, this.depth);
    saveHidepth(this.bestDepth);
    this.mode = "play";
    this.draft = [];
    this.draftHover = -1;
    this.pickFlash = 1;
    this.juice.relicPick();
    this.audio.relicPick();
    this.particles.spawnBurst(this.cx, this.cy, 36, 260, this.orbRadius());
    this.particles.spawnFloater(this.cx, this.cy - 36, relic.name, 28);
    this.resetUniverse(false);
  }

  private bangNeed(): number {
    return this.mods().bangMass + (this.depth - 1) * 3;
  }

  private grantScore(base: number, prevPerfect: number): number {
    const relicMul = this.mods().scoreMul;
    const g = scoreGain({
      base,
      combo: Math.max(1, this.combo),
      perfectStreak: this.perfectStreak,
      depth: this.depth,
      relicMul,
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
      });
    } else {
      log("score", {
        base,
        combo: this.combo,
        streak: g.streak,
        depth: this.depth,
        relic: relicMul,
        gained: g.gained,
        score: this.score,
      });
    }
    return g.gained;
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
    this.lastGain = 0;
    this.mulFlash = 0;
  }

  private openDraft(): void {
    this.banging = false;
    this.mode = "draft";
    this.draft = rollDraft(this.depth + 1, this.relics);
    this.cycleArmed = false;
    this.draftHover = this.hitDraftIndex(this.pointerX, this.pointerY);
    log("draft", {
      depth: this.depth + 1,
      choices: this.draft.map((r) => r.id),
      cards: this.draftLayout().map((c) => ({ id: c.relic.id, x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h) })),
    });
  }

  private tryPickDraft(x: number, y: number): void {
    const hit = this.hitDraftIndex(x, y);
    log("draft tap", { x: Math.round(x), y: Math.round(y), hit, hover: this.draftHover });
    if (hit >= 0) this.pickRelic(hit);
  }

  private hitDraftIndex(px: number, py: number): number {
    const cards = this.draftLayout();
    return cards.findIndex((c) => px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h);
  }

  private draftLayout(): { relic: Relic; x: number; y: number; w: number; h: number }[] {
    const n = Math.max(1, this.draft.length);
    const pad = Math.max(24, Math.round(this.w * 0.045));
    const wide = this.w >= 720;

    if (wide) {
      const gap = Math.max(24, Math.round(this.w * 0.024));
      const y = this.h * 0.28;
      const cardH = Math.max(200, Math.min(this.h * 0.48, this.h - y - pad - 56));
      const cardW = Math.min(420, (this.w - pad * 2 - gap * (n - 1)) / n);
      const totalW = n * cardW + (n - 1) * gap;
      const x0 = this.cx - totalW / 2;
      return this.draft.map((relic, i) => ({ relic, x: x0 + i * (cardW + gap), y, w: cardW, h: cardH }));
    }

    const gap = 16;
    const cardW = Math.min(this.w - pad * 2, 560);
    const area = this.h * 0.52;
    const cardH = Math.max(100, Math.min(140, (area - gap * (n - 1)) / n));
    const totalH = n * cardH + (n - 1) * gap;
    const x = this.cx - cardW / 2;
    const y0 = Math.max(this.h * 0.32, this.h - pad - 40 - totalH);
    return this.draft.map((relic, i) => ({ relic, x, y: y0 + i * (cardH + gap), w: cardW, h: cardH }));
  }

  private drawDraft(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, this.w, this.h);

    const cards = this.draftLayout();
    const hintY = cards.length
      ? Math.min(this.h - 28, cards[0].y + cards[0].h + 40)
      : this.h - 28;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.5;
    ctx.font = font(600, 14);
    ctx.fillText(`DEPTH ${this.depth + 1}`, this.cx, Math.max(40, this.h * 0.1));
    ctx.globalAlpha = 1;
    ctx.font = font(700, 32);
    ctx.fillText("TAKE ONE", this.cx, Math.max(78, this.h * 0.16));
    ctx.globalAlpha = 0.45;
    ctx.font = font(500, 14);
    ctx.fillText("TAP A CARD   ·   1  2  3", this.cx, hintY);
    ctx.globalAlpha = 1;

    const wide = this.w >= 720;
    cards.forEach((card, i) => {
      const hover = this.draftHover === i;
      ctx.globalAlpha = hover ? 0.18 : 0.08;
      ctx.fillStyle = "#fff";
      ctx.fillRect(card.x, card.y, card.w, card.h);
      ctx.globalAlpha = hover ? 1 : 0.65;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = hover ? 2.5 : 1.4;
      ctx.strokeRect(card.x + 1, card.y + 1, card.w - 2, card.h - 2);

      ctx.fillStyle = "#fff";
      if (wide) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = hover ? 1 : 0.5;
        ctx.font = font(700, 36);
        ctx.fillText(String(i + 1), card.x + card.w / 2, card.y + card.h * 0.22);
        ctx.globalAlpha = 1;
        ctx.font = font(700, 22);
        ctx.fillText(card.relic.name, card.x + card.w / 2, card.y + card.h * 0.5);
        ctx.globalAlpha = 0.65;
        ctx.font = font(500, 15);
        ctx.fillText(card.relic.line, card.x + card.w / 2, card.y + card.h * 0.72);
      } else {
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = hover ? 1 : 0.5;
        ctx.font = font(700, 42);
        ctx.fillText(String(i + 1), card.x + 22, card.y + card.h / 2);
        ctx.textAlign = "center";
        ctx.globalAlpha = 1;
        ctx.font = font(700, 22);
        ctx.fillText(card.relic.name, this.cx, card.y + card.h * 0.38);
        ctx.globalAlpha = 0.7;
        ctx.font = font(500, 16);
        ctx.fillText(card.relic.line, this.cx, card.y + card.h * 0.68);
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  private drawDead(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = font(700, 72);
    strokeText(ctx, String(this.score), this.cx, this.cy - 48, 10);
    ctx.font = font(600, 18);
    ctx.globalAlpha = 0.85;
    ctx.fillText(this.newBest ? "N E W  B E S T" : `DEPTH ${this.depth}`, this.cx, this.cy + 24);
    ctx.globalAlpha = 0.45;
    ctx.font = font(500, 16);
    ctx.fillText(this.newBest ? `DEPTH ${this.depth}   ·   BEST ${this.best}` : `BEST ${this.best}   ·   PEAK ${this.peakCombo}`, this.cx, this.cy + 56);
    if (this.relics.length > 0) {
      ctx.font = font(500, 14);
      ctx.fillText(this.relics.slice(0, 8).join("  ·  "), this.cx, this.cy + 92);
    }
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

    if (this.mode === "play") {
      ctx.globalAlpha = 0.4;
      ctx.font = font(500, 13);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      if (this.relics.length > 0) {
        ctx.fillText(`${this.relics.length} relic${this.relics.length === 1 ? "" : "s"}`, hud.relicX, hud.relicY);
      } else if (this.universes > 0) {
        ctx.fillText(`${this.universes} universe${this.universes === 1 ? "" : "s"}`, hud.relicX, hud.relicY);
      }
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
        ctx.fillText("TAP  TO  CHOOSE", this.cx, this.cy + 70);
      }
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
