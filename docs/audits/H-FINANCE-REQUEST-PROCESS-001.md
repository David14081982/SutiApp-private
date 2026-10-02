# H-FINANCE-REQUEST-PROCESS-001

## Ampliación autorizada: publicación — 2026-10-02

El propietario indica «hazlo» tras informar que faltan aplicar Supabase y publicar.
Autoriza esta entrega focal, su commit/push y verificación productiva. Prevalece
sobre el alcance local de abajo. Sin DML de negocio ni escrituras Google.
Archivos adicionales: `scripts/release-finance-request-process.js`, verificador
browser focal, evidencia `release-*.json` y checkout aislado
`.tmp/finance-request-process/release/`. Se empaqueta sólo el delta autorizado
sobre main actual; nunca el workspace completo. Guard exacto de definición y
número antes de SQL; transacción conserva OID/ACL/owner y huellas de datos.
Backend primero, frontend después. Recovery ya ensayado. Se verifica RPC
autenticada y UI publicada con solicitudes existentes, sin decisiones financieras.
Registry de release: sólo si el índice requiere registrar el mapping nuevo.
Status pre-change: PASS; autoridad y autorización resueltas.

## PRE-CHANGE AUDIT

Objetivo: Finanzas → Solicitudes → Solicitante muestra `Proceso` y el código
`financial_employee_category_code` vigente del afiliado de la solicitud.
Autorización: petición explícita del propietario y confirmación «si».
Alcance: proyección de lectura del detalle, celda existente y artefacto generado.
Fuera de alcance: publicación, escrituras de negocio, cambios de categorías,
cálculos, solicitudes históricas, Google, Auth, permisos y Storage.
Archivos a tocar: `app/screens-admin-finanzas.jsx`, `app/bundle.js`, cachebusters
de `SutiApp.html`/`sw.js`; migración aditiva y recovery `finance_request_process`
(numeración tras inspección de catálogo); scripts focales `finance-request-process`;
este documento, `docs/AGENT_CHANGELOG.md`, índice `docs/architecture/` si cambia
el mapping de lectura; evidencia `docs/qa/evidence/finance-request-process-20261002/`;
temporales privados `.tmp/finance-request-process/`.
Datos: lectura de `affiliates.financial_employee_category_code` mediante la FK
`program_requests.affiliate_id`; cero DML. No leer la categoría del administrador
ni sustituirla por capturas antiguas, categorías laborales raw o roles.
APIs: `get_admin_finance_request_flow_detail(uuid)` y repositorio existente.
Invariantes: INV-021/202/203/204/220; identidad, actor/contexto, banco capturado,
workflow y autorización backend conservados. Riesgo bajo, lectura aditiva.
Tests: PostgreSQL aislado (permisos, afiliado correcto, null, recovery, identidad
de campos anteriores), navegador real aislado, build/sintaxis/diff focales.
Recovery: restaurar definición anterior con guard contra deriva y revertir
únicamente este delta frontend; preservar todo trabajo previo del workspace.
Status: PASS para implementación local; ninguna aplicación/publicación implícita.

## AUTHORITY / PLAN / RISK

Authority: `public.affiliates.financial_employee_category_code` (perfil
financiero vigente); reader existente `ProgramRequestRepository.adminFlowDetail`.
Writers del padrón permanecen iguales. No nueva caché, fallback ni autoridad.
Ausencia de valor: `No registrada`; fallo del detalle conserva error/reintento.
Source-of-truth verdict: SAFE.
Legacy: SAFE CHANGE de presentación/lectura; cero acceso Google, fórmulas,
triggers o cálculos. No modifica importes, snapshots ni procesos financieros.
Supabase: añadir sólo la propiedad en la RPC autorizada ya existente; conservar
firma, OID, ACL, owner, search_path, RLS y gates. Sin exposición de secretos.
Migración: inspeccionar definición vigente y catálogo antes de numerar; guardar
backup de definición, exigir igualdad antes del cambio y probar recovery aislado.

Navigator inicial STALE: 7 changed/28 added preexistentes. Discovery dirigido
confirma pantalla, repositorio y proyección SQL; el último SQL local conocido
no proyecta la categoría. No confiar en el Registry como autoridad.
El árbol inicial contiene cambios ajenos extensos, incluidos pantalla y bundle.
Regeneración focal del módulo: otros chunks idénticos. Cachebusters son
GENERATED_ARTIFACT; sin cambio de lógica SW/repositorios/viewer compartidos,
regresión global de imágenes NOT APPLICABLE según AGENTS.md.

## Contrato UI

Pantalla: modal de solicitud. Secciones: condiciones, workflow, solicitante,
cuenta capturada, resumen, documento de autorización, documentos, expediente,
términos e historia; conservar estructura completa. Cambio autorizado: una
etiqueta y su valor. Controles, navegación anterior/siguiente, cierre, teclado,
scroll, acciones administrativas, previews, loading/error y estilos idénticos.

## VERIFY / EVIDENCE

Inspección read-only de producción: definición vigente SHA256
`18034f64806628ddbbb2234a0e4f4d46b7e537607404157d951f1c601fd6b5a7`.
Conserva el gate adicional `admin_module_boundary(array['finanzas'])`, ausente
del SQL histórico de banco; se preparó el delta contra la definición real.
Última migración instalada observada `20261001000400`; candidato
`20261002000100_finance_request_process.sql`, NO APLICADO.

Comandos y resultados:

