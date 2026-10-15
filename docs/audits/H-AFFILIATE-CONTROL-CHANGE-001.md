# H-AFFILIATE-CONTROL-CHANGE-001

## Estado vigente al 2026-10-15

Backend y pantalla publicados y verificados: PASS. Commit 17d106e / v2026100421. Los apartados
BLOCKED de la etapa anterior se conservan como evidencia histórica y quedan
superados por los resultados de esta reanudación.

Catálogo: 225 tablas y 1337 constraints, sin extracción de filas productivas.
Prueba con catálogo real aislado PASS; cuatro carreras en PostgreSQL 18 PASS.
Envelope exacto de instalación y recovery compilados localmente PASS.
Migración 20261015000100 instalada en transacción: conteos y huellas de las
225 tablas existentes idénticos; cero cambios de números o filas de negocio.
La versión propuesta 20261014000100 estaba ocupada y se corrigió antes de instalar.
Verificación instalada READ ONLY PASS: administrador autorizado, ordinario/anon
denegados, sin acceso directo browser; preview real 461 ms y 74 tablas inspeccionadas.
Evidencia: catalog-test.json, concurrency.json, envelope-test.json,
backend-applied.json y backend-verified.json.

La publicación usa checkout aislado del main f26ab7b1df58619bdd6893ccb795060afd8c3cd2.
Se recompilan únicamente dos chunks de Afiliados conservando el resto publicado,
más cachebusters; no se sustituye el bundle remoto por el workspace anterior.

## Reanudación autorizada — 2026-10-15

El propietario renovó el token para continuar la activación. Acceso de gestión
restablecido. La inspección confirmó 20261014000100/20261014000200 ocupadas:
se renumeró candidato/recovery a 20261015000100 tras comprobar disponibilidad.
Se amplía el alcance a scripts/release-affiliate-control-change.py,
scripts/package-affiliate-control-change.js, scripts/verify-affiliate-control-change-live.js,
scripts/test-affiliate-control-change-catalog.js, scripts/test-affiliate-control-change-concurrency.py
y checkout aislado .tmp/affiliate-control-change/release para publicar sólo esta H.
Infraestructura PostgreSQL temporal aislada; lecturas/verificación productiva sin
mutaciones de negocio; instalación aditiva autorizada, sin cambiar números reales.

Candidato web PASS con backend real: permisos, preview, confirmación, móvil y
recarga con/sin service worker; cero llamadas de modificación (bloqueadas por test).
Build Pages PASS; 2 chunks actualizados y otros 155 publicados intactos, v2026100421.
Fallo local de espacio resuelto limpiando sólo temporales sintéticos de esta H.
La prueba de concurrencia se repitió PASS después de adaptar el runner Windows;
no se atribuyen los fallos de disco a la aplicación ni al backend.

## PRE-CHANGE AUDIT

Objetivo: permitir cambiar numero_control exclusivamente desde Admin a quien tenga
affiliates.read + affiliates.write, con previsualización real de impacto y evidencia
durable para correcciones manuales. Los afiliados no reciben esta facultad.

Autoridad: public.affiliates.id conserva la persona; numero_control sigue TEXT.
La instrucción del propietario autoriza la corrección explícita del número, no
normalización masiva, reasignación de identidad ni reescritura financiera/histórica.
Los encargados deben tener permisos backend de Afiliados; su cargo no autoriza.

Alcance previsto: RPCs aditivas de diagnóstico/cambio/historial, evidencia privada,
UI focal y pruebas aisladas. Informe por relaciones demostrables y coincidencias
exactas de número, con alcance y sistemas no inspeccionados explícitos. No se
declara inventario externo completo sin consultar esos sistemas.

Archivos autorizados en esta H:
- app/screens-admin-affiliates.jsx; app/admin-affiliates-repository.js.
- supabase/migrations/20261015000100_affiliate_control_change.sql y recovery homónimo
  (numeración provisional hasta inspección de catálogo).
- scripts/inspect-affiliate-control-change.py; scripts/test-affiliate-control-change.js;
  scripts/test-affiliate-control-change-browser.js; scripts/build-affiliate-control-change.js.
