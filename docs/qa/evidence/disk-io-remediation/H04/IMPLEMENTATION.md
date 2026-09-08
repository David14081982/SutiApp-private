# H04 — Corrección mínima

La única modificación productiva es el predicado USING de `storage.objects.master_private_storage_authorized_read`. Se conserva SELECT, PERMISSIVE, authenticated, bucket privado, todas las otras policies y la RLS de las relaciones consultadas. No se crean índices, funciones, grants ni cambios frontend.

La autorización original equivale a `bucket AND (admin OR EXISTS pa READY AND (A OR B OR C))`, donde las relaciones siempre son las visibles para el caller:

- A: existe affiliate_file del asset, del afiliado efectivo, READY y CURRENT_DOCUMENT. El LEFT JOIN permite que esta rama sea cierta sin documento.
- B: existe documento directo del asset, del afiliado efectivo y no REJECTED. El LEFT JOIN permite esta rama aunque no exista affiliate_file.
- C: existe affiliate_file visible del asset unido por id a un documento del afiliado efectivo y no REJECTED. Se conserva el join y su RLS; no se añaden restricciones de status/clasificación de A a esta rama.

Separar esos EXISTS elimina el OR entre dos claves del join documental. Las condiciones booleanas y los NULL conservan su semántica de existencia. Los duplicados no cambian el resultado de EXISTS. La RLS de private_assets continúa evaluándose antes de permitir esa ruta. El bypass administrativo y las policies permisivas del catálogo permanecen idénticos.

`has_admin_permission('assets.read')` y `get_effective_affiliate_id()` son STABLE, independientes de cada fila. Los subselects sin correlación permiten InitPlans por statement. Las claims, sesión, actor y afiliado efectivo siguen siendo del statement actual; no se añade caché entre requests. No se altera ninguna función ni la validación de impersonación. Una revocación aparece en el siguiente statement según la semántica existente de snapshot/transacción.

El plan candidato utiliza los índices existentes y evita ejecutar scans documentales en la foto medida. Los índices propuestos sobre private_asset_id/affiliate_file_id podrían favorecer búsquedas por esas claves, pero no son necesarios para este resultado; añadir ambos impondría mantenimiento adicional sin beneficio demostrado. No se instalaron extensiones ni índices hipotéticos/físicos. No se afirma haber medido el rendimiento de índices no creados.

Referencia técnica: [Supabase, rendimiento de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). La aplicabilidad de InitPlan se verificó además contra las definiciones STABLE live y EXPLAIN, no sólo contra la recomendación general.

Migration: `supabase/migrations/20260907000400_private_storage_rls_work.sql`. Recovery: `supabase/recovery/20260907000400_private_storage_rls_work.sql`. Ambas verifican hash del predicado normalizado con search_path vacío, roles, comando, permisividad, WITH CHECK, RLS y bucket privado. Lock timeout 2 s; statement timeout 15 s. Operaciones idempotentes únicamente para las dos definiciones conocidas. Cualquier drift falla sin sustituir permisos desconocidos.

El ensayo ejecutó apply → apply → recovery → recovery → apply y finalmente ROLLBACK, verificando cada hash. Los 192 casos antes/después pasaron antes del despliegue. Los fixtures y los efectos de triggers/auditoría dentro de sus transacciones se revierten; no se desactivan triggers.
