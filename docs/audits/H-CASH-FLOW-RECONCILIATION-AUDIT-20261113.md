# SUTIAPP — AUDITORÍA DE CONCILIACIÓN DEL FLUJO DE EFECTIVO Y DIAGNÓSTICO PARA ASTRA

Auditoría de solo lectura. Corte: **13-nov-2026 (America/Hermosillo)**. Consulta del panel: `2026-11-13T17:15:15Z`.
No se modificó código, Google Sheets, Supabase ni reportes. No hay commits. Los únicos archivos nuevos son este informe y la matriz CSV de evidencia.

## 0. Cómo se obtuvo cada fuente

| Fuente | Cómo se leyó | Nota |
|---|---|---|
| **A · Google Sheets "SutiApp Final"** | API de Sheets con la cuenta lectora del proyecto (`spreadsheets.readonly`), valores sin formato. Hojas: `HISTORIAL P V2` (20,841 filas), `Historial de solicitudes` (2,986), `HISTORIAL DE PRESTAMOS`, `Reporte Ahorro` (5,256), `Ahorro`, `Solicitud de retiro` (228), `Conciliación Programas`, `Query fondos`. | Recalculado de forma independiente con las reglas de la sección 7 del encargo. |
| **B · Panel** | Edge Function `reports-jc` acción `CASH_FLOW` con la cuenta de prueba administrativa `H005_TEST`, ventanas `2022-01` … `2029-01`; la respuesta se proyectó con el mismo código que usa el navegador (`projectCashFlowSnapshot`). | El worker publicado en sutiapp.com tiene el mismo SHA-256 que el local (`1e28653b…603dd`). No se abrió la pantalla en un navegador: lo comparado es el resultado que la pantalla pinta, no la pantalla misma. |
| **C · Excel** | Se generó con el exportador real `app/cash-flow-export.js` sobre el mismo resultado, para 2025, 2026, 2027 y 2028, y se leyó el XML del archivo. | No se descargó desde el botón de la pantalla; el archivo es el que produce ese mismo código. |

Las filas A, B, C y G de `HISTORIAL P V2` que recibe el panel son idénticas a mi lectura directa de la hoja (0 diferencias en 20,841 filas). El panel no usa caché ni copia en Supabase para préstamos.

**Origen real de cada bloque del reporte**

| Bloque | Origen | Dónde se calcula |
|---|---|---|
| Préstamos: recuperación, programado, desglose | Google `HISTORIAL P V2` A, B, C, G, Z, AB, AC, AD | `supabase/functions/reports-jc/cash-flow-loans.mjs` (corre en el navegador dentro de `app/cash-flow-projection-worker.js`) |
| Préstamos: colocación y número de préstamos | Google `Historial de solicitudes` A, E, H, J, Y; respaldo `HISTORIAL P V2` U / AG / J | mismo archivo |
| Ahorro Voluntario | **Supabase**, no Google: RPC `get_admin_reports_jc_cash_flow` (registros importados de la hoja `Ahorro` hasta 05-sep-2026 + recibos canónicos desde 15-sep-2026) | `cash-flow.mjs`, `cash-flow-savings.mjs` |
| Inversores | **Supabase**: RPC `get_admin_reports_jc_cash_flow_investors` | `cash-flow-investors.mjs` |
| Totales | Suma en el navegador | `cash-flow-consolidated.mjs` |
| Excel | El mismo objeto ya calculado; no vuelve a consultar ni a sumar | `app/cash-flow-export.js` |

## A. Resumen ejecutivo

- **Meses analizados:** 84 (ene-2022 a dic-2028). Hay datos de préstamos en 48 (ene-2025 a dic-2028); 2022-2024 sólo tienen 11 cuotas de un programa excluido.
- **Préstamos, cuatro programas incluidos** (Caja de Ahorro, Sutiexpress, Caja Chica, Adelantos de Nómina): 380 celdas mes/programa/concepto con dato. **353 coinciden al centavo y 27 difieren.**
  - Recuperación realizada y programada (columna B por fecha A): **coinciden en los 48 meses y los 4 programas**.
  - Colocación y número de préstamos: **9 meses con diferencia** (ene, feb, mar, abr, may, jul, ago 2025; sep y nov 2026). 39 meses coinciden.
- **Ahorro 2026:** aportaciones coinciden ene–jun y ago; difieren jul, sep, oct, nov. Retiros coinciden salvo octubre.
- **Excel contra panel:** 1,512 celdas por año, **0 diferencias** en 2025, 2026, 2027 y 2028. El Excel no agrega un error propio en las cifras; hereda las del panel.
- **Importe de las diferencias, sin compensar signos:**

| Bloque | Importe absoluto |
|---|---:|
| Capital colocado, 4 programas (17 celdas) | $437,105.70 |
| Ahorro, movimientos registrados (jul–nov 2026) | $22,188.20 |
| Ahorro, aportaciones programadas nov-2026 y dic-2026 | $153,050.00 |
| Ahorro, aportaciones programadas 2027 (12 meses × $89,900) | $1,078,800.00 |
| Cuotas de programas que el reporte no incluye (2,582 cuotas, 2022-2027) | $2,023,200.39 |

