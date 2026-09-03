# Admin Finanzas · Solicitudes — PROTECTED / CLOSED CONTRACT

## Estado protegido

- H de origen: `H-FINANCE-REQUESTS-FLOW-UX-CORRECTION-001`
- SHA funcional aprobado en producción: `c5e0647922a8fdd9e34bf0c09cfa670dc41f2527`
- Decisión: `ADR-100`
- Estado: `PROTECTED / CLOSED CONTRACT`
- Alcance: Admin → Finanzas → Solicitudes, resolución de workflow, transición operativa, lectura Admin/afiliado, auditoría y preview privada.

Este documento congela el comportamiento funcional y visual aprobado por el propietario. No crea una autoridad runtime, no sustituye las autoridades Supabase y no amplía el alcance a otros módulos Admin, Marketplace, Ahorro o procesamiento Google legacy.

## Contrato funcional cerrado

### Flujo y etapa

- Cada solicitud usa exclusivamente su `workflow_snapshot` inmutable mediante `resolve_program_request_workflow_state()`.
- La pantalla muestra flujo aplicado, etapa actual, completadas, pendientes, siguiente acción, responsable e historial.
- `financial_processing_status` se presenta separado y nunca se interpreta como etapa.
- No se permiten arrays locales, etapas genéricas, hardcodes ni reinterpretación de solicitudes históricas con la configuración vigente.

### Transiciones

- Las acciones son explícitas y confirman etapa origen, destino y efecto antes de guardar.
- Toda transición autorizada mantiene compatibles `program_requests.status`, `operational_request_tracking` y `program_request_admin_events` dentro de la misma transacción.
- `client_action_id` hace idempotente el reintento y evita eventos o avances duplicados.
- Admin relee el backend después de guardar; el afiliado consume el mismo resolver.
- Préstamos y productos con procesamiento financiero conservan sus writers certificados; la transición genérica nunca los aprueba.

### Documentos

- Al abrir la solicitud, las previews se solicitan automáticamente mediante `document-access`.
- Imágenes muestran thumbnail, PDF permite vista previa y otros archivos muestran nombre más acción Abrir/Descargar.
- Los objetos permanecen privados. Cada URL firmada es efímera, vive sólo en memoria y nunca se persiste ni se convierte en fallback.
- Un error falla cerrado y permite reintentar; no reaparece el paso manual “Preparar vista”.

## Autoridades únicas

- `program_requests`: solicitud y estado.
- `program_requests.workflow_snapshot`: flujo inmutable aplicado.
- `operational_workflows` y `operational_workflow_stages`: configuración para solicitudes futuras.
- `operational_request_tracking`: proyección derivada de etapa vigente.
- `program_request_admin_events`: auditoría append-only.
- `request_documents`: evidencia documental enviada.
- `affiliate_documents`, `private_assets` y `private-assets`: expediente y objeto privado.
- `document-access`: autorización y firma temporal individual.

No se permite otra tabla de workflow, etapa UI autoritativa, store, mock, `DATA`, JSON, `localStorage`, caché persistente ni fallback productivo.

## Migración protegida

| Migración | SHA-256 protegido |
|---|---|
| `20260903000140_finance_request_workflow_ux_correction.sql` | `59A68797AB302DC94608E93119C6C95A56F79084B1E5798D18F7A3ECAA02C117` |

La migración aplicada no debe reescribirse. Un cambio futuro legítimo debe ser aditivo, declarar recovery, preservar historia y aportar pruebas focales de préstamo, membresía, cotización y beneficio.

## Gate para futuras H

Toda H que toque esta pantalla, sus RPC, el resolver, snapshots, tracking, bitácora o preview documental debe:

1. Declarar expresamente su impacto sobre `ADR-100` y este contrato.
2. Ejecutar Navigator, auditoría previa y guardians aplicables.
3. Demostrar que no introduce otra autoridad ni reinterpreta snapshots históricos.
4. Conservar writers financieros especializados y seguridad backend.
5. Ejecutar el regression guard focal y post-change verification.
6. No modificar esta frontera si el objetivo puede resolverse fuera de ella.

## Regression guard focal

```powershell
node scripts/test-finance-requests-flow-protected-contract.js
node scripts/apply-finance-request-workflow-ux-correction.js --status
node scripts/test-admin-financial-requests-workbench-browser.js https://david14081982.github.io/SutiApp-private
```

Las suites globales, Marketplace y pruebas de service worker no se ejecutan por defecto. Sólo aplican si una futura H modifica además una frontera global definida por `AGENTS.md`.
