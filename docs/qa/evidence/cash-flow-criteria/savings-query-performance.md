# Corrección focal del tiempo de consulta de Ahorro

Status: PASS en aislamiento y en la consulta productiva de sólo lectura. La verificación final de la RPC autenticada corresponde a la publicación integrada.

El defecto estaba en la consulta del reporte: superaba el límite existente de ocho segundos de la RPC. No se modificaron límites globales, roles, permisos, infraestructura, helpers financieros ni datos. Las migraciones 005 y su recovery permanecen intactos. La corrección está exclusivamente en `20261030000600_reports_jc_cash_flow_savings_query.sql`; su recovery restaura exactamente la definición 005.

EXPLAIN ANALYZE de la consulta anterior: 20,539 ms. `dated_balances` consumía 14,506 ms al volver a recorrer los mismos movimientos para cada cuenta y mes; `history_all` se recorría 4,608 veces. La proyección nativa hacía 384 llamadas individuales al helper, con 4,149 ms acumulados.

La 006 realiza una llamada al helper existente `savings_workspace_receipts(NULL)` y conserva exactamente la proyección nativa de `savings_workspace_history`. Agrupa las entradas contables en una sola unión por cuenta y mes. Conserva la separación entre apertura fechada, aportaciones, retiros y otros movimientos, así como los importes desconocidos y la marca de completitud histórica.

`node scripts/test-cash-flow-criteria-savings-query.js`: 16 pruebas PASS. Reutiliza las 15 pruebas anteriores y añade equivalencia exacta de 005/006 para ambos horizontes. Verifica la cadena 001 → 005 → 006, OID/ACL/owner intactos, permisos, fuentes sin cambios y recuperación 006 → 005 → 001.

`node scripts/verify-cash-flow-criteria-savings-query.mjs`: PASS, 5,485 ms incluyendo conexión, con límite local `statement_timeout=6000` y conexión de sólo lectura. Los 11,057 eventos y todos los `known_amount` coinciden exactamente con la captura aprobada. No se ejecutó DDL ni se modificaron datos. La respuesta queda privada en `.tmp/cash-flow-criteria/savings-source-optimized.json`; la evidencia pública sólo contiene conteos, tiempos y hashes.

Evidencia: `savings-query-sql.json`, `savings-query-live.json` y `savings-query-files.json`. La medición final de la RPC autenticada se realizará una vez que el responsable de integración publique el lector optimizado.
