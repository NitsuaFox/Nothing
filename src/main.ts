import "./style.css";
import { log } from "./debug";
import { Game } from "./game";
import { bindInput } from "./input";
import { handshake } from "./wavedash";

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

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.resize(w, h);
}

resize();
window.addEventListener("resize", resize);

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

bindInput(canvas, {
  tap: (x, y) => {
    void game.tap(x, y);
  },
    muteToggle: () => game.toggleMute(),
    pick: (index) => game.pickRelic(index),
});

handshake();
log("boot");

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
