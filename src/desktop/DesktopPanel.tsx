"use client";

/**
 * Desktop mode side panel (§6a). Narrow so Chrome can sit beside Krita (a fully covered
 * Chrome window stops the camera loop). Camera thumbnail slot (children or `camera`), tracking
 * dot, pen state, Mic, Pause, Exit Desktop mode, Undo, Krita tool tiles, drawing-area setup,
 * dwell-click toggle, helper status with how-to-fix text.
 *
 * Accessibility (§0 rule 6): every control is a real <button> (B's TileButton / ActionTile,
 * ≥ 64 px, visible label), toggles expose aria-pressed, routine status is role="status",
 * tracking loss is role="alert". The dwell/click progress bar is aria-hidden.
 */
import type { ReactNode } from "react";
import { ACTION_BY_ID, type ActionId, type InputMethod } from "@/actions";
import { dispatch } from "@/state/dispatch";
import { useStore } from "@/state/store";
import { ActionTile, KEY_HINT, TileButton } from "@/components/Tile";
import type { TrackingLossReason } from "@/pipeline/types";
import { desktop } from "./bridge";
import { APP_LABELS, APP_TILE_LABELS, APP_TOOL_TILES } from "./shortcuts";
import { useDesktop } from "./useDesktop";
import styles from "./DesktopPanel.module.css";

export interface DesktopPanelProps {
  /** Camera thumbnail (B's <CameraPreview/>). `children` works too. */
  camera?: ReactNode;
  children?: ReactNode;
  /**
   * Render Steady's status line (role=status) and tracking alert (role=alert) inside the panel.
   * Default true: the Desktop layout replaces the full layout, so the StatusBar is not shown.
   * Pass false if the StatusBar is rendered alongside (avoids double announcements).
   */
  showAppStatus?: boolean;
}

const LOSS_TEXT: Record<TrackingLossReason, string> = {
  "no-hand": "No hand in view",
  "too-dark": "Too dark",
  "low-fps": "Camera too slow",
  paused: "Paused",
  "no-camera": "No camera",
};

/** App-facing tiles: keystroke to the app through the helper; falls back to Steady's own action. */
function appAction(id: ActionId, via: InputMethod) {
  if (!desktop.sendActionKeys(id)) dispatch({ id, via });
}

export default function DesktopPanel({ camera, children, showAppStatus = true }: DesktopPanelProps) {
  const d = useDesktop();
  const pen = useStore((s) => s.pen);
  const tracking = useStore((s) => s.tracking);
  const lossReason = useStore((s) => s.lossReason);
  const paused = useStore((s) => s.paused);
  const micOpen = useStore((s) => s.mic.open);
  const status = useStore((s) => s.status);
  const alert = useStore((s) => s.alert);
  const appName = APP_LABELS[d.app];
  const slot = camera ?? children;

  const dot = paused || tracking === "lost" ? "red" : "green";
  const trackingText = paused ? "Tracking paused" : tracking === "ok" ? "Tracking" : `Tracking lost: ${LOSS_TEXT[lossReason ?? "no-hand"]}`;
  const area = d.drawingArea;
  const areaText = d.wholeScreen ? `whole screen (${area.w} × ${area.h})` : `${area.w} × ${area.h} at ${area.x}, ${area.y}`;
  const pen8 = d.hotkeys.pen.toUpperCase();
  const pause9 = d.hotkeys.pause.toUpperCase();

  return (
    <aside className={styles.panel} aria-labelledby="desktop-panel-title" data-desktop-panel>
      <div className={styles.head}>
        <h2 id="desktop-panel-title">Desktop mode</h2>
        <span className={`pen-badge${pen === "DRAWING" ? " pen-drawing" : ""}`}>
          {pen === "DRAWING" ? (d.buttonDown ? "Pen down: painting" : "Pen down") : "Pen up"}
        </span>
      </div>

      <div className={styles.camera}>
        {slot}
        {!slot && (
          <p className={styles.row}>
            <span className={`dot-inline dot-${dot}`} aria-hidden="true" /> {trackingText}
          </p>
        )}
      </div>

      {showAppStatus && (
        <div>
          <p role="status" aria-live="polite" className={styles.status}>
            {status.kind === "status" ? status.text : ""}
          </p>
          <div role="alert">{alert && tracking === "lost" ? <p className={styles.alert}>{alert.text}</p> : null}</div>
        </div>
      )}

      <section className={styles.section} aria-labelledby="desktop-main-title">
        <h3 id="desktop-main-title">Controls</h3>
        <div className={styles.grid}>
          <TileButton
            tileId="pen.toggle"
            label={ACTION_BY_ID["pen.toggle"].label}
            pressed={pen === "DRAWING"}
            keyHint={`Space / ${pen8}`}
            onActivate={(via) => dispatch({ id: "pen.toggle", via })}
          />
          <ActionTile id="mic.toggle" pressed={micOpen} />
          <TileButton
            tileId="pause.toggle"
            label="Pause"
            pressed={paused}
            keyHint={`P / ${pause9}`}
            onActivate={(via) => {
              desktop.release();
              dispatch({ id: "pause.toggle", via });
            }}
          />
          <TileButton tileId="undo" label="Undo" keyHint={KEY_HINT.undo} onActivate={(via) => appAction("undo", via)} />
          <TileButton
            tileId="desktop.toggle"
            label="Exit Desktop mode"
            onActivate={(via) => {
              dispatch({ id: "desktop.toggle", via });
            }}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="desktop-tools-title">
        <h3 id="desktop-tools-title">{appName} tools</h3>
        <div className={styles.grid}>
          {APP_TOOL_TILES.map((id) => (
            <TileButton key={id} tileId={`desktop-${id}`} label={APP_TILE_LABELS[id] ?? ACTION_BY_ID[id].label} onActivate={(via) => appAction(id, via)} />
          ))}
        </div>
        {d.lastSent && <p className={styles.muted}>Last sent: {d.lastSent}</p>}
      </section>

      <section className={styles.section} aria-labelledby="desktop-area-title">
        <h3 id="desktop-area-title">Drawing area</h3>
        {d.setupStage ? (
          <>
            <p className={styles.status}>
              {d.setupStage === "top-left"
                ? `Step 1 of 2: move to the top-left corner of the ${appName} canvas and hold still (or press ${pen8}).`
                : `Step 2 of 2: move to the bottom-right corner and hold still (or press ${pen8}).`}
            </p>
            <div className={styles.progress} aria-hidden="true">
              <div className={styles.progressFill} style={{ width: `${Math.round(d.progress * 100)}%` }} />
            </div>
            <div className={styles.grid}>
              <TileButton tileId="desktop.area.cancel" label="Cancel setup" onActivate={() => desktop.cancelAreaSetup()} keepFocus />
            </div>
          </>
        ) : (
          <>
            <p className={styles.row}>Area: {areaText}</p>
            <p className={styles.muted}>
              Inside it, hold still to put the pen down. {d.dwellClick ? "Outside it, hold still to click." : "Dwell click is off."}
            </p>
            {d.dwellClick && d.progress > 0 && !d.inside && (
              <div className={styles.progress} aria-hidden="true">
                <div className={styles.progressFill} style={{ width: `${Math.round(d.progress * 100)}%` }} />
              </div>
            )}
            <div className={styles.grid}>
              <TileButton
                tileId="desktop.area"
                label={ACTION_BY_ID["desktop.area"].label}
                disabled={d.state !== "connected"}
                onActivate={() => desktop.startAreaSetup()}
                keepFocus
              />
              {!d.wholeScreen && <TileButton tileId="desktop.area.reset" label="Use whole screen" onActivate={() => desktop.resetDrawingArea()} keepFocus />}
              <TileButton
                tileId="desktop.dwellclick"
                label={ACTION_BY_ID["desktop.dwellclick"].label}
                pressed={d.dwellClick}
                onActivate={() => desktop.setDwellClick(!d.dwellClick)}
                keepFocus
              />
            </div>
          </>
        )}
      </section>

      <HelperStatus />
    </aside>
  );
}

