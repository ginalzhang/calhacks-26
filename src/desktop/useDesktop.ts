"use client";

import { useSyncExternalStore } from "react";
import { desktop, OFF_SNAPSHOT, type DesktopSnapshot } from "./bridge";

/** React view of the Desktop-mode bridge (re-renders only on discrete changes). */
export function useDesktop(): DesktopSnapshot {
  return useSyncExternalStore(desktop.subscribe, desktop.getSnapshot, () => OFF_SNAPSHOT);
}