- scripts/fixtures/affiliate-control-change-schema.json (sólo catálogo, sin filas).
- docs/qa/evidence/affiliate-control-change/*; este informe.
- docs/DECISIONS.md, docs/AGENT_CHANGELOG.md, docs/SOURCE_OF_TRUTH.md,
  docs/INVARIANTS.md, docs/MIGRATION_RULES.md (secciones focales).
- docs/architecture/* (índice derivado, sólo hallazgos de esta H).
- app/bundle.js, SutiApp.html, sw.js: artefactos focales/cachebusters exclusivamente.
- .tmp/affiliate-control-change/*: baseline y pruebas locales, fuera de Git.

Fuera de alcance: cambios a filas reales, Google/Apps Script, saldos, cálculos,
documentos emitidos, solicitudes históricas, Auth global, permisos generales,
Storage, despliegue o commit de cambios ajenos existentes en el workspace.

Riesgo: alto por identidad. Antes de permitir guardar: comprobar permisos backend,
colisiones actuales e históricas demostrables, revisión vigente, actualización
atómica, actor real, historial y efectos del cambio. Sin confianza silenciosa en
el Registry STALE; se inspeccionan fuentes y catálogo actuales.

Recovery: retirar RPCs nuevas sin eliminar auditoría ni revertir cambios de negocio
posteriores. Corrección inversa de un número mediante el mismo flujo auditado;
nunca rollback masivo de datos ni borrado de evidencia.

Tests: PostgreSQL aislado, permisos anon/afiliado/lectura/admin, concurrencia/versiones,
colisiones, ceros iniciales, audit/informe durable, atomicidad, recovery, navegación
y errores de UI, regresión focal Afiliados, build focal y chunks ajenos intactos.
Regresión global: NOT APPLICABLE mientras no cambie ninguna frontera compartida
enumerada en AGENTS.md; el repositorio AdminAffiliates es focal a esta superficie.

UI: preservar lista, búsqueda, filtros, archivo/restauración, tabs general/afiliación/
expediente/solicitudes/acceso/auditoría, edición actual, carga y vistas documentales,
export, responsive y estados. Añadir acción/modal e informe, sin rediseño.

Estado: auditoría en curso. No se ha aplicado ninguna migración ni cambio de datos.

## Implementación y verificación local

2026-10-14. No cambia el permiso de ninguna persona. La nueva acción usa
affiliates.read/write y admin_module_boundary(affiliates,update). Ni afiliados
ordinarios ni encargados de otro módulo obtienen facultades implícitas.

El informe enumera claves primarias y cantidad de filas por tabla: relaciones FK
UUID de una columna hasta cuatro aristas (sin ciclos), y coincidencias exactas en
numero_control/legacy_folio/source_folio/from_numero_control/to_numero_control.
Fuentes: tablas de public y esquemas *_private; sin filas completas, importes,
emails, secretos o contenido documental. Los vínculos por UUID se conservan.
La UI indica expresamente que Google/Apps Script, contenido de archivos, JSON/texto
libre y relaciones fuera del alcance no están verificados. Por tanto no se afirma
haber localizado «todos» los registros de todos los sistemas.

El writer bloquea coincidencias actuales/archivadas, números históricos reservados,
referencias al nuevo número ajenas o sin pertenencia confirmada y accesos cuya única
certificación dependería del número anterior. No modifica la autenticación global.
Serializa con escritores de afiliados mediante lock de tabla y fila, vuelve a
consultar impacto/versión, y guarda número + versión de perfil + bitácora + informe
en la misma transacción. UUID/Auth no cambian. Idempotencia cubre respuesta perdida.
Un trigger extiende las reservas a altas ordinarias. No se añade UNIQUE al padrón.

Pruebas ejecutadas:
- `node scripts/test-affiliate-control-change.js`: PASS, 13 grupos. PostgreSQL aislado,
  denegaciones, alcance del informe, ausencia de contenido sensible, TEXT/ceros,
  colisiones, acceso certificado, revisión obsoleta, rollback ante fallo de auditoría,
  conservación financiera, retry, historia inmutable, reversión controlada y recovery.
- `node scripts/test-affiliate-control-change-browser.js`: PASS, 7 grupos. UI real y
  Repository real con fixtures aislados; revisión/confirmación, descarga, historial,
  red perdida después del commit simulado, errores, permisos, 390/1024/1440 px.
- `AFFILIATES_EVIDENCE_DIR=docs/qa/evidence/affiliate-control-change/regression`
  `node scripts/test-affiliates-edit-documents-browser.js`: PASS, 10 grupos; edición,
  documentos, permisos, motivos, identidad y cinco viewports.
- `node scripts/build-affiliate-control-change.js`: PASS; sólo 2 chunks compilados,
  152 chunks ajenos idénticos. Cachebuster 2026100412, lógica sw idéntica.
- `git diff --check` focal: PASS; sin modificación ajena al baseline de esta H.
- `python scripts/test-architecture-registry.py`: PASS (generación, freshness,
  lookup, permisos, secretos, incremental y determinismo). La regeneración inicial
  tuvo un error transitorio de apertura de registry-search.json; repetirla completó
  todos los archivos y la prueba integral confirmó su consistencia.
  El diff-check global también detecta espacios finales preexistentes en
  20260915000100_admin_assisted_context.sql; ese archivo no fue modificado por esta H.

### Bloqueo externo demostrado

`python scripts/inspect-affiliate-control-change.py`: primer intento sin acceso de
red (WinError 10013); la ejecución permitida fuera del sandbox llegó a Supabase y
devolvió HTTP 401 `Invalid access token`. No fue rechazo de auto-review.
El propietario recibió solicitud para restablecer localmente el acceso. No se
expuso la credencial, no se leyó PII y no se ejecutó DDL/DML productivo.

Catálogo instalado y numeración no verificados; rendimiento de inventario sobre
volumen productivo y concurrencia real de sesiones no probados. Fixtures de pruebas
son sintéticos y no sustituyen esas comprobaciones. No hay publicación ni commit.

### Registry y alcance final

El Registry inicial tenía 7 cambios y 65 altas ajenas stale. Su generador incremental
exige el conjunto completo de divergencias; la regeneración del índice derivado
incluye el workspace actual sin tocar las fuentes ajenas. Se amplía únicamente el
alcance del índice a esa regeneración reproducible. La nueva RPC queda explícitamente
PREPARED_NOT_APPLIED. El índice no demuestra despliegue ni equivalencia financiera.

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin / Afiliados.
Original/current sections: lista, filtros, toolbar, perfil, seis tabs, editor,
documentos, acceso, archivo/restauración y export conservados.
Missing sections: ninguna detectada.
Added sections: acción/modal de número, informe e historial descargable.
Interactions/navigation/visual structure preserved: PASS en navegador aislado.
Unauthorized redesign: NO.
Verdict: PASS local.

## Resultado histórico de la etapa inicial

Status: BLOCKED para producción; candidato y pruebas locales terminados.
Files changed: dos fuentes focales, migración/recovery aditivos, cuatro scripts,
  gobierno/Registry/evidencia; bundle + SutiApp.html/sw cachebusters generados.
Source-of-truth verdict: misma autoridad; informe derivado privado sin fallback.
Invariant verdict: TEXT/UUID/Auth/historia preservados; corrección explícita autorizada.
Build: PASS focal; 152 chunks ajenos conservados.
Tests: PASS local, 13 PostgreSQL + 7 navegador + 10 regresión.
Security: PASS aislado; catálogo y denegaciones instaladas pendientes.
Legacy impact: READ ONLY en diseño de inventario; cero escritura financiera/Google.
Unexpected files changed: ninguno por esta H; cambios previos del propietario intactos.
Known limitations: credencial inválida; schema/latencia/concurrencia live pendientes;
  alcance de reporte explícitamente parcial para sistemas externos y relaciones no declaradas.
Evidence: docs/qa/evidence/affiliate-control-change/ y comandos anteriores.

## Revisión histórica de la etapa inicial

Task: H-AFFILIATE-CONTROL-CHANGE-001.
Verdict: BLOCKED para release.
Critical findings: no evidencia del catálogo vigente ni capacidad de aplicar/verificar
  backend; no se puede declarar habilitado en producción. El informe no es exhaustivo
  fuera de relaciones/columnas consultadas y la UI lo indica antes de confirmar.
Source of truth: affiliates vigente; audit privada no sustituye maestro.
Architecture: RPCs aditivas; repositorio focal usado sólo por esta pantalla.
Security: permisos backend + módulo; no autoservicio ni grants directos de número.
Data: no backfill, no borrado; historial/reservas sobreviven al recovery técnico.
Legacy: sin reescritura de historia ni integración externa automática.
Owner decision: NO; falta acceso técnico, no otra decisión de negocio.
Next action: restablecer credencial; verificar catálogo, numeración, compatibilidad,
  alcance/performance real y carreras antes del release backend → frontend.
Response generated for Codex: YES.

### RESPONSE TO CODEX

No declares esta H publicada ni PASS productivo. Tras restablecer el acceso, ejecuta
la inspección de sólo lectura; contrasta tablas/FKs/funciones/grants y número de
migración, amplía las pruebas aisladas con catálogo real, comprueba latencia y
concurrencia. Corrige cualquier defecto dentro de esta H. No ejecutes pruebas con
filas sintéticas en producción, no cambies números reales ni historia financiera.
Antes de publicar, instala/verifica backend y conserva el frontend focal y todos
los cambios ajenos; cierra con evidencia real. No avances a otra H.


## H-AFFILIATE-CONTROL-CHANGE-001 RESULT — 2026-10-15

Status: PASS; backend y pantalla publicados y verificados.
Files changed: dos fuentes de Afiliados, bundle y cachebusters generados, migración
  20261015000100/recovery, scripts focales/catálogo, gobierno/Registry/evidencia.
Source-of-truth verdict: PASS; public.affiliates sigue siendo autoridad del número.
Invariant verdict: PASS; TEXT/UUID/Auth conservados; historia y finanzas sin reescritura.
Build: PASS Pages; v2026100421; 2 chunks cambiados y 155 publicados intactos.
Tests: PASS 13 grupos DB, 7 UI y 10 regresión; catálogo real aislado,
  cuatro carreras PostgreSQL 18, envelope/recovery y navegador candidato/publicado real.
Security: PASS backend instalado; ordinario/anon denegados, sin UPDATE directo.
Legacy impact: cero escrituras financieras/Google; inventario derivado de relaciones.
Unexpected files changed: ninguno en checkout focal; cambios ajenos del workspace intactos.
Known limitations: reporte cubre 74 tablas elegibles y marca sistemas externos,
  JSON/texto libre y relaciones no inspeccionadas. Revisión manual pendiente por diseño.
  Pruebas de guardado aisladas; no se cambió un número real como prueba productiva.
Evidence: docs/qa/evidence/affiliate-control-change/*.json y capturas sintéticas.
Commit publicado: 17d106e6e2af52b8450f62de0497a21fbbf6b8f2.
Despliegue PASS: https://github.com/David14081982/SutiApp-private/actions/runs/38744016630
Sitio verificado: https://sutiapp.com/
Bundle SHA256: 805e30304088d70da9360f468089b4700b4e90c77bd89d093c95137c7f7fd5b8.

Comandos adicionales de reanudación: inspect-affiliate-control-change.py;
test-affiliate-control-change-catalog.js; test-affiliate-control-change-concurrency.py;
release-affiliate-control-change.py --apply/--verify; package-affiliate-control-change.js;
build-pages-site.js; verify-affiliate-control-change-live.js --candidate y sin argumento.
Todos los grupos anteriores terminaron PASS. El envelope exacto apply.sql y recovery
se probaron además en PostgreSQL 18 aislado antes de instalar (envelope-test.json).
Diff focal verificado con core.whitespace=cr-at-eol para reconocer CRLF Windows.
No se publican supabase.env ni tokens privados; sólo la configuración pública del build.

La revisión automática rechazó inicialmente push a main por falta de autorización
explícita del despliegue. El propietario respondió «Sí, publicar en producción».
Se publicó entonces el commit autorizado; GitHub Pages y sus controles de Auth,
solicitudes y build terminaron success. La comprobación posterior verificó HTML y
hash exactos, vista previa autenticada, confirmación requerida, móvil, refresh y
service worker permitido/bloqueado. Cero llamadas de mutación en esas pruebas.

## CLAUDE UI PRESERVATION REVIEW — producción

Screen: Admin / Afiliados.
Original sections: lista, filtros, toolbar, perfil, seis tabs, editor, documentos,
  acceso, archivo/restauración y export conservados.
Added: acción/modal de número, informe previo e historial descargable.
Missing sections: ninguna detectada en inspección y regresión focal.
Interactions/navigation: PASS; sin rediseño no autorizado.
Responsive: PASS fixtures 390/1024/1440 y navegador real móvil 390.
Verdict: PASS.

## SUTIAPP ARCHITECT REVIEW — resultado publicado

Task: H-AFFILIATE-CONTROL-CHANGE-001.
Verdict: APPROVED.
Critical findings: solicitado y realizado coinciden: sólo Admin con permisos
  cambia número; informe identificable antes de confirmar y evidencia durable.
  El catálogo instalado y las denegaciones se comprobaron; 225 tablas conservaron
  filas/huellas. La UI publicada coincide con el bundle probado. No hay bloqueo actual.
Source of truth: affiliates maestro; bitácora privada inmutable como evidencia.
Architecture: tres RPC aditivas; sólo pantalla/repositorio focal; 155 chunks ajenos
  preservados; lógica sw idéntica. Regresión global de imágenes NOT APPLICABLE por
  alcance focal y cachebusters generados; regresión Afiliados focal PASS.
Security: autorización backend read/write + module boundary; no autoservicio.
  UUID/Auth permanecen; acceso certificado que depende del número anterior bloquea
  el cambio hasta corregir acceso. Colisiones y reservas comprobadas en concurrencia.
Data: 225 tablas conservadas al instalar; simulaciones sólo locales; historial
  y reservas sobreviven al recovery. Informe parcial explícito, sin falso inventario global.
Legacy: sin reasignación automática de registros financieros, documentos o Google.
Owner decision: NO; la publicación ya fue autorizada explícitamente.
Next action: cerrar esta H con evidencia; no avanzar a otra H ni cambiar números reales.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Aprobar H-AFFILIATE-CONTROL-CHANGE-001 y comunicar la acción publicada en Admin.
Conservar los límites visibles del informe y la revisión manual de fuentes externas.
No ejecutar correcciones de afiliados, historia ni finanzas y no iniciar otra H.
No hay continuación automática autorizada por este review.
