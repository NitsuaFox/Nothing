import { log } from "./debug";
import { ACHIEVEMENT_TITLE } from "./wavedash-catalog";

type Meta = Record<string, string | number>;

export type StubEntry = {
  userId: string;
  username: string;
  score: number;
  globalRank: number;
  metadata?: Meta;
};

type Board = {
  id: string;
  name: string;
  entries: StubEntry[];
};

type Ok<T> = { success: true; data: T } | { success: false; data: null; message: string };

const ok = <T>(data: T): Ok<T> => ({ success: true, data });
const fail = (message: string): Ok<never> => ({ success: false, data: null, message });

const KEY = "nothing:wd:stub";
const LOCAL_USER = { userId: "local", username: "YOU" };

const GHOSTS: { name: string; score: number; depth: number; combo: number }[] = [
  { name: "VOID", score: 180, depth: 3, combo: 12 },
  { name: "SPARK", score: 90, depth: 2, combo: 8 },
  { name: "RING", score: 40, depth: 1, combo: 4 },
  { name: "KISS", score: 24, depth: 1, combo: 3 },
  { name: "HUSH", score: 12, depth: 1, combo: 2 },
];

type StubSave = {
  boards: Record<string, Board>;
  stats: Record<string, number>;
  achievements: string[];
  muted: boolean;
};

function emptySave(): StubSave {
  return { boards: {}, stats: {}, achievements: [], muted: false };
}

function load(): StubSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as StubSave;
    return {
      boards: parsed.boards ?? {},
      stats: parsed.stats ?? {},
      achievements: parsed.achievements ?? [],
      muted: Boolean(parsed.muted),
    };
  } catch {
    return emptySave();
  }
}

function persist(save: StubSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (error) {
    log("wavedash stub save failed", { error: String(error) });
  }
}

function rankBoard(entries: StubEntry[]): StubEntry[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  return sorted.map((entry, i) => ({ ...entry, globalRank: i + 1 }));
}

function seed(board: Board): Board {
  const ids = new Set(board.entries.map((entry) => entry.userId));
  let added = 0;
  for (const ghost of GHOSTS) {
    const userId = `ghost-${ghost.name.toLowerCase()}`;
    if (ids.has(userId)) continue;
    board.entries.push({
      userId,
      username: ghost.name,
      score: ghost.score,
      globalRank: 0,
      metadata: { depth: ghost.depth, combo: ghost.combo },
    });
    ids.add(userId);
    added += 1;
  }
  if (added > 0 || board.entries.some((entry) => !entry.globalRank)) {
    board.entries = rankBoard(board.entries);
  }
  return board;
}

/**
 * Local stand-in for window.Wavedash so identity, boards, and achievements
 * work in Vite without `wavedash dev`. Real SDK takes over on Wavedash.
 */
