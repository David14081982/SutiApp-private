# H-RENTA-CAR-CASH-001 — auditoría previa, implementación pendiente

## Actualización autorizada 2026-10-22 — implementación

Ampliación técnica antes de edición: `app/operations-store.jsx` debe reconocer la proyección `rental` para mostrar «Renta Car · Contado» y conservar el detalle en Historial; el resto de las ramas conserva su cálculo. `supabase.env` ignorado recibe exclusivamente el token que el propietario proporcionó, sin incorporarlo a código/evidencia. Los scripts temporales de construcción/captura y nuevos tests están cubiertos por `.tmp/renta-car/` y `scripts/test-renta-car*.js`.

El propietario resolvió las preguntas: periodo continuo inclusivo; reserva al aprobar Finanzas, liberada al cancelar; fecha límite de pago igual a entrega, liquidación antes de entregar; contrato aún inexistente, conservar valores definidos y estado explícito pendiente. G/Plazo cambia de 0 a **1**. J es fecha de envío del usuario, nunca fecha de aprobación. Estos valores prevalecen sobre las secciones históricas inferiores.

Alcance ampliado antes de editar: módulo aislado `app/renta-car.jsx`; integración condicional en `app/screens-catalogo.jsx`, `app/screens-admin-finanzas.jsx`, `app/screens-historial.jsx`; incorporación en `scripts/build-bundle.js` y artefacto `app/bundle.js`; migración y recovery `supabase/{migrations,recovery}/20261022000100_renta_car_cash.sql`; proyección focal en `supabase/functions/financial-legacy/request-google-sync.js` y puente `google-apps-script/financial-handoff/Code.gs` sólo si encabezados verificados exigen número/fecha de pago fuera de A:AG; extensión focal documental en renderer/layout y pantalla Documentos y Firmas para los valores de renta, sin inventar texto; pruebas `scripts/test-renta-car*.js`; herramientas/evidencia bajo `.tmp/renta-car/` y `docs/qa/evidence/renta-car/`; actualización normativa de `docs/{SOURCE_OF_TRUTH,DECISIONS,AGENT_CHANGELOG}.md` y Registry derivado si cambia arquitectura. No modificar autenticación, Storage, viewers ni repositories compartidos de documentos.

Autoridad de reservas: solicitudes Renta Car aprobadas en `program_requests`, con fechas/snapshot inmutables y validación serializada backend; ninguna agenda paralela. Catálogo sigue siendo autoridad de tarifa; total se recalcula server-side antes de confirmar y se congela. RPCs derivan afiliado/actor de sesión y permisos administrativos existentes. Recovery conserva toda solicitud/reserva histórica y revoca nuevos writers si hay actividad. Riesgo alto por concurrencia/aprobación/exportación: exigir pruebas SQL aisladas de guards, idempotencia, solapamiento, autorización y recuperación; pruebas de UI/fechas y regresiones de programas no-renta. Build y verificación proporcional antes de publicar. Status previo a implementar: PASS para decisiones de negocio; aplicación de migración condicionada a integridad/recuperación demostradas.

Fecha: 2026-10-21. Autoridad: instrucciones del propietario en esta conversación.

## PRE-CHANGE AUDIT

- Objetivo: separar exclusivamente Renta Car del financiamiento por nómina; calendario, expediente vigente, resumen y contrato completos, firma en app, PDF para firma original, aprobación en Finanzas e historial.
- Alcance de esta etapa: inspección de código y configuración productiva en modo de lectura; este documento y artefactos diagnósticos temporales bajo `.tmp/renta-car/`.
- Fuera de alcance: cambios de otros programas, correcciones de históricos, solicitudes de prueba productivas, nuevas cláusulas contractuales redactadas por el agente.
- Archivos a tocar en esta etapa: `docs/audits/H-RENTA-CAR-CASH-001.md`; diagnóstico temporal `.tmp/renta-car/` si resulta necesario. No se autoriza por este documento ninguna migración sin su auditoría técnica y recuperación.
- Datos afectados: ninguno en esta etapa. Las lecturas remotas no modifican solicitudes, tarifas, reservas ni configuraciones.
- Fuentes de verdad: catálogo `program_catalog_items`; identidad `affiliates`; solicitudes `program_requests`; configuración y documentos `document_private`; Google como proyección del registro de solicitudes.
- Riesgo: cobrar como financiamiento, permitir solapamientos, aceptar importe manipulable desde frontend, inventar texto contractual, alterar otras modalidades o reescribir históricos.
- Recovery: retirar únicamente este documento/artefactos nuevos; no se modifica código ni estado de negocio.
- Status: DECISION REQUIRED para las reglas de fechas/reservas y texto contractual aún no identificados. Auditoría en curso, H no cerrada.

