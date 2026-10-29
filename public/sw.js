// PREP service worker: shows push notifications, opens the app at the right page,
// and keeps the nanny's screens available offline (ticks made offline are queued by
// the page itself, see src/lib/offline-ticks.ts).
//
// Registered as /sw.js?cache=1 in production builds only; in development nothing is
// cached so code changes show up straight away.

const CACHING = new URL(self.location.href).searchParams.get("cache") === "1";
const STATIC = "prep-static-v1";
const PAGES = "prep-pages-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !CACHING || ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

const OFFLINE_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PREP</title><body style="font-family:system-ui,sans-serif;background:#f4f5fb;color:#1b1f3b;padding:32px 20px;max-width:420px;margin:auto">
<h1 style="font-size:24px">You're offline</h1><p>Open PREP again when you have signal. Screens you've opened before still work offline.</p>
<p><a href="/nanny" style="color:#25307a;font-weight:700">Try tonight's prep</a></p></body>`;

// Signed-in nanny screens worth keeping offline (not the login or setup pages).
const isNannyPage = (url) => url.pathname === "/nanny" || /^\/nanny\/(tasks|alerts|notifications)$/.test(url.pathname);
const isLoginPage = (url) => url.pathname === "/login" || url.pathname === "/nanny/login";
const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || /^\/(icon|badge|favicon|apple-touch)/.test(url.pathname);

// Save the other nanny tabs once too, so every tab opens offline, not just ones
// visited. Visiting a tab online refreshes its copy.
const NANNY_TABS = ["/nanny", "/nanny/tasks", "/nanny/alerts"];
function warm(except) {
  return caches.open(PAGES).then((cache) =>
    Promise.all(
      NANNY_TABS.filter((path) => path !== except).map((path) =>
        cache.match(path).then(
          (hit) =>
            hit ||
            fetch(path)
              .then((res) => res.ok && !res.redirected && cache.put(path, res))
              .catch(() => {}),
        ),
      ),
    ),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!CACHING || request.method !== "GET" || url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    // Build files have unique names, so a cached copy never goes stale.
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  if (request.mode !== "navigate") return;

  if (isLoginPage(url)) {
    // Signed out: forget the saved screens so the next person can't see them.
    event.waitUntil(caches.delete(PAGES));
    return;
  }

  if (isNannyPage(url)) {
    // Fresh when online; the last copy when not.
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            event.waitUntil(caches.open(PAGES).then((cache) => cache.put(url.pathname, copy)).then(() => warm(url.pathname)));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(url.pathname, { cacheName: PAGES })
            .then((hit) => hit || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
        ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "PREP", body: "", link: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      data: { link: data.link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.link || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(target).then((w) => (w ?? open).focus());
      return self.clients.openWindow(target);
    }),
  );
});
