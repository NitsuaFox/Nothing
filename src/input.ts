export function bindInput(
  canvas: HTMLCanvasElement,
  handlers: {
    tap: (x: number, y: number) => void;
    muteToggle: () => void;
  },
): () => void {
  const onPointer = (event: PointerEvent) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    handlers.tap(event.clientX - rect.left, event.clientY - rect.top);
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
  window.addEventListener("keydown", onKey);

  return () => {
    canvas.removeEventListener("pointerdown", onPointer);
    window.removeEventListener("keydown", onKey);
  };
}
