// FabSimple service worker. Aggressively caches static assets and the worker
// shell so a tablet on the shop floor stays usable when WiFi drops.
//
// Strategy:
//  - precache the worker shell + manifest + icons on install
//  - network-first for HTML navigations under /worker (so updates win)
//  - cache-first for /_next/static (hashed bundles → safe forever)
//  - bypass everything else (auth, API, dashboard pages need fresh data)

const VERSION = "fabsimple-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

const SHELL_URLS = ["/worker", "/manifest.json", "/icons/icon-192.svg", "/icons/icon-512.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_URLS).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Static Next.js assets — cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Worker shell navigations — network-first with cache fallback
  if (req.mode === "navigate" && url.pathname.startsWith("/worker")) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put(req, res.clone());
        return res;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        const hit = await cache.match(req) ?? await cache.match("/worker");
        return hit ?? Response.error();
      }
    })());
  }
});
