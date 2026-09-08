# H05 — Recuperación

Archivo ejecutable: `supabase/recovery/20260907000500_savings_read_work.sql`. Guards de definición, owner, SECURITY, search_path, grants e índice; lock_timeout 2 s y statement_timeout 30 s. Sin CASCADE, DML financiero ni cambios a históricos.

1. Aplicar recovery: sustituye únicamente el endpoint H05 por un delegador fresco (`cacheable:false`, `modified:true`) al getter original y elimina únicamente el índice H05.
2. Publicar los dos módulos anteriores desde `19eb53d`, regenerar bundle y avanzar cachebusters. El endpoint delegante permanece para clientes H05 que sigan abiertos; éstos funcionan y dejan de reutilizar datos.
3. Verificar actor/contexto, un caso correcto, equivalencia completa y acceso rechazado. No eliminar el endpoint mientras puedan existir clientes abiertos que lo invoquen.

La retirada posterior del endpoint sería mantenimiento independiente, después de demostrar que no hay callers; no es necesaria para revertir esta optimización.

`recovery-rehearsal.json`: migración → recovery en una transacción revertida, diez resultados completos BEFORE/optimizado/recuperado idénticos, índice retirado y clientes abiertos compatibles. La migración acepta sólo ausencia u objetos H05 de hashes conocidos; un drift detiene la ejecución. `before/published/` contiene los dos módulos anteriores; el bundle público anterior está en Git.