## Instrucciones aprobadas del propietario

1. Conservar catálogo, galería y navegación de Renta Car.
2. Mostrar calendario de disponibilidad; impedir fechas anteriores a hoy.
3. Sumar tarifa diaria por días elegidos: 2 días × $2,500 = $5,000.
4. Continuar a la pantalla existente de Documentos, después a resumen con días, tarifa, total y contrato completo con identidad y entrega.
5. Conservar firma digital dentro de la app, excluyéndola del PDF/documento físico para firma original.
6. Enviar a Finanzas y usar, tras aprobación, el documento asignado a Renta Car en Documentos y Firmas.
7. Pago de contado antes de entrega; sin fondo financiero ni plazos de financiamiento. Mantener registro e historial.
8. Proyección expresamente corregida por el propietario en su segundo mensaje:

| Columna de Historial de solicitudes | Valor Renta Car |
| --- | --- |
| E · Fondo | Renta Car |
| F · Tasa | 0 |
| G · Plazo | 0 |
| H · Monto a solicitar | 0, con presentación monetaria $0.00 |
| I · Total a Pagar | Total de contado por los días elegidos |

Número de pagos: 1. Fecha final de pago requerida por el primer mensaje; regla exacta pendiente. No confundir Plazo=0 con Número de pagos=1. No introducir Renta Car como fondo de crédito.

## Evidencia técnica

- `python scripts/generate-architecture-registry.py check`: STALE, 6 modificados y 13 añadidos; `lookup renta --compact`: sin dominio/indexación específica. Se realizó discovery dirigido.
- `app/fincat-store.jsx`: tarjeta `renta` → Renta Car.
- `app/screens-catalogo.jsx`: el detalle de producto conecta actualmente a `ProgramProductPaymentFlow` para productos Supabase no vendidos, salvo Farma/contacto directo.
- `app/screens-program-product-payment.jsx`: consulta Caja Chica, calcula enganche/financiamiento, reutiliza requisitos y términos de `prestamo`, envía `confirmProgramPayment`.
- `supabase/functions/financial-legacy/index.ts`: apertura/cotización/confirmación `programPaymentSession*`; snapshots y recálculo backend de financiamiento. No existe flujo de renta por días en este código.
- `supabase/functions/financial-legacy/request-google-sync.js`: `buildRequestRegisterRow` proyecta Fondo/Tasa/Plazo/Monto/Total. Actualmente Plazo deriva de paymentCount; requiere separación explícita para Renta Car.
- `google-apps-script/financial-handoff/Code.gs`: destino `SutiApp Final`, hoja `Historial de solicitudes`, sheetId 10616270. Writer vigente limitado a A:AG y cambios de estado; localizar encabezados de número/fecha de pago antes de ampliar esa frontera, sin tocar fórmulas por inferencia.
- `supabase/migrations/20260831000500_universal_program_product_payment_simulator.sql`: writer/approval original de productos; debe contrastarse con definiciones instaladas antes de modificar.
- `supabase/migrations/20260928000100_document_generation_core.sql`: captura al evento de aprobación; configuración autoritativa por programa/tipo.
- `supabase/migrations/20260928000300_document_layout_designer.sql`: versiones inmutables y activación de distribuciones documentales.

Lecturas Supabase Management API con `read_only:true`, HTTP 201:

