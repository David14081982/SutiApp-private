# H-SUTIAPP-DOCUMENT-EDITOR-SCOPES-001

## Pre-change audit / authority / plan

Owner authorizes one editable layout shared by designer/preview/PDF; named versions with assignments by program, fund and document type; sharing across compatible programs; removal of the loan disclaimer. Reuse private layouts, activations, snapshots, renderer, templates and existing controls. Historical PDFs and business snapshots stay untouched. Specific fund assignments take precedence over an explicitly assigned program-wide design; no cross-program fallback. Missing design is a visible documentary failure, never a business rollback.

Scope: app/document-layout-designer.jsx; app/screens-admin-document-generation.jsx; document-generation/{index.ts,layout-service.mjs,layout.mjs,renderer.mjs,render-layout.mjs}; additive 20260929000200_document_layout_scopes migration/recovery; existing scripts/test-document-generation-core.js; build artifact app/bundle.js and SutiApp.html cachebuster; this audit, SOURCE_OF_TRUTH, AGENT_CHANGELOG and derived architecture registry. No shared viewer/Auth/Storage/repository changes or global-image trigger.

Authority: document_private.layouts/activations own presentation. Financial_funds supplies fund labels only; normalized approved financialResult.fund selects the documentary assignment. No financial catalog writer, calculation or Google change. Existing configuration owns signers; template is pinned by layout. Source/issued snapshots and existing PDFs are immutable. No data fallback.

Security: existing config.read/config.write gates, service-only persistence, forced RLS; validate every activation destination in backend; atomic multi-destination assignment and stale-version checks. Recovery snapshots prior function definitions, restores old dispatch without deleting new layouts/activations or historical records. New fund-specific activations must remain isolated from legacy queries after recovery.

UI: preserve tabs, cards, dialogs, asset uploads, signers, margins, drag/resize, pages, zoom, field selection, named errors, preview. Owner-authorized additions: name, fund selection, compatible destination assignments, duplication, exact active-state labels; remove SYSTEM switch. Initial layout becomes the same editable definition used by rendering. Required identity/finance fields remain contract validated. Missing configuration stays visible.

Verification: existing in-memory PostgreSQL/PDF contract suite extended for assignment scope, sharing, conflicts, missing config, historical resolution, retry, security/recovery and exact preview layout; existing real Chrome UI path for drag, labels, funds and activation. No new permanent QA script/fixture/PDF, no real signature download, no live QA records. Release backend before frontend; initialize only existing SYSTEM configuration scopes with named editable defaults if needed, preserving current pinned template and custom layouts. No automatic historical reissue.

Risk: MEDIUM (document-only config/schema). Guardian verdict: SAFE within owner scope. Registry base has line-ending-only stale hashes; source files inspected directly. No delegation.

## Verification before release

PASS: existing core suite with --browser (24 grouped checks), actual Chrome desktop/mobile editing, program switching, fund override selection, duplication/activation and preservation of unrelated fund assignment; drag/resize, preview, upload and signer operations retained. Renderer regression 7 groups PASS; loan calendar 7 groups PASS (including fixed advance maturity). No permanent PDF/QA files or production QA rows. Initial and explicitly supplied identical definitions render byte-identical synthetic PDFs. The removed loan note is absent; explicitly selected signer columns are respected without changing old auto-column semantics.

Recovery intentionally disables generation and restores prior function definitions; deploy matching previous UI/Edge before any operator-controlled re-enable. Added columns/versions/assignments remain for history. No deletion or automatic rollback of business operations.

Architecture review of actual diff: one existing layout/activation authority; document-type FK retained while permitting compatible program sharing. All assignment targets checked atomically; stale writes fail; service-only persistence, user-bound permission gate and forced RLS retained. No new renderer pipeline, financial rules, Auth or Storage writer. Global image regression NOT APPLICABLE: only focal document UI/renderer and generated artifact, no shared repository/viewer changes. UI PRESERVATION PASS with owner-authorized replacement of SYSTEM selector by scope/name/assignment controls.

Directed source discovery: create_validated_loan_request in 20260831000300_optional_loan_deposit_account.sql stores every loan fund under program_requests.program_id=prestamo. Financial catalog ownership remains 33 prestamo / 1 caja / 1 nomina; existing Caja Chica and Sutiexpress documentary records use prestamo. The selector projects all 35 active financial funds into the prestamo request scope, while caja/nomina selectors retain their own funds. This is presentation routing, not a financial ownership reassignment. Added an isolated regression for this exact distinction.

Final local verification: core suite 23/23 PASS after the catalog-ownership regression, including activation and resolution of Caja Chica inside prestamo. Architecture acceptance PASS (generation, freshness, lookup, reverse relations, permissions, incremental generation, secrets scan, determinism); the earlier run overlapped source editing and was superseded by this stable-tree run. Build v304 contains only the two declared frontend module changes; other 139 modules unchanged. Bundle SHA256: 4622a752e648202103e0cd785afe9bb3d965827b2f7c501b4ad9dc659f9c2111. Edge bundleOnly compilation PASS.

Release preflight, read-only: 14 configured scopes, 13 SYSTEM and one custom Viajes layout; 16 existing document records. All current configuration creators have the principal_admin role. The 13 editable initial definitions validate/render in memory with the actual configured page dimensions and margins, using synthetic names/signatures and an empty synthetic background (zero private assets downloaded). Complete starter designs currently occupy two explicitly editable pages; this is not a promise to force arbitrarily long calendars onto one page. Existing custom Viajes is preserved. Bootstrap provenance will explicitly identify owner-approved migration, referenced configuration and code commit; no fictitious human edit or business event.

SUTIAPP ARCHITECT REVIEW
Task: H-SUTIAPP-DOCUMENT-EDITOR-SCOPES-001
Verdict: APPROVED for the reviewed implementation and authorized release, subject to release readback.
Critical findings: no additional authority or financial writer; scoped assignment is deterministic and contract constrained. Existing PDFs remain immutable. Forced one-page layout for unlimited variable content is not claimed.
Source of truth: PASS, existing private documentary tables.
Architecture: PASS, one definition and renderer, derived registry acceptance passed.
Security: PASS locally, service-only writes and backend capability gates.
Data: PASS locally, historical records and existing definitions preserved.
Legacy: NOT MODIFIED.
Owner decision: NO.
Next action: publish the already authorized change with backend-first readback and atomic conversion of SYSTEM scopes; retain custom assignments and existing document records.
Response generated for Codex: YES.

RESPONSE TO CODEX: Complete only this H's authorized release. Verify source hashes, private permissions, historic preservation, assignments and both published bundle hashes; record the release receipt. Do not start another H, reissue historical PDFs, change financial operations or download real signatures.
