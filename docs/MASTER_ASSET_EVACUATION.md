# MASTER ASSET EVACUATION — GLIDE → SUPABASE

## Estado

`OPERATIONALLY COMPLETE / HISTORICAL RECOVERY PENDING` — aceptada por el propietario el 2026-08-22. `HISTORICAL_ASSET_RECOVERY_PENDING = 3` no bloquea la continuidad del MASTER PLAN.

## PRE-CHANGE AUDIT

```text
H: MASTER-ASSET-001
Objetivo: eliminar toda dependencia productiva de archivos hospedados por Glide, preservando archivo físico, semántica de columna, procedencia y relación Supabase.
Alcance: Usuarios SUTIAPP.xlsx; las 98 hojas de SutiApp Final; fuentes históricas aprobadas; Supabase Storage; registro de assets; relaciones por dominio; lectores runtime ya migrados; pruebas de independencia.
Fuera de alcance: modificar Google Sheets/Apps Script; cambiar fórmulas, triggers, saldos, amortizaciones o conciliaciones; inventar ownership; alterar afiliados/Auth/empresas/históricos; cancelar Glide.
Archivos a tocar: este informe; MASTER_COMPLETION_PLAN.md; WORK_QUEUE.md; DECISIONS.md; INVARIANTS.md; SOURCE_OF_TRUTH.md; DATA_MAPPING.md; AGENT_CHANGELOG.md; scripts de inventario/importación/prueba; migración y recovery versionados; repositories/UI solo cuando un dominio migrado conserve una referencia runtime Glide demostrada.
Datos afectados: objetos de archivo copiados byte a byte; metadata técnica; procedencia; relaciones explícitas. Ninguna fila histórica fuente se modifica.
Fuentes de verdad: fuente histórica solo para procedencia/semántica; Supabase Storage + registro relacional para archivo productivo; tablas de dominio Supabase para ownership ya resuelto.
Tablas: app_assets/asset_sources y relaciones existentes; nuevas tablas mínimas para catálogo de columnas, assets privados, archivos de afiliado y vínculos pendientes, sujetas a preflight exacto.
APIs: Google Drive/Sheets read-only; HTTP GET de archivos históricos; Supabase Management/REST/Storage server-side.
Legacy involucrado: lectura de URLs/encabezados en hojas Google, incluida presencia eventual en hojas financieras. No hay escritura ni cutover financiero.
Invariantes: numero_control TEXT raw; affiliate.id UUID como FK; source_url solo provenance; no public read para PII; deduplicación física no elimina relaciones; cero fallback Glide; bloqueo granular de filas no reconciliadas.
Riesgo: CRITICAL por PII, disponibilidad temporal de URLs y volumen global.
Tests: hash/MIME/firma/tamaño; rechazo HTML; preflight remoto; RLS multiusuario; reconciliación por columna; búsqueda runtime; navegador real; regresión acumulada; prueba de independencia.
Recovery: migración aditiva reversible; manifiesto por objeto; no sobrescribir objetos existentes; rollback de relaciones/metadata; objetos nuevos eliminables solo por manifiesto verificado; fuentes históricas intactas.
Status: PASS para inventario read-only y diseño. La escritura remota exige preflight, recovery y clasificación de seguridad completos.
```

## SOURCE OF TRUTH AUDIT

```text
Domain: archivos históricos y archivos productivos de SutiApp.
Authority: la columna/fila histórica decide procedencia y significado; Supabase Storage + registro relacional decide el archivo runtime tras migración.
Readers: scripts administrativos para provenance; repositories de dominio para runtime; propietario/admin/afiliado según RLS para privados.
Writers: importador server-side autorizado y writers administrativos Supabase ya autorizados. Google y Glide no escriben el destino.
Alternative sources: URLs Glide, snapshots y archivos locales son procedencia/fixtures de auditoría, nunca fallback.
Fallbacks: prohibidos. Error Supabase produce placeholder/error controlado.
Caches: app-shell/PWA no cachea PII ni convierte URLs históricas en autoridad.
Conflicts: ninguno para el principio físico; ownership de una fila puede quedar PENDING sin inventarse.
Verdict: SAFE para inventario y copia; cada cutover exige relación inequívoca.
```

## LEGACY GOOGLE AUDIT