- **Causas principales**
  1. Ocho programas de `HISTORIAL P V2` no entran al reporte, aunque sus totales se titulan "todos los fondos".
  2. El capital de un préstamo se omite cuando el monto está guardado como texto, cuando el ID de la solicitud está duplicado o cuando H de la solicitud difiere de J de PV2.
  3. El panel coloca 27 préstamos que no tienen solicitud aprobada, tomando fecha y capital de PV2.
  4. "Capital pendiente de recuperar" es un subtotal que pierde préstamos de un mes a otro, por lo que no es un saldo continuo.
  5. Ahorro viene de Supabase y ya no coincide con las pestañas de Google desde septiembre de 2026.
  6. El saldo de Ahorro salta $40,620 en noviembre sin movimiento que lo respalde.

**Advertencia sobre el concepto.** "Recuperación realizada" es la suma de cuotas con fecha A ≤ corte. No demuestra un cobro bancario. El reporte lo titula "Recuperación realizada" y lo suma en "Total de entradas registradas"; esa mezcla entre cuota vencida y efectivo cobrado sigue presente y no la cambié ni la corregí.

## B. Matriz de conciliación

Matriz completa (502 filas, todos los meses con dato): `docs/qa/evidence/cash-flow-reconciliation-20261113/matriz-conciliacion.csv`, con las columnas Mes, Programa, Concepto, Google Sheets, Panel, Excel, Diferencia, Estado, Causa.

Aquí van sólo las filas que difieren. Todas las demás celdas de los cuatro programas coinciden.

### B.1 Préstamos — colocación

| Mes | Programa | Concepto | Google Sheets | Panel | Excel | Diferencia | Causa |
|---|---|---|---:|---:|---:|---:|---|
| 2025-01 | Caja de Ahorro | Capital / préstamos | 82,000 / 7 | 118,000 / 11 | igual al panel | +36,000 / +4 | Huérfanos 117, 161, 164, 132 |
| 2025-01 | Sutiexpress | Capital / préstamos | 0 / 0 | 50,000 / 2 | igual | +50,000 / +2 | Huérfanos 167, 168 |
| 2025-02 | Caja de Ahorro | Capital / préstamos | 218,000 / 14 | 228,000 / 15 | igual | +10,000 / +1 | Huérfano 212 |
| 2025-02 | Caja Chica | Capital / préstamos | 111,500 / 13 | 117,500 / 14 | igual | +6,000 / +1 | Huérfano 219 |
| 2025-03 | Caja de Ahorro | Capital / préstamos | 142,000 / 11 | 173,000 / 15 | igual | +31,000 / +4 | Huérfanos 260, 170, 235, 237 |
| 2025-03 | Sutiexpress | Capital / préstamos | 60,000 / 4 | 84,000 / 7 | igual | +24,000 / +3 | Huérfanos 263, 169, 250 |
| 2025-03 | Caja Chica | Capital / préstamos | 82,000 / 9 | 122,000 / 13 | igual | +40,000 / +4 | Huérfanos 203, 244, 195, 254 |
| 2025-03 | Adelantos | Capital / préstamos | 60,000 / 4 | 63,000 / 5 | igual | +3,000 / +1 | Huérfano 242 |
| 2025-04 | Caja de Ahorro | Capital / préstamos | 413,269.60 / 27 | 462,200 / 30 | igual | +48,930.40 / +3 | Huérfanos 252, 256, 272 (+50,000) y solicitud 289 omitida (−1,069.60) |
| 2025-04 | Caja Chica | Capital / préstamos | 161,000 / 21 | 171,000 / 22 | igual | +10,000 / +1 | Huérfano 271 |
| 2025-05 | Caja de Ahorro | Capital | 186,500 | 180,500 | igual | −6,000 | Solicitud 389 omitida |
| 2025-07 | Adelantos | Capital / préstamos | 45,000 / 4 | 55,000 / 5 | igual | +10,000 / +1 | Huérfano 337 |
| 2025-08 | Sutiexpress | Capital / préstamos | 40,500 / 4 | 42,000 / 5 | igual | +1,500 / +1 | Huérfano 492 |
| 2026-09 | Caja de Ahorro | Capital | 883,419 | 877,419 | igual | −6,000 | ID 2696 duplicado (−16,000) y huérfano 2697 (+10,000) |
| 2026-11 | Caja de Ahorro | Capital | 622,616.09 | 467,940.79 | igual | −154,675.30 | Solicitudes 3073 y 3078 con monto en texto |

"Google Sheets" = solicitudes con Estado Iniciado/Liquidado, por mes de J (Fecha solicitud), sumando H.

### B.2 Programas que el reporte no incluye (cuotas de `HISTORIAL P V2`, columna B)

