# Suti Préstamo — StepSimulatorV2 UI cutover

## Addendum H-LOAN-RESULT-COPY-001 — 2026-08-24

El encabezado de la tarjeta principal cambió de `Pagarías por {periodicidad}` a `Cada pago será de`, por instrucción explícita del propietario. Importe y periodicidad autoritativos permanecen sin modificación. Fuente, bundle y Chrome real confirman el nuevo copy y ausencia del anterior; HTML `v106`, PWA `v50`, `PASS`.

## Addendum H-LOAN-FUND-RATE-CARDS-001 — 2026-08-24

Cada CARD de fondo presenta ahora `rate` y `rate_period` recibidos en el overview autoritativo. No calcula ni traduce la periodicidad en el navegador. Chrome real confirmó `Caja de Ahorro → 2% quincenal` y `Caja Chica → 3% quincenal`, además del cambio de fondo y recálculo. Bundle de 83 fuentes, HTML `v105`, PWA `v49`; suites estáticas y browser `PASS`.

## Alcance y autoridad

Se sustituyó únicamente la presentación del paso `Monto`. `Destino`, `Documentos`, `Resumen`, firma, términos, folio, historial y procesamiento posterior no fueron modificados. Google Sheets + Apps Script continúan como autoridad financiera protegida mediante la frontera Phase 7 de solo lectura.

La pantalla acepta exclusivamente el contrato completo `FinancialSimulationResult`: `amount`, `paymentCount`, `paymentPeriod`, `rate`, `ratePeriod`, `interest`, `administrativeFeePerPayment`, `administrativeFeeTotal`, `total`, `paymentPerPeriod`, `fund`, `program`, `maxAmount`, `maxTerm` y `eligibility`. Navegador y Edge Function rechazan respuestas incompletas sin completar valores.

## Preservación visual y estados

El contrato autorizado conserva tarjeta guinda, monto grande por periodo, monto solicitado, slider, selector de plazo, Recibes, Interés, Gasto administrativo, Total, desglose, fondo/programa, jerarquía, spacing, microinteracción `SmoothMoney` y comportamiento responsive. La UI representa `LOADING`, `READY`, `NOT_ELIGIBLE`, `ERROR` y `UNAVAILABLE`.

Talón e impacto permanecen como componentes visibles desactivados: no leen ni escriben nómina local y no determinan elegibilidad. El desglose puede presentar `$15 × número de pagos` cuando el resultado autoritativo devuelve `administrativeFeePerPayment=15`; no calcula el total.

## Evidencia

- `node scripts/test-loan-simulator-ui-cutover.js`: PASS.
- `node scripts/test-phase7.js`: PASS.
- suite estática completa: PASS tras actualizar aserciones PWA a bundle `v87`/cache `v32`.
- `node --check app/bundle.js`: PASS.
- Chrome real `scripts/test-phase7-browser.js`: PASS; StepSimulatorV2 renderizado, estados controlados, cero montos mock, cero tasa local y cero llamadas directas a Google.
- Captura visual: `C:\tmp\sutiapp-loan-simulator-v2.png`.
- Migraciones/tablas/RLS: no aplican.
- Google Sheets/Apps Script/fórmulas/triggers/saldos/pagos/conciliación: sin cambios.

## Revisiones internas

- Fuente de verdad: PASS — Google sigue siendo única autoridad; frontend solo proyecta respuesta completa.
- Legacy: PASS — lectura vía frontera existente; cero cambios legacy.
- Seguridad Supabase: PASS — identidad se deriva en backend, secretos permanecen server-side y el browser no selecciona afiliado.
- UI Claude: PASS — nuevo contrato autorizado aplicado solo a Monto; pasos posteriores preservados.
- Post-change: PASS — fuente/bundle/cache, pruebas y navegador verificados.

## 2026-08-24 — rediseño autorizado y recálculo automático

El propietario autorizó expresamente reproducir la presentación Claude conservando la frontera financiera actual. `StepSimulatorV2` mantiene `useFinancialLegacy`, `loadOverview`, `requestQuote` y `FinancialSimulationResult`; no se modificaron el Repository, la Edge Function, Google, Apps Script, reglas, tasas, elegibilidad, perfiles ni solicitudes.

La selección válida `fondo + monto + plazo` dispara ahora `requestQuote` automáticamente. El monto aplica debounce de 320 ms; fondo y plazo solicitan inmediatamente. Una cola runtime conserva como máximo una consulta simultánea, reemplaza trabajo pendiente por la selección más reciente y solo confirma resultados cuyo programa/fondo, monto y cantidad de pagos coinciden con la selección vigente. El desglose recibe exclusivamente ese resultado confirmado. Se eliminó el CTA normal `Actualizar simulación`; `Reintentar` permanece solo en error.

