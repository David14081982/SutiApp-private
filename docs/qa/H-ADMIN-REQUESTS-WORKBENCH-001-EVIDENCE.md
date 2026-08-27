# H-ADMIN-REQUESTS-WORKBENCH-001 — Evidencia de cierre

Fecha: 2026-08-26

## Alcance y autoridad comprobados

- Alcance modificado: exclusivamente `Admin → Solicitudes` en desktop, las proyecciones de lectura del `ProgramRequestRepository`, el consumidor existente de Historial, su mapping vigente y las pruebas/evidencia. El shell Admin y Document Workbench no fueron rediseñados.
- Autoridad: Supabase `program_requests`, leída y escrita por `ProgramRequestRepository`. Las escrituras continúan pasando por la RPC autenticada `update_program_request`; RLS y la capability `program_requests.write` siguen siendo la autoridad efectiva.
- Historial: `operationsStore` consume la misma fila de `program_requests` mediante una proyección autorizada. No se crea una solicitud, store ni caché paralelos.
- Documentos: el detalle consulta `request_documents` y requisitos únicamente después de seleccionar una solicitud. Un error de proyección se muestra como indisponibilidad explícita; nunca se sustituye por mock o vacío ficticio.
- Solicitudes financieras: excluidas de la cola desktop general mediante `financial_processing_status IS NULL`. Finanzas, Google, Apps Script, criterios, cálculos y snapshots no fueron modificados.
- Responsable/asignación: el modelo actual no contiene ownership por solicitud. `operational_request_tracking.responsible` representa un área de etapa, no un responsable asignado a la solicitud. Por ello no se agregó filtro ni selector ficticio.
- Acciones masivas: no existe contrato backend atómico/auditado para batch; resultado `BULK_NOT_AUTHORIZED`.
- Observación administrativa independiente: no existe en el contrato actual. `notes` conserva la descripción existente del solicitante y la actualización de estado verifica que no sea borrada.

## Implementación verificable

- Desktop `>=1024`: toolbar, tabla operacional, selección persistente, detalle lazy, resumen documental, términos, actividad factual, estado separado de acción, feedback inline, Anterior/Siguiente, Guardar y siguiente y navegación segura por teclado.
- Móvil `430×932`: conserva cards, flujo secuencial, acciones existentes y bottom navigation; el workbench desktop no se monta.
- Queue desktop: carga hasta 250 filas de metadata y sólo carga el detalle/documentos de la selección. Historial y móvil no se truncaron para preservar sus contratos existentes. No firma ni descarga activos al abrir la bandeja.
- Timeline: consulta lazy `operational_request_tracking` y sus etapas cuando `workflow.read` lo permite; sin fila configurada usa únicamente `created_at`/`updated_at`. Un error de proyección se declara y no crea eventos ficticios. El entorno controlado no tenía un workflow `request` enlazable, por lo que la evidencia positiva quedó `N/A_NO_TRACKING_FIXTURE` y la línea factual sí fue verificada.
- Semántica: estados y tipos tienen labels humanos; UUID y código interno están únicamente dentro de “Detalles técnicos” expandible. `numero_control` se presenta enmascarado.
- Persistencia: `ACTION → RPC → queue READBACK → status compare → refresh`. El feedback de éxito sólo aparece después del readback correcto.
- Error: conserva selección, detalle y filtros; ofrece Reintentar y no expone stack trace.
- Posible reutilización futura, sin migrar otros módulos: `AdminQueueToolbar`, `AdminQueueTable`, `AdminDetailPanel`, `AdminTimeline` y `AdminSafeActionBar`.

## Evidencia de navegador real

Comando:

```text
node scripts/test-admin-requests-workbench-browser.js
```

Resultado: `PASS`, Chrome real contra Supabase real.

