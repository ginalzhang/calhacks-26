"use client";

import { useState } from "react";
import { runCommand } from "@/state/commands";

/**
 * The visible typed-command box: same grammar as voice (design rule 4). Keys type normally
 * here (the document key listener returns early for inputs); Esc returns focus to the canvas.
 */
export default function TypedCommand({ id = "typed-command", compact = false }: { id?: string; compact?: boolean }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={`typed${compact ? " typed-compact" : ""}`}
      onSubmit={async (e) => {
        e.preventDefault();
        const text = value.trim();
        if (!text || busy) return;
        setBusy(true);
        setValue("");
        try {
          await runCommand(text, "typed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={id}>Type a command</label>
      <div className="typed-row">
        <input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder="e.g. blue, undo, make it a circle"
          onChange={(e) => setValue(e.currentTarget.value)}
          aria-describedby={`${id}-hint`}
        />
        <button type="submit" className="tile tile-run" data-tile={`${id}.run`} disabled={busy}>
          <span className="tile-label">{busy ? "Working…" : "Run"}</span>
          <span className="tile-dwell" aria-hidden="true" />
        </button>
      </div>
      <p id={`${id}-hint`} className="typed-hint">
        Same words as voice. Press Enter to run, Esc to go back to the canvas.
      </p>
    </form>
  );
}
