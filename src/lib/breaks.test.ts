import { describe, expect, it } from "vitest";
import { BREAK_MS, createBreakTimer } from "./breaks";

function runFor(ms: number, mode: "hand" | "head", active = true, start = 0, timer = createBreakTimer()) {
  let fired = 0;
  for (let t = start; t <= start + ms; t += 33) if (timer.tick(t, active, mode)) fired++;
  return { fired, timer };
}

describe("break reminders", () => {
  it("fire after 10 min in Head mode and 15 min in Hand mode of active use", () => {
    expect(runFor(BREAK_MS.head - 2000, "head").fired).toBe(0);
    expect(runFor(BREAK_MS.head + 2000, "head").fired).toBe(1);
    expect(runFor(BREAK_MS.head + 2000, "hand").fired).toBe(0);
    expect(runFor(BREAK_MS.hand + 2000, "hand").fired).toBe(1);
  });

  it("inactive time and long gaps do not count", () => {
    expect(runFor(BREAK_MS.hand * 2, "hand", false).fired).toBe(0);
    const timer = createBreakTimer();
    timer.tick(0, true, "hand");
    timer.tick(60 * 60_000, true, "hand"); // an hour-long gap (paused / away) counts as at most 250 ms
    expect(timer.activeMs).toBeLessThanOrEqual(250);
  });

  it("restarts the count after firing", () => {
    expect(runFor(BREAK_MS.head * 2 + 5000, "head").fired).toBe(2);
  });
});
