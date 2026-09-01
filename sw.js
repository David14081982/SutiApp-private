/* sw.js — SutiApp service worker (offline app-shell, cache-first con actualización) */
const CACHE = 'sutiapp-v131';
const CORE = [
  './',
  './SutiApp.html',
  './app/bundle.js?v=187',
  './app/financial-legacy-repository.js?v=10',
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
  const immutablePublicAsset = /\.supabase\.co$/i.test(url.hostname) &&
    /^\/storage\/v1\/(?:object|render\/image)\/public\/(?:app-assets|company-assets)\//.test(url.pathname);

  // Los assets públicos usan rutas derivadas del SHA-256: una ruta nueva
  // representa contenido nuevo. Cache-first evita volver a transferir imágenes
  // pesadas sin convertir CacheStorage en autoridad ni incluir URLs privadas.
  if (immutablePublicAsset) {
    e.respondWith(caches.open(CACHE).then((cache) => cache.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
      return res;
    }))));
    return;
  }

  // Cache only the local app shell, explicitly known static CDNs and the
  // immutable public assets above. Supabase data APIs and private Storage stay live.
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
