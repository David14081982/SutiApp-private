# H-AFFILIATES-CSV-UPDATE-APPLY-001 — Evidence

Status: `PASS / APPLIED / VERIFIED`

## Scope and authority

- Input: local `Usuarios (8).csv`, exactly 947 rows, SHA-256 `3AB97E9F16951E523301E1A080A1DB965F12739207798490022308FCF1F28E29`.
- Matching field: CSV column A `Número de control` to `public.affiliates.numero_control`, as text. Name was not read for matching and email was not used to select identity.
- Target: only `historical_email_raw`, `historical_email_normalized` and the existing derived eligibility pair on the one safe, unlinked affiliate.
- Preserved: `auth_user_id`, every ambiguous/Auth-linked row, 7 CSV-only controls, 3 historical Supabase rows omitted by the CSV, 7 QA fixtures, all other affiliate fields and all Auth rows.
- Authority verdict: `public.affiliates` remains the only product roster authority. The hash-pinned CSV was a one-time owner-authorized update input; batch/snapshot tables are evidence and recovery only.

## Guarded operation

- Migration: `supabase/migrations/20260904000200_affiliate_csv_email_update_batch.sql`.
- Recovery: `supabase/recovery/20260904000200_affiliate_csv_email_update_batch_recovery.sql` plus the service-only `recover_affiliate_csv_email_update(uuid)` data recovery RPC.
- Batch: `9975324a-2fcc-510f-94d7-3b47e4f47977`.
- The RPC pins source hash, filename, 947 input rows, 954 Supabase rows and every classification count. It locks `affiliates`, snapshots all 121 resolved mismatches before the update, writes only `UPDATED_EMAIL`, and compares the full Auth-to-affiliate mapping before and after.
- Both audit tables force RLS. Browser roles have no write grant; execution/recovery are service-role only. A real Admin actor was not fabricated.

## Exact result

| Classification | Count |
|---|---:|
| `UPDATED_EMAILS` | 1 |
| `NEEDS_AUTH_SYNC` | 8 |
| `SKIPPED_AMBIGUOUS` | 145 |
| — ambiguous control | 33 |
| — ambiguous email | 112 |
| `CSV_ONLY` | 7 |
| `UNCHANGED` | 786 |
| Supabase extras preserved | 10 |
| QA fixtures preserved | 7 |
| `AUTH_IDENTITY_MISMATCH_CREATED` | 0 |

The exact 947-row result is stored outside the repository at `C:\Users\david\Downloads\H-AFFILIATES-CSV-UPDATE-APPLY-001-RESULT.csv`, SHA-256 `12ADD5D7A48970831ABE99BCF0A5A49A872D289D292B50C56D4F074453F53344`. It contains no passwords, tokens or secrets.

## Verification evidence

1. `python scripts/apply-affiliate-csv-email-update.py --dry-run`
   - `PASS`; forward migration, one-row update, data recovery and schema recovery compiled/executed inside a transaction ending in `ROLLBACK`; `writes_persisted=0`.
2. `python scripts/apply-affiliate-csv-email-update.py --apply`
   - `APPLIED`; one update; exact aggregate result above; 79 Auth resolvers verified; automatic rollback remained armed.
3. `node scripts/test-affiliate-csv-email-update.js`
   - `PASS`; source/field allowlists, snapshot, collision/Auth skips, immutable `auth_user_id`, RLS/service boundary and recovery contract.
4. `python scripts/apply-affiliate-csv-email-update.py --status`
   - `APPLIED`; source rows 947; snapshot rows 121 = 1 updated + 8 Auth sync + 112 ambiguous email.
5. Result artifact read-back
   - 947 rows = 1 updated + 8 Auth sync + 145 ambiguous + 7 CSV-only + 786 unchanged; zero `auth_user_id_unchanged=false`.

The resolver probe executed `get_effective_affiliate_id()` and `get_current_affiliate_access_state()` under each of the 79 existing linked Auth principals both before and after the batch. Every active principal resolved to the same affiliate UUID; archived principals remained fail-closed. No credential, password or Auth record was changed.

A final read-only check observed one legitimate `AFFILIATE_CLAIMED` event after the batch: control `13301` linked at `2026-09-04 19:03:53Z`, while the batch snapshot was captured at `18:42:32Z`. That row had been skipped as `SKIPPED_AMBIGUOUS_EMAIL` and its historical email was not changed by this H. The current linked total became 80; all 80 resolver probes pass and identity mismatches remain zero. This later activation is not counted as a batch write and the row now also requires explicit Auth-aware review before any future CSV email synchronization.

## Closure

```text
H-AFFILIATES-CSV-UPDATE-APPLY-001 RESULT
Status: PASS / APPLIED / VERIFIED
Files changed: guarded migration/recovery; apply and focal test scripts; ADR/source/invariant/evidence records
Source-of-truth verdict: PASS — public.affiliates remains authoritative; CSV was a one-time hash-pinned input
Invariant verdict: PASS — numero_control-only matching; ambiguous/Auth-linked rows skipped; auth_user_id unchanged
Build: NOT APPLICABLE — no frontend/runtime artifact changed
Tests: PASS — focal dry-run, static contract, production read-back and 79 identity resolver probes
Security: PASS — service-only writer/recovery; audit RLS forced; no secret persisted
Legacy impact: NOT APPLICABLE — no Google, Ahorro, Préstamos, formulas, triggers or financial data touched
Unexpected files changed: NONE in H scope; pre-existing owner worktree changes preserved and excluded
Known limitations: 8 rows require an explicit future Auth synchronization decision; 145 ambiguous rows and 7 CSV-only rows remain intentionally untouched
Evidence: batch 9975324a-2fcc-510f-94d7-3b47e4f47977; local result SHA-256 12ADD5D7A48970831ABE99BCF0A5A49A872D289D292B50C56D4F074453F53344
```
