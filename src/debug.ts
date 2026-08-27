const PREFIX = "[Nothing]";

export function log(message: string, extra?: Record<string, unknown>): void {
  if (extra) {
    console.log(`${PREFIX} ${message}`, extra);
    return;
  }
  console.log(`${PREFIX} ${message}`);
}
