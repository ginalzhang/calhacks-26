/** Focus helpers: tiles activated by click/dwell hand focus back to the canvas (§3). */
export function canvasEl(): HTMLCanvasElement | null {
  return document.getElementById("steady-canvas") as HTMLCanvasElement | null;
}

export function focusCanvas() {
  // Never steal focus out of an open modal dialog.
  if (document.querySelector("[role=alertdialog]")) return;
  canvasEl()?.focus({ preventScroll: true });
}
