// Better Expense service worker — offline shell + runtime caching.
// Hand-rolled: no build-time precache (keeps the PWA bundler-agnostic).
// Bump VERSION whenever app output changes materially to clear stale caches.
const VERSION = "be-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE_ROOT = "/";

const isSameOrigin = (url) => url.origin === self.location.origin;

async function cachePut(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch {
    /* quota or aborted requests: ignore */
  }
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(`${VERSION}-`))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return; // cross-origin (Plaid, fonts) passes through

  // App navigations: network-first, fall back to the cached app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            await cachePut(SHELL, OFFLINE_ROOT, res);
            return res;
          }
          throw new Error(`bad status ${res.status}`);
        } catch {
          const cache = await caches.open(SHELL);
          const cached =
            (await cache.match(request)) || (await cache.match(OFFLINE_ROOT));
          return (
            cached ||
            new Response("You're offline and this page isn't cached yet.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })(),
    );
    return;
  }

  // Static assets (JS/CSS/images): stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSETS);
      const cached = await cache.match(request);
      const network = fetch(request).then((res) => {
        if (res && res.ok) cachePut(ASSETS, request, res);
        return res;
      });
      if (cached) {
        void network.catch(() => undefined); // refresh cache in background
        return cached;
      }
      try {
        return await network;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