- Un vehículo vigente: Nissan Urvan 2023, tarifa catalogada 2500, `PAYROLL_FIXED`, habilitado, no vendido.
- Cero filas de `program_terms_versions` para `program_id='renta'`.
- Asignación documental `renta` / `PROGRAM_FINANCING_APPROVAL` a plantilla `PROGRAMAS FINANCIEROS`, versión 1.
- Distribución activa versión 1, dos páginas, campos financieros, calendario de pagos y firmantes; sin elementos `TEXT` con cláusulas de arrendamiento.
- Sin tablas cuyo nombre coincida con rent/booking/reserv en schemas consultables. Esto no prueba ausencia de una agenda externa; no se inventaron reservas ni disponibilidad.
- PDF base descargado mediante `document-generation / ASSET_ACCESS` con sesión administrativa existente y URL efímera; sin exponer tokens/rutas. Lectura local con PDF.js: una página titulada `SOLICITUD DE PRESTAMO`, campos de banco/cuenta/CLABE, monto, intereses, total y número de pagos. No se identificó texto de contrato de arrendamiento en el contenido extraído. Artefacto local ignorado: `.tmp/renta-car/assigned-template.pdf`. No hubo generación ni escritura de solicitudes; el acceso documental puede registrar su auditoría técnica habitual.

El workspace tiene numerosos cambios previos del usuario/otras H, incluidos catálogo, repositorios, documentos, finanzas, bundle y Google. No se restauran ni sobrescriben.

## Contrato visual a preservar

Detalle: galería/ampliación, regreso, favoritos, nombre, precio, descripción e información. Insertar calendario específico de Renta Car. Documentos: expediente, progreso, tarjetas, vista y reemplazo, estados y CTA. Resumen: reemplazar solamente para renta los campos de financiamiento por días/tarifa/total/entrega/contrato; conservar firma y envío. Mantener loading/error/reintento y scroll accesibles.

## Decisiones consultadas, aún sin respuesta

- Periodo continuo contando ambos extremos frente a días separados.
- Fecha final de pago: día de entrega como límite previo, u otra regla indicada por el propietario.
- Reserva/bloqueo: al enviar la solicitud o al aprobar Finanzas.
- Ubicación/texto autorizado del contrato de renta. PDF base verificado: formulario de préstamo, no contrato de arrendamiento.

Las preguntas no reabren la tarifa ni los valores E:I ya autorizados. No solicitan permiso rutinario para implementar; identifican semántica de negocio y contenido contractual faltantes.

## Verificación requerida para implementación

Auditar y declarar archivos definitivos antes de editarlos; snapshot íntegro de solicitudes e identidad; recálculo backend; fechas en America/Hermosillo; exclusión concurrente de reservas; idempotencia; aislamiento entre afiliados; aprobación backend; contrato sin firma del solicitante en PDF; plantilla asignada; paridad visual; total 2×2500; E:I exactos y pagos=1 independiente de plazo=0; no escrituras en otras solicitudes/programas. Probar recuperación preservando reservas/solicitudes históricas. Aplicar regresión global si se modifican helpers compartidos según AGENTS.md. No declarar PASS con componentes pendientes.

## Estado de entrega

No hay implementación, build ni despliegue de esta H. Lecturas de auditoría completadas parcialmente; sin cambios productivos. No es un cierre ni una aprobación arquitectónica.


## Candidato aislado y alcance de publicaci?n

Se prepar? `.tmp/renta-car/release` desde main `bb0846df77a697663c4c7cba2e1a7ae56fb20b75`, aplicando s?lo los cambios de Renta Car; no se publica el bundle del workspace que contiene trabajo ajeno. `SutiApp.html` y `sw.js` admiten exclusivamente actualizaci?n del identificador de cach? generado; ninguna l?gica de routing, Auth, Storage o service worker cambia. Los m?dulos Edge se respaldaron desde producci?n: document-generation v19 y financial-legacy v62. Se preservan byte a byte todos los m?dulos salvo renderer/layout y la proyecci?n focal request-google-sync; se conserva la dependencia publicada savings-eligibility.ts sin editarla. Los candidatos y transporte est?n bajo `.tmp/renta-car/edge/` y `.tmp/renta-car/edge-release.js`.

