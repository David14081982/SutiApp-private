# H-SUTIAPP-PROGRAM-PRODUCTS-ADMIN-CUTOVER-001 — Evidence

Fecha: 2026-08-31

## Alcance y autoridad

- Dominio: productos propios SutiApp agrupados por `program_key`.
- Autoridad preservada: `program_catalog_items` + `program_catalog_item_assets` + Storage vigente.
- Reader: `ProgramCatalogRepository` para Admin y afiliado.
- Writer: `ProgramCatalogRepository.saveAdminItem/reorderAdminItems` → RPC `save_program_catalog_item/reorder_program_catalog_items`.
- Alternativas autoritativas: ninguna. `catalogStore` sólo conserva proyección en memoria; `MarketplaceRepository` no participa del writer.
- Fuera de alcance confirmado: Marketplace empresarial, Panel Empresarial, simulador, documentos, Google/Apps Script y cálculo financiero.

## Reconciliación productiva

La migración `20260831000400_program_products_admin_cutover.sql` se aplicó con autorización explícita del propietario. Resultado live:

```json
{"status":"PASS","mode":"APPLIED","items":135,"assets":268,"marketplaceTouched":0,"conflictsBefore":65,"conflictsAfter":0}
```

La tabla `program_catalog_price_mode_reconciliation` conserva los 65 valores previos y `previous_updated_at`. La verificación live posterior confirmó:

- 65/65 `requires_quote=false`.
- 0 diferencias entre `program_catalog_items.price_cash` y el precio capturado antes del update.
- Aires 16, Casa 35, Autos 3, Puertas 3, Terrenos 3, Tours 3, Renta 1 y Cómputo 1.
- 135 productos y 268 vínculos habilitados después del E2E y su cleanup.
- 0 escrituras a `marketplace_products`.
- Excepciones demostrables que deban cotizar pese a tener precio: ninguna.

## Migración y recovery

- Forward + recovery dry-run previo a aplicar: `PASS`, `persistentWrites=0`.
- Aplicación productiva: `PASS`.
- Guard de ownership `20260831000401_program_catalog_asset_owner_guard.sql`: aplicado y verificado.
- Recovery completo transaccional después del cutover y antes de actividad Admin: `PASS`, `persistentWrites=0`.
- Por orden del propietario y por diseño fail-closed, el recovery no se volvió a ejecutar después del E2E Admin auditado.

## E2E real Admin → Supabase → afiliado

`node scripts/test-program-products-admin-cutover-browser.js` ejecutó Chrome real contra la app local y Supabase productivo con una fixture `HPP_E2E_*` reversible:

```json
{"status":"PASS","real_browser":true,"programs":12,"baseline_items":135,"admin_create":true,"admin_edit":true,"fixed_price":true,"quote_mode":true,"image_upload":true,"logical_activation":true,"reorder":true,"affiliate_reflection":true,"affiliate_inactive_hidden":true,"rls":true,"storage":true,"cross_admin_asset_guard":true,"historical_prices_unchanged":65,"marketplace_writes":0,"pii_printed":false}
```

La fixture, relación de asset y objeto Storage fueron eliminados por identidad exacta; el orden histórico se restauró y el proceso cerró con código 0. La reconciliación posterior volvió a confirmar 135/268/0 conflictos.

## Seguridad

- `program_catalog.read/write` se resolvieron en backend y el rol Admin principal los recibió.
- Afiliado sin permiso: RPC y Storage denegados; inactivo oculto por RLS.
- Anónimo: lectura/escritura denegadas conforme al contrato vigente.
- Admin: DML directo denegado; sólo RPC allowlisted.
- Assets: ruta por actor y trigger contra vínculo cross-actor.
- Secret/service role en browser: 0.
- Auditoría: INSERT/UPDATE/REORDER registran actor, target y antes/después.

## Build, tests y UI

- Bundle reproducido desde 94 fuentes; `node --check app/bundle.js`: `PASS`.
- `node scripts/test-program-products-admin-cutover.js`: `PASS`.
- `node scripts/test-static-suite.js`: 72/72 `PASS`.
- UI preservation: se añadió un módulo Admin sin retirar ni rediseñar módulos existentes. Menú, navegación, estados loading/error/empty, controles, scroll y layout responsive permanecen. El frontend afiliado Claude conserva cards, detalle y “Disponibles ahora”; sólo cambió su proyección autoritativa.

```text
CLAUDE UI PRESERVATION REVIEW

Screen: Admin + Finanzas/Producto
Original sections: menú Admin; catálogo financiero; Disponibles ahora; cards; detalle
Current sections: mismas secciones + módulo Programas · Productos
Missing sections: ninguna
Added sections: programa → productos; editor catalogal Admin
Interactions preserved: YES
Navigation preserved: YES
Visual structure preserved: YES
Unauthorized redesign: NO

Verdict:
PASS
```
