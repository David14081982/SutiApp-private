# H-007 — Migración de dominios SUPABASE_NOW

## Alcance y procedencia

Fuente histórica read-only: `SutiApp Final` (`1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`). Snapshot reproducible: `data/h007-supabase-now-source.json`, SHA-256 `80910E831B93C324B55B3E10A225999B122EB6FBC1826F83FD8BA49A8D4ED915`. Fuente productiva después del cutover: las cuatro tablas Supabase descritas abajo. Google conserva únicamente procedencia; no es fallback ni escritor productivo.

| Dominio | Hojas/rangos perfilados | Tabla | Filas fuente/procesadas/insertadas/destino | Repository | UI | RLS | Estado |
|---|---|---|---:|---|---|---|---|
| Directorio / Comité | `Directorio!A1:D31` | `public.directory_members` | 30/30/30/30 | `DirectoryRepository` | Inicio y Comité | public read; client write none | PASS |
| Minutas | `Minutas de acuerdos!A1:E7` | `public.minutes` | 5/5/5/5 | `MinutesRepository` | Minuta | public read; client write none | PASS |
| Descargas / Normas | `Descargas2!A1:D17`, `Descarga de formatos!A1:D2`, `Normas y Reglamentos!A1:D3` | `public.institutional_documents` | 8/8/8/8 | `InstitutionalDocumentsRepository` | Normas y Formatos | public read; client write none | PASS |
| Secretaría de Finanzas informativa | `Secretaría de finanzas!A1:S18` y `W1:W18` | `public.institutional_programs` | 17/17/17/17 | `InstitutionalProgramsRepository` | Finanzas | public read; client write none | PASS |
| Catálogos de segmentación | múltiples hojas, incluidas `Choice` e `Íconos` | ninguna | no importado | ninguno | sin cutover | n/a | BLOCKED |

Totales significativos: 60 fuente, 60 procesadas, 60 insertadas, 60 destino, 0 rechazadas y 0 perdidas. Filas físicas vacías clasificadas: 12 (1 Minutas, 10 `Descargas2`, 1 `Descarga de formatos`). No se reordenaron las filas significativas; `sort_order` reproduce el orden de cada lectura fuente.

## Contrato de datos

- `directory_members`: UUID, nombre nullable para preservar dos filas históricas sin nombre, cargo, URL de imagen, Glide row ID, orden y procedencia.
- `minutes`: UUID, título, descripción, URLs históricas, serial Excel raw, fecha ISO derivada, orden y procedencia.
- `institutional_documents`: UUID, `kind` controlado (`download`, `form`, `regulation`), metadatos/URLs, orden y procedencia. Varias hojas convergen por semántica; no se modeló una tabla por hoja.
- `institutional_programs`: UUID, categoría, descripción, imágenes, contacto/redes/ubicación, orden y procedencia. No contiene inversión, rendimiento, saldo ni cálculo financiero.

Todas las tablas tienen coordenada histórica única `(source_snapshot_hash, source_sheet, source_row_ordinal)`, timestamps, checks, índices, RLS habilitada/forzada y solo `SELECT` para `anon`/`authenticated`. No se habilitó CRUD administrativo; queda para una H futura autorizada.

## UI, mocks y fallas

`institutional-content.js` carga los cuatro repositories una vez y proyecta cinco módulos visuales: Comité, Minuta, Normas, Formatos y Finanzas. Los módulos migrados no entran en `sindicatoStore`; `DATA.comite` fue retirado y `comite-photos.js` ya no forma parte del bundle. Ante error se muestra estado controlado con reintento. No existe fallback a `DATA`, mock, `localStorage`, JSON o Google.

Las URLs de PDFs e imágenes permanecen como referencias históricas. No se descargó, movió ni duplicó ningún archivo.

## Legacy protegido

Se excluyó expresamente `Secretaría de finanzas!T:V` (`Inversión`, `Rendimiento`, `Total Rendimiento`). No se leyó ni modificó Ahorro, Préstamos, nómina, amortizaciones, fondos, reportes, queries, conciliaciones, Apps Script o fórmulas. Google quedó read-only.

## Bloqueo de Catálogos

El agregado H-DATA-001 no representa una autoridad única: `Choice` incluye categorías comerciales, materiales, propiedades e inversión; `Íconos` incluye estados de pago/cobro. Separarlo o promover solo una parte crearía una autoridad implícita y podría invadir legacy financiero. Se bloqueó únicamente este dominio, sin tabla, importador, repository ni cambio UI. Requiere mapping por subdominio, owner/escritor y decisión de autoridad.

## Recuperación y evidencia

La recuperación está documentada en `supabase/recovery/20260821000200_drop_supabase_now_content.sql`: detener lectores, ejecutar el rollback explícito y reimportar desde el snapshot fijado. La importación aborta ante hash, shape, conteo, estado parcial o fingerprint inesperado.

Evidencia ejecutada:

- `python scripts/import-supabase-now.py` — dry-run 60/60.
- `npx supabase@2.115.0 db push` — aplicó solo `20260821000200_create_supabase_now_content.sql`.
- `python scripts/import-supabase-now.py --apply` — 60/60, 0 rechazadas, 0 perdidas, fingerprints coincidentes.
- `python scripts/test-h007-live.py` — lectura pública remota 30/5/8/17.
- `node scripts/test-h007.js` — schema/RLS/repositorios/UI/bundle/fallbacks PASS.
- `node scripts/test-h005-browser.js` — login real más UI H-007 30/2/5/17/6 PASS.
- `node scripts/test-h004.js`, `test-h005.js`, `test-h006.js` — regresión PASS.

El intento de consultar metadatos mediante Management API fue denegado con 403 y el dump read-only requirió Docker ausente. No se ocultó ni sustituyó esa limitación: RLS remoto se evidencia por la migración versionada confirmada como aplicada, su DDL inspeccionado y las lecturas públicas reales; no se intentó una escritura destructiva de prueba.
