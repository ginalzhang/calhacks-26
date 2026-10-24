"use client";

import { setState, useStore } from "@/state/store";
import { getParams } from "@/lib/params";
import { USER_QUOTE } from "@/lib/quote";
import { ActionTile, TileButton } from "./Tile";

/**
 * Demo panel (§7): Simulate tremor, ghost view, live metrics, Next judge (?demo=1 only).
 * The first demo screen shows one sentence from the user interview.
 */
export default function DemoPanel() {
  const open = useStore((s) => s.demoOpen);
  const m = useStore((s) => s.metrics);
  const tremor = useStore((s) => s.tremor);
  const ghost = useStore((s) => s.ghost);
  const quoteSeen = useStore((s) => s.demoQuoteSeen);
  const steadiness = useStore((s) => s.settings.steadiness);
  if (!open) return null;
  const rate = m.commandsTotal ? Math.round((100 * m.commandsMatched) / m.commandsTotal) : null;
  const drop = m.deviationRawPx > 0 ? Math.round(100 * (1 - m.deviationSmoothedPx / m.deviationRawPx)) : null;

  return (
    <section className="demo-panel" aria-labelledby="demo-title">
      <h2 id="demo-title">Demo</h2>
      {!quoteSeen && (
        <figure className="quote">
          <blockquote>
            <p>{USER_QUOTE.placeholder ? USER_QUOTE.text : `“${USER_QUOTE.text}”`}</p>
          </blockquote>
          <figcaption>{USER_QUOTE.who}</figcaption>
          <button type="button" className="link-button" onClick={() => setState({ demoQuoteSeen: true })}>
            Hide quote
          </button>
        </figure>
      )}
      <div className="tile-grid">
        <ActionTile id="tremor.toggle" pressed={tremor} />
        <ActionTile id="ghost.toggle" pressed={ghost} />
        <ActionTile id="steadier" />
        <ActionTile id="looser" />
        {getParams().demo && <ActionTile id="judge.next" />}
      </div>
      <dl className="metrics" aria-label="Live numbers">
        <div>
          <dt>Deviation, raw camera path (RMS)</dt>
          <dd data-metric="deviationRawPx">{m.deviationRawPx.toFixed(1)} px</dd>
        </div>
        <div>
          <dt>Deviation, smoothed cursor (RMS)</dt>
          <dd data-metric="deviationSmoothedPx">
            {m.deviationSmoothedPx.toFixed(1)} px{drop !== null && drop > 0 ? ` (${drop}% less)` : ""}
          </dd>
        </div>
        <div>
          <dt>Steadiness</dt>
          <dd>{steadiness} of 100</dd>
        </div>
        <div>
          <dt>Last stroke time</dt>
          <dd data-metric="lastStrokeMs">{m.lastStrokeMs ? `${(m.lastStrokeMs / 1000).toFixed(1)} s` : "–"}</dd>
        </div>
        <div>
          <dt>Command success</dt>
          <dd data-metric="commands">{rate === null ? "–" : `${m.commandsMatched} of ${m.commandsTotal} (${rate}%)`}</dd>
        </div>
        <div>
          <dt>Claude calls</dt>
          <dd data-metric="claude">
            {m.claudeCalls} calls, {m.claudeAccepted} accepted, {m.claudeRejected} rejected, {m.claudeTimeouts} timeouts
          </dd>
        </div>
        <div>
          <dt>Camera / detection fps</dt>
          <dd data-metric="fps">
            {m.cameraFps} / {m.detectionFps} fps
          </dd>
        </div>
      </dl>
      <TileButton tileId="demo.close" label="Close demo panel" onActivate={() => setState({ demoOpen: false })} />
    </section>
  );
}
