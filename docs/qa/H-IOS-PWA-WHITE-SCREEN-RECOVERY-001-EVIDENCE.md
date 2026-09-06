# H-IOS-PWA-WHITE-SCREEN-RECOVERY-001 — recuperación del arranque iOS

Fecha: 2026-09-06 (America/Hermosillo)  
Estado de la corrección focal: `PASS`  
Estado del gate global autenticado: `BLOCKED`

## AUDIT

Objetivo: impedir que la PWA quede en una pantalla blanca cuando una navegación móvil falla, usa una query distinta o conserva un service worker/caché anterior. La evidencia nueva corresponde a una PWA iOS en modo standalone: ya no aparece `ERR_TIMED_OUT` ni interfaz del navegador, pero tampoco existe una superficie visible de la aplicación.

Alcance aplicado:

- arranque temprano del service worker en `SutiApp.html`;
- instalación, activación y fallback de navegación en `sw.js`;
- pruebas focales de arranque, despliegue y recuperación de caché.

Fuera de alcance:

- pantallas y flujos una vez montado React;
- `app/bundle.js`, repositories, Supabase, Auth, RLS y datos;
- DNS/TLS de Cloudflare, ya corregido y validado por `H-MOBILE-CELLULAR-EDGE-DELIVERY-001`;
- Google Sheets, Apps Script, Ahorro, Préstamos y cálculos financieros.

Archivos objetivo previamente limpios: `SutiApp.html`, `sw.js`, `scripts/test-mobile-network-startup-hardening.js`, `scripts/test-mobile-network-startup-browser.js` y `scripts/test-pages-deployment.js`. Se preservó el worktree ajeno ya modificado.

## AUTHORITY

- Artefacto web y app shell: archivos versionados del build de GitHub Pages.
- CacheStorage: derivado descartable; nunca autoridad de datos.
- Datos/Auth: autoridades existentes en Supabase, sin lectura o escritura nueva.

No se añadió mock, `DATA`, `localStorage`, copia de negocio ni fallback de datos. El único fallback nuevo es un documento estático `503` que informa el fallo de conexión y permite reintentar.

## ROOT CAUSE

El worker anterior tenía dos rutas capaces de producir el blanco observado:

1. `cache.addAll(CORE).catch(() => {})` convertía un precache incompleto en una instalación exitosa y permitía activar un worker con caché vacía.
2. Ante un fallo de red, el handler general terminaba en `caches.match(req)`. Para una navegación con query o sin coincidencia exacta, esa promesa podía resolver `undefined`; `respondWith()` quedaba sin respuesta válida y una PWA standalone mostraba una hoja blanca.

Además, el registro del worker ocurría después de todos los scripts de aplicación y no fijaba `updateViaCache: "none"`. El `sw.js` público se entrega con `Cache-Control: max-age=14400`, por lo que una actualización podía depender del caché HTTP del dispositivo. La nueva opción obliga a consultar el worker vigente y mantiene un registro compatible como fallback para navegadores antiguos.

## IMPLEMENT

- Caché incrementada a `sutiapp-v153`.
- Instalación atómica: el worker sólo ejecuta `skipWaiting()` después de que todo `CORE` se guardó; si falla, continúa el worker anterior.
- Activación atómica: la limpieza de cachés antiguas termina antes de `clients.claim()`.
- Navegaciones same-origin separadas del handler de assets:
  - red primero;
  - escritura del HTML exitoso bajo `SHELL_URL` canónico;
  - fallback a ese shell ignorando la query de navegación;
  - respuesta HTML `503`, con fondo visible y botón `Reintentar`, cuando tampoco existe shell.
- Assets sin red y sin caché ahora devuelven `504` explícito, no `undefined`; los `onerror` del HTML muestran el guard de arranque.
- Registro del worker antes de React con `updateViaCache: "none"` y fallback compatible.
- `controllerchange` recarga una sola vez únicamente cuando la página ya inició controlada por un worker anterior; la primera visita no interrumpe captura ni login.
- Los tests dejaron de fijar `sutiapp-v149`; derivan la versión actual de `sw.js` y cubren caché vieja, query offline y caché vacía.

Commit publicado: `65f82c16dfc2a46b1a89717251dc5e7870a8824c`.  
Workflow GitHub Pages: `34038607513` — `success`.

## VERIFY

### Focal y build

