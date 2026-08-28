import "./style.css";
import { log } from "./debug";
import { Game, type SafeArea } from "./game";
import { bindInput } from "./input";
import { bootWavedash, platform, toggleOverlay } from "./wavedash";

function required<T>(value: T | null, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

const canvas = required(document.querySelector<HTMLCanvasElement>("#game"), "[Nothing] missing #game canvas");
const ctx = required(
  canvas.getContext("2d", { alpha: false, desynchronized: true }),
  "[Nothing] 2d context unavailable",
);

const game = new Game();

function readSafe(): SafeArea {
  const root = getComputedStyle(document.documentElement);
  const px = (name: string) => {
    const n = parseFloat(root.getPropertyValue(name));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: px("--safe-top"),
    right: px("--safe-right"),
    bottom: px("--safe-bottom"),
    left: px("--safe-left"),
  };
}

function viewport(): { w: number; h: number } {
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return { w: Math.round(vv.width), h: Math.round(vv.height) };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w, h } = viewport();
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.resize(w, h, readSafe());
}

resize();
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => {
  window.setTimeout(resize, 80);
});
window.visualViewport?.addEventListener("resize", resize);
window.visualViewport?.addEventListener("scroll", resize);

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

bindInput(canvas, {
  tap: (x, y) => {
    void game.tap(x, y);
  },
  move: (x, y) => game.movePointer(x, y),
  muteToggle: () => game.toggleMute(),
  overlay: () => toggleOverlay(),
});

void bootWavedash({
  onMute: (muted) => game.setMutedFromHost(muted),
  onUnlock: (id, title) => game.toastUnlock(title, id),
  onSave: (snap) => game.applySnapshot(snap),
  snapshot: () => game.snapshot(),
}).then(() => {
  log("platform ready", {
    gameId: platform.gameId,
    hosted: platform.hosted,
    stub: platform.stub,
    user: platform.username,
    board: platform.board.length,
    myRank: platform.myRank,
  });
  if (new URLSearchParams(window.location.search).get("preview") === "dead") {
    log("debug preview dead from query");
    game.previewDead("void");
  }
});

(window as unknown as { nothing: Game; nothingPlatform: typeof platform }).nothing = game;
(window as unknown as { nothing: Game; nothingPlatform: typeof platform }).nothingPlatform = platform;
log("boot", {
  debug: "window.nothing (Game, endRun, previewDead, debugShowHud, debugState) · window.nothingPlatform · ?demohud=1&huddebug=1 · ?preview=dead",
  touch: "ontouchstart" in window,
  coarse: window.matchMedia?.("(pointer: coarse)").matches ?? false,
});

if (/(?:^|[?&])demohud=1(?:&|$)/.test(window.location.search)) {
  game.debugShowHud();
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
