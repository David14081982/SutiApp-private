# H-SAVINGS-USER-UI-LIVE-READONLY-001 — auditoría y evidencia

Fecha: 2026-09-02
Estado: `PASS`
Modo: frontend live + backend read-only; sin cutover

## Objetivo y autoridad

Finanzas → Ahorrar debe abrir una pantalla Ahorro reconocible como la propuesta owner y alimentada sólo por datos/reglas reales ya construidos. `C:\Users\david\Downloads\Ahorro por año.html`, SHA-256 `4D7685F2E399D52DED4542BC9AF177556832DE7245CF601562BD0FA691ED94AC`, es autoridad visual. Sus montos, porcentajes, fechas, handlers y mocks no son autoridad financiera.

Google Sheets + Apps Script continúan como `GOOGLE_LEGACY_AUTHORITY`. Supabase conserva el batch certificado como `SHADOW_MIRROR`. La UI no consulta Google y sólo lee `get_self_savings_live_readonly()`; no existe fallback a HTML, `DATA`, JSON, mock, `localStorage` o caché.

Prohibiciones preservadas: importación adicional `NO`; ledger/materialización `NO`; yield calculation/credit `NO`; escritura Google `0`; escritura de negocio Supabase `0`; corrección de los 20 mismatch `NO`; cutover `NO`; push `NO`.

## Auditoría previa y causa

La pantalla preparada anterior dependía de `get_self_savings_dashboard()`, cuyo balance canónico estaba vacío porque el batch RAW contiene evidencia y participantes, pero cero ledger/enrollments/planes/solicitudes/yields/acciones. Además, la ruta y el frontend estaban sólo en cambios locales. Usar fixtures habría dado una apariencia falsa de funcionamiento.

La solución autorizada fue una proyección nueva y acotada sobre evidencia ya aplicada. Q permanece `legacy_reported_balance`; AA:DO y DP:DW se proyectan directamente con su clase de celda. Ningún candidato de conciliación se promueve a movimiento.

## Implementación

- `get_self_savings_live_readonly()` es `STABLE SECURITY DEFINER`, `search_path=''`, sólo `authenticated`, deriva `get_effective_affiliate_id()` y no acepta afiliado/folio objetivo.
- La ruta real es `#/savings`: Finanzas → Ahorrar abre Ahorro; Back vuelve a Finanzas; refresh conserva la pantalla.
- El resumen muestra literalmente Q. Para la cuenta activa de prueba Q es `NULL`, por lo que se presenta “No reportado en Q”; no se inventa `$0.00`.
- DP:DW alimenta `Ahorrado histórico` y `Rendimiento histórico` directamente. AA:DO muestra fecha, valor y `FORMULA|MANUAL|EMPTY`.
- Se muestran identidad legacy, inicio, PROCESS, monto vigente, estado, retiros, cambios, periodos anuales y beneficiarios. Ausencias reales usan estados vacíos explícitos.
- Las cuatro acciones —Retirar ahorro, Modificar monto, Darme de baja e Ingresar al ahorro— reciben disponibilidad backend. El batch tiene cero filas de disponibilidad y todas permanecen deshabilitadas.
- La jerarquía reproduce el contrato: topbar blanca compacta, fondo gris, tarjeta granate de saldo, subresúmenes translúcidos, detalle por año en tarjetas blancas y CTA ancho. No se copió el bottom-nav aislado del artefacto porque la ruta usa el shell real de SutiApp.
- Cache de release local: `app/bundle.js?v=191`, `sutiapp-v135`.

## Migración y recuperación

`20260902000300_savings_user_ui_live_readonly.sql` agrega sólo el lector y su grant. Forward + recovery dry-run pasaron en transacción con `ROLLBACK`. La aplicación productiva preservó los conteos exactos de las 17 tablas y cambió cero filas. La recuperación preparada revoca y elimina sólo la función; no se ejecutó en producción.

## Seguridad, datos y legacy

```text
SUPABASE SECURITY REVIEW
Auth/business identity: afiliado efectivo derivado en backend
RLS/grants: sin DML directo; RPC authenticated-only
Cross-user: DENIED
Anonymous: DENIED
Target parameter: REJECTED
Frontend exposure: sin service_role, Secret Key, Access Token o PII ajena
Verdict: PASS
```

