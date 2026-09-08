# H05 — Seguridad y equivalencia

| Caso | Evidencia | Resultado |
|---|---|---|
| Diez casos reales: JUB, PROCESS_1, PROCESS_3, sin proceso, saldo cero, sin participante | `equivalence-B.json`, `conditional-equivalence[-live].json` | Payload completo original idéntico; 40 checks |
| Owner/otro afiliado, versión ajena | `security[-live].json` | Otro sujeto obtiene sólo su propio resultado; no reutiliza el ajeno |
| Anon / autenticado sin actor | `security[-live].json` | Mismo rechazo 42501 que el getter original |
| Admin principal | `security[-live].json` | Mismo resultado o rechazo original |
| Impersonación válida / otra sesión Auth | `security[-live].json` | Deriva objetivo autorizado; otra sesión no hereda impersonación |
| Cambios de actor, afiliado, sesión, impersonación, contexto Admin | `unit-tests.json` | Memoria retirada y lectura nueva |
| Logout, respuesta tardía, refresh concurrente | `unit-tests.json` | No repone datos de la identidad anterior |
| Escritura exitosa/incierta, error de lectura | `unit-tests.json` | Invalida; error visible, sin resultado financiero anterior |
| Cambio subyacente de acción, beneficiario, evidencia, fecha/zona | `invalidation-backend.json` | Versión cambia; proyección fresca |
| Navegación con impersonación real | `browser-*-participant.json`, cleanup asociado | Payload completo idéntico; sesión cerrada por RPC existente |

Casos financieros BEFORE/AFTER usan los mismos datos reales dentro de la misma transacción. JSONB compara todo el árbol y orden de arrays; no sólo saldo. Los datos completos permanecen en tablas temporales durante la comparación y se revierten; evidencia publicada contiene hashes, tamaños y campos sin valores privados.

Se encontraron 74 participantes elegibles con Auth confirmado: 9 con saldo Q cero, 65 positivo y ninguno con Q nulo. El caso Q nulo real es NOT APPLICABLE a esa población; la selección visual de nulo/invalid se verifica con fixtures aislados en `test-savings-balance-sync.js`. No se inventó un histórico nulo en producción.

Fixtures backend de invalidación: inserciones nuevas y exclusivamente transitorias en acción, versión/beneficiario y evidencia REPORT H05. ROLLBACK total, triggers append-only activos; no cambio de fila histórica, ledger o regla. La prueba de impersonación SQL también revierte su sesión/auditoría. La prueba browser usa el ciclo normal start/stop auditado y permite cerrar una sesión previamente expirada mediante la lógica existente; jamás reemplaza una activa no expirada.

`backend-after.json` frente a `BASELINE.json`: las 252 funciones existentes, 228 policies, owner/ACL/RLS de tablas, columnas, constraints y triggers son idénticos. Sólo se añaden la RPC y el índice H05. La autorización sigue en backend; la versión del cliente nunca es autoridad ni acepta un objetivo arbitrario.
