/* sw.js — SutiApp service worker (offline app-shell, cache-first con actualización) */
const CACHE = 'sutiapp-v101';
const CORE = [
  './',
  './SutiApp.html',
  './app/bundle.js?v=157',
  './app/financial-legacy-repository.js?v=6',
  './app/payroll-declaration-repository.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-maskable-512.png',
  './assets/branding/home-header-collapsed.webp',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const staticCdnHosts = new Set([
    'unpkg.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ]);
  const sameOrigin = url.origin === self.location.origin;

  // Cache only the local app shell and explicitly known static CDNs. Supabase
  // and any other cross-origin API remain governed by the live authority/RLS.
  if (url.pathname.endsWith('/app/supabase-config.js') || (!sameOrigin && !staticCdnHosts.has(url.hostname))) {
    return;
  }
  // network-first: siempre intenta la versión más reciente; usa caché solo sin conexión
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