- `node scripts/inspect-finance-request-process.js`: PASS, catálogo solamente,
  cero filas de negocio leídas/escritas; backup privado en `.tmp`.
- `node scripts/build-finance-request-process.js`: PASS, bundle 310/worker 242,
  1 módulo regenerado; resto de chunks idéntico. Cache superior al release
  documentado (bundle 309/worker 241). Sin publicación.
- `node scripts/test-finance-request-process.js`: PASS, PostgreSQL PGlite;
  seis códigos/null, afiliado por FK, solicitud asistida, denegaciones por
  Auth/permiso/módulo, banco protegido, id faltante, campos previos idénticos,
  OID/ACL/owner/search_path intactos, recuperación exacta y guard contra deriva.
- `node scripts/test-finance-request-process-browser.js`: PASS, 7 grupos;
  React y pantalla reales, datos sintéticos aislados, cero conexiones backend;
  categoría/ausencia/asistencia/navegación y códigos largos en 1440/390/320px.
  También prueba cola, fotos, filtros, búsqueda, error de lectura y reintento.
- Comparación exacta con backup del workspace: PASS; única celda autorizada
  distinta; todos los estilos, controles y handlers conservados. SQL cambia
  sólo una propiedad de `affiliate`. `scope.json` contiene el recibo.
- `git diff --check` focal: PASS.

El primer ensayo de navegador detectó una dependencia nueva ausente del fixture
histórico (`GeneratedDocuments`); el test focal carga su componente compilado
real y simula sólo la lista vacía del repositorio. Ningún cambio runtime extra.
El primer assert de recovery agregó por error un salto de línea adicional en el
test; corregido, la recuperación es exactamente igual al catálogo original.

Registry: la nueva propiedad SQL cambia el mapping técnico. Incremental rechazó
el conjunto por stale ajeno previo; regeneración completa del índice derivado
desde código real, sin tocar autoridad productiva.
`python scripts/test-architecture-registry.py`: PASS (freshness, lookup,
dependencias, permisos, pruebas, incremental, ausencia de secretos y determinismo).

### CLAUDE UI PRESERVATION REVIEW

Screen: Finanzas → Solicitudes → detalle.
Original sections / Current sections: todas las descritas en Contrato UI.
Missing sections: ninguna. Added sections: ninguna.
Interactions preserved: YES. Navigation preserved: YES.
Visual structure preserved: YES; captura sintética inspeccionada en escritorio.
Unauthorized redesign: NO. Verdict: PASS.

### H-FINANCE-REQUEST-PROCESS-001 RESULT

Status: PASS (implementación y pruebas locales; no desplegado).
Files changed: celda de `app/screens-admin-finanzas.jsx`; módulo generado en
`app/bundle.js`; cachebusters `SutiApp.html`/`sw.js`; migración y recovery
`20261002000100_finance_request_process.sql`; cuatro scripts focales; esta
auditoría, changelog, evidencia focal e índice de arquitectura derivado.
Source-of-truth verdict: SAFE, perfil vigente del solicitante por FK.
Invariant verdict: PASS; importes, workflow, cuenta histórica e identidad intactos.
Build: PASS, sintaxis del bundle completo; regeneración focal.
Tests: PASS, SQL aislado + navegador + comparación exacta de alcance.
Security: PASS aislado; Auth/permiso/módulo/grants y dato bancario preservados.
Legacy impact: ninguno; cero lecturas/escrituras Google y cero cálculo cambiado.
Unexpected files changed: ninguno por esta H; trabajo previo preservado.
Known limitations: SQL sin aplicar y frontend sin publicar; validación viva del
nuevo campo pendiente de despliegue. No se hizo una solicitud real de prueba.
Evidence: `docs/qa/evidence/finance-request-process-20261002/`.

### SUTIAPP ARCHITECT REVIEW

Task: H-FINANCE-REQUEST-PROCESS-001.
Verdict: APPROVED para el candidato local.
Critical findings: la función vigente añade gate de módulo respecto al SQL viejo;
se preserva exactamente. El workspace y el release previo difieren; no publicar
el árbol completo ni sobrescribir cambios ajenos al desplegar.
Source of truth: `affiliates.financial_employee_category_code`, sin alternativa.
Architecture: misma UI → mismo Repository → misma RPC, proyección aditiva.
Security: permisos y grants intactos; read-only, sin secretos nuevos.
Data: ningún DML/migración de filas; recovery de definición verificado.
Legacy: sin impacto. Owner decision: NO para el cambio local autorizado.
Next action: informar resultado local y estado no publicado. Un release debe
revalidar definición/número contra producción, aplicar backend antes del frontend
y publicar exclusivamente este delta; no ejecutar escritores financieros.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Aprobar la implementación local H-FINANCE-REQUEST-PROCESS-001 y comunicar que no
está desplegada. Conservar el recovery y la evidencia. No afirmar que el usuario
ya verá el cambio en producción. No avanzar a otra H por iniciativa del reviewer.
`WORK_QUEUE.md` es histórico de fases financieras, no autoriza esta publicación;
`WORK_QUEUE_HISTORY.md` no existe. La autorización de implementación procede
directamente de la petición confirmada en esta conversación.


## Release backend applied - 2026-10-02

Owner authorized publication. Migration 20261002000100 applied transactionally; all 251 request projections match their applicant category. Prior fields, OID/ACL/owner and fingerprints of affiliates/program_requests are unchanged. Business writes: 0. Public artifact build PASS (28 files); candidate bundle 310/worker 242. Frontend publication and live browser verification follow this commit.
