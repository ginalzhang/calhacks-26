"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/state/store";
import { boot } from "@/state/setup";
import { installKeyboard } from "@/state/keyboard";
import { installHooks } from "@/state/hooks";
import "@/state/commands";
import DrawingCanvas from "./DrawingCanvas";
import Toolbar from "./Toolbar";
import StatusBar from "./StatusBar";
import CameraPreview from "./CameraPreview";
import { SteadinessSlider } from "./Sliders";
import TypedCommand from "./TypedCommand";
import FirstRun from "./FirstRun";
import Calibration from "./Calibration";
import ConfirmDialog from "./ConfirmDialog";
import ContextPanel from "./ContextPanel";
import DemoPanel from "./DemoPanel";
import { AdvancedPanel, HelpPanel, SettingsPanel } from "./Panels";
import Banners from "./Banners";
import DesktopPanel from "@/desktop/DesktopPanel";

let booted = false;

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1500px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function SteadyApp() {
  const phase = useStore((s) => s.phase);
  const dialog = useStore((s) => s.dialog);
  const panel = useStore((s) => s.panel);
  const demoOpen = useStore((s) => s.demoOpen);
  const desktopOn = useStore((s) => s.desktopOn);
  const wide = useWide();

  useEffect(() => {
    installHooks();
    const offKeys = installKeyboard();
    let offBoot: (() => void) | undefined;
    if (!booted) {
      booted = true;
      offBoot = boot();
    }
    return () => {
      offKeys();
      offBoot?.();
    };
  }, []);

  const intro = phase === "intro";
  const inert = intro || !!dialog;

  if (desktopOn && !intro) {
    // P2b: narrow side panel so Chrome can sit beside the drawing app (E's DesktopPanel).
    return (
      <>
        <div id="app-root" className="app app-desktop" inert={!!dialog}>
          <h1 className="sr-only">Steady, Desktop mode</h1>
          <DesktopPanel camera={<CameraPreview />} />
          <TypedCommand />
        </div>
        <ConfirmDialog />
      </>
    );
  }

  return (
    <>
      <div id="app-root" className="app" inert={inert}>
        <header className="topbar">
          <p className="brand" aria-hidden={intro}>
            Steady
          </p>
          <StatusBar />
        </header>
        <Banners />
        <div className={`workspace${demoOpen ? " with-demo" : ""}`}>
          <main className="stage" aria-label="Drawing area">
            <h1 className="sr-only">Steady drawing page</h1>
            <div className="stage-inner">
              <DrawingCanvas />
              {phase === "calibrating" && <Calibration />}
              {panel === "help" && <HelpPanel />}
              {panel === "settings" && <SettingsPanel />}
              {panel === "advanced" && <AdvancedPanel />}
            </div>
            <div className={`stage-bottom${demoOpen && !wide ? " with-demo" : ""}`}>
              <TypedCommand />
              {!wide && <DemoPanel />}
            </div>
          </main>
          {demoOpen && wide && (
            <div className="demo-column">
              <DemoPanel />
            </div>
          )}
          <aside className="side" aria-label="Controls">
            <CameraPreview />
            <ContextPanel />
            <SteadinessSlider />
            <Toolbar />
          </aside>
        </div>
      </div>
      {intro && <FirstRun />}
      <ConfirmDialog />
    </>
  );
}
