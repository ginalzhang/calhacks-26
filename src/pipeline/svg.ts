/**
 * SVG export (§6, P3) from stored stroke data, plus a parser for round-trip tests.
 * Strokes become round-capped polylines (`<path>`), dots become `<circle>`s; every element
 * carries data-kind / data-colour / data-width / data-id so svgToStrokes() recovers them
 * exactly (coordinates are written with 2 decimals → error ≤ 0.005 px). viewBox = canvas size.
 */
import { COLOUR_HEX, COLOURS, type ColourName } from "@/actions";
import type { Page, Size, Stroke, StrokeKind } from "./types";

export const PAGE_BACKGROUND_HEX = { light: "#ffffff", dark: "#161616" } as const;
export const GUIDE_SPACING = 48;

const n2 = (v: number) => (Math.round(v * 100) / 100).toString();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function strokeToSvgElement(s: Stroke): string {
  const hex = COLOUR_HEX[s.colour];
  const data = `data-id="${esc(s.id)}" data-kind="${s.kind}" data-colour="${s.colour}" data-width="${n2(s.width)}"`;
  if (s.kind === "dot" || s.points.length === 1) {
    const p = s.points[0] ?? { x: 0, y: 0 };
    return `<circle cx="${n2(p.x)}" cy="${n2(p.y)}" r="${n2(s.width / 2)}" fill="${hex}" ${data}/>`;
  }
  const d = s.points.map((p, i) => `${i ? "L" : "M"}${n2(p.x)} ${n2(p.y)}`).join(" ");
  return `<path d="${d}" fill="none" stroke="${hex}" stroke-width="${n2(s.width)}" stroke-linecap="round" stroke-linejoin="round" ${data}/>`;
}

export function pageToSvg(page: Page, size: Size): string {
  const W = n2(size.w);
  const H = n2(size.h);
  const bg = PAGE_BACKGROUND_HEX[page.background];
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-page="${esc(page.name)}">`,
    `<title>${esc(page.name)}</title>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${bg}"/>`,
  ];
  if (page.guides) {
    const stroke = page.background === "dark" ? "#3a3a3a" : "#d6dbe3";
    const lines: string[] = [];
    for (let y = GUIDE_SPACING; y < size.h; y += GUIDE_SPACING) lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);
    parts.push(`<g stroke="${stroke}" stroke-width="1" data-guides="1">${lines.join("")}</g>`);
  }
  for (const s of page.strokes) parts.push(strokeToSvgElement(s));
  for (const t of page.texts) {
    parts.push(
      `<text x="${n2(t.x)}" y="${n2(t.y)}" font-size="${n2(t.size)}" font-family="system-ui, sans-serif" fill="${COLOUR_HEX[t.colour]}" data-id="${esc(t.id)}">${esc(t.text)}</text>`,
    );
  }
  parts.push("</svg>");
  return parts.join("\n");
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = unesc(m[2]);
  return out;
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Nearest of the eight ink colours to a hex value (for SVGs without data-colour). */
export function nearestColour(hex: string | undefined): ColourName {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return "black";
  let best: ColourName = "black";
  let bestD = Infinity;
  for (const c of COLOURS) {
    const q = hexToRgb(COLOUR_HEX[c])!;
    const d = (q[0] - rgb[0]) ** 2 + (q[1] - rgb[1]) ** 2 + (q[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

const isColour = (c: string | undefined): c is ColourName => !!c && (COLOURS as readonly string[]).includes(c);

/** Parse "M x y L x y …" (also commas / implicit lineto) into points. */
function parsePathD(d: string): { x: number; y: number }[] {
  const nums = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

export type ParsedStroke = Pick<Stroke, "points" | "colour" | "width"> & { kind?: StrokeKind; id?: string };

/** Recover strokes from an SVG produced by pageToSvg (paths + dot circles, in document order). */
export function svgToStrokes(svg: string): ParsedStroke[] {
  const out: ParsedStroke[] = [];
  for (const m of svg.matchAll(/<(path|circle)\b[^>]*>/g)) {
    const a = attrs(m[0]);
    const kind = a["data-kind"] as StrokeKind | undefined;
    if (m[1] === "circle") {
      const width = a["data-width"] !== undefined ? Number(a["data-width"]) : 2 * Number(a.r ?? 1);
      out.push({ kind: kind ?? "dot", id: a["data-id"], points: [{ x: Number(a.cx), y: Number(a.cy) }], colour: isColour(a["data-colour"]) ? a["data-colour"] : nearestColour(a.fill), width });
    } else {
      const width = Number(a["data-width"] ?? a["stroke-width"] ?? 1);
      out.push({ kind: kind ?? "free", id: a["data-id"], points: parsePathD(a.d ?? ""), colour: isColour(a["data-colour"]) ? a["data-colour"] : nearestColour(a.stroke), width });
    }
  }
  return out;
}
