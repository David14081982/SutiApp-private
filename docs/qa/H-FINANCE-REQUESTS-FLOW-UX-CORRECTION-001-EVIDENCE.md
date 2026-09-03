# H-FINANCE-REQUESTS-FLOW-UX-CORRECTION-001 — evidencia

## Auditoría y causa raíz

La pantalla usaba `financial_processing_status` y un mapa local como si fueran etapas operativas. Sus read models no incluían `workflow_state`; además, el tracking sólo se creó durante el cutover inicial y 18 de 24 solicitudes controladas no tenían fila. La prioridad genérica financiera podía asignar el flujo préstamo a una cotización no-préstamo. Las decisiones administrativas generales tampoco tenían una frontera atómica que enlazara status, etapa e historial.

Autoridades preservadas: `program_requests` para solicitud/status; `workflow_snapshot` para el flujo aplicado; configuración versionada para altas futuras; `operational_request_tracking` como derivado; `program_request_admin_events` para auditoría; `request_documents`/`affiliate_documents`/Storage privado para documentos. No se reescribió historia.

## Implementación focal

- Bandeja y detalle unificados sobre `program_requests`, con flujo completo, etapa actual, completadas, pendientes, siguiente acción, responsable e historial.
- Transición backend idempotente con read-back Admin/usuario y evento origen/destino.
- Trigger continuo para sincronizar tracking desde cualquier writer de status.
- Aprobaciones financieras especializadas bloqueadas en la transición genérica.
- Preview automática individual mediante `document-access`; sin publicación ni URL persistente.

## Evidencia previa a producción

- Forward + recovery dry-run: `PASS`, conteos antes/después idénticos, `persistentChanges=0`.
- Matriz transaccional préstamo/membresía/cotización/beneficio: `PASS`; para cada tipo, Admin y usuario releyeron la misma etapa persistida; auditoría e idempotencia `PASS`; `persistentChanges=0`. Préstamo rechazó el intento de eludir su writer especializado.
- Build reproducible de 100 fuentes con Babel Standalone y `node --check`: `PASS`.
- Contratos focales de workbench, eventos, timeline y dependencia del repository compartido: `PASS`.
- Google reads/writes: `0/0`. Fórmulas, tasas, saldos, amortización y Apps Script: sin cambios.

## Aplicación y Chrome contra backend productivo

- Migración `20260903000140`: `APPLIED / PASS`; 24 solicitudes, 116 documentos, 4 eventos, 4 workflows y 20 etapas preservados. No se ejecutó backfill histórico; las 6 filas de tracking existentes quedaron intactas y las faltantes se crean al ocurrir una transición real.
- Recovery productivo ejecutado dentro de `ROLLBACK`, seguido de forward y checks: `PASS`; conteos idénticos y `persistentChanges=0`. Quedará fail-closed cuando exista historia nueva de etapas.
- Chrome real local, modo read-only: préstamo, membresía, cotización y beneficio mostraron workflow/nombre/etapa actual/etapas completas y pendientes/siguiente/responsable/historial: `PASS`.
- Previews locales: 47 autorizaciones automáticas intentadas; préstamo 17 filas visibles, membresía 15, cotización 9 y beneficio 17; botón manual “Preparar vista”: `0`. El origen local no pertenece a `ALLOWED_APP_ORIGINS`, por lo que las 47 firmas fallaron cerradas como se esperaba. La carga real queda condicionada al `PASS` posterior desde GitHub Pages.
- GitHub Pages, commit `c5e0647`: despliegue `33746210924` `PASS`. Chrome contra el origen productivo autorizado cargó automáticamente 17/17 documentos de préstamo, 15/15 de membresía, 9/9 de cotización y 17/17 de beneficio; fallos `0`, botón manual “Preparar vista” `0` y llamadas al resolver firmado `47`.
- Responsive: 1440 px con dos paneles y siete filtros; 430 px con un panel, sin overflow: `PASS`.
- Escrituras de transición durante la inspección read-only: `0`; errores de página: `0`; lecturas Google directas: `0`.

Evidencia de navegador productiva: `docs/qa/evidence/finance-request-workflow-ux-20260903/browser-result.json` y `workflow-workbench.png` (PII enmascarada).

## Revisión arquitectónica independiente

`APPROVED`. El diff respeta las autoridades documentadas, el snapshot inmutable, la separación entre estado de solicitud y procesamiento financiero, los writers certificados y el acceso privado a documentos. No introduce fallback, mock productivo, nueva autoridad, secreto frontend ni llamada Google. La recuperación y la matriz live-rollback restauraron conteos exactos.

Los tres archivos derivados del Architecture Registry ya estaban modificados al iniciar esta H y quedaron fuera de ambos commits para no mezclar ni sobrescribir trabajo ajeno. El check permanece `STALE`; el discovery se hizo contra código, schema y documentos autoritativos reales.
