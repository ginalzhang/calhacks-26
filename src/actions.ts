/**
 * The single action table. Tiles, key handling, the voice grammar and the
 * typed-command box are all generated from this list (design rule 4).
 *
 * Rules enforced by Vitest (src/actions.test.ts):
 *  - every action has a tile label, >= 1 voice phrase and a typed form;
 *  - an action has a `key` iff it is one of the nine core actions in the §3 key map;
 *  - no two phrases (across all actions) are within fuzzy distance of each other:
 *    Levenshtein <= 1 for any pair, <= 2 when both phrases are longer than 5 chars.
 *
 * Ownership: lead. Agent C may edit `phrases` to fix distance conflicts.
 * Agent B may append new actions. Nobody renames ids without telling the lead.
 */

export type ActionCategory =
  | "pen" // pen toggle, latch, dot, undo/redo
  | "colours"
  | "tools" // width, straight/free/eraser, shapes
  | "view" // zoom, move, background, guide lines
  | "pages" // pages + export
  | "voice" // mic, dictation, read-back, spoken replies
  | "ai" // Claude-backed actions
  | "setup" // calibration, profiles, presets, modes, pause, help, settings
  | "dialog" // confirm/cancel/accept/options; shown only in context
  | "demo"; // Demo panel

/** When the tile is visible. Keys/voice/typed still work everywhere unless noted. */
export type ActionContext =
  | "always"
  | "overlay" // AI ghost / dictation overlay is open
  | "dialog" // destructive confirm alertdialog is open
  | "clarify" // numbered options are on screen
  | "demo"; // only with ?demo=1

export interface ActionDef {
  id: ActionId;
  /** Visible tile text. */
  label: string;
  /** Voice phrases (lower-case, no punctuation). Also sent as Cartesia keyterms. */
  phrases: string[];
  /** Canonical typed form for the typed-command box (same grammar as voice). */
  typed: string;
  /** `KeyboardEvent.key` for the nine core §3 key-map actions, else null. */
  key: string | null;
  /** Extra keys for the same action (e.g. "z" for undo). Only on key-map actions. */
  altKeys?: string[];
  /** Destructive actions go through the §0 alertdialog. */
  destructive: boolean;
  category: ActionCategory;
  /** Toggle tiles expose aria-pressed. */
  toggle?: boolean;
  context: ActionContext;
  /** Build phase that delivers it (§10). */
  phase: 0 | 1 | 2 | 3;
}

export const COLOURS = ["black", "white", "red", "blue", "green", "yellow", "orange", "purple"] as const;
export type ColourName = (typeof COLOURS)[number];

/** CSS values for the eight ink colours. */
export const COLOUR_HEX: Record<ColourName, string> = {
  black: "#111111",
  white: "#ffffff",
  red: "#d7263d",
  blue: "#1d5fd1",
  green: "#178a3c",
  yellow: "#f2c200",
  orange: "#e86a10",
  purple: "#7b3fc4",
};

