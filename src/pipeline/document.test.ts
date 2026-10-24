import { describe, expect, it } from "vitest";
import { applyCommands, applyUntracked, createHistory, currentPage, newId, newPage, nextPageName, redo, redoLabel, undo, undoLabel } from "./document";
import type { Stroke } from "./types";

const stroke = (id: string, x = 0): Stroke => ({ id, kind: "free", points: [{ x, y: 0 }, { x: x + 10, y: 0 }], colour: "black", width: 4, createdAt: 0 });

describe("document history", () => {
  it("add stroke → undo → redo with labels", () => {
    let h = createHistory();
    const pid = h.doc.currentPageId;
    h = applyCommands(h, "stroke", [{ type: "add-stroke", pageId: pid, stroke: stroke("a") }]);
    expect(currentPage(h.doc).strokes.map((s) => s.id)).toEqual(["a"]);
    expect(undoLabel(h)).toBe("stroke");
    h = undo(h);
    expect(currentPage(h.doc).strokes).toHaveLength(0);
    expect(undoLabel(h)).toBeNull();
    expect(redoLabel(h)).toBe("stroke");
    h = redo(h);
    expect(currentPage(h.doc).strokes.map((s) => s.id)).toEqual(["a"]);
    expect(undoLabel(h)).toBe("stroke");
  });

  it("undo of remove / replace restores exact order", () => {
    let h = createHistory();
    const pid = h.doc.currentPageId;
    for (const id of ["a", "b", "c"]) h = applyCommands(h, "stroke", [{ type: "add-stroke", pageId: pid, stroke: stroke(id) }]);
    h = applyCommands(h, "erase", [{ type: "remove-strokes", pageId: pid, ids: ["b"] }]);
    expect(currentPage(h.doc).strokes.map((s) => s.id)).toEqual(["a", "c"]);
    h = undo(h);
    expect(currentPage(h.doc).strokes.map((s) => s.id)).toEqual(["a", "b", "c"]);
    h = applyCommands(h, "make it a circle", [{ type: "replace-strokes", pageId: pid, removeIds: ["b"], add: [{ ...stroke("b2"), kind: "circle" }] }]);
    expect(currentPage(h.doc).strokes.map((s) => s.id)).toEqual(["a", "b2", "c"]);
    expect(undoLabel(h)).toBe("make it a circle");
    h = undo(h);
    expect(currentPage(h.doc).strokes.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("clear page, texts and styles undo exactly", () => {
    let h = createHistory();
    const pid = h.doc.currentPageId;
    h = applyCommands(h, "stroke", [{ type: "add-stroke", pageId: pid, stroke: stroke("a") }]);
    h = applyCommands(h, "note", [{ type: "add-text", pageId: pid, text: { id: "t", x: 1, y: 2, text: "hi", colour: "black", size: 24, createdAt: 0 } }]);
    h = applyCommands(h, "blue", [{ type: "style-stroke", pageId: pid, id: "a", colour: "blue" }]);
    expect(currentPage(h.doc).strokes[0].colour).toBe("blue");
    const before = h.doc;
    h = applyCommands(h, "clear page", [{ type: "clear-page", pageId: pid }]);
    expect(currentPage(h.doc).strokes).toHaveLength(0);
    expect(currentPage(h.doc).texts).toHaveLength(0);
    h = undo(h);
    expect(h.doc).toEqual(before);
    h = undo(h);
    expect(currentPage(h.doc).strokes[0].colour).toBe("black");
    h = undo(h);
    expect(currentPage(h.doc).texts).toHaveLength(0);
  });

  it("pages: add / delete undo restores list and current page; untracked switch is kept on stroke undo", () => {
    let h = createHistory();
    const p1 = h.doc.currentPageId;
    const p2 = newPage(nextPageName(h.doc));
    expect(p2.name).toBe("Notes 2");
    h = applyCommands(h, "add page", [{ type: "add-page", page: p2 }]);
    expect(h.doc.currentPageId).toBe(p2.id);
    h = applyCommands(h, "stroke", [{ type: "add-stroke", pageId: p2.id, stroke: stroke("a") }]);
    h = applyUntracked(h, [{ type: "switch-page", pageId: p1 }]);
    h = undo(h); // undo stroke on page 2, stay on page 1
    expect(h.doc.currentPageId).toBe(p1);
    expect(h.doc.pages[1].strokes).toHaveLength(0);
    h = applyCommands(h, "delete page", [{ type: "delete-page", pageId: p2.id }]);
    expect(h.doc.pages).toHaveLength(1);
    h = undo(h);
    expect(h.doc.pages.map((p) => p.id)).toEqual([p1, p2.id]);
    // deleting the last page leaves a fresh one
    const h0 = createHistory();
    const h1 = applyCommands(h0, "delete page", [{ type: "delete-page", pageId: h0.doc.currentPageId }]);
    expect(h1.doc.pages).toHaveLength(1);
    expect(h1.doc.currentPageId).not.toBe(h0.doc.currentPageId);
    expect(undo(h1).doc).toEqual(h0.doc);
  });

  it("no-op edits don't add history; new edits clear redo", () => {
    let h = createHistory();
    const pid = h.doc.currentPageId;
    expect(applyCommands(h, "x", [{ type: "remove-strokes", pageId: pid, ids: ["nope"] }])).toBe(h);
    h = applyCommands(h, "stroke", [{ type: "add-stroke", pageId: pid, stroke: stroke("a") }]);
    h = undo(h);
    h = applyCommands(h, "stroke", [{ type: "add-stroke", pageId: pid, stroke: stroke("b") }]);
    expect(h.future).toHaveLength(0);
    expect(undo(undo(h)).past).toHaveLength(0);
  });

  it("newId is unique and prefixed", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId("s")));
    expect(ids.size).toBe(1000);
    expect([...ids][0].startsWith("s-")).toBe(true);
  });
});
