/**
 * Break reminders (§2), pure: count tracked (active) time and fire once per interval.
 * Head mode every 10 min, Hand mode every 15 min. Non-blocking; the app shows a status line
 * that the user's next action dismisses.
 */
export const BREAK_MS = { head: 10 * 60_000, hand: 15 * 60_000 } as const;
/** Gaps longer than this (paused, hand away) don't count as active time. */
export const MAX_STEP_MS = 250;

export interface BreakTimer {
  /** Feed one frame; returns true when a reminder is due. */
  tick(tMs: number, active: boolean, mode: "hand" | "head"): boolean;
  reset(): void;
  readonly activeMs: number;
}

export function createBreakTimer(intervals: { head: number; hand: number } = BREAK_MS): BreakTimer {
  let last: number | null = null;
  let active = 0;
  return {
    get activeMs() {
      return active;
    },
    reset() {
      active = 0;
      last = null;
    },
    tick(t, isActive, mode) {
      const dt = last === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, t - last));
      last = t;
      if (isActive) active += dt;
      if (active >= intervals[mode]) {
        active = 0;
        return true;
      }
      return false;
    },
  };
}

export function breakMessage(mode: "hand" | "head"): string {
  return mode === "head"
    ? "Time for a short break: let your neck rest for a minute. (Any action hides this.)"
    : "Time for a short break: let your hand rest for a minute. (Any action hides this.)";
}
