# H04 security matrix

Each JSON retains every named allow/deny result. The fixture labels are normalized after the existing classification trigger, only for newly inserted rollback fixtures. No fixture is committed.

| Profile | Before/candidate cases | Deployed cases | Result | Evidence |
|---|---:|---:|---|---|
| owner | 16 | 16 | IDENTICAL | [before/candidate](matrix-owner.json), [live](matrix-live-owner.json) |
| other | 16 | 16 | IDENTICAL | [before/candidate](matrix-other.json), [live](matrix-live-other.json) |
| principal | 16 | 16 | IDENTICAL | [before/candidate](matrix-principal.json), [live](matrix-live-principal.json) |
| unauthorized_admin | 16 | 16 | IDENTICAL | [before/candidate](matrix-unauthorized_admin.json), [live](matrix-live-unauthorized_admin.json) |
| assets_admin | 16 | 16 | IDENTICAL | [before/candidate](matrix-assets_admin.json), [live](matrix-live-assets_admin.json) |
| documents_admin | 16 | 16 | IDENTICAL | [before/candidate](matrix-documents_admin.json), [live](matrix-live-documents_admin.json) |
| program_admin | 16 | 16 | IDENTICAL | [before/candidate](matrix-program_admin.json), [live](matrix-live-program_admin.json) |
| impersonation | 16 | 16 | IDENTICAL | [before/candidate](matrix-impersonation.json), [live](matrix-live-impersonation.json) |
| impersonation_expired | 16 | 16 | IDENTICAL | [before/candidate](matrix-impersonation_expired.json), [live](matrix-live-impersonation_expired.json) |
| impersonation_revoked | 16 | 16 | IDENTICAL | [before/candidate](matrix-impersonation_revoked.json), [live](matrix-live-impersonation_revoked.json) |
| impersonation_wrong_session | 16 | 16 | IDENTICAL | [before/candidate](matrix-impersonation_wrong_session.json), [live](matrix-live-impersonation_wrong_session.json) |
| anon | 16 | 16 | IDENTICAL | [before/candidate](matrix-anon.json), [live](matrix-live-anon.json) |

Total: 192 before/candidate comparisons and 192 deployed comparisons. No changed authorization result.
