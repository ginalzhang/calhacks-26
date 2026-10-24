"use client";

import { undoLabel } from "@/pipeline/document";
import { useStore } from "@/state/store";
import { dispatch } from "@/state/dispatch";
import { focusCanvas } from "@/lib/focus";
import { activationVia } from "./Tile";

/**
 * Status bar: role=status for routine updates, role=alert for tracking loss, and the
 * persistent "Undo: <last action>" affordance (design rule 7).
 */
export default function StatusBar() {
  const status = useStore((s) => s.status);
  const alert = useStore((s) => s.alert);
  const history = useStore((s) => s.history);
  const heard = useStore((s) => s.heard);
  const pen = useStore((s) => s.pen);
  const keys = useStore((s) => s.keys);
  const online = useStore((s) => s.online);
  const reminder = useStore((s) => s.reminder);
  const label = undoLabel(history);
  const showAlert = !!alert && status.id === alert.id;

  return (
    <div className="statusbar">
      <div className={`status-line${showAlert ? " status-alert" : ""}`}>
        <span className={`pen-badge pen-${pen.toLowerCase()}`}>{pen === "DRAWING" ? "Pen down" : "Pen up"}</span>
        {/* Routine updates (polite). */}
        <p role="status" aria-live="polite" className="status-text">
          {showAlert ? "" : status.text}
        </p>
        {/* Tracking loss (assertive). */}
        <p role="alert" className="status-text">
          {showAlert ? alert!.text : ""}
        </p>
      </div>
      <div className="status-chips">
        {reminder && <span className="chip chip-warn">{reminder}</span>}
        {heard && <span className="chip">Heard: {heard}</span>}
        {!online && <span className="chip chip-warn">Offline: voice and AI help are off; typed commands work</span>}
        {keys && (!keys.cartesia || !keys.anthropic) && (
          <span className="chip">
            {!keys.cartesia && !keys.anthropic
              ? "Keys missing: sample mode"
              : !keys.cartesia
                ? "Voice key missing"
                : "AI key missing"}
          </span>
        )}
        <button
          type="button"
          className="undo-affordance"
          data-tile="undo.affordance"
          disabled={!label}
          onClick={(e) => {
            const { via, keyboard } = activationVia(e);
            dispatch({ id: "undo", via });
            if (!keyboard) focusCanvas();
          }}
        >
          {label ? `Undo: ${label}` : "Nothing to undo"}
          <span className="tile-dwell" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
