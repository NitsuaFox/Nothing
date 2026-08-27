import { log } from "./debug";

export function bindInput(
  canvas: HTMLCanvasElement,
  handlers: {
    tap: (x: number, y: number) => void;
    move?: (x: number, y: number) => void;
    muteToggle: () => void;
    overlay?: () => void;
  },
): () => void {
  const point = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.clientWidth;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.clientHeight;
    return { x, y };
  };

  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  const tap = (clientX: number, clientY: number, source: string) => {
    const { x, y } = point(clientX, clientY);
    const now = performance.now();
    const close = Math.hypot(x - lastTapX, y - lastTapY) < 28;
    if (now - lastTapAt < 50 && close) {
      log("tap dedup", { source, x: Math.round(x), y: Math.round(y) });
      return;
    }
    lastTapAt = now;
    lastTapX = x;
    lastTapY = y;
    log("tap", { source, x: Math.round(x), y: Math.round(y) });
    handlers.tap(x, y);
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    tap(event.clientX, event.clientY, event.pointerType || "pointer");
  };

  const onMove = (event: PointerEvent) => {
    if (!handlers.move) return;
    const { x, y } = point(event.clientX, event.clientY);
    handlers.move(x, y);
  };

  const onTouchStart = (event: TouchEvent) => {
    event.preventDefault();
    if ("PointerEvent" in window) return;
    for (let i = 0; i < event.changedTouches.length; i++) {
      const t = event.changedTouches[i];
      tap(t.clientX, t.clientY, "touch");
    }
  };

  const onTouchEnd = (event: TouchEvent) => {
    event.preventDefault();
  };

  const onGesture = (event: Event) => {
    event.preventDefault();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) {
        handlers.tap(canvas.clientWidth / 2, canvas.clientHeight / 2);
      }
    }
    if (event.code === "KeyM") {
      event.preventDefault();
      handlers.muteToggle();
    }
    if (event.code === "Tab") {
      event.preventDefault();
      handlers.overlay?.();
      log("overlay key", { code: event.code });
    }
  };

  const opts: AddEventListenerOptions = { passive: false };
  canvas.addEventListener("pointerdown", onPointerDown, opts);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("touchstart", onTouchStart, opts);
  canvas.addEventListener("touchend", onTouchEnd, opts);
  canvas.addEventListener("touchcancel", onTouchEnd, opts);
  canvas.addEventListener("gesturestart", onGesture, opts);
  canvas.addEventListener("gesturechange", onGesture, opts);
  window.addEventListener("keydown", onKey);

  log("input bind", {
    pointer: "PointerEvent" in window,
    touch: "ontouchstart" in window,
    coarse: window.matchMedia?.("(pointer: coarse)").matches ?? false,
  });

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchend", onTouchEnd);
    canvas.removeEventListener("touchcancel", onTouchEnd);
    canvas.removeEventListener("gesturestart", onGesture);
    canvas.removeEventListener("gesturechange", onGesture);
    window.removeEventListener("keydown", onKey);
  };
}