La estructura no desaparece durante la consulta: la tarjeta muestra `Actualizando…`, los controles siguen disponibles y ningún resultado anterior se trata como vigente. `SmoothMoney` respeta `prefers-reduced-motion`. Impacto y talón continúan visibles como `DISABLED/PENDING`, sin datos de nómina ni persistencia local.

Evidencia:

- Bundle reproducible desde 82 fuentes con Babel Standalone 7.29.0: `PASS`; `bundle.js?v=101`, PWA `sutiapp-v45`.
- `node --check app/bundle.js`, `sw.js` y el arnés browser: `PASS`.
- `test-loan-simulator-ui-cutover`, `test-phase7`, `test-h007` y `test-h0072`: `PASS`.
- Chrome headless real: simulación inicial automática, cambio de fondo, monto con debounce, una sola solicitud adicional tras cuatro cambios rápidos, `max_in_flight=1`, botón manual ausente, cero excepciones y captura PNG válida de 77,396 bytes: `PASS`.
- La cuenta real expuso un único plazo; el cambio de plazo no fue ejercitable live y queda cubierto por el mismo handler inmediato y la prueba estática. No existe un CTA productivo para avanzar de Monto a Destino en el baseline actual, por lo que esa validación no forma parte de este corte quirúrgico.

```text
SUTI PRÉSTAMO AUTO RECALCULATION RESULT
Automatic on fund change: PASS
Automatic on amount change: PASS
Automatic on term change: PASS (static; live NOT APPLICABLE_SINGLE_OPTION)
Amount debounce: PASS
Duplicate request prevention: PASS
Race-condition protection: PASS — serialized queue
Stale responses ignored: PASS
Backend-only financial calculation: PASS
Frontend financial calculations: 0
Button “Actualizar simulación”: REMOVED
Retry on error: PASS
Latest result used in breakdown: PASS
Latest result required before next step: NOT APPLICABLE — no baseline next-step CTA
Browser: PASS
Financial parity: PASS — financial contract/backend unchanged
Google changed: NO
Financial backend changed: NO
Final verdict: PASS
```

## 2026-08-24 — corrección de fidelidad visual y flujo

La revisión del propietario demostró que el primer corte no alcanzó una diferencia visual material y había omitido el CTA productivo de los cuatro pasos. Esta sección sustituye las afirmaciones históricas de “solo Monto”, `$15 × pagos` y “sin CTA baseline” anteriores.

La composición activa reproduce de forma perceptible el lenguaje del harness Claude: resultado con gradiente y glow, tarjeta elevada de monto, slider propio, importes rápidos derivados exclusivamente del rango backend, selector de fondos con iconografía, plazos comparables, superficies de Impacto/Talón desactivadas, desglose y footer fijo. `Monto → Destino → Documentos → Resumen` vuelve a ser navegable y exige una cotización vigente antes de avanzar. El resumen consume ese mismo `FinancialSimulationResult`; la solicitud utiliza la frontera productiva existente `ProgramRequestRepository.createFinancial` y no introduce otro writer.

No se copió la regla de `$15` al frontend: el importe administrativo por pago y el total se presentan desde el resultado backend. No se agregaron montos, tasas, plazos, fondos, elegibilidad, documentos locales ni cálculos financieros hardcodeados. Google, Apps Script, `financial-legacy`, Repository, Supabase, RLS, criterios y datos permanecen sin cambios.

Evidencia:

- Build reproducible de 82 fuentes: `bundle.js?v=102`, PWA `sutiapp-v46`, sintaxis `PASS`.
- Pruebas estáticas `test-loan-simulator-ui-cutover`, `test-phase7`, `test-h007` y `test-h0072`: `PASS`.
- Chrome real: `visual_fidelity=true`, `four_step_flow=true`, `back_navigation=true`, simulación inicial automática, fondo automático, monto con debounce, `max_in_flight=1`, cero CTA manual, cero excepciones y PNG de 103,024 bytes: `PASS`.
- El perfil real solo ofrece un plazo: cambio live `NOT_APPLICABLE_SINGLE_OPTION`; handler inmediato y contrato multiopción quedan cubiertos estáticamente.

```text
H-LOAN-UI-VISUAL-FIDELITY-FIX-002 RESULT
Status: PASS
Claude visual match: materially high / browser verified
Current LoanScreen wiring preserved: PASS
FinancialLegacyRepository/useFinancialLegacy/loadOverview/requestQuote: PRESERVED
Backend-only financial calculations: PASS
Frontend financial calculations: 0
Hardcoded financial values/rules: 0
Local financial authority: 0
Available funds/max amount/terms/results from backend: PASS
Monto/Destino/Documentos/Resumen: PASS
Impacto en tu pago: DISABLED/PENDING
Tu talón: DISABLED/PENDING
Browser and back navigation: PASS
Financial parity: PASS — resolver and contract unchanged
Supabase/Google/Financial Edge/rules changed: NO
Final verdict: PASS
```