- Viewports desktop: 1024×768, 1280×900 y 1440×1000, tabla + panel persistente, sin overflow horizontal del viewport ni del workspace.
- Móvil: 430×932, workbench ausente, cards y bottom navigation presentes, ancho raíz 430 y sin overflow horizontal.
- Queue: búsqueda, estado, tipo, antigüedad, fecha, limpiar filtros, empty state, selección, anterior/siguiente y teclado pasaron.
- Escritura reversible: fixture sintético actualizado por `update_program_request`, readback verificado, persistencia tras refresh y reflejo exacto en Historial; `duplicateRequests = 0`.
- Seguridad: Super Admin autorizado; normal, anónimo y acceso cruzado denegados por backend/RLS. Responsable autorizado es `N/A` porque no existe autoridad de ownership.
- Performance: metadata inicial, detalle lazy y documentos lazy comprobados.
- Writes observadas: sólo la RPC permitida `update_program_request`; `unexpectedWrites = []`.
- Cleanup: cuatro verificaciones de residuos devolvieron conteo cero.
- Excepciones de consola: el arranque global conserva avisos 401/403/CORS de módulos ajenos ya existentes; la prueba registró `pageErrors = []`, cero writes inesperadas y todas las aserciones de esta H en PASS.

Artefactos:

- `docs/qa/evidence/admin-requests-workbench-20260826/playwright-result.json`
- `docs/qa/evidence/admin-requests-workbench-20260826/requests-mobile-430x932.png`
- `docs/qa/evidence/admin-requests-workbench-20260826/requests-1024x768.png`
- `docs/qa/evidence/admin-requests-workbench-20260826/requests-1280x900.png`
- `docs/qa/evidence/admin-requests-workbench-20260826/requests-1440x1000.png`

## Matriz solicitada

```text
ADMIN REQUESTS WORKBENCH RESULT

Desktop queue: PASS
Table/list: PASS
Search: PASS
Status filter: PASS
Type filter: PASS
Age filter: PASS
Responsible filter: N/A — no request-owner authority exists
Detail panel: PASS
Timeline: PASS — authoritative lazy query when available; factual created/updated fallback; no invented history
Documents integration: PASS — authoritative lazy summary and explicit unavailable state
Previous/next: PASS
Keyboard: PASS
Inline feedback: PASS
Refresh persistence: PASS
Frontend History reflection: PASS
Safe bulk: NOT_AUTHORIZED
Technical IDs primary: 0
Cross-user: DENIED
Normal user: DENIED
Anonymous: DENIED
Mobile preserved: PASS
1024: PASS
1280: PASS
1440: PASS
Unexpected writes: 0
Fixture cleanup: PASS
Playwright: PASS
Static suite: PASS
Architecture Registry: UPDATED / FRESH
Potential reusable queue components: [AdminQueueToolbar, AdminQueueTable, AdminDetailPanel, AdminTimeline, AdminSafeActionBar]
Final verdict: PASS
```

## Cierre constitucional

```text
H-ADMIN-REQUESTS-WORKBENCH-001 RESULT
Status: PASS
Files changed: request repository/workbench; History consumer/mapping; generated bundle/cache; task/static/browser tests; evidence/changelog; derived Architecture Registry
Source-of-truth verdict: PASS — program_requests remains the single authority; no localStorage, DATA, mock, duplicate store or productive fallback
Invariant verdict: PASS — real numero_control retained/masked, actor/authorization boundaries preserved, financial and historical domains unchanged
Build: PASS — bundle reproduced from 90 source files
Tests: PASS — task test, canonical static suite and real Chrome/Supabase matrix
Security: PASS — UI projection plus authenticated RPC/RLS; normal, anonymous and cross-user denied
Legacy impact: NOT APPLICABLE / NO WRITE / NO CHANGE
Unexpected files changed: 0 attributable to this H
Known limitations: responsible/assignment and separate admin observation are N/A because no authority exists; bulk is NOT_AUTHORIZED; exact terms version or document projection may remain visibly unavailable under current browser grants
Evidence: this document plus docs/qa/evidence/admin-requests-workbench-20260826/
```
