"use client";

import { useState } from "react";
import { ACTION_BY_ID } from "@/actions";
import { dispatch } from "@/state/dispatch";
import { finishEditing } from "@/state/dictation";
import { useStore } from "@/state/store";
import { ActionTile, TileButton } from "./Tile";

/**
 * Context tiles shown in the side column (a rest zone, so dwell works):
 * dictation overlay, AI ghost Accept/Reject, busy state, clarify options, "Didn't catch that".
 */
export default function ContextPanel() {
  const overlay = useStore((s) => s.overlay);
  const clarify = useStore((s) => s.clarify);
  const nearest = useStore((s) => s.nearest);
  const mic = useStore((s) => s.mic);

  if (overlay?.kind === "dictation") return <Dictation />;

  if (overlay?.kind === "busy") {
    return (
      <section className="context-panel" aria-labelledby="ctx-busy">
        <h2 id="ctx-busy">{overlay.text}</h2>
        <p>This can take a few seconds. Nothing changes until you accept.</p>
        <div className="tile-grid">
          <ActionTile id="cancel" label="Cancel" />
        </div>
      </section>
    );
  }

  if (overlay?.kind === "ghost") {
    return (
      <section className="context-panel context-ghost" aria-labelledby="ctx-ghost">
        <h2 id="ctx-ghost">Suggestion</h2>
        <p>
          {overlay.summary}. It is shown faded on the page. Nothing is replaced until you accept.
        </p>
        <div className="tile-grid">
          <ActionTile id="accept" label="Accept" className="tile-primary" />
          <TileButton tileId="ghost.reject" label="Reject" keyHint="Esc" onActivate={(via) => dispatch({ id: "cancel", via })} />
        </div>
      </section>
    );
  }

  if (clarify) {
    return (
      <section className="context-panel" aria-labelledby="ctx-clarify">
        <h2 id="ctx-clarify">{clarify.question}</h2>
        <p>I heard “{clarify.heard}”.</p>
        <div className="tile-grid">
          {clarify.options.map((o, i) => (
            <ActionTile key={i} id={`choose.${i + 1}` as "choose.1"} label={`${i + 1}. ${o.label}`} />
          ))}
          <ActionTile id="cancel" label="None of these" />
        </div>
      </section>
    );
  }

  if (nearest) {
    return (
      <section className="context-panel" aria-labelledby="ctx-nearest">
        <h2 id="ctx-nearest">Didn&apos;t catch that</h2>
        <p>I heard “{nearest.heard}”.{nearest.ids.length ? " Did you mean:" : " Try the typed box or a tile."}</p>
        <div className="tile-grid">
          {nearest.ids.map((id, i) => (
            <TileButton
              key={id}
              tileId={`nearest.${id}`}
              label={`${i + 1}. ${ACTION_BY_ID[id].label}`}
              keyHint={String(i + 1)}
              onActivate={(via) => dispatch({ id: `choose.${i + 1}` as "choose.1", via })}
            />
          ))}
          <ActionTile id="cancel" label="Dismiss" />
        </div>
      </section>
    );
  }

  if (mic.open) {
    return (
      <section className="context-panel" aria-labelledby="ctx-mic">
        <h2 id="ctx-mic">Listening</h2>
        <LevelMeter level={mic.level} />
        <p aria-live="polite">{mic.partial || "Say a command, for example “blue” or “undo”."}</p>
        <div className="tile-grid">
          <ActionTile id="mic.toggle" pressed label="Stop mic" />
        </div>
      </section>
    );
  }
  return null;
}

export function LevelMeter({ level }: { level: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  return (
    <div className="level-meter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="level-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Dictation() {
  const overlay = useStore((s) => s.overlay);
  const mic = useStore((s) => s.mic);
  if (overlay?.kind !== "dictation") return null;
  if (overlay.stage === "editing") return <TextEditor key={overlay.editId ?? "new"} initial={overlay.text} />;

  const live = [overlay.text, overlay.partial].filter(Boolean).join(" ");
  return (
    <section className="context-panel" aria-labelledby="ctx-dict">
      <h2 id="ctx-dict">Note</h2>
      {mic.open && <LevelMeter level={mic.level} />}
      <div className="transcript" role="log" aria-live="polite" aria-label="What I heard">
        {live || (mic.open ? "Listening… speak your note." : "Nothing yet. Press 1 to try again.")}
      </div>
      <div className="tile-grid">
        <ActionTile id="accept" label="Accept" className="tile-primary" />
        <ActionTile id="dictation.fix" label="Fix" />
        <ActionTile id="cancel" label="Cancel" />
        <ActionTile id="dictation.edit" label="Edit" />
      </div>
    </section>
  );
}

/** Editable textarea, shown only after Accept (or via the Edit tile). */
function TextEditor({ initial }: { initial: string }) {
  const [draft, setDraft] = useState(initial);
  return (
    <section className="context-panel" aria-labelledby="ctx-edit">
      <h2 id="ctx-edit">Edit text</h2>
      <label htmlFor="dictation-edit">Text on the page</label>
      <textarea
        id="dictation-edit"
        className="dictation-edit"
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            finishEditing(draft);
          }
        }}
      />
      <div className="tile-grid">
        <TileButton tileId="dictation.done" label="Done" className="tile-primary" onActivate={() => finishEditing(draft)} />
        <ActionTile id="dictation.fix" label="Fix (say it again)" />
      </div>
    </section>
  );
}
