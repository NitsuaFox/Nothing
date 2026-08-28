import { log } from "./debug";

/** Pause after the first unlock is queued so the kiss / whisper can land first. */
export const UNLOCK_LEAD_SEC = 2.2;
/** Minimum time between achievement pops (Wavedash overlay + in-game toast). */
export const UNLOCK_GAP_SEC = 5.0;

export type UnlockQueue = {
  pending: string[];
  cooldown: number;
  fired: number;
};

export function createUnlockQueue(): UnlockQueue {
  return { pending: [], cooldown: 0, fired: 0 };
}

export function enqueueUnlock(queue: UnlockQueue, id: string): boolean {
  if (queue.pending.includes(id)) {
    log("unlock already queued", { id, waiting: queue.pending.length });
    return false;
  }
  queue.pending.push(id);
  if (queue.fired === 0 && queue.pending.length === 1 && queue.cooldown <= 0) {
    queue.cooldown = UNLOCK_LEAD_SEC;
  }
  log("unlock queued", {
    id,
    waiting: queue.pending.length,
    cooldown: Number(queue.cooldown.toFixed(2)),
    fired: queue.fired,
  });
  return true;
}

/**
 * Advance the queue. Returns the next id to commit, or null if still waiting.
 * Caller should drop already-owned ids with `skipUnlock` so the gap is not wasted.
 */
export function tickUnlockQueue(queue: UnlockQueue, dt: number, hold: boolean): string | null {
  if (hold) return null;
  if (queue.cooldown > 0) {
    queue.cooldown = Math.max(0, queue.cooldown - dt);
  }
  if (queue.cooldown > 0 || queue.pending.length === 0) return null;
  return queue.pending[0] ?? null;
}

export function commitUnlock(queue: UnlockQueue): string {
  const id = queue.pending.shift();
  if (!id) {
    log("unlock commit empty");
    return "";
  }
  queue.fired += 1;
  queue.cooldown = UNLOCK_GAP_SEC;
  log("unlock commit", {
    id,
    fired: queue.fired,
    waiting: queue.pending.length,
    nextGap: UNLOCK_GAP_SEC,
  });
  return id;
}

export function skipUnlock(queue: UnlockQueue, reason: string): string {
  const id = queue.pending.shift() ?? "";
  log("unlock skip", { id, reason, waiting: queue.pending.length });
  return id;
}
