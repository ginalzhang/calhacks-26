"use client";

import dynamic from "next/dynamic";

// Canvas, tracking and audio are client-only (§1): never prerendered.
const SteadyApp = dynamic(() => import("./SteadyApp"), {
  ssr: false,
  loading: () => (
    <main className="loading-screen">
      <h1>Steady</h1>
      <p role="status">Loading…</p>
    </main>
  ),
});

export default function ClientApp() {
  return <SteadyApp />;
}
