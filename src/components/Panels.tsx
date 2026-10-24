"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIONS } from "@/actions";
import type { PointerLandmark } from "@/pipeline/types";
import { POINTER_LANDMARK_LABELS } from "@/tracking/pointerLandmark";
import { runtime } from "@/state/runtime";
import { setState, setStatus, useStore } from "@/state/store";
import { persistPrefs } from "@/state/dispatch";
import { addProfile, renameProfile, saveActiveProfile } from "@/state/profiles";
import { focusCanvas } from "@/lib/focus";
import KeyMap from "./KeyMap";
import { GainSlider, Slider } from "./Sliders";
import { ActionTile, TileButton } from "./Tile";
import { HIDDEN_TILES } from "./Toolbar";

function close() {
  setState({ panel: null });
  focusCanvas();
}

function PanelShell({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <div className="panel-head">
        <h2 id={`${id}-title`} ref={ref} tabIndex={-1}>
          {title}
        </h2>
        <TileButton tileId={`${id}.close`} label="Close" keyHint="Esc" onActivate={close} />
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function HelpPanel() {
  const phrases = ACTIONS.filter((a) => a.context === "always" && !HIDDEN_TILES.has(a.id));
  return (
    <PanelShell id="help" title="Help">
      <h3>Drawing</h3>
      <ul>
        <li>Rest your wrist. Let your other fingers curl loosely; you don&apos;t need to point.</li>
        <li>Hold the cursor still on the page to put the pen down (green ring). Move to draw.</li>
        <li>Hold still again to lift the pen (amber ring). Nudge the cursor to keep drawing.</li>
        <li>Latch keeps the pen down until you lift it with Space, voice or the Pen tile.</li>
        <li>The margin around the page and the tiles are rest areas: holding still there never draws.</li>
      </ul>
      <h3>If your hand…</h3>
      <ul>
        <li>is steady but sore: try “steady but sore” (light smoothing, small movements).</li>
        <li>shakes when reaching: try “shakes when reaching”, or raise Steadiness.</li>
        <li>shakes at rest: try “shakes at rest” (Latch on, longer hold).</li>
        <li>is hard to hold still: try “hard to hold still” (Latch on, bigger tile targets) and use Space or voice for the pen.</li>
      </ul>
      <KeyMap caption="Keys (every other key does nothing)" />
      <h3>Words you can say or type</h3>
      <ul className="phrase-list">
        {phrases.map((a) => (
          <li key={a.id}>
            <strong>{a.label}</strong>: “{a.phrases[0]}”
          </li>
        ))}
      </ul>
      <p>On macOS and Windows, Sticky Keys and switch devices that send Space or Enter work too.</p>
    </PanelShell>
  );
}

export function SettingsPanel() {
  const s = useStore((st) => st.settings);
  const inputs = useStore((st) => st.inputs);
  const profiles = useStore((st) => st.profiles);
  const activeId = useStore((st) => st.activeProfileId);
  const sounds = useStore((st) => st.sounds);
  const speech = useStore((st) => st.speech);
  const [newName, setNewName] = useState("");
  const setInput = (k: "dwell" | "voice" | "keys", on: boolean) => {
    setState({ inputs: { ...inputs, [k]: on } });
    if (k === "dwell") runtime.updateSettings({ dwellEnabled: on });
    persistPrefs();
  };
  return (
    <PanelShell id="settings" title="Settings">
      <p>Steadiness is always beside the tools.</p>
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
        <ActionTile id="calibrate" />
        <ActionTile id="recenter" />
        <ActionTile id="remeasure" />
        <ActionTile id="calibration.reset" />
        <TileButton tileId="panel.advanced" label="Advanced" keepFocus onActivate={() => setState({ panel: "advanced" })} />
      </div>
      <h3>Profiles</h3>
      <p>Switch by saying a profile&apos;s name, or “switch profile”.</p>
      <ul className="profiles">
        {profiles.map((p) => (
          <li key={p.id}>
            <label htmlFor={`profile-${p.id}`}>{p.id === activeId ? "Active profile name" : "Profile name"}</label>
            <input
              id={`profile-${p.id}`}
              type="text"
              defaultValue={p.name}
              onBlur={(e) => renameProfile(p.id, e.currentTarget.value)}
            />
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
      <TileButton
        tileId="profile.save"
        label="Save to this profile"
        keepFocus
        onActivate={() => {
          saveActiveProfile();
          setStatus("Saved the current settings to this profile.");
        }}
      />
      <div className="tile-grid">
        <ActionTile id="preset.sore" />
        <ActionTile id="preset.reaching" />
        <ActionTile id="preset.rest" />
        <ActionTile id="preset.still" />
      </div>
    </PanelShell>
  );
}

export function AdvancedPanel() {
  const s = useStore((st) => st.settings);
  const f = s.filter;
  return (
    <PanelShell id="advanced" title="Advanced: raw filter settings">
      <p>These change live. Steadiness sets the first and last of them; moving Steadiness overwrites them.</p>
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
    </PanelShell>
  );
}
