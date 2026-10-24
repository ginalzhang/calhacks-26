import { describe, expect, it } from "vitest";
import { ActionsSchema, CleanupRequestSchema, CleanupResponseSchema, CleanupSchema, CommandRequestSchema, CommandResponseSchema } from "./apiTypes";

describe("ActionsSchema (Claude output for /api/command)", () => {
  it("accepts well-formed actions, clarify and none", () => {
    expect(ActionsSchema.safeParse({ kind: "actions", actions: ["shape.circle"] }).success).toBe(true);
    expect(ActionsSchema.safeParse({ kind: "actions", actions: ["shape.circle", "colour.blue"] }).success).toBe(true);
    expect(
      ActionsSchema.safeParse({
        kind: "clarify",
        question: "Which did you mean?",
        options: [
          { label: "Make it a circle", actions: ["shape.circle"] },
          { label: "Make it blue", actions: ["colour.blue"] },
        ],
      }).success,
    ).toBe(true);
    expect(ActionsSchema.safeParse({ kind: "none" }).success).toBe(true);
  });

  it("rejects unknown action ids", () => {
    expect(ActionsSchema.safeParse({ kind: "actions", actions: ["shape.hexagon"] }).success).toBe(false);
    expect(ActionsSchema.safeParse({ kind: "actions", actions: ["colour.blue", "delete everything"] }).success).toBe(false);
    expect(
      ActionsSchema.safeParse({
        kind: "clarify",
        question: "?",
        options: [
          { label: "A", actions: ["zoom.in"] },
          { label: "B", actions: ["paint.room"] },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects clarify with 4 options (and with 1)", () => {
    const opt = (n: number) => ({ label: `Option ${n}`, actions: ["zoom.in"] });
    expect(ActionsSchema.safeParse({ kind: "clarify", question: "Which?", options: [opt(1), opt(2), opt(3), opt(4)] }).success).toBe(false);
    expect(ActionsSchema.safeParse({ kind: "clarify", question: "Which?", options: [opt(1)] }).success).toBe(false);
    expect(ActionsSchema.safeParse({ kind: "clarify", question: "Which?", options: [opt(1), opt(2), opt(3)] }).success).toBe(true);
  });

  it("rejects missing fields and empty actions", () => {
    expect(ActionsSchema.safeParse({ kind: "actions" }).success).toBe(false);
    expect(ActionsSchema.safeParse({ kind: "actions", actions: [] }).success).toBe(false);
    expect(ActionsSchema.safeParse({ kind: "clarify", options: [] }).success).toBe(false);
    expect(ActionsSchema.safeParse({ kind: "clarify", question: "Which?", options: [{ label: "A" }, { label: "B" }] }).success).toBe(false);
    expect(ActionsSchema.safeParse({ actions: ["undo"] }).success).toBe(false);
    expect(ActionsSchema.safeParse({ kind: "maybe" }).success).toBe(false);
    expect(ActionsSchema.safeParse(null).success).toBe(false);
  });
});

describe("route bodies", () => {
  const ctx = { lastActions: ["pen.toggle"], selected: null, canvas: { w: 1200, h: 800 } };
  it("CommandRequestSchema validates transcript + context", () => {
    expect(CommandRequestSchema.safeParse({ transcript: "make it a ball", context: ctx }).success).toBe(true);
    expect(CommandRequestSchema.safeParse({ transcript: "   ", context: ctx }).success).toBe(false);
    expect(CommandRequestSchema.safeParse({ transcript: "x", context: { ...ctx, lastActions: ["nope"] } }).success).toBe(false);
  });
  it("CommandResponseSchema requires mock + latencyMs and a valid reason", () => {
    expect(CommandResponseSchema.safeParse({ kind: "actions", actions: ["undo"], mock: false, latencyMs: 812 }).success).toBe(true);
    expect(CommandResponseSchema.safeParse({ kind: "actions", actions: ["undo"] }).success).toBe(false);
    expect(CommandResponseSchema.safeParse({ kind: "none", reason: "timeout", mock: false, latencyMs: 2500 }).success).toBe(true);
    expect(CommandResponseSchema.safeParse({ kind: "none", reason: "bored", mock: false, latencyMs: 1 }).success).toBe(false);
  });
  it("CleanupSchema rejects malformed Claude output", () => {
    expect(CleanupSchema.handwriting.safeParse({ text: "buy milk", confidence: 0.8, replaces: ["s_1"] }).success).toBe(true);
    expect(CleanupSchema.handwriting.safeParse({ text: "buy milk", confidence: 1.4, replaces: [] }).success).toBe(false);
    expect(CleanupSchema.handwriting.safeParse({ text: "buy milk" }).success).toBe(false);
    expect(CleanupSchema.cleanup.safeParse({ shapes: [{ kind: "hexagon", x: 1 }], replaces: [] }).success).toBe(false);
    expect(
      CleanupSchema.cleanup.safeParse({ shapes: [{ kind: "triangle", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }], replaces: [] }).success,
    ).toBe(false);
    expect(CleanupSchema.label.safeParse({ labels: [] }).success).toBe(false);
  });
  it("CleanupRequest / CleanupResponse round-trip the docs/API.md examples", () => {
    expect(
      CleanupRequestSchema.safeParse({
        mode: "handwriting",
        imagePng: "iVBORw0KGgo=",
        bbox: { x: 120, y: 80, w: 400, h: 160 },
        strokes: [{ id: "s_1", kind: "free", colour: "black", width: 6, points: [{ x: 130, y: 90 }] }],
      }).success,
    ).toBe(true);
    expect(
      CleanupResponseSchema.safeParse({
        mode: "handwriting",
        text: "buy milk",
        confidence: 0.82,
        replaces: ["s_1", "s_2", "s_3"],
        at: { x: 120, y: 80 },
        size: 32,
        mock: false,
        latencyMs: 3400,
      }).success,
    ).toBe(true);
    expect(CleanupResponseSchema.safeParse({ mode: "label", labels: [{ text: "Database", x: 410, y: 210, size: 22 }], mock: false, latencyMs: 5200 }).success).toBe(true);
  });
});
