# H-LOAN-DEPOSIT-ACCOUNT-VALIDATION-AND-CONTINUE-001 — Evidence

Date: 2026-09-01
Migration: `20260901000100_loan_deposit_account_or_validation.sql`
Authority: `public.affiliate_bank_accounts` + `public.affiliates.notification_phone`

## Scope and migration

- Source, writer, constraint, UI, cache version and tests changed only for Suti Préstamo → Depósito.
- Simulator, funds, calculations, documents, summary, request writer/snapshot, `program_catalog_items`, Marketplace and Google legacy were not modified.
- Pre-apply audit: 504 accounts; 504 historical/incomplete; 6 with demonstrated Bank + valid CLABE; 498 without a valid deposit instrument.
- Forward + recovery compiled and ran in one transaction with `ROLLBACK`; persistent writes: 0.
- Apply result: `PASS`, business rows changed: 0.
- Recovery dry-run after apply and before QA activity: `PASS`, persistent writes: 0.
- Recovery real was not executed after legitimate QA audit activity.

## Productive backend matrix

`scripts/test-loan-deposit-account-or-validation-live.js` authenticated H005_TEST2 through Supabase Auth and exercised the production RPCs.

| Case | Result |
|---|---|
| Bank + valid 16-digit Card, empty CLABE | PASS |
| Bank + valid CLABE, empty Card | PASS |
| Bank only | REJECTED · `DEPOSIT_INSTRUMENT_REQUIRED` |
| Invalid Card + valid CLABE | REJECTED · `INVALID_DEPOSIT_CARD` |
| Valid Card + invalid CLABE | REJECTED · `INVALID_DEPOSIT_CLABE` |
| Immediate `list_current_deposit_accounts()` | PASS |
| New Auth session and list | PASS |
| Notification phone save/read in new session | PASS |
| Request/deposit snapshots created | 0 |
| Cleanup | PASS · 2 accounts removed by exact UUID; phone restored; audit preserved |

Security live passed: self-service read remained effective-affiliate-only; owner read allowed; cross-user read/write denied; private snapshot and anonymous access denied; fixture writes 0.

## Browser UI matrix

Chrome mounted the production `LoanScreen` in an isolated test host because the productive financial session returned `financialLegacyStore=error` for both controlled affiliates before Depósito. The isolated host used test-only in-memory doubles for the excluded simulator and banking repository; therefore it made 0 productive writes. It exercised the compiled UI at 390×844, 430×932, 768×1024 and 1280×900.

| Case | Result |
|---|---|
| A Card-only save | PASS |
| B CLABE-only save | PASS |
| C Bank-only save disabled | PASS |
| D Invalid individual field | PASS |
| E Immediate list after save | PASS |
| F Repository reload | PASS |
| G Valid selected account + 10-digit phone | PASS |
| H Incomplete phone disables Continue | PASS |
| I No valid selection disables Continue | PASS |
| J Continue opens Documents | PASS |

Browser exceptions after isolated mount: 0. Sensitive screenshots persisted: 0.

## Verification commands

```text
node scripts/build-bundle.js C:\tmp\babel-standalone-7.29.0.min.js
node --check app/bundle.js
node scripts/test-loan-deposit-account-or-validation.js
node scripts/test-loan-deposit-optional-bank.js
node scripts/test-loan-deposit-step.js
node scripts/apply-loan-deposit-account-or-validation.js
node scripts/apply-loan-deposit-account-or-validation.js --apply
node scripts/apply-loan-deposit-account-or-validation.js --recovery-dry-run
node scripts/test-loan-deposit-security-live.js
node scripts/test-loan-deposit-account-or-validation-live.js
node scripts/test-loan-deposit-account-or-validation-browser.js
node scripts/test-static-suite.js
node scripts/test-claude-ui-preservation.js
python scripts/generate-architecture-registry.py check --json
git diff --check
```

Final verification: bundle rebuilt from 95 sources; bundle and service-worker syntax `PASS`; static suite `78/78 PASS`; Claude UI preservation `PASS`; Architecture Registry `FRESH`; `git diff --check` `PASS`.

## Secret / PII preflight

- 21 changed non-derived files plus the generated Registry were reviewed.
- New secret, JWT, private-key and privileged-key candidates: 0.
- New literal email addresses: 0.
- The only long-digit literals introduced are the published CLABE checksum examples in the migration harness; dynamic QA card/CLABE/phone values are generated at runtime and no productive value is recorded.
- `supabase.env` remains ignored and untracked.

## Architect review

`APPROVED`. The review compared the owner contract, diff, migration/recovery, authorities, RLS, productive matrices, isolated browser A–J, preservation checks and legacy boundaries. `affiliate_bank_accounts` and `affiliates.notification_phone` remain the only authorities; no fallback, second writer or historical DML was introduced. `WORK_QUEUE_HISTORY.md` is absent, so no subsequent H is auto-authorized or started.

## Known limitation

The single uninterrupted productive browser path Monto → Depósito → Supabase → Documentos was not certified because the excluded upstream simulator failed before Depósito for both QA affiliates. Productive persistence and UI behavior were certified separately; no simulator workaround was shipped and no request/document data was created.
