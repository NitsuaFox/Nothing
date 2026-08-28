import { log } from "./debug";
import {
  mergeSnapshots,
  persistSnapshot,
  type DiscoveryId,
  type ProgressSnapshot,
} from "./progress";
// Do not import `@wvdsh/sdk-js` at runtime — its default export throws unless
// the host injected `window.Wavedash` (`wavedash dev` or wavedash.com).
import {
  ACHIEVEMENT_TITLE,
  ACHIEVEMENTS,
  BOARDS,
  CLOUD_SAVE_PATH,
  DISCOVERY_ACHIEVEMENT,
  STATS,
  WAVEDASH_GAME_ID,
} from "./wavedash-catalog";
import { aroundLimit, aroundOffset, NEAR_DOWN, NEAR_UP } from "./leaderboard";
import { createWavedashStub } from "./wavedash-stub";

type Meta = Record<string, string | number>;

type Ok<T> = { success: true; data: T } | { success: false; data: null; message?: string };

type RawEntry = {
  globalRank?: number;
  rank?: number;
  username?: string;
  name?: string;
  score?: number;
  userId?: string;
  metadata?: Meta;
};

export type BoardRow = {
  rank: number;
  name: string;
  score: number;
  userId: string;
  mine: boolean;
  friend: boolean;
  depth?: number;
  combo?: number;
};

export type PlatformState = {
  gameId: string;
  hosted: boolean;
  stub: boolean;
  ready: boolean;
  userId: string;
  username: string;
  board: BoardRow[];
  around: BoardRow[];
  myRank: number | null;
  myScore: number | null;
  submittedRank: number | null;
  lastUnlock: string;
  friends: number;
};

export type PlatformHooks = {
  onMute?: (muted: boolean) => void;
  onUnlock?: (id: string, title: string) => void;
  onSave?: (snap: ProgressSnapshot) => void;
  snapshot?: () => ProgressSnapshot;
};

type Host = {
  stub?: boolean;
  init: (config?: { debug?: boolean }) => boolean;
  updateLoadProgressZeroToOne?: (progress: number) => void;
  Events?: { MUTE_CHANGED: string; BACKEND_CONNECTED: string; STATS_STORED: string };
  on?: (event: string, listener: (payload: unknown) => void) => () => void;
  LeaderboardSortOrder?: { DESC: number };
  LeaderboardDisplayType?: { NUMERIC: number };
  getUser?: () => { userId?: string; username?: string; id?: string } | null;
  getUsername?: (userId?: string) => string | null;
  getUserId?: () => string;
  getOrCreateLeaderboard: (name: string, sort: number, display: number) => Promise<Ok<{ id: string; name?: string }> | { id: string }>;
  uploadLeaderboardScore: (
    id: string,
    score: number,
    keepBest: boolean,
    ugc?: unknown,
    metadata?: Meta,
  ) => Promise<Ok<{ globalRank?: number; submittedRank?: number; score?: number }>>;
  listLeaderboardEntries: (id: string, offset: number, limit: number, friendsOnly?: boolean) => Promise<Ok<unknown>>;
  listLeaderboardEntriesAroundUser?: (
    id: string,
    countAhead: number,
    countBehind: number,
    friendsOnly?: boolean,
  ) => Promise<Ok<unknown>>;
  getMyLeaderboardEntries?: (id: string) => Promise<Ok<unknown>>;
  requestStats?: () => Promise<Ok<boolean> | boolean>;
  getStat?: (id: string) => number;
  setStat?: (id: string, value: number, storeNow?: boolean) => boolean;
  getAchievement?: (id: string) => boolean;
  setAchievement?: (id: string, storeNow?: boolean) => boolean;
  storeStats?: () => boolean;
  isMuted?: () => boolean;
  toggleMute?: () => Promise<boolean> | boolean;
  toggleOverlay?: () => void;
  updateUserPresence?: (data: Record<string, string | number | boolean | null>) => Promise<unknown>;
  listFriends?: () => Promise<Ok<Array<{ userId?: string; username?: string }>>>;
  writeLocalFile?: (path: string, data: Uint8Array) => Promise<boolean>;
  readLocalFile?: (path: string) => Promise<Uint8Array | null>;
  uploadRemoteFile?: (path: string) => Promise<Ok<string> | string>;
  downloadRemoteFile?: (path: string) => Promise<Ok<string> | string>;
  remoteFileExists?: (path: string) => Promise<Ok<boolean> | boolean>;
};

