# H-LOAN-DEPOSIT-STEP-001 — Evidencia

Fecha: 2026-08-30
Resultado: `PASS`

## Autoridad y alcance

- Wizard productivo: `Monto → Depósito → Documentos → Resumen`.
- Autoridad mutable: `affiliate_bank_accounts` y `affiliates.notification_phone`.
- Evidencia histórica privada: `loan_request_deposit_snapshots`.
- Writer final: Edge `financial-legacy` → RPC service-only `create_validated_financial_program_request`.
- Sin cambios en elegibilidad, reglas, fondos, tasas, fórmulas, Google, Apps Script, amortización o conciliación.
- El HTML standalone citado en la solicitud no fue adjuntado; se preservó el lenguaje visual vigente de Suti Préstamo y se verificó el contrato funcional solicitado.

## Migración y despliegue

- Dry-run forward + recovery: `PASS`, `dataRowsChanged: 0`.
- Aplicación `20260830000500`: `PASS`, `dataRowsChanged: 0`.
- Verificación posterior: `VERIFY_APPLIED PASS`.
- Frontera self-only `20260830000510`: dry-run/recovery, aplicación y verificación `PASS`, `dataRowsChanged: 0`.
- `financial-legacy` v29: `ACTIVE`, `verifyJwt: true`.
- Source multiarchivo desplegado SHA-256: `b8dddcf2e7281fa8e2bd0808a00be931d731fd45e7394399cade20d0965bdedc`.
- ESZIP remoto: 589350 bytes, SHA-256 `94c8855d0d748a829512a5df6c15098ce81977ad0a0b410d3634efcca2eff8c9`, cinco marcadores contractuales presentes.

## E2E y seguridad

- Chrome real mostró dos cuentas propias (una incompleta), creó otra por la UI, comprobó persistencia y máscaras después de un refresh real, avanzó por Documentos/Resumen, firmó, confirmó una sola vez, verificó folio, snapshot privado e Historial y eliminó la fixture exacta.
- Viewports verificados: 390×844, 430×932, 768×1024 y 1280×900; sin overflow y con CTA visible.
- Capturas sensibles persistidas: 0.
- Resultado final: solicitud temporal `SR-2026-000051`, eliminada al cerrar la prueba.
- Matriz live: lectura autoservicio Admin/normal `EFFECTIVE_AFFILIATE_ONLY`; propietario `ALLOWED`; lectura cross-user `DENIED_BY_RLS`; escritura cross-user `DENIED_BY_RPC`; snapshot privado `DENIED`; anónimo `DENIED`; escrituras de fixture de seguridad: 0.

## Verificaciones reproducibles

```text
node scripts/apply-loan-deposit-step.js
node scripts/apply-loan-deposit-self-read.js
node scripts/deploy-financial-legacy.js status
node scripts/deploy-financial-legacy.js verify
node scripts/test-loan-deposit-step.js
node scripts/test-loan-deposit-security-live.js
node scripts/test-loan-deposit-step-browser.js
node scripts/test-loan-simulator-ui-cutover.js
node scripts/test-phase7.js
node scripts/test-personalized-financial-session-snapshot.js
node scripts/test-loan-document-flow.js
node scripts/test-loan-document-context-isolation.js
node scripts/test-loan-submission-success.js
node scripts/test-request-submission-e2e-remediation.js
node scripts/test-request-workflow-timeline-cutover.js
node scripts/test-banking-user-maintained.js
```

## Build

- Bundle: 92 fuentes.
- SHA-256 `app/bundle.js`: `78353B76769B24CD8BB5084AF63AAB60E5F1BF36F67800D45A86401DF9F9D5C9`.
- No se persistieron secretos, tarjetas, CLABE, celulares ni screenshots de la prueba.