```text
LEGACY GOOGLE AUDIT
Reads: 0 desde runtime y pruebas de esta H
Writes: 0
Calculations/triggers: sin ejecución o modificación
Authority: Google productivo; Supabase SHADOW derivado
Classification: READ ONLY
Decision: PASS
```

## Verificación

### Backend live

`node scripts/test-savings-user-ui-live-readonly.js`

```json
{"status":"PASS","mode":"LIVE_READ_ONLY","activeParticipant":true,"noSavingsParticipant":true,"authority":"GOOGLE_LEGACY_AUTHORITY","projection":"SHADOW_MIRROR","qIsDisplayedTotal":true,"qReported":false,"historyRows":13,"annualPeriods":1,"withdrawals":1,"planChanges":0,"beneficiaries":0,"allActionsDisabled":true,"anonymousDenied":true,"crossUserDenied":true,"targetParameterRejected":true,"tablesChecked":17,"dataRowsChanged":0,"googleReads":0,"googleWrites":0}
```

### Navegador real

`node scripts/test-savings-user-ui-live-browser.js`

```json
{"status":"PASS","browser":"Chrome","liveData":true,"fixtureInjection":false,"financeToSavings":true,"backToFinance":true,"refreshPreserved":true,"activeQ":null,"activeHistory":13,"activeAnnualPeriods":1,"activeWithdrawals":1,"actionsDisabled":4,"noSavingsState":true,"responsive":["390x844","430x932","768x1024","1366x900"],"screenshots":5,"googleReads":0,"googleWrites":0,"savingsWrites":0,"browserErrors":0}
```

### Contrato visual y regresión compartida

- Contrato owner capturado sin importar datos: `PASS`, 390×844 y 1440×1100.
- Build local + backend productivo: `PASS`; 147/147 assets, 29/29 archivos legacy, 248/248 assets de catálogo, documentos self/Admin, foto, PDF legítimo, fullscreen, refresh y perfil sin service worker; `productionDataMutations=0`.
- GitHub Pages: `PASS` al repetir la matriz; 147/147, 29/29, 248/248, 10/10 thumbnails y PDF legítimo. Un primer 9/10 transitorio se repitió sin cambio de código/datos y cerró 10/10, coherente con el contrato de carga de 30 segundos ya documentado.

## Evidencia visual

- `docs/qa/evidence/savings-user-ui-live-readonly-20260902/reference/contract-390x844.png`
- `docs/qa/evidence/savings-user-ui-live-readonly-20260902/reference/contract-1440x1100.png`
- `docs/qa/evidence/savings-user-ui-live-readonly-20260902/active-390x844.png`
- `docs/qa/evidence/savings-user-ui-live-readonly-20260902/active-430x932.png`
- `docs/qa/evidence/savings-user-ui-live-readonly-20260902/active-768x1024.png`
- `docs/qa/evidence/savings-user-ui-live-readonly-20260902/active-1366x900.png`
- `docs/qa/evidence/savings-user-ui-live-readonly-20260902/no-savings-430x932.png`

## Cierre

```text
H-SAVINGS-USER-UI-LIVE-READONLY-001 RESULT
Status: PASS
Files changed: Savings UI/routing/repository; RPC/recovery/applicator/tests; bundle/cache; gobierno/Registry/evidencia
Source-of-truth verdict: PASS — Google autoritativo; Supabase SHADOW_MIRROR read-only; HTML sólo visual
Invariant verdict: PASS — INV-174..185; Q literal y DP:DW directo; ledger/yield credit/cutover en cero
Build: PASS — bundle y sintaxis verificados
Tests: PASS — backend live, Chrome 4 tamaños + vacío, foundation, matriz global local/Pages
Security: PASS — self-only; anónimo/cross-user/target denegados; secretos browser 0
Legacy impact: READ ONLY — Google reads runtime 0 / writes 0 / Apps Script 0
Unexpected files changed: 0 atribuibles a esta H; worktree previo preservado
Known limitations: Q no reportado para la cuenta activa; cambios/beneficiarios sin filas live se muestran vacíos; acciones deshabilitadas por backend
Evidence: este documento y docs/qa/evidence/savings-user-ui-live-readonly-20260902/
```
