# H06 — observación

Ventana UTC 2026-09-08 02:42:37–03:13:04, 1.827,671 segundos. Incluye pruebas locales, despliegue y regresión publicada; actividad concurrente real. No es una ventana de carga aislada ni una garantía futura.

- 11.354 commits, nueve rollbacks; cero deadlocks y cero esperas de lock en ambos extremos. No tormenta 40001 en logs. Conexiones 56→57; no se alteraron límites, pools ni Compute.
- 0 bloques físicos leídos, 1.143.567 hits; 54 temporales / 244.632.210 bytes globales. Estos contadores incluyen otros procesos y no permiten atribuir esos temporales a H06. Las consultas EXPLAIN focales no generaron temporales. No se declara resuelta la presión de host de H02.
- Seis 42501: cuatro probes anon del workflow sobre funciones de identidad/contexto; dos denegaciones de program_requests observadas también en regresión local/publicada y previamente en H05. No cambian ese caller ni sus policies. Los recorridos focales del catálogo no registran HTTP fallidos.
- Un 42703 pertenece al query read-only de investigación del harness que usó document_type en vez del esquema real; corregido, sin DML. No es un error nuevo de la aplicación. Dos rollbacks adicionales no están individualmente atribuidos por la muestra agregada; nueve en unos 30 minutos no constituyen una tormenta.
- Los 404 de .image-slots.state.json corresponden al archivo de autoría no publicado, también previo a H06. BrowserErrors=0 en la regresión global final local/publicada.

Integridad concurrente: los 135 productos y 268 vínculos conservan hashes completos. A las 03:05:43 UTC otro actor creó un documento PENDING_REVIEW; el conjunto productivo pasó de 3.525 a 3.526. El filtro temporal conserva exactamente el conteo y hash original de todos los documentos anteriores. Se conserva la discrepancia completa y su atribución sin exportar IDs, email, URLs ni contenido documental. Ninguna prueba H06 escribió productos/documentos/favoritos; las fixtures RLS se revierten transaccionalmente.

Fuentes: observation-start/end/summary.json, logs-observation.json, log-error-attribution.json, global-local-final.json, global-production.json, production-equivalence.json, backend-full-table-drift.json, data-drift-investigation.json y backend-after-delivery.json. Ingestión de logs sujeta a retraso; medición finita.
