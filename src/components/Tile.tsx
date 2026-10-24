"use client";

import type { ReactNode } from "react";
import { ACTION_BY_ID, type ActionId, type InputMethod } from "@/actions";
import { dispatch } from "@/state/dispatch";
import { runtime } from "@/state/runtime";
import { focusCanvas } from "@/lib/focus";

export const KEY_HINT: Partial<Record<ActionId, string>> = {
  "pen.toggle": "Space",
  undo: "⌫ / Z",
  redo: "Y",
  "mic.toggle": "M",
  recenter: "R",
  "pause.toggle": "P",
  accept: "Enter",
  cancel: "Esc",
  "confirm.no": "Esc",
  "choose.1": "1",
  "choose.2": "2",
  "choose.3": "3",
  "dictation.fix": "1",
};

/** Read (and clear) how the current click was produced: dwell, keyboard on a focused tile, or mouse. */
export function activationVia(e: React.MouseEvent): { via: InputMethod; keyboard: boolean } {
  if (runtime.pendingVia === "tile-dwell") return { via: "tile-dwell", keyboard: false };
  // detail === 0: activated by Enter/Space on a focused button (Tab navigation) → keep focus.
  return { via: "tile-click", keyboard: e.detail === 0 };
}

interface BaseProps {
  tileId: string;
  label: ReactNode;
  onActivate: (via: InputMethod, keyboard: boolean) => void;
  pressed?: boolean;
  destructive?: boolean;
  keyHint?: string;
  /** Keep focus on the tile after activation (dialogs, panels). */
  keepFocus?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  describedBy?: string;
  autoFocus?: boolean;
  swatch?: string;
}

/** A dwellable, clickable, keyboard-operable tile (real <button>, ≥ 64×64, visible label). */
export function TileButton(p: BaseProps) {
  return (
    <button
      type="button"
      className={`tile${p.destructive ? " tile-destructive" : ""}${p.className ? ` ${p.className}` : ""}`}
      data-tile={p.tileId}
      aria-pressed={p.pressed === undefined ? undefined : p.pressed}
      aria-label={p.ariaLabel}
      aria-describedby={p.describedBy}
      disabled={p.disabled}
      autoFocus={p.autoFocus}
      onClick={(e) => {
        const { via, keyboard } = activationVia(e);
        p.onActivate(via, keyboard);
        if (!keyboard && !p.keepFocus) focusCanvas();
      }}
    >
      {p.swatch && <span className="tile-swatch" style={{ background: p.swatch }} aria-hidden="true" />}
      <span className="tile-label">
        {p.pressed && <span aria-hidden="true">✓ </span>}
        {p.label}
      </span>
      {p.keyHint && (
        <span className="tile-key" aria-hidden="true">
          {p.keyHint}
        </span>
      )}
      <span className="tile-dwell" aria-hidden="true" />
    </button>
  );
}

/** A tile bound to an action id from the action table. */
export function ActionTile({
  id,
  pressed,
  label,
  keepFocus,
  swatch,
  className,
}: {
  id: ActionId;
  pressed?: boolean;
  label?: ReactNode;
  keepFocus?: boolean;
  swatch?: string;
  className?: string;
}) {
  const def = ACTION_BY_ID[id];
  return (
    <TileButton
      tileId={id}
      label={label ?? def.label}
      pressed={def.toggle || pressed !== undefined ? !!pressed : undefined}
      destructive={def.destructive}
      keyHint={KEY_HINT[id]}
      keepFocus={keepFocus}
      swatch={swatch}
      className={className}
      onActivate={(via) => dispatch({ id, via })}
    />
  );
}