```text
Systems/domains: SutiApp Final y fuentes históricas aprobadas; Ahorro/Préstamos pueden contener columnas de archivo.
Reads: metadata, encabezados, celdas con URLs y contexto mínimo de relación.
Writes: NONE.
Calculations/triggers: no se evalúan, cambian ni sustituyen.
Authority: Google conserva autoridad financiera; Storage solo preserva el archivo físico y provenance hasta un cutover de dominio autorizado.
Equivalence: NOT APPLICABLE para bytes; no se afirma equivalencia financiera.
Recovery: fuente Google intacta; inventario reproducible por hash.
Classification: READ ONLY.
Decision: continuar; los assets financieros quedan PENDING_DOMAIN_LINK y fuera del runtime Supabase hasta decisión Phase 7.
```

## Criterios de aborto

- Hash distinto del Excel maestro aprobado.
- Esquema remoto distinto del preflight esperado o colisión parcial.
- Clasificación pública de PII o policy que permita acceso cruzado.
- Respuesta HTML/error disfrazada de archivo, MIME no permitido o hash inconsistente.
- Intento de vincular afiliado por nombre/email o `numero_control` no inequívoco.
- Reemplazo de una referencia runtime sin objeto Supabase verificado.

Un fallo de relación bloquea solo esa referencia; una diferencia de schema o riesgo de exposición bloquea toda escritura remota.

## Reconciliación requerida

El cierre debe publicar conteos agregados por fuente y columna, sin exponer PII ni URLs privadas. El inventario crudo y sus URLs se mantienen fuera del repositorio y solo ingresan a tablas administrativas sin grants de navegador.

## Resultado y reconciliación — 2026-08-22

```text
URLs discovered: 14,480 únicas / 25,358 referencias
Unique files: 13,195 objetos físicos referenciados
Downloaded: 14,477 URLs válidas
Uploaded: 13,050 objetos nuevos (13,047 privados; 3 públicos)
Deduplicated: 1,282 URLs válidas reutilizaron contenido por SHA-256; 12,163 referencias lógicas no requirieron copia adicional
Failed: 3
Public assets: 5,887 referencias; 3 objetos nuevos (los restantes reutilizan assets públicos aprobados)
Private assets: 19,471 referencias; 13,047 objetos
Affiliate-linked: 12,901 referencias / 947 affiliates UUID / 0 ambiguas
Domain-linked: 13,056 referencias
Pending ownership/domain: 12,299 referencias, preservadas sin cutover runtime
Runtime Glide dependencies remaining: 0
Provenance Glide URLs retained: 25,358 URLs de procedencia por referencia
Rows/files lost: 3 no recuperables desde las fuentes disponibles
Historical file columns: 163 = 162 RECONCILED + 1 FAILED; UNMAPPED_FILE_COLUMNS=0
Storage reconciliation: 0 objetos faltantes; 0 huérfanos
```

Los tres fallos son `Íconos!B2:B4` (`activa`, `pendiente de pago`, `SIN COBRO`). La fuente Firebase devuelve HTTP 402, la variante directa de Google Storage devuelve 403 y el archivo vigente más cuatro respaldos aprobados contienen las mismas referencias muertas. No se fabricaron reemplazos y el dominio financiero sigue `PENDING_DOMAIN_LINK`; no hubo cutover de Ahorro/Préstamos.

RLS está habilitada y forzada en `historical_file_columns`, `private_assets`, `historical_asset_sources` y `affiliate_files`. `private-assets` no es público; propietario/admin pasan las pruebas y acceso cruzado/anónimo/escritura normal quedan denegados. `source_url` no tiene grant para usuarios normales.

La independencia productiva pasa con `RUNTIME_GLIDE_FILE_DEPENDENCIES=0`. Branding/PWA quedó reconciliado: relación del sello institucional restaurada y `icon-512.png` sincronizado por hash desde Supabase.

El propietario acepta el cierre operativo con tres recuperaciones históricas pendientes. Los registros fallidos permanecen documentados y sus URLs no se usan como runtime ni se reintentan en ejecución normal. Si se proporcionan los originales: subir a Storage, vincular a `Íconos!B2:B4`, ejecutar `--retry-failed` y cerrar 14,480/14,480.
