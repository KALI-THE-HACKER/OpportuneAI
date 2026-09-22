// OpportuneAI Service Worker — Production PWA Cache & Offline Engine
const CACHE_VERSION = "opportune-v1";
const STATIC_CACHE = `opportune-static-${CACHE_VERSION}`;
const NAV_CACHE = `opportune-nav-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.ico",
];

// Install: precache critical assets & immediately activate
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[SW] Precache asset caching partial failure:", err);
        });
      })
      .then(() => self.skipWaiting()),
  );
});

// Activate: clean up outdated cache buckets
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== STATIC_CACHE && key !== NAV_CACHE) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Fetch dispatcher
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, API endpoints, and auth flows
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/~oauth")) return;
  if (url.hostname.includes("auth0.com")) return;

  // 1. Navigation requests (HTML pages) -> Network-first with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(NAV_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootFallback = await caches.match("/");
          if (rootFallback) return rootFallback;
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
                <title>Offline — OpportuneAI</title>
                <style>
                  body {
                    margin: 0;
                    padding: 2rem;
                    background: #0A0A0F;
                    color: #FBFAF8;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    text-align: center;
                    box-sizing: border-box;
                  }
                  .card {
                    max-width: 400px;
                    padding: 2rem;
                    background: #18181B;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 1rem;
                  }
                  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
                  p { color: #A1A1AA; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
                  button {
                    background: #2563EB;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    font-weight: 600;
                    cursor: pointer;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>You're Offline</h1>
                  <p>Check your internet connection to continue browsing jobs and receiving AI updates.</p>
                  <button onclick="window.location.reload()">Retry Connection</button>
                </div>
              </body>
            </html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }),
    );
    return;
  }

  // 2. Static assets (JS, CSS, Web Fonts, Images, Icons) -> Stale-While-Revalidate / Cache-First
  const isStatic =
    url.origin === self.location.origin &&
    (/\.(?:js|css|woff2|woff|ttf|png|jpg|jpeg|gif|svg|ico|webp)$/.test(url.pathname) ||
      url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/icons/"));

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        return cached || fetchPromise;
      }),
    );
    return;
  }
});

// Listen for message events (e.g. skipWaiting trigger from client)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
