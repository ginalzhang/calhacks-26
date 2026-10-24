"use client";

import { useEffect } from "react";
import { runtime } from "@/state/runtime";
import { setState, setStatus, useStore, type Posture } from "@/state/store";
import { persistSetup } from "@/state/runtime";
import { TileButton } from "./Tile";

const POSTURES: { id: Posture; title: string; detail: string }[] = [
  {
    id: "external",
    title: "Camera looking down at the desk",
    detail: "An external webcam or your phone as a webcam, on a stand, pointing down at your resting hand. Tracks best.",
  },
  {
    id: "laptop",
    title: "Laptop pushed back, lid tilted down",
    detail: "Push the laptop back and tilt the lid about 30° forward so the camera can see your hand resting on the desk.",
  },
  {
    id: "head",
    title: "Head mode",
    detail: "Move your head instead of your hand. Not available in this build yet; use one of the first two for now.",
  },
];

/** One-line diagram: forearm and wrist resting on a rolled towel, fingers loosely curled. */
function WristDiagram() {
  return (
    <svg className="wrist-diagram" viewBox="0 0 360 90" role="img" aria-labelledby="wrist-diag-title">
      <title id="wrist-diag-title">Forearm flat on the desk, wrist resting on a rolled towel, fingers curled loosely</title>
      <line x1="4" y1="80" x2="356" y2="80" stroke="currentColor" strokeWidth="3" />
      <circle cx="210" cy="66" r="13" fill="none" stroke="currentColor" strokeWidth="3" />
      <path
        d="M20 72 C 80 64, 150 58, 200 52 C 228 49, 250 46, 272 50 C 292 54, 306 62, 312 72 C 300 74, 292 70, 286 66 C 280 72, 270 74, 262 70"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="168" y="30" fontSize="18" fill="currentColor">
        wrist rests here
      </text>
    </svg>
  );
}

export default function Calibration() {
  const calib = useStore((s) => s.calib);
  const posture = useStore((s) => s.posture);
  const tracking = useStore((s) => s.tracking);
  const head = useStore((s) => s.settings.mode === "head");
  const step = calib?.step;
  useEffect(() => {
    if (step === "posture") document.querySelector<HTMLButtonElement>("[data-tile='calib.start']")?.focus();
  }, [step]);
  if (!calib) return null;

  const stepNo = calib.step === "rest" ? 1 : 2;
  const totalSteps = calib.scope === "full" && !head ? 2 : 1;
  const heading =
    calib.step === "posture"
      ? "Setup: about 10 seconds"
      : calib.scope === "recenter"
        ? "Recenter"
        : calib.scope === "remeasure"
          ? "Measure again"
          : `Step ${stepNo} of ${totalSteps}`;

  return (
    <section className="calibration" aria-labelledby="calib-title">
      <h2 id="calib-title">{heading}</h2>
      {calib.step === "posture" ? (
        <>
          <fieldset className="posture">
            <legend>How does your camera see your hand?</legend>
            {POSTURES.map((p) => (
              <label key={p.id} className={`posture-option${posture === p.id ? " is-selected" : ""}`}>
                <input
                  type="radio"
                  name="posture"
                  value={p.id}
                  checked={posture === p.id}
                  onChange={() => {
                    setState({ posture: p.id });
                    persistSetup();
                    if (p.id === "head") setStatus("Head mode isn't available yet. Choose the desk camera or the tilted laptop.");
                  }}
                />
                <span>
                  <strong>{p.title}</strong>
                  <span className="posture-detail">{p.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <WristDiagram />
          <p className="coach">
            Rest your forearm and wrist on the desk, a book or a rolled towel. Let your other fingers curl loosely; you
            don&apos;t need to point. Then hold still for 3 seconds and draw one slow, easy circle for 4 seconds.
          </p>
          <div className="calib-actions">
            <TileButton
              tileId="calib.start"
              label="Start"
              className="tile-primary"
              keepFocus
              disabled={posture === "head"}
              onActivate={() => runtime.beginCalibration("full")}
            />
            <TileButton tileId="calib.cancel" label="Not now" keyHint="Esc" onActivate={() => runtime.cancelCalibration()} />
          </div>
        </>
      ) : (
        <>
          <p className="calib-instruction" aria-live="polite">
            {calib.message}
          </p>
          {head ? (
            <p className="coach">Sit comfortably. Your neutral position is where the cursor rests in the middle.</p>
          ) : calib.step === "circle" || calib.step === "retry-circle" ? (
            <p className="coach">Move slowly. A circle that feels easy is the right size; your wrist stays resting.</p>
          ) : (
            <p className="coach">Keep your wrist resting. Small natural movement is fine; this measures it.</p>
          )}
          <div
            className="calib-progress"
            role="progressbar"
            aria-label={calib.step === "rest" ? "Holding still" : "Drawing the circle"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(calib.progress * 100)}
          >
            <div className="calib-progress-fill" style={{ width: `${Math.round(calib.progress * 100)}%` }} />
          </div>
          {tracking === "lost" && (
            <p className="warn">I can&apos;t see {head ? "your face" : "your hand"} yet. There&apos;s no rush; the timer waits for you.</p>
          )}
          {!head && <WristDiagram />}
          <div className="calib-actions">
            <TileButton tileId="calib.cancel" label="Cancel setup" keyHint="Esc" onActivate={() => runtime.cancelCalibration()} />
          </div>
        </>
      )}
    </section>
  );
}
