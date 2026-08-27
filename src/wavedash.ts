import { log } from "./debug";

type WavedashHost = {
  updateLoadProgressZeroToOne?: (progress: number) => void;
  init?: (config?: { debug?: boolean }) => boolean;
};

function getHost(): WavedashHost | null {
  const host = (window as Window & { Wavedash?: WavedashHost }).Wavedash;
  return host ?? null;
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
