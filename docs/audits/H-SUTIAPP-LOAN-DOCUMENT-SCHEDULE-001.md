# H-SUTIAPP-LOAN-DOCUMENT-SCHEDULE-001

## Audit / authority / plan — 2026-09-29

Owner requests the same payment table shown in Viajes for loan PDFs and explicitly
selects the same payroll-date rule. Existing Viajes layouts include PAYMENT_SCHEDULE
by default; its sealed product-payment snapshot already contains the rows. Loan
snapshots only contain financialResult, so adding a visual block alone cannot supply
dates. Current Préstamos uses SYSTEM; Viajes uses a custom two-page layout.

Scope: additive document-only snapshot enrichment on INSERT, reuse the unchanged
public.generate_program_product_payment_schedule, existing shared renderer/table and
initial loan designer layout. Anchor is request.created_at in America/Hermosillo;
category comes from the sealed operation.profile, never current affiliate data.
Amounts/count/regular payment come from the sealed approval, no quote recomputation.
Owner explicitly confirms: single-payment advances retain their authorized maturity; only periodic loans adopt the Viajes date rule.

Files: this audit; docs/AGENT_CHANGELOG.md; docs/SOURCE_OF_TRUTH.md;
supabase/migrations/20260929000100_loan_document_schedule.sql and matching recovery;
supabase/functions/document-generation/{renderer,layout}.mjs;
existing scripts/test-document-generation-core.js; architecture registry derived files
if its dependency graph changes. No frontend, existing financial writer, Google,
Storage-policy, shared viewer, Auth, rate, interest or approval-state change.

Authority: immutable approved financialResult/profile plus original request date;
calendar rows are frozen documentary derivatives. Reader: existing PDF renderer.
Writer: private INSERT trigger on document_private.records. Historical records remain
unchanged; explicit reissue creates a separate version and may add the schedule.
Failures freeze a controlled document error and never reject the financial operation.
No new table, browser RPC/grant, independent calendar formula or background backfill.

Guards: pre-change/source-of-truth/Supabase/legacy/migration. SAFE for documentary
derivation; protected financial engines and Google remain read-only. Recovery drops
only new trigger/functions; existing document JSON and PDFs remain readable.
Tests: in-memory PGlite with the existing calendar function, request date timezone,
process 1/3/JUB, one/many payments, rounding, failure isolation, permission denial,
source immutability, reissue retention and renderer preview/PDF parity. Zero new QA
files, real signatures, permanent PDFs or live QA rows. Release only after checks.

## Local verification

PASS: existing --loan-schedule-only suite (7 grouped checks), --render-only suite (7 grouped checks); PDFs remain in memory. Migration and recovery compile/run in isolated PGlite with the actual unchanged Viajes SQL generator. Recovery preserves all record bytes. Keep the new renderer reader when rolling back the additive trigger: enriched historical snapshots must remain readable. No historical PDF is regenerated automatically. Current loan SYSTEM layout receives the table; saved custom layouts remain untouched and require their PAYMENT_SCHEDULE block.

PASS: full existing document suite, 19 checks (without optional browser mode), including all seven contracts, RLS, grants, cross-user/module boundaries, event capture, immutable revisions, retries, banking, signatures and recovery. Its historical one-page field/signature fixture now explicitly selects FIELD elements; it does not squeeze the new default schedule into a 10mm text box. New calendar tests separately cover both SYSTEM and custom table pagination.
PASS: 141-module frontend build in memory; no generated artifact changed. Edge bundleOnly compiles successfully. Architecture registry suite passes freshness, lookup, add/remove, secrets and deterministic regeneration. Registry was already stale on the base branch; regenerated derived files include those existing source changes, not runtime edits to those areas.

## Architect review / release gate

APPROVED for this scope: inspected the actual diff, new trigger order after affiliate/deposit capture, unchanged financial functions, revokes and rollback. Documentary inputs remain frozen; only the original request date is read. The advance exception is owner-approved. Existing calendars survive reissue. No frontend, template/configuration, private asset, shared viewer, authentication, business data or historical PDF mutation. Global image regression NOT APPLICABLE; focal renderer and direct dependency suites PASS. No new owner decision. Next instruction: publish only this verified documentary change, verify deployed sources/migration/security, then stop; do not reissue history or alter program templates automatically.

Preflight metadata: migration baseline 20260928000700; 15 documentary records; 12 loan records all have sealed category/count/total, 3 contain fixed maturity. Existing Viajes SQL generator MD5 bec234348879e25fd570572feb52cf2a. No personal or bank values exported. Recovery keeps the renderer reader compatible with already enriched snapshots.
