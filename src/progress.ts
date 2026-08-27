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
const LIVES_KEY = "nothing:lives";

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

export function loadLives(): number {
  const n = Number(localStorage.getItem(LIVES_KEY) ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export function saveLives(count: number): void {
  try {
    localStorage.setItem(LIVES_KEY, String(count));
  } catch (error) {
    log("lives save failed", { error: String(error) });
  }
}
