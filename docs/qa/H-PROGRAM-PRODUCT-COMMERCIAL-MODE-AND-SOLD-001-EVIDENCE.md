# H-PROGRAM-PRODUCT-COMMERCIAL-MODE-AND-SOLD-001 — Evidence

Fecha: 2026-08-31

Autoridad: `public.program_catalog_items`

## Datos y migración

- Auditoría previa: 135 productos, 65 con precio, 35 Casa; hash precio/cotización `2ba16e15407a83d630a6294469ff68b3`.
- Casa: 35/35 inmuebles de venta/renta, sin financiamiento de nómina SutiApp; clasificación owner-aprobada `DIRECT_CONTACT`.
- Aplicado: 80 `PAYROLL_FIXED`, 20 `PAYROLL_QUOTE`, 35 `DIRECT_CONTACT`, 0 vendidos iniciales.
- Después: 135 productos, 65 precios idénticos, 134 activos visibles al afiliado y 1 inactivo oculto.
- Marketplace, assets y `program_requests`: conteos/hashes preservados por el verificador.

## Comandos verificables

```text
node scripts/test-program-product-commercial-mode-and-sold.js
PASS — contrato estático, autoridad única, server guard y recovery

node scripts/apply-program-product-commercial-mode-and-sold.js
PASS — DRY_RUN_FORWARD_RECOVERY; writerTransitions=true; serverDenials=true; persistentWrites=0

node scripts/apply-program-product-commercial-mode-and-sold.js --apply
PASS — VERIFY_APPLIED; items=135; priced=65; fixed=80; quote=20; casaDirect=35; sold=0

node scripts/apply-program-product-commercial-mode-and-sold.js --recovery-dry-run
PASS — RECOVERY_DRY_RUN_APPLIED; persistentWrites=0

node scripts/deploy-financial-legacy.js deploy
PASS — v32 ACTIVE; verify_jwt=true

node scripts/deploy-financial-legacy.js verify
PASS — compiled bundle; 11/11 markers

node scripts/test-program-product-commercial-mode-and-sold-live.js
PASS — modos/conteos/contacto; direct Edge/request denied; DML denied; sold_by hidden; persistentWrites=0

node scripts/test-program-product-commercial-mode-and-sold-browser.js
PASS — Chrome 430×932; Casa $1,600,000; contacto; cero simulador/solicitud; VENDIDO card/detail; Admin 3 modos + switches; persistentWrites=0

node scripts/test-static-suite.js
PASS — 75/75; fallos=0

python scripts/test-architecture-registry.py
PASS — Registry conectado y fresco
```

La prueba live de fijo/cotización no se repitió mediante nuevas sesiones financieras: ADR-087 ya certifica esas ramas y esta H no inventó cotizaciones ni solicitudes. La prueba transaccional confirmó que el nuevo guard permite únicamente el contrato `PROGRAM_PRODUCT_PAYMENT_V1` vigente y revierte todo con `ROLLBACK`.

## Evidencia visual

- `docs/qa/evidence/program-product-commercial-mode-and-sold-20260831/casa-direct-contact-430.png`
- `docs/qa/evidence/program-product-commercial-mode-and-sold-20260831/sold-detail-isolated-430.png`
- `docs/qa/evidence/program-product-commercial-mode-and-sold-20260831/admin-commercial-mode-editor-430.png`

Las imágenes contienen únicamente catálogo público. El escenario Vendido se renderizó en browser con una copia aislada de una fila ya leída; no creó ni alteró datos productivos.

## Revisión arquitectónica

`APPROVED`. Autoridad única, prioridad `enabled → sold → commercial_mode`, bloqueo server-side, trazabilidad, recovery y límites legacy coinciden con ADR-089 e INV-155–158. `docs/WORK_QUEUE_HISTORY.md` no existe; `WORK_QUEUE.md` declara que sólo gobierna el Master Plan y no reconstruye H históricas, mientras esta H contó con autorización productiva explícita del propietario. No requiere una nueva decisión.

`deno check` local fue `NOT AVAILABLE` porque Deno no está instalado. Supabase compiló y activó `financial-legacy` v32 y la descarga remota verificó 11/11 marcadores, por lo que la verificación desplegada sí está evidenciada.
