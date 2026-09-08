# H05 — Observación posterior

Ventana: 2026-09-08 01:31:38–01:47:37 UTC, 958 segundos, mismo stats_reset. `observation-summary.json`.

- 6.517 commits, 9 rollbacks, cero deadlocks y cero lock waiters en ambos extremos.
- Cero blks_read; 572.295 buffer hits agregados de toda la base.
- 30 temporales / 134.349.129 bytes a nivel de toda la base. No son una medición aislada de H05 ni se declaran eliminados.
- Conexiones observadas: 61 → 60 (incluye procesos visibles en pg_stat_activity; no equivale a un nuevo pool de aplicación).
- Cinco errores SQLSTATE 42501: cuatro denegaciones en las funciones Auth que el workflow prueba explícitamente como anon, y una en la tabla `program_requests`. `log-error-attribution.json` identifica los objetos sin exportar mensajes privados. Las cuatro primeras coinciden con los probes del workflow 34177450122; no se atribuye la quinta a un caller concreto con esta captura. Ninguna referencia Savings; no hay tormenta 40001. El dominio Requests y sus permisos no fueron modificados por H05.

`rpc-statement-statistics.json`: desde la introducción de la RPC condicional se registran 30 ejecuciones HTTP, cero shared reads y cero bloques temporales leídos/escritos. Su media acumulada incluye lecturas frías, validaciones y presión variable del host; no sustituye los EXPLAIN comparables. Los temporales agregados de la ventana no aparecen en estas ejecuciones de la RPC H05. No se atribuye el resto a una causa específica con esta muestra.

La regresión global y los dos recorridos publicados pasan sin errores de navegador. Las estadísticas y logs tienen ventana finita y pueden sufrir retraso de ingestión. La atribución de host/paging y acciones pendientes de Supabase de H02 permanece vigente; H05 no cambia Compute, pools, shared_buffers ni límites de conexiones.
