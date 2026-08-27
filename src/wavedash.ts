import { log } from "./debug";

type WavedashHost = {
  updateLoadProgressZeroToOne?: (progress: number) => void;
  init?: (config?: { debug?: boolean }) => boolean;
  uploadLeaderboardScore?: (id: string, score: number, replace: boolean) => Promise<unknown>;
  getLeaderboard?: (name: string) => Promise<{ data?: { id: string } }>;
};

function getHost(): WavedashHost | null {
  const host = (window as Window & { Wavedash?: WavedashHost }).Wavedash;
  return host ?? null;
}

export function submitScore(score: number): void {
  const host = getHost();
  const upload = host?.uploadLeaderboardScore;
  const getBoard = host?.getLeaderboard;
  if (!upload) {
    log("wavedash score skipped — no host");
    return;
  }
  void (async () => {
    try {
      let id = "high-scores";
      if (getBoard) {
        const board = await getBoard("high-scores");
        if (board?.data?.id) id = board.data.id;
      }
      await upload(id, score, true);
      log("wavedash score uploaded", { score, id });
    } catch (error) {
      log("wavedash score failed", { error: String(error) });
    }
  })();
}

/** Handshake that no-ops when the Wavedash shell is not injecting the SDK. */
export function handshake(): void {
  const host = getHost();
  if (!host?.init) {
    log("wavedash local play — SDK not present");
    return;
  }

  try {
    host.updateLoadProgressZeroToOne?.(1);
    host.init({ debug: true });
    log("wavedash init ok");
  } catch (error) {
    log("wavedash init failed", { error: String(error) });
  }
}
