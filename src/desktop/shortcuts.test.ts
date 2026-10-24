import { describe, expect, it } from "vitest";
import { ACTION_IDS } from "@/actions";
import { APP_TOOL_TILES, SHORTCUTS, desktopRoute, isValidCombo, isValidHotkey, prettyCombo, shortcutFor } from "./shortcuts";

describe("Krita macOS shortcut map (§6a)", () => {
  it("matches the spec", () => {
    expect(SHORTCUTS.krita).toEqual({
      undo: "cmd+z",
      redo: "cmd+shift+z",
      "tool.free": "b",
      "tool.eraser": "e",
      "width.thicker": "]",
      "width.thinner": "[",
      "export.png": "cmd+s",
    });
  });

  it("every combo is valid in the helper grammar and every id exists", () => {
    for (const [app, map] of Object.entries(SHORTCUTS)) {
      for (const [id, combo] of Object.entries(map)) {
        expect(ACTION_IDS as readonly string[], `${app}:${id}`).toContain(id);
        expect(isValidCombo(combo!), combo).toBe(true);
      }
    }
    for (const id of APP_TOOL_TILES) expect(shortcutFor(id)).not.toBeNull();
  });

  it("pen, pause, latch, steadier/looser and mic stay in Steady; canvas-only features are flagged", () => {
    for (const id of ["pen.toggle", "pause.toggle", "latch.toggle", "steadier", "looser", "mic.toggle", "desktop.toggle", "confirm.yes"] as const) {
      expect(desktopRoute(id)).toBe("steady");
    }
    for (const id of ["shape.circle", "ai.handwriting", "ai.cleanup", "dictate", "ghost.toggle", "colour.red", "zoom.in", "page.new"] as const) {
      expect(desktopRoute(id)).toBe("canvas-only");
    }
    expect(desktopRoute("undo")).toBe("keys");
    expect(desktopRoute("dot")).toBe("click");
  });

  it("combo grammar mirrors helper/steady_helper.py parse_combo", () => {
    for (const ok of ["cmd+z", "cmd+shift+z", "]", "[", "f12", "ctrl+alt+delete", "esc", "tab", "9"]) expect(isValidCombo(ok), ok).toBe(true);
    for (const bad of ["", "cmd+", "+", "space", "cmd+space", "win+z", "cmd+cmd+z", "f13", "cmd+-", "a".repeat(41)]) {
      expect(isValidCombo(bad), bad).toBe(false);
    }
  });

  it("hotkeys are function keys only", () => {
    expect(isValidHotkey("f8")).toBe(true);
    expect(isValidHotkey("F20")).toBe(true);
    for (const bad of ["space", "a", "cmd", "f0", "f21", "shift"]) expect(isValidHotkey(bad), bad).toBe(false);
  });

  it("pretty-prints combos", () => {
    expect(prettyCombo("cmd+shift+z")).toBe("⌘⇧Z");
    expect(prettyCombo("]")).toBe("]");
    expect(prettyCombo("cmd+s")).toBe("⌘S");
  });
});
