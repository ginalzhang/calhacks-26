import { describe, expect, it } from "vitest";
import { ActionsSchema, CleanupSchema, type CleanupRequest } from "../apiTypes";
import { guessShape, mockCleanupShapes, mockCommand, mockHandwriting, mockLabels } from "./mocks";

describe("mockCommand", () => {
  it("returns realistic, schema-valid results", () => {
    const cases: [string, unknown][] = [
      ["make the last thing look like a ball", { kind: "actions", actions: ["shape.circle"] }],
      ["paint it the colour of the sky", { kind: "actions", actions: ["colour.blue"] }],
      ["turn it into a red box", { kind: "actions", actions: ["shape.square", "colour.red"] }],
      ["oops go back", { kind: "actions", actions: ["undo"] }],
      ["what's the weather like", { kind: "none" }],
    ];
    for (const [t, want] of cases) {
      const r = mockCommand(t);
      expect(r, t).toEqual(want);
      expect(ActionsSchema.safeParse(r).success, t).toBe(true);
    }
    const c = mockCommand("make it bigger");
    expect(c.kind).toBe("clarify");
    expect(ActionsSchema.safeParse(c).success).toBe(true);
    const two = mockCommand("blue or green");
    expect(two.kind).toBe("clarify");
    expect(ActionsSchema.safeParse(two).success).toBe(true);
  });
});

const circle = Array.from({ length: 40 }, (_, i) => ({ x: 300 + 50 * Math.cos((i / 39) * 2 * Math.PI), y: 200 + 50 * Math.sin((i / 39) * 2 * Math.PI) }));
const square = [
  ...Array.from({ length: 10 }, (_, i) => ({ x: 100 + i * 10, y: 100 })),
  ...Array.from({ length: 10 }, (_, i) => ({ x: 200, y: 100 + i * 10 })),
  ...Array.from({ length: 10 }, (_, i) => ({ x: 200 - i * 10, y: 200 })),
  ...Array.from({ length: 11 }, (_, i) => ({ x: 100, y: 200 - i * 10 })),
];
const line = Array.from({ length: 20 }, (_, i) => ({ x: 10 + i * 10, y: 50 + (i % 2) }));
const tri = [
  { x: 150, y: 100 },
  { x: 200, y: 200 },
  { x: 100, y: 200 },
  { x: 149, y: 102 },
];

describe("guessShape", () => {
  it("classifies circle, rect, line, triangle", () => {
    expect(guessShape(circle)?.kind).toBe("circle");
    expect(guessShape(square)?.kind).toBe("rect");
    expect(guessShape(line)?.kind).toBe("line");
    expect(guessShape(tri)?.kind).toBe("triangle");
  });
});

describe("mock cleanup", () => {
  const req: CleanupRequest = {
    mode: "cleanup",
    imagePng: "",
    bbox: { x: 100, y: 100, w: 300, h: 160 },
    strokes: [
      { id: "s_1", kind: "free", colour: "black", width: 6, points: circle },
      { id: "s_2", kind: "free", colour: "black", width: 6, points: square },
    ],
  };
  it("produces schema-valid output per mode", () => {
    expect(CleanupSchema.handwriting.safeParse(mockHandwriting(req)).success).toBe(true);
    const c = mockCleanupShapes(req);
    expect(CleanupSchema.cleanup.safeParse(c).success).toBe(true);
    expect(c.replaces).toEqual(["s_1", "s_2"]);
    expect(CleanupSchema.label.safeParse(mockLabels(req)).success).toBe(true);
  });
});