| Año | Programa (columna G) | Cuotas | B con fecha ≤ corte | B programado | Panel / Excel |
|---|---|---:|---:|---:|---|
| 2022-2024 | Descuentos SUTISSSTESON | 11 | 20,596.02 | 0 | sin fila |
| 2025 | Vales y membresías | 80 | 26,725.00 | 0 | sin fila |
| 2025 | Suti Auto / Terrenos / Cirugías / Panel Solar | 124 | 223,984.87 | 0 | sin fila |
| 2025 | Suti Tours | 110 | 82,070.55 | 0 | sin fila |
| 2025 | Descuentos SUTISSSTESON | 79 | 193,966.56 | 0 | sin fila |
| 2026 | Seguro Colectivo Suti | 1,404 | 405,570.00 | 10,890.00 | sin fila |
| 2026 | Vales y membresías | 369 | 88,305.00 | 26,695.00 | sin fila |
| 2026 | Suti Auto / Terrenos / Cirugías / Panel Solar | 172 | 411,579.78 | 66,601.75 | sin fila |
| 2026 | Suti Tours | 57 | 57,761.85 | 3,264.68 | sin fila |
| 2026 | Descuentos SUTISSSTESON | 116 | 203,382.79 | 50,468.38 | sin fila |
| 2027 | Proyectos y SUTISSSTESON | 61 | 0 | 151,338.16 | sin fila |
| **Total** | | **2,582** | **1,713,942.42** | **309,257.97** | |

El desglose mes por mes está en el CSV.

### B.3 Ahorro Voluntario 2026

Google = `Reporte Ahorro` (misma información que la matriz de la hoja `Ahorro`) y `Solicitud de retiro` con Estado Completado. Panel = "Aportaciones recibidas" + "Importes históricos de aportación y rendimiento sin desglose".

| Mes | Concepto | Google Sheets | Panel | Excel | Diferencia | Causa |
|---|---|---:|---:|---:|---:|---|
| 2026-01 a 2026-06, 2026-08 | Aportaciones | — | — | — | 0 | Coinciden (jun: 213,860 + 404,334.38 = 618,194.38) |
| 2026-07 | Aportaciones | 414,501.39 | 414,801.39 | igual | +300.00 | Folio 815, 05-jul |
| 2026-09 | Aportaciones | 468,232.78 | 467,232.78 | igual | −1,000.00 | 7 registros, ver C.6 |
| 2026-10 | Aportaciones | 477,182.78 | 487,006.58 | igual | +9,823.80 | 34 registros, ver C.6 |
| 2026-11 (≤13) | Aportaciones | 12,300.00 | 14,200.00 | igual | +1,900.00 | Folios 228256, 225263, 232504 |
| 2026-02 a 2026-07 | Retiros pagados | — | — | — | 0 | Coinciden (jul: 2,533,105.40) |
| 2026-10 | Retiros pagados | 0 | 9,164.40 | igual | +9,164.40 | Retiro total del folio 12603, sólo en Supabase |
| 2026-07 | Retiros parciales / totales | 480,255.20 / 2,052,850.20 | 0 / 0 | igual | clasificación | Los 228 retiros históricos caen en "sin clasificación" |
| 2026-11 (>13) | Aportaciones programadas | 468,182.78 | 531,732.78 | igual | +63,550.00 | Inscripciones sólo en Supabase |
| 2026-12 | Aportaciones programadas | 480,482.78 | 569,982.78 | igual | +89,500.00 | 67 folios sólo en Supabase |
| 2027-01 a 2027-12 | Aportaciones programadas (cada mes) | 480,482.78 | 570,382.78 | igual | +89,900.00 | Mismo motivo |
| Hoy | Saldo | 2,954,989.06 | 2,957,048.46 | igual | +2,059.40 | 36 folios, ver C.6 |

## C. Desglose de diferencias

### C.1 Programas excluidos — $2,023,200.39 en 2,582 cuotas

- **Evidencia:** columna G de `HISTORIAL P V2` tiene 12 familias; el reporte sólo crea filas para 4.
- **Cálculo del código:** `cash-flow-loans.mjs:3` define `CASH_FLOW_LOAN_FUNDS` con cuatro claves; `:9` y `:24-25` descartan toda fila cuyo `fundGroup(G)` no sea una de ellas. `fundGroup` (`report.mjs:42-55`) sí reconoce las otras familias (`insurance`, `membership`, `union`, `projects`, `travel`), así que el descarte es deliberado, no un nombre mal escrito.
- **Efecto:** las filas "Recuperación total · todos los fondos" y "Capital pendiente de recuperar · todos los fondos" (`cash-flow-consolidated.mjs:112-126`) suman sólo cuatro programas. La hoja "Base PV2" del Excel trae 18,258 cuotas de las 20,841 de la hoja.
- **Clasificación:** error de consulta (filtro) y de etiqueta. Si esos programas deben o no formar parte del flujo es decisión del propietario; lo demostrado es que hoy no están y el título dice lo contrario.

