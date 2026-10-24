import { describe, expect, it } from "vitest";
import { ACTIONS } from "@/actions";
import { levenshtein, matchCommand, normalize } from "./grammar";

describe("normalize", () => {
  it("lower-cases, strips punctuation and collapses spaces", () => {
    expect(normalize("  Make it   BLUE!! ")).toBe("make it blue");
    expect(normalize("Re-center.")).toBe("re center");
    expect(normalize("don’t")).toBe("dont");
  });
  it("strips filler words and politeness wrappers", () => {
    expect(normalize("um, undo please")).toBe("undo");
    expect(normalize("Can you please make it red, thanks")).toBe("make it red");
    expect(normalize("ok now zoom in")).toBe("zoom in");
    expect(normalize("please")).toBe("");
  });
  it("leaves every action phrase and typed form unchanged", () => {
    for (const a of ACTIONS) {
      for (const p of [...a.phrases, a.typed]) expect(normalize(p), `${a.id}: ${p}`).toBe(p);
    }
  });
});

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("pen", "pan")).toBe(1);
    expect(levenshtein("redo that", "redo hat")).toBe(1);
  });
});

describe("matchCommand", () => {
  it("matches every phrase and typed form exactly", () => {
    for (const a of ACTIONS) {
      for (const p of [...a.phrases, a.typed]) {
        const m = matchCommand(p);
        expect(m.kind, p).toBe("exact");
        if (m.kind === "exact") expect(m.id, p).toBe(a.id);
      }
    }
  });

  it("exact wins over fuzzy", () => {
    // "thin" is exact for width.thinner even though it is 1 edit from "thick"'s neighbours.
    const m = matchCommand("Thin.");
    expect(m).toMatchObject({ kind: "exact", id: "width.thinner" });
  });

  it("fuzzy: <= 1 edit for short phrases", () => {
    expect(matchCommand("undoo")).toMatchObject({ kind: "fuzzy", id: "undo", distance: 1 });
    expect(matchCommand("latc")).toMatchObject({ kind: "fuzzy", id: "latch.toggle", distance: 1 });
    // 2 edits from a <= 5-char phrase is not enough.
    expect(matchCommand("lach").kind).not.toBe("exact");
    expect(matchCommand("zzpen").kind).toBe("none");
  });

  it("fuzzy: <= 2 edits for longer phrases", () => {
    expect(matchCommand("zoom inn")).toMatchObject({ kind: "fuzzy", id: "zoom.in", distance: 1 });
    expect(matchCommand("make it a circel")).toMatchObject({ kind: "fuzzy", id: "shape.circle", distance: 2 });
    expect(matchCommand("calibrat")).toMatchObject({ kind: "fuzzy", id: "calibrate" });
    expect(matchCommand("steddyer")).toMatchObject({ kind: "fuzzy", id: "steadier", distance: 2 });
    expect(matchCommand("stoddyar").kind).toBe("none"); // 3 edits from "steadier"
  });

  it("a fuzzy tie between two different actions is no match", () => {
    const m = matchCommand("rad", {
      extra: [{ phrase: "rat", id: "readback" }],
    });
    // "rad" is 1 from "red" (colour.red) and 1 from "rat" (readback) -> tie.
    expect(m.kind).toBe("none");
    if (m.kind === "none") expect(m.nearest.map((n) => n.id).sort()).toEqual(["colour.red", "readback"]);
    // Real table tie: "ped" is 1 edit from "pen" (pen.toggle) and 1 from "red" (colour.red).
    const t = matchCommand("ped");
    expect(t.kind).toBe("none");
    if (t.kind === "none") expect(t.nearest.map((n) => n.id).sort()).toEqual(["colour.red", "pen.toggle"]);
    // A clean single-action neighbour is a fuzzy match.
    expect(matchCommand("ret")).toMatchObject({ kind: "fuzzy", id: "colour.red" });
  });

  it("a tie between two phrases of the same action is still a match", () => {
    const m = matchCommand("rad", { extra: [{ phrase: "rat", id: "colour.red" }] });
    expect(m).toMatchObject({ kind: "fuzzy", id: "colour.red" });
  });

  it("exactOnly disables fuzzy matching (dialogs)", () => {
    expect(matchCommand("yes", { exactOnly: true })).toMatchObject({ kind: "exact", id: "confirm.yes" });
    expect(matchCommand("yess", { exactOnly: true }).kind).toBe("none");
    expect(matchCommand("yess")).toMatchObject({ kind: "fuzzy", id: "confirm.yes" });
  });

  it("none returns the two nearest distinct actions", () => {
    const m = matchCommand("paint the room purple and green");
    expect(m.kind).toBe("none");
    if (m.kind === "none") {
      expect(m.nearest).toHaveLength(2);
      expect(new Set(m.nearest.map((n) => n.id)).size).toBe(2);
      expect(m.nearest[0].distance).toBeLessThanOrEqual(m.nearest[1].distance);
    }
    expect(matchCommand("")).toEqual({ kind: "none", nearest: [] });
    expect(matchCommand("um please")).toEqual({ kind: "none", nearest: [] });
  });

  it("supports extra runtime phrases with an arg (profile names)", () => {
    const extra = [{ phrase: "Shaky day", id: "profile.next" as const, arg: "p_shaky" }];
    expect(matchCommand("shaky day", { extra })).toMatchObject({ kind: "exact", id: "profile.next", arg: "p_shaky" });
    expect(matchCommand("shaky dey", { extra })).toMatchObject({ kind: "fuzzy", id: "profile.next", arg: "p_shaky" });
  });

  it("handles filler around real commands", () => {
    expect(matchCommand("Um, make it blue please.")).toMatchObject({ kind: "exact", id: "colour.blue" });
    expect(matchCommand("could you zoom out")).toMatchObject({ kind: "exact", id: "zoom.out" });
  });
});
