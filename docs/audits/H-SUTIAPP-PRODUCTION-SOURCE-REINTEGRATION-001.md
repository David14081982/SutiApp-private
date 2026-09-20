# H-SUTIAPP-PRODUCTION-SOURCE-REINTEGRATION-001

## PRE-CHANGE AUDIT

Date: 2026-09-20. Status: PASS for authorized local source preparation.
Official workspace: C:/Users/david/Downloads/SutiApp.
Canonical base: origin/main 4b53d145bd4b408f232ad4660a65c94d84c6bd0e.
The old workspace remains read-only rescue material.

Objective: restore source for three already-installed backend implementations.
No migration execution, import, tracking write, commit, push, deployment or production mutation.
The preceding five-migration audit is accepted; only the three source definitions and the Edge delta
were compared again, with SELECT/read_only:true and a GET of the deployed Edge body.

Declared files: the three migration/recovery pairs below; the focal financial-legacy/index.ts delta;
eight selected historical support files and two local validation/helpers; the 23 scripts containing
the old environment-file path; appended entries in SOURCE_OF_TRUTH, INVARIANTS, SECURITY_RULES,
DATA_GOVERNANCE, MIGRATION_RULES, DECISIONS and AGENT_CHANGELOG; this report, the tracking plan,
pending-frontend inventory, support selection, sanitized evidence, and generated architecture indexes.
Ignored local build/test output may be written only in the official workspace. No app runtime source
or bundle is in scope. Registry tests will use read-only checks/determinism, not an app fixture.

Domains/authority: savings_beneficiary_versions + savings_beneficiaries remain distribution authority;
import rows preserve provenance, authorizations preserve consent; affiliates.financial_employee_category_code
and the existing document configuration determine guarantor requirements. Disk IO changes only conflict SQLSTATE.
Readers/writers: self beneficiary RPCs, existing document resolvers/writers and financial-legacy approval.
Google, calculations, identity master, Auth and existing business data remain unchanged.
Risk: accidentally replaying historical SQL, overwriting later source, or publishing the pending frontend.
Recovery for this H: revert only its local source additions/deltas; never execute a database recovery.

## Restored production source

- 20260918120000_savings_beneficiaries: seven function signatures/bodies match certified production.
- 20260909000300_guarantor_category_requirements: eleven signatures/bodies match certified production.
- 20260907000200_disk_io_business_conflicts: six bodies match exactly; four match the later guarantor
  migration. All twelve PT409 conflict changes remain. Historical forward SQL must precede Aval in an
  isolated historical replay; do not overwrite the later definitions on the live database.
- financial-legacy/index.ts: only the required_guarantor_document_codes approval gate is restored onto
  the canonical file. Subsequent unrelated content stays byte-equivalent after Git EOL normalization.

Source bytes/hashes and selected support are recorded in the source manifest.
Production definition hashes and comparison results are in production-comparison.json.
Source restoration is not certification that every historical recovery is safe on today's production.

## Boundaries and recovery

Beneficiaries recovery revokes new writes and closes signature uploads while retaining all history,
rows, files and read access; it must not re-enable the unsigned legacy writer.
Aval recovery is historical: it pins function OIDs/definition hashes and a request-history hash.
It is not a portable fresh-database rollback or a current rollback approval; later OIDs/history can block it.
Disk IO recovery pins exact function/security metadata and must refuse later Aval definitions.
All three recoveries are preserved as audited source, never executed in this H.

PENDING_FRONTEND_DELIVERY and PRIVATE_BACKUP_REQUIRED are detailed in the pending inventory.
HISTORICAL_NOT_APPLIED: 20260917000100_affiliate_eligibility_counterpart_recompute and
20260906000300_savings_identity_and_affiliate_protection remain only in the backup with their tests/recoveries.

The twelve mandatory path fixes and the eleven override-capable legacy fallbacks now use the same
portable resolution: SUTIAPP_TEST_ENV_FILE, then SUTIAPP_ENV_FILE, then repo-relative supabase.env.
No secrets are recorded. Generated app/supabase-config.js is not an authority or a tracked file.

## Verification contract

