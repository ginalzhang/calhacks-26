"use client";

import { useEffect, useRef } from "react";
import { COLOUR_HEX } from "@/actions";
import { currentPage } from "@/pipeline/document";
import { startRenderLoop } from "@/lib/render";
import { runtime } from "@/state/runtime";
import { useStore } from "@/state/store";

/**
 * The drawing canvas (role=img, tabIndex 0, aria-label updated on pen-up) inside a wide
 * rest-zone margin. A coloured border shows DRAWING. The cursor/dwell ring is drawn on a
 * separate full-viewport, aria-hidden overlay so it is visible over the tiles too.
 */
export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const pen = useStore((s) => s.pen);
  const colour = useStore((s) => s.colour);
  const history = useStore((s) => s.history);
  const tool = useStore((s) => s.tool);
  const page = currentPage(history.doc);
  // aria-label only changes on pen-up (strokes are committed then), not on every point.
  const label = `Drawing canvas, page ${page.name}, ${page.strokes.length} ${page.strokes.length === 1 ? "stroke" : "strokes"}${
    page.texts.length ? `, ${page.texts.length} text ${page.texts.length === 1 ? "block" : "blocks"}` : ""
  }`;

  useEffect(() => {
    const c = canvasRef.current;
    const o = overlayRef.current;
    if (!c || !o) return;
    runtime.setCanvas(c);
    const ro = new ResizeObserver(() => {
      const r = c.getBoundingClientRect();
      runtime.setCanvasSize({ w: r.width, h: r.height });
    });
    ro.observe(c);
    const r = c.getBoundingClientRect();
    runtime.setCanvasSize({ w: r.width, h: r.height });
    const stop = startRenderLoop({ canvas: c, overlay: o });
    return () => {
      stop();
      ro.disconnect();
      runtime.setCanvas(null);
    };
  }, []);

  const border = colour === "white" || colour === "yellow" ? "#1d5fd1" : COLOUR_HEX[colour];

  return (
    <div className={`canvas-frame${pen === "DRAWING" ? " is-drawing" : ""}`} style={{ ["--ink" as string]: border }}>
      <canvas
        id="steady-canvas"
        ref={canvasRef}
        className={`drawing-canvas tool-${tool}`}
        role="img"
        aria-label={label}
        tabIndex={0}
      />
      <canvas ref={overlayRef} className="cursor-overlay" aria-hidden="true" />
    </div>
  );
}
