# ICON_INSTALLATION SUPABASE AUDIT

Fecha: 2026-08-21. Alcance: Admin → Ícono e instalación, Home/PWA y únicamente la infraestructura visual H-007.2.

## Estado encontrado antes del cambio

| Elemento | Clasificación inicial | Evidencia |
|---|---|---|
| Ícono de app | LOCAL + HARDCODED | `image-slot brand-app-icon`; SVG/sello visual de respaldo; PWA estático separado |
| Sello institucional | LOCAL + HARDCODED | `image-slot brand-seal` y SVG embebido |
| Nombre / corto / descripción | LOCAL + HARDCODED | `suti.branding.v1` en `localStorage`; manifest/HTML separados |
| Instalación 1/2/3 | LOCAL | `image-slot brand-install-1/2/3`; persistencia potencial de `.image-slots.state.json` |
| Vista previa | LOCAL | derivada del store y `ImageSlotAPI` locales |
| Favicon / PWA | OTHER | archivos estáticos con procedencia H-007.2, sin configuración Supabase única |

## Contrato final y trazabilidad

| UI/control | Repository | Tabla/campo | asset_key actual | Bucket/path actual | Consumidor runtime |
|---|---|---|---|---|---|
| Ícono de app | `BrandingRepository`/boundary `AssetRepository` | `app_settings.app_icon_asset_id` → `app_assets` | `brand.pwa.512` | `app-assets/branding/6d/6d356a86610879d9f72294916fed45a5e7f61ff70e1788b5c5114f65a5df76b4.png` | Admin preview, Home InstallButton |
| Sello institucional | mismo | `institutional_seal_asset_id` | `brand.institutional-seal` | `app-assets/branding/84/84b179dab5c69c13ceb11220b525df3eaf85ce9fe92c5294749f039a1ed2ce8a.svg` | `SutiSeal`, Admin |
| Nombre de app | `BrandingRepository` | `app_settings.app_name` | N/A | N/A | Admin, Home, manifest y HTML derivados |
| Nombre corto | mismo | `app_settings.short_name` | N/A | N/A | Admin y manifest derivado |
| Descripción | mismo | `app_settings.description` | N/A | N/A | Admin, Home y manifest derivado |
| Instalación 1 | mismo | `install_screen_1_asset_id` | reservado `pwa.install-screen-1`; actualmente NULL | no configurado | Admin posición 1 |
| Instalación 2 | mismo | `install_screen_2_asset_id` | reservado `pwa.install-screen-2`; actualmente NULL | no configurado | Admin posición 2 |
| Instalación 3 | mismo | `install_screen_3_asset_id` | reservado `pwa.install-screen-3`; actualmente NULL | no configurado | Admin posición 3 |
| Vista previa | mismo | misma fila/relaciones | no crea key | no crea objeto | Admin; proyección de app_name/description/app_icon |
| Favicon/PWA 192 | mismo + sync de build | `favicon_asset_id`, `pwa_icon_192_asset_id` | `brand.favicon-pwa-192` | `app-assets/branding/a1/a1230054f17ed5ceb9625a32935599d305473219604ea95af8dea35ac98821f0.png` | `icon-192.png`, HTML, manifest, SW |
| Apple Touch | mismo + sync | `apple_touch_asset_id` | `brand.pwa.apple-touch` | `app-assets/branding/9a/9a74b331d2a267c968999f0fb2c02cf9d83ac8cd064faaf6ff52a2054c1661df.png` | `icon-180.png`, HTML, SW |
| PWA 512 | mismo + sync | `pwa_icon_512_asset_id` | `brand.pwa.512` | ruta 6d anterior | `icon-512.png`, manifest, SW |
| PWA maskable | mismo + sync | `pwa_maskable_512_asset_id` | `brand.pwa.maskable-512` | `app-assets/branding/03/036d39221e87ca5d70c432a276ff27abbce400cf51dfdb786de3cb2264baac79.png` | `icon-maskable-512.png`, manifest, SW |

`app_assets`/Storage decide archivos; `app_settings` decide textos y relaciones. Los archivos PWA raíz son copias derivadas necesarias antes de cargar React y se verifican por SHA-256 mediante `scripts/sync-icon-installation.py`.

## Escritura, seguridad y prueba reversible

- El navegador sólo puede leer. `app_settings` tiene RLS forzada, policy pública `SELECT`, 0 grants y 0 policies cliente de escritura. Storage tiene 0 policies H-007.2 de escritura.
- El Admin actual es simulado; por ello upload/reemplazar/quitar desde la pantalla está deliberadamente bloqueado. Habilitarlo exige principal administrativo real y autorización backend/RLS.
- El proceso server-side probó `app_icon`, `institutional_seal`, `install_1`, `install_2`, `install_3` y `favicon` con un SVG temporal: upload Storage PASS, fila `app_assets` PASS, dos lecturas públicas PASS, persistencia PASS, restauración de todos los valores de negocio PASS y eliminación de fila/objeto temporal PASS.
- Las pantallas 1/2/3 continúan NULL porque no se proporcionaron assets autoritativos; no se inventaron.
- Chrome headless confirmó lectura real en Home/Admin, imágenes Storage, textos exactos, orden 1/2/3, inputs deshabilitados, recarga de sesión y ausencia de `image-slot` en el módulo.

## Evidencia

- `node scripts/test-icon-installation.js` — PASS.
- `python scripts/test-icon-installation-live.py` — PASS: singleton 1, RLS 1, write grants 0, write policies 0, Auth 3.
- `python scripts/sync-icon-installation.py --verify --verify-static` — PASS: 5 assets configurados, hashes Storage PASS, estáticos sincronizados.
- `python scripts/sync-icon-installation.py --test-write-restore --verify` — PASS.
- `node scripts/test-h005-browser.js H005_TEST` — PASS para Home/Admin, sesión/logout y regresiones H-005–H-007.3.

## Límite pendiente

La lectura y el canal administrativo server-side son productivos. La edición interactiva desde la pantalla permanece bloqueada correctamente hasta implementar Auth administrativa real; no se abrirá escritura pública para simular productividad.

## Revisión arquitectónica

`sutiapp-architect-reviewer`: **APPROVED** para el alcance ejecutado. La fuente de verdad única, recuperación, prueba reversible, RLS, ausencia de secretos/fallbacks, sync PWA y regresiones están evidenciadas. La edición interactiva no recibe `PASS`: permanece como bloqueo externo explícito por falta de Auth administrativa real. No existen `WORK_QUEUE.md` ni metadata Git; por ello no se autoriza ni inicia otra tarea.
