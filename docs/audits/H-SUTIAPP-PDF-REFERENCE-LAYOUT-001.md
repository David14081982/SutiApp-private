# H-SUTIAPP-PDF-REFERENCE-LAYOUT-001

Owner continuation: use signature columns; add independent image width/height per signature without changing name/title/role font size. Previous page/signature decision is resolved. Extend the same three focal sources and existing tests for bounded per-position signature image sizes, aspect-preserving PDF/preview rendering and editor controls. No new schema, assets, signature files, APIs or financial authority. Signature order remains owned by the program configuration. Append a reference-style loan layout with section headings, inline labels, complete bank bindings, full calendar and three-column signatures; preserve its selected letterhead and all other active scopes. Long content may occupy two pages; no clipped calendar or orphaned third signature. Release remains authorized by the existing session.

Directed fit review: the reference's single-column data and a 12-payment calendar need two pages at readable reference font sizes. Place the complete calendar before the column signatures; optional explicit signer followSchedule/heading presentation controls keep signatures after the final calendar continuation for longer schedules. Existing definitions without these options retain their existing page behavior. This is necessary to avoid placing signatures before later payment rows, without introducing a second flowing renderer.

PRE-CHANGE AUDIT
Objective: replace the unwanted starter grid visible in the loan designer with the owner's attached PDF composition, retaining editable data bindings and program/fund selection.
Scope: document-generation/layout.mjs and render-layout.mjs (controlled inline labels and institutional heading color); app/document-layout-designer.jsx (matching editable controls); existing document-generation core test; bundle/cachebuster; this audit and AGENT_CHANGELOG. Derived registry freshness metadata only if necessary. No new schema, RPC, dependency, permission, viewer or financial calculation.
Data: append a new loan layout version and activation for prestamo/general only after confirming page/signature preference. The screenshot and attached PDF are LOAN_APPROVAL documents on the VIAJES letterhead; tours is a separate assignment and must remain unchanged. Source is document_private.layouts/activations; existing configuration owns signers; frozen approval owns every financial/identity value. No real data copied into layout definitions or evidence.
Read-only reference inspection: attached PDF has two pages, 10pt inline labels, 11pt guinda headings, general identity then approved loan terms, deposit banking, payment calendar, institutional signatures. Twelve payment rows span pages. Three signatures appear vertically on page two. Original request previously preferred three signature columns/one page when feasible; owner asked to choose between preserving that preference and exact reference pagination. Do not infer the answer.
Preserve: template asset, margins, program/fund/type mapping, editor controls, preview, full banking bindings, removal of disallowed loan disclaimer, snapshots and issued files. No arbitrary grid substitution, financial writer, legacy Google access or real signature download.
Security: existing config capability gates, service-only persistence and private RLS. Activation must compare current version/id; append provenance identifying owner-approved reference correction. Recovery reactivates the prior version, never deletes history.
Risk: LOW/MEDIUM, focal presentation and one explicit general-program assignment. No global image-regression trigger; no shared viewer/repository/Auth/Storage change.
Verification: existing render/contract/browser tests as appropriate; synthetic PDF geometry, headings/inline labels, signature placement and deterministic preview; live readback of assignment, all other assignments and historical records. No new permanent QA script/fixture/PDF or production request.
Source-of-truth verdict: SAFE. Legacy classification: READ ONLY / no changes. Status: audit passed; page/signature decision pending before dependent activation.

## Local preparation / decision pending

Implemented optional allowlisted inline labels, institutional text color and calendar-header color in the existing renderer/validator; matching controls and canvas representation in the existing designer. Absent options preserve old behavior. No additional renderer or financial data binding.

Validation: renderer-only 8/8 grouped checks PASS, including actual PDF text operators, guinda color, inline label/value, old above-label default, rejected unsupported values, immutable input and preview/issued geometry. Existing core with Chrome --browser 24/24 PASS, including new control selection and persistence/readback alongside drag/resize, preview, tabs, program/fund assignments, private permissions and historical recovery. Build PASS (141 modules, candidate v305). Whitespace check PASS. No PDF files written, no permanent QA scripts/fixtures added, no production data or deployments.

Live read-only finding: prestamo/general uses Autorización · Préstamos v6, with 26 elements on two pages and VIAJES letterhead; tours/general uses a separate existing custom version. Therefore neither the shared letterhead asset nor tours assignment should be overwritten to correct the loan screenshot.

H-SUTIAPP-PDF-REFERENCE-LAYOUT-001 RESULT (interim)
Status: DECISION REQUIRED
Files changed: 6 declared code/build/test files plus this audit; isolated worktree only.
Source-of-truth verdict: PASS, unchanged documentary authority.
Invariant verdict: PASS for prepared code.
Build: PASS, candidate not published.
Tests: PASS, 8 renderer groups and 24 UI-inclusive core groups.
Security: PASS, no permission/Storage/Auth changes; existing denial tests pass.
Legacy impact: NONE.
Unexpected files changed: NONE.
Known limitations: reference layout version/activation not created; pending owner choice between reference vertical signatures/two pages and earlier three-column preference. No answer has been inferred.
Evidence: attached PDF read-only geometry; existing test results; focal diff.