### C.2 Monto guardado como texto — $154,675.30 (nov-2026, Caja de Ahorro)

| ID | Fila solicitudes | H (Monto) | Filas PV2 | PV2 J | Panel |
|---|---|---|---|---|---|
| 3073 | 2967 | `"36540"` (texto) | 20767-20773 | `"36540"` (texto) | capital sin determinar |
| 3078 | 2975 | `"118135.3"` (texto) | 20794-20818 | `"118135.3"` (texto) | capital sin determinar |

- **Cálculo del código:** `cash-flow-loans.mjs:5`, `money()` exige `typeof v==='number'`. Un texto numérico devuelve `null`; `:56-61` lo convierte en `CAPITAL_SOLICITUD_AMBIGUO` y `:75` emite el capital como `null`.
- **Resultado correcto:** nov-2026 Caja de Ahorro = $622,616.09; el panel muestra $467,940.79 como "información parcial". Los dos préstamos sí se cuentan.
- **Efecto en saldo:** esos $154,675.30 tampoco entran a "Capital pendiente".
- **Clasificación:** error de cálculo (interpretación de tipo). Son las únicas 2 solicitudes aprobadas con H en texto; en PV2 la columna B no tiene ningún valor en texto.

### C.3 ID duplicado en `Historial de solicitudes` — sep-2026, Caja de Ahorro

- Filas 2254 y 2255 tienen ambas **ID 2696**: una de $6,000 (23-sep) y otra de $10,000 (24-sep). En PV2 existen los préstamos 2696 (J = 6,000, filas 17894-17905) y **2697** (J = 10,000, filas 17906-17908). La fila 2255 debería llevar el ID 2697.
- **Cálculo del código:** `:57` exige que todos los montos aprobados de un mismo ID sean iguales; como no lo son, el capital de 2696 queda `null`. El 2697 no encuentra solicitud y entra como huérfano con $10,000.
- **Resultado:** hoja $883,419; panel $877,419. Faltan los $6,000 de la fila 2254.
- **Clasificación:** error de origen de datos, mal tratado por el código (descarta ambos importes en vez de exponer el conflicto).

### C.4 H de la solicitud distinto de J de PV2 — 2025, Caja de Ahorro

| ID | Fila solicitud | H | PV2 J | PV2 K | Mes | Efecto |
|---|---|---:|---:|---:|---|---|
| 289 | 97 | 1,069.60 | 6,000 | 7,440 | 2025-04 | capital omitido |
| 389 | 179 | 6,000 | 10,000 | 16,000 | 2025-05 | capital omitido |

`cash-flow-loans.mjs:62` anula el capital cuando alguna fila PV2 trae un J distinto. En el 289 el total K (7,440) es coherente con 6,000, no con 1,069.60: el dato erróneo parece ser H. Clasificación: error de origen de datos; el código lo deja como parcial sin importe.

### C.5 Préstamos colocados sin solicitud aprobada — $281,500 (26 en 2025, 1 en 2026)

- IDs 2025: 117, 132, 161, 164, 167, 168, 169, 170, 195, 203, 212, 219, 235, 237, 242, 244, 250, 252, 254, 256, 260, 263, 271, 272, 337, 492. 2026: 2697 (ver C.3). 2025 suma $271,500 en 26 préstamos; el de 2026 suma $10,000. El importe por mes está en la tabla B.1.
- **Cálculo del código:** `:52-54` — si el ID no existe en `Historial de solicitudes` pero PV2 tiene una fecha única en U ("Autorizado"), el préstamo se coloca con fecha U y capital J de PV2.
- **Contraste con la regla:** la regla C pide fecha de solicitud. Estos préstamos no tienen solicitud; el panel usa la fecha de autorización y la titula "Capital colocado por fecha de solicitud". Quien cuente solicitudes en la hoja obtendrá menos préstamos en esos meses.
- **Clasificación:** diferencia legítima de población, con etiqueta incorrecta. Requiere decisión: incluirlos (como hoy) o no.

### C.6 Otros casos de colocación que no se ven en el mes

| ID | Hallazgo | Efecto |
|---|---|---|
| 202 (fila 32, Caja Chica, $10,000) | J (Fecha solicitud) vacía | Nunca se coloca ni se cuenta en ningún mes; queda en "fuera de distribución" |
| 2981 (fila 2835, Caja de Ahorro, $100,000) | J = **29-oct-2029**; PV2 U = 28-oct-2026 | No se coloca ni cuenta; su capital no entra al saldo pendiente hasta 2029, aunque sus 36 cuotas ya se suman como recuperación programada |
| 2728, SR-2026-000128, SR-2026-000194 | Aprobadas sin cuotas en PV2 | Se colocan y cuentan, pero su saldo pendiente queda sin determinar |

Clasificación: error de origen de datos (202 y 2981). El código no avisa en la celda del mes.

