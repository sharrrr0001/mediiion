/*
 * Medicos service worker — offline app shell for the patient PWA (spec §8).
 * - /_next/static/*: cache-first (immutable, hashed file names).
 * - Patient page navigations (/p/*): network-first, falling back to the cached shell when offline.
 * - NEVER caches /api/* — patient data is fetched live and never stored by the service worker.
 */
const VERSION = 'medicos-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === 'navigate' && url.pathname.startsWith('/p/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Page HTML contains no patient data (it is loaded from /api in the browser).
          if (res.ok) caches.open(PAGES).then((c) => c.put(url.pathname, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match('/p/home')) || Response.error()),
    );
  }
});
