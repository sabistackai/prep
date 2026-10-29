"use client";

import { useEffect } from "react";
import { clearQueue } from "@/lib/offline-ticks";

// On the sign-in pages: forget the screens saved for offline use (cache name as in
// public/sw.js) and any unsent ticks, so the next person on this phone sees none of it.
export function ForgetOffline() {
  useEffect(() => {
    clearQueue();
    if ("caches" in window) caches.delete("prep-pages-v1").catch(() => {});
  }, []);
  return null;
}