export const ACTION_IDS = [
  // pen
  "pen.toggle",
  "latch.toggle",
  "dot",
  "undo",
  "redo",
  // dialog / overlay
  "accept",
  "cancel",
  "confirm.yes",
  "confirm.no",
  "choose.1",
  "choose.2",
  "choose.3",
  // colours
  "colour.black",
  "colour.white",
  "colour.red",
  "colour.blue",
  "colour.green",
  "colour.yellow",
  "colour.orange",
  "colour.purple",
  // tools
  "width.thicker",
  "width.thinner",
  "tool.free",
  "tool.straight",
  "tool.eraser",
  "shape.circle",
  "shape.line",
  "shape.square",
  "shape.triangle",
  // view
  "zoom.in",
  "zoom.out",
  "zoom.fit",
  "move.up",
  "move.down",
  "move.left",
  "move.right",
  "bg.light",
  "bg.dark",
  "guides.toggle",
  // pages
  "page.new",
  "page.next",
  "page.prev",
  "page.delete",
  "page.clear",
  "export.png",
  "export.svg",
  "export.pdf",
  // voice
  "mic.toggle",
  "dictate",
  "dictation.fix",
  "dictation.edit",
  "readback",
  "speech.toggle",
  "sounds.toggle",
  // ai
  "ai.handwriting",
  "ai.cleanup",
  "ai.label",
  // setup
  "steadier",
  "looser",
  "recenter",
  "remeasure",
  "calibrate",
  "calibration.reset",
  "pause.toggle",
  "mode.head",
  "face.toggle",
  "profile.next",
  "preset.sore",
  "preset.reaching",
  "preset.rest",
  "preset.still",
  "help",
  "settings",
  // demo
  "demo.toggle",
  "tremor.toggle",
  "ghost.toggle",
  "judge.next",
  // desktop mode (§6a)
  "desktop.toggle",
  "desktop.area",
  "desktop.dwellclick",
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

const a = (def: Omit<ActionDef, "destructive" | "context"> & Partial<Pick<ActionDef, "destructive" | "context">>): ActionDef => ({
  destructive: false,
  context: "always",
  ...def,
});

export const ACTIONS: readonly ActionDef[] = [
  // ---- pen ----
  a({ id: "pen.toggle", label: "Pen", phrases: ["pen"], typed: "pen", key: " ", category: "pen", toggle: true, phase: 0 }),
  a({ id: "latch.toggle", label: "Latch", phrases: ["latch"], typed: "latch", key: null, category: "pen", toggle: true, phase: 0 }),
  a({ id: "dot", label: "Dot", phrases: ["dot"], typed: "dot", key: null, category: "pen", phase: 1 }),
  a({ id: "undo", label: "Undo", phrases: ["undo"], typed: "undo", key: "Backspace", altKeys: ["z", "Z"], category: "pen", phase: 0 }),
  a({ id: "redo", label: "Redo", phrases: ["redo that"], typed: "redo", key: "y", altKeys: ["Y"], category: "pen", phase: 1 }),

  // ---- dialog / overlay ----
  a({ id: "accept", label: "Accept", phrases: ["accept"], typed: "accept", key: "Enter", category: "dialog", context: "overlay", phase: 2 }),
  a({ id: "cancel", label: "Cancel", phrases: ["cancel"], typed: "cancel", key: "Escape", category: "dialog", phase: 1 }),
  a({ id: "confirm.yes", label: "✓ Confirm", phrases: ["yes"], typed: "yes", key: null, category: "dialog", context: "dialog", phase: 1 }),
  a({ id: "confirm.no", label: "✗ No", phrases: ["no"], typed: "no", key: null, category: "dialog", context: "dialog", phase: 1 }),
  a({ id: "choose.1", label: "Option 1", phrases: ["one"], typed: "1", key: "1", category: "dialog", context: "clarify", phase: 2 }),
  a({ id: "choose.2", label: "Option 2", phrases: ["two"], typed: "2", key: "2", category: "dialog", context: "clarify", phase: 2 }),
  a({ id: "choose.3", label: "Option 3", phrases: ["three"], typed: "3", key: "3", category: "dialog", context: "clarify", phase: 2 }),

  // ---- colours ----
  ...(["black", "white", "red", "blue", "green", "yellow", "orange", "purple"] as const).map((c) =>
    a({
      id: `colour.${c}` as ActionId,
      label: c[0].toUpperCase() + c.slice(1),
      phrases: [c, `make it ${c}`],
      typed: c,
      key: null,
      category: "colours",
      phase: 1,
    }),
  ),

  // ---- tools ----
  a({ id: "width.thicker", label: "Thicker", phrases: ["thick"], typed: "thick", key: null, category: "tools", phase: 1 }),
  a({ id: "width.thinner", label: "Thinner", phrases: ["thin"], typed: "thin", key: null, category: "tools", phase: 1 }),
  a({ id: "tool.free", label: "Freehand", phrases: ["free", "draw"], typed: "free", key: null, category: "tools", toggle: true, phase: 1 }),
  a({ id: "tool.straight", label: "Straight", phrases: ["straight"], typed: "straight", key: null, category: "tools", toggle: true, phase: 1 }),
  a({ id: "tool.eraser", label: "Eraser", phrases: ["eraser"], typed: "eraser", key: null, category: "tools", toggle: true, phase: 1 }),
  a({ id: "shape.circle", label: "Make circle", phrases: ["make it a circle", "circle"], typed: "make it a circle", key: null, category: "tools", phase: 2 }),
  a({ id: "shape.line", label: "Make line", phrases: ["make it a line", "line"], typed: "make it a line", key: null, category: "tools", phase: 2 }),
  a({ id: "shape.square", label: "Make square", phrases: ["make it a square", "square"], typed: "make it a square", key: null, category: "tools", phase: 2 }),
  a({ id: "shape.triangle", label: "Make triangle", phrases: ["make it a triangle", "triangle"], typed: "make it a triangle", key: null, category: "tools", phase: 2 }),

  // ---- view ----
  a({ id: "zoom.in", label: "Zoom in", phrases: ["zoom in"], typed: "zoom in", key: null, category: "view", phase: 3 }),
  a({ id: "zoom.out", label: "Zoom out", phrases: ["zoom out"], typed: "zoom out", key: null, category: "view", phase: 3 }),
  a({ id: "zoom.fit", label: "Fit page", phrases: ["fit page"], typed: "fit page", key: null, category: "view", phase: 3 }),
  a({ id: "move.up", label: "Move up", phrases: ["move up"], typed: "move up", key: null, category: "view", phase: 3 }),
  a({ id: "move.down", label: "Move down", phrases: ["move down"], typed: "move down", key: null, category: "view", phase: 3 }),
  a({ id: "move.left", label: "Move left", phrases: ["move left"], typed: "move left", key: null, category: "view", phase: 3 }),
  a({ id: "move.right", label: "Move right", phrases: ["move right"], typed: "move right", key: null, category: "view", phase: 3 }),
  a({ id: "bg.light", label: "Light page", phrases: ["light page"], typed: "light page", key: null, category: "view", phase: 1 }),
  a({ id: "bg.dark", label: "Dark page", phrases: ["dark page"], typed: "dark page", key: null, category: "view", phase: 1 }),
  a({ id: "guides.toggle", label: "Guide lines", phrases: ["guide lines"], typed: "guide lines", key: null, category: "view", toggle: true, phase: 1 }),

  // ---- pages ----
  a({ id: "page.new", label: "New page", phrases: ["add page"], typed: "add page", key: null, category: "pages", phase: 1 }),
  a({ id: "page.next", label: "Next page", phrases: ["next page"], typed: "next page", key: null, category: "pages", phase: 1 }),
  a({ id: "page.prev", label: "Previous page", phrases: ["previous page"], typed: "previous page", key: null, category: "pages", phase: 1 }),
  a({ id: "page.delete", label: "Delete page", phrases: ["delete page"], typed: "delete page", key: null, category: "pages", destructive: true, phase: 1 }),
  a({ id: "page.clear", label: "Clear page", phrases: ["clear page"], typed: "clear page", key: null, category: "pages", destructive: true, phase: 1 }),
  a({ id: "export.png", label: "Save PNG", phrases: ["export picture"], typed: "export picture", key: null, category: "pages", phase: 0 }),
  a({ id: "export.svg", label: "Save SVG", phrases: ["export drawing"], typed: "export drawing", key: null, category: "pages", phase: 3 }),
  a({ id: "export.pdf", label: "Print / PDF", phrases: ["print"], typed: "print", key: null, category: "pages", phase: 3 }),

  // ---- voice ----
  a({ id: "mic.toggle", label: "Mic", phrases: ["mic"], typed: "mic", key: "m", altKeys: ["M"], category: "voice", toggle: true, phase: 1 }),
  a({ id: "dictate", label: "Note", phrases: ["note", "type"], typed: "note", key: null, category: "voice", phase: 2 }),
  a({ id: "dictation.fix", label: "Fix", phrases: ["fix that"], typed: "fix that", key: null, category: "dialog", context: "overlay", phase: 2 }),
  a({ id: "dictation.edit", label: "Edit text", phrases: ["edit text"], typed: "edit text", key: null, category: "dialog", context: "overlay", phase: 2 }),
  a({ id: "readback", label: "Read it back", phrases: ["read it back"], typed: "read it back", key: null, category: "voice", phase: 2 }),
  a({ id: "speech.toggle", label: "Spoken replies", phrases: ["spoken replies"], typed: "spoken replies", key: null, category: "voice", toggle: true, phase: 2 }),
  a({ id: "sounds.toggle", label: "Click sounds", phrases: ["click sounds"], typed: "click sounds", key: null, category: "voice", toggle: true, phase: 1 }),

  // ---- ai ----
  a({ id: "ai.handwriting", label: "Writing → text", phrases: ["turn my writing into text"], typed: "turn my writing into text", key: null, category: "ai", phase: 2 }),
  a({ id: "ai.cleanup", label: "Clean up", phrases: ["clean this up"], typed: "clean this up", key: null, category: "ai", phase: 3 }),
  a({ id: "ai.label", label: "Label it", phrases: ["label this"], typed: "label this", key: null, category: "ai", phase: 3 }),

  // ---- setup ----
  a({ id: "steadier", label: "Steadier", phrases: ["steadier"], typed: "steadier", key: null, category: "setup", phase: 1 }),
  a({ id: "looser", label: "Looser", phrases: ["looser"], typed: "looser", key: null, category: "setup", phase: 1 }),
  a({ id: "recenter", label: "Recenter", phrases: ["recenter"], typed: "recenter", key: "r", altKeys: ["R"], category: "setup", phase: 1 }),
  a({ id: "remeasure", label: "Re-measure", phrases: ["measure again"], typed: "measure again", key: null, category: "setup", phase: 1 }),
  a({ id: "calibrate", label: "Calibrate", phrases: ["calibrate"], typed: "calibrate", key: null, category: "setup", phase: 1 }),
  a({ id: "calibration.reset", label: "Reset setup", phrases: ["reset setup"], typed: "reset setup", key: null, category: "setup", destructive: true, phase: 1 }),
  a({ id: "pause.toggle", label: "Pause tracking", phrases: ["pause"], typed: "pause", key: "p", altKeys: ["P"], category: "setup", toggle: true, phase: 1 }),
  a({ id: "mode.head", label: "Head mode", phrases: ["head mode"], typed: "head mode", key: null, category: "setup", toggle: true, phase: 3 }),
  a({ id: "face.toggle", label: "Face tap", phrases: ["face tap"], typed: "face tap", key: null, category: "setup", toggle: true, phase: 3 }),
  a({ id: "profile.next", label: "Switch profile", phrases: ["switch profile"], typed: "switch profile", key: null, category: "setup", phase: 3 }),
  a({ id: "preset.sore", label: "Steady but sore", phrases: ["steady but sore"], typed: "steady but sore", key: null, category: "setup", phase: 3 }),
  a({ id: "preset.reaching", label: "Shakes when reaching", phrases: ["shakes when reaching"], typed: "shakes when reaching", key: null, category: "setup", phase: 3 }),
  a({ id: "preset.rest", label: "Shakes at rest", phrases: ["shakes at rest"], typed: "shakes at rest", key: null, category: "setup", phase: 3 }),
  a({ id: "preset.still", label: "Hard to hold still", phrases: ["hard to hold still"], typed: "hard to hold still", key: null, category: "setup", phase: 3 }),
  a({ id: "help", label: "Help", phrases: ["help"], typed: "help", key: null, category: "setup", phase: 1 }),
  a({ id: "settings", label: "Settings", phrases: ["settings"], typed: "settings", key: null, category: "setup", phase: 1 }),

  // ---- demo ----
  a({ id: "demo.toggle", label: "Demo", phrases: ["demo panel"], typed: "demo panel", key: null, category: "demo", toggle: true, phase: 1 }),
  a({ id: "tremor.toggle", label: "Simulate tremor", phrases: ["simulate tremor"], typed: "simulate tremor", key: null, category: "demo", toggle: true, phase: 1 }),
  a({ id: "ghost.toggle", label: "Ghost view", phrases: ["ghost view"], typed: "ghost view", key: null, category: "demo", toggle: true, phase: 1 }),
  a({ id: "judge.next", label: "Next judge", phrases: ["next judge"], typed: "next judge", key: null, category: "demo", destructive: true, context: "demo", phase: 1 }),

  // ---- desktop mode (§6a; owned by agent E's src/desktop/**) ----
  a({ id: "desktop.toggle", label: "Desktop mode", phrases: ["desktop mode"], typed: "desktop mode", key: null, category: "setup", toggle: true, phase: 2 }),
  a({ id: "desktop.area", label: "Set drawing area", phrases: ["set drawing area"], typed: "set drawing area", key: null, category: "setup", phase: 2 }),
  a({ id: "desktop.dwellclick", label: "Dwell click", phrases: ["dwell click"], typed: "dwell click", key: null, category: "setup", toggle: true, phase: 2 }),
];

export const ACTION_BY_ID: Record<ActionId, ActionDef> = Object.fromEntries(ACTIONS.map((d) => [d.id, d])) as Record<
  ActionId,
  ActionDef
>;

/** The nine core §3 key-map actions (the only actions with a `key`). */
export const KEY_MAP_ACTIONS: readonly ActionId[] = [
  "pen.toggle", // Space
  "accept", // Enter (non-destructive overlays; Enter on a focused button is native)
  "cancel", // Esc
  "undo", // Backspace / Z
  "redo", // Y
  "mic.toggle", // M
  "recenter", // R
  "pause.toggle", // P
  "choose.1", // 1-3 = choose option (counted as one key-map entry)
  "choose.2",
  "choose.3",
];

/** Where an invocation came from (for metrics, the Undo label and dwell->canvas.focus()). */
export type InputMethod = "tile-click" | "tile-dwell" | "key" | "voice" | "typed" | "face" | "claude";

export interface ActionInvocation {
  id: ActionId;
  via: InputMethod;
  /** Free text for actions that carry it (dictation result, etc.). */
  text?: string;
}
