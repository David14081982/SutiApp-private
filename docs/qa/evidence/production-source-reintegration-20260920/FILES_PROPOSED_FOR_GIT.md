# FILES PROPOSED FOR GIT

Status: prepared only; nothing staged, committed or pushed.

## FILES MODIFIED

- `docs/AGENT_CHANGELOG.md`
- `docs/DATA_GOVERNANCE.md`
- `docs/DECISIONS.md`
- `docs/INVARIANTS.md`
- `docs/MIGRATION_RULES.md`
- `docs/SECURITY_RULES.md`
- `docs/SOURCE_OF_TRUTH.md`
- `docs/architecture/SUTIAPP_ARCHITECTURE_REGISTRY.json`
- `docs/architecture/registry-code.json`
- `docs/architecture/registry-data.json`
- `docs/architecture/registry-edges.json`
- `docs/architecture/registry-search.json`
- `scripts/audit-requests-workflow-google-sync-approval.js`
- `scripts/audit-requests-workflow-google-sync.js`
- `scripts/deploy-request-register-format.js`
- `scripts/deploy-requests-workflow-google-sync.js`
- `scripts/reconcile-requests-workflow-google-secret.js`
- `scripts/release-admin-banners-delete.js`
- `scripts/release-admin-request-delete.js`
- `scripts/release-request-google-reference-reconciliation.js`
- `scripts/repair-requests-workflow-snapshot-validation.js`
- `scripts/test-admin-request-bank-reference-live.js`
- `scripts/test-admin-request-delete-live.js`
- `scripts/test-admin-request-delete-modal-live.js`
- `scripts/test-request-google-reference-live.js`
- `scripts/test-requests-workflow-google-sync-closure.js`
- `scripts/test-requests-workflow-google-sync-live.js`
- `scripts/test-requests-workflow-google-sync-realtime-live.js`
- `scripts/test-requests-workflow-google-sync-security-live.js`
- `scripts/test-requests-workflow-google-sync-sql.js`
- `scripts/verify-admin-request-bank-reference-scope.js`
- `scripts/verify-admin-request-bank-reference.js`
- `scripts/verify-admin-request-delete-scope.js`
- `scripts/verify-request-delete-lock-order.js`
- `scripts/verify-request-register-format-live.js`
- `supabase/functions/financial-legacy/index.ts`

## FILES NEW

- `docs/audits/H-SUTIAPP-PRODUCTION-SOURCE-REINTEGRATION-001.md`
- `docs/plans/PENDING_FRONTEND_BENEFICIARIES.md`
- `docs/plans/TRACKING_RECONCILIATION_PLAN.md`
- `docs/qa/PRODUCTION_SOURCE_REINTEGRATION_SUPPORT.md`
- `docs/qa/evidence/guarantor-category-20260909/edge-tests.json`
- `docs/qa/evidence/production-source-reintegration-20260920/FILES_PROPOSED_FOR_GIT.md`
- `docs/qa/evidence/production-source-reintegration-20260920/build.json`
- `docs/qa/evidence/production-source-reintegration-20260920/local-verification.json`
- `docs/qa/evidence/production-source-reintegration-20260920/production-comparison.json`
- `docs/qa/evidence/production-source-reintegration-20260920/source-manifest.json`
- `scripts/disk-io-business-conflicts-targets.js`
- `scripts/savings-beneficiaries-csv.py`
- `scripts/test-disk-io-business-conflicts-http.js`
- `scripts/test-disk-io-business-conflicts.js`
- `scripts/test-guarantor-category-edge.js`
- `scripts/test-guarantor-category-writers.sql`
- `scripts/test-guarantor-category.sql`
- `scripts/test-production-source-reintegration.js`
- `scripts/test-savings-beneficiaries-csv.py`
- `scripts/test-savings-beneficiaries.sql`
- `supabase/migrations/20260907000200_disk_io_business_conflicts.sql`
- `supabase/migrations/20260909000300_guarantor_category_requirements.sql`
- `supabase/migrations/20260918120000_savings_beneficiaries.sql`
- `supabase/recovery/20260907000200_disk_io_business_conflicts_recovery.sql`
- `supabase/recovery/20260909000300_guarantor_category_requirements.sql`
- `supabase/recovery/20260918120000_savings_beneficiaries.sql`

## PRIVATE FILES EXCLUDED

- supabase.env (official workspace, SECRET_REQUIRED / GITIGNORED).
- app/supabase-config.js and .tmp build output (GENERATED / ignored).
- Entire old .tmp/beneficiaries-20260918 private backup; no CSV, signatures, inventory or raw backups copied.
- .env.cloudflare.txt (no demonstrated current consumer).

## NOT INCLUDED

- Signed beneficiary frontend and its two pending tests: see docs/plans/PENDING_FRONTEND_BENEFICIARIES.md.
- Counterpart recompute and savings identity protection: HISTORICAL_NOT_APPLIED, left in backup.
- Nine historical/pending support files excluded for explicit reasons in docs/qa/PRODUCTION_SOURCE_REINTEGRATION_SUPPORT.md.
