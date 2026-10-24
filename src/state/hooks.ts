/** window.__steady test hooks (contract: SteadyTestHooks in src/tracking/LandmarkSource.ts). */
import type { SteadyTestHooks } from "@/tracking/LandmarkSource";
import { undoLabel } from "@/pipeline/document";
import { runCommand } from "./commands";
import { page } from "./docOps";
import { runtime } from "./runtime";
import { getState } from "./store";

declare global {
  interface Window {
    __steady?: SteadyTestHooks;
  }
}

export function installHooks() {
  const hooks: SteadyTestHooks = {
    getState() {
      const s = getState();
      const p = page();
      const last = p.strokes[p.strokes.length - 1];
      return {
        pen: s.pen,
        strokeCount: p.strokes.length,
        textCount: p.texts.length,
        pageName: p.name,
        tracking: s.tracking,
        lossReason: s.lossReason,
        calibrated: !!s.calibration,
        calibrating: s.phase === "calibrating",
        status: s.status.text,
        undoLabel: undoLabel(s.history),
        lastStrokeKind: last?.kind ?? null,
        settings: { steadiness: s.settings.steadiness, latch: s.settings.latch, gain: s.settings.gain },
        metrics: { ...s.metrics } as unknown as Record<string, number>,
      };
    },
    async command(text: string) {
      await runCommand(text, "typed");
    },
    get replay() {
      return runtime.replay;
    },
  };
  window.__steady = hooks;
}