SUTIAPP ARCHITECT REVIEW
Task: H-SUTIAPP-PDF-REFERENCE-LAYOUT-001
Verdict: OWNER_DECISION_REQUIRED
Critical findings: the previous grid did not preserve the requested reference composition. Prepared rendering controls are compatible; final reference geometry and assignment still need completion.
Source of truth / Architecture / Security / Data / Legacy: unchanged, local checks passed.
Owner decision: YES, solely the conflicting page/signature preferences in user instructions, not a skill-imposed permission gate.
Next action: use owner's pending answer to finish the editable reference layout, validate synthetic reference geometry, append the loan-only version/activation with provenance and guards, then publish and verify. Preserve the existing Viajes assignment and historical documents.
Response generated for Codex: NO.

## Owner decision resolved / release candidate

The owner's next message explicitly selected columns and independent resizing of each signature image without resizing text. Supersedes the interim DECISION REQUIRED status. Prepared reference definition preserves one-column inline data and guinda section hierarchy on page one, with the complete payment calendar and three-column signatures on page two. This keeps the reference's readable typography; it does not claim a pixel-identical page break or force twelve payment rows plus all data/signatures onto one page. Every field/block remains editable. Signature heading and explicit follow-calendar option move the group after the last calendar continuation when necessary.

Per-position signatureImages stores width/height in mm only; private signature asset and signer identity stay in the existing signer snapshot. Aspect ratio is preserved. Shared row image space grows when needed; text point size remains unchanged. Width beyond the column is a named error, not clipping. Existing definitions without options retain old dimensions, typography and pagination. Preview uses synthetic signature strokes; no real signature download.

Final local checks: renderer-only 10/10 groups PASS, including measured PDF image matrices (only selected image doubles), unchanged text font sizes, three-column baseline alignment, input immutability and 4/12/40-payment continuation order. Core --browser 24/24 PASS, including independent image controls, unchanged font input, SVG preview size, inline/color controls, persisted options, drag/resize, preview, scope isolation, grants and recovery. Build PASS, 141 modules, v305 bundle SHA256 9584338c8e3ec504e8b29a5bb6075f06fea3a2d8ca14ac82a7b099e4ae41170e. Reference synthetic PDF visually checked in memory: two pages, all 12 rows, three signatures together. One temporary synthetic PDF and a metadata-only activation plan outside the repo will be removed after release.

Planned activation: prestamo / LOAN_APPROVAL / general; new name Autorización · Préstamos · Referencia PDF. Prior version remains immutable and is the rollback target. Same template asset/margins. All other assignments, source records and financial snapshots must hash identically across the transaction. Definition SHA256 c74429a59d1cf3306694eca2fc43f30c9fd9b5de505c30d9c5cbd90ed55e28e0.

Architect review: APPROVED for the prepared candidate and already-authorized release, contingent on backend/assignment/live bundle readback. Source-of-truth SAFE; UI preservation PASS for all existing controls with owner-authorized additive presentation controls. Security PASS locally; no new grants/API/schema/Storage/Auth or legacy writer. Global image regression NOT APPLICABLE: focal designer/renderer only. Next action: complete only this H's release, preserve history, clean the two temporary artifacts and record the final receipt. Owner decision required: NO.

## Release progress / public-destination approval gate

Local code commit f8351face1a7b05927db99217e27173f97728512. Only document-layout-designer.jsx differs among 141 built frontend modules; the other 140 remain identical. Registry regenerated for file/freshness metadata, no new structural authority; check FRESH. Edge bundleOnly PASS, then document-generation v13 baseline matched all five modules and v14 ACTIVE matched all five committed modules exactly; credentials unchanged.

Loan reference version 7 activated atomically through existing persistence RPC: Autorización · Préstamos · Referencia PDF, layout 0077976e-8cdf-41fd-9226-bf198aa5e965. Same template and scope. Complete-row transaction hashes confirm records, requests, configurations, signer metadata/assets, all prior layouts and all prior activations unchanged. Prior version retained. OWNER_APPROVED_REFERENCE_LAYOUT_CHANGE identifies management execution, existing-layout creator provenance, prior version and code commit. Readback matches the entire reviewed definition. Sixteen historical records remain unchanged; no production PDF generated/reissued.

Live security PASS: ten forced-RLS private tables; anonymous command/context and browser worker/persist denied; unauthenticated Edge 401; one cron and both original final-event triggers retained.

Git push was rejected twice by automatic approval review. Read-only checks verified the same existing public remote David14081982/SutiApp-private and main, prior published commits, and twelve scoped tracked files. Additions scan found no credential-like tokens, PDF/image assets, environment file or private activation-plan inclusion. The second rejection nevertheless states that prior 'PUBLICALO HAZ COMMIT' does not explicitly authorize this public destination/egress. No alternative publication route attempted. Exact-destination approval requested from owner; frontend release remains pending that answer. This is an automatic approval gate, not a missing skill permission or untested implementation.

Interim status: BLOCKED only for public GitHub push/frontend deployment. Backend and selected reference activation complete. No claim of published v305 UI or completed Pages verification. After explicit approval: push the existing commit plus evidence, verify workflow and both domain hashes, then record final result. No further financial/data changes or historical reissue required.