export const platform: PlatformState = {
  gameId: WAVEDASH_GAME_ID,
  hosted: false,
  stub: false,
  ready: false,
  userId: "",
  username: "",
  board: [],
  around: [],
  myRank: null,
  myScore: null,
  submittedRank: null,
  lastUnlock: "",
  friends: 0,
};

let host: Host | null = null;
let hooks: PlatformHooks = {};
let boardIds: Partial<Record<string, string>> = {};
const friendIds = new Set<string>();
let firstLight = false;
let presenceKey = "";
let saveTimer = 0;

function unwrap<T>(value: Ok<T> | T | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object" && "success" in (value as object)) {
    const box = value as Ok<T>;
    return box.success ? box.data : fallback;
  }
  return value as T;
}

function asEntries(data: unknown): RawEntry[] {
  if (Array.isArray(data)) return data as RawEntry[];
  if (data && typeof data === "object" && Array.isArray((data as { entries?: unknown }).entries)) {
    return (data as { entries: RawEntry[] }).entries;
  }
  return [];
}

function detectHost(): Host {
  const injected = (window as Window & { Wavedash?: Host }).Wavedash;
  if (injected && typeof injected.init === "function" && typeof injected.getOrCreateLeaderboard === "function") {
    log("wavedash host detected", { gameId: WAVEDASH_GAME_ID });
    return injected;
  }
  log("wavedash local stub — SDK not injected", { gameId: WAVEDASH_GAME_ID });
  return createWavedashStub();
}

function readIdentity(): void {
  if (!host) return;
  try {
    const user = host.getUser?.();
    const id = String(host.getUserId?.() ?? user?.userId ?? user?.id ?? "");
    const name = String(host.getUsername?.() ?? user?.username ?? "");
    platform.userId = id;
    platform.username = name;
    log("wavedash identity", { userId: id, username: name, hosted: platform.hosted });
  } catch (error) {
    log("wavedash identity failed", { error: String(error) });
  }
}

function rowFrom(raw: RawEntry): BoardRow {
  const userId = String(raw.userId ?? "");
  const meta = raw.metadata ?? {};
  const depth = typeof meta.depth === "number" ? meta.depth : Number(meta.depth);
  const combo = typeof meta.combo === "number" ? meta.combo : Number(meta.combo);
  return {
    rank: Number(raw.globalRank ?? raw.rank ?? 0) || 0,
    name: String(raw.username ?? raw.name ?? "·"),
    score: Number(raw.score ?? 0) || 0,
    userId,
    mine: Boolean(userId && userId === platform.userId),
    friend: friendIds.has(userId),
    depth: Number.isFinite(depth) ? depth : undefined,
    combo: Number.isFinite(combo) ? combo : undefined,
  };
}

async function ensureBoard(name: string): Promise<string | null> {
  if (!host) return null;
  if (boardIds[name]) return boardIds[name] ?? null;
  try {
    const sort = host.LeaderboardSortOrder?.DESC ?? 1;
    const display = host.LeaderboardDisplayType?.NUMERIC ?? 0;
    const res = await host.getOrCreateLeaderboard(name, sort, display);
    const data = unwrap(res as Ok<{ id?: string; _id?: string }>, null);
    const id = data && typeof data === "object" ? String(data.id ?? data._id ?? "") : "";
    if (!id) {
      log("wavedash board missing id", { name, res });
      return null;
    }
    boardIds[name] = id;
    log("wavedash board ready", { name, id });
    return id;
  } catch (error) {
    log("wavedash board failed", { name, error: String(error) });
    return null;
  }
}

async function refreshScoreBoard(): Promise<void> {
  if (!host) return;
  const id = await ensureBoard(BOARDS.score);
  if (!id) return;
  try {
    const res = await host.listLeaderboardEntries(id, 0, 8, false);
    const rows = asEntries(unwrap(res, [])).map(rowFrom);
    platform.board = rows;
    const mine = rows.find((row) => row.mine);
    if (mine) {
      platform.myRank = mine.rank;
      platform.myScore = mine.score;
    } else if (host.getMyLeaderboardEntries) {
      const mineRes = await host.getMyLeaderboardEntries(id);
      const mineRows = asEntries(unwrap(mineRes, [])).map(rowFrom);
      if (mineRows[0]) {
        platform.myRank = mineRows[0].rank;
        platform.myScore = mineRows[0].score;
      }
    }
    log("wavedash board fetched", {
      count: rows.length,
      myRank: platform.myRank,
      top: rows[0]?.name ?? "",
    });
  } catch (error) {
    log("wavedash board fetch failed", { error: String(error) });
  }
}