### C.7 Ahorro — detalle por folio

El panel no lee Google para Ahorro. Usa Supabase: registros importados de la hoja hasta el 05-sep-2026 y recibos canónicos desde el 15-sep-2026. Por la regla 14 de `AGENTS.md`, los valores de Supabase son los válidos.

- **Jul +300:** folio 815, 05-jul-2026. Importado 300; la hoja hoy tiene 0 (la hoja cambió después de la importación).
- **Sep −1,000:** folios 10317 (15-sep +200, 30-sep −200), 11288 (−200, −200), 11940 (−300), 11811 (−500), 9036 (+200).
- **Oct +9,823.80:** 34 registros. Sólo en Supabase (+): 13200, 4183, 12143, 12648, 7289, 5575, 1536, 14053, 11782, 12245, 11158, 5151, 10424, 2321, 12159, 11239, 2766, 12564, 11141 y 12098 (5,923.80). Sólo en la hoja (−): 10317, 11326, 11940, 11288, 11811, 6447, 5685 (4,000). Importe distinto: 9036 (200 contra 300).
- **Nov +1,900:** folios 228256 (400), 225263 (500), 232504 (1,000), sólo en Supabase.
- **Programado:** 67 folios con plan en Supabase que la hoja no proyecta; ningún folio al revés.
- **Clasificación:** diferencia legítima entre fuentes. No es un defecto del reporte; la hoja de Ahorro dejó de ser la fuente.

### C.8 Ahorro — saldo que salta $40,620 en noviembre

- El panel muestra una fila "Cambios de base de saldo (sin movimiento de efectivo)": +5,790 en marzo, −1,200 en septiembre y **+40,620 en noviembre**.
- **Origen:** de enero a octubre el saldo es la suma de movimientos fechados; en el mes vigente es el saldo canónico por cuenta. 17 cuentas tienen saldo histórico negativo (retiraron más de lo que el historial 2026 les registra) y su saldo canónico es 0 o mayor. Folios: 2303 (+13,170), 230581 (+4,000), 10665, 13301, 11101, 10554, 1685 (+2,500 c/u), 8167, 11686 (+2,000 c/u), 7976 (+1,750), 11402 (+1,500), 8791, 10390, 4935 (+1,000 c/u), 2625, 226290 (+500 c/u), 2641 (−300).
- **Primer mes donde nace:** feb-2026 (folio 226290, −500), mar (2625), abr (2303, −11,170); el grueso en **jul-2026** (13 cuentas, retiro masivo). La suma de saldos negativos pasa de −14,170 en junio a −40,920 en julio y se arrastra hasta octubre.
- **Efecto:** los saldos de marzo a octubre están subestimados y se muestran como "información parcial"; noviembre "recupera" $40,620 sin efectivo.
- El +5,790 de marzo es el retiro del folio 12828 (11-mar-2026, "SALDO MANUAL"), que sale como efectivo pero no se pudo ligar a una cuenta.
- **Clasificación:** error de saldo acumulado. Causa de fondo: el historial arranca en 2026 y los retiros incluyen saldo y rendimiento de 2025.

### C.9 Ahorro — saldo de 2025 presentado como aportación de enero

El 15-ene-2026 la hoja registra 152 movimientos por $1,500,144; 145 de ellos superan 1.5 veces la cuota quincenal del ahorrador, con un excedente de **$1,397,184**. Ejemplo: folio 4944, cuota 300, movimiento 20,121. La hoja resume "AHORRO 2025" en $1,347,914. El panel muestra $1,658,054 como "Aportaciones recibidas" de enero y lo suma a "Total de entradas registradas" ($3,873,808.96). El excedente lo medí con una regla aproximada (1.5 × cuota), no con un marcador de la fuente. Clasificación: pendiente de confirmación del propietario; si es saldo trasladado, las entradas de enero están sobrestimadas en ese orden.

### C.10 Retiros sin clasificación parcial / total

`Solicitud de retiro` columna E dice Completo (195), Parcial (31) y "-" (2). En el panel los 228 retiros históricos caen en "Retiros pagados sin clasificación parcial / total"; las filas de retiros parciales y totales muestran 0 en julio aunque la hoja tiene $480,255.20 y $2,052,850.20. El total del mes sí coincide. No localicé la línea exacta: el evento ya llega como `withdrawal_unspecified` desde el RPC `get_admin_reports_jc_cash_flow`. Clasificación: error de consulta; ubicación pendiente.

### C.11 Saldos de préstamos: "Capital pendiente de recuperar" no es continuo

