# H-AFFILIATES-DEMOGRAPHICS-001

## Ampliación autorizada — commit, push y publicación, 2026-10-05

El propietario ordena: «al terminar haz push y commit y publicalo». Autoriza publicar
este cambio focal. Se prepara checkout aislado en `.tmp/affiliates-demographics/release`
desde main remoto actualizado: la rama del workspace tiene historia divergente y
trabajos ajenos que no deben incluirse. La prueba de compatibilidad compara la fuente
publicada de Afiliados con la baseline previa, preserva todos los chunks remotos salvo
el focal y conserva exactamente HTML/SW salvo tokens de versión. Sin force-push,
reset, stash, DDL/DML productivo ni cambios de workflows/autoridades.

PRE-CHANGE AUDIT ampliado: añade scripts/package-affiliates-demographics.js y
scripts/verify-affiliates-demographics-live.js; permite adaptar los tests focales
para ejecutar contra el checkout y el bundle descargado. Mismo alcance de fuentes,
scripts, documentos y evidence; catálogo instalado sin PII en scripts/fixtures si
necesario para reproducir pruebas sin acceso remoto. Commit/push explícitos a main,
workflow Pages existente y verificación del artefacto servido. Recovery: revert focal
sobre el commit publicado, sin tocar datos. Status: PASS para preparar y verificar.

## PRE-CHANGE AUDIT

