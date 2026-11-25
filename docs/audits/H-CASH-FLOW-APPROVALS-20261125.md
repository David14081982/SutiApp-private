# H-CASH-FLOW-APPROVALS-20261125 — Número de préstamos y capital colocado desde HISTORIAL DE PRESTAMOS

## Instrucción del propietario (25-nov-2026)

Reportes JC · Reporte Flujo de efectivo: «Número de préstamos otorgados» no coincide con la tabla dinámica
de la hoja `HISTORIAL DE PRESTAMOS` (conteo por Fondo y mes). «Debe de coincidir.» Corregir «Capital colocado
por fecha de solicitud» y «Número de préstamos otorgados». La recuperación realizada queda para una etapa
posterior y **no** cambia aquí.

## Auditoría (solo lectura)

Lectura directa de `SutiApp Final` con la cuenta lectora `spreadsheets.readonly`; copia privada fuera del
repositorio, no publicada. Corte 2026-11-25 (America/Hermosillo).

- `HISTORIAL DE PRESTAMOS` (A ID, B folio, C nombre, E fondo, H cantidad, J fecha de aprobación) la escribe
  el traspaso de solicitudes aprobadas (`google-apps-script/loan-transfer`): una fila por préstamo otorgado,
  con J = día del traspaso. Es el registro legacy del préstamo (SOURCE_OF_TRUTH, sección de traspaso).
- Reproducción de la tabla dinámica del propietario con E y el mes de J: idéntica para 2026 ene–oct en los
  cuatro programas. Noviembre difiere +1/+3/+1 por aprobaciones registradas el mismo 25-nov después de la
  captura del propietario.
- El reporte publicado no leía esa hoja. Contaba por ID con `Historial de solicitudes` J (fecha de
  **solicitud**), estado Y aprobado y capital J de PV2. Comparación ID por ID en 2026: 34 diferencias.

| Causa | Casos 2026 | Ejemplo |
|---|---:|---|
| Mes de solicitud ≠ mes de aprobación (solicitud a fin de mes, aprobación el día 1–3 del siguiente) | 28 | 2750–2759: solicitud 30-sep, aprobación 01-oct |
| Solicitud en dic-2025, aprobación en ene-2026 | 1 | 954 |
| En HISTORIAL DE PRESTAMOS sin solicitud (no se contaba) | 1 | 983 |
| ID duplicado en Solicitudes (2696 con dos personas; 2697 no se contaba) | 1 | 2697 |
| Solicitud «Iniciado» sin fila en HISTORIAL DE PRESTAMOS ni calendario PV2 (se contaba) | 3 | 2728, SR-2026-000128, SR-2026-000194 |

Capital: H de `HISTORIAL DE PRESTAMOS` = J de PV2 en el 100 % de los préstamos 2026 que tienen calendario.
Las 468 filas sin ID corresponden a otros programas (seguro, vales, etc.), no a los cuatro programas de
préstamo. Dos filas (IDs 616 y 617) tienen fecha J = 30/01/1970: quedan fuera de cualquier periodo actual;
dato de origen por revisar, no se corrige.

## Decisión y cambio (ADR-119)

- Autoridad del conteo y del capital colocado: `HISTORIAL DE PRESTAMOS`. Cada fila de los cuatro programas
  (Caja de Ahorro, Caja Chica, Sutiexpress, Adelantos de Nómina) cuenta 1 préstamo y suma H en el mes de J.
  Igual que la tabla dinámica: se cuentan filas; un ID repetido se cuenta en cada fila y se informa.
- Etiqueta: «Capital colocado por fecha de aprobación».
- Sin fecha interpretable o con fecha posterior al corte: fuera de la distribución mensual, con observación.
  H no interpretable: se cuenta el préstamo y el capital queda parcial, con observación.
- Si la respuesta no trae la hoja, ambos renglones quedan «sin determinar»: nunca se sustituye por la regla
  anterior (AGENTS regla 2).
- `Historial de solicitudes` J ya no coloca ni cuenta. Sólo califica el cálculo de saldo pendiente, que no
  cambia en esta H (etapa posterior). Base Contratos: «Fecha de colocación» = J de HISTORIAL DE PRESTAMOS.
- Transporte: el lector Edge agrega `'HISTORIAL DE PRESTAMOS'!A:J`. La allowlist conserva sólo A, B, C, E,
  H y J (el resto, incluido el WhatsApp, se descarta antes de salir del servidor).
- Sin escrituras en Google ni Supabase. Sin cambios de permisos, RPC, Apps Script ni fórmulas.

## Archivos

