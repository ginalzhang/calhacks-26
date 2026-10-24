import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCommand } from "./resolve";
import { getClaudeStats, clearClaudeLog } from "./claudeLog";
import type { CommandContext } from "@/pipeline/types";

const ctx: CommandContext = { lastActions: ["pen.toggle", "pen.toggle", "colour.blue", "undo"], selected: null, canvas: { w: 1200, h: 800 } };
const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", { onLine: true });
  clearClaudeLog();
});
afterEach(() => vi.unstubAllGlobals());

describe("resolveCommand", () => {
  it("uses the grammar first (no network)", async () => {
    expect(await resolveCommand("Make it blue!", ctx)).toEqual({ kind: "actions", actions: ["colour.blue"], source: "grammar", heard: "Make it blue!" });
    expect(await resolveCommand("zoom inn", ctx)).toMatchObject({ kind: "actions", actions: ["zoom.in"], source: "grammar" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes extra phrase args through", async () => {
    const r = await resolveCommand("shaky day", ctx, { extra: [{ phrase: "shaky day", id: "profile.next", arg: "p2" }] });
    expect(r).toMatchObject({ kind: "actions", actions: ["profile.next"], arg: "p2" });
  });

  it("dialog open: exact only, never calls Claude", async () => {
    expect(await resolveCommand("yes", ctx, { dialogOpen: true })).toMatchObject({ kind: "actions", actions: ["confirm.yes"] });
    const r = await resolveCommand("yess", ctx, { dialogOpen: true });
    expect(r).toMatchObject({ kind: "none", reason: "no-match", heard: "yess" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offline -> none/offline with the nearest grammar matches", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const r = await resolveCommand("paint the room", ctx);
    expect(r).toMatchObject({ kind: "none", reason: "offline", heard: "paint the room" });
    if (r.kind === "none") expect(r.nearest).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to /api/command and sends text + last 3 actions only", async () => {
    fetchMock.mockReturnValueOnce(ok({ kind: "actions", actions: ["shape.circle"], mock: false, latencyMs: 812 }));
    const r = await resolveCommand("make the last thing look like a ball", ctx);
    expect(r).toEqual({ kind: "actions", actions: ["shape.circle"], source: "claude", heard: "make the last thing look like a ball" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/command");
    const body = JSON.parse(init.body);
    expect(body.context.lastActions).toEqual(["pen.toggle", "colour.blue", "undo"]);
    expect(body.transcript).toBe("make the last thing look like a ball");
    expect(getClaudeStats()).toMatchObject({ calls: 1, accepted: 1 });
  });

  it("returns clarify options", async () => {
    fetchMock.mockReturnValueOnce(
      ok({ kind: "clarify", question: "Bigger how?", options: [{ label: "Zoom in", actions: ["zoom.in"] }, { label: "Thicker pen", actions: ["width.thicker"] }], mock: true, latencyMs: 400 }),
    );
    expect(await resolveCommand("make it bigger", ctx)).toMatchObject({ kind: "clarify", question: "Bigger how?" });
  });

  it("client-side zod rejects malformed responses -> invalid", async () => {
    fetchMock.mockReturnValueOnce(ok({ kind: "actions", actions: ["paint.room"], mock: false, latencyMs: 1 }));
    expect(await resolveCommand("paint the room", ctx)).toMatchObject({ kind: "none", reason: "invalid" });
    fetchMock.mockReturnValueOnce(
      ok({ kind: "clarify", question: "?", options: [1, 2, 3, 4].map((n) => ({ label: `o${n}`, actions: ["undo"] })), mock: false, latencyMs: 1 }),
    );
    expect(await resolveCommand("paint the room", ctx)).toMatchObject({ kind: "none", reason: "invalid" });
    fetchMock.mockReturnValueOnce(ok({ error: "bad-request", message: "x", mock: false }, 400));
    expect(await resolveCommand("paint the room", ctx)).toMatchObject({ kind: "none", reason: "invalid" });
  });

  it("passes server none reasons through and maps network failures", async () => {
    fetchMock.mockReturnValueOnce(ok({ kind: "none", reason: "timeout", mock: false, latencyMs: 2500 }));
    expect(await resolveCommand("paint the room", ctx)).toMatchObject({ kind: "none", reason: "timeout" });
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    expect(await resolveCommand("paint the room", ctx)).toMatchObject({ kind: "none", reason: "timeout" });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await resolveCommand("paint the room", ctx)).toMatchObject({ kind: "none", reason: "offline" });
    expect(getClaudeStats().timeouts).toBe(2);
  });
});
