# H-AFFILIATE-DOCUMENT-ISOLATION-001

Pre-change audit: owner authorizes isolated uploads and separation of existing shared expediente files, preserving UI, roles, versions and audit. Authority remains affiliate_documents / affiliate_files / private_assets and private-assets Storage. No financial or Google writes. Scope: focal migration/recovery, captured schema fixture, inspect/generate/test/release/verify scripts, private .tmp/document-isolation backups, evidence, appended governance and derived registry. Backend and current references must be audited before selecting constraint design. Future admin/self document and profile-photo uploads must have distinct physical objects. Existing separation preserves originals, verified bytes and legitimate request references, with private reversible mapping and actor/reason audit. No actual deletion as a production test. Isolated PostgreSQL covers permissions, independent same-content uploads, replacements, deletion and recovery; focused live verification compares unchanged unrelated authority fingerprints and shared-reference inventory. Original workspace has unrelated pending edits; release uses a clean published base. Risks: global hash uniqueness and other writers, interrupted copy/switch, old URL behavior and historic records. No business mutation until exact captured-schema tests and recoverability pass. Architecture lookup is FRESH; migration/security/source-of-truth guardians apply; legacy reference inspection READ ONLY. UI changes are unnecessary unless backend discovery proves otherwise.



Implementation plan: migration 20261105000100 adds immutable owner_affiliate_id on private_assets and a legacy-only partial hash uniqueness index. Exactly three existing upload functions change, with signatures/ACL/owners preserved. New references enforce matching affiliate and reject reuse across document units. Existing non-expediente writers use app_assets, not private_assets. Archived import scripts are not runtime writers and must follow isolation for any separately authorized future import. No frontend/Edge/Storage policy changes needed.

Scope includes scripts/affiliate-document-isolation-core.js: maintenance SQL builder used by release and isolated tests. Existing duplicates are separated by file relation or standalone document (one file relation has at most one document in live data). Audit found 37 cross-affiliate shared assets and 772 assets shared among independent document/file units, requiring 5,394 independent copies (about 1.46 GB). Every original asset/object, source provenance and request/financial attachment remains untouched. Each switch saves exact before rows privately, verifies source/copy metadata and full SHA-256, records actor/reason and fails on drift. Recovery after history is forward repair from retained originals and private snapshots; schema rollback is allowed only before isolated history.

Guardian verdicts for proposed implementation: Source of truth SAFE; migration/security PASS subject to isolated tests and preflight; legacy READ ONLY (request/history references retained); UI preservation NOT APPLICABLE to code changes, existing screen still verified live. No global role/permission change. No cache or fallback introduced.


## Verification before reference switch

- Isolated PostgreSQL: 12 focused cases PASS using captured production upload definitions, current retirement behavior, exact migration/recovery, same-content image/PDF uploads across affiliates, independent replacement versions, profile-photo history/retries, server ownership rejection, unchanged upload permissions, independent deletion and snapshot/hash/stale-record repair guards.
- Backend migration APPLIED; SHA-256 7c4558d21d6d7c92471786a137e3b0f850440c10487a0c80fcbaf751bb856cbb. Seventeen original tables preserved byte-equivalent row fingerprints (excluding only the newly added nullable owner column); global permission function definitions and ACL unchanged.
- Storage preparation PASS: 5,394 copies of independent units from 772 shared source assets, 1,456,059,952 bytes. Full SHA-256 checked on each source and each destination; no originals deleted, no local document bytes retained, zero pointers changed during copying. Initial cross-affiliate source count: 37 (31 JPEG, one PNG, five PDF); other shared sources were repeated within individual expediente/history units.
- Build PASS: same 34 public files. Frontend, service worker, Edge Functions and Storage policies unchanged. Controlled authenticated live verification follows the reference switch.
- Private plan/snapshots and copy receipts remain under ignored .tmp/document-isolation and the private database journal, never public evidence. API credentials never emitted.


## H-AFFILIATE-DOCUMENT-ISOLATION-001 RESULT