- `node scripts/test-mobile-network-startup-hardening.js`: `PASS`.
- `node scripts/test-pages-deployment.js`: `PASS`, 22 archivos, sin archivos privados.
- `node scripts/test-claude-ui-preservation.js`: `PASS`.
- Build de Pages con configuración pública productiva: `PASS`, 22 archivos.
- Browser focal local:
  - Chromium móvil: carga, login y fallo controlado `PASS`;
  - WebKit móvil: carga, login y fallo controlado `PASS`;
  - caché `sutiapp-v148` eliminada y `sutiapp-v153` activa;
  - navegación `?prueba=movil` sin red: superficie visible, no blanco;
  - caché activa eliminada + origen desconectado: respuesta de recuperación y botón visibles, no blanco.

### Producción

- GitHub Actions desplegó `65f82c1` correctamente.
- `https://sutiapp.com/sw.js`: `200`, `sutiapp-v153`, `SHELL_URL` y rama `req.mode === 'navigate'` presentes.
- `https://sutiapp.com/` y `?prueba=movil`: WebKit/iPhone 13 y Chromium móvil `PASS`, login visible y sin envío de credenciales.
- Verificación pública del worker en ambos motores: controlador `/sw.js`, `sutiapp-v153` única caché, caché vieja purgada, fondo `rgb(240, 243, 244)`, body visible y cero errores JavaScript.

### Gate global obligatorio

`scripts/test-global-image-regression-production-live.js` se ejecutó contra build local con backend productivo y contra `https://sutiapp.com/`. En ambos casos llegó al login, pero no pudo iniciar la matriz porque `H005_TEST_EMAIL/H005_TEST_PASSWORD` responde `INVALID_CREDENTIALS`; la fase permanece `unauthenticated` con el mensaje `Correo o contraseña incorrectos.`. `scripts/test-affiliate-login-production-live.js` reproduce el mismo bloqueo sin depender del cambio de service worker.

Por INV-173 no se declara `PASS` para la matriz global de assets. No se alteraron credenciales, identidad, Auth ni datos para forzar el gate. Las pruebas focales y públicas anónimas sí demuestran el objetivo de esta H.

### Suite global estática

`node scripts/test-static-suite.js`: 85/99 pruebas `PASS`; 14 fallos preexistentes o ajenos al alcance. Entre ellos hay aserciones fijas de versiones anteriores (`bundle.js?v=200/205`, `sutiapp-v151`), un test que exige `_site` no construido, módulos Admin/ownership ya divergentes y la misma credencial H005 inválida. El test focal actualizado pasó dentro de la suite. No se modificaron esos dominios.

### Seguridad, datos y legacy

- No se expuso ni cambió secreto alguno.
- Supabase/Auth/RLS: sin cambio.
- CacheStorage no contiene respuestas de APIs de datos ni Storage privado; conserva la frontera previa.
- Cloudflare continúa `Full (strict)` y sirve el nuevo artefacto.
- Google/legacy financiero: `NOT APPLICABLE`.
- Architecture Registry: `STALE` por cambios previos masivos del worktree; no se regeneró para evitar incorporar trabajo ajeno.

## EVIDENCE

```text
H-IOS-PWA-WHITE-SCREEN-RECOVERY-001 RESULT
Status: BLOCKED — corrección focal desplegada y PASS; certificación global autenticada bloqueada por credencial H005 inválida
Files changed: SutiApp.html; sw.js; scripts/test-mobile-network-startup-hardening.js; scripts/test-mobile-network-startup-browser.js; scripts/test-pages-deployment.js; este documento
Source-of-truth verdict: PASS — el build sigue siendo autoridad y CacheStorage es derivado descartable
Invariant verdict: PASS focal / BLOCKED INV-173 — la matriz autenticada no pudo comenzar
Build: PASS — 22 archivos
Tests: PASS focal WebKit/Chromium/local/producción; BLOCKED global image regression por INVALID_CREDENTIALS preexistente
Security: PASS — sin secretos, Auth, RLS o datos modificados
Legacy impact: NOT APPLICABLE
Unexpected files changed: ninguno por esta H; worktree previo preservado
Known limitations: gate global de imágenes pendiente de restaurar una credencial controlada válida; Registry previamente stale
Evidence: commit 65f82c1, workflow 34038607513, curl, Playwright WebKit/Chromium y pruebas focales versionadas
```