`supabase/functions/reports-jc/{cash-flow-loans,cash-flow-consolidated,cash-flow,cash-flow-google,cash-flow-inputs}.mjs`;
`app/cash-flow-report.jsx` (etiquetas de base y versión del worker), `app/cash-flow-export.js` (etiquetas);
`app/cash-flow-projection-worker.js` y `app/bundle.js` generados; `SutiApp.html` / `sw.js` versión
2026112504; pruebas `scripts/test-cash-flow-{core,pv2-source,reconciliation-fixes,consolidated,inputs}.mjs`.

## Verificación

- Datos reales del 25-nov, código final dentro del worker generado: 0 diferencias de conteo y de capital
  contra HISTORIAL DE PRESTAMOS en 2025 y 2026, programa por programa y mes por mes. Celdas de conteo y
  capital en estado Registrado (no parcial). Allowlist real: columnas 0, 1, 2, 4, 7 y 9.
- Bundle: 181 módulos; sólo cambian `cash-flow-report.jsx` y `cash-flow-export.js`. Worker reproducible
  (sha256 `d832e973fc517a6f…`).
- Pruebas: core 38, pv2-source 28, reconciliation-fixes 9, consolidated 16, inputs 7, criteria-integration 6,
  source-parity 3, worker 8, worker-ui (Chrome) PASS, convención de versión PASS.
  `test-cash-flow-criteria-contracts.mjs` mantiene 2 fallos previos (lector de contratos no usado por este
  reporte), idénticos antes del cambio.

## Pendiente de publicación

Orden obligatorio: 1) Edge `reports-jc` (el token de gestión de Supabase devuelve 401: requiere uno nuevo);
2) frontend (push a main → Pages). Si se publica el frontend antes que el Edge, ambos renglones muestran
«sin determinar» (nunca cifras de la regla anterior). Recuperación: el Edge anterior sigue siendo compatible;
para el frontend, revertir el commit.

Casos para la encargada (no se modifican): 2728, SR-2026-000128 y SR-2026-000194 están «Iniciado» en
Solicitudes sin fila en HISTORIAL DE PRESTAMOS; IDs 616/617 con fecha 1970.

## Cierre de publicación (25-nov-2026)

Autorizado por el propietario («si», «publicalo»).

- Edge `reports-jc`: v19 → **v20** (verify_jwt true). Respaldo de v19 (ESZIP y metadatos) en `.tmp/cash-flow-approvals-20261125/` del workspace principal; v19 coincidía con origin/main más `template.mjs` local (ignorado por git, idéntico al desplegado). Lectura en vivo con H005_TEST: HTTP 200, `approvals` con sólo columnas 0, 1, 2, 4, 7, 9; 0 diferencias contra una lectura nueva de la hoja (2026, cuatro programas, conteo y capital). La proyección anterior siguió funcionando con v20 durante la transición.
- Frontend: commit `c100e91` en main; Pages run `45709379111` SUCCESS. sutiapp.com sirve `2026112504`; `bundle.js` y `cash-flow-projection-worker.js` idénticos al candidato (sha256 normalizado `838a16fc5920926a…` / `d832e973fc517a6f…`).
- Navegador real contra producción (H005_TEST): el reporte muestra «Capital colocado por fecha de aprobación»; conteos y capitales 2026 iguales a la hoja, incluida la aprobación 3168 ($2,000) registrada ese mismo día. 0 alertas, 0 errores JS, 0 escrituras.
- Recuperación: redeploy del ESZIP/fuentes v19 y revert de `c100e91`.

```text
H-CASH-FLOW-APPROVALS-20261125 RESULT
Status: PASS
Files changed: 19 (commit c100e91)
Source-of-truth verdict: SAFE; HISTORIAL DE PRESTAMOS autoridad de conteo/colocación por ADR-119; sin escrituras.
Invariant verdict: PASS; sin fallback, desconocido distinto de cero, recuperación y saldos sin cambio.
Build: PASS; bundle 181 módulos (2 cambiados), worker reproducible.
Tests: PASS focales (core 38, pv2 28, reconciliation 9, consolidated 16, inputs 7, criteria-integration 6, parity 3, worker 8, worker-ui, versión); criteria-contracts 2 fallos previos ajenos.
Security: PASS; JWT/admin context sin cambio; allowlist de 6 columnas.
Legacy impact: sólo lectura de Google.
Unexpected files changed: ninguno.
Known limitations: 2728, SR-2026-000128, SR-2026-000194 sin fila en HISTORIAL DE PRESTAMOS; IDs 616/617 con fecha 1970. Recuperación realizada pendiente de la siguiente etapa.
Evidence: esta auditoría.
```