Status: PASS - backend, source publication and production UI verified.
Files changed: three existing SQL upload function bodies via one additive migration/recovery; new private audit journal and reference/owner guards; focal scripts/schema fixture/evidence; appended governance and derived architecture registry. No frontend bundle, cachebuster, Edge, Storage policy or global role change.
Source-of-truth verdict: PASS. Same canonical tables/Storage; private before snapshots are recovery evidence, never runtime fallback.
Invariant verdict: PASS. 5,394 independently owned units; zero shared units, zero cross-affiliate assets, zero ownership or copy-metadata mismatches. Exact original rows of 772 assets preserved. Metadata of 5,113 file relations and 1,916 documents preserved except the declared physical pointer/path and updated_at changes. Source provenance, status, versions, dates of creation and business affiliation remain intact.
Build: PASS, 34-file public artifact; unchanged deployed bundle SHA-256 3a2c20c4eefcdc553e6ff6fe9d8ea3b923e88e08ebcd84001fc6445190fa8ce9, version 2026110403.
Tests: PASS, 12 isolated PostgreSQL/maintenance cases; full SHA-256 on all copied objects; live existing UI confirmation/cancel/refresh, all eight affected-expediente image/PDF previews and comparison affiliate photo HTTP 200; zero page errors or production document deletions as tests.
Security: PASS. Existing three writer signatures/owners/ACL preserved, anonymous execute denied, no new role grants. Guarded affiliate ownership and per-unit exclusivity in server, immutable owned paths, private journal RLS forced/no API grants. Existing Afiliados deletion authorization unchanged.
Legacy impact: no Google or financial writer changes. Ten protected tables stayed bitwise unchanged; existing request workflows and subsequent affiliate edits were active concurrently and are reconciled separately below. No outside action was reverted.
Unexpected files changed: NONE in isolated release; root pre-existing changes retained.
Known limitations: this separates storage; it does not identify the rightful person in an uploaded photograph. A wrongly selected picture remains until the user replaces/deletes it. Legitimate request references still protect their history. Original source objects remain for immutable history/recovery, so this is not disk/Storage cleanup. Already downloaded copies are not revocable. No live second collaborator credential was configured; permission/cross-user mutation matrices run in isolated PostgreSQL. No real document was deleted as a production test.
Evidence: docs/qa/evidence/document-isolation/{database,backend-applied,repair-plan,storage-copies,repair-applied,security,backend-verified,live-production,build,concurrent-request-activity,post-switch-affiliate-activity}.json. Private records and copy manifests remain ignored.

### Concurrent production activity

The initial whole-table fingerprint comparison correctly failed because other flows were active during/after this task. Three pre-existing requests were removed through program_request_deletions and four existing requests changed status with matching program_request_admin_events timestamps. Original request-document rows reconstructed from retained deletion snapshots match the complete baseline hash and count exactly. The request table is not falsely claimed bitwise unchanged. Two affiliate rows were edited after the final isolation transaction completed at 2026-11-05 16:31:57.896966 UTC; none were updated between the plan snapshot and that completion. No affiliate/request DML or asynchronous jobs exist in the maintenance statements or their affected triggers. These separate actions were preserved, not restored or silently overwritten. Detailed aggregate proof is in the two concurrent-activity receipts.

## CLAUDE UI PRESERVATION REVIEW

PASS: no frontend change. Same header, tabs, cards, replacement/upload controls, counters, Workbench navigation, confirmation and viewers. Existing production artifact matched byte-for-byte; live eight-card expediente and refresh passed. No redesign or removed component.

## SUTIAPP ARCHITECT REVIEW

Task: H-AFFILIATE-DOCUMENT-ISOLATION-001.
Verdict: APPROVED for the explicitly authorized source/evidence publication.
Critical findings: old global hash lookup removed from all three runtime asset creators. All other runtime document/file writers only review, classify or retire existing records. Physical isolation is verified, not inferred from different database IDs. Protected concurrent activity is explicitly distinguished from this task.
Source of truth: PASS. Architecture: PASS, one authority and unchanged UI/API signatures. Security: PASS, server ownership/exclusivity and preserved permissions. Data: PASS with private before snapshots, unchanged originals and exact destination hashes. Legacy: no business-value or Google changes.
Owner decision: NO; this is the implementation explicitly requested after the explained plan. WORK_QUEUE_HISTORY.md is absent; no unrelated work-queue continuation is inferred.
Next action: publish only the isolated source/evidence delta, check the Pages workflow and unchanged production artifact, record the receipt, then stop.
Response generated for Codex: YES.

## Publication and final review

Release 41f2270867050f67aec76fabd322765982949773 published to main. [Pages workflow 42072735395](https://github.com/David14081982/SutiApp-private/actions/runs/42072735395) completed successfully, including Auth compatibility, critical request compatibility, public build/deployment and post-deployment request verification. A fresh production download returned HTTP 200 and the exact unchanged bundle SHA-256 recorded above. Receipt: docs/qa/evidence/document-isolation/deployment.json. The isolated release contains only the declared delta; original unrelated workspace changes remain untouched.

SUTIAPP ARCHITECT REVIEW: APPROVED. Objective and evidence verified; no new owner decision. Source of truth, server security, physical isolation, preserved originals/history and UI preservation PASS with the limitations explicitly stated above.

# RESPONSE TO CODEX

Close H-AFFILIATE-DOCUMENT-ISOLATION-001 after recording this publication receipt. Do not advance to another H. Stop.