- **Cálculo del código:** `cash-flow-loans.mjs:134-141`. El saldo de un préstamo es `capital − suma de AD pagado`, y queda `null` si cualquier cuota ya vencida tiene AD no numérico. `cash-flow-consolidated.mjs:80` muestra la suma de los que sí se pudieron calcular.
- **Evidencia:** saldo final ≠ saldo anterior + colocado − capital recuperado en casi todos los meses. Caja de Ahorro 2026: oct −$667,962, nov −$100,000. En diciembre de 2026 (mes futuro) el saldo mostrado baja de $2,590,172 a $1,310,926 porque 21 préstamos más pasan a `null`, no porque se cobren. Caja Chica dic-2026: −$1,108,339; Adelantos: −$713,462.
- **Por qué crece:** 2,340 cuotas de los cuatro programas tienen AD en blanco (482) o con texto "REVISAR: …" (1,858). Los préstamos nuevos de octubre con primera cuota el 30-oct y AD en blanco salen del saldo el mismo mes en que se colocan.
- **Primer mes:** ene-2025 (1 préstamo de Caja de Ahorro y 1 de Caja Chica sin saldo). A nov-2026 son 215 préstamos sin saldo determinado.
- **Clasificación:** error de saldo acumulado. La cifra es un subtotal válido de lo calculable, pero se presenta como saldo y se compara mes a mes.

### C.12 Desglose capital / interés / administración

- Conservación comprobada: capital + interés + administración + sin desglose + redondeo = recuperación, en cada mes y programa.
- 2026: recuperado $10,266,489.70; sin desglose $1,773,896.53 (17.3 %); redondeo $4.19. 2025: $6,183,962.17; sin desglose $863,940.44; redondeo $1.20.
- Contra la suma directa de AD, AB y Z numéricos de la hoja, el panel descarta además $41,903.47 de AD y $4,570 de AB en 6 celdas (ago, oct, nov 2026) por las reglas `AD_ACUMULADO_SUPERA_CAPITAL_ORIGINAL` y `COMPONENTES_SUPERAN_CUOTA` (`:84-86`, `:103`). Ejemplo: Sutiexpress ago-2026, −13,200 de AD de un solo préstamo.
- Clasificación: diferencia legítima (el origen no tiene el dato), salvo esas 6 celdas, que son una regla del código.

### C.13 Diferencia de base de fecha contra `HISTORIAL DE PRESTAMOS`

Si la conciliación manual se hace con `HISTORIAL DE PRESTAMOS` columna J ("Fecha de aprobación"), 364 de 1,709 préstamos caen en un mes distinto al de su solicitud ($4,443,280.25) y **65 de 92 meses/programa difieren** del panel. El panel sigue la regla C (fecha de solicitud). Clasificación: diferencia legítima entre conceptos; es la explicación más probable de "unos meses coinciden y otros no" en colocaciones.

## D. Errores de programación

| # | Archivo y línea | Condición | Por qué produce un resultado distinto |
|---|---|---|---|
| D1 | `cash-flow-loans.mjs:3, 9, 24-25` | `family()` sólo acepta 4 claves | Descarta 2,582 cuotas de 8 programas |
| D2 | `cash-flow-consolidated.mjs:112-126` | Etiquetas "todos los fondos" | Suman 4 programas |
| D3 | `cash-flow-loans.mjs:5` (también `cash-flow.mjs:8`, `cash-flow-consolidated.mjs:6`) | `typeof v==='number'` | Un monto en texto se trata como dato faltante |
| D4 | `cash-flow-loans.mjs:56-62` | `one(requestAmounts)` y comparación con J de PV2 | Un ID duplicado o un H distinto anula todo el capital |
| D5 | `cash-flow-loans.mjs:52-55` | Huérfano con U único | Coloca por fecha de autorización bajo el título "fecha de solicitud" |
| D6 | `cash-flow-loans.mjs:73-78` | `placementDate<=asOf` | Una fecha J futura por error (2029) o vacía saca el préstamo del reporte sin avisar en el mes |
| D7 | `cash-flow-loans.mjs:134-141` y `cash-flow-consolidated.mjs:80-81` | Saldo `null` por préstamo, se muestra `knownAmount` | El saldo pierde préstamos de un mes a otro |
| D8 | `cash-flow-savings.mjs:75-104` (`savings_basis_adjustment`) | Puente entre saldo histórico y saldo canónico | El ajuste se acumula y aparece completo en el mes vigente |
| D9 | RPC `get_admin_reports_jc_cash_flow` (línea no localizada) | Retiros históricos sin tipo | 228 retiros sin clasificar |
| D10 | `app/cash-flow-export.js` (`baseSheets`) | Fechas como texto; "Concepto del reporte" sin programa | Ver sección Excel |

**Excel — respuestas a las diez preguntas del encargo**

1. Usa exactamente el mismo objeto que la pantalla. 2. No filtra más. 3. No vuelve a sumar. 4. Mismos períodos. 5. En "Flujo mensual" no hay números como texto (0 de 1,512); en las bases, **las fechas van como texto** y no se pueden agrupar por mes con funciones de fecha. 6. Omite los mismos 8 programas que el panel. 7. Celda sin determinar = vacía; cero = "–"; una celda parcial muestra el subtotal en amarillo. 8. No contiene fórmulas (0 en las 7 hojas). 9. Los totales se copian, no se calculan. 10. Valor interno = valor mostrado.

