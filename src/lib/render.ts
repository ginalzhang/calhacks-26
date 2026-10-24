/**
 * Canvas rendering: own requestAnimationFrame loop (§1), devicePixelRatio-aware.
 *  - committed layer (background, guides, strokes, text) cached offscreen, redrawn on change;
 *  - live stroke via perfect-freehand (A's strokeOutline);
 *  - Demo ghost view: raw strokes faded under the smoothed ones;
 *  - AI ghost overlay preview;
 *  - cursor overlay (full viewport, aria-hidden): hollow in HOVER, filled in DRAWING,
 *    dwell ring (stepped under prefers-reduced-motion), hollow "?" ring when tracking is lost.
 */
import { COLOUR_HEX } from "@/actions";
import { outlineToPath2DString, strokeOutline } from "@/pipeline/strokes";
import type { Page, Size, Stroke, TextBlock, Vec2 } from "@/pipeline/types";
import { BG_HEX, runtime } from "@/state/runtime";
import { getState } from "@/state/store";
import { page as currentPageOf } from "@/state/docOps";

const GUIDE = { light: "#b9c6d6", dark: "#475063" } as const;
export const GUIDE_SPACING = 48;

const pathCache = new WeakMap<Stroke, Path2D>();

function strokePath(s: Stroke): Path2D {
  let p = pathCache.get(s);
  if (!p) {
    p = new Path2D(outlineToPath2DString(strokeOutline(s.points, s.width)));
    pathCache.set(s, p);
  }
  return p;
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const col = COLOUR_HEX[s.colour] ?? "#111";
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  if (s.kind === "dot" || s.points.length === 1) {
    const p = s.points[0];
    if (p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, s.width / 2), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (s.kind === "free") {
    ctx.fill(strokePath(s));
  } else {
    // Fitted shapes and straight lines: crisp polyline.
    ctx.lineWidth = s.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (s.kind !== "line" && s.points.length > 2) ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawText(ctx: CanvasRenderingContext2D, t: Pick<TextBlock, "x" | "y" | "text" | "size"> & { colour?: string }, colour: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.font = `${t.size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "top";
  t.text.split("\n").forEach((line, i) => ctx.fillText(line, t.x, t.y + i * t.size * 1.25));
  ctx.restore();
}

function drawRaw(ctx: CanvasRenderingContext2D, pts: Vec2[], dark: boolean) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = dark ? "#ff9db0" : "#c2185b";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}

/** Paint a page (background, guides, strokes, texts) at CSS-px scale on ctx. */
export function paintPage(
  ctx: CanvasRenderingContext2D,
  page: Page,
  size: Size,
  opts: { ghost?: boolean; hidden?: (id: string) => boolean } = {},
) {
  ctx.fillStyle = BG_HEX[page.background];
  ctx.fillRect(0, 0, size.w, size.h);
  if (page.guides) {
    ctx.save();
    ctx.strokeStyle = GUIDE[page.background];
    ctx.lineWidth = 1;
    for (let y = GUIDE_SPACING; y < size.h; y += GUIDE_SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(size.w, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }
  const dark = page.background === "dark";
  for (const s of page.strokes) {
    if (opts.hidden?.(s.id)) continue;
    if (opts.ghost && s.raw?.length) drawRaw(ctx, s.raw, dark);
    drawStroke(ctx, s);
  }
  for (const t of page.texts) drawText(ctx, t, COLOUR_HEX[t.colour] ?? "#111");
}

// ------------------------------------------------------------------ render loop

export interface RenderTargets {
  canvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
}

export function startRenderLoop(t: RenderTargets): () => void {
  const layer = document.createElement("canvas");
  let layerKey = "";
  let raf = 0;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const st = getState();
    const dpr = window.devicePixelRatio || 1;
    const size = runtime.canvasSize;
    const c = t.canvas;
    const W = Math.round(size.w * dpr);
    const H = Math.round(size.h * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const page = currentPageOf();
    const key = `${st.renderVersion}|${W}x${H}|${st.ghost}|${page.id}`;
    if (key !== layerKey) {
      layerKey = key;
      layer.width = W;
      layer.height = H;
      const lctx = layer.getContext("2d")!;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintPage(lctx, page, size, { ghost: st.ghost, hidden: (id) => runtime.isErasing(id) });
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // AI ghost overlay preview (faded; nothing replaced until Accept).
    const ov = st.overlay;
    if (ov?.kind === "ghost") {
      ctx.save();
      ctx.setLineDash([6, 6]);
      ov.strokes.forEach((s) => drawStroke(ctx, s, 0.55));
      ov.texts.forEach((tx) => drawText(ctx, tx, page.background === "dark" ? "#9cc3ff" : "#1d5fd1", 0.85));
      ctx.restore();
    }

    // Live stroke.
    const live = runtime.live;
    if (live && live.points.length) {
      if (st.ghost && live.raw.length) drawRaw(ctx, live.raw, page.background === "dark");
      const pts = st.tool === "straight" && live.points.length > 1 ? [live.points[0], live.points[live.points.length - 1]] : live.points;
      const s: Stroke = {
        id: live.id,
        kind: st.tool === "straight" ? "line" : "free",
        points: pts,
        colour: st.colour,
        width: st.width,
        createdAt: 0,
      };
      if (pts.length === 1) drawStroke(ctx, { ...s, kind: "dot" });
      else if (s.kind === "free") {
        ctx.fillStyle = COLOUR_HEX[st.colour];
        ctx.fill(new Path2D(outlineToPath2DString(strokeOutline(pts, st.width))));
      } else drawStroke(ctx, s);
    }

    drawCursorOverlay(t.overlay, dpr, !!reduced?.matches);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

function drawCursorOverlay(o: HTMLCanvasElement, dpr: number, reducedMotion: boolean) {
  const W = Math.round(window.innerWidth * dpr);
  const H = Math.round(window.innerHeight * dpr);
  if (o.width !== W || o.height !== H) {
    o.width = W;
    o.height = H;
  }
  const ctx = o.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const st = getState();
  if (st.phase === "intro") return;
  const f = runtime.frame;
  const lost = !f || f.tracking === "lost" || st.paused;
  const at = lost ? runtime.lastPointer : f.pointer;
  if (!at) return;
  const p = runtime.toViewport(at);
  const ink = COLOUR_HEX[st.colour];

  if (lost) {
    // Hollow "?" ring, frozen where tracking was lost.
    ring(ctx, p, 18, "#ffffff", 7);
    ring(ctx, p, 18, "#b45309", 3.5);
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(st.paused ? "II" : "?", p.x, p.y + 1);
    ctx.fillStyle = "#b45309";
    ctx.fillText(st.paused ? "II" : "?", p.x, p.y + 1);
    return;
  }

  // Dwell ring: ink dwell (canvas) or tile dwell (toolbar).
  let progress = 0;
  let ringColour = "#1d5fd1";
  if (f.dwell.kind && f.dwell.progress > 0) {
    progress = f.dwell.progress;
    ringColour = f.dwell.kind === "pen-down" ? "#178a3c" : "#b45309";
  } else if (runtime.tileState.hoveredId && runtime.tileState.progress > 0) {
    progress = runtime.tileState.progress;
    ringColour = "#1d5fd1";
  }
  if (progress > 0) {
    const shown = reducedMotion ? Math.floor(progress * 4) / 4 : progress;
    ring(ctx, p, 26, "rgba(255,255,255,0.9)", 9);
    ring(ctx, p, 26, "rgba(0,0,0,0.25)", 5);
    if (shown > 0) {
      ctx.save();
      ctx.strokeStyle = ringColour;
      ctx.lineWidth = 5;
      ctx.lineCap = reducedMotion ? "butt" : "round";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, -Math.PI / 2, -Math.PI / 2 + shown * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (st.pen === "DRAWING") {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ring(ctx, p, 12, "#ffffff", 3);
    ring(ctx, p, 14.5, "#111111", 2);
  } else {
    ring(ctx, p, 12, "#ffffff", 6);
    ring(ctx, p, 12, "#111111", 2.5);
  }
}

function ring(ctx: CanvasRenderingContext2D, p: Vec2, r: number, colour: string, width: number) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ export

/** Render a page at devicePixelRatio scale into a fresh canvas (no cursor/overlays). */
export function renderPageCanvas(page: Page, size: Size, crop?: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement("canvas");
  const r = crop ?? { x: 0, y: 0, w: size.w, h: size.h };
  c.width = Math.max(1, Math.round(r.w * dpr));
  c.height = Math.max(1, Math.round(r.h * dpr));
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, -r.x * dpr, -r.y * dpr);
  paintPage(ctx, page, size);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportPng(page: Page, size: Size): Promise<Blob> {
  const blob = await canvasToBlob(renderPageCanvas(page, size));
  downloadBlob(blob, `steady-${slug(page.name)}.png`);
  return blob;
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
}
