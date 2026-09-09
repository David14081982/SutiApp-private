# H-AFFILIATES-EDIT-DOCUMENTS-001

## Continuación: publicación autorizada

El propietario ordenó «HAZLO» después de informarle que faltaba publicar. Esa
instrucción autoriza publicar esta corrección; reemplaza la limitación de despliegue
del alcance inicial. PRE-CHANGE AUDIT ampliado: checkout aislado desde origin/main;
aplicar sólo el diff de la pantalla ya probado, regenerar únicamente su chunk en el
bundle publicado y actualizar su cachebuster. Incluir pruebas/evidencia focales.
Archivos adicionales: `scripts/test-affiliates-edit-documents-production.js` y JSON
de publicación en la carpeta de evidencia. Sin cambios backend, Storage, SW ni datos.
Verificar diff contra main, compatibilidad backend, build, workflow Pages, bytes
servidos y controles del editor/catálogo en sesión Admin de prueba. Recovery:
revertir el commit focal y publicar desde el mismo workflow si hay regresión.
Status: PASS para ejecutar la publicación expresamente solicitada.

### Preflight de publicación

Base remota: `39580205d80c6659cad5c17d99e6a6553ac820af`. Checkout limpio y parche
exclusivamente de esta H; se preservó el manejo de Archivo que ya tenía producción.
El builder publicado contiene 113 fuentes (el workspace de desarrollo tiene 116).
Tras normalizar únicamente CRLF/LF, el único chunk diferente es Afiliados. El
diff de producción comprende pantalla, bundle, cachebuster, pruebas y evidencia.
Navegador focal sobre este checkout: PASS en cinco viewports. Compatibilidad Auth,
contrato de solicitudes y build público: PASS (`release-preflight.json`).

El test histórico `test-admin-affiliates.js` de esta base remota tiene una aserción
obsoleta sobre `const belongsToAffiliate=` en Finanzas (línea 80). Ambos archivos
son idénticos a origin/main y quedan fuera del diff; no se modifica Finanzas para
satisfacerla. El PASS de ese script en la implementación inicial corresponde al
workspace original. La publicación usa las pruebas focales reales de esta H.