Problema propio del Excel, distinto del panel: en "Base Cálculo" la columna "Concepto del reporte" repite 19 etiquetas entre programas ("Recuperación realizada" aparece 4 veces); hay que filtrar además por "Programa" para reproducir una celda. No cambia cifras.

## E. Clasificación de hallazgos

| Hallazgo | Clasificación |
|---|---|
| C.1 Programas excluidos | Error de consulta |
| C.2 Monto en texto | Error de cálculo |
| C.3 ID 2696 duplicado | Error de origen de datos |
| C.4 H ≠ J (289, 389) | Error de origen de datos |
| C.5 Huérfanos colocados por U | Diferencia legítima; etiqueta incorrecta |
| C.6 Fechas J vacía / 2029 | Error de origen de datos / error de fechas |
| C.7 Ahorro Supabase contra hoja | Diferencia legítima entre fuentes |
| C.8 Salto de $40,620 | Error de saldo acumulado |
| C.9 Saldo 2025 como aportación | Pendiente por falta de evidencia |
| C.10 Retiros sin clasificar | Error de consulta |
| C.11 Capital pendiente | Error de saldo acumulado |
| C.12 Desglose | Diferencia legítima; 6 celdas por regla de código |
| C.13 Fecha de aprobación contra solicitud | Diferencia legítima entre conceptos |
| Fechas como texto en bases del Excel | Error de exportación |

**Estado de los antecedentes (sección 8 del encargo)**

| Antecedente | Estado | Evidencia |
|---|---|---|
| 1. Dependencia de AE | Ya corregido | Los rangos leídos son A:U, Z:AD, AG; la respuesta no trae AE |
| 2. Uso de la columna S | Ya corregido | S sólo se muestra como número de cuota; la identidad es C |
| 3. Préstamos excluidos por datos incompletos | Corregido parcialmente | Se cuentan, pero su capital se omite (C.2, C.3, C.4) |
| 4. Redondeo del desglose | Ya corregido | Fila de redondeo: $4.19 en 2026 |
| 5. Movimientos de ahorro omitidos ($171,410) | No comprobable | No pude reproducir esa cifra; las diferencias actuales son las de C.7 |
| 6. Programas excluidos en "todos los fondos" ($1,317,829.23) | Sigue presente | Hoy $2,023,200.39 |
| 7. Saldos acumulados y proyecciones | Corregido parcialmente | Las cuotas futuras de préstamos de años anteriores sí aparecen (2027, 2028); los saldos siguen mal (C.8, C.11) |
| 8. Exportación con unidades o formatos | Corregido parcialmente | Importes en pesos y sin texto en "Flujo mensual"; fechas de las bases siguen como texto |

## F. Plan técnico para Astra

| Prioridad | Archivo y función | Causa demostrada | Cambio recomendado | Resultado esperado | Riesgo | Prueba mínima |
|---|---|---|---|---|---|---|
| 1 | `cash-flow-loans.mjs` `money()`; mismas funciones en `cash-flow.mjs` y `cash-flow-consolidated.mjs` | C.2 | Aceptar texto estrictamente numérico (`/^\d+(\.\d{1,2})?$/` tras recortar) y conservar la marca de que venía como texto | Nov-2026 Caja de Ahorro = $622,616.09 | Bajo; no tocar textos "REVISAR" | Caso con H `"118135.3"` da 118,135.30; texto no numérico sigue `null` |
| 2 | `cash-flow-loans.mjs:56-62` | C.3, C.4 | Separar "capital contradictorio" de "capital faltante": colocar cada fila aprobada con su propio H y fecha, y marcar el conflicto sin anular el importe. Requiere decisión del propietario sobre cuál fuente manda cuando H ≠ J | Sep-2026 = $883,419; abr y may 2025 con importe | Medio; cambia el saldo pendiente | IDs 2696, 289, 389 reproducen las cifras de B.1 |
| 3 | `cash-flow-loans.mjs:3, 24-25`; `cash-flow-consolidated.mjs:101-126` | C.1 | Decisión del propietario: (a) agregar los programas como grupos propios, o (b) renombrar los totales a "cuatro programas de préstamo" y mostrar una fila "Otros programas (no incluidos)" | Suma de B por mes de todos los G = total del reporte, o etiqueta veraz | Medio; los otros programas no tienen el mismo desglose | Suma de B de las 20,841 filas = total mostrado + fila de excluidos |
| 4 | `cash-flow-loans.mjs:134-141`; `cash-flow-consolidated.mjs:80` | C.11 | No mezclar préstamos con saldo desconocido dentro del subtotal: mostrar "saldo determinado" y, aparte, "capital original de préstamos sin saldo determinado", con el número de préstamos | Saldo final = anterior + colocado − capital recuperado sobre la misma población | Medio | Residuo de continuidad = 0 en los 23 pares de meses de 2025-2026 |
| 5 | `cash-flow-loans.mjs:52-55, 73-78`; etiqueta en `cash-flow-consolidated.mjs:11` | C.5, C.6 | Etiquetar la base de fecha real ("solicitud" o "autorización PV2") y avisar en la celda del mes cuando un préstamo aprobado queda fuera por fecha vacía o futura | El usuario ve los 27 huérfanos y los IDs 202 y 2981 | Bajo | IDs 202 y 2981 aparecen como aviso |
| 6 | `cash-flow-savings.mjs` (puente de saldos) | C.8 | Asignar cada cambio de base al mes y cuenta donde nace, no al mes vigente | Sin salto de $40,620 en noviembre | Medio; regla 14: no corregir saldos | Suma de ajustes por mes = −saldos negativos por mes (feb −500 … jul −40,920) |
| 7 | RPC `get_admin_reports_jc_cash_flow` | C.10 | Devolver la categoría original del retiro (Completo / Parcial) | Jul-2026: 480,255.20 parciales y 2,052,850.20 totales | Bajo; es un lector | Total de retiros del mes sin cambio |
| 8 | `app/cash-flow-export.js` `baseSheets` | D10 | Escribir fechas como fecha de Excel y agregar el programa al concepto en "Base Cálculo" | Tabla dinámica por mes reproduce cada celda | Bajo | Suma por concepto + programa + mes = celda de "Flujo mensual" |

