# H-LOAN-DEPOSIT-OPTIONAL-BANK-001 — Evidencia

## Hallazgo y corrección

El gate anterior exigía simultáneamente cuenta `COMPLETE`, tarjeta de 16 dígitos, CLABE de 18 con checksum, cuenta seleccionada y celular de 10 dígitos. Por eso llenar texto visible no garantizaba habilitar “Continuar”. ADR-085 separa responsabilidades:

- avanzar/confirmar: Depósito cargado + celular válido;
- guardar/usar cuenta: banco + titular derivado + tarjeta válida + CLABE válida + ownership;
- sin cuenta: snapshot privado con cinco campos bancarios `NULL`, celular requerido.

No se cambió `affiliate_bank_accounts`, `account_number`, cálculos, documentos, workflow, Admin, Google o Apps Script.

## Backend

- Dry-run forward/recovery: `PASS`, 6 solicitudes, 0 snapshots, 0 filas cambiadas.
- Apply `20260831000300`: `PASS`, 0 filas cambiadas.
- Edge `financial-legacy` v30: `ACTIVE`, JWT `true`, source SHA-256 `d7e8bb5ed90fbb8ec04485092d75e0cfc1c24ddd391ee1f989cf317da40fe4d2`.
- Post-E2E: 6 solicitudes, 0 snapshots QA, migration `VERIFY_APPLIED`.

## Tests

```text
node scripts/test-static-suite.js
PASS 69/69

node scripts/test-loan-deposit-security-live.js
PASS — self-only; cross-read DENIED; cross-write DENIED; private snapshot DENIED; anon DENIED

node scripts/test-loan-deposit-step-browser.js --optional-bank
PASS — campos vacíos; Continuar habilitado; Documentos; Resumen opcional; folio real; Historial;
       snapshot bank NULL; 390x844, 430x932, 768x1024, 1280x900; browser exceptions 0

node scripts/test-loan-deposit-step-browser.js
PASS — guardar cuenta completa; persistencia; máscaras; request/snapshot/folio/Historial;
       mismos cuatro viewports; datos completos no expuestos
```

Las dos solicitudes y la cuenta QA se eliminaron sólo después de comprobar ausencia de historia Admin/export; el celular y sesiones temporales se restauraron. Screenshots se mantuvieron únicamente en memoria (`sensitive screenshots persisted: 0`).

## Artefactos

- Bundle: 92 fuentes; SHA-256 `C40D9DB9249C612F802EDD4721611F642E185DBF0F440F4498FB6F99638145AA`.
- Cache: `bundle.js?v=177`, `sutiapp-v121`.
- Secret/PII: ningún secreto versionado; datos bancarios completos ausentes de logs/evidencia.
- Legacy: Google read/write `0/0`; Apps Script changes `0`; cálculos financieros modificados `0`.
