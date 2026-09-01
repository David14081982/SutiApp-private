# H-PROGRAM-PRODUCTS-SAVE-CONTRACT-AUDIT-001

## Resultado

Estado: `PASS`.

La causa no era el switch Vendido. `ProgramCatalogRepository` envía un payload completo y el writer productivo anterior volvía a validar cada campo como si fuera una alta. Por eso una edición legítima fallaba cuando otro campo histórico no cumplía las reglas actuales.

## Inventario productivo read-only

| Hallazgo | Filas | Efecto del writer vigente |
|---|---:|---|
| Autos con 9 imágenes | 3 | cualquier guardado supera el máximo fijo de 8 |
| Farma `PAYROLL_FIXED`, `price_cash=NULL` | 50 | cualquier guardado exige precio positivo |
| Préstamo con `sort_order=0` | 1 | cualquier guardado exige orden ≥ 1 |
| Total único afectado | 54 | edición bloqueada por un campo no modificado |

Base observada: 135 productos, 12 programas con filas, 65 precios no nulos, 134 habilitados, cero vendidos, 268 vínculos y máximo de nueve imágenes. Los 65 precios permanecieron idénticos; no hubo DML persistente. Nombre, descripción, categoría, roles/orden de assets, modalidad/requires_quote y nullability no mostraron conflictos adicionales. El constraint productivo también omite `cirugias`, por lo que el bootstrap anterior no puede completar su primera inserción.

## Remediación aplicada

`20260831000800_program_products_save_contract_delta.sql`:

- mantiene `program_catalog_items`/assets como autoridad única;
- conserva el payload completo y vuelve el writer delta-aware;
- permite 9→9, 9→8 y 8→8; niega 8→9 y 9→10;
- permite conservar exactamente precio histórico nulo u orden 0 al editar otro campo, pero exige reglas actuales al crearlos o cambiarlos;
- agrega sólo `cirugias` a la allowlist del constraint;
- conserva permiso, allowlist, auditoría, RLS, grants y ownership de assets;
- devuelve códigos concretos y la UI los traduce;
- respalda funciones, constraint, conteos y hashes para recuperación exacta.

El recovery falla cerrado si existe auditoría Admin posterior o cambia una fila/vínculo. No debe ejecutarse después de actividad administrativa legítima.

## Verificación

El dry-run productivo ejecutó en una sola transacción la migración y pruebas de nombre, descripción, categoría, precio, modalidad, Vendido, activo, orden, imágenes, alta Cirugías y permisos; después hizo `ROLLBACK`. Una segunda transacción ejecutó forward + recovery y también hizo `ROLLBACK`. Ambos terminaron `PASS`; snapshots anteriores/posteriores fueron idénticos.

La migración fue aplicada con autorización explícita el 2026-09-01. La matriz post-apply ejercitó transaccionalmente los 54 casos y conservó 135 productos, 268 vínculos y los 65 precios. El recovery dry-run pasó antes de actividad Admin. Chrome real guardó un Auto histórico con nueve imágenes sin cambiar valores, recargó desde Supabase y confirmó la misma fila/galería en el frontend afiliado; quedó únicamente la auditoría administrativa legítima. Recovery real queda desde entonces prohibido y bloqueado por diseño.