function mergeAround(rows: BoardRow[]): void {
  const byId = new Map<string, BoardRow>();
  for (const row of [...platform.around, ...rows]) {
    const key = row.userId || `${row.name}:${row.rank}`;
    const prev = byId.get(key);
    if (!prev || row.score > prev.score) byId.set(key, row);
  }
  platform.around = [...byId.values()].sort((a, b) => a.rank - b.rank || b.score - a.score);
}

async function refreshAround(rank: number | null): Promise<void> {
  if (!host) return;
  const id = await ensureBoard(BOARDS.score);
  if (!id) return;
  try {
    if (host.listLeaderboardEntriesAroundUser) {
      const res = await host.listLeaderboardEntriesAroundUser(id, NEAR_UP, NEAR_DOWN, false);
      const rows = asEntries(unwrap(res, [])).map(rowFrom);
      mergeAround(rows);
      log("wavedash around user", {
        ahead: NEAR_UP,
        behind: NEAR_DOWN,
        names: rows.map((row) => `${row.rank}:${row.name}:${row.score}`),
      });
    }
  } catch (error) {
    log("wavedash around-user failed", { error: String(error) });
  }

  const target = rank && rank > 0 ? rank : platform.submittedRank ?? platform.myRank;
  if (!target || target <= 0) return;
  try {
    const offset = aroundOffset(target);
    const limit = aroundLimit();
    const res = await host.listLeaderboardEntries(id, offset, limit, false);
    const rows = asEntries(unwrap(res, [])).map(rowFrom);
    mergeAround(rows);
    log("wavedash around rank", {
      rank: target,
      offset,
      limit,
      names: rows.map((row) => `${row.rank}:${row.name}:${row.score}`),
      around: platform.around.map((row) => `${row.rank}:${row.name}`),
    });
  } catch (error) {
    log("wavedash around-rank failed", { error: String(error) });
  }
}

function bumpStat(id: string, delta: number): void {
  if (!host?.setStat || !host.getStat) return;
  const next = (host.getStat(id) || 0) + delta;
  host.setStat(id, next, false);
}

function maxStat(id: string, value: number): void {
  if (!host?.setStat || !host.getStat) return;
  const cur = host.getStat(id) || 0;
  if (value > cur) host.setStat(id, value, false);
}

function flushStats(): void {
  try {
    host?.storeStats?.();
  } catch (error) {
    log("wavedash storeStats failed", { error: String(error) });
  }
}

export function unlockAchievement(id: string): void {
  if (!host) return;
  try {
    if (host.getAchievement?.(id)) return;
    const ok = host.setAchievement?.(id, true) ?? false;
    if (!ok && host.setAchievement) {
      // some hosts return false when the id is unknown — still log
    }
    if (host.getAchievement?.(id) || ok) {
      const title = ACHIEVEMENT_TITLE[id] ?? id;
      platform.lastUnlock = title;
      log("wavedash unlock", { id, title, hosted: platform.hosted });
      hooks.onUnlock?.(id, title);
    }
  } catch (error) {
    log("wavedash unlock failed", { id, error: String(error) });
  }
}

async function pullCloud(local: ProgressSnapshot): Promise<void> {
  if (!host?.remoteFileExists || !host.downloadRemoteFile || !host.readLocalFile) return;
  try {
    const existsRaw = await host.remoteFileExists(CLOUD_SAVE_PATH);
    const exists = typeof existsRaw === "boolean" ? existsRaw : unwrap(existsRaw, false);
    if (!exists) {
      log("wavedash cloud empty");
      return;
    }
    await host.downloadRemoteFile(CLOUD_SAVE_PATH);
    const bytes = await host.readLocalFile(CLOUD_SAVE_PATH);
    if (!bytes) return;
    const text = new TextDecoder().decode(bytes);
    const cloud = JSON.parse(text) as ProgressSnapshot;
    const merged = mergeSnapshots(local, cloud);
    persistSnapshot(merged);
    hooks.onSave?.(merged);
    log("wavedash cloud loaded", {
      found: merged.found.length,
      hiscore: merged.hiscore,
      hidepth: merged.hidepth,
      runs: merged.runs,
    });
  } catch (error) {
    log("wavedash cloud load failed", { error: String(error) });
  }
}

