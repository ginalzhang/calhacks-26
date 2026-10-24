"use client";

import { useEffect, useRef } from "react";
import KeyMap from "./KeyMap";
import { useStore } from "@/state/store";
import { startSetup, skipSetup, applyLastSetup } from "@/state/setup";

/** Design rule 9, verbatim (the Ask Steady sentence is omitted because that feature was cut). */
export const PRIVACY_TEXT = [
  "Camera frames never leave the browser.",
  "Microphone audio goes to Cartesia (or Google, in the Web Speech fallback) only while the mic is open.",
  "A command the local grammar cannot match (its text, never audio, plus your last three actions) and, only when you explicitly ask for AI cleanup, stroke data plus a PNG crop go to our server and on to Anthropic.",
  "Nothing else leaves the browser.",
  "In Desktop mode the browser also sends pointer positions and shortcut keystrokes to a helper program on this same computer (127.0.0.1 only); the helper never sends anything off the machine.",
];

export default function FirstRun() {
  const hasSaved = useStore((s) => s.hasSavedSetup);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <main className="firstrun" aria-labelledby="fr-title">
      <h1 id="fr-title">Steady</h1>
      <p className="lede">
        Draw and take notes with your webcam and your voice. No pen, no grip, no pinch: rest your hand and move it a
        little.
      </p>

      <div className="firstrun-actions">
        {hasSaved && (
          <button ref={first} type="button" className="tile tile-primary" data-tile="intro.last" onClick={applyLastSetup}>
            <span className="tile-label">Use last setup</span>
            <span className="tile-dwell" aria-hidden="true" />
          </button>
        )}
        <button
          ref={hasSaved ? undefined : first}
          type="button"
          className={`tile${hasSaved ? "" : " tile-primary"}`}
          data-tile="intro.setup"
          onClick={startSetup}
        >
          <span className="tile-label">Set up (about 10 seconds)</span>
          <span className="tile-dwell" aria-hidden="true" />
        </button>
        <button type="button" className="tile" data-tile="intro.skip" onClick={skipSetup}>
          <span className="tile-label">Skip setup for now</span>
          <span className="tile-dwell" aria-hidden="true" />
        </button>
      </div>

      <div className="firstrun-cols">
        <section aria-labelledby="fr-how">
          <h2 id="fr-how">How it works</h2>
          <ol className="howto">
            <li>Rest your wrist on the desk, a book or a rolled towel. Let your other fingers curl loosely; you don&apos;t need to point.</li>
            <li>Hold still to put the pen down. Move to draw. Hold still again to lift it.</li>
            <li>Every action is a tile, a spoken word and a typed command. Space toggles the pen.</li>
            <li>Undo is always one step: Backspace, Z, the Undo tile, or say “undo”.</li>
          </ol>
        </section>
        <section aria-labelledby="fr-privacy">
          <h2 id="fr-privacy">Privacy</h2>
          {PRIVACY_TEXT.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </section>
        <section aria-labelledby="fr-keys">
          <h2 id="fr-keys">Keys</h2>
          <KeyMap caption="Every other key does nothing." />
        </section>
      </div>
    </main>
  );
}
