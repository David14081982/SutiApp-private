# H-REQUEST-SUBMISSION-CRITICAL-REMEDIATION-001 — evidencia

## AUDIT → AUTHORITY → PLAN → RISK

Alcance declarado: cadena `Confirmar solicitud → app/financial-legacy-repository.js:confirmLoanSession → financial-legacy:loanSessionConfirm → create_validated_financial_program_request → program_requests/request_documents/snapshots → request-submission-success.jsx`, migración/recovery mínima, pruebas focales y gates pre/post deploy. Fuera de alcance: rediseño, cálculos, fondos, catálogo, Membership, Marketplace, documentos globales, imágenes, fullscreen, service worker y Google legacy.

Autoridad: `public.program_requests` para la solicitud; `affiliate_bank_accounts` para Depósito; `loan_request_deposit_snapshots` para el snapshot privado; `program_request_workflow_snapshot`/tracking para éxito e historial. No se agregó fallback, mock ni fuente paralela.

Riesgos controlados: no reescribir historia; backup privado de definiciones; recovery aborta si historia nueva usa Card-only/CLABE-only; writer sólo `service_role`; guard CI sin secretos privilegiados; fixture QA eliminado por ID exacto.

## Causa raíz demostrada

- Referencia visible: `FC8763BA`; correlation ID completo: `fc8763ba-47c7-42e9-8cc1-9c52cf8e373f`.
- Edge log: `financial_request_submission_failed`, stage `request_writer`, `UNCLASSIFIED_WRITER_FAILURE`, SQLSTATE `42501`, `2026-09-03T04:07:25.782Z`.
- PostgreSQL log del mismo instante: `DEPOSIT_ACCOUNT_UNAVAILABLE`.
- Lectura productiva del usuario del incidente: una cuenta `CARD_ONLY`, `data_status=COMPLETE`.
- Contrato frontend/guardado ADR-092: Banco + (Tarjeta de 16 dígitos OR CLABE válida).
- Contrato real anterior del submit: `card_number ~ 16 AND is_valid_clabe(clabe)` tanto en `create_validated_financial_program_request_bank_required` como en `loan_deposit_optional_bank_coherence`.
- Resultado: incompatibilidad frontend/backend; el writer abortó la transacción antes de crear `program_requests`, por lo que nunca existieron folio ni transición a success. No fue RLS, firma, documentos, depósito ausente, folio ni UI success.

## Cambio exacto

`20260903000100_request_submission_deposit_contract.sql` reemplaza sólo el predicado final por OR y valida cada campo presente. Ajusta el constraint del snapshot al mismo contrato, conserva la definición anterior en backup RLS privado y añade el probe sin PII `SUTI_REQUEST_SUBMISSION_V2`. `20260903000110_request_submission_contract_probe.sql` endurece la detección del constraint con `search_path=''`. La Edge clasifica explícitamente los errores de depósito/teléfono ya manejados por UI.

Payload real confirmado: `action`, `snapshot_id`, `program_id`, `amount`, `term`, `program_item_id`, `notes`, `signature_data`, `terms_accepted`, `terms_version_id`, `document_ids`, `idempotency_key`, `bank_account_id`, `notification_phone`. Respuesta contractual: `request_id`, `folio`, `status`, `confirmed_amount`, `correlation_id`, `idempotent` en reintento.

## VERIFY / EVIDENCE

- Apply productivo: `PASS / UPDATED`, migrations `20260903000100, 20260903000110`, business rows changed `0`.
- Recovery dry-run forward/reverse: `PASS`, persistent writes `0`.
- Edge `financial-legacy` v33: `ACTIVE`, JWT verificado; source SHA-256 `d9333d90484256afedef138a7158d4d7e52e1c102bb7de639e8e271a4cfac19f`.
- Probe productivo: `PASS`, `SUTI_REQUEST_SUBMISSION_V2`, writer/snapshot/idempotency ready.
- E2E build local + backend productivo: `PASS`; solicitud real, folio, snapshots, success, 42 confetti, doble clic/retry/refresh sin duplicado y cleanup exacto.
- E2E GitHub Pages + backend productivo: `PASS`; referencia real `SR-2026-000079`, success visible, 42 confetti, una fila tras doble clic/retry/refresh y cleanup exacto.
- Error real focal: HTTP `409`, `REQUIRED_DOCUMENTS_MISSING`, correlation ID presente, detalle SQL ausente, solicitudes persistidas `0`.
- Usuario propio: sesión no-admin; Edge deriva actor/afiliado y el row creado coincidió con el afiliado efectivo. Browser no ejecuta RPC service-only.
- Post-deploy público: artefacto, repository, success y backend compatibility `PASS`, credenciales privilegiadas `0`.
- Google writes: `0`. Suites globales: no ejecutadas por alcance explícito.

Impacto compartido: `YES` sólo para otras variantes de Suti Préstamo que convergen en `loanSessionConfirm`. Membership (`create_membership_request`), solicitudes generales (`create_program_request_with_documents`) y productos financieros (`create_validated_program_product_payment_request`) usan writers diferentes y no estaban afectados; fueron inspeccionados sin modificación.
