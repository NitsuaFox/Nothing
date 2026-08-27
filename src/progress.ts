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

export type ProgressSnapshot = {
  version: 1;
  found: DiscoveryId[];
  hiscore: number;
  hidepth: number;
  runs: number;
  updatedAt: number;
};

function isDiscoveryId(value: string): value is DiscoveryId {
  return (DISCOVERY_ORDER as string[]).includes(value);
}

export function loadSnapshot(): ProgressSnapshot {
  return {
    version: 1,
    found: DISCOVERY_ORDER.filter((id) => loadFound().has(id)),
    hiscore: loadHiscore(),
    hidepth: loadHidepth(),
    runs: loadRuns(),
    updatedAt: Date.now(),
  };
}

export function snapshotOf(
  found: Set<DiscoveryId>,
  hiscore: number,
  hidepth: number,
  runs: number,
): ProgressSnapshot {
  return {
    version: 1,
    found: DISCOVERY_ORDER.filter((id) => found.has(id)),
    hiscore,
    hidepth,
    runs,
    updatedAt: Date.now(),
  };
}

export function mergeSnapshots(a: ProgressSnapshot, b: ProgressSnapshot): ProgressSnapshot {
  const found = new Set<DiscoveryId>();
  for (const id of [...a.found, ...b.found]) {
    if (isDiscoveryId(id)) found.add(id);
  }
  return {
    version: 1,
    found: DISCOVERY_ORDER.filter((id) => found.has(id)),
    hiscore: Math.max(a.hiscore || 0, b.hiscore || 0),
    hidepth: Math.max(a.hidepth || 0, b.hidepth || 0),
    runs: Math.max(a.runs || 0, b.runs || 0),
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0, Date.now()),
  };
}

export function persistSnapshot(snap: ProgressSnapshot): void {
  saveFound(new Set(snap.found.filter(isDiscoveryId)));
  saveHiscore(snap.hiscore);
  saveHidepth(snap.hidepth);
  saveRuns(snap.runs);
  log("progress snapshot", {
    found: snap.found.length,
    hiscore: snap.hiscore,
    hidepth: snap.hidepth,
    runs: snap.runs,
  });
}
