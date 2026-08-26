# H-LOAN-RESULT-LOADING-UX-001

Fecha: 2026-08-24

## PRE-CHANGE AUDIT

Objetivo: incorporar carga inicial inmediata, reveal suave, recálculo con resultado previo atenuado y error con reintento en la tarjeta de Suti Préstamo.

Alcance: presentación de `StepSimulatorV2`, bundle ejecutable, versionado PWA y pruebas de la experiencia.

Fuera de alcance: `FinancialLegacyRepository`, `financial-legacy`, `requestQuote`, `FinancialSimulationResult`, Supabase, Google, Apps Script, criterios, tasas, reglas, elegibilidad y cálculos.

Datos afectados: ninguno. La UI continúa presentando únicamente `FinancialSimulationResult` confirmado.

Riesgo: mostrar cifra falsa/stale, introducir cálculo local, mantener shimmer tras error, layout shift o desalinear source/bundle.

Recovery: revertir los archivos funcionales, de prueba y gobierno enumerados en el resultado y regenerar el bundle con Babel Standalone 7.29.0.

Status: PASS.

## SOURCE OF TRUTH AUDIT

Domain: resultado de simulación de préstamo.

Authority: Google legacy + Edge `financial-legacy`; el frontend consume la proyección `FinancialSimulationResult`.

Readers: `FinancialLegacyRepository` / `StepSimulatorV2`.

Writers: sistemas legacy autorizados; esta H no agregó writers.

Alternative sources / fallbacks / caches: ninguno.

Verdict: SAFE.

## LEGACY GOOGLE AUDIT

Systems/domains: Préstamos / Google legacy.

Reads: sin cambio; continúan detrás de Edge/Repository.

Writes / calculations / triggers: NO CHANGE / NO WRITE.

Classification: READ ONLY — presentación únicamente.

## Evidencia

- Bundle reproducible: `node scripts/build-bundle.js C:\tmp\sutiapp-babel-7.29.0.min.js` — PASS, 83 archivos.
- Sintaxis de source, bundle, service worker y prueba — PASS.
- `test-loan-simulator-ui-cutover.js` — PASS.
- `test-flexible-loan-assistance.js` — PASS.
- `test-loan-declared-payroll.js` — PASS.
- `test-loan-result-loading-browser.js` — PASS en Chrome real con fixture aislado y latencias 100/1000/3000 ms.
- Las tres latencias conservaron 7 odómetros iniciales, 27 tracks de glifos, 5 `SmoothMoney` y `layoutShift=0`.
- Slot-machine: seis vueltas, todos los carretes de carga y revelado terminan en 1000 ms como máximo y conservan blur proporcional a la velocidad. El escalonado anterior de 90 ms por columna y la repetición indefinida durante la carga fueron retirados por decisión explícita del propietario el 2026-08-25; si la espera continúa, los glifos se ocultan sin colapsar el espacio.
- Skeletons/franjas opacas en la tarjeta de resultado: 0.
- Recálculo conservó el valor confirmado previo atenuado y mostró `Actualizando…`.
- Error detuvo todos los carretes, mostró mensaje controlado y `Reintentar` recuperó la simulación.
- Reduced motion produjo 0 animaciones/0 blur y saltó al valor final; `MOTION.frozen()` aplica la misma política.
- Búsqueda estática: cero `DATA`, `localStorage`, `financeStore`, fórmulas o cifras demo nuevas en `screens-loan.jsx`.
- Intento live: la Edge Function respondió `Failed to send a request to the Edge Function`; no se alteró producción y la validación de UX continuó con fixture aislado de test.

## H-LOAN-RESULT-LOADING-UX-001 RESULT

Status: PASS

Files changed: `app/motion.jsx`; `app/screens-loan.jsx`; `app/bundle.js`; `SutiApp.html`; `sw.js`; `scripts/test-loan-simulator-ui-cutover.js`; `scripts/test-loan-result-loading-browser.js`; `docs/DECISIONS.md`; este reporte; `docs/AGENT_CHANGELOG.md`.

Source-of-truth verdict: PASS — autoridad financiera, lectores y writers sin cambios; fixture solo en prueba aislada.

Invariant verdict: PASS — INV-008/012/015/016/036/055/057/088 preservadas.

Build: PASS — bundle de 83 fuentes; HTML `v116`; PWA `v60`.

Tests: PASS — estáticas + Chrome real 100/1000/3000 ms, slot-machine/blur, recálculo, error/retry, reduced motion y accesibilidad.

Security: NOT APPLICABLE — sin cambios Auth, RLS, permisos, secretos o identidad.

Legacy impact: READ ONLY / NO CHANGE / NO WRITE.

Unexpected files changed: no evaluable por ausencia de metadata Git; inventario explícito arriba.

Known limitations: la comprobación live quedó bloqueada por indisponibilidad externa de la Edge Function; la UX se verificó en navegador real con fixture aislado, no productivo.

Evidence: este reporte y salida JSON del test de navegador.

## Correccion quirurgica - fondos de un pago

Cada cotizacion aceptada incrementa ahora una revision visual monotonica. Esa revision se propaga desde `ResultCard` hasta cada `OdometerDigit`, por lo que la deduplicacion usa `ciclo + cifra` y no solamente la cifra. Un cambio Fondo A -> Fondo B -> Fondo A reinicia los carretes aun cuando el plazo sea 1 y los importes formateados coincidan exactamente.

La revision cambia solo despues de validar y confirmar la respuesta vigente; durante `RECALCULATING` continua visible el resultado anterior sin un giro prematuro. No cambiaron valores, calculos, solicitudes, autoridad, Repository, Edge, Google o Apps Script.

Chrome real con fixture aislado de dos fondos 1-1 y cinco importes identicos confirmo A -> B y B -> A con reinicio de los 27 tracks, blur interno activo, `$948.43` preservado y posterior asentamiento. La matriz completa mantuvo 100/1000/3000 ms, `layoutShift=0`, error/retry, reduced-motion, documento oculto y accesibilidad. Entrega: bundle de 83 fuentes, HTML `v117`, PWA `v61`.

## Pulido de moneda y minimo visual

El glifo `$` de los importes del resultado usa un `transform: translateY(-.20em)` estatico y separado del track animado. Chrome real confirmo que su borde inferior ya no queda por debajo del primer digito. El minimo autoritativo 1 continua delimitando slider e input, pero deja de presentarse como sugerencia absurda: la etiqueta muestra `Minimo` y el acceso rapido `$1` se omite. No se sustituyo por otro valor ni se modifico la cotizacion. Entrega: HTML `v118`, PWA `v62`.