Offline: CSV identity/percentage tests; actual Edge gate with isolated transports; twelve Disk IO
SQLSTATE-only changes and reversible target pairs; syntax; environment override precedence;
source/recovery hashes; canonical Edge inverse-delta equivalence; unchanged frontend; excluded migrations;
secret scan; clean index; architecture generation/freshness; local Pages packaging.
SQL fixtures, live probes, import/deploy drivers and database replay are NOT EXECUTED.
Build output is ignored and contains only public configuration. No new global-image regression is triggered:
no shared viewer, repository, Storage policy deployment, Auth, routing or frontend source is changed.

Detailed final results and exact proposed Git file lists are in the evidence manifest and local-verification.json.
The previous audit's counts remain the baseline: 112 active beneficiaries, 101 versions, 98 pending,
210 import rows and 162 signature paths. They are not re-imported or re-audited by this H.

## H result

Status: PASS ? local source preparation; stopped for OWNER review, no commit/push/deploy.
Source-of-truth verdict: unchanged; SAFE for source-only restoration.
Invariant verdict: preserved by scoped changes; no production mutation.
Security: no secrets/private data proposed for Git.
Legacy impact: source restoration of installed gate only; no Google calls or changes.
Known limitations: tracking repair requires separate owner approval; frontend delivery remains pending;
historical database suites require an isolated database and are not run here.


## VERIFY / EVIDENCE

- Source restored: PASS, three migrations byte-identical to rescue source.
- Recovery restored: PASS, three recoveries byte-identical, not executed.
- Financial-legacy delta / later canonical changes preserved: PASS by inverse-delta equality.
- CSV parser: 5 synthetic tests PASS.
- Actual Edge approval gate: 24 isolated checks PASS.
- Environment resolver: 23 scripts, 69 override-precedence cases PASS; operational bodies preserved.
- Disk IO: 10 forward/recovery targets, exactly 12 SQLSTATE-only changes PASS.
- Syntax: 28 JavaScript scripts, 2 Python scripts, full Edge TypeScript and canonical bundle PASS.
- Build: PASS, 25-file local Pages package from unchanged canonical frontend; ignored .tmp output.
- All tracked frontend, HTML and service worker preserved; no pending beneficiary frontend copied.
- Seven governance documents retain their entire previous content and only add this task's entry.
- Secrets/private files proposed: 0. Index unchanged; no staged files.
- Architecture: regenerated derived indexes; structure/privacy and focused lookup PASS.
  Final freshness is verified after incorporating these closure artifacts.
- Production DDL/data/tracking writes, migration replay, beneficiary import, commits/push/deploy: 0.
- Global image regression and database integration suites: NOT APPLICABLE / NOT EXECUTED for this
  source-only H; no claim of a new live runtime certification.
- Unexpected files: none within the declared final allowlist.
- Evidence: source-manifest.json, production-comparison.json, build.json, local-verification.json,
  FILES_PROPOSED_FOR_GIT.md and the newly generated offline Aval edge-tests.json.
- Old workspace: preserved; still required for private backups and pending/unapplied work.

## SUTIAPP ARCHITECT REVIEW

Task: H-SUTIAPP-PRODUCTION-SOURCE-REINTEGRATION-001.
Verdict: APPROVED for local source preparation.
Review method: read-back of actual files, inverse diffs, source hashes, offline test results and
secret/allowlist checks; no second-agent execution or live behavioral validation is claimed.
Critical findings: source restoration is complete; current production already contains it.
Historical migrations/recoveries are not a fresh-database deployment plan. Aval recovery carries
historical OIDs/history guards. The beneficiary tracking collision still requires separate approval.
Source of truth: unchanged. Architecture: derived index updated, runtime/frontend unchanged.
Security: secrets/private data excluded; live permissions untouched. Data/Legacy: no writes/calls.
WORK_QUEUE_HISTORY.md is absent. WORK_QUEUE.md describes another historical master-plan gate;
this task's scope comes from the owner's explicit request, not an inferred queue continuation.
Owner decision: NO for completion of this local preparation. Future tracking repair/delivery remains separate.
Next action: present the exact proposed files and STOP for OWNER review as explicitly requested.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Accept the prepared local source reintegration after final scope/freshness checks.
Do not commit, push, deploy, replay migrations, import data, modify tracking or remove the backup.
Present the tracking plan and pending frontend inventory; wait for the owner's next instruction.
