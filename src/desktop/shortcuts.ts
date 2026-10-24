/**
 * Desktop mode (§6a): per-app shortcut map. App-facing actions become keystrokes sent to the
 * focused app through the helper. Pen, pause, Latch, steadier/looser and mic stay in Steady;
 * canvas-only features are unavailable in Desktop mode.
 */
import type { ActionId } from "@/actions";

export type DesktopAppId = "krita";

/** Combos use the helper grammar (docs/API.md): `+`-joined modifiers cmd|ctrl|alt|shift, then one key. */
export const SHORTCUTS: Record<string, Partial<Record<ActionId, string>>> = {
  // Krita on macOS (default shortcuts).
  krita: {
    undo: "cmd+z",
    redo: "cmd+shift+z",
    "tool.free": "b", // Freehand brush tool
    "tool.eraser": "e", // toggles eraser mode on the current brush
    "width.thicker": "]",
    "width.thinner": "[",
    "export.png": "cmd+s", // Save the Krita document
  },
};

export const DEFAULT_APP: DesktopAppId = "krita";

export const APP_LABELS: Record<DesktopAppId, string> = { krita: "Krita" };

/** Tile labels for the Krita tool tiles in the Desktop panel. */
export const APP_TILE_LABELS: Partial<Record<ActionId, string>> = {
  "tool.free": "Brush",
  "tool.eraser": "Eraser",
  "width.thicker": "Bigger",
  "width.thinner": "Smaller",
  "export.png": "Save",
};

/** Tool tiles shown in the panel, in order. */
export const APP_TOOL_TILES: readonly ActionId[] = ["tool.free", "tool.eraser", "width.thicker", "width.thinner", "export.png"];

/** Actions that only make sense on Steady's own canvas: "Not available in Desktop mode". */
const CANVAS_ONLY_PREFIXES = ["shape.", "ai.", "colour.", "zoom.", "move.", "bg.", "page.", "dictat"];
const CANVAS_ONLY: ReadonlySet<ActionId> = new Set<ActionId>([
  "ghost.toggle",
  "readback",
  "tool.straight",
  "guides.toggle",
  "export.svg",
  "export.pdf",
]);

export type DesktopRoute =
  /** Send the mapped keystroke to the app (sendActionKeys returns true). */
  | "keys"
  /** "dot": one click at the pointer inside the drawing area. */
  | "click"
  /** Runs inside Steady as usual (pen, pause, latch, steadier/looser, mic, dialogs, setup…). */
  | "steady"
  /** Canvas-only feature: unavailable in Desktop mode. */
  | "canvas-only";

export function shortcutFor(id: ActionId, app: string = DEFAULT_APP): string | null {
  return SHORTCUTS[app]?.[id] ?? null;
}

export function desktopRoute(id: ActionId, app: string = DEFAULT_APP): DesktopRoute {
  if (shortcutFor(id, app)) return "keys";
  if (id === "dot") return "click";
  if (CANVAS_ONLY.has(id) || CANVAS_ONLY_PREFIXES.some((p) => id.startsWith(p))) return "canvas-only";
  return "steady";
}

const MODS = new Set(["cmd", "ctrl", "alt", "shift"]);
const NAMED = new Set(["esc", "enter", "tab", "delete", ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`)]);

/** Same grammar the helper accepts (helper/steady_helper.py parse_combo). */
export function isValidCombo(combo: string): boolean {
  if (!combo || combo.length > 40) return false;
  const parts = combo.toLowerCase().split("+");
  if (parts.some((p) => p === "")) return false;
  const key = parts.pop()!;
  if (new Set(parts).size !== parts.length || !parts.every((m) => MODS.has(m))) return false;
  return NAMED.has(key) || /^[a-z0-9[\]]$/.test(key);
}

/** "cmd+shift+z" → "⌘⇧Z" (for status text). */
export function prettyCombo(combo: string): string {
  const sym: Record<string, string> = { cmd: "⌘", shift: "⇧", alt: "⌥", ctrl: "⌃" };
  return combo
    .split("+")
    .map((p) => sym[p] ?? (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join("");
}

/** Hotkeys the helper accepts (function keys only; never Space, letters or modifiers). */
export function isValidHotkey(k: string): boolean {
  return /^f([1-9]|1[0-9]|20)$/.test(k.toLowerCase());
}
