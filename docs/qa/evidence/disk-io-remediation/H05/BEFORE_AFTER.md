# H05 — Medición

| Consulta real | Antes: filas examinadas → devueltas | Después: filas examinadas → devueltas | Hits antes → después | ms antes → después |
|---|---:|---:|---:|---:|
| Último PARTICIPANT | 364 → 1 | 1 → 1 | 849 → 3 | 23,739 → 0,053 |
| Historia AA:DO | 42.229 → 15 | 93 → 15 | 1.676 → 9 | 33,063 → 0,118 |
| Futuro AA:DO | 42.229 → 46 | 93 → 46 | 1.676 → 9 | 9,753 → 0,161 |
| RPC completa original | 1 payload | 1 payload idéntico | 11.523 → 1.227 | 1.349,891 → 31,323 |
| RPC condicional estable | Proyección completa repetida | 0 llamadas al getter completo | 75 | 5,800 |

`plan-before-*`, `plan-live-*`, `conditional-warm-plan-live.json` y `conditional-warm-calls-live.json`. En planes simples, examinadas = devueltas + descartadas por filtro, por loop; no confundir buffer hits con filas. Historia/futuro pasan de Seq Scan a Bitmap Index/Heap Scan; la búsqueda de última fila pasa al índice nuevo. Reads medidos en estos planes live: cero. La muestra inicial y posterior tuvieron distinta presión/caché del host; los tiempos son muestras, no percentiles de carga. La reducción de filas/hits y las llamadas evitadas son evidencia más estable que el tiempo aislado.

Los candidatos A y B se compararon separadamente en transacciones revertidas. `index-sizes.json`, `plan-A-*`, `plan-B-*`, `equivalence-A.json` y `equivalence-B.json`. A ocupó 1.925.120 bytes; B 770.048. B fue el único aplicado.

| Navegación real | Antes | Después local |
|---|---:|---:|
| Participante certificado: RPC totales | 2 | 2 |
| Participante: proyecciones completas | 2 | 1 |
| Participante: bytes decodificados | 32.100 | 16.751 |
| Sin participante: bytes decodificados | 1.164 | 1.215 |

`browser-before[-participant].json`, `browser-local[-participant].json`, `browser-equivalence.json`. BEFORE corresponde al frontend publicado anterior, con índice ya aplicado al realizar esta medición HTTP; las mediciones SQL BEFORE preceden al índice. No se comparan esos tiempos HTTP como aislamiento del efecto del índice. La navegación y sus llamadas/payloads sí permiten medir la reutilización frontend.

Los payloads financieros completos y HTML de Ahorro/detalles se compararon en memoria, conservando únicamente hashes y estructura sin valores privados. Igualdad en ambos casos. Las 24 tablas Savings conservan exactamente conteos y hashes completos de filas antes/después (`financial-table-equivalence.json`).

FINANCIAL_EQUIVALENCE = PASS
