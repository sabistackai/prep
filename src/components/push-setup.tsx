"use client";

import { useCallback, useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestNotification } from "@/app/push/actions";

type State = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const btn = "min-h-12 rounded-xl px-5 text-sm font-semibold transition disabled:opacity-50";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true);
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Explains notifications, asks permission only when tapped, saves the device and offers a test.
export function PushSetup({ audience }: { audience: "nanny" | "parent" }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    const sub = Notification.permission === "granted" ? await currentSubscription() : null;
    if (sub) {
      // Re-save on every visit so the server always has this device.
      savePushSubscription(sub.toJSON() as never, navigator.userAgent).catch(() => {});
      return setState("on");
    }
    setState("off");
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        }));
      await savePushSubscription(sub.toJSON() as never, navigator.userAgent);
      setState("on");
    } catch (err) {
      console.error("[PREP] push setup", err);
      setMessage("Couldn't turn on notifications. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      await sendTestNotification();
      setMessage("Sent. It should arrive within a few seconds, even with PREP closed.");
    } catch {
      setMessage("Couldn't send the test. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    const sub = await currentSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setBusy(false);
    setState("off");
  }

  const why =
    audience === "nanny"
      ? "PREP sends tomorrow's checklist every evening, reminders before activities, and new tasks from Madam or Oga."
      : "PREP tells you when everyone is ready, and warns you if prep misses the deadline.";

  return (
    <div className="space-y-4">
      {state === "checking" && <p className="text-muted">Checking this phone…</p>}

      {state === "ios-install" && (
        <div className="space-y-3">
          <p>On iPhone, notifications only work once PREP is on your home screen:</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Tap the <strong>Share</strong> button at the bottom of Safari.
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
            </li>
            <li>Open PREP from the new icon on your home screen and come back to this page.</li>
          </ol>
          <p className="text-xs text-muted">Needs iOS 16.4 or newer.</p>
        </div>
      )}

      {state === "unsupported" && (
        <p className="text-warn">
          This browser can&apos;t receive notifications. On Android, open PREP in Chrome. On iPhone, use Safari and add
          PREP to your home screen.
        </p>
      )}

      {state === "denied" && (
        <div className="space-y-2">
          <p className="text-warn">Notifications are blocked for PREP on this phone.</p>
          <p className="text-sm text-muted">
            Open your browser&apos;s settings, find Site settings → Notifications, allow this site, then come back here.
          </p>
        </div>
      )}

      {state === "off" && (
        <div className="space-y-4">
          <p>{why}</p>
          <p className="text-sm text-muted">Your phone will ask for permission. Tap Allow.</p>
          <button type="button" onClick={turnOn} disabled={busy} className={`${btn} w-full bg-lime text-lime-ink`}>
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
        </div>
      )}

      {state === "on" && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-semibold text-lime">
            <span className="grid size-5 place-items-center rounded-full bg-lime text-xs text-lime-ink">✓</span>
            Notifications are on for this phone
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={test} disabled={busy} className={`${btn} border border-line bg-raised`}>
              Send test notification
            </button>
            <button type="button" onClick={turnOff} disabled={busy} className={`${btn} text-muted hover:text-ink`}>
              Turn off
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
