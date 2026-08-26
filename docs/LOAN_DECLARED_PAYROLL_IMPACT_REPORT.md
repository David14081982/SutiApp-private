# H-LOAN-PAYROLL-IMPACT-003 — Nómina declarada e impacto informativo

## PRE-CHANGE AUDIT

```text
H: H-LOAN-PAYROLL-IMPACT-003
Objetivo: activar con autoridad real las superficies Claude “Impacto en tu quincena” y “Tu talón de pago”.
Alcance: schema/RPC Supabase, RLS/auditoría, repositorio, proyección Edge, UI, bundle, tests y gobierno.
Fuera de alcance: tasas, fondos, plazos, elegibilidad, Apps Script, hojas Google, aprobación, export y nómina oficial.
Datos afectados: percepciones y deducciones quincenales declaradas por afiliado.
Fuentes de verdad: Google para FinancialSimulationResult; Supabase para declaración; 30% sólo referencia informativa.
Legacy involucrado: lectura de paymentPerPeriod ya resuelto; cero writes/cambios de regla Google.
Riesgo: PII financiera, acceso cruzado, impersonación, cálculo local o autoridad paralela.
Recovery: rollback sólo con tabla vacía; con filas exige backup y falla cerrado.
Status: PASS
```

## Contrato de pantalla preservado

```text
SCREEN: Suti Préstamo / Monto
SECTIONS: resultado, fondos, monto, plazo, impacto, talón, desglose, programa/fondo, CTA.
CONTROLS: fondo, input/slider/chips de monto, plazos reales, editar/agregar talón, desglose, continuar.
INTERACTIONS: auto-recalculation, debounce, stale protection, editor modal, retry, cuatro pasos y back.
DATA CONSUMERS: FinancialLegacyRepository + PayrollDeclarationRepository.
EMPTY/LOADING/ERROR: estructura visible; sin fallback.
MOTION: SmoothMoney y rutas, respetando reduced-motion.
SCROLL: contenido desplazable y footer fijo.
```

## Autoridad y seguridad

- Declaración: `public.affiliate_payroll_declarations`.
- Writer: `save_current_declared_payroll`, sólo afiliado Auth propio, sin impersonación.
- Readers: RPC propias; tablas sin grants de cliente.
- Derivado: `get_current_declared_payroll_impact`, server-side, con pago de cotización Google.
- Auditoría: `affiliate_payroll_declaration_audit`, actor real y valores antes/después.
- Alternativas: `DATA`, `nominaStore`, `localStorage`, mock y talón local prohibidos.
- Borrado: no expuesto; recovery destructivo falla si existen filas.

## Nota de plazos

La UI conserva tarjetas horizontales y renderiza exclusivamente `allowed_terms` del resolver. La lectura real del 2026-08-24 confirmó 146 reglas y, para la muestra Base/SUTISSSTESON/Caja de Ahorro, 24 pagos; no se inventan las opciones 6/12/18/“Otro” del harness.

## Verificación

```text
Migration applied: PASS
RLS forced / direct grants denied: PASS
Authenticated read/write/impact RPC: PASS
Anonymous denied: PASS
Cross-user isolation: PASS
Impersonated write guard: PASS (live Admin context denied and closed)
Optimistic version + audit: PASS
Recovery DDL in rolled-back transaction: PASS
Affiliate count preserved: 947
Declarations after QA cleanup: 0
H005_TEST2 fixture after cleanup: 0
financial-legacy cloud: ACTIVE v9 / verify_jwt=true
Google writes: 0
Bundle: 83 sources / v103
PWA cache: v47
Static financial/UI/regression suites: PASS
Real Chrome editor + READY impact + four-step flow: PASS
Auto quote debounce / max in-flight: PASS / 1
Term options for QA profile: one real option; multi-term test NOT APPLICABLE
```

El test genérico `test-frontend-boot-browser.js` sigue reportando `FAIL` por errores 401/`ADMIN_DENIED` que stores administrativos preexistentes disparan antes de login. La pantalla de acceso monta, no hay excepciones runtime y esta H no añadió esas llamadas; la prueba específica autenticada de Suti Préstamo pasó sin excepciones. Se registra como deuda preexistente fuera del alcance, no como evidencia positiva de esta H.

## SOURCE OF TRUTH AUDIT

