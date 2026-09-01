# Evidencia — H-PROGRAM-PRODUCTS-SAVE-CONTRACT-AUDIT-001

Fecha de cierre: 2026-09-01. Entorno: Supabase productivo y Chrome real contra el bundle local candidato.

## Evidencia material

- Inventario read-only: `PASS_AUDIT`, 135 filas, 54 afectadas, 65 precios, cero writes.
- Dry-run forward/recovery: `PASS`, 9→9/9→8/8→8 permitidos, 8→9/9→10 denegados, todos los campos editables ejercitados y cero persistencia.
- Seguridad: identidad ausente denegada; `authenticated` no tiene DML directo; backup no legible por browser; writer conserva `program_catalog.write`.
- Recuperación: definiciones y constraint exactos; guard por auditoría e integridad; ejecución transaccional `PASS`.
- Aplicación: `20260831000800` activo; 135 filas, 268 vínculos, 65 precios y cero cambios de filas/assets/auditoría causados por la migración.
- Matriz post-apply: 54/54 estados históricos aceptaron una edición no relacionada dentro de `ROLLBACK`; 9→9, 9→8 y 8→8 permitidos; 8→9 y 9→10 denegados.
- E2E navegador: Auto histórico de nueve imágenes → Admin save no-op → Supabase → reload Admin → frontend afiliado; nueve imágenes y todos los campos de negocio idénticos; una auditoría Admin legítima.
- RLS: tablas catálogo/assets/backup con RLS forzada, DML directo revocado, `anon` sin RPC, ownership trigger y tres policies Storage presentes.
- Reconciliación final read-only: 135 productos, 65 con precio, hash precio/cotización `2ba16e15407a83d630a6294469ff68b3`, 268 assets habilitados, máximo 9, modalidades 80/20/35, `sold=0`, `enabled=134`, provenance histórica 134 y un audit posterior que bloquea recovery real.
- Alcance: sin referencia SQL ni cambio a Marketplace, Panel Empresarial, simulador, cálculos, documentos, solicitudes o Google legacy.
- Build/regresión: bundle reproducido desde 95 fuentes, `bundle.js?v=186`, PWA `sutiapp-v130`, sintaxis `PASS` y suite estática 77/77.
- Registry: regenerado y `FRESH`; lookup apunta al writer, repository, Admin y migración preparados, sin impacto cross-domain.
- Secret/PII preflight: cero JWT/token/key/private-key y cero email literal en los archivos funcionales nuevos; `supabase.env` permanece ignorado y no trackeado.

## Comandos reproducibles

```text
node scripts/test-program-products-save-contract-audit.js
node scripts/apply-program-products-save-contract-delta.js --audit
node scripts/apply-program-products-save-contract-delta.js --apply --confirm-production
node scripts/apply-program-products-save-contract-delta.js --verify-applied
node scripts/apply-program-products-save-contract-delta.js --recovery-dry-run
node scripts/test-program-products-save-contract-browser.js
```

La primera verificación post-apply detectó un falso negativo del arnés al comparar JSON null contra SQL NULL en Farma. Su transacción hizo `ROLLBACK`; se corrigió únicamente esa comparación y la matriz completa pasó. No fue un defecto del writer ni cambió datos.

## Recovery

El recovery dry-run se ejecutó y pasó inmediatamente después de aplicar, antes del E2E. El guardado Admin real posterior creó historia legítima; no ejecutar recovery real. El recovery abortará ante esa auditoría según el contrato aprobado.
