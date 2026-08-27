export type Rarity = "common" | "uncommon" | "rare";

export type RelicId =
  | "afterimage"
  | "pulse"
  | "kindling"
  | "seed"
  | "firstlight"
  | "orbit"
  | "quiet"
  | "metronome"
  | "austerity"
  | "whitedwarf"
  | "nocturne"
  | "giantsblood"
  | "greed"
  | "redgiant"
  | "umbral"
  | "resonant"
  | "slowtime"
  | "memory"
  | "pure";

export type Relic = {
  id: RelicId;
  name: string;
  line: string;
  rarity: Rarity;
  minDepth: number;
  stack?: boolean;
};

export type Mods = {
  perfectGap: number;
  goodGap: number;
  periodMul: number;
  tempoFromCombo: boolean;
  bangMass: number;
  silenceMass: number;
  silenceCombo: number;
  hitMassMul: number;
  scoreMul: number;
  entropyMul: number;
  voidEveryMul: number;
  resonanceEvery: number;
  missHalveCombo: boolean;
  startMass: number;
  sparkMin: number;
  alwaysSlow: number;
  extraOrbit: number;
  skyScoreMul: number;
  bangScoreMul: number;
  firstPulseFree: boolean;
  keepSky: number;
};

export const RELICS: Relic[] = [
  { id: "afterimage", name: "AFTERIMAGE", line: "wider kiss", rarity: "common", minDepth: 1 },
  { id: "pulse", name: "PULSE", line: "the ring breathes slower", rarity: "common", minDepth: 1 },
  { id: "kindling", name: "KINDLING", line: "spark comes early", rarity: "common", minDepth: 1 },
  { id: "seed", name: "SEED", line: "each universe starts with mass", rarity: "common", minDepth: 1 },
  { id: "firstlight", name: "FIRST LIGHT", line: "first tap each universe is perfect", rarity: "common", minDepth: 1 },
  { id: "orbit", name: "ORBIT", line: "more matter in orbit", rarity: "common", minDepth: 1 },
  { id: "quiet", name: "QUIET", line: "silence is worth twice", rarity: "uncommon", minDepth: 2 },
  { id: "metronome", name: "METRONOME", line: "combo no longer rushes the ring", rarity: "uncommon", minDepth: 2 },
  { id: "austerity", name: "AUSTERITY", line: "misses halve combo instead of breaking it", rarity: "uncommon", minDepth: 2 },
  { id: "whitedwarf", name: "WHITE DWARF", line: "bang sooner", rarity: "uncommon", minDepth: 2 },
  { id: "nocturne", name: "NOCTURNE", line: "stars score harder", rarity: "uncommon", minDepth: 2 },
  { id: "giantsblood", name: "GIANT'S BLOOD", line: "hits create more mass", rarity: "uncommon", minDepth: 2 },
  { id: "greed", name: "GREED", line: "+30% score, entropy hunts you", rarity: "rare", minDepth: 3 },
  { id: "redgiant", name: "RED GIANT", line: "later bang, bigger payout", rarity: "rare", minDepth: 3 },
  { id: "umbral", name: "UMBRAL", line: "more voids, richer silence", rarity: "rare", minDepth: 3 },
  { id: "resonant", name: "RESONANT", line: "resonance every two perfects", rarity: "rare", minDepth: 3 },
  { id: "slowtime", name: "SLOW TIME", line: "the void always drags", rarity: "rare", minDepth: 3 },
  { id: "memory", name: "MEMORY", line: "half your sky survives the bang", rarity: "rare", minDepth: 3 },
  { id: "pure", name: "PURE", line: "+15% score", rarity: "rare", minDepth: 4, stack: true },
];

