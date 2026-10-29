"use client";

import { useEffect } from "react";

// Offline caching only in production builds (see public/sw.js).
const SW_URL = process.env.NODE_ENV === "production" ? "/sw.js?cache=1" : "/sw.js";

export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(SW_URL).catch((err) => console.error("[PREP] service worker", err));
    }
  }, []);
  return null;
}
