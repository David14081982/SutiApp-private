# H-FINANCE-REQUESTS-CONFIRMATION-NOTIFICATIONS-UX-001

## OWNER DECISION — CONTINUAR (vigente)

El propietario separó explícitamente Web Push a H-WEB-PUSH-REQUEST-EVENTS-001 y autorizó aplicar esta migración, publicar y verificar producción. Push es NOT APPLICABLE para esta H y no bloquea su cierre. Los estados de decisión pendiente siguientes describen el corte anterior y quedan supersedidos por esta autorización.
Ampliación de alcance de release: `scripts/release-request-event-notifications.js`, prueba live focal, `SutiApp.html`/`sw.js` sólo cachebusters, documentación/evidencia de cierre y publicación aislada sobre origin/main. No cambia la lógica de SW hasta la H siguiente. Respaldo técnico privado y transacción SQL con preservación de hashes antes del apply.

## PRE-CHANGE AUDIT

- Objetivo: confirmación contextual, resultados verificados, historial, notificaciones y auditoría Push.
- Alcance inicial: presentación de acciones de Admin Finanzas y etapa visible de Historial.
- Archivos: `app/screens-admin-finanzas.jsx`, `app/screens-historial.jsx`, `app/bundle.js` (generado), este documento, `docs/AGENT_CHANGELOG.md`, `scripts/test-finance-request-confirmation-browser.js`, evidencia bajo `docs/qa/evidence/finance-request-confirmation-20260908/`.
- Autoridad: Supabase program_requests + operational_request_tracking + program_request_admin_events; mismos RPCs de transición. Lectores: workbench / operationsStore. Writers financieros y cálculos intactos.
- Fuera de alcance: cambios de etapas/reglas/motivos, Google, cálculos, eliminación, documentos, Auth/Storage/viewers.
- Riesgo: doble envío, feedback anticipado, pérdida de error al refrescar, foco de modal anidado.
- Plan: confirmar antes del writer, bloqueo síncrono, readback existente, feedback específico; pruebas Chrome aisladas con backend controlado, fallos y responsive.
- Recovery: fuentes y bundle anteriores en `C:/tmp/sutiapp-confirmation-ux-20260908`.
- Baseline: workspace con cambios previos; no usar git reset ni publicar cambios ajenos. Registry STALE en archivos focales: discovery directo realizado sobre fuentes actuales.
- Status: PASS para alcance inicial. Extensión de notificaciones requiere auditoría aditiva antes de editar backend/shell.

## Contrato UI

Admin: filtros, tabla, detalle modal, resumen, condiciones, documentación, workflow, bitácora, acciones y navegación permanecen. Se añade confirmación contextual dentro del detalle y resultado. Historial: TopBar, tarjeta activa, filtros, lista, seguimiento/timeline y CTA permanecen.

## Push audit

No se encontraron PushManager, suscripciones, VAPID, emisor Web Push ni handlers push/notificationclick en app, sw.js o supabase/functions. Existe únicamente notificación interna de cotizaciones Marketplace (ADR-082); no es transporte Push. Decisión de infraestructura consultada al propietario. No se afirma entrega Push.

## Extensión auditada: notificaciones

Archivos adicionales autorizados por el objetivo: `app/request-notifications.js`, `app/app.jsx` (NotifsScreen), `scripts/build-bundle.js`, migración/recovery `20260908000600_request_event_notifications.sql`, pruebas SQL/browser y script de auditoría focal; documentación de autoridad/seguridad/migración e índices derivados de arquitectura.
Autoridad: los eventos inmutables existentes son la notificación; tabla auxiliar de acuses con PK event_id, sin duplicar estado ni copiar eventos. Lectura self-only y acuse atómico validan afiliado efectivo; no modifican bitácora, solicitudes ni workflow. Marketplace aprobado conserva su notificación/acuse existentes, sin duplicarlo. Rechazos/cancelaciones Marketplace pueden notificarse por evento.
Migración aditiva sin backfill: RLS forzada, cero grants browser sobre acuses, RPC security definer search_path vacío. Recovery revoca RPCs conservando acuses e historia. Pruebas transaccionales con rollback y denegación cross-user antes de aplicación. No se aplica con pruebas fallidas. Push permanece decisión independiente.
La dependencia de notificaciones entre superficies requiere ejecutar la regresión compartida exigida por AGENTS.md antes de un PASS/publicación.

## VERIFY / EVIDENCE — candidato anterior al release

| Validación | Resultado | Alcance de la evidencia |
| --- | --- | --- |
| Aprobar etapa | PASS | Chrome aislado, writer y readback |
| Autorizar solicitud | PASS | Chrome: beneficio, préstamo, producto y cotización |
| Rechazar / cancelar | PASS | Motivo existente, advertencia, sin confeti |
| Doble clic | PASS | Una escritura por intento; botón deshabilitado |
| Error backend / readback inconsistente | PASS | Error visible, cero resultado anticipado |
| Historial / timeline | PASS | Pantallas + operationsStore reales con RPC aislado; estados, etapas y tres fechas/hora |
| Notificación interna | PASS en candidato | Proyección de eventos, 4 tipos, enlace y teclado; migración SQL compilada, NO APLICADA |
| Confeti Admin | PASS | Sólo transición verificada a approved; no en etapa intermedia/rechazo/cancelación |
| Confeti usuario una vez | PASS en candidato | Acuse atómico, consumidores simultáneos, reapertura y cambio de identidad |
| No duplicados | PASS en candidato | PK de acuse, reintento SQL y proyección única por evento; Marketplace conserva su aprobación original |
| Push autorizado / rechazado | BLOCKED | No existe infraestructura; decisión pendiente |
| Build | PASS | Babel Standalone 7.28.4; 114 módulos; sintaxis válida |
| Regresión de imágenes | PASS | Candidato local y base publicada GitHub Pages; ambas con backend/assets reales, sin mutaciones |
| Publicación / verificación de nueva versión productiva | BLOCKED | Condición owner “si todo PASS” aún no cumplida |

