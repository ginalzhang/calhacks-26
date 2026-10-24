"use client";

import { useEffect } from "react";
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
import DemoPanel, { QuoteCard } from "./DemoPanel";
import { AdvancedPanel, HelpPanel, SettingsPanel } from "./Panels";
import Banners from "./Banners";
import "./layout.css";
import DesktopPanel from "@/desktop/DesktopPanel";

let booted = false;


export default function SteadyApp() {
  const phase = useStore((s) => s.phase);
  const dialog = useStore((s) => s.dialog);
  const panel = useStore((s) => s.panel);
  const demoOpen = useStore((s) => s.demoOpen);
  const desktopOn = useStore((s) => s.desktopOn);

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
              <QuoteCard />
            </div>
            <TypedCommand compact />
            <DemoPanel />
            {/* Overlays cover the whole stage column so each page fits without scrolling. */}
            {phase === "calibrating" && <Calibration />}
            {panel === "help" && <HelpPanel />}
            {panel === "settings" && <SettingsPanel />}
            {panel === "advanced" && <AdvancedPanel />}
          </main>
          <aside className="side" aria-label="Controls">
            <div className="side-top">
              <CameraPreview />
              <SteadinessSlider compact />
            </div>
            <ContextPanel />
            <Toolbar />
          </aside>
        </div>
      </div>
      {intro && <FirstRun />}
      <ConfirmDialog />
    </>
  );
}
