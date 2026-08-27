import { log } from "./debug";

export type DiscoveryId =
  | "spark"
  | "star"
  | "giant"
  | "singularity"
  | "universe"
  | "silence"
  | "voidtaken"
  | "resonance";

export const DISCOVERY_ORDER: DiscoveryId[] = [
  "spark",
  "star",
  "giant",
  "singularity",
  "universe",
  "silence",
  "voidtaken",
  "resonance",
];

export const DISCOVERY_LABEL: Record<DiscoveryId, string> = {
  spark: "SPARK",
  star: "STAR",
  giant: "GIANT",
  singularity: "SINGULARITY",
  universe: "A UNIVERSE",
  silence: "SILENCE",
  voidtaken: "VOID",
  resonance: "RESONANCE",
};

const FOUND_KEY = "nothing:found";
const HISCORE_KEY = "nothing:hiscore";
const HIDEPTH_KEY = "nothing:hidepth";
const RUNS_KEY = "nothing:runs";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadFound(): Set<DiscoveryId> {
  const list = readJson<DiscoveryId[]>(FOUND_KEY, []);
  return new Set(list);
}

export function saveFound(found: Set<DiscoveryId>): void {
  try {
    localStorage.setItem(FOUND_KEY, JSON.stringify([...found]));
  } catch (error) {
    log("found save failed", { error: String(error) });
  }
}

export function loadHiscore(): number {
  const n = Number(localStorage.getItem(HISCORE_KEY) ?? localStorage.getItem("nothing:best") ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export function saveHiscore(score: number): void {
  try {
    localStorage.setItem(HISCORE_KEY, String(score));
    localStorage.setItem("nothing:best", String(score));
    log("hiscore saved", { score });
  } catch (error) {
    log("hiscore save failed", { error: String(error) });
  }
}

export function loadHidepth(): number {
  const n = Number(localStorage.getItem(HIDEPTH_KEY) ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export function saveHidepth(depth: number): void {
  try {
    localStorage.setItem(HIDEPTH_KEY, String(depth));
  } catch (error) {
    log("hidepth save failed", { error: String(error) });
  }
}

export function loadRuns(): number {
  const n = Number(localStorage.getItem(RUNS_KEY) ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export function saveRuns(count: number): void {
  try {
    localStorage.setItem(RUNS_KEY, String(count));
  } catch (error) {
    log("runs save failed", { error: String(error) });
  }
}
