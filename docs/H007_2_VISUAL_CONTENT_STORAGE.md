# H-007.2 — Empresas, contenido visual y Supabase Storage

## Resultado ejecutivo

H-007.2 hizo cutover de los assets visuales migrables a `public.app_assets` + Supabase Storage sin resolver ni duplicar los 27 catálogos bloqueados de H-007.1. Se descubrieron 138 referencias, todas descargaron y validaron por firma/MIME; 128 binarios únicos se almacenaron y 10 referencias reutilizaron contenido por SHA-256. Google permaneció `READ ONLY`.

La única fila de `Empresas Suticompras` es un registro de prueba incompleto (`prueba 2`) que coloca una URL de imagen en la columna de teléfono. No se promovió como empresa real: `companies` quedó en 0 filas y ese subdominio, únicamente, permanece `BLOCKED_SOURCE_QUALITY`.

## Fuentes acotadas

- Live Google: `Anuncio principal!A1:L2`, `Banner SutiCompras!A1:F14`, `Promociones!A1:E88`, `Empresas Suticompras!A1:AB2` y `Convenios2!A1:I46`.
- Snapshot H-007 inmutable: Directorio, Minutas, documentos institucionales y programas informativos ya autorizados.
- Build local: `icon-180.png`, `icon-192.png`, `icon-512.png` e `icon-maskable-512.png`.
- Snapshot H-007.2 SHA-256: `A677797640D181E42770204A5E1249D77CE6270989AEFCD8FC25644188ED56D3`.

No se inspeccionaron ni modificaron Apps Script, fórmulas, transacciones, ahorro, préstamos, fondos, amortizaciones, saldos, rendimientos o conciliaciones.

## Modelo y Storage

Tablas: `app_assets`, `asset_sources`, `companies`, `company_assets`, `banners` y `popups`. `asset_sources` conserva las URLs históricas y no tiene lectura para browser. `category_raw` y `company_raw` preservan texto histórico; no crean catálogo ni FK catalogal.

Buckets públicos, justificados por el contenido importado:

| Bucket | Objetos | Contenido |
|---|---:|---|
| `app-assets` | 82 | branding, banners, popups e imágenes institucionales públicas |
| `company-assets` | 34 | 35 referencias visuales de Convenios, preservadas sin vínculo empresarial inventado |
| `documents` | 12 | PDFs institucionales públicos |

No se importó contenido privado. Cada bucket limita tamaño/MIME. `anon` y `authenticated` tienen solo lectura; no existen grants ni policies H-007.2 de escritura cliente.

## Reconciliación

| Concepto | Resultado |
|---|---:|
| Referencias descubiertas/descargadas | 138/138 |
| Objetos únicos subidos/verificados por SHA-256 | 128/128 |
| Referencias deduplicadas | 10 |
| Fallas | 0 |
| Registros `app_assets` READY | 128 |
| Registros de procedencia | 138 |
| Banners Home | 10 activos |
| Banners Marketplace | 13 preservados, deshabilitados hasta su cutover |
| Popups | 3 preservados, deshabilitados por falta de semántica de activación/audiencia |
| Empresas | 0 destino / 1 fila fuente no migrable |
| Referencias visuales Convenios preservadas | 35 / 34 objetos únicos |
| Imágenes institucionales únicas | 53 |
| Referencias PDF vinculadas | 13 |
| PDFs únicos almacenados | 12 |
| Assets branding/PWA | 4 |

Los 30 miembros del directorio permanecen; 27 tienen imagen Storage vinculada y los demás muestran placeholder. Minutas enlaza 5/5 documentos, documentos institucionales 8/8 y programas informativos 17/17 imágenes primarias.

## Runtime y UI

- Home usa `BannerRepository` y muestra un banner real desde Storage, con loading/error controlado y sin fallback hardcodeado.
- Directorio, Minutas, Normas/Formatos y Finanzas informativa resuelven imágenes/PDF mediante `AssetRepository`; sus repositories ya no seleccionan las URLs históricas.
- `PopupRepository` es la autoridad runtime; hoy devuelve 0 porque los tres candidatos están deshabilitados. No se inventó audiencia.
- `CompaniesRepository` está listo, pero devuelve 0 por calidad de fuente. No se usa `companyStore` como sustituto.
- Favicon/PWA conserva copias estáticas necesarias antes de React; las cuatro copias están registradas y versionadas por hash en Storage.
- SVG/componentes técnicos de UI permanecen en código; no fueron convertidos a PNG.

Persisten Glide/localStorage en áreas aún no migradas —Convenios, Marketplace, noticias y paneles administrativos—, pero no sirven como fallback en las áreas H-007/H-007.2 conectadas.

## Seguridad, recovery y evidencia

La migración es `20260821000300_create_visual_content_storage.sql`; su recovery explícito elimina únicamente tablas/columnas/buckets H-007.2. El importador usa `SUPABASE_SECRET_KEY` solo en proceso administrativo y `SUPABASE_ACCESS_TOKEN` para schema; ninguna credencial entra en browser, bundle, documentación o logs.

Evidencia: `scripts/test-h0072.js`, `scripts/test-h0072-live.py`, importador reproducible y prueba Chrome real integrada en `scripts/test-h005-browser.js`.

## Revisión arquitectónica

`APPROVED`. El registro/Storage es autoridad única en las áreas conectadas, la procedencia no funciona como fallback, las fronteras RLS y de secretos fueron verificadas y Google/legacy financiero permanecen intactos. Empresas, activación de popups y cutover de Marketplace/Convenios quedan como bloqueos aislados de fuente o semántica, no como fallas de los assets reconciliados.
