"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { dispatch } from "@/state/dispatch";
import { runCommand } from "@/state/commands";
import { useStore } from "@/state/store";
import { TileButton } from "./Tile";

/**
 * Destructive confirm (§0 rule 6): modal role=alertdialog, labelled + described, focus moves
 * to Cancel on open and is restored on close, background inert (set by SteadyApp).
 * Confirm needs the ✓ tile (dwell/click), typed "yes", exact voice "yes", or Tab to it + Enter.
 * Esc, "no", ✗, or Enter on the focused Cancel cancels.
 */
export default function ConfirmDialog() {
  const dialog = useStore((s) => s.dialog);
  const micOpen = useStore((s) => s.mic.open);
  const restoreRef = useRef<Element | null>(null);

  // Layout effect: focus lands on Cancel in the same frame the dialog appears.
  useLayoutEffect(() => {
    if (dialog) {
      if (!restoreRef.current) restoreRef.current = document.activeElement;
      document.querySelector<HTMLButtonElement>("[role=alertdialog] [data-tile='confirm.no']")?.focus();
    } else if (restoreRef.current) {
      const el = restoreRef.current as HTMLElement;
      restoreRef.current = null;
      // The app root's inert attribute is removed in this same commit.
      requestAnimationFrame(() => {
        if (el && document.contains(el) && !el.closest("[inert]") && el !== document.body) el.focus({ preventScroll: true });
        else document.getElementById("steady-canvas")?.focus({ preventScroll: true });
      });
    }
  }, [dialog]);

  if (!dialog) return null;
  return (
    <div className="modal-backdrop">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc" className="modal">
        <h2 id="confirm-title">{dialog.title}</h2>
        <p id="confirm-desc">{dialog.description}</p>
        <div className="modal-actions">
          <TileButton
            tileId="confirm.no"
            label="✗ No, cancel"
            keyHint="Esc"
            keepFocus
            onActivate={(via) => dispatch({ id: "confirm.no", via })}
          />
          <TileButton
            tileId="confirm.yes"
            label="✓ Confirm"
            destructive
            keepFocus
            onActivate={(via) => dispatch({ id: "confirm.yes", via })}
          />
          <TileButton
            tileId="confirm.mic"
            label="Mic"
            pressed={micOpen}
            keyHint="say “yes” or “no”"
            keepFocus
            onActivate={(via) => dispatch({ id: "mic.toggle", via })}
          />
        </div>
        <TypedYes />
      </div>
    </div>
  );
}

/** Typed "yes"/"no" (exact match while the dialog is open). Fresh state per dialog. */
function TypedYes() {
  const [typed, setTyped] = useState("");
  return (
    <form
      className="typed typed-compact"
      onSubmit={(e) => {
        e.preventDefault();
        const t = typed.trim();
        setTyped("");
        if (t) void runCommand(t, "typed");
      }}
    >
      <label htmlFor="confirm-typed">Or type yes or no</label>
      <div className="typed-row">
        <input id="confirm-typed" type="text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.currentTarget.value)} />
        <button type="submit" className="tile tile-run" data-tile="confirm.typed.run">
          <span className="tile-label">Run</span>
          <span className="tile-dwell" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
