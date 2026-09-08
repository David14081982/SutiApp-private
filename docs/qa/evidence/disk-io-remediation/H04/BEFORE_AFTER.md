# H04 — Mismo acceso, menos trabajo

Consulta exacta de la auditoría, bajo authenticated y con el mismo selector de afiliado. El resultado sigue siendo una foto autorizada. Baseline fresca previa a la migración y tres muestras sobre la policy desplegada:

| Métrica | Antes | Después live |
|---|---:|---:|
| Documentos examinados en el plan | 3.044 | 0 |
| Shared buffer hits | 28.164 | 757 en las tres muestras |
| Shared block reads | 0 | 0 |
| Seq scans documentales ejecutados | 1 | 0 |
| Seq scans de catálogo ejecutados | 6 | 6, sin modificar |
| Tiempo SQL | 2.035,627 ms | 29,344 / 36,197 / 82,092 ms |
| has_admin_permission | 6.172 llamadas | 106 |
| Delegado de has_admin_permission | 6.172 llamadas | 106 |
| get_effective_affiliate_id | 3.113 llamadas | 81 |
| Índices nuevos | 0 | 0 |

Reducción de buffer hits: 97,31 %. Mediana posterior 36,197 ms, frente a la muestra fresca anterior de 2.035,627 ms. La muestra histórica de la auditoría fue aproximadamente 8,21 s; no se usa ese tiempo histórico como medición contemporánea ni se promete una latencia fija.

Las tres ramas conservan los índices disponibles. En la foto, la rama affiliate_files resuelve la existencia sin ejecutar los scans de affiliate_documents. Los índices documentales planeados pero con loops=0 no se contabilizan como scans ejecutados. El plan conserva búsquedas por objeto, private_assets_storage_unique y los índices de afiliado/clasificación. Los scans del catálogo pertenecen a las otras policies y quedan fuera de la corrección mínima.

Evidencia cruda: plan-audit-selector-before.json, plan-audit-selector-candidate.json, plan-live-1/2/3.json, function-calls-before.json y function-calls-live.json. Las llamadas se midieron con pg_stat_xact_user_functions y SET LOCAL track_functions, revertido al terminar. No sumar los tiempos inclusivos del helper y su delegado.

Seguridad: 192 casos antes/candidato y 192 comprobaciones live iguales. Las regresiones globales local y GitHub Pages pasan, incluidas imágenes y PDF legítimos, permisos, navegación, fullscreen, refresh y SW/noSW. No se alteró el número de requests frontend ni su flujo: H04 reduce el trabajo de autorización SQL.

Datos: la baseline amplia no fue atómica y coincidió con altas documentales anteriores al despliegue. Por ello sus hashes iniciales difieren. La reconciliación identifica tres assets/documentos nuevos y seis timestamps de clasificación anteriores a H04; programas iguales y hashes estables entre dos capturas posteriores. No se alteraron ni eliminaron esas altas. Detalles en concurrent-data-activity.json, data-timestamp-reconciliation.json y backend-equivalence.json.

Límites: los buffer hits son accesos a buffers, no bytes físicos leídos del disco. Estas muestras tienen shared reads=0; no demuestran que haya desaparecido el paging, la presión de memoria o el I/O del host documentado en H02. Las otras policies aún tienen coste. Se midió esta consulta y se verificó el conjunto de accesos; no se promete igual aceleración para todo documento o consulta.