async function pushCloud(): Promise<void> {
  if (!host?.writeLocalFile || !host.uploadRemoteFile) return;
  const snap = hooks.snapshot?.();
  if (!snap) return;
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(snap));
    await host.writeLocalFile(CLOUD_SAVE_PATH, bytes);
    const res = await host.uploadRemoteFile(CLOUD_SAVE_PATH);
    const ok = typeof res === "string" ? res.length > 0 : Boolean((res as Ok<string>).success);
    log("wavedash cloud saved", { ok, found: snap.found.length, hiscore: snap.hiscore });
  } catch (error) {
    log("wavedash cloud save failed", { error: String(error) });
  }
}

export function persistProgress(): void {
  if (!platform.hosted) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void pushCloud();
  }, 400);
}

export function setPresence(status: string, details?: string): void {
  if (!host?.updateUserPresence) return;
  const key = `${status}|${details ?? ""}`;
  if (key === presenceKey) return;
  presenceKey = key;
  void host
    .updateUserPresence({ status, details: details ?? "" })
    .then(() => log("wavedash presence", { status, details: details ?? "" }))
    .catch((error: unknown) => log("wavedash presence failed", { error: String(error) }));
}

export function toggleOverlay(): void {
  try {
    host?.toggleOverlay?.();
    log("wavedash overlay toggle");
  } catch (error) {
    log("wavedash overlay failed", { error: String(error) });
  }
}

export function toggleHostMute(): void {
  if (!host?.toggleMute) return;
  void Promise.resolve(host.toggleMute()).then((applied) => {
    log("wavedash mute toggle", { applied, muted: host?.isMuted?.() ?? null });
  });
}

export function hostMuteState(): boolean | null {
  if (!platform.hosted || !host?.isMuted) return null;
  return host.isMuted();
}

export function onKiss(kind: "perfect" | "good" | "miss"): void {
  if (kind === "perfect") bumpStat(STATS.perfects, 1);
  if (!firstLight) {
    firstLight = true;
    unlockAchievement(ACHIEVEMENTS.firstLight);
  }
  flushStats();
}

export function onSilence(): void {
  bumpStat(STATS.silences, 1);
  flushStats();
}

export function onDiscovery(id: DiscoveryId, foundCount: number): void {
  unlockAchievement(DISCOVERY_ACHIEVEMENT[id]);
  maxStat(STATS.discoveries, foundCount);
  if (foundCount >= 8) unlockAchievement(ACHIEVEMENTS.catalog);
  flushStats();
  persistProgress();
}

export function onBang(universes: number): void {
  unlockAchievement(ACHIEVEMENTS.universe);
  maxStat(STATS.universes, universes);
  flushStats();
}

export function onDescend(depth: number, combo: number): void {
  if (depth >= 2) unlockAchievement(ACHIEVEMENTS.deeper);
  if (depth >= 5) unlockAchievement(ACHIEVEMENTS.depth5);
  maxStat(STATS.bestDepth, depth);
  setPresence(`DEPTH ${depth}`, combo > 0 ? `combo ${combo}` : "");
  flushStats();
}

export function onStreak(mul: number): void {
  if (mul >= 2) unlockAchievement(ACHIEVEMENTS.streakX2);
  if (mul >= 3) unlockAchievement(ACHIEVEMENTS.streakX3);
  flushStats();
}

export function onCombo(combo: number): void {
  maxStat(STATS.bestCombo, combo);
  if (combo >= 25) unlockAchievement(ACHIEVEMENTS.combo25);
}

export function onRunOver(run: {
  score: number;
  depth: number;
  combo: number;
  found: number;
  reason: string;
}): void {
  bumpStat(STATS.runs, 1);
  maxStat(STATS.bestScore, run.score);
  maxStat(STATS.bestDepth, run.depth);
  maxStat(STATS.bestCombo, run.combo);
  maxStat(STATS.discoveries, run.found);
  if ((host?.getStat?.(STATS.runs) ?? 0) >= 10) unlockAchievement(ACHIEVEMENTS.runs10);
  if (run.score >= 1000) unlockAchievement(ACHIEVEMENTS.score1k);
  if (run.score >= 10000) unlockAchievement(ACHIEVEMENTS.score10k);
  flushStats();
  setPresence("VOID", String(run.score));
  persistProgress();
  platform.submittedRank = null;
  void submitRun(run);
}

