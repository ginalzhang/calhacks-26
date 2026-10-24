"use client";

/**
 * Tiles generated from ACTIONS (design rule 4). A wrapping grid that is never a scroll
 * container: core tiles stay on the main grid, everything else is grouped behind category
 * tiles that open a sub-panel (Colours, Tools, View, Pages, Voice, AI, Setup).
 */
import { ACTIONS, COLOUR_HEX, type ActionCategory, type ActionId } from "@/actions";
import { useStore, setState, type AppState } from "@/state/store";
import { getParams } from "@/lib/params";
import { ActionTile, TileButton } from "./Tile";
import { GainSlider } from "./Sliders";

/** Main grid: the actions people use every few seconds. */
const CORE: ActionId[] = ["pen.toggle", "latch.toggle", "undo", "redo", "mic.toggle", "dictate", "dot", "export.png"];

const CATEGORIES: { cat: ActionCategory; label: string }[] = [
  { cat: "colours", label: "Colours" },
  { cat: "tools", label: "Tools" },
  { cat: "view", label: "View" },
  { cat: "pages", label: "Pages" },
  { cat: "voice", label: "Voice" },
  { cat: "ai", label: "AI help" },
  { cat: "setup", label: "Setup" },
];

/** Reachable by voice/typed (with a clear status message) but no tile until the feature exists. */
export const HIDDEN_TILES = new Set<ActionId>([
  "zoom.in",
  "zoom.out",
  "zoom.fit",
  "move.up",
  "move.down",
  "move.left",
  "move.right",
  "mode.head",
  "face.toggle",
  // P2b Desktop mode: area + dwell click live in E's DesktopPanel; the toggle is under Setup.
  "desktop.area",
  "desktop.dwellclick",
]);

export function pressedFor(id: ActionId, s: AppState): boolean | undefined {
  switch (id) {
    case "pen.toggle":
      return s.pen === "DRAWING";
    case "latch.toggle":
      return s.settings.latch;
    case "mic.toggle":
      return s.mic.open;
    case "tool.free":
      return s.tool === "free";
    case "tool.straight":
      return s.tool === "straight";
    case "tool.eraser":
      return s.tool === "eraser";
    case "guides.toggle": {
      const p = s.history.doc.pages.find((x) => x.id === s.history.doc.currentPageId);
      return !!p?.guides;
    }
    case "speech.toggle":
      return s.speech;
    case "sounds.toggle":
      return s.sounds;
    case "pause.toggle":
      return s.paused;
    case "demo.toggle":
      return s.demoOpen;
    case "tremor.toggle":
      return s.tremor;
    case "ghost.toggle":
      return s.ghost;
    case "desktop.toggle":
      return s.desktopOn;
    default:
      if (id.startsWith("colour.")) return s.colour === id.slice(7);
      return undefined;
  }
}

function visible(id: ActionId, demo: boolean) {
  const def = ACTIONS.find((a) => a.id === id)!;
  if (HIDDEN_TILES.has(id)) return false;
  if (def.context === "always") return true;
  if (def.context === "demo") return demo;
  return false;
}

let focusBackTile = false;

export default function Toolbar() {
  const s = useStore((st) => st);
  const sub = s.subpanel;
  const demo = getParams().demo;

  if (sub) {
    const label = CATEGORIES.find((c) => c.cat === sub)?.label ?? sub;
    const ids = ACTIONS.filter((a) => a.category === sub && visible(a.id, demo)).map((a) => a.id);
    return (
      <nav className="toolbar" aria-label={`${label} tools`}>
        <h2 className="toolbar-title">{label}</h2>
        <div className="tile-grid">
          <TileButton
            tileId="nav.back"
            label="← Back"
            keyHint="Esc"
            autoFocus={focusBackTile}
            onActivate={() => {
              focusBackTile = false;
              setState({ subpanel: null });
            }}
          />
          {ids.map((id) => (
            <ActionTile
              key={id}
              id={id}
              pressed={pressedFor(id, s)}
              swatch={id.startsWith("colour.") ? COLOUR_HEX[id.slice(7) as keyof typeof COLOUR_HEX] : undefined}
            />
          ))}
        </div>
        {sub === "setup" && <GainSlider />}
      </nav>
    );
  }

  return (
    <nav className="toolbar" aria-label="Tools">
      <h2 className="sr-only">Tools</h2>
      <div className="tile-grid">
        {CORE.map((id) => (
          <ActionTile key={id} id={id} pressed={pressedFor(id, s)} />
        ))}
        {CATEGORIES.map((c) => (
          <TileButton
            key={c.cat}
            tileId={`cat.${c.cat}`}
            className="tile-category"
            label={
              c.cat === "colours" ? (
                <>
                  Colours
                  <span className="sr-only">, current {s.colour}</span>
                </>
              ) : (
                c.label
              )
            }
            swatch={c.cat === "colours" ? COLOUR_HEX[s.colour] : undefined}
            onActivate={(_via, keyboard) => {
              focusBackTile = keyboard;
              setState({ subpanel: c.cat });
            }}
          />
        ))}
        <ActionTile id="demo.toggle" pressed={s.demoOpen} />
        <ActionTile id="help" />
      </div>
    </nav>
  );
}