H: H-AFFILIATES-DEMOGRAPHICS-001
Objetivo: listas Género (Masculino/Femenino), Estado civil (Soltero(a)/Casado(a)/Unión Libre/Viudo(a)) y captura Número de hijos en alta y edición; retirar Tipo de empleado/Estatus de afiliación/Estatus laboral de la captura y sus tarjetas de afiliación.
Alcance: pantalla Admin Afiliados y artefacto generado; persistencia por RPC existentes.
Fuera de alcance: datos históricos, autoridades, Auth, permisos, documentos/Storage, finanzas/Google, publicación remota.
Archivos a tocar: app/screens-admin-affiliates.jsx; app/bundle.js; SutiApp.html y sw.js sólo cachebusters; scripts/test-affiliates-edit-documents-browser.js (expectativas de controles); scripts/test-affiliates-demographics-browser.js; scripts/test-affiliates-demographics-db.js; scripts/inspect-affiliates-demographics.py; scripts/build-affiliates-demographics.js; este documento; docs/AGENT_CHANGELOG.md; docs/qa/evidence/affiliates-demographics/*; docs/architecture/{SUTIAPP_ARCHITECTURE_REGISTRY,registry-code,registry-data,registry-edges,registry-search}.json si cambia mapping. Respaldos/catálogo sin PII en .tmp/affiliates-demographics/.
Datos afectados: gender_raw, marital_status_raw, children_count_raw del maestro public.affiliates. Retirar controles financieros no borra ni pone a NULL sus columnas.
Fuentes de verdad: public.affiliates (ADR-071), única autoridad antes/después.
Tablas: affiliates; affiliate_admin_events/affiliate_profile_audit_log por writers existentes, sin cambios de schema.
APIs: create_admin_affiliate / update_admin_affiliate / get_admin_affiliate_workbench por AdminAffiliatesRepository, sin modificarlo.
Legacy involucrado: ninguno; se retiran controles, no se alteran valores financieros ni cálculos.
Invariantes: identidad id/numero_control, Auth opcional, versión optimista, permisos backend, auditoría, NULL distinto de cero, ausencia de fallback.
Riesgo: valores raw históricos fuera de catálogo; conservarlos sin normalización implícita y mostrar opción histórica deshabilitada. Cantidad histórica no numérica no impide editar otro campo; nueva captura sólo dígitos o ausencia explícita.
Tests: contrato Supabase read-only actual; PostgreSQL aislado de create/update/readback y denegaciones; navegador con Repository real y backend aislado para ambos formularios, error/reintento, cero, vacío, negativos/fracciones y preservación histórica; regresión focal existente; bundle por un único módulo; revisión de diff y hashes.
Recovery: copia exacta previa local de archivos de implementación y reemplazo sólo del chunk focal; sin DDL ni DML productivo que revertir.
Status: PASS

## AUTHORITY / PLAN / RISK

SOURCE OF TRUTH AUDIT — Domain: identidad demográfica de afiliados. Authority: public.affiliates. Readers: get_admin_affiliate_workbench → AdminAffiliatesRepository → pantalla. Writers: RPC existentes con affiliates.write, actor y auditoría. Alternative sources/fallbacks: ninguno. Cache: borrador efímero React, recarga del detalle después de guardar. Verdict: SAFE.

Supabase: schema versionado ya contiene children_count_raw TEXT nullable; create/update ya lo admiten. Verificar catálogo instalado antes del cierre. No migración necesaria, no cambio de grants/RLS. La validación del formulario evita errores de captura; no cambia el contrato raw histórico del backend.

UI: conservar toolbar, búsqueda/filtros, padrón paginado, perfil y acciones, seis pestañas (Datos generales, Afiliación, Expediente, Solicitudes, Acceso, Auditoría), altas, scroll, responsive, estados loading/error/empty, documentos e interacciones. Cambios autorizados exclusivamente en campos señalados. Mostrar Número de hijos también en Datos generales para comprobar relectura.

Navigator: registry STALE por trabajo previo financiero y documentación; módulo focal no incluido entre los cambios stale. Discovery dirigido confirma pantalla, repository y schema. Amplio worktree previo conservado, ningún reset/checkout.

Regresión global: NOT APPLICABLE; ningún helper/repository compartido ni lógica global cambia. Bundle/cachebusters son GENERATED_ARTIFACT conforme AGENTS.md.

Plan: capturar baseline y catálogo read-only; editar pantalla; verificar persistencia aislada usando funciones instaladas; compilar sólo módulo focal; navegador/regresión; registrar evidencia y revisar cierre.

## VERIFY / EVIDENCE — 2026-10-05

- `python scripts/inspect-affiliates-demographics.py`: PASS contra Supabase real, transacción READ ONLY. Las tres columnas TEXT nullable existen; create/update las escriben y workbench proyecta `to_jsonb(a)`. RLS activa, cero grants directos INSERT/UPDATE/DELETE a browser, RPC SECURITY DEFINER con search_path vacío, anon denegado y permisos affiliates.read/write en backend. Cero DDL/DML productivo.
- `node scripts/test-affiliates-demographics-db.js`: PASS, PostgreSQL/PGlite aislado con definiciones create/update capturadas del catálogo instalado y hashes idénticos. Alta sin Auth, relectura, edición, cero/NULL, identidad/control, historia financiera y auditoría por actor preservados. Rechazados versión obsoleta, columna Auth, actor sin permisos y anónimo. Los resolvers de permisos/duplicados y la proyección workbench son dependencias sintéticas explícitas; no es un E2E de escritura productiva.
- `node scripts/build-affiliates-demographics.js`: PASS; sólo cambia `screens-admin-affiliates.jsx`, otros 153 chunks idénticos byte a byte. `SutiApp.html` y `sw.js` sólo cambian tokens de versión; lógica de SW idéntica. Bundle/SW v2026100410. Sin publicación remota.
- `node scripts/test-affiliates-demographics-browser.js`: PASS con Chrome, chunk generado del bundle y Repository real, backend aislado. Alta/edición, opciones exactas, enteros/negativos/fracciones/texto, cero, NULL, error/reintento, reabrir perfil, histórico fuera de catálogo y payload mínimo. Capturas 1440 y 390 px, sin overflow horizontal.
- `$env:AFFILIATES_EVIDENCE_DIR='docs/qa/evidence/affiliates-demographics/regression'; node scripts/test-affiliates-edit-documents-browser.js`: PASS. Pestañas, edición, duplicados/conflictos, motivos opcionales, archivo/restauración, documentos/upload/reemplazo, permisos, scroll independiente y botón guardar visible; 1440x900, 1100x849, 1024x768, 390x844 y 390x600. Expectativas ajustadas sólo por cambios autorizados (21 inputs, 4 selects).
- `node scripts/test-admin-affiliates.js`: FAIL PREEXISTENTE por patrón `/const belongsToAffiliate=/` en `screens-admin-finanzas.jsx`. Se reprodujo con pantalla/bundle previos mediante lectura de baseline; archivo financiero conserva SHA-256 previo. No se modifica ni se declara PASS ese test. Evidencia: `legacy-static-baseline.json`.
- Registry: intento incremental rechazado sin escribir por conjunto stale previo más amplio. No se regenera globalmente: mismo screen/repository/RPC/tablas/columnas/permisos, ninguna topología ni autoridad nueva. Mantiene STALE documentado; discovery dirigido y catálogo real sustituyen su lookup para esta H.

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin → Afiliados, alta, edición, Datos generales, Afiliación.
Original sections / Current sections: toolbar/padrón/perfil/seis pestañas/modales conservados.
Missing sections: ninguna; sólo tres entradas y dos tarjetas retiradas por solicitud expresa.
Added sections: ninguna; Número de hijos agregado en alta, edición y lectura.
Interactions preserved: PASS; pruebas de captura y regresión, scroll, errores y permisos.
Navigation preserved: PASS; mismas seis pestañas y navegación documental.
Visual structure preserved: PASS; mismos estilos/grid/componentes salvo controles solicitados.
Unauthorized redesign: NO.
Verdict: PASS.

## H-AFFILIATES-DEMOGRAPHICS-001 RESULT

Status: PASS — implementación local, sin publicación.
Files changed: pantalla focal, bundle, dos cachebusters, cuatro scripts nuevos de verificación/build más inspector read-only, expectativas del test focal, auditoría, changelog y evidencia. Manifest exacto: scope.json.
Source-of-truth verdict: PASS — public.affiliates único, columnas y writers existentes.
Invariant verdict: PASS — identidad, Auth nullable, historia, permisos, versión y auditoría conservados.
Build: PASS — un chunk recompilado, 153 preservados.
Tests: PASS focal (PostgreSQL aislado + navegador + regresión); test estático antiguo FAIL PREEXISTENTE reproducido en baseline.
Security: PASS para el alcance; catálogo real read-only y denegaciones en entorno aislado. No cambio backend ni secreto frontend.
Legacy impact: NOT APPLICABLE — cero cambio de valores financieros, Google, fórmulas, triggers o cálculos.
Unexpected files changed: ninguno; hashes comparados con estado anterior, incluyendo cambios previos ajenos.
Known limitations: frontend no publicado; sin escrituras de prueba en producción; validación de nuevos valores en formulario conserva contrato raw backend existente; Registry STALE previo documentado; test estático financiero previo obsoleto.
Evidence: docs/qa/evidence/affiliates-demographics/{supabase-readonly,database,build,browser,legacy-static-baseline,scope}.json y regression/browser-result.json; capturas sintéticas sin PII.

## ARCHITECT REVIEW

Task reviewed: H-AFFILIATES-DEMOGRAPHICS-001, alcance de implementación local autorizado por solicitud y confirmación del propietario.
Verdict: APPROVED.
What Codex did correctly: reutiliza columna y RPC existentes, cambia un único módulo, verifica payload y persistencia con definiciones reales, conserva historia al quitar controles.
Important findings: children_count_raw ya existe; no se necesita migración. Valores históricos fuera de catálogo visibles/deshabilitados; edición de otro campo no los normaliza. Cero no equivale a ausencia.
Problems detected: test estático ajeno obsoleto reproducido en baseline; no regresión focal. WORK_QUEUE_HISTORY.md no existe; WORK_QUEUE.md corresponde al plan financiero histórico y no autoriza avanzar ese plan.
Architecture implications: sin nueva dependencia compartida, endpoint, tabla ni autoridad. Registry permanece derivado/stale; no se presenta como fresh.
Source-of-truth implications: public.affiliates antes/después; sin DATA, cache persistente ni fallback.
Security implications: permisos/RLS/auditoría existentes intactos; no se confunde validación de UI con seguridad backend.
Data implications: no DML productivo ni migración; retirados de UI no borrados de Supabase.
Owner decision required: NO para este alcance local.
Recommended next action: entregar el cambio local y su evidencia, indicando expresamente que no se publicó; no avanzar tareas financieras.

### RESPONSE TO CODEX

Aprobar H-AFFILIATES-DEMOGRAPHICS-001 como implementación local. Entregar los campos solicitados y la evidencia; informar que el frontend aún no está publicado. Conservar íntegros los cambios previos y no ejecutar la cola financiera. Ninguna continuación automática autorizada por esta revisión.

SUTIAPP ARCHITECT REVIEW
Task: H-AFFILIATES-DEMOGRAPHICS-001
Verdict: APPROVED
Critical findings: ninguno para implementación local; límites anteriores explícitos.
Source of truth: PASS.
Architecture: PASS focal, sin cambio de topología.
Security: PASS dentro del alcance verificado.
Data: PASS, cero DML productivo.
Legacy: NOT APPLICABLE.
Owner decision: NO.
Next action: entrega local, sin autocontinuación.
Response generated for Codex: YES.

## Paquete de publicación revisado

Autorización posterior del propietario permite commit, push y publicación. Candidato
basado en main remoto `f233e76f3ca38775d32e1b479fc8e422ce1e47a4`; fuente de Afiliados
remota idéntica a baseline local previa. Sólo cambia un chunk, 155 chunks remotos
preservados, HTML/SW sólo cachebusters v2026100410. SHA-256 del bundle candidato:
`50091a56556ea8cae1318a90fd23bb1ee62de5cf805a7f4f5536136d7a348bd5`.

Build Pages PASS (31 archivos públicos); pruebas contra checkout remoto candidato:
release-browser/browser.json y release-regression/browser-result.json PASS. Sin
datos/env privados en staging, ni cambios de backend. Revisión de paquete: APPROVED
para publicar por workflow existente. La comprobación online queda pendiente del
despliegue; se registrará por separado sin presentar preparación como publicación.
