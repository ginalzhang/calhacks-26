"use client";

import { useState } from "react";

/** Non-Chrome banner (§8): the target is desktop Chrome. */
export default function Banners() {
  // Client-only component (loaded with ssr: false), so navigator is available at first render.
  const [nonChrome] = useState(() => {
    const ua = navigator.userAgent;
    const chromium = /Chrome\//.test(ua) || /Chromium\//.test(ua);
    const mobile = /Mobile|Android|iPhone|iPad/.test(ua);
    return !chromium || mobile;
  });
  const [dismissed, setDismissed] = useState(false);
  if (!nonChrome || dismissed) return null;
  return (
    <div className="banner" role="note">
      <p>Steady is built for desktop Chrome. In this browser the camera, voice or sounds may not work. Please use desktop Chrome.</p>
      <button type="button" className="link-button" onClick={() => setDismissed(true)}>
        Dismiss
      </button>
    </div>
  );
}
