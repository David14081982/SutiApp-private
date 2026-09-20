# Selected support for production source reintegration

These files preserve tests and source provenance; their presence does not authorize production execution.

| Historical support | Selection | Reason |
| --- | --- | --- |
| savings-beneficiaries-csv.py | RESTORED | Deterministic parser; command uses an explicit private CSV or repo-private source.csv. |
| test-savings-beneficiaries-csv.py | RESTORED / OFFLINE | Five synthetic identity, percentage and CSV cases. |
| test-savings-beneficiaries.sql | RESTORED / NOT RUN | Backend, signature, history and isolation contracts; needs isolated seeded DB and outer ROLLBACK. |
| savings-beneficiaries-tool.js | EXCLUDED_HISTORICAL_RUNNER | Combined import/apply/upload/build/deploy-era workflow; production import is already complete. |
| test-savings-beneficiaries-repository.js | PENDING_FRONTEND_DELIVERY | Requires the unpublished signed repository. Preserved in backup. |
| test-savings-beneficiaries-browser.js | PENDING_FRONTEND_DELIVERY | Requires the unpublished frontend. Preserved in backup. |
| test-guarantor-category-edge.js | RESTORED / OFFLINE | Executes actual approval gate with isolated transport fixtures. |
| test-guarantor-category.sql | RESTORED / NOT RUN | Category/scope/privacy matrix; requires isolated seeded DB, actor setting and outer ROLLBACK. |
| test-guarantor-category-writers.sql | RESTORED / NOT RUN | Historical idempotency contract; requires isolated representative history and outer ROLLBACK. |
| prepare-guarantor-category.py | EXCLUDED_HISTORICAL_GENERATOR | Recreates already-certified SQL from a private pre-change snapshot; could overwrite restored recoveries. |
| release-guarantor-category.js | EXCLUDED_HISTORICAL_DEPLOYER | Pinned historical deployment/snapshot assumptions; deployed Edge is already newer. |
| test-guarantor-category.py | EXCLUDED_HISTORICAL_APPLY_RUNNER | Includes apply, remote writes and recovery rewriting against private snapshots. SQL suites retained separately. |
| test-guarantor-category-browser.js | EXCLUDED_HISTORICAL_HARNESS | Depends on an external unversioned browser-fixtures.json and historical local service. No frontend change in this H. |
| test-disk-io-business-conflicts.js | RESTORED / ISOLATED ONLY | Paired before/after SQL equivalence using synthetic fixtures. |
| test-disk-io-business-conflicts-http.js | RESTORED / ISOLATED ONLY | PostgREST retries, conflict semantics, concurrency and recovery. |
| apply-disk-io-business-conflicts.js | EXCLUDED_HISTORICAL_DEPLOYER | Requires exact pre-Aval hashes and historical evidence paths; unsafe basis for a new production apply. |
| test-disk-io-business-conflicts-live.js | EXCLUDED_HISTORICAL_PROBE | Depends on that deployer and requires old exact hashes; invokes business functions and temporary DDL. |

The Disk IO target definitions now derive directly from restored forward/recovery SQL using
scripts/disk-io-business-conflicts-targets.js, avoiding a missing targets.json or an extra source of truth.
No historical PASS report is copied as a current test result.

## Reusable offline checks

- python -B scripts/test-savings-beneficiaries-csv.py
- node scripts/test-guarantor-category-edge.js
- node scripts/test-production-source-reintegration.js

The Edge test writes its own newly generated, synthetic result under docs/qa/evidence/guarantor-category-20260909.
The CSV CLI still pins the certified input hash and certified counts; do not run its import-plan mode in this H.

## Isolated database prerequisites (not provisioned/run by this H)

The two Disk IO integration suites require a disposable historical schema compatible with their
2026-09-07 before-definitions at 127.0.0.1:55471, database h01, user postgres, no production tunnel,
synthetic-only fixtures, local PostgreSQL and the pg Node module (H01_PG_MODULE or normal module resolution).
The HTTP suite additionally needs PostgREST (H01_POSTGREST_EXE or postgrest on PATH), the local database
log at H01_TEST_DIR/postgres.log, and the authenticator/anon roles. H01_TEST_DIR defaults to repo .tmp/disk-io-h01.
Initialize only a disposable synthetic environment before using --seed. Do not aim these suites at current production.
The restored tests are not a full fresh-database bootstrap. SQL fixtures for savings/Aval require their
documented existing domain catalogs and representative isolated identity/history.

## Recovery limitations

Restored SQL is byte-identical to the backup. The Aval recovery contains historical OIDs and a history hash;
Disk IO forward/recovery guards refer to their exact historical definitions. These are preserved intentionally,
not regenerated against live production. Today's rollback requires its own audit and owner authorization.
