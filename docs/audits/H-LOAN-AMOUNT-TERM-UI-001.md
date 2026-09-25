# H-LOAN-AMOUNT-TERM-UI-001

## Ampliación de alcance: publicación autorizada
2026-09-25 OWNER: «haz commit, push y publica». Reemplaza la limitación de entrega
local del cierre anterior. Añadir SutiApp.html y sw.js exclusivamente como
GENERATED_ARTIFACT/cachebusters: bundle 290 y worker/cache 224. No cambia lógica SW.
Plan: checks focales, commit allowlisted, push main, Actions Pages y paridad de
HTML/bundle/SW publicados. Recovery: revertir el commit focal y republicar.
Riesgo: caché obsoleta; versiones alineadas. Status pre-change: PASS.

## PRE-CHANGE AUDIT
Objetivo: selector de Caja Chica/Caja de Ahorro/Sutiexpress limitado a 6/12 pagos;
retirar montos rápidos; monto y slider con diseño de Invertir. Autorización: OWNER
confirma estos tres cambios y solicita implementación quirúrgica (2026-09-25).
Alcance: app/screens-loan.jsx; app/bundle.js GENERATED_ARTIFACT; pruebas focales
scripts/test-loan-simulator-ui-cutover.js, scripts/test-loan-stale-quote-browser.js,
scripts/test-loan-amount-term-ui.js; este audit y docs/AGENT_CHANGELOG.md;
docs/qa/evidence/loan-amount-term-ui-20260925/.
Fuera de alcance: deploy, backend, migraciones, criterios, fórmulas, Google,
otras pantallas, datos persistidos, routing, assets y service worker.
Datos/tablas/APIs: ninguna escritura externa; conservar lectura/cotización existente.
Authority: Supabase financial_programs/funds/rules; selección React descartable.
Readers: LoanScreen/StepSimulatorV2. Writers: ninguno nuevo.
Invariantes: límites autoritativos, cotización servidor, debounce/cancelación,
sin fallback ni cálculo financiero local, continuidad de los cuatro pasos.
Riesgo: plazo personalizado anterior al cambiar de fondo; edición/formato monetario.
Plan: restringir intersección con allowed_terms; impedir conservar un plazo oculto;
CSS local al monto; verificar selección, límites, estados y bundle.
Tests: contrato estático, selección aislada, navegador Chrome con fixtures aisladas,
regresión de cotización obsoleta, build y diff.
Recovery: revertir exclusivamente el diff de esta H y regenerar bundle.
Status: PASS.

## Navigator / autoridad / legacy
Registry STALE por cambios previos; screens-loan.jsx no figura entre sus cambios.
Discovery directo confirma implementación actual y referencia screens-inversion.jsx.
Sin cambio estructural: no regenerar Registry ni alterar cambios previos del owner.
SOURCE OF TRUTH: SAFE. El filtro UI restringe opciones existentes; no configura
una política financiera, no amplía elegibilidad ni sustituye validación backend.
LEGACY: SAFE CHANGE presentacional autorizado. Cero lecturas/escrituras Google,
fórmulas/triggers intactos. Equivalencia: solicitudes conservan el mismo motor,
monto y plazo elegidos; se comprueba selección y la cotización del servidor.

## Contrato visual
SCREEN: Suti Préstamo. SECTIONS: header, pasos, resultado, fondos, monto, plazo,
desglose, metadata y footer; depósito/documentos/resumen intactos.
CONTROLS: quitar exclusivamente presets de monto y 18/24/Otro en los tres fondos.
INTERACTIONS: edición manual con lápiz, slider, límites, fondos, plazo, desglose,
reintento, continuar/volver. NAVIGATION, scroll, loading/error/empty y motion intactos.
Referencia: monto/slider de screens-inversion.jsx; estilos focales independientes.
Controles administrativos: NOT APPLICABLE.

## VERIFY / EVIDENCE
Build focal reproducible: `node docs/qa/evidence/loan-amount-term-ui-20260925/build.cjs C:/tmp/babel-standalone-7.28.4.min.js`.
La generación completa se descartó por reformateo ajeno. Se conserva byte a byte
todo módulo anterior/posterior a screens-loan.jsx. `build.json` registra SHA256.
Pruebas PASS:
- `node scripts/test-loan-amount-term-ui.js`: tres fondos, cambio desde 1/7/18/24,
  preservación de 6/12, intersección autoritativa, límites y adelantos de un pago.
