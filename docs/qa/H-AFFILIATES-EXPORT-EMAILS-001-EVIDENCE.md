# H-AFFILIATES-EXPORT-EMAILS-001 — Evidence

Status: `PASS`

## Scope and authority

- Surface: Admin → Afiliados → `Exportar Excel`.
- Historical email authority: `public.affiliates.historical_email_raw`.
- Access email authority: the exact `public.affiliates.auth_user_id → auth.users.id → auth.users.email` link.
- Export remains a temporary, `no-store`, allowlisted projection behind `data_exports.read`; `data_export_audit_log` stores metadata only.
- No screen, repository, bundle, schema, migration, RLS, Storage, Google or financial code was changed.

## Implementation

- Edge `data-exports` version 11 adds two distinct XLSX/CSV headers for the reserved `affiliates` domain: `Correo histórico` and `Correo de acceso`.
- `historical_email_raw` is exported verbatim. The access email is resolved server-side by exact linked Auth UUID; no name/email matching or identity reassignment exists.
- A missing `auth_user_id` produces an empty access-email cell. A non-null link that cannot be resolved fails closed with `AUTH_EMAIL_LOOKUP_FAILED`.
- `auth_user_id` is used only inside the privileged Edge lookup, removed from projected rows and absent from the audited/output column set.

## Verification

1. `node scripts/test-data-exports.js` → `DATA EXPORTS CONTRACT: PASS`.
2. `python -m py_compile scripts/deploy-data-exports-edge.py scripts/test-affiliates-export-emails-live.py` → `PASS`.
3. `python scripts/deploy-data-exports-edge.py` → server-side bundle-only compile `PASS`; production version remained 10.
4. `python scripts/deploy-data-exports-edge.py --apply` → `PASS`, `data-exports` production version 11, JWT verification preserved.
5. `python scripts/test-affiliates-export-emails-live.py --allow-admin-magic-link` → `PASS`:
   - 954 exported affiliate rows;
   - one and only one `Correo histórico` column;
   - one and only one `Correo de acceso` column;
   - real same-email, different-email and no-Auth rows validated against the two authorities;
   - no-Auth access cell empty;
   - valid XLSX ZIP/workbook/worksheet parsed successfully in memory;
   - anonymous export denied;
   - `auth_user_id` absent from workbook and audit column set;
   - affiliate/Auth identity hashes identical before and after;
   - exactly one expected `data_export_audit_log` row added;
   - controlled QA magic-link session revoked immediately after download; no email, linkage or identity field changed.
6. The broader `scripts/test-admin-affiliates.js` reaches and passes all Afiliados/UI/export assertions (lines 30–79), then fails at its pre-existing, unrelated Finanzas assertion on line 80 (`const belongsToAffiliate=`). Neither Finanzas nor that test was modified by this H; classification: `NOT APPLICABLE / PRE-EXISTING OUT-OF-SCOPE`.
7. `git diff --check` on the declared scope → `PASS`.

## Required closure

- Source-of-truth verdict: `PASS` — two authorities remain separate and read-only.
- Invariant verdict: `PASS` — INV-005, INV-006, INV-118, INV-119 and INV-209 preserved.
- Security: `PASS` — JWT/origin/`data_exports.read` boundary unchanged; service credential remains server-side; UUID not exported.
- Legacy impact: `NOT APPLICABLE` — no Google, Ahorro or Préstamos access.
- UI preservation: `PASS` — no frontend file changed; the existing button, label and interaction remain intact.
- Unexpected files changed: `0` within this H; unrelated pre-existing worktree changes were preserved and excluded.
- Global suites: `NOT RUN` by explicit owner instruction and because no shared UI/runtime asset changed.
- Master data writes: `0`.
- Auth email/link/identity writes: `0`.
- Expected operational writes: one export-audit metadata row; one temporary QA Auth session created and revoked.

## Known limitations

- The locally configured H005 test password was stale. The focal test used Supabase Admin `generate_link` for the already-existing controlled administrator, did not send email, and revoked the resulting session after the single export.
- A second normal-user credential was unavailable locally; the unchanged permission boundary is covered by the static contract and the production anonymous denial, while the earlier live export authorization matrix remains historical evidence.
