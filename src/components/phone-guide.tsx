"use client";

import { useEffect, useState, type ReactNode } from "react";

// Step-by-step settings so notifications arrive with PREP closed. Menu names differ
// between phone models and software versions, so steps name the usual path and a
// fallback (search Settings).

type Phone = "transsion" | "samsung" | "android" | "iphone";

const PHONES: { id: Phone; label: string }[] = [
  { id: "transsion", label: "Tecno, Infinix, itel" },
  { id: "samsung", label: "Samsung" },
  { id: "android", label: "Other Android" },
  { id: "iphone", label: "iPhone" },
];

const B = ({ children }: { children: ReactNode }) => <strong className="font-bold">{children}</strong>;

const installAndroid = (
  <>
    In Chrome, tap the <B>⋮</B> menu, then <B>Add to Home screen</B> or <B>Install app</B>. Open PREP from the new
    icon from now on.
  </>
);
const notificationsAndroid = (
  <>
    Open <B>Settings → Apps → Chrome → Notifications</B> and make sure they&apos;re on. If PREP shows up in the apps
    list too, do the same for PREP.
  </>
);
const dataSaver = (
  <>
    If you use Data saver: <B>Settings → Network (or Connections) → Data saver</B> → <B>Unrestricted data</B> → turn
    on Chrome.
  </>
);

const STEPS: Record<Phone, ReactNode[]> = {
  transsion: [
    installAndroid,
    notificationsAndroid,
    <>
      Let Chrome run in the background: <B>Settings → Battery</B> (on some phones <B>Power Marathon</B> or{" "}
      <B>Battery Lab</B>) → <B>App power saving</B> or <B>App battery management</B> → <B>Chrome</B>. Choose{" "}
      <B>Don&apos;t restrict</B>, or turn off <B>Auto-manage</B> and turn on <B>Auto-launch</B>, <B>Secondary launch</B>{" "}
      and <B>Run in background</B>. Can&apos;t find it? Search Settings for &quot;battery&quot;.
    </>,
    <>
      Open the <B>Phone Master</B> app → <B>Auto-start management</B> (or <B>App auto-start</B>) and turn on Chrome.
    </>,
    <>
      Lock Chrome in recent apps so phone cleaning doesn&apos;t close it: open your recent apps, then pull down on the
      Chrome card or tap its <B>lock</B> icon.
    </>,
    dataSaver,
  ],
  samsung: [
    installAndroid,
    notificationsAndroid,
    <>
      <B>Settings → Apps → Chrome → Battery</B> → choose <B>Unrestricted</B>.
    </>,
    <>
      <B>Settings → Battery → Background usage limits</B>: make sure Chrome is not in <B>Sleeping apps</B> or{" "}
      <B>Deep sleeping apps</B>.
    </>,
    dataSaver,
  ],
  android: [
    installAndroid,
    notificationsAndroid,
    <>
      <B>Settings → Apps → Chrome → Battery</B> → choose <B>Unrestricted</B> or <B>Don&apos;t optimise</B>. Can&apos;t
      find it? Search Settings for &quot;battery optimisation&quot;.
    </>,
    dataSaver,
  ],
  iphone: [
    <>
      In Safari, tap <B>Share</B>, then <B>Add to Home Screen</B>. Always open PREP from that icon. Needs iOS 16.4 or
      newer.
    </>,
    <>
      <B>Settings → Notifications → PREP</B>: turn on <B>Allow Notifications</B> and <B>Lock Screen</B>.
    </>,
    <>
      If you use a Focus such as Do Not Disturb or Sleep in the evening, add PREP to its allowed apps.
    </>,
    <>Low Power Mode can delay notifications. Turn it off during prep time if alerts come late.</>,
  ],
};

export function PhoneGuide() {
  const [phone, setPhone] = useState<Phone>("transsion");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setPhone("iphone");
    else if (/samsung|SM-[A-Z]/i.test(ua)) setPhone("samsung");
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Many phones close apps in the background to save battery, which stops notifications. Pick your phone and do
        each step once.
      </p>
      <div role="group" aria-label="Your phone" className="flex flex-wrap gap-2">
        {PHONES.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={phone === p.id}
            onClick={() => setPhone(p.id)}
            className={`min-h-11 rounded-full border px-4 text-sm font-bold ${
              phone === p.id ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-text"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <ol className="space-y-3">
        {STEPS[phone].map((step, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-extrabold tabular-nums">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        Then tap <B>Test with the phone locked</B> above. If the test arrives, you&apos;re set.
      </p>
    </div>
  );
}
