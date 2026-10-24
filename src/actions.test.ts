import { describe, expect, it } from "vitest";
import { ACTION_BY_ID, ACTION_IDS, ACTIONS, KEY_MAP_ACTIONS } from "./actions";
import { levenshtein } from "./pipeline/grammar";

describe("action table", () => {
  it("covers every ActionId exactly once and ids are unique", () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...ACTION_IDS].sort());
    for (const id of ACTION_IDS) expect(ACTION_BY_ID[id]?.id).toBe(id);
  });

  it("every action has a tile label, >= 1 phrase and a typed form", () => {
    for (const a of ACTIONS) {
      expect(a.label.trim().length, a.id).toBeGreaterThan(0);
      expect(a.phrases.length, a.id).toBeGreaterThanOrEqual(1);
      expect(a.typed.trim().length, a.id).toBeGreaterThan(0);
      for (const p of a.phrases) {
        // Phrases are lower-case, no punctuation, single-spaced (they are sent as Cartesia keyterms).
        expect(p, a.id).toMatch(/^[a-z0-9]+( [a-z0-9]+)*$/);
      }
    }
  });

  it("has a key iff the action is in the §3 key map", () => {
    const keyMap = new Set(KEY_MAP_ACTIONS);
    for (const a of ACTIONS) {
      if (keyMap.has(a.id)) expect(a.key, a.id).not.toBeNull();
      else {
        expect(a.key, a.id).toBeNull();
        expect(a.altKeys ?? [], a.id).toEqual([]);
      }
    }
    for (const id of KEY_MAP_ACTIONS) expect(ACTION_BY_ID[id], id).toBeDefined();
  });

  it("keys are unique across actions", () => {
    const keys = ACTIONS.flatMap((a) => (a.key ? [a.key, ...(a.altKeys ?? [])] : []));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("phrases are unique across the whole table", () => {
    const all = ACTIONS.flatMap((a) => a.phrases);
    expect(new Set(all).size).toBe(all.length);
  });

  it("no two phrases are within fuzzy distance (<= 1 any pair, <= 2 when both > 5 chars)", () => {
    const ps = ACTIONS.flatMap((a) => a.phrases.map((p) => ({ p, id: a.id })));
    const conflicts: string[] = [];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const d = levenshtein(a.p, b.p);
        if (d <= 1 || (d <= 2 && a.p.length > 5 && b.p.length > 5)) {
          conflicts.push(`${a.id}:"${a.p}" ~ ${b.id}:"${b.p}" (d=${d})`);
        }
      }
    }
    expect(conflicts).toEqual([]);
  });
});