async function submitRun(run: { score: number; depth: number; combo: number; found: number; reason: string }): Promise<void> {
  if (!host) return;
  const meta: Meta = { depth: run.depth, combo: run.combo, found: run.found, reason: run.reason };
  const jobs: Array<{ name: string; score: number }> = [
    { name: BOARDS.score, score: run.score },
    { name: BOARDS.depth, score: run.depth },
    { name: BOARDS.combo, score: run.combo },
  ];
  for (const job of jobs) {
    if (job.score <= 0 && job.name !== BOARDS.score) continue;
    const id = await ensureBoard(job.name);
    if (!id) continue;
    try {
      const res = await host.uploadLeaderboardScore(id, job.score, true, undefined, meta);
      const data = unwrap(res, null);
      log("wavedash score uploaded", {
        board: job.name,
        score: job.score,
        globalRank: data && typeof data === "object" ? (data as { globalRank?: number }).globalRank : null,
        submittedRank: data && typeof data === "object" ? (data as { submittedRank?: number }).submittedRank : null,
      });
      if (job.name === BOARDS.score && data && typeof data === "object") {
        const box = data as { globalRank?: number; submittedRank?: number };
        const standing = Number(box.globalRank);
        const submitted = Number(box.submittedRank);
        if (Number.isFinite(standing) && standing > 0) platform.myRank = standing;
        if (Number.isFinite(submitted) && submitted > 0) platform.submittedRank = submitted;
        else if (Number.isFinite(standing) && standing > 0) platform.submittedRank = standing;
        platform.myScore = run.score;
        log("wavedash score standing", {
          score: run.score,
          myRank: platform.myRank,
          submittedRank: platform.submittedRank,
        });
      }
    } catch (error) {
      log("wavedash score failed", { board: job.name, error: String(error) });
    }
  }
  await refreshScoreBoard();
  await refreshAround(platform.submittedRank ?? platform.myRank);
}

export async function bootWavedash(next: PlatformHooks): Promise<void> {
  hooks = next;
  host = detectHost();
  platform.hosted = !host.stub;
  platform.stub = Boolean(host.stub);

  try {
    host.updateLoadProgressZeroToOne?.(1);
    host.init({ debug: true });
  } catch (error) {
    log("wavedash init failed", { error: String(error) });
  }

  if (host.on && host.Events?.MUTE_CHANGED) {
    host.on(host.Events.MUTE_CHANGED, (payload) => {
      const muted = Boolean((payload as { isMuted?: boolean })?.isMuted);
      log("wavedash mute event", { muted });
      hooks.onMute?.(muted);
    });
  }
  if (host.on && host.Events?.BACKEND_CONNECTED) {
    host.on(host.Events.BACKEND_CONNECTED, (payload) => {
      log("wavedash backend", payload as Record<string, unknown>);
      readIdentity();
    });
  }

  readIdentity();
  if (host.isMuted && platform.hosted) hooks.onMute?.(host.isMuted());

  try {
    await host.requestStats?.();
    log("wavedash stats ready", {
      runs: host.getStat?.(STATS.runs) ?? 0,
      best: host.getStat?.(STATS.bestScore) ?? 0,
    });
  } catch (error) {
    log("wavedash stats failed", { error: String(error) });
  }

  try {
    const friends = unwrap(await host.listFriends?.(), []);
    for (const friend of friends) {
      if (friend.userId) friendIds.add(String(friend.userId));
    }
    platform.friends = friendIds.size;
    log("wavedash friends", { count: platform.friends });
  } catch (error) {
    log("wavedash friends failed", { error: String(error) });
  }

  await ensureBoard(BOARDS.score);
  await ensureBoard(BOARDS.depth);
  await ensureBoard(BOARDS.combo);
  await refreshScoreBoard();
  await refreshAround(platform.myRank);

  const local = hooks.snapshot?.();
  if (local && platform.hosted) await pullCloud(local);

  platform.ready = true;
  setPresence("NOTHING", "a universe from a single point");
  log("wavedash boot", {
    gameId: WAVEDASH_GAME_ID,
    hosted: platform.hosted,
    stub: platform.stub,
    user: platform.username,
    board: platform.board.length,
    myRank: platform.myRank,
  });
}