```text
Domain: nómina quincenal declarada para simulación.
Authority: public.affiliate_payroll_declarations.
Readers: RPC propia y financial-legacy para proyección informativa.
Writers: afiliado Auth propio mediante RPC; desde ADR-051 también administrador activo bajo sesión contextual válida, con actor/contexto/sesión/motivo auditados.
Alternative sources: ninguna; harness DATA/nominaStore sólo referencia visual.
Fallbacks: ninguno.
Caches: ninguno persistente.
Conflicts: ninguno; Google conserva FinancialSimulationResult.
Verdict: SAFE.
```

## Reviews

```text
DATABASE MIGRATION: PASS — PK/FK/checks/RLS/grants/version/audit/recovery verificados.
SUPABASE SECURITY: PASS — Auth/identidad separados, tablas cerradas, aislamiento live y sin secretos frontend.
LEGACY GOOGLE: READ ONLY — 146 criterios leídos, cero escrituras y cero cambios de regla/fórmula.
CLAUDE UI PRESERVATION: PASS — impacto, talón, editor, estados, desglose, tabs y cuatro pasos presentes.
```

## H-LOAN-PAYROLL-IMPACT-003 RESULT

```text
Status: PASS
Files changed: SutiApp.html; sw.js; app/screens-loan.jsx; app/payroll-declaration-repository.js; app/financial-legacy-repository.js; app/bundle.js; scripts/build-bundle.js; financial-legacy Edge; migration/recovery; pruebas y documentos de gobierno enumerados por esta H.
Source-of-truth verdict: SAFE — una autoridad por declaración; Google conserva el resultado financiero.
Invariant verdict: PASS — INV-055/057/058 preservadas; INV-083–086 activas.
Build: PASS — 83 fuentes, bundle v103, syntax PASS.
Tests: PASS — estáticas, live, recovery transaccional y Chrome autenticado.
Security: PASS — RLS/grants/RPC/cross-user/anónimo/impersonación/auditoría/version.
Legacy impact: READ ONLY — 146 criterios leídos, 0 writes Google, 0 reglas modificadas.
Unexpected files changed: ninguno detectado dentro del alcance auditado; el workspace no contiene metadata Git para diff histórico independiente.
Known limitations: cada perfil sólo muestra los plazos que Google autoriza; QA expuso una opción. El test genérico pre-login conserva errores Admin 401 preexistentes fuera de esta H.
Evidence: comandos y salidas registrados en esta sección; financial-legacy ACTIVE v9; declaration_count=0 y qa_fixture_count=0 al cierre.
```

# ARCHITECT REVIEW

Task reviewed: `H-LOAN-PAYROLL-IMPACT-003`.

Verdict: `APPROVED`.

What Codex did correctly: separó autoridad Google/Supabase/indicador, mantuvo el contrato financiero y el flujo Claude, cerró tablas, auditó el writer, denegó impersonación y demostró cleanup/recovery.

Important findings: `financial-legacy` v9 está activo; el perfil QA ofrece un solo plazo real; `WORK_QUEUE_HISTORY.md` no existe y el workspace no tiene metadata Git, limitaciones declaradas que no impiden validar esta H con archivos, hashes y pruebas reales.

Problems detected: ninguno dentro del objetivo autorizado. El harness general pre-login conserva ruido 401 Admin preexistente y queda fuera de esta H.

Architecture implications: la declaración es un dominio independiente; la cotización y aprobación siguen sin depender de ella.

Source-of-truth implications: una autoridad Supabase para importes declarados; Google continúa como única autoridad del resultado financiero.

Security implications: mínimo privilegio, actor real, denegación de impersonación, aislamiento cross-user y cero acceso directo comprobados.

Data implications: cero declaraciones/fixtures al cierre; auditoría de las pruebas de seguridad permanece durable; 947 afiliados preservados.

Owner decision required: `NO`.

Recommended next action: cerrar la H y entregar; no avanzar Phase 8 ni inventar plazos o una solicitud Google.

# RESPONSE TO CODEX

Aprobar `H-LOAN-PAYROLL-IMPACT-003`. Entregar el cambio y su limitación de plazos reales; conservar Google, reglas y Phase 8 sin cambios.

```text
SUTIAPP ARCHITECT REVIEW

Task: H-LOAN-PAYROLL-IMPACT-003
Verdict: APPROVED

Critical findings: none in authorized scope

Source of truth: SAFE
Architecture: PASS
Security: PASS
Data: PASS
Legacy: READ ONLY / 0 Google writes

Owner decision: NO

Next action: deliver and close this H

Response generated for Codex: YES
```