**Cómo verificar después de corregir:** volver a ejecutar la comparación de este informe (suma de B por mes y G; solicitudes aprobadas por mes de J) contra el resultado del panel para 2025-2028 y exigir 0 diferencias no explicadas, y repetir la comparación de 1,512 celdas entre panel y Excel.

**Decisiones que corresponden al propietario antes de implementar:** incluir o no los 8 programas (prioridad 3); incluir o no los 27 préstamos sin solicitud (prioridad 5); qué fuente manda cuando H ≠ J (prioridad 2); si el movimiento del 15-ene-2026 es saldo trasladado de 2025 (C.9).

## G. Protección de datos

- Todas las correcciones son de lectura e interpretación en `supabase/functions/reports-jc/*.mjs`, el worker generado y el exportador. Ninguna requiere escribir en Google Sheets ni en tablas financieras de Supabase.
- Los datos de origen erróneos (ID 2696 duplicado, fecha 2029 del 2981, J vacía del 202, H del 289 y 389, montos en texto de 3073 y 3078) **no deben corregirse desde el código ni por el agente**. Se reportan al responsable de la hoja; el reporte debe mostrarlos como incidencia con ID y fila.
- La prioridad 7 cambia un RPC de lectura: debe ser una migración aditiva y reversible, sin tocar tablas ni permisos (`docs/MIGRATION_RULES.md`).
- Por la regla 14 de `AGENTS.md`, los importes de Ahorro en Supabase se aceptan como válidos: la prioridad 6 reubica el ajuste en el tiempo, no cambia saldos.
- La evidencia de esta auditoría contiene sólo agregados, IDs de préstamo, folios y números de fila. Las copias de trabajo de las hojas quedaron en una carpeta temporal fuera del repositorio.

## Límites de esta auditoría

- No abrí la pantalla en un navegador ni descargué el Excel desde el botón; comparé el resultado que ambos consumen y el archivo que genera el exportador real.
- "Google Sheets" es mi recálculo desde las hojas originales con las reglas del encargo. No conozco la fórmula o tabla exacta con la que se hizo la revisión manual; si se usó `HISTORIAL DE PRESTAMOS` por fecha de aprobación, aplica C.13.
- Inversores no se concilió contra Google: las pestañas de inversión de la hoja están vacías (1 y 4 filas); su fuente es Supabase.
- La cifra de C.9 es una estimación por regla aproximada.

```text
H-CASH-FLOW-RECONCILIATION-AUDIT-20261113 RESULT
Status: PASS para la ejecución de la auditoría; FAIL de concordancia del reporte en los puntos C.1-C.4, C.8, C.10, C.11.
Files changed: este documento y docs/qa/evidence/cash-flow-reconciliation-20261113/matriz-conciliacion.csv. Ningún archivo de código.
Source-of-truth verdict: fuentes conservadas; fallan filtro de programas, tipo de dato, duplicados y saldos.
Invariant verdict: suma de B por fecha A conservada en 48 meses × 4 programas; colocación y saldos no aprobados.
Build: NOT APPLICABLE.
Tests: 380 celdas de préstamos, 22 de ahorro, 6,048 celdas panel/Excel (4 años).
Security: lectura con cuenta lectora de Google y cuenta de prueba H005_TEST; cero escrituras financieras.
Legacy impact: ninguno.
Unexpected files changed: ninguno.
Known limitations: ver "Límites de esta auditoría".
Evidence: docs/qa/evidence/cash-flow-reconciliation-20261113/matriz-conciliacion.csv
```