Comandos focales:

```text
node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js
node scripts/test-finance-request-confirmation-browser.js
node scripts/test-request-event-notifications-browser.js
node scripts/test-request-event-notifications-sql.js
node scripts/verify-finance-request-confirmation-scope.js
SUTIAPP_IMAGE_E2E_URL=<local o GitHub Pages> node scripts/test-global-image-regression-production-live.js
```

`test-admin-financial-requests-workbench.js` tiene una expectativa textual obsoleta (`Admin y afiliado ya muestran la etapa vigente`): FAIL idéntico sobre fuente inicial y candidato. No se debilitó ni se modificó ese test. Las nuevas pruebas cubren comportamiento, writers preservados y readback. Los tests históricos que exigían identidad textual de window.confirm pertenecen al contrato reemplazado por esta H.

Evidencia: `docs/qa/evidence/finance-request-confirmation-20260908/`. Capturas contienen exclusivamente fixtures sintéticos. SQL ejecutado en ROLLBACK: 14 solicitudes, 40 eventos y 14 tracking antes/después; cero mutaciones de negocio. Global: sello/Login, perfil, Admin Afiliados, imágenes, PDF legítimo, Membership, Préstamo, catálogos/galería, Marketplace, fullscreen, refresh y comparación con/sin SW PASS. GitHub Pages sigue siendo la versión anterior: no se afirma despliegue de estas notificaciones.

Registry: actualizado mediante incremental con el conjunto exacto de 190 archivos stale (incluye cambios previos), sin editar el generador. `check`: FRESH. Verificación dirigida de los tres objetos nuevos, clasificación no autoritativa y lookup de Credencial/Convenios/Préstamo: PASS. La suite completa `test-architecture-registry.py` fue interrumpida durante su regeneración inicial al adoptar la actualización incremental; no se declara PASS para esa suite. Cero fixtures temporales residuales.

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin Finanzas / Historial / Notificaciones.
Original/current sections: filtros, bandeja, detalle, condiciones, documentos, workflow, bitácora, navegación, acciones; Historial con hero, chips, lista y timeline; Notificaciones con tarjetas y estados.
Missing sections: ninguna.
Added sections: confirmación y resultado modal; avisos de eventos y autorización vista una vez.
Interactions preserved: PASS (excepto confirmación nativa sustituida según instrucción).
Navigation preserved: PASS.
Visual structure preserved: PASS; inspección Chrome desktop/móvil y seis bloques protegidos idénticos.
Unauthorized redesign: NO.
Verdict: PASS para candidato.

## H-FINANCE-REQUESTS-CONFIRMATION-NOTIFICATIONS-UX-001 RESULT

Status: PASS.
Files changed: screens-admin-finanzas.jsx, screens-historial.jsx, request-notifications.js, app.jsx (notificaciones/badge), bundle.js generado, build-bundle.js, cachebusters SutiApp.html/sw.js, migración/recovery 20260908000600, scripts focales/release, índices derivados, documentación y evidencia.
Source-of-truth verdict: SAFE; program_request_admin_events y acuse único Supabase, migración APPLIED / VERIFIED.
Invariant verdict: PASS; callbacks de negocio, estados, motivos, cálculos y Google conservados.
Build: PASS; bundle 232 / worker 179; SHA256 público 471c597ea6be4157b187173679a6b481bd30498b7a0e3e8443ddaf91c1f29645.
Tests: nueve casos de acción, notificaciones/acuse concurrente/historial/timeline, SQL/seguridad, artefacto local y producción PASS. Regresión global de imágenes/PDF/SW PASS local y producción.
Security: PASS; RLS forzada, sin acceso directo a acuses, RPC self-only y rechazo cross-user, cero secretos frontend.
Legacy impact: cero cambios de cálculos, workflow o Google; cero mutaciones productivas de negocio durante verificación.
Unexpected files changed: cero archivos ajenos publicados; release aislado en origin/main. Bytes vendor idénticos al blob Git para preservar SRI.
Known limitations: Web Push NOT APPLICABLE por decisión owner; continúa automáticamente en H-WEB-PUSH-REQUEST-EVENTS-001. La cuenta controlada productiva no tiene avisos de solicitudes: casos positivos/deep-link/acuse certificados en SQL y navegador aislado. Test textual antiguo falla igual antes de esta H y está supersedido por pruebas funcionales focales.
Evidence: publication.json, migration-applied.json, production-live.json, release-global-local.json, release-global-production.json, isolated-browser.json, notifications-browser.json y sql.json.
Publication: commit 776d9a05be798ad1640eb9c6c23f9b0f328f0a15; Actions 34300984710 SUCCESS; sutiapp.com y GitHub Pages con mismo hash y versiones.


## Decisión inicial de Push — resuelta por OWNER DECISION

Habilitar infraestructura Web Push requiere suscripciones PWA por dispositivo, claves VAPID guardadas en backend, contacto del emisor y un emisor backend que consuma únicamente eventos confirmados, con deduplicación/reintentos y renovación de suscripciones. Nada de esto existe en la base auditada. El usuario pidió detener únicamente esta decisión cuando faltase infraestructura: se prepararon y validaron las mejoras independientes. No se instaló un transporte paralelo ni se simuló un Push exitoso.
