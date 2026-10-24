"use client";

import { useEffect, useRef, useState } from "react";
import { runtime } from "@/state/runtime";
import { setState, useStore } from "@/state/store";
import { getParams } from "@/lib/params";

/**
 * Mirrored camera preview (CSS scaleX(-1)). After calibration it collapses to a 120 px
 * thumbnail with a green / amber / red tracking dot. Shows the lighting and fps warnings.
 */
export default function CameraPreview() {
  const holder = useRef<HTMLDivElement>(null);
  const collapsed = useStore((s) => s.previewCollapsed);
  const tracking = useStore((s) => s.tracking);
  const started = useStore((s) => s.trackingStarted);
  const error = useStore((s) => s.sourceError);
  const detFps = useStore((s) => s.metrics.detectionFps);
  const camFps = useStore((s) => s.metrics.cameraFps);
  const paused = useStore((s) => s.paused);
  const [luma, setLuma] = useState<number | null>(null);
  const replay = getParams().source === "replay";

  useEffect(() => {
    const v = runtime.source?.video;
    const h = holder.current;
    if (!v || !h || v.parentElement === h) return;
    v.className = "preview-video";
    h.appendChild(v);
    void v.play().catch(() => undefined);
  }, [started]);

  useEffect(() => {
    const id = setInterval(() => setLuma(runtime.luma), 1000);
    return () => clearInterval(id);
  }, []);

  const lowFps = started && tracking === "ok" && detFps > 0 && detFps < 25;
  const dark = luma !== null && luma < 50;
  const dot = paused || tracking === "lost" || error ? "red" : lowFps || dark ? "amber" : "green";
  const dotText =
    dot === "green" ? "Tracking well" : dot === "amber" ? "Tracking, but conditions are poor" : paused ? "Tracking paused" : "Not tracking";

  return (
    <section className={`preview${collapsed ? " preview-collapsed" : ""}`} aria-label="Camera preview">
      <div className="preview-box" ref={holder}>
        {replay && <div className="preview-replay">Replay{getParams().fixture ? `: ${getParams().fixture}` : ""}</div>}
        {!replay && !started && !error && <div className="preview-replay">Starting camera…</div>}
        {error && <div className="preview-replay preview-error">{error}</div>}
        <span className={`track-dot dot-${dot}`} aria-hidden="true" />
      </div>
      <div className="preview-meta">
        <p className="preview-state">
          <span className={`dot-inline dot-${dot}`} aria-hidden="true" /> {dotText}
        </p>
        {!collapsed && (
          <p className="preview-fps">
            Camera {camFps} fps · detection {detFps} fps
          </p>
        )}
        {lowFps && <p className="warn">Detection is {detFps} fps (below 25). Close other tabs, or add light.</p>}
        {dark && <p className="warn">Lighting is low. A lamp facing you helps tracking.</p>}
        <button type="button" className="link-button" onClick={() => setState({ previewCollapsed: !collapsed })}>
          {collapsed ? "Show larger preview" : "Make preview small"}
        </button>
      </div>
    </section>
  );
}
