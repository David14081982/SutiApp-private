# H-SAVINGS-JC-REPORT-001 — Botón «Reporte JC» en Admin › Ahorro

## PRE-CHANGE AUDIT — 2026-11-27

Solicitud del propietario: en la pantalla Ahorro del panel administrativo, un botón «REPORTE JC»
enseguida de «Historial» que al pulsarse descargue, actualizado, el Excel acordado en la misma
conversación. Orden expresa: «AL TERMINAR HAZ COMMIT, PUSH Y PUBLICALO».

Formato acordado con el propietario (la imagen enviada es sólo ejemplo de formato):
- Hoja **Ahorro**: Folio, Nombre agremiado, Proceso (1/3/JUB), Tipo de empleado (Afiliados),
  Saldo (HOY), Saldo inicial (julio 2026), una columna por fecha de descuento desde el
  05-07-2026 hasta el último descuento vencido (sin fechas futuras), Retiros y Ajustes. Todos los
  ahorradores canónicos, incluidos los de saldo $0 y bajas.
- Hoja **Retiro**: Folio, Proceso, Nombre, Fecha de retiro, Categoria, ¿Continuará ahorrando?,
  Monto a retirar, Estado y «Se descuenta en», ordenada por fecha; colores del ejemplo.
- Un retiro aprobado sin entregar se lista sin restarse; un retiro con proceso «xxxx» muestra el
  proceso actual del ahorrador.

Autoridad (sin cambios): Supabase. Saldo = `savings_transactions` (igual que
`savings_participant_balance`). Historial anterior al corte certificado (06-09-2026) =
`savings_balance_certifications.source_snapshot` aprobado + etiquetas de
`savings_review_records.field_defs` (mismo criterio que Reporte RH). Retiros = registros
importados «Solicitud de retiro» (`savings_review_records`) + `savings_requests`
WITHDRAW/EXTRAORDINARY_WITHDRAWAL; el importe entregado sale de los débitos WITHDRAWAL enlazados
por `idempotency_key` (`SAVINGS_RUNTIME_PAYMENT|SAVINGS_SETTLEMENT:<request_id>:…`). Nombre =
`savings_affiliate_display_name` (H-SAVINGS-AFFILIATE-NAMES-001). Regla 14 de AGENTS: los valores
registrados se toman como válidos; no se corrige ni se marca ningún dato.

Definiciones derivadas (aprobadas por el propietario):
- Saldo inicial = apertura certificada (REGULARIZATION) − descuentos históricos del 05-07 al corte
  + retiros importados fechados entre el 05-07 y el corte. Los retiros anteriores al 05-07
  (incluidas las entregas del cierre de junio, 01–03 jul) ya están dentro del saldo inicial.
- Fecha = historial + CONTRIBUTION/ADJUSTMENT/REVERSAL con `contribution_date` (neto).
- Ajustes = ADJUSTMENT/REVERSAL sin `contribution_date`.
- Cada fila cumple Saldo inicial + fechas − Retiros + Ajustes = saldo del ledger; si no, no se
  produce archivo (`SAVINGS_JC_RECONCILIATION_FAILED`). Movimientos YIELD_CREDIT/HOLD_SETTLEMENT
  aún no tienen columna aprobada: el reporte falla de forma visible
  (`SAVINGS_JC_UNSUPPORTED_MOVEMENT`) en vez de esconderlos.

Alcance: migración/recovery `20261127000100_savings_jc_report` (una función de lectura nueva);
Edge nueva `savings-jc-report` (patrón de `savings-rh-report`: JWT del usuario, sin service role,
ExcelJS); `app/savings-jc-repository.js`; botón en `app/savings-panel-admin.jsx`; orden del bundle
en `scripts/build-bundle.js`; artefactos generados `app/bundle.js`, `SutiApp.html`, `sw.js`
(versión 2026112701); pruebas y release `scripts/{test-savings-jc-report-browser,test-savings-jc-report-live,release-savings-jc-report}.js`;
evidencia `docs/qa/evidence/savings-jc-report/`; esta auditoría y secciones de
SOURCE_OF_TRUTH, DECISIONS (ADR-121), MIGRATION_RULES y AGENT_CHANGELOG.

Seguridad: permiso existente `savings.reports` (el del Reporte RH) validado en la función
`SECURITY DEFINER` con `search_path` vacío; `EXECUTE` sólo para `authenticated`; Edge con
`verify_jwt` y CORS `ALLOWED_APP_ORIGINS`. Sin tablas, grants, RLS, escritores ni Google nuevos.

UI (regla 15): sólo el botón pedido; mientras genera dice «Generando…» y, si falla, muestra el
motivo (regla 2, error visible). Las seis pestañas, su orden y comportamiento se conservan.

Riesgo: bajo; sólo lectura. Recuperación: revertir el commit del frontend, borrar la Edge
`savings-jc-report` y ejecutar `supabase/recovery/20261127000100_savings_jc_report.sql`.

## Verificación

- Prueba en transacción revertida en producción con la cuenta admin de prueba: 405 ahorradores,
  231 retiros, 14 fechas (05-07 → 15-11-2026); comparación celda por celda contra el Excel validado
  con el propietario: 0 diferencias numéricas (8 nombres sólo traían espacios/tabuladores finales en
  Afiliados; la Edge los recorta). Cuenta sin permiso → `SAVINGS_REPORT_DENIED`.
- Edge ejecutada localmente con exceljs 4.4.0 sobre esos datos: Excel idéntico (valores, orden,
  fórmulas propias de cada fila, resultados precalculados); saldo alterado → `SAVINGS_JC_RECONCILIATION_FAILED`.
- Bundle: 182 chunks; sólo cambian `savings-jc-repository.js` (nuevo) y `savings-panel-admin.jsx`;
  `build-pages-site` PASS; SHA-256 del bundle `8704f76fa9852999f391c2c70c3abcfab2c84f9acc680eb080837a434edb199f`.
- `test-savings-jc-report-browser.js` (390/1440, transporte sintético, sin red): PASS.
  Regresión `test-savings-withdrawal-history-browser.js`: PASS (evidencia ajena restaurada).
- Producción: migración aplicada y registrada, filas financieras sin cambio; Edge v1 ACTIVE con
  `verify_jwt`; anónimo 401; descarga en vivo 200 e idéntica al Excel validado; total = ledger.
- Navegador real (sitio construido en localhost contra producción, admin de prueba): PASS.

## H-SAVINGS-JC-REPORT-001 RESULT

Status: PASS (publicación verificada en la sección siguiente).
Files changed: ver alcance; ningún archivo fuera de lo declarado.
Source-of-truth verdict: PASS — Supabase sin nueva autoridad; Excel derivado y conciliado con el ledger.
Invariant verdict: PASS — Folio textual exacto, sin fechas futuras, sin corregir datos, falla visible.
Build: PASS — bundle focal, versión 2026112701 en los cuatro lugares.
Tests: PASS — SQL en transacción revertida, Edge local, navegador sintético, regresión, vivo y navegador real.
Security: PASS — `savings.reports`, JWT real, sin service role ni grants nuevos.
Legacy impact: ninguno — Google/Apps Script/Préstamos sin escritura.
Unexpected files changed: ninguno.
Known limitations: rendimientos (YIELD_CREDIT) y descuentos por retención (HOLD_SETTLEMENT)
detienen el reporte con aviso hasta que el propietario apruebe una columna para ellos. El registro
de arquitectura ya estaba STALE por H anteriores (43/14 archivos de otras áreas); no se regeneró
completo para no mezclar alcances.
Evidence: `docs/qa/evidence/savings-jc-report/`.
