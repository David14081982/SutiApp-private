# H03 ? Before / after

Medición con Chrome real, misma cuenta administrativa y RLS productivas; tres ciclos estables por versión. Evidencia: http-before-after.json.

| Métrica por ciclo | Publicado anterior | Candidato H03 |
|---|---:|---:|
| HTTP/RPC+lecturas de dominio | 9 | 1 |
| RPC contexto | 1 | 1 |
| Lecturas HTTP adicionales | 8 | 0 |
| Bytes decodificados de respuesta | 45,016 | 1,713 |
| ?ltima respuesta, tres muestras (ms) | 443 / 463 / 404 | 247 / 208 / 446 |
| Estados HTTP | Todos 200 | Todos 200 |

Reducción observada: 88.9% de llamadas y 96.2% de bytes. Hash de proyecciones visibles idéntico. Latencia media observada 436.7→300.3 ms; muestra pequeña bajo presión del host, no garantía de latencia ni atribución causal sobre memoria/swap.

Cinco ciclos aislados y tres ciclos de navegador: una RPC, cero lecturas redundantes. Intervalo real30s: una RPC. Cambio externo de banner: contexto+una lectura; cambio oculto: sólo seguridad, contenido al regresar. Impersonación cambia sujeto e invalida; ciclos estables dentro del mismo sujeto conservan el ahorro.

La RPC nueva sí ejecuta trabajo SQL: getter original más fingerprints de filas visibles y dependencias. EXPLAIN live: 130.373 ms, 2,320 shared hits, cero shared reads, cero temporales, cero bloques escritos en esa muestra. No se afirma que desaparezcan ocho scans SQL ni que esta H haya resuelto la presión del host. Las huellas evitan ocho consultas PostgREST con sus proyecciones anchas/embeds, serialización y tráfico; un rewrite físico puede provocar una invalidación conservadora sin cambiar datos de negocio.

Carga inicial, token/context primer sin huellas, edición explícita, cambio real de datos o permisos pueden exigir lecturas adicionales. Mantener frescura externa es parte de la equivalencia, no una regresión de la optimización.