export function createWavedashStub() {
  const save = load();
  const listeners = new Map<string, Array<(payload: unknown) => void>>();

  const emit = (event: string, payload: unknown) => {
    for (const fn of listeners.get(event) ?? []) fn(payload);
  };

  const Events = {
    MUTE_CHANGED: "MuteChanged",
    BACKEND_CONNECTED: "BackendConnected",
    STATS_STORED: "StatsStored",
  } as const;

  const board = (name: string): Board => {
    if (!save.boards[name]) {
      save.boards[name] = { id: name, name, entries: [] };
    }
    const before = save.boards[name].entries.length;
    seed(save.boards[name]);
    if (save.boards[name].entries.length !== before) persist(save);
    return save.boards[name];
  };

  return {
    stub: true as const,
    Events,
    LeaderboardSortOrder: { ASC: 0, DESC: 1 },
    LeaderboardDisplayType: { NUMERIC: 0, TIME_SECONDS: 1, TIME_MILLISECONDS: 2, TIME_GAME_TICKS: 3 },
    init(config?: { debug?: boolean }): boolean {
      log("wavedash stub init", { debug: Boolean(config?.debug), boards: Object.keys(save.boards) });
      queueMicrotask(() =>
        emit(Events.BACKEND_CONNECTED, {
          isConnected: false,
          hasEverConnected: false,
          connectionCount: 0,
          connectionRetries: 0,
        }),
      );
      return true;
    },
    updateLoadProgressZeroToOne(progress: number): void {
      log("wavedash stub load", { progress });
    },
    on(event: string, listener: (payload: unknown) => void): () => void {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
      return () => {
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((fn) => fn !== listener),
        );
      };
    },
    getUser() {
      return { ...LOCAL_USER };
    },
    getUsername(userId?: string): string | null {
      if (!userId || userId === LOCAL_USER.userId) return LOCAL_USER.username;
      for (const b of Object.values(save.boards)) {
        const hit = b.entries.find((e) => e.userId === userId);
        if (hit) return hit.username;
      }
      return null;
    },
    getUserId(): string {
      return LOCAL_USER.userId;
    },
    async getOrCreateLeaderboard(name: string, _sort: number, _display: number) {
      const b = board(name);
      log("wavedash stub board", { name, entries: b.entries.length });
      return ok({ id: b.id, name: b.name, totalEntries: b.entries.length, created: false });
    },
    async getLeaderboard(name: string) {
      const b = save.boards[name];
      if (!b) return fail("Leaderboard not found");
      return ok({ id: b.id, name: b.name, totalEntries: b.entries.length });
    },
    async uploadLeaderboardScore(id: string, score: number, keepBest: boolean, _ugc?: unknown, metadata?: Meta) {
      const b = save.boards[id] ?? board(id);
      const existing = b.entries.find((e) => e.userId === LOCAL_USER.userId);
      const submittedRank = rankBoard([
        ...b.entries.filter((e) => e.userId !== LOCAL_USER.userId),
        { userId: LOCAL_USER.userId, username: LOCAL_USER.username, score, globalRank: 0, metadata },
      ]).find((e) => e.userId === LOCAL_USER.userId)?.globalRank ?? 1;

      if (existing && keepBest && score <= existing.score) {
        log("wavedash stub score kept", { id, score, best: existing.score, submittedRank, globalRank: existing.globalRank });
        return ok({
          ...existing,
          submittedScore: score,
          submittedRank,
          globalRank: existing.globalRank,
        });
      }

      const next: StubEntry = {
        userId: LOCAL_USER.userId,
        username: LOCAL_USER.username,
        score,
        globalRank: 0,
        metadata,
      };
      b.entries = rankBoard([...b.entries.filter((e) => e.userId !== LOCAL_USER.userId), next]);
      persist(save);
      const mine = b.entries.find((e) => e.userId === LOCAL_USER.userId)!;
      log("wavedash stub score uploaded", { id, score, globalRank: mine.globalRank, submittedRank, metadata });
      return ok({ ...mine, submittedScore: score, submittedRank });
    },
    async listLeaderboardEntries(id: string, offset: number, limit: number) {
      const b = save.boards[id] ?? board(id);
      const page = rankBoard(b.entries).slice(offset, offset + limit);
      log("wavedash stub list", { id, offset, limit, names: page.map((e) => `${e.globalRank}:${e.username}`) });
      return ok(page);
    },
    async listLeaderboardEntriesAroundUser(id: string, countAhead: number, countBehind: number) {
      const b = save.boards[id] ?? board(id);
      const ranked = rankBoard(b.entries);
      const meIdx = ranked.findIndex((e) => e.userId === LOCAL_USER.userId);
      const start = meIdx < 0 ? 0 : Math.max(0, meIdx - countAhead);
      const end = meIdx < 0 ? countAhead + 1 + countBehind : meIdx + 1 + countBehind;
      const page = ranked.slice(start, end);
      log("wavedash stub around-user", {
        id,
        countAhead,
        countBehind,
        meIdx,
        names: page.map((e) => `${e.globalRank}:${e.username}:${e.score}`),
      });
      return ok(page);
    },
    async getMyLeaderboardEntries(id: string) {
      const b = save.boards[id];
      if (!b) return ok([]);
      return ok(rankBoard(b.entries).filter((e) => e.userId === LOCAL_USER.userId));
    },
    async requestStats() {
      return ok(true);
    },
    getStat(identifier: string): number {
      return save.stats[identifier] ?? 0;
    },
    setStat(identifier: string, value: number, storeNow?: boolean): boolean {
      save.stats[identifier] = value;
      if (storeNow) persist(save);
      log("wavedash stub stat", { identifier, value, storeNow: Boolean(storeNow) });
      return true;
    },
    getAchievement(identifier: string): boolean {
      return save.achievements.includes(identifier);
    },
    setAchievement(identifier: string, storeNow?: boolean): boolean {
      if (!save.achievements.includes(identifier)) {
        save.achievements.push(identifier);
        log("wavedash stub unlock", { identifier, title: ACHIEVEMENT_TITLE[identifier] ?? identifier });
      }
      if (storeNow) persist(save);
      return true;
    },
    storeStats(): boolean {
      persist(save);
      emit(Events.STATS_STORED, { success: true });
      log("wavedash stub storeStats", { stats: save.stats, ach: save.achievements.length });
      return true;
    },
    isMuted(): boolean {
      return save.muted;
    },
    async toggleMute(): Promise<boolean> {
      save.muted = !save.muted;
      persist(save);
      emit(Events.MUTE_CHANGED, { isMuted: save.muted });
      log("wavedash stub mute", { muted: save.muted });
      return true;
    },
    toggleOverlay(): void {
      log("wavedash stub overlay — no host overlay in local play");
    },
    async updateUserPresence(data: Record<string, string | number | boolean | null>) {
      log("wavedash stub presence", data);
      return ok(true);
    },
    async listFriends() {
      return ok([]);
    },
    async writeLocalFile() {
      return true;
    },
    async uploadRemoteFile() {
      return fail("stub has no remote storage");
    },
    async downloadRemoteFile() {
      return fail("stub has no remote storage");
    },
    async readLocalFile() {
      return null;
    },
    async remoteFileExists() {
      return ok(false);
    },
  };
}

export type WavedashStub = ReturnType<typeof createWavedashStub>;