PRE-CHANGE AUDIT
Objetivo: permitir guardar información y cargar/reemplazar documentación desde Afiliados.
Alcance: formulario, accesibilidad de acciones, validación, mensajes y selección de documento en la pantalla existente.
Archivos a tocar: app/screens-admin-affiliates.jsx; app/bundle.js (GENERATED_ARTIFACT); SutiApp.html (solo cachebuster si corresponde); scripts/test-affiliates-edit-documents-browser.js; scripts/test-affiliates-edit-documents-live.js; docs/qa/H-AFFILIATES-EDIT-DOCUMENTS-001.md; docs/qa/evidence/affiliates-edit-documents-20260909/*; docs/AGENT_CHANGELOG.md.
Fuera de alcance: schema, RLS, repositories compartidos, service worker, Auth, financieros, Google, datos históricos y despliegue.
Datos afectados: ningún registro persistente por la corrección; pruebas sintéticas aisladas y transacción con ROLLBACK para comprobar writers existentes.
Authority: public.affiliates para perfil; affiliate_documents/document_types/private_assets/Storage privado para expediente. Sin cambio de autoridad.
APIs: update_admin_affiliate; register_admin_affiliate_document; list_admin_affiliate_documents; document-access existentes.
Permisos: affiliates.write; documents.read/write; backend valida actor, objetivo, versión/motivo y archivo.
Invariantes: numero_control/Auth intactos; VERIFIED se preserva mediante nueva versión; historial no se borra; cero fallbacks.
Riesgo: accesibilidad/scroll; errores ocultos; duplicación accidental de submits; selección cruzada de afiliado al cargar.
Tests: navegador real con fixtures y viewport escritorio/móvil; contrato estático existente; RPC reales transaccionales sin cambios persistidos; build y diff del baseline.
Recovery: restauración selectiva de hunks desde baseline; nunca revertir cambios ajenos.
Status: PASS para implementación local.

TASK ARCHITECTURE CONTEXT
Registry: lookup afiliados FRESH; discovery dirigido confirmó screen -> AdminAffiliatesRepository -> RPCs existentes. Sin nueva dependencia ni autoridad.

SOURCE OF TRUTH AUDIT
Readers: screens-admin-affiliates -> AdminAffiliatesRepository; preview delega DocumentWorkflowRepository.
Writers: RPC administrativas existentes con motivo y auditoría. Datos de formulario solo memoria efímera.
Alternative sources / fallbacks / persistent caches / conflicts: ninguno introducido.
Verdict: SAFE.

SCREEN CONTRACT
Se conservan padrón, filtros, exportación/alta, selección, seis tabs, encabezado, archivo/restauración, perfil y todos los campos, documentos/preview, métricas, navegación a workbenches y estados loading/error/empty.
Corrección autorizada: acciones de guardar/cancelar accesibles, motivo obligatorio explícito, acceso directo al reemplazo por tipo, sin eliminar componentes.

DATABASE MIGRATION AUDIT
No migración ni schema. Prueba SQL aislada en transacción con ROLLBACK sobre fixture nuevo; no mutar afiliados históricos ni objetos Storage reales.

## Diagnóstico e implementación

El formulario deshabilitaba Guardar hasta llenar un motivo de ocho caracteres y colocaba ambos controles al final de 27 campos. El expediente colocaba la carga después de todas las tarjetas y no ofrecía reemplazo individual. Las RPC vigentes sí guardaron perfil y documentos en la prueba transaccional; no se demostró un defecto backend que justificara modificarlas.

Se separó el pie del editor del área desplazable, conservando todos los campos. El motivo tiene validación explícita con foco; errores de duplicado, permisos y conflicto de versión preservan el borrador. La carga aparece antes de las tarjetas; cada documento permite reemplazo con afiliado y tipo fijados. Durante un envío se bloquean cambios y cierre accidental. El backend continúa creando una nueva versión y preservando los documentos verificados.

## SUPABASE SECURITY REVIEW

Scope: uso de permisos/writers existentes, sin cambio backend.
Auth/business identity: UUID objetivo explícito; control y Auth intactos.
RLS/grants: sin modificación; RPC probadas bajo rol authenticated, principal sin autorización denegado.
Frontend exposure: cero secretos nuevos; evidencia sin PII ni URLs firmadas.
Cross-user access: prueba de cambio a segundo afiliado conserva el destino correcto de la carga; preview/navegación conservan el contexto.
Audit: UPDATE y ADMIN_REPLACEMENT_UPLOAD comprobados con motivo; versión obsoleta rechazada.
Verdict: PASS focal.
Limitación: metadata Storage sintética en ROLLBACK; no subida física nueva ni certificación global de Storage.

## CLAUDE UI PRESERVATION REVIEW

Screen: Afiliados.
Original/current sections: padrón, filtros, exportación/alta, selección, seis tabs, encabezado, archivo/restauración, perfil, expediente/métricas, solicitudes, acceso y auditoría.
Missing sections: ninguna.
Added controls: reemplazo individual; encabezado y ayuda del editor.
Interactions preserved: 27 campos, motivo, confirmar/cancelar, preview, carga y navegación al workbench con afiliado explícito.
Scroll: campos desplazables; motivo, error y acciones permanecen fuera del área desplazable.
Visual structure: paridad de campos contra baseline; cinco viewports sin desbordamiento horizontal.
Unauthorized redesign: NO.
Verdict: PASS.

## VERIFY / EVIDENCE

Carpeta: `docs/qa/evidence/affiliates-edit-documents-20260909/`.

| Verificación | Resultado |
| --- | --- |
| `node scripts/test-affiliates-edit-documents-browser.js` | PASS, `browser-result.json`: guardado, motivo, conflicto, duplicado, busy, reintento, readback, reemplazo, hash, MIME inválido, permisos, tipo ausente, segundo afiliado, preview y navegación. |
| Viewports | 1440×900, 1100×849, 1024×768, 390×844 y 390×600; `edit-*.png`. |
| `node scripts/test-affiliates-edit-documents-live.js` | PASS, `live-result.json`: RPC reales bajo authenticated; readback, identidad, auditoría, motivo, conflicto, reemplazo, VERIFIED inmutable, denegaciones y rollback. |
| `node docs/qa/evidence/affiliates-edit-documents-20260909/live-ui-check.js` | PASS, `live-ui-result.json`: bundle local con backend real; sesión Admin, Guardar visible, catálogo de 13 tipos; sin guardar perfil ni archivo. |
| `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js` | PASS, 116 fuentes; comparación contra bundle previo: sólo cambia `screens-admin-affiliates.jsx`. |
| `node scripts/test-admin-affiliates.js` | PASS, contrato existente. |
| Build de sitio | PASS, `build-result.json`; no publicado. |
| `git diff --check` focal | PASS. |
| Registry | Inicial FRESH; STALE posterior esperado por hashes del screen/pruebas/evidencia. Sin nuevas rutas, dependencias, permisos, RPC o autoridades; no se regenera por cambios de interacción. |
| Regresión global imágenes | NOT APPLICABLE: no se modificaron repositorios compartidos, viewer, Storage, Auth, routing o SW. Bundle/cachebuster = GENERATED_ARTIFACT focal. |

Los primeros intentos de prueba se corrigieron: fixture de estado consultaba directamente la tabla bajo RLS; conflicto vigente devuelve PT409; el selector exacto del select incluía sus opciones; un comando PowerShell degradó un acento del selector. El build requiere Babel por las fuentes JSX existentes. Los resultados finales corresponden a las pruebas corregidas.

## H-AFFILIATES-EDIT-DOCUMENTS-001 RESULT

Status: PASS — implementación y verificación local.
Files changed: pantalla Afiliados; bundle generado; cachebuster 237→238; dos scripts focales; evidencia y bitácora.
Source-of-truth verdict: SAFE, sin cambio.
Invariant verdict: PASS, historia/identidad/motivo/auditoría conservados.
Build: PASS, bundle y sitio local.
Tests: PASS, navegador aislado, RPC transaccionales, lectura real y contrato existente.
Security: PASS focal, permisos backend conservados.
Legacy impact: NOT APPLICABLE, sin Google ni cálculos financieros.
Unexpected files changed: ninguno atribuible a esta H; cambios previos conservados.
Known limitations: no publicado; sin subida física nueva a Storage ni cambio persistente de expediente real.
Evidence: carpeta anterior, capturas sintéticas, JSON de resultados, baseline y diff focal.

## SUTIAPP ARCHITECT REVIEW

Task: H-AFFILIATES-EDIT-DOCUMENTS-001, corrección local.
Verdict: APPROVED para el alcance implementado y probado.
Critical findings: Guardar explica el motivo obligatorio; carga/reemplazo accesibles antes de una lista larga. Backend existente comprobado con rollback.
Source of truth: intacta.
Architecture: sin dependencias ni writers nuevos.
Security: permisos reflejados en UI y autorizados en backend.
Data: sin cambios persistentes ni pérdida histórica.
Legacy: fuera de alcance.
Owner decision: NO para esta corrección local.
Next action: entregar archivos y evidencia para publicación; no afirmar despliegue ni carga física certificada.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Aprobar la corrección local de H-AFFILIATES-EDIT-DOCUMENTS-001. Entregar el resultado indicando que falta publicarlo. Conservar trabajo ajeno e historia. No iniciar otra H ni publicar por inferencia de WORK_QUEUE: la cola vigente pertenece al MASTER PLAN; `WORK_QUEUE_HISTORY.md` no existe y no se ha invocado task-orchestrator.