function HelperStatus() {
  const d = useDesktop();
  const pen8 = d.hotkeys.pen.toUpperCase();
  const pause9 = d.hotkeys.pause.toUpperCase();
  const notRunning = d.error?.startsWith("Helper not running");
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const customOrigin = origin !== "http://localhost:3000";
  return (
    <section className={styles.section} aria-labelledby="desktop-helper-title">
      <h3 id="desktop-helper-title">Helper</h3>
      <p className={styles.row}>
        <span className={`dot-inline dot-${d.state === "connected" ? "green" : d.state === "connecting" ? "amber" : "red"}`} aria-hidden="true" />
        {d.state === "connected" && <span className={styles.ok}>Connected</span>}
        {d.state === "connecting" && <span>Connecting…</span>}
        {d.state === "error" && <span className={styles.bad}>{notRunning ? "Not running" : "Needs attention"}</span>}
        {d.state === "off" && <span>Off</span>}
      </p>
      {d.error && <p className={styles.alert}>{d.error}</p>}
      {d.state === "error" && notRunning && (
        <ol className={styles.fix}>
          <li>Open Terminal in the Steady folder.</li>
          <li>
            Run <code>{customOrigin ? `STEADY_ORIGIN=${origin} npm run helper` : "npm run helper"}</code> and leave it open.
          </li>
          <li>
            If macOS asks, allow Accessibility (mouse) and Input Monitoring (hotkeys) for Terminal in System Settings › Privacy &amp; Security, then
            restart the helper.
          </li>
        </ol>
      )}
      {d.state === "error" && (
        <div className={styles.grid}>
          <TileButton tileId="desktop.retry" label="Try again" onActivate={() => desktop.retryNow()} keepFocus />
        </div>
      )}
      {d.warning && <p className={styles.muted}>{d.warning}</p>}
      {d.state === "connected" && d.hotkeysAvailable !== false && (
        <p className={styles.muted}>
          Hotkeys work while {APP_LABELS[d.app]} has focus: {pen8} = pen, {pause9} = pause (on a Mac laptop you may need to hold fn).
        </p>
      )}
      <p className={styles.muted}>Keep this window beside {APP_LABELS[d.app]}, not behind it, or the camera stops.</p>
    </section>
  );
}

export { DesktopPanel };
