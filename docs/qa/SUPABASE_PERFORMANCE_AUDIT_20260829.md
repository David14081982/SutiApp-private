# Auditoría y optimización de rendimiento Supabase — 2026-08-29

## Veredicto

`PASS` para el alcance medido: autenticación, Inicio, Convenios, Historial, Finanzas y Documentos cargan significativamente menos datos y evitan trabajo no visible. La corrección se realizó en el frontend y en su frontera de repositorios; no se modificaron schema, datos, RLS, roles, grants, RPC, Edge Functions, reglas de negocio ni cálculos financieros.

La evidencia demuestra que el cuello dominante no era “Supabase por ser Supabase” ni una consulta SQL específica: era el fan-out del cliente, consultas que arrancaban antes de que existiera una pantalla consumidora, resolución de sesión duplicada, firmas privadas N+1 e imágenes originales de varios megabytes sin caché efectiva.

## Método de medición

- Chrome real, perfil nuevo, mismo usuario controlado y mismo recorrido antes/después.
- Instrumentación CDP desde el inicio del login hasta que los stores visibles quedaron estables.
- Conteo de requests, bytes de respuesta, duración por endpoint, duplicados y visitas repetidas.
- Recorrido: login → Inicio → Convenios (ida, salida y regreso) → Historial (ida y regreso) → Finanzas (ida y regreso) → Documentos.
- Auditoría estática dirigida de los repositorios y stores restantes para localizar `select('*')`, ciclos con consultas, cargas automáticas, cachés, firmas, transforms y suscripciones realtime.
- Los milisegundos son una muestra controlada, no un SLA. En red remota existe variación; los conteos y bytes son la evidencia comparativa más estable.

Evidencia cruda: `docs/qa/evidence/supabase-performance-20260829/baseline.json` y `after.json`.

## Comparativa antes vs. después

| Indicador | Antes | Después | Variación |
|---|---:|---:|---:|
| Usuario autenticado | 3,855 ms | 1,641 ms | -57.4% |
| Shell de Inicio visible | 3,891 ms | 1,728 ms | -55.6% |
| Contenido visual listo | 3,964 ms | 2,178 ms | -45.1% |
| Contenido editorial listo | 4,352 ms | 2,179 ms | -49.9% |
| Contenido institucional listo | 4,439 ms | 2,180 ms | -50.9% |
| Carga inicial estabilizada | 5,049 ms | 2,787 ms | -44.8% |
| Requests antes del login | 32 | 4 | -87.5% |
| Requests durante login | 30 | 14 | -53.3% |
| Bytes durante login | 4,017,235 | 42,206 | -98.9% |
| Requests de carga inicial | 44 | 38 | -13.6% |
| Bytes de carga inicial | 5,738,532 | 165,982 | -97.1% |
| Apertura de Documentos | 3,533 ms / 17 requests de visita | 3,104 ms / 5 requests de visita | -12.1% / -70.6% |
| POST de firma en Documentos | 7 | 1 | -85.7% |
| Historial, primera visita | 1,907 ms / 2 requests | 916 ms / 2 requests | -52.0% |
| Historial, segunda visita | 299 ms / 0 requests | 362 ms / 0 requests | datos reutilizados |
| Convenios, primera visita | 1,877 ms / 956,531 B | 1,399 ms / 91,223 B | -25.5% / -90.5% |
| Convenios, segunda transferencia | 8,790,389 B | 0 B | -100% |

El tiempo de la segunda visita a Convenios fue 427 ms antes y 545 ms después en esta muestra, aunque la transferencia cayó a cero. Esa diferencia de 118 ms es variación de render/navegación y no se presenta como mejora. La ventaja comprobada es que ya no se vuelven a descargar 8.79 MB.

## 1. Cuellos de botella demostrados

