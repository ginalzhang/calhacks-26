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
import type { Page, Rect, Size, Stroke, TextBlock, Vec2 } from "@/pipeline/types";
import { strokeBBox } from "@/pipeline/strokes";
import { isIdentity, unionRect, visibleDocRect, type View } from "./view";
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

/**
 * Paint a page (background, guides, strokes, texts). `ctx` is already in DOCUMENT space;
 * `region` is the document rect to fill with the background and guide lines.
 */
export function paintPage(
  ctx: CanvasRenderingContext2D,
  page: Page,
  region: Rect,
  opts: { ghost?: boolean; hidden?: (id: string) => boolean; lineWidth?: number } = {},
) {
  ctx.fillStyle = BG_HEX[page.background];
  ctx.fillRect(region.x, region.y, region.w, region.h);
  if (page.guides) {
    ctx.save();
    ctx.strokeStyle = GUIDE[page.background];
    ctx.lineWidth = opts.lineWidth ?? 1;
    const first = Math.ceil(region.y / GUIDE_SPACING) * GUIDE_SPACING || GUIDE_SPACING;
    for (let y = first; y < region.y + region.h; y += GUIDE_SPACING) {
      ctx.beginPath();
      ctx.moveTo(region.x, y + 0.5);
      ctx.lineTo(region.x + region.w, y + 0.5);
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
    const view: View = { zoom: st.zoom, pan: st.pan };
    const key = `${st.renderVersion}|${W}x${H}|${st.ghost}|${page.id}|${view.zoom}|${view.pan.x},${view.pan.y}`;
    if (key !== layerKey) {
      layerKey = key;
      layer.width = W;
      layer.height = H;
      const lctx = layer.getContext("2d")!;
      lctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.pan.x, dpr * view.pan.y);
      paintPage(lctx, page, visibleDocRect(view, size), {
        ghost: st.ghost,
        hidden: (id) => runtime.isErasing(id),
        lineWidth: 1 / view.zoom,
      });
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    // Live stroke and AI ghost are in document space too.
    ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.pan.x, dpr * view.pan.y);

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

/**
 * Render a document-space region of a page at devicePixelRatio scale into a fresh canvas
 * (no cursor/overlays, always at zoom 1). Default region: exportRegion().
 */
export function renderPageCanvas(page: Page, size: Size, crop?: Rect): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement("canvas");
  const r = crop ?? exportRegion(page, size);
  c.width = Math.max(1, Math.round(r.w * dpr));
  c.height = Math.max(1, Math.round(r.h * dpr));
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, -r.x * dpr, -r.y * dpr);
  paintPage(ctx, page, r);
  return c;
}

/** What an export contains: the canvas-sized page at zoom 1, grown to include anything drawn outside it. */
export function exportRegion(page: Page, size: Size): Rect {
  const base: Rect = { x: 0, y: 0, w: size.w, h: size.h };
  const pts = [...page.strokes.flatMap((s) => s.points), ...page.texts.map((t) => ({ x: t.x, y: t.y }))];
  if (!pts.length) return base;
  const bb = strokeBBox(pts);
  const pad = 24;
  const grown = unionRect(base, { x: bb.x - pad, y: bb.y - pad, w: bb.w + 2 * pad, h: bb.h + 2 * pad })!;
  return { x: Math.floor(grown.x), y: Math.floor(grown.y), w: Math.ceil(grown.w), h: Math.ceil(grown.h) };
}

export { isIdentity };

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
