# H-FINANCE-DOCUMENT-REVIEW-002

## PRE-CHANGE AUDIT

Status: implementation authorized by the owner reporting false negatives in SR-2026-000934. Publication authority continues from the existing integration request. No new UI, credit decision or calendar policy is authorized.

Objective: improve extraction of printed net payroll and rotated INE validity expressed in years; bounded targeted reread; specific observations; keep missing administrative calendar out of the proposed applicant rejection.

Owner clarification during implementation: report the periods on both receipts; impose no fixed payroll dates, and let the finance officer decide temporal applicability. This supersedes the earlier explicit-calendar requirement for the documentary evaluator. Remove calendar/outdated/future-payment compliance checks, retain date syntax/order and duplicate-period findings. Existing payroll_periods table is not altered or populated. Expand scope to the existing app/financial-document-review.jsx payroll cell (both periods only), generated bundle/cache references, focal UI tests, docs/DECISIONS.md and docs/SOURCE_OF_TRUTH.md. No section, button or workflow added. UI preservation guardian applies; generated-only cache changes do not trigger the global image regression.

Scope: isolated release based on f89945a. Files: supabase/functions/financial-document-review/{engine.mjs,openai.mjs,service.mjs}; scripts/test-financial-document-review.mjs; a synthetic live vision probe under scripts; this audit and docs/qa/evidence/financial-document-review-002. Temporary release/probe tools under .tmp/financial-document-review. No schema, Storage, shared helper, frontend, financial writer or original document changes. Generated registry only if dependencies change.

Authority: pinned request_documents/private_assets and immutable request snapshots remain authoritative. Extraction and financial_review_private.reviews remain replaceable advisory derivatives. Existing claim/finish lease/source verification is unchanged. No declared income, credit capacity, balance, payment formula or Google access. No new source or browser persistence.

Navigator: STALE only for prior accent/cache and publication evidence changes; direct inspection confirms the focal engine, adapter, service and SQL contracts. No structural registry update is required for internal extraction refinements.

Plan: represent year precision explicitly without inventing a month/day; normalize documented Mexican payroll currency in extraction without treating every dollar symbol as MXN; reread only unresolved INE/payroll attachments once; preserve contradictory readings as manual; report distinct net causes; mark internal calendar finding non-correctable and exclude it from the rejection draft. Keep exact V1 result envelope accepted by installed SQL and add an analysis revision for traceability.

Risk: OCR can still misread. No automatic approval/rejection. No broad reprocessing or raw extraction logs. Tests use synthetic names/identifiers and generated layouts reproducing small footer text and rotated year-only validity. A requested real-case reevaluation uses the existing worker and only after passing local/provider verification; private inputs stay in memory and are sent only to the existing fixed OpenAI endpoint. No diagnostic resend of unrelated dossiers.

Recovery: restore prior three Edge sources/deploy; retain original documents and business records. Derived pending reviews may be requeued through the existing lease protocol. No destructive migration.

Verification planned: engine/schema/adapter tests, targeted synthetic real-provider probe, Deno check, managed bundle, specific Edge deployment and worker validation if authorized by environment. Shared-image global regression NOT APPLICABLE because no shared image, Storage, routing or UI code changes. Source-of-truth SAFE; legacy classification READ ONLY / no legacy access; backend authorization boundaries unchanged.

## Implementation verification

Engine/adapter 25 cases PASS; isolated browser five groups PASS, including both period ranges, three viewports, manual/failed approvals still enabled, existing rejection field/freshness and navigation. Deno type check PASS. Bundle builds from the existing 179 sources. Unit tests prove no calendar/date-recency condition, year precision without fabricated dates, missing/ambiguous currency remains manual, totals conflict remains manual, bounded targeted reread, contradictory/malformed/failed reread cannot upgrade a finding, and missing provider cannot claim work.

Real-provider synthetic calibration: a first deliberately unidentifiable fictional hospital produced readable net and year validity but no proven currency; the engine correctly kept its amounts unverified. A second marked-fictional fixture with the public Mexican institution name matching the reported layout, fictitious holder/RFC, printed dollar symbol and Mexican fiscal context passed: footer net 2393.85, two-receipt average 2496.93, rotated INE range 2025–2035, no invented expiry date and no calendar finding. No real applicant documents were used by this test. Evidence: vision-live.json. Model gpt-5.6-terra; one pass, 8910 total tokens. Initial negative assertions were diagnostic failures, not relabeled passing test runs.

Official references: https://developers.openai.com/api/docs/guides/images-vision documents small-text/rotation limitations and original detail support. Original detail is restricted to the configured supported model family on a bounded second pass. Total adapter deadline is 105 seconds; second-pass failure is explicit in result.analysis and cannot turn incomplete evidence into compliance. https://developers.openai.com/cookbook/examples/multimodal/document_and_multimodal_understanding_tips supports document-oriented prompting and image detail selection.

UI contract: existing finance queue headers, filters, controls, selection, row/detail navigation, observations, approval/rejection, net/average/extras and loading/error states preserved. Only both read period ranges are shown within the existing payroll cell, as explicitly requested. No additional section/control. Focal UI guardian PASS.

## Real reported case and rollout

Edge v4 deployed with JWT verification and unchanged index/shared Storage sources. SR-2026-000934 was queued through the existing worker, renewing only its derived review; its program_requests row hash was unchanged. The actual result completed with revision 2026-11-13.2: PASS, net matches the owner's reported example, average verified, INE validity verified, no observations, no calendar finding and no provider error. It required one pass. No document download for a separate diagnostic or private-data logs were used; the already-authorized worker processed the owner-reported dossier normally.

The owner's general correction request and subsequent no-fixed-dates instruction apply to all pending loan evaluations. After this successful case, refresh only existing pending loan review derivatives produced by older analysis revisions (COMPLETE/ERROR); exclude completed financial requests, in-flight workers, new-version results and unrelated programs. Bound mutation to at most 500 rows, transactionally compare the program_requests fingerprint and let the existing scheduler reprocess the queue. This removes obsolete calendar observations without changing any business decision or original document.

Pending refresh completed: 13 existing derivatives queued, fingerprint of all program_requests unchanged, zero approved/rejected requests touched. Evidence: pending-refresh.json. Identity/photo/navigation responsive regression six cases PASS; Pages deployment artifact PASS with zero forbidden files. No SQL migration or schema change.

Focal architect review before Pages publication: APPROVED for the bounded correction. Inspection confirms unchanged backend auth/RLS/leases and financial writers, source-preserving reread, deterministic totals guard, no calendar policy inferred, exact UI scope, no raw extraction or secrets in committed evidence. Registry requires regeneration because the adapter now imports the engine helpers; this dependency update and its checks are in progress. Next instruction: publish the bounded commit, verify exact public asset hashes and the reported row with both periods, then close evidence. No unrelated workflow or financial append is authorized.
