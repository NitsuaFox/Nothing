import { log } from "./debug";
import { clamp } from "./math";

export type TapKind = "perfect" | "good" | "miss";

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  unlocked = false;

  get isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.ctx?.state === "suspended") {
        await this.ctx.resume();
      }
      return;
    }

    try {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        log("audio unavailable");
        return;
      }

      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);

      this.noise = makeNoiseBuffer(this.ctx);

      this.drone = this.ctx.createOscillator();
      this.drone.type = "sine";
      this.drone.frequency.value = 46;
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0;
      this.drone.connect(this.droneGain);
      this.droneGain.connect(this.master);
      this.drone.start();

      this.unlocked = true;
      log("audio unlock");
      void this.ctx.resume();
    } catch (error) {
      log("audio unlock failed", { error: String(error) });
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
    }
    log("audio mute", { muted });
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMass(mass: number, phase: string): void {
    if (!this.ctx || !this.drone || !this.droneGain) return;
    const now = this.ctx.currentTime;
    const gain = this.muted ? 0 : clamp(mass / 90, 0, 0.12);
    const freq = phase === "singularity" ? 38 : 46 + mass * 0.35;
    this.droneGain.gain.setTargetAtTime(gain, now, 0.12);
    this.drone.frequency.setTargetAtTime(freq, now, 0.18);
  }

  tap(kind: TapKind, combo: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const now = this.ctx.currentTime;

    if (kind === "miss") {
      this.tone(140, 70, now, 0.09, 0.12, "sine");
      this.burst(now, 0.08, 0.16, 420);
      return;
    }

    const base = kind === "perfect" ? 392 : 330;
    const pitch = base * Math.pow(2, (combo % 12) / 12);
    const kick = kind === "perfect" ? 92 : 70;
    this.kick(kick, now, kind === "perfect" ? 0.09 : 0.06);
    this.tone(pitch, pitch * 1.02, now, kind === "perfect" ? 0.07 : 0.045, 0.05, "triangle");
    this.burst(now, kind === "perfect" ? 0.05 : 0.03, 0.045, kind === "perfect" ? 1800 : 1400);
  }

  pulseCue(kind: "create" | "void"): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    if (kind === "void") {
      this.tone(90, 48, now, 0.05, 0.18, "sine");
      return;
    }
    this.tone(220, 180, now, 0.025, 0.08, "sine");
  }

  silence(): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.tone(520, 780, now, 0.05, 0.28, "sine");
    this.tone(260, 200, now, 0.04, 0.22, "triangle");
  }

  voidHit(): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const now = this.ctx.currentTime;
    this.tone(90, 36, now, 0.12, 0.22, "sine");
    this.burst(now, 0.12, 0.22, 180);
  }

  resonance(combo: number): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const pitch = 523 * Math.pow(2, (combo % 8) / 12);
    this.tone(pitch, pitch * 1.5, now, 0.08, 0.22, "sine");
    this.kick(64, now, 0.12);
  }

  phaseSting(phase: string): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const freq = phase === "singularity" ? 110 : phase === "giant" ? 165 : phase === "star" ? 247 : 196;
    this.tone(freq, freq * 1.25, now, 0.045, 0.2, "sine");
  }

  rankUp(): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.kick(78, now, 0.16);
    this.tone(392, 784, now, 0.1, 0.32, "sine");
    this.tone(523, 1046, now + 0.04, 0.08, 0.38, "triangle");
    this.burst(now, 0.08, 0.12, 2200);
    log("audio rank-up");
  }

  relicPick(): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.kick(70, now, 0.12);
    this.tone(330, 660, now, 0.07, 0.22, "triangle");
    this.tone(495, 990, now + 0.05, 0.06, 0.28, "sine");
    log("audio relic pick");
  }

  bang(): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const now = this.ctx.currentTime;
    this.kick(48, now, 0.45);
    this.tone(220, 40, now, 0.22, 0.9, "sine");
    this.tone(880, 1320, now, 0.08, 0.35, "sine");
    this.burst(now, 0.22, 0.7, 900);
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(0, now + 0.4, 0.2);
    }
    log("audio bang");
  }

  private kick(freq: number, when: number, dur: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(28, freq * 0.35), when + dur);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.9, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private tone(
    from: number,
    to: number,
    when: number,
    peak: number,
    dur: number,
    type: OscillatorType,
  ): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + dur);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private burst(when: number, peak: number, dur: number, cutoff: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(cutoff, when);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(when);
    src.stop(when + dur + 0.02);
  }
}