La compilaci?n bundleOnly pas? para ambos Edge y no cambi? sus versiones. Los 7 PDFs previos son byte id?nticos y las 15 proyecciones no-renta son id?nticas. La prueba de UI usa ?nicamente fixtures sint?ticos, preserva UnifiedDocumentPhase y SignaturePad reales. La regresi?n global pas? en GitHub Pages y contra el build local aislado con hash verificado, sirviendo exclusivamente archivos est?ticos desde el origen permitido; backend, Auth, assets, SW y documentos son reales. El intento en localhost fallaba por CORS de document-access: no se cambi? ALLOWED_APP_ORIGINS ni se falsificaron respuestas del backend.

Revisi?n autom?tica: el primer preflight fue rechazado por falta de evidencia de seguridad transaccional. Tras 17 tests aislados, revisi?n de permisos/conteos (430 solicitudes, 16 MB, cero rentas) y l?mites lock_timeout=1s/statement_timeout=15s con hash fijo, el preflight fue admitido, compil? y ejecut? ROLLBACK. Ninguna solicitud fue creada. La versi?n posterior de pruebas incluye 18 checks y captura real del evento documental con ausencia de configuraci?n.

Google: encabezados verificados; G/Plazo es n?mero de pagos (1), sin columna adicional. J toma created_at del env?o. Fecha final de pago se conserva en snapshot y Observaciones Z, dado que no hay columna dedicada. No se modifica Apps Script, AH:AL, f?rmulas ni hist?ricos. Las 6 reservas aprobadas de la hoja antigua ya terminaron antes del 13 de julio de 2026; no se migran ni alteran.


## H-RENTA-CAR-CASH-001 RESULT ? 2026-10-22

Status: BLOCKED (production installation requires explicit owner authorization imposed by automatic approval review).
Files changed: dedicated app/renta-car.jsx; conditional integrations in catalog, Finance, history, document assignments, operations-store; bundle builder and generated bundle; dedicated migration/recovery; rental-only Google projection and document renderer/layout additions; focused tests/audit/evidence and source/decision entries. Isolated release also prepares generated cache identifiers in SutiApp.html/sw.js, preserving their logic. Exact hashes: docs/qa/evidence/renta-car/prepared-release.json.
Source-of-truth verdict: PASS ? program_requests owns request/reservation; catalog owns tariff; immutable snapshots own agreed identity/conditions; Google is projection; document configuration owns future template. No parallel authority or production fixture.
Invariant verdict: PASS in isolated SQL (18 checks), release parity and read-only schema inspection. Existing business rows untouched. G/Plazo=1 is the sole payment-count column.
Build: PASS ? root bundle 155 modules; isolated publication bundle 158 modules based on current main; Pages 31 public files. Publish only isolated release to avoid preexisting workspace changes.
Tests: PASS ? 18 SQL checks, 20 existing document tests, browser calendar/documents/signature path, literal 5000 PDF, exclusion of applicant signature, 7 existing PDFs byte identical, 15 non-rental register projections identical. Global regression PASS on existing GitHub Pages and isolated local build on permitted origin, with live backend/assets, fullscreen, refresh and with/without SW. Evidence includes verified local bundle hash.
Security: PASS for scoped guards, auth/effective affiliate, admin capability/module boundary, no-affiliate denial, no browser direct insert/update grants, FORCE RLS private metadata, immutable submissions and zero secret inclusion. Live preflight executed rollback only.
Legacy impact: rental projection only E/F/G/H/I/J and observation Z; A:AG width unchanged. No Google/Apps Script/formula/historical changes. No production test request submitted.
Unexpected files changed: no unrelated file edits by this H. Workspace has extensive prior changes; global whitespace check reports preexisting admin_assisted_context.sql whitespace. Isolated release diff --check PASS. Derived registry regeneration may include preexisting source changes; never treat it as deployment evidence.
Known limitations: contract/template intentionally pending by owner instruction; no actual rental submission/approval or Sheets append performed in production. Supabase migration, Edge deployment and frontend publication NOT applied. Local raw localhost regression is denied by existing CORS; final local static build was tested on the permitted origin without replacing backend responses or altering CORS.
Evidence: docs/qa/evidence/renta-car/ and docs/audits/H-RENTA-CAR-CASH-001.md.

