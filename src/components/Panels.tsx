"use client";

/**
 * Help, Settings and Advanced panels. They are paginated with Next / Back tiles instead of
 * scrolling (dwell and switch users cannot scroll): each page is short enough for the canvas
 * area at 1280×800. Every tile on them is dwellable (panels count as a modal context).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ACTIONS } from "@/actions";
import type { PointerLandmark } from "@/pipeline/types";
import { POINTER_LANDMARK_LABELS } from "@/tracking/pointerLandmark";
import { runtime } from "@/state/runtime";
import { setState, setStatus, useStore } from "@/state/store";
import { persistPrefs } from "@/state/dispatch";
import { addProfile, renameProfile, saveActiveProfile, PRESETS, type PresetId } from "@/state/profiles";
import { focusCanvas } from "@/lib/focus";
import { KEY_MAP } from "./KeyMap";
import { GainSlider, Slider } from "./Sliders";
import { ActionTile, TileButton } from "./Tile";
import { HIDDEN_TILES } from "./Toolbar";

function close() {
  setState({ panel: null });
  focusCanvas();
}

interface Page {
  title: string;
  body: ReactNode;
}

/** A panel shown one page at a time. Next/Back tiles; never a scroll container. */
function PagedPanel({ id, title, pages }: { id: string; title: string; pages: Page[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  const page = pages[Math.min(i, pages.length - 1)];
  const go = (n: number) => {
    setI(n);
    requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
  };
  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <div className="panel-head">
        <h2 id={`${id}-title`} ref={ref} tabIndex={-1}>
          {title}: {page.title}
          <span className="panel-page"> (page {i + 1} of {pages.length})</span>
        </h2>
      </div>
      <div className="panel-body">{page.body}</div>
      <div className="panel-nav">
        <TileButton tileId={`${id}.prev`} label="← Back" disabled={i === 0} keepFocus onActivate={() => go(i - 1)} />
        <TileButton
          tileId={`${id}.next`}
          label="Next →"
          disabled={i >= pages.length - 1}
          keepFocus
          onActivate={() => go(i + 1)}
        />
        <TileButton tileId={`${id}.close`} label="Close" keyHint="Esc" onActivate={close} />
      </div>
    </section>
  );
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export function HelpPanel() {
  const phrases = ACTIONS.filter((a) => a.context === "always" && !HIDDEN_TILES.has(a.id));
  const pages: Page[] = [
    {
      title: "Drawing",
      body: (
        <ul>
          <li>Rest your wrist. Let your other fingers curl loosely; you don&apos;t need to point.</li>
          <li>Hold the cursor still on the page to put the pen down (green ring). Move to draw.</li>
          <li>Hold still again to lift the pen (amber ring). Nudge the cursor to keep drawing.</li>
          <li>Latch keeps the pen down until you lift it with Space, voice or the Pen tile.</li>
          <li>The margin around the page and the tiles are rest areas: holding still there never draws.</li>
        </ul>
      ),
    },
    {
      title: "If your hand…",
      body: (
        <ul>
          <li>is steady but sore: try “steady but sore” (light smoothing, small movements).</li>
          <li>shakes when reaching: try “shakes when reaching”, or raise Steadiness.</li>
          <li>shakes at rest: try “shakes at rest” (Latch on, longer hold).</li>
          <li>is hard to hold still: try “hard to hold still” (Latch on, bigger tile targets) and use Space or voice for the pen.</li>
          <li>gets tired: Head mode moves the cursor with your head; face tap puts the pen down.</li>
        </ul>
      ),
    },
    {
      title: "Keys",
      body: (
        <>
          <p>Every other key does nothing. Sticky Keys and switches that send Space or Enter work too.</p>
          <dl className="keylist">
            {KEY_MAP.map((k) => (
              <div key={k.keys}>
                <dt>
                  <kbd>{k.keys}</kbd>
                </dt>
                <dd>{k.does}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
    ...chunk(phrases, 10).map((group, n, all) => ({
      title: `Words you can say or type (${n + 1} of ${all.length})`,
      body: (
        <ul className="phrase-list">
          {group.map((a) => (
            <li key={a.id}>
              <strong>{a.label}</strong>: “{a.phrases[0]}”
            </li>
          ))}
        </ul>
      ),
    })),
  ];
  return <PagedPanel id="help" title="Help" pages={pages} />;
}

export function SettingsPanel() {
  const s = useStore((st) => st.settings);
  const inputs = useStore((st) => st.inputs);
  const profiles = useStore((st) => st.profiles);
  const activeId = useStore((st) => st.activeProfileId);
  const sounds = useStore((st) => st.sounds);
  const speech = useStore((st) => st.speech);
  const breaks = useStore((st) => st.breakReminders);
  const face = useStore((st) => st.face);
  const [newName, setNewName] = useState("");
  const setInput = (k: "dwell" | "voice" | "keys", on: boolean) => {
    setState({ inputs: { ...inputs, [k]: on } });
    if (k === "dwell") runtime.updateSettings({ dwellEnabled: on });
    persistPrefs();
  };
  const pages: Page[] = [
    {
      title: "Reach and holding still",
      body: (
        <>
          <GainSlider id="gain-settings" />
          <Slider
            id="pen-down-dwell"
            label="Hold to put the pen down"
            min={500}
            max={1500}
            step={50}
            value={s.penDownDwellMs}
            valueText={`${(s.penDownDwellMs / 1000).toFixed(2)} seconds`}
            display={`${(s.penDownDwellMs / 1000).toFixed(2)} s`}
            onChange={(v) => runtime.updateSettings({ penDownDwellMs: v, tileDwellMs: v })}
          />
          <Slider
            id="pen-up-dwell"
            label="Hold to lift the pen"
            min={800}
            max={3000}
            step={50}
            value={s.penUpDwellMs}
            valueText={`${(s.penUpDwellMs / 1000).toFixed(2)} seconds`}
            display={`${(s.penUpDwellMs / 1000).toFixed(2)} s`}
            onChange={(v) => runtime.updateSettings({ penUpDwellMs: v })}
          />
        </>
      ),
    },
    {
      title: "Pen and input",
      body: (
        <>
          <div className="field">
            <label htmlFor="pointer-landmark">Which part of the hand moves the cursor</label>
            <select
              id="pointer-landmark"
              value={s.pointerLandmark}
              onChange={(e) => runtime.updateSettings({ pointerLandmark: Number(e.currentTarget.value) as PointerLandmark })}
            >
              {([8, 5, 9] as PointerLandmark[]).map((l) => (
                <option key={l} value={l}>
                  {POINTER_LANDMARK_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="checks">
            <legend>Input methods (each can be switched off)</legend>
            <label>
              <input type="checkbox" checked={inputs.dwell} onChange={(e) => setInput("dwell", e.currentTarget.checked)} /> Holding still (dwell)
            </label>
            <label>
              <input type="checkbox" checked={inputs.voice} onChange={(e) => setInput("voice", e.currentTarget.checked)} /> Voice
            </label>
            <label>
              <input type="checkbox" checked={inputs.keys} onChange={(e) => setInput("keys", e.currentTarget.checked)} /> Keys
            </label>
          </fieldset>
          <div className="tile-grid">
            <ActionTile id="latch.toggle" pressed={s.latch} keepFocus />
            <ActionTile id="sounds.toggle" pressed={sounds} keepFocus />
            <ActionTile id="speech.toggle" pressed={speech} keepFocus />
          </div>
        </>
      ),
    },
    {
      title: "Head mode, face tap and breaks",
      body: (
        <>
          <p>
            Head mode moves the cursor with your nose instead of your hand. Face tap: open and close your mouth (or raise
            your eyebrows) once to put the pen down or lift it. It starts with a short check.
          </p>
          <div className="tile-grid">
            <ActionTile id="mode.head" pressed={s.mode === "head"} keepFocus />
            <ActionTile id="face.toggle" pressed={face.enabled} keepFocus />
            <TileButton
              tileId="breaks.toggle"
              label="Break reminders"
              pressed={breaks}
              keepFocus
              onActivate={() => {
                setState({ breakReminders: !breaks, reminder: null });
                setStatus(!breaks ? "Break reminders on." : "Break reminders off.");
                persistPrefs();
              }}
            />
          </div>
          <fieldset className="checks">
            <legend>Face tap signal</legend>
            <label>
              <input
                type="radio"
                name="face-signal"
                checked={face.signal === "jawOpen"}
                disabled={face.jawOpenMissing}
                onChange={() => runtime.setFaceSignal("jawOpen")}
              />{" "}
              Open and close the mouth
            </label>
            <label>
              <input type="radio" name="face-signal" checked={face.signal === "browInnerUp"} onChange={() => runtime.setFaceSignal("browInnerUp")} />{" "}
              Raise the eyebrows
            </label>
          </fieldset>
          {face.jawOpenMissing && <p className="warn">The face model gave no mouth signal on this computer, so face tap is off.</p>}
        </>
      ),
    },
    {
      title: "Setup",
      body: (
        <div className="tile-grid">
          <ActionTile id="calibrate" />
          <ActionTile id="recenter" />
          <ActionTile id="remeasure" />
          <ActionTile id="calibration.reset" />
          <TileButton tileId="panel.advanced" label="Advanced" keepFocus onActivate={() => setState({ panel: "advanced" })} />
        </div>
      ),
    },
    {
      title: "Profiles",
      body: (
        <>
          <p>Switch by saying a profile&apos;s name, or “switch profile”.</p>
          <ul className="profiles">
            {profiles.map((p) => (
              <li key={p.id}>
                <label htmlFor={`profile-${p.id}`}>{p.id === activeId ? "Active profile name" : "Profile name"}</label>
                <input id={`profile-${p.id}`} type="text" defaultValue={p.name} onBlur={(e) => renameProfile(p.id, e.currentTarget.value)} />
                {p.id === activeId && <span className="chip">in use</span>}
              </li>
            ))}
          </ul>
          <div className="typed-row">
            <label htmlFor="new-profile" className="sr-only">
              New profile name
            </label>
            <input id="new-profile" type="text" placeholder="New profile name" value={newName} onChange={(e) => setNewName(e.currentTarget.value)} />
            <button
              type="button"
              className="tile tile-run"
              data-tile="profile.add"
              onClick={() => {
                const p = addProfile(newName);
                setNewName("");
                setStatus(`Saved current settings as “${p.name}”.`);
              }}
            >
              <span className="tile-label">Save as new</span>
              <span className="tile-dwell" aria-hidden="true" />
            </button>
          </div>
          <div className="tile-grid">
            <TileButton
              tileId="profile.save"
              label="Save to this profile"
              keepFocus
              onActivate={() => {
                saveActiveProfile();
                setStatus("Saved the current settings to this profile.");
              }}
            />
            <ActionTile id="profile.next" />
          </div>
        </>
      ),
    },
    {
      title: "Presets",
      body: (
        <>
          <p>Each preset is named by what the hand does. You can change anything afterwards.</p>
          <ul className="presets">
            {(Object.keys(PRESETS) as PresetId[]).map((id) => (
              <li key={id}>
                <ActionTile id={id} keepFocus />
                <span>{PRESETS[id].describe}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
  ];
  return <PagedPanel id="settings" title="Settings" pages={pages} />;
}

export function AdvancedPanel() {
  const s = useStore((st) => st.settings);
  const f = s.filter;
  const pages: Page[] = [
    {
      title: "Smoothing filter",
      body: (
        <>
          <p>These change live. Moving Steadiness overwrites the first one and the dead zone.</p>
          <Slider
            id="adv-mincutoff"
            label="Smoothing min cutoff (Hz)"
            min={0.05}
            max={3}
            step={0.05}
            value={f.minCutoff}
            valueText={`${f.minCutoff.toFixed(2)} hertz`}
            display={f.minCutoff.toFixed(2)}
            onChange={(v) => runtime.updateSettings({ filter: { ...f, minCutoff: v } })}
          />
          <Slider
            id="adv-beta"
            label="Speed response (beta)"
            min={0}
            max={0.05}
            step={0.001}
            value={f.beta}
            valueText={`beta ${f.beta.toFixed(3)}`}
            display={f.beta.toFixed(3)}
            onChange={(v) => runtime.updateSettings({ filter: { ...f, beta: v } })}
          />
          <Slider
            id="adv-dcutoff"
            label="Derivative cutoff (Hz)"
            min={0.1}
            max={5}
            step={0.1}
            value={f.dCutoff}
            valueText={`${f.dCutoff.toFixed(1)} hertz`}
            display={f.dCutoff.toFixed(1)}
            onChange={(v) => runtime.updateSettings({ filter: { ...f, dCutoff: v } })}
          />
        </>
      ),
    },
    {
      title: "Dead zone and tiles",
      body: (
        <>
          <Slider
            id="adv-lazy"
            label="Dead zone radius (px)"
            min={0}
            max={40}
            step={1}
            value={s.lazyRadius}
            valueText={`${s.lazyRadius} pixels`}
            onChange={(v) => runtime.updateSettings({ lazyRadius: v })}
          />
          <Slider
            id="adv-tile-dwell"
            label="Hold time for tiles"
            min={500}
            max={2000}
            step={50}
            value={s.tileDwellMs}
            valueText={`${(s.tileDwellMs / 1000).toFixed(2)} seconds`}
            display={`${(s.tileDwellMs / 1000).toFixed(2)} s`}
            onChange={(v) => runtime.updateSettings({ tileDwellMs: v })}
          />
          <Slider
            id="adv-snap"
            label="Tile snap distance (px)"
            min={0}
            max={60}
            step={5}
            value={s.tileSnapPx}
            valueText={`${s.tileSnapPx} pixels`}
            onChange={(v) => runtime.updateSettings({ tileSnapPx: v })}
          />
          <p>
            Rest shake measured at setup: {s.restJitterRms.toFixed(2)} px. Active box:{" "}
            {s.activeBox ? `${Math.round(s.activeBox.w)}×${Math.round(s.activeBox.h)} camera px` : "centred default"}.
          </p>
        </>
      ),
    },
  ];
  return <PagedPanel id="advanced" title="Advanced" pages={pages} />;
}
