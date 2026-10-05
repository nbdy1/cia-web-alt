"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once per page load. Needed so reminder notifications work on
 * Android Chrome (see lib/notify.ts). Failure is non-fatal: reminders still
 * appear inside the app, only the system notification is skipped.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.warn("[SW] registration failed:", error));
  }, []);

  return null;
}
