# H-SAVINGS-SURGICAL-REMEDIATION-001

## PRE-CHANGE AUDIT — 2026-10-02

Owner request: «hazlo de forma quirurgica», following the security/performance audit and proposed correction sequence. This authorizes the narrow repair, verification and production application once the candidate passes; no new financial/business decision is introduced.

- Objective: close direct API access to private Savings summary helpers; measure the legitimate administrative flow; remove only demonstrably redundant summary work.
- Scope: `savings_admin_current_summary(jsonb)` and `savings_panel_before_current_summary(text,text,text,integer,integer,jsonb)` ACLs; optional exact-output optimization of `get_admin_savings_workspace_summary()` only after measured equivalence.
- Files planned: this audit; new migrations/recoveries `20261002000200_savings_private_summary_acl.sql` and, only if evidence supports it, `20261002000300_savings_workspace_summary_read_work.sql`; one focal isolated test `scripts/test-savings-summary-boundary.js`; schema-only fixture `scripts/fixtures/savings-summary-boundary-20261002.json`; sanitized evidence in `docs/qa/evidence/savings-surgical-20261002/`; AGENT_CHANGELOG append; derived architecture registry partitions if ACL/dependency mapping changes; temporary collectors/backups in `.tmp/savings-surgical-20261002/`.
- Excluded: frontend, bundle, service worker, shared Auth/assets/Storage, historical migration edits, role assignments, financial writers/calculations, self-cache reactivation, Google, any business DML or incidental cleanup.
- Authority: published canonical Supabase Savings, PUBLISHED v2, remains unchanged. Google remains historical evidence. Measurements and fixture metadata are derived technical evidence only.
- Readers: three workspace RPCs, old admin panel/neighbour RPCs and self reader. Writers: existing business commands, untouched.
- Data: no personal values in committed evidence; only complete-result hashes, byte sizes, counts and timings. Runtime JSON stays in memory; no real screenshots.
- Invariants: identical authorized outputs, effective admin permission checks, actor/context separation, historical data and account identifiers preserved; no new cache/fallback.
- Risk: inadvertent nested-call denial; unintended output/permission change in optimization; concurrent live drift. Controls: owner/caller inspection, exact-definition/ACL guards, isolated role/recovery tests, actual authenticated reads before/after, serial bounded deployment.
- Recovery: exact preflight metadata/function backups; ACL recovery requires explicit acknowledgement because the original state reopens the vulnerability. No financial recovery needed.
- Tests: isolated PostgreSQL ACL/idempotence/drift/recovery; unchanged function hashes and data fingerprints; anonymous/ordinary/admin security reads; measured browser route with business writes blocked. No production test DDL, fixtures or financial operations.
- Navigator: stale deltas affect reports/evidence outside runtime; confirmed functions against live catalog and code. New migration versions verified against installed tracking.
- Status: PASS for implementation scope. Final security/performance status pending evidence.

Root cause: migration 20260918000100 replaced two private helper signatures and did not reapply their earlier REVOKEs. Live owner is postgres; legitimate callers execute as postgres and enforce user permissions before calling helpers. Restoring owner-only EXECUTE leaves their bodies untouched.

## Applied result

Migration `20261002000200_savings_private_summary_acl` is installed and tracked. It revokes API-role EXECUTE on exactly the two private helpers. All function bodies, OIDs and owners are unchanged; no default privileges, tables, policies, financial writers, frontend or bundle changed.

The production application used a bounded REPEATABLE READ transaction. Complete JSON fingerprints of panel, workspace summary/list, detail and neighbour were identical before/after. Complete row fingerprints across 16 protected tables remained identical. A fingerprint of every public function body/owner/OID and all unrelated ACLs also remained identical. Only the intended ACLs and migration tracking row changed. The archived vulnerable ACL inverse was tested only in isolated PostgreSQL and requires explicit acknowledgement; operational recovery must stay private and repair forward.

### Security evidence

| Check | Result |
|---|---|
| Anonymous direct summary | HTTP 401 / 42501, 116 bytes, no rows; formerly HTTP 200 / 399232 bytes / 354 rows |
| Anonymous direct legacy helper | HTTP 401 / 42501, 123 bytes, no rows |
| Anonymous workspace wrapper | HTTP 401 / 42501, no rows |
| Existing ordinary affiliate, authenticated SQL role/claims | Seven administrative/helper calls rejected; own Savings reader succeeds |
| Legitimate admin | Panel, summary, list, detail and neighbour JSON identical in the application transaction |
| Direct anon/authenticated/service-role calls, omitted and supplied args | 18 denials in isolated PostgreSQL |
| Drift/idempotence/recovery | 12/12 isolated checks PASS; body, owner and unexpected-ACL drift abort |

No personal financial values were retained in evidence. The real browser used the existing controlled administrator; business-write routes were blocked, no write attempt occurred and no screenshot was saved. Summary, person list, second page, detail and search passed with zero JavaScript errors on published bundle v310. The published tab label is `Personas`; the initial harness used the old descriptive label `Ahorradores` and was corrected without changing production. Other initial harness failures were parameter-order/selector issues, not application defects; final successful receipts are identified explicitly.

### Current measured transfer

| Administrative read | Decoded JSON bytes | Browser sample time |
|---|---:|---:|
| Summary | 819 | 2857 ms |
| People, first 20 | 19117 | 446 ms |
| People, next 20 | 19057 | 415 ms |
| One person, first 10 history rows | 3641 | 184 ms |
| Search result, one person | 1035 | 169 ms |

