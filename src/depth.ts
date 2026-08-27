export type DepthMods = {
  periodMul: number;
  voidEveryMul: number;
  kissWindowMul: number;
  bangMass: number;
  tempoFromCombo: boolean;
  perfectGap: number;
  goodGap: number;
  silenceMass: number;
  silenceCombo: number;
  hitMassMul: number;
  resonanceEvery: number;
  sparkMin: number;
  startMass: number;
};

/** One word for the next universe. Empty on depth 1. */
export function depthWord(depth: number): string {
  if (depth <= 1) return "";
  if (depth === 2) return "FASTER";
  if (depth === 3) return "VOIDS";
  if (depth === 4) return "TIGHT";
  return "DEEPER";
}

export function depthMods(depth: number): DepthMods {
  const d = Math.max(1, Math.floor(depth));
  let periodMul = 1;
  let voidEveryMul = 1;
  let kissWindowMul = 1;

  if (d >= 2) periodMul *= 0.88;
  if (d >= 3) voidEveryMul *= 0.62;
  if (d >= 4) kissWindowMul *= 0.82;
  if (d >= 5) {
    const extra = d - 4;
    periodMul *= Math.pow(0.96, extra);
    voidEveryMul *= Math.pow(0.92, extra);
    kissWindowMul *= Math.pow(0.97, extra);
  }

  const mods: DepthMods = {
    periodMul,
    voidEveryMul,
    kissWindowMul,
    bangMass: 28 + (d - 1) * 3,
    tempoFromCombo: true,
    perfectGap: 16 * kissWindowMul,
    goodGap: 36 * kissWindowMul,
    silenceMass: 0.9,
    silenceCombo: 1,
    hitMassMul: 1,
    resonanceEvery: 3,
    sparkMin: 3,
    startMass: 0,
  };

  return mods;
}