1. Cuatro stores iniciaban su `load()` mediante `setTimeout(..., 0)` al evaluar el bundle, incluso antes del login y aunque el usuario jamás abriera sus pantallas. Esto produjo 32 requests de arranque a datos administrativos, financieros/catalogales, flujo e institucionales.
2. El sello del login consumía el store visual completo. Para mostrar una sola imagen cargaba configuración, banners, popups y empresas, incluidas imágenes originales.
3. El mismo inicio de sesión se resolvía tanto después de `signInWithPassword` como al recibir `SIGNED_IN`. Se observaron 3 `GET /auth/v1/user`, 6 RPC y 2 lecturas de `affiliates`.
4. Branding consultaba `app_settings` y después `app_assets` de forma secuencial.
5. Documentos firmaba siete rutas privadas con siete POST independientes. La suma de esas firmas fue 12,006 ms de tiempo de red acumulado.
6. El catálogo solicitaba items y relaciones de assets de forma secuencial.
7. Las imágenes públicas se servían desde el objeto original. Se midieron banners de 1.9–4.18 MB y un GIF de programa de 9.14 MB. Un banner de 3,248,354 B bajó a 546,514 B usando el transform de Supabase (860×448, calidad 80), una reducción aproximada de 83%.
8. Los assets públicos respondían `Cache-Control: no-cache`, por lo que una segunda navegación volvió a transferir 8.79 MB.

## 2. Consultas lentas

No se demostró una consulta PostgreSQL con un plan intrínsecamente lento. Los payloads de tablas fueron pequeños y la misma lectura `program_requests` pasó de 1,582 ms a 482 ms sin cambio de schema, indicio de latencia remota variable y no de un plan que justificara un índice.

Las operaciones de mayor costo demostrado fueron:

- siete firmas privadas: 12,006 ms acumulados;
- 29 descargas de imágenes originales: 22,054 ms acumulados y 5.72 MB en la carga inicial;
- fan-out de arranque: 24,020 ms acumulados entre solicitudes concurrentes no necesarias;
- assets públicos originales durante login: 3.86 MB.

Por no existir evidencia de un cuello SQL concreto, no se ejecutó `EXPLAIN ANALYZE` contra producción ni se agregaron índices especulativos.

## 3. Requests duplicados o repetidos

- Auth `/user`: 3 → 0 llamadas adicionales en la fase medida; se reutiliza el usuario de la sesión ya verificada.
- RPC de contexto/identidad en login: 6 → 3.
- `affiliates` en login: 2 → 1.
- Firma de Documentos: 7 → 1 llamada batch.
- Historial en regreso: permanece en 0 requests mediante el store en memoria existente.
- Imágenes de Convenios en regreso: la instrumentación aún observa 29 resoluciones del navegador/service worker, pero con 0 bytes de red; no se accede nuevamente a Supabase Storage.

## 4. Componentes que provocaban carga innecesaria

- `admin-cutover-store.jsx`, `fincat-store.jsx`, `flow-store.jsx` y `sindicato-store.jsx`: bootstrap global sin consumidor.
- `SutiSeal`/`useVisualContent`: el login pedía todo el contenido visual.
- `affiliate-auth.js`: resolución simultánea manual + evento Auth y pasos independientes que podían correr en paralelo.
- `AffiliateRepository.readDocuments` y `DocumentWorkflowRepository.list`: firma individual dentro del conjunto de documentos.
- `ProgramCatalogRepository`: items y links secuenciales.
- imágenes secundarias de Inicio: carga eager aunque estuvieran fuera del viewport.

## 5. Optimizaciones realizadas

- Carga lazy de los cuatro stores: sólo consultan cuando una pantalla consumidora monta; Admin conserva el gate backend y carga únicamente si está autorizado.
- Store de branding mínimo para login; el store visual completo reutiliza su promesa y se completa después de autenticar.
- Deduplicación de resolución Auth por usuario y reutilización del `session.user` conocido.
- Lectura de afiliado y contexto de impersonación en paralelo; afiliado y contexto Admin también en paralelo.
- Estado autenticado publicado antes de esperar la foto; la foto privada se incorpora progresivamente sin desmontar la aplicación.
- Branding y las dos partes del catálogo se consultan con `Promise.all()`.
- `createSignedUrls()` batch para listas privadas. Las URLs siguen siendo cortas, privadas y no se guardan en caché persistente.
- Supabase Image Transform para PNG/JPEG/WebP según el tamaño de uso: sello, cabecera, banner, popup, logo, portada, galería, directorio y editorial.
- `loading="lazy"` y `decoding="async"` sólo en imágenes secundarias; hero, cabecera y perfil mantienen prioridad.
- Cache Storage cache-first únicamente para imágenes públicas content-addressed (ruta SHA) de `app-assets` y `company-assets`.
- Sin librería nueva: los stores/promesas existentes ya proporcionaban deduplicación y retención en memoria. No se agregó React Query/SWR sin necesidad.

## 6. Archivos modificados por esta optimización

Código fuente:

- `app/admin-cutover-store.jsx`, `app/admin-repository.js`
- `app/affiliate-auth.js`, `app/affiliate-repository.js`
- `app/brand.jsx`, `app/visual-content.js`, `app/visual-repositories.js`
- `app/content-repositories.js`, `app/institutional-repositories.js`
- `app/document-workflow-repository.js`, `app/program-catalog-repository.js`
- `app/fincat-store.jsx`, `app/flow-store.jsx`, `app/sindicato-store.jsx`
- `app/screens-home-r2.jsx`, `app/ui.jsx`
- `sw.js`, `SutiApp.html` y bundle generado `app/bundle.js`

Verificación y evidencia:

- `scripts/audit-supabase-performance-browser.js`
- `scripts/test-supabase-performance-optimizations.js`
- cuatro expectativas estáticas actualizadas para reconocer firma batch, sesión conocida y bootstrap deduplicado
- Registry de arquitectura regenerado
- este reporte y `docs/AGENT_CHANGELOG.md`

El repositorio ya contenía cambios no relacionados con esta H; se preservaron y no se atribuyen a la optimización.

## 7. Caché, documentos y seguridad

- Supabase continúa como única fuente de verdad. La caché sólo contiene representaciones públicas de assets con identidad por SHA; no crea una autoridad de datos.
- No se cachean REST, RPC, Auth, Edge Functions, signed URLs ni el bucket `private-assets`.
- Los PDFs/documentos no se descargan automáticamente: se consulta metadata y se firma la URL; el archivo se descarga únicamente cuando el usuario lo abre.
- RLS sigue autorizando cada consulta. No se expuso `service_role`, no se agregó secreto al frontend y no se trasladó ninguna decisión de autorización a la UI.
- La invalidación de contenido editable continúa mediante los retries/stores existentes; un nuevo SHA produce una URL de asset distinta.

## 8. Pendientes y recomendaciones arquitectónicas

1. Algunos lectores administrativos poco frecuentes conservan `select('*')` (`marketplace-repository`, términos y configuración QR). Ya no afectan el arranque; deben estrecharse cuando se mida cada workbench y se congele su contrato de campos.
2. La búsqueda Admin de afiliados puede resolver fotografías por fila. Conviene una consulta/RPC batch de metadata + firma batch si un perfil real demuestra que esa lista es lenta.
3. El store institucional aún carga varios subdominios juntos cuando Inicio consume sólo parte de ellos. Puede dividirse siguiendo el patrón de branding si una medición por módulo justifica el cambio.
4. Finanzas revalida su snapshot Edge al regresar a la pestaña. Se dejó intacto porque forma parte del legacy financiero protegido y de la corrección contextual; cambiar TTL/invalidez requiere auditoría financiera específica.
5. Los originales grandes continúan en Storage. Los transforms evitan transferirlos a la UI, pero conviene validar peso/resolución al subir nuevos assets y convertir GIFs pesados mediante una H separada.
6. Supabase controla los headers de los objetos existentes con `no-cache`. La PWA resuelve la repetición para assets públicos SHA; fuera del service worker conviene corregir metadata mediante un proceso controlado y reversible.
7. No se implementó prefetch agresivo: quitar trabajo inicial fue más valioso. Prefetch debe agregarse por intención y sólo tras medir que no vuelve a inflar la entrada.

## Verificación

- Bundle reproducible desde 92 fuentes y sintaxis válida.
- Suite estática global: 58/58 `PASS`.
- Prueba focalizada: `PASS` (carga lazy, auth paralela/deduplicada, firma batch, transforms y caché pública privada-segura).
- Chrome real móvil: carrusel, orden, dimensiones, navegación por puntos y overflow `PASS` en 390×844 y 430×932.
- Harness real completó las seis fases auditadas y produjo baseline/after.
- Registro arquitectónico: `FRESH`.
- Sin migración ni cambio de datos. Impacto Google/Apps Script/cálculos financieros: `READ ONLY` durante la verificación, `0` cambios.

Tres harness históricos no son criterio de cierre: `test-frontend-boot-browser.js` depende de un servidor externo fijo en `localhost:8080` y expiró sin encontrar el login; `test-profile-photo-browser.js` completó login/foto/cabecera/perfil/credencial y expiró después en una expectativa Admin del usuario controlado; `test-program-catalog-browser.js` falló en su conexión/evaluación. Ninguno aportó evidencia de regresión del cambio; sus precondiciones quedan para mantenimiento de QA.