Browser evidence includes the real back-page operation and one additional one-row read used by the harness to choose a search folio internally. It is not a business mutation and is not represented as an application duplicate. Decoded JSON bytes differ from compressed network bytes and from billed project egress; no monthly bill-reduction claim is made. The blocked anonymous response now delivers an error instead of the approximately 399 KB private dataset; there is no evidence that this endpoint caused the historical monthly usage.

### Performance candidate evaluated, not installed

An isolated candidate replaced the complete old-panel call inside workspace summary with the same financial helper plus the four surviving legacy counters. The financial helper and all formulas remained unchanged. Twelve synthetic composition/security/recovery cases passed; these do not constitute live financial certification.

The candidate then ran as an anonymous PL/pgSQL block in one production REPEATABLE READ, READ ONLY transaction. No candidate function was created or replaced in production. Four alternating original/candidate pairs produced exactly equal complete JSON (819 bytes, MD5 `70b6cd0e349446eee3131029e5e7cec4`). Original mean: 2568.075 ms; candidate mean: 2509.678 ms, approximately 2.27% less. Individual samples overlap, including a slower candidate pair. The gain is too small and noisy to justify changing the reader for this surgical task. Migration 20261002000300 was not created or applied.

The published self-reader remains fresh (`cacheable=false`). Reintroducing financial cache without a complete dependency/invalidation proof is outside this minimum repair; it would not be justified by the old H05 percentage. No duplicate source of truth or persistent cache was added.

## Guardian verdicts

- Source of truth: SAFE; canonical published Savings and all writers unchanged.
- Database migration: PASS; exact-signature ACL change only, drift guards, isolated exact recovery, atomic data/output verification and actual tracking.
- Supabase security: PASS for the two reported helper exposures and tested consumers. This is not certification of every unrelated RPC in the project.
- Legacy: READ ONLY; no Google access/writes, no change to formulas, history, balances, reconciliation or lifecycle.
- UI preservation: PASS for untouched frontend plus actual published read navigation; no redesign or structural change. Global image regression NOT APPLICABLE: no shared asset/Auth/routing/repository/worker or frontend changes.

## H-SAVINGS-SURGICAL-REMEDIATION-001 RESULT

```text
Status: PASS — targeted security repair applied; authorized reads preserved
Files changed: migration/recovery, one isolated test plus schema-only fixture, this audit,
  sanitized evidence, AGENT_CHANGELOG append and derived Registry; temporary collectors
Source-of-truth verdict: SAFE — published Supabase authority unchanged
Invariant verdict: PASS — exact function bodies and protected business data unchanged
Build: NOT APPLICABLE — no frontend/runtime code or bundle change
Tests: PASS — 12 isolated boundary checks, same-transaction live JSON/data equality,
  anon and ordinary-user denials, own-reader success, published admin browser flow
Security: PASS for reported exposures; anonymous response contains no rows
Legacy impact: READ ONLY / no business or Google writes
Unexpected files changed: none; scoped hash comparison against 3393 pre-existing files PASS,
  all product sources, HTML, bundle and service worker unchanged
Known limitations: bounded performance samples, no billed-egress before/after series,
  no speculative cache or unproven performance candidate installed
Evidence: docs/qa/evidence/savings-surgical-20261002/
```

## Final independent review

SUTIAPP ARCHITECT REVIEW

```text
Task: H-SAVINGS-SURGICAL-REMEDIATION-001
Verdict: APPROVED
Critical findings: none remaining within the corrected boundary
Source of truth: SAFE
Architecture: PASS; private helper boundary restored, frontend unchanged
Security: PASS focal; actual anonymous denial and authorized reads preserved
Data: PASS; no business DML and exact transaction fingerprints
Legacy: READ ONLY; unchanged
Owner decision: NO
Next action: close this H; do not automatically start another migration or H
Response generated for Codex: YES
```

The independent reviewer reran the isolated suite (12/12 PASS), inspected both migration directions, installed metadata, live collector, result/data fingerprints and browser evidence. No blocking defect was found. `WORK_QUEUE_HISTORY.md` and `task-orchestrator` were not available; no autonomous next task is asserted. The user's direct authorization governs this completed repair.

RESPONSE TO CODEX: approve the targeted repair and communicate its limits. Retain owner-only ACLs and fresh self reads, leave the unproven performance candidate uninstalled, and do not claim a reduction in billed monthly egress.

Final Registry acceptance suite: PASS generation, freshness, stale detection, lookup, screen/table/column reverse mappings, admin permissions, test relations, fallback, incremental updates, secrets and determinism. The initial incremental attempt correctly refused unrelated inherited stale evidence; full regeneration and the complete suite passed. Scoped diff/secret checks passed; no product source changed. Temporary fixture used by the official Registry test was removed by its cleanup.


## Commit/push delivery authorization

The owner subsequently requested commit and push after resolution. Delivery is isolated on current origin/main; only this audit, the earlier diagnostic audit, their sanitized evidence, the two ACL SQL files, focal test/schema fixture, relevant changelog entries and Registry regenerated on that base are included. Unrelated dirty workspace files and all public application artifacts remain unchanged. The production ACL migration is already installed; this delivery does not reapply SQL. Validation: repeat focal boundary test and Registry checks on the isolated base; inspect exact Git diff and public-artifact hashes before pushing.