- `node scripts/test-loan-simulator-ui-cutover.js`: contrato de cuatro pasos,
  estados, backend, debounce/cancelación y ausencia de fallback/cálculo local.
- `node scripts/test-loan-stale-quote-browser.js`: Chrome aislado, monto 5000/3300,
  error por cotización incompatible y recuperación, los tres fondos, selección 12,
  monto formateado, 40/44px, peso 900, color, clamp 20000→10000 y slider→6500.
- `node scripts/test-loan-deposit-step.js` y `node scripts/test-loan-submission-success.js`.
- `git diff --check -- app/screens-loan.jsx app/bundle.js scripts/test-loan-simulator-ui-cutover.js scripts/test-loan-stale-quote-browser.js`.

Chrome usa fixtures sólo en su página aislada, sin login, solicitudes ni escrituras
externas. Se normaliza CRLF→LF al servir JS para respetar SRI como en publicación;
se retira el aviso de arranque del shell ajeno al componente bajo prueba. Eventos
de input/focusout/pointerup simulados; no es certificación táctil de dispositivo físico.
Pruebas iniciales fallidas por entorno/harness corregidas; evidencia final browser.json.
Captura loan-390.png inspeccionada: monto, lápiz, barra, límites y dos tarjetas correctos.

CLAUDE UI PRESERVATION REVIEW
Screen: Suti Préstamo.
Original/current sections: mismo orden y secciones; sólo controles autorizados retirados.
Missing sections: ninguna. Added sections: ninguna.
Interactions/navigation preserved: PASS (contrato estático y navegador focal).
Visual structure preserved: PASS salvo rediseño expresamente autorizado del monto/barra.
Unauthorized redesign: NO. Verdict: PASS.

H-LOAN-AMOUNT-TERM-UI-001 RESULT
Status: PASS (local).
Files changed: screens-loan.jsx, bundle.js, tres scripts focales, audit, changelog y evidencia.
Source-of-truth verdict: SAFE; Supabase conserva criterios y cotización.
Invariant verdict: PASS; cero cálculo financiero, persistencia o fallback nuevos.
Build: PASS; un módulo generado, resto intacto.
Tests: PASS; comandos y browser.json arriba.
Security: sin cambios de Auth/RLS/Storage/API ni secretos. Prueba backend nueva NOT APPLICABLE.
Legacy impact: cero; SAFE CHANGE presentacional autorizado.
Unexpected files changed: ninguno de esta H. Registry, migración admin_assisted_context
y archivos loan-transfer/savings-audit ya estaban modificados al inicio y se preservan.
Known limitations: sin deploy ni prueba productiva; no se cambia política backend.
El diff-check global detecta whitespace previo en la migración ajena; check focal PASS.
Regresión global de imágenes: NOT APPLICABLE por excepción GENERATED_ARTIFACT de AGENTS.
Evidence: ../qa/evidence/loan-amount-term-ui-20260925/.

## ARCHITECT REVIEW
Task reviewed: H-LOAN-AMOUNT-TERM-UI-001.
Verdict: APPROVED para implementación local.
Review: diff real, selección, contrato de cotización, pruebas y hashes contrastados.
Hallazgos: API entrega nombre del fondo, no código estable; normalización existente
reutilizada. Sólo se restringe la intersección recibida, sin inventar disponibilidad.
Architecture/source of truth/security/data/legacy: sin cambios de autoridad o infraestructura.
WORK_QUEUE_HISTORY.md no existe; WORK_QUEUE no autoriza publicación automática.
Owner decision required: NO para el alcance solicitado.
Recommended next action: conservar el resultado local; no iniciar otra H ni desplegar.

RESPONSE TO CODEX
Aprobar H-LOAN-AMOUNT-TERM-UI-001 local. Entregar evidencia y aclarar que no está publicada.
No ejecutar continuación ni alterar trabajo previo.

SUTIAPP ARCHITECT REVIEW
Task: H-LOAN-AMOUNT-TERM-UI-001. Verdict: APPROVED.
Critical findings: ninguno dentro del alcance.
Source of truth: SAFE. Architecture: focal. Security: intacta. Data: sin escrituras.
Legacy: intacto. Owner decision: NO. Next action: entrega local.
Response generated for Codex: YES.
