/* sw.js — SutiApp service worker (offline app-shell, cache-first con actualización) */
const CACHE = 'sutiapp-v167';
const SHELL_URL = './SutiApp.html';
const CORE = [
  './',
  './SutiApp.html',
  './app/vendor/react-18.3.1/react.production.min.js',
  './app/vendor/react-dom-18.3.1/react-dom.production.min.js',
  './app/vendor/supabase-js-2.112.3/supabase.min.js',
  './app/bundle.js?v=220',
  './app/supabase-client.js',
  './app/affiliate-repository.js?v=5',
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
  // El worker nuevo sólo toma control cuando el shell completo quedó guardado.
  // Si la red falla durante la instalación, el worker vigente continúa activo.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'SUTIAPP_PURGE_OLD_CACHES') return;
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const staticCdnHosts = new Set([
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ]);
  const sameOrigin = url.origin === self.location.origin;
  const immutablePublicAsset = /\.supabase\.co$/i.test(url.hostname) &&
    /^\/storage\/v1\/(?:object|render\/image)\/public\/(?:app-assets|company-assets)\//.test(url.pathname);

  // Las navegaciones siempre intentan red. Si una red móvil corta la petición,
  // cualquier query usa el shell canónico; si tampoco existe, se responde con
  // una pantalla recuperable en vez de dejar al navegador con una hoja blanca.
  if (sameOrigin && req.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then((cache) => fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(SHELL_URL, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => cache.match(SHELL_URL).then((hit) => hit || new Response(
          '<!doctype html><html lang="es-MX"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#910022"><title>SutiApp sin conexión</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f0f3f4;color:#222;font-family:Arial,sans-serif;text-align:center"><main><h1 style="margin:0 0 12px;color:#910022;font-size:22px">No fue posible conectar con SutiApp</h1><p style="margin:0 0 20px;line-height:1.5">Revisa tu conexión e intenta nuevamente.</p><button type="button" onclick="location.reload()" style="border:0;border-radius:12px;padding:12px 20px;background:#910022;color:#fff;font:inherit;font-weight:700">Reintentar</button></main></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
        )))
      )
    );
    return;
  }

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
      .catch(() => caches.match(req).then((hit) => hit || new Response('', { status: 504, statusText: 'Offline' })))
  );
});
