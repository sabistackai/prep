"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.error("[PREP] service worker", err));
    }
  }, []);
  return null;
}
