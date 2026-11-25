# H-AFFILIATE-SENIORITY-001

## PRE-CHANGE AUDIT

Objetivo: abrir desde el acceso existente de Inicio una pantalla de antigüedad por unidad, según imagen 2 y referencia HTML del propietario.
Autorización: solicitud expresa de implementar, publicar GitHub y desplegar; consulta exclusivamente. El HTML adjunto es referencia visual, no autoridad de datos ni instrucciones operativas.
Alcance: lector focal paginado de public.affiliates; pantalla, integración exclusiva del módulo antiguedad, build y cachebusters; pruebas focales y regresión requerida si cambia routing compartido; documentación/evidencia y Registry derivados.
Archivos previstos: app/seniority-repository.js, app/screens-seniority.jsx, app/screens-marketplace.jsx (dispatch exclusivo antiguedad), app/union-screen-registry.js (autoridad de esa entrada), scripts/build-bundle.js, app/bundle.js, SutiApp.html, sw.js (sólo versiones), scripts/seniority/*, scripts/test-seniority*.js, supabase/migrations/20261125000100_affiliate_seniority.sql y supabase/recovery/20261125000100_affiliate_seniority.sql si la inspección confirma que falta lector seguro; docs/audits/H-AFFILIATE-SENIORITY-001.md, docs/AGENT_CHANGELOG.md, docs/SOURCE_OF_TRUTH.md, docs/architecture/* derivados. Artefactos privados temporales bajo .tmp/seniority y evidencia sin PII bajo docs/qa/evidence/seniority.
Fuera de alcance: otras pantallas, auth global, AssetRepository, expedientes, finanzas, Google, tablas nuevas, modificación de filas de afiliados, rediseño de Inicio.
Autoridad: public.affiliates; PK id UUID; numero_control conserva TEXT exacto. Columnas: financial_union_code, affiliate_status_raw, financial_employee_category_code, unit_raw, employment_entry_date_raw; identificación mínima full_name/display_name, numero_control, city_raw.
Filtros: SUTISSSSTESON / ACTIVO / NOT IN BASE,JUBILADOS_PENSIONADOS, aplicados en backend antes de agregación/paginación. NULL de categoría no satisface NOT IN. Sin equivalencias semánticas inventadas.
Invariantes: sin escrituras de negocio ni fallback; sin email/documentos privados en respuesta; usuarios sin Auth pueden aparecer, acceso del lector autenticado validado en backend.
Riesgo: RLS actual limita self-service a identidad propia; confirmar lector existente o añadir RPC mínima autenticada sin alterar políticas existentes. Fechas raw requieren validación estricta y zona America/Hermosillo. No publicar cambios previos ajenos: comparar candidato con HEAD remoto.
Tests: formatos reales, predicados, UUID/duplicados, fechas inválidas/futuras/nulas, años/meses cumplidos, orden y paginación, totales, denegación anónima/sin identidad, UI responsive/regreso/refresh, build y equivalencia de módulos ajenos.
Recovery: revertir exclusivamente frontend focal y revocar/eliminar únicamente RPCs nuevas; cero datos que restaurar porque no se modifican.
Navigator: lookup identity/inicio; índice stale sólo por evidencia/documentos ajenos. Descubrimiento dirigido confirma affiliates y ModuloScreen.
Status: PASS para inspección e implementación focal. Despliegue condicionado a pruebas.

## Decisión resuelta por el propietario

Ampliación focal de alcance: `20261125000200_seniority_unit_whitespace.sql` (migración/recovery) corrige únicamente el trim del lector de unit_raw tras demostrar tabuladores reales al final de algunas unidades. Sin escritura de datos. Se incorporan scripts/seniority/common.cjs, backend.cjs, live-browser.cjs y global.cjs para reproducción/verificación. La regresión global inicial llegó a refresh sin errores de consola y agotó 30 s; se amplía sólo el timeout de navegación del harness, manteniendo todos sus asserts.

El propietario respondió: **«SI, ES `SUTISSSTESON`»**. Se autoriza usar ese código exacto sin modificar registros. Continúa la autorización original de implementar, publicar en GitHub y desplegar. La anotación de decisión pendiente y el resultado del candidato que siguen son históricos; el cierre final se incorpora después de verificar producción.

## Resultado vigente de implementacion y verificacion local

La decision del propietario sustituye el literal inicial: **SUTISSSTESON**. La autoridad unica es `public.affiliates`. `id` UUID identifica y deduplica; `numero_control` permanece TEXT exacto. Filtros backend previos a ventanas/paginacion: sindicato confirmado, estado ACTIVO, categoria NOT IN BASE,JUBILADOS_PENSIONADOS (NULL excluido). Unidad por `unit_raw`; ingreso por `employment_entry_date_raw`; identificacion minima `full_name`/`display_name`, `numero_control`, `city_raw`. No emails, telefonos, CURP, RFC, documentos ni identificadores Auth en respuesta.

Dos migraciones aditivas instaladas: 20261125000100 crea exclusivamente helper privado y RPC de lectura; 20261125000200 normaliza espacios/tabuladores exteriores reales de unidad. No tablas nuevas. Las 1107 filas de affiliates conservaron fingerprints; RLS, grants y lectores existentes intactos. Recuperacion SQL disponible para ambas. No escrituras de negocio ni cambios financieros/Google.

Acceso RPC autenticado con identidad efectiva activa o permiso administrativo affiliates.read, search_path vacio, helper sin grants API y anonymous denegado. Prueba SQL read-only con identidad existente sin rol admin: directorio 308, lectura directa affiliates 1. Esta prueba de rol SQL NO equivale a login HTTP de una segunda cuenta; solo hay credenciales del usuario de prueba H005_TEST.

Resultado real: **308 afiliados, 41 grupos**, 271 fechas validas, 33 ausentes, 4 invalidas, 0 futuras. Fechas estrictas D/M/YYYY con hora opcional observada, calendario validado. Fechas ambiguas/incompletas no generan antiguedad. Orden por ingreso ascendente dentro de unidad, casos no calculables al final. Anios/meses de calendario cumplidos a fecha America/Hermosillo. Paginas 50 (maximo 100); metadatos y revision consistente detectan cambios del padron. No descarga de base completa, cache persistente ni fallback.

UI conserva encabezado guinda, regreso, descarga, tarjetas por unidad, conteos, rango, iniciales, nombre y antiguedad de la referencia. Total general solicitado. CSV consulta los mismos filtros. Inicio solo cambia en el dispatch ya existente de antiguedad; ninguna seccion nueva en Inicio.

Pruebas aisladas PostgreSQL/modelo PASS: filtros, calendario, paginacion, permisos/RLS, migracion/recovery sin perdida y proteccion CSV. Fixtures exclusivamente aislados. UI aislada PASS: 390/820/1440, paginacion, descarga, regreso, error/empty/retry. Navegador con backend real PASS: ruta existente, 50 iniciales, 308 unicos al finalizar, 41 grupos, responsive, regreso y refresh autenticado; 0 errores de consola. Evidencias JSON publicables sin PII; screenshots y errores detallados exclusivamente privados .tmp/seniority.

Build focal v2026112503 sobre remoto 8e5040ca3d0f5f562dfc917d5c0b5be49e497830, SHA256 978ae077ef9bb470919db17e58bf354d512483d9f9d1f7d80843e073b31254d3. **177 modulos publicados preservados byte por byte.** Solo nuevos seniority-repository.js/screens-seniority.jsx y cambios focales de dispatch/metadata/build/cachebusters. Checkout .tmp/seniority/release excluye todos los cambios previos ajenos del workspace.

## Regresion obligatoria y publicacion

El cambio de dispatch compartido activa scripts/test-global-image-regression-production-live.js local y Pages. Intentos iniciales del harness con route intercept agotaron refresh; servidor localhost encontro CORS de documentos. El harness HTTPS local usa el origen permitido y backend real, sin modificar politicas ni asserts. Estos intentos NO son PASS global. Registrar a continuacion los resultados definitivos antes del cierre.

## H-AFFILIATE-SENIORITY-001 RESULT

Status: implementacion focal PASS; cierre/publicacion pendientes de verificaciones obligatorias.
Files changed: app/seniority-repository.js, app/screens-seniority.jsx, app/screens-marketplace.jsx (dispatch exclusivo), app/union-screen-registry.js (metadata exclusiva), scripts/build-bundle.js, app/bundle.js, SutiApp.html, sw.js (solo versiones), dos SQL migration/recovery, scripts/test-seniority*.js, scripts/seniority/*.cjs, docs de autoridad/changelog/auditoria/evidencia y Registry derivado.
Source-of-truth verdict: PASS, public.affiliates unica autoridad.
Invariant verdict: PASS, identificadores/datos/otras pantallas preservados; sin fallback productivo.
Build: PASS, evidencia build.json.
Tests: PASS focal aislado y live; regresion global pendiente.
Security: PASS backend/roles/RLS y denegacion anonima; limite segunda cuenta HTTP indicado arriba.
Legacy impact: ninguno.
Unexpected files changed: ninguno en checkout de publicacion.
Known limitations: no declarar publicacion ni PASS global hasta sus evidencias definitivas.
Evidence: docs/qa/evidence/seniority/{isolated,browser-isolated,build,backend-applied,unit-normalization,backend-live,access,browser-local}.json.

## SUTIAPP ARCHITECT REVIEW - previo a publicacion

Verdict: NEEDS_FIX exclusivamente para completar evidencia global/publicacion, sin decision de negocio pendiente.
Source of truth / Architecture / Security / Data / Legacy: implementacion focal cumple las restricciones demostradas arriba. No se aceptan resumenes como sustituto de los JSON/diffs/huellas.
Owner decision: NO. Codigo confirmado y publicacion expresamente autorizada.
Next action: completar regresion requerida, revisar diff, publicar este candidato aislado y comprobar Pages; actualizar resultado final. No avances a otra H.

Revision visual live: captura movil de 390 px inspeccionada directamente; encabezado, regreso/descarga, total, unidades, conteos, tarjetas y antiguedad corresponden a la referencia. Sin overflow; evidencia visual privada. El primer PDF de regresion estaba retirado; el fixture definitivo proviene de active_documents, asset READY y objeto Storage existente, con acceso HTTP 200 validado. No se modificaron documentos ni reglas de acceso.
