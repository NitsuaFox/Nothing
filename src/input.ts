export function bindInput(
  canvas: HTMLCanvasElement,
  handlers: {
    tap: (x: number, y: number) => void;
    move?: (x: number, y: number) => void;
    muteToggle: () => void;
  },
): () => void {
  const point = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointer = (event: PointerEvent) => {
    event.preventDefault();
    const { x, y } = point(event);
    handlers.tap(x, y);
  };

  const onMove = (event: PointerEvent) => {
    if (!handlers.move) return;
    const { x, y } = point(event);
    handlers.move(x, y);
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
  };

  canvas.addEventListener("pointerdown", onPointer);
  canvas.addEventListener("pointermove", onMove);
  window.addEventListener("keydown", onKey);

  return () => {
    canvas.removeEventListener("pointerdown", onPointer);
    canvas.removeEventListener("pointermove", onMove);
    window.removeEventListener("keydown", onKey);
  };
}
