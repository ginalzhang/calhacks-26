"use client";

import { persistSetup, runtime } from "@/state/runtime";
import { useStore } from "@/state/store";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistSetup, 500);
}

/** Native range with a visible label and aria-valuetext (design rule 6). */
export function Slider(props: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  valueText: string;
  display?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={props.id}>{props.label}</label>
        <output htmlFor={props.id} aria-hidden="true">
          {props.display ?? props.value}
        </output>
      </div>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        aria-valuetext={props.valueText}
        aria-describedby={props.hint ? `${props.id}-hint` : undefined}
        onChange={(e) => {
          props.onChange(Number(e.currentTarget.value));
          saveSoon();
        }}
      />
      {props.hint && (
        <p className="slider-hint" id={`${props.id}-hint`}>
          {props.hint}
        </p>
      )}
    </div>
  );
}

export function SteadinessSlider() {
  const v = useStore((s) => s.settings.steadiness);
  const calibration = useStore((s) => s.calibration);
  return (
    <Slider
      id="steadiness"
      label="Steadiness"
      min={0}
      max={100}
      step={1}
      value={v}
      valueText={`Steadiness ${v} of 100`}
      hint={calibration ? `Setup suggested ${calibration.suggestedSteadiness}. Higher smooths more shake; lower follows faster.` : "Higher smooths more shake; lower follows faster."}
      onChange={(n) => runtime.setSteadiness(n)}
    />
  );
}

export function GainSlider({ id = "gain" }: { id?: string }) {
  const gain = useStore((s) => s.settings.gain);
  const mode = useStore((s) => s.settings.mode);
  const min = mode === "head" ? 3 : 2;
  return (
    <Slider
      id={id}
      label="Reach (gain)"
      min={min}
      max={10}
      step={0.1}
      value={Math.round(gain * 10) / 10}
      valueText={`Gain ${gain.toFixed(1)} times`}
      display={`${gain.toFixed(1)}×`}
      hint="How far the cursor moves for a small hand movement."
      onChange={(n) => runtime.updateSettings({ gain: n })}
    />
  );
}
