"use client";

import { useEffect } from "react";

/** Registers the Serwist service worker (src/app/sw.js → /sw.js). Disabled in dev,
 *  where the SW plugin is off. Failures are non-fatal — the app works without it. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // no SW — offline fallback + shell precache just won't be available
    });
  }, []);
  return null;
}
