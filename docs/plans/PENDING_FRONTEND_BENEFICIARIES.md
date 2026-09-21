# PENDING_FRONTEND_DELIVERY — Beneficiarios

Status: focal source delta implemented and verified by H-SAVINGS-BENEFICIARIES-FRONTEND-DELIVERY-001.
The preservation inventory below records the historical candidate; the current delivery rebuilds
from canonical sources. See docs/audits/H-SAVINGS-BENEFICIARIES-FRONTEND-DELIVERY-001.md.

Candidate base: 50252bbe021cd1c61e1a904ecb5f411788e46df3. Rebase the focal patch onto the then-current canonical source; never replace full current files.

Backup-relative patch: .tmp/beneficiaries-20260918/frontend.patch
SHA-256: be13de06b393e56111d5d756606d0b4764a6e3353bd8b8f84eaf787792cd71c2

| Pending file | Candidate source SHA-256 | Delta |
| --- | --- | --- |
| app/savings-repository.js | be7b13ce4c030677d8b1c42426f0a1ea83be4f8675b07a111ff88ad9f51ab8d1 | Independent self beneficiary read; prepare/upload/commit signed flow; identity/version/hash/idempotency guards; private signature URL. |
| app/savings-request-form.jsx | ae7f94a942863474a43f2cd5a11dbf79960404912bb2fc3b0e3019775d1437d4 | Optional relationship; total <=100; add/edit/remove including empty; SignaturePad, consent, invalidation after edits and same-key retry. |
| app/screens-savings.jsx | c641b1ae4fdad65f524ea733e2875840c90ecca9abadaf8bee506178adcca577 | Independent beneficiary loading/error/pending states, signature preview and context refresh; preserve existing cards and sheets. |

Exact patch hunk coordinates:

- @@ -145,9 +145,55 @@
- @@ -36,13 +36,54 @@
- @@ -44,18 +44,19 @@
- @@ -79,8 +80,15 @@

Pending tests: scripts/test-savings-beneficiaries-repository.js and scripts/test-savings-beneficiaries-browser.js remain in the backup. Candidate bundle/HTML are generated, not source authority.

PRIVATE_BACKUP_REQUIRED: .tmp/beneficiaries-20260918/source.csv, signatures/ (162 files), signatures.json, import-plan.json, import.sql, inventory.json and before/. No private contents copied or moved.

HISTORICAL_NOT_APPLIED: migrations/recoveries for 20260917000100_affiliate_eligibility_counterpart_recompute and 20260906000300_savings_identity_and_affiliate_protection, plus their tests, remain only in the backup.
