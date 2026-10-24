"use client";

import { setState, useStore } from "@/state/store";
import { getParams } from "@/lib/params";
import { USER_QUOTE } from "@/lib/quote";
import { ActionTile, TileButton } from "./Tile";

/**
 * Demo panel (§7) as a compact strip under the canvas, so a 1280×800 laptop never scrolls:
 * Simulate tremor, ghost view, Next judge (?demo=1 only) and the live metrics.
 * Steadier / Looser live under Setup and the Steadiness slider is always beside the tools.
 */
export default function DemoPanel() {
  const open = useStore((s) => s.demoOpen);
  const m = useStore((s) => s.metrics);
  const tremor = useStore((s) => s.tremor);
  const ghost = useStore((s) => s.ghost);
  const steadiness = useStore((s) => s.settings.steadiness);
  if (!open) return null;
  const rate = m.commandsTotal ? Math.round((100 * m.commandsMatched) / m.commandsTotal) : null;
  const drop = m.deviationRawPx > 0 ? Math.round(100 * (1 - m.deviationSmoothedPx / m.deviationRawPx)) : null;

  return (
    <section className="demo-panel" aria-labelledby="demo-title">
      <div className="demo-controls">
        <h2 id="demo-title">Demo</h2>
        <div className="tile-grid">
          <ActionTile id="tremor.toggle" pressed={tremor} />
          <ActionTile id="ghost.toggle" pressed={ghost} />
          {getParams().demo && <ActionTile id="judge.next" />}
        </div>
      </div>
      <dl className="metrics" aria-label="Live numbers">
        <div>
          <dt>Deviation raw (RMS)</dt>
          <dd data-metric="deviationRawPx">{m.deviationRawPx.toFixed(1)} px</dd>
        </div>
        <div>
          <dt>Deviation smoothed</dt>
          <dd data-metric="deviationSmoothedPx">
            {m.deviationSmoothedPx.toFixed(1)} px{drop !== null && drop > 0 ? ` (−${drop}%)` : ""}
          </dd>
        </div>
        <div>
          <dt>Last stroke time</dt>
          <dd data-metric="lastStrokeMs">{m.lastStrokeMs ? `${(m.lastStrokeMs / 1000).toFixed(1)} s` : "–"}</dd>
        </div>
        <div>
          <dt>Command success</dt>
          <dd data-metric="commands">{rate === null ? "–" : `${m.commandsMatched}/${m.commandsTotal} (${rate}%)`}</dd>
        </div>
        <div>
          <dt>Claude calls</dt>
          <dd data-metric="claude">
            {m.claudeCalls} ({m.claudeAccepted} accepted, {m.claudeRejected} rejected, {m.claudeTimeouts} timeouts)
          </dd>
        </div>
        <div>
          <dt>Camera / detection fps</dt>
          <dd data-metric="fps">
            {m.cameraFps} / {m.detectionFps}
          </dd>
        </div>
        <div>
          <dt>Steadiness</dt>
          <dd>{steadiness} of 100</dd>
        </div>
      </dl>
    </section>
  );
}

/** First demo screen: the user-interview sentence over the canvas until dismissed (any action). */
export function QuoteCard() {
  const open = useStore((s) => s.demoOpen);
  const seen = useStore((s) => s.demoQuoteSeen);
  if (!open || seen) return null;
  return (
    <figure className="quote quote-card" aria-labelledby="quote-cap">
      <blockquote>
        <p>{USER_QUOTE.placeholder ? USER_QUOTE.text : `“${USER_QUOTE.text}”`}</p>
      </blockquote>
      <figcaption id="quote-cap">{USER_QUOTE.who}</figcaption>
      <TileButton tileId="quote.hide" label="Hide quote" keepFocus onActivate={() => setState({ demoQuoteSeen: true })} />
    </figure>
  );
}