export function baseMods(): Mods {
  return {
    perfectGap: 16,
    goodGap: 36,
    periodMul: 1,
    tempoFromCombo: true,
    bangMass: 28,
    silenceMass: 0.9,
    silenceCombo: 1,
    hitMassMul: 1,
    scoreMul: 1,
    entropyMul: 1,
    voidEveryMul: 1,
    resonanceEvery: 3,
    missHalveCombo: false,
    startMass: 0,
    sparkMin: 3,
    alwaysSlow: 1,
    extraOrbit: 0,
    skyScoreMul: 1,
    bangScoreMul: 1,
    firstPulseFree: false,
    keepSky: 0,
  };
}

export function modsFrom(owned: RelicId[]): Mods {
  const m = baseMods();
  for (const id of owned) {
    if (id === "afterimage") {
      m.perfectGap += 10;
      m.goodGap += 14;
    }
    if (id === "pulse") m.periodMul *= 1.12;
    if (id === "kindling") m.sparkMin = 1.2;
    if (id === "seed") m.startMass += 2.4;
    if (id === "firstlight") m.firstPulseFree = true;
    if (id === "orbit") m.extraOrbit += 6;
    if (id === "quiet") {
      m.silenceMass *= 2;
      m.scoreMul *= 1.08;
    }
    if (id === "metronome") m.tempoFromCombo = false;
    if (id === "austerity") m.missHalveCombo = true;
    if (id === "whitedwarf") m.bangMass = Math.max(16, m.bangMass - 6);
    if (id === "nocturne") m.skyScoreMul *= 4;
    if (id === "giantsblood") m.hitMassMul *= 1.22;
    if (id === "greed") {
      m.scoreMul *= 1.3;
      m.entropyMul *= 1.85;
    }
    if (id === "redgiant") {
      m.bangMass += 12;
      m.bangScoreMul *= 1.55;
    }
    if (id === "umbral") {
      m.voidEveryMul *= 0.55;
      m.silenceCombo += 2;
      m.silenceMass *= 1.4;
    }
    if (id === "resonant") m.resonanceEvery = 2;
    if (id === "slowtime") m.alwaysSlow *= 0.82;
    if (id === "memory") m.keepSky = Math.max(m.keepSky, 0.5);
    if (id === "pure") m.scoreMul *= 1.15;
  }
  return m;
}

function byRarity(depth: number, rarity: Rarity): Relic[] {
  return RELICS.filter((r) => r.rarity === rarity && r.minDepth <= depth);
}

export function rollDraft(depth: number, owned: RelicId[]): Relic[] {
  const pickPool = (rarity: Rarity): Relic[] =>
    byRarity(depth, rarity).filter((r) => r.stack || !owned.includes(r.id));

  let weights: { rarity: Rarity; w: number }[] = [
    { rarity: "common", w: depth < 2 ? 70 : 40 },
    { rarity: "uncommon", w: depth < 2 ? 25 : 35 },
    { rarity: "rare", w: depth < 3 ? 5 : 25 },
  ];

  const chosen: Relic[] = [];
  const used = new Set<RelicId>();

  for (let n = 0; n < 3; n++) {
    const total = weights.reduce((s, x) => s + x.w, 0);
    let roll = Math.random() * total;
    let rarity: Rarity = "common";
    for (const row of weights) {
      roll -= row.w;
      if (roll <= 0) {
        rarity = row.rarity;
        break;
      }
    }

    let pool = pickPool(rarity).filter((r) => !used.has(r.id) || r.stack);
    if (pool.length === 0) pool = pickPool("uncommon").filter((r) => !used.has(r.id) || r.stack);
    if (pool.length === 0) pool = pickPool("common").filter((r) => !used.has(r.id) || r.stack);
    if (pool.length === 0) {
      chosen.push(RELICS.find((r) => r.id === "pure") ?? RELICS[0]);
      continue;
    }
    const relic = pool[Math.floor(Math.random() * pool.length)];
    chosen.push(relic);
    if (!relic.stack) used.add(relic.id);
  }

  return chosen;
}

export function relicById(id: RelicId): Relic | undefined {
  return RELICS.find((r) => r.id === id);
}
