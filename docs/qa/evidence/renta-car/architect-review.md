# ARCHITECT REVIEW

Task reviewed: H-RENTA-CAR-CASH-001, 2026-10-22.
Verdict: BLOCKED ? explicit production authorization required by automatic approval review.

What Codex did correctly: isolated Renta Car in its own UI/RPCs; preserved existing documents/signature components; used server-derived identity/tariff; froze request values; prevented inclusive overlap through PostgreSQL exclusion at approval; retained pending availability and cancellation release; mapped G/Plazo to the one payment and J to original submission. Kept applicant signature out of captured PDF inputs. Prepared a dedicated document type without assigning the existing loan template. Preserved 7 existing PDF outputs byte-for-byte and 15 non-rental register outputs against captured deployed code.

Important findings: captured production counts were 430 requests and zero Supabase rental requests. Authenticated/anon have no direct table writes. Original Supabase definitions are guarded by md5 and copied into private recovery metadata. The same migration compiled in a live rollback-only preflight; no business rows were created. Both Edge bundleOnly compilations preserved active versions (document-generation 19, financial-legacy 62). The isolated release is based on main bb0846df77a697663c4c7cba2e1a7ae56fb20b75; unrelated workspace changes were excluded. Its 158-module build and 31-file Pages package passed. The root's different 155-module bundle is not the publication candidate.

Problems detected: permanent apply was rejected before execution by automatic review because it requires explicit authorization for the exact production schema/RLS migration and exclusive lock. No migration, Edge deployment or frontend publication occurred. Raw localhost could not preview documents because existing CORS rejects local origins; the final local build test served static code on the allowed origin while preserving real backend/auth/assets and validating its hash and execution before/after refresh. Global production and local-build regressions passed. General workspace diff whitespace failures belong to preexisting admin_assisted_context.sql; isolated scoped diff check passes.

Architecture implications: new RentaCarRepository/Flow/Summary, 5 authenticated RPCs, immutable interval columns, exclusion constraint, dedicated document type. The shared financial projection and document renderer take a rental-only branch. No change to auth, shared document access, Storage, business permission catalog, or service-worker logic. The release cache version alone advances to 2026102201.

Source-of-truth implications: catalog owns price; affiliates owns identity until immutable capture; program_requests owns requests/reservations; document configuration owns the future template; Google is a projection limited to A:AG. No browser persistence or mock production authority.

Security implications: RLS and RPC guards, admin permission/module boundary, no-affiliate and cross-affiliate denial, authoritative price, doc gate, immutable request, and non-destructive recovery verified in isolated SQL. Management credentials remain in ignored supabase.env. No secrets in tracked candidate/evidence. Tests do not authorize production fixtures.

Data implications: E=Renta Car, F=0, G=1, H=0, I=day count ? daily price, J=created_at. Payment deadline is rental start and recorded in snapshot/observation Z. No formula, historical row, Apps Script or additional payment-count-column changes. Completed legacy reservations are not migrated.

Owner decision required: no business ambiguity remains. Explicit approval is required only to install migration 20261022000100, deploy the two compiled rental patches, and publish the isolated frontend. Actual contract text/template remains intentionally pending per the owner's instruction; no fabricated legal clauses are required for this scope.

Recommended next action: after explicit authorization, revalidate schema/remote function hashes and main head; execute `.tmp/renta-car/apply.py`, deploy exact candidates via `.tmp/renta-car/edge-release.js deploy`, publish only `.tmp/renta-car/release`, verify the installed APIs and production UI/global assets without creating a production request. Preserve rollback/backup artifacts. Never rerun a rejected production action via an alternative transport.

Evidence: sql-isolated.json (18), surfaces.json, release-parity.json, supabase-preflight.json, document-generation-compile.json, financial-legacy-compile.json, global-isolated-build.json, global-production-before.json, prepared-release.json, screenshots and synthetic PDFs in this folder. Shared document tests: 20 passed. WORK_QUEUE_HISTORY.md is absent; this review does not authorize advancing that queue.

CLAUDE UI PRESERVATION REVIEW

Screen: Renta Car catalog/detail, request documents/review, Finance and history.
Original sections: vehicle gallery/detail/favorites/back, document progress/cards/view/replace, signing and submit, Finance queue/detail/actions, history tracking.
Current sections: preserved; rental-only calendar, cash summary and explicit pending contract added.
Missing sections: none found in scoped review; actual contract text is intentionally pending by owner decision.
Added sections: continuous calendar, dates/day count/tariff/total/deadline, applicant values, pending contract notice, rent approval/cancellation actions and dedicated document scope.
Interactions preserved: existing document component and real signature pad exercised; shared images/gallery/fullscreen/SW/refresh passed global tests.
Navigation preserved: documents then summary then normal success/history.
Visual structure preserved: PASS for scoped change; synthetic calendar/summary/PDF inspected visually.
Unauthorized redesign: NO.
Verdict: PASS for prepared UI; production release remains BLOCKED.


## Publication authorized; backend installed — 2026-10-22

The preceding BLOCKED/prepared-release records are historical. The owner's explicit publication instruction resolved the approval requirement. Migration 20261022000100 is installed; before/after fingerprints of all 431 business requests are identical. No business rows were added. document-generation v20 and financial-legacy v63 are deployed and their active source hashes match the reviewed candidates; secrets and verify_jwt are unchanged. Evidence: migration-applied.json and the two *-deploy.json files. Frontend commit/push and live verification are the remaining publication steps. The actual rental contract remains pending by explicit owner decision.