Automatic review rejected permanent apply: ?Aplica permanentemente una migraci?n en Supabase de producci?n con bloqueo exclusivo y cambios de esquema/RLS; la solicitud de la funcionalidad no autoriza expl?citamente este cambio productivo exacto.? User must explicitly authorize migration 20261022000100, the two scoped Edge deployments, and isolated frontend publication. Next action after authorization: recheck remote/schema baselines, run hash-bound apply.py (1s lock wait, 15s statement timeout, identical business-row fingerprints), deploy the compiled candidates without secret changes, publish isolated reviewed sources, verify RPCs/read-only production UI and global regression. Do not create test requests in production without authorization to retain them.


## Autorizaci?n de publicaci?n ? 2026-10-22

El propietario respondi? a la solicitud expl?cita de instalaci?n productiva: ?haz comith push y publica?. Se autoriza aplicar la migraci?n 20261022000100, desplegar los dos candidatos Edge ya compilados y hacer commit/push/publicaci?n del paquete aislado de Renta Car. Se conserva la recuperaci?n y la verificaci?n de invariancia hist?rica. No se autoriza por ello crear solicitudes sint?ticas en producci?n. El bloqueo de aprobaci?n de la etapa anterior queda resuelto por esta instrucci?n; los resultados finales de despliegue se registrar?n separadamente.


## Publication authorized; backend installed — 2026-10-22

The preceding BLOCKED/prepared-release records are historical. The owner's explicit publication instruction resolved the approval requirement. Migration 20261022000100 is installed; before/after fingerprints of all 431 business requests are identical. No business rows were added. document-generation v20 and financial-legacy v63 are deployed and their active source hashes match the reviewed candidates; secrets and verify_jwt are unchanged. Evidence: migration-applied.json and the two *-deploy.json files. Frontend commit/push and live verification are the remaining publication steps. The actual rental contract remains pending by explicit owner decision.


## H-RENTA-CAR-CASH-001 RESULT — published 2026-10-22

Status: PASS. Supersedes all earlier preparation/authorization states in this audit.
Files changed: 50 scoped files in commit c3ca644; final evidence/governance/derived registry follow in documentation-only commit. Existing document test expectation updated from 7 to 8 document types. No unrelated workspace changes published.
Source-of-truth verdict: PASS. Catalog tariff, affiliate identity, immutable request/reservation, assigned document template and Google projection retain their declared authority.
Invariant verdict: PASS. 431 existing requests unchanged by migration; no production request created; rental-only changes. E=Renta Car, F=0, G/Plazo=1, H=0, I=cash total, J=submitted at.
Build: PASS. Isolated 158-module bundle and 31 public files; Pages workflow 39804352642 passed backend compatibility, build, deployment and production checks.
Tests: PASS. 18 isolated SQL checks; 23 document-core release checks; focused browser/Google/PDF checks; seven old PDFs and fifteen non-rental register projections unchanged. Real published calendar/documents/summary/signature path passed at 2 x 2500 = 5000. Required global local-build and GitHub Pages image/document/fullscreen/refresh/SW comparisons passed with exact bundle hash.
Security: PASS. No credentials published; authenticated read API and past-date rejection verified; scoped RPC authorization/RLS and immutable snapshots tested; active Edge hashes verified; secrets unchanged.
Legacy impact: rental Google projection only, A:AG unchanged; no Apps Script, formulas, existing Sheet rows or other program behavior edited.
Unexpected files changed: none in publication. Temporary test checkout line endings restored before staging; root's preexisting changes preserved.
Known limitations: contract is not yet created/assigned by owner. Actual contract PDF printing awaits that configuration; prepared values and exclusion of applicant digital signature tested. No real submission/approval/Sheets append was performed solely to test production.
Evidence: docs/qa/evidence/renta-car/publication.json and architect-review.md (APPROVED). https://david14081982.github.io/SutiApp-private/
