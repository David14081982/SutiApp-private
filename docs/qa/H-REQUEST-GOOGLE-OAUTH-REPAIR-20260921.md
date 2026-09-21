# H-REQUEST-GOOGLE-OAUTH-REPAIR-20260921

## Current result — PASS / production verified

The historical BLOCKED sections below record the intermediate regression and are
superseded by this closure. No owner file/consent is now needed. Existing Google
receiver v17 provides the fixed authenticated read; Savings Edge v8 passed twice
with HTTP 200, 14,927 source rows, 44 overdue loans, read_only=true. Independent
connected Sheets reads of C:D/G/X confirmed 14,927 rows, 1,908 distinct loans and
44 overdue loans. No raw borrower data is retained in evidence.

All ten affected request jobs are synced with null errors and matching revisions.
Business and initial-payload hashes equal baseline. Caja Chica SR-2026-000316 is
confirmed in Google row 2441, PENDIENTE. No further request or Google write was used
to verify the reader. Exact deployed source readback PASS; Savings evaluator and
index are unchanged, and existing Google writers are byte-equivalent apart from
the additional fixed read action/routing. JWT/anonymous 401 preserved.

Root cause: the dedicated drive.file reader configuration had replaced the shared
OAuth variables used by the request receiver, which additionally needs
script.webapp.deploy. The initial receiver-only restoration caused the documented
direct-Sheets regression. Both operations now use the existing authenticated Apps
Script transport under GOOGLE_REQUEST_SYNC_OAUTH_*; no runtime Edge depends on
the obsolete GOOGLE_VISIBILITY_OAUTH_* names. No new OAuth client, service account,
connection, financial rule or data authority was introduced.

```text
H-REQUEST-GOOGLE-OAUTH-REPAIR-20260921 RESULT
Status: PASS
Files changed: four transport sources; scoped tests/deployment helpers; governance/evidence; derived registry
Source-of-truth verdict: PASS — same Supabase requests and Google HISTORIAL P V2
Invariant verdict: PASS — original business/payload hashes; exact Folio; same evaluator
Build: PASS — financial-legacy, request-delete, savings-settlement compiled and deployed
Tests: PASS — isolated reader security/equivalence, 9 existing bridge cases, 10/10 live deliveries,
  Savings source-status twice, independent Sheets aggregate comparison, anonymous 401
Security: PASS — original OAuth/access/grants/JWT; server-only secret; fixed read target
Legacy impact: same sources; automatic request delivery; read-only loan verification; no financial writes
Unexpected files changed: 0
Known limitations: no real withdrawal/deletion executed for testing; existing OAuth/Google availability remains required
Evidence: request-google-oauth-repair-20260921.json; private exact source backups in OS temp
```

### Final SUTIAPP ARCHITECT REVIEW — supersedes intermediate review below

Task: recover missing Caja Chica delivery and restore collateral reader availability.
Verdict: APPROVED
Critical findings: former reader regression resolved and independently checked;
existing bridge/authority retained, business evaluators/writers unchanged.
Source of truth: PASS. Architecture: fixed read through same receiver, no fallback.
Security: PASS. Data: unchanged hashes; 14,927 rows / 44 overdue agree with Sheets.
Legacy: no financial test operations, formulas or triggers changed.
Owner decision: NO. Next action: stop this H; no additional stage is authorized.
Response generated for Codex: YES.

Final RESPONSE TO CODEX: accept the verified repair; preserve the current receiver
credential names and fixed read contract. Do not reintroduce direct-reader fallback
or overwrite receiver OAuth with a reader-only client. No additional H.

## Authorized continuation — restore both consumers without another credential

Owner explicitly instructs Codex to resolve the regression autonomously. Existing
Apps Script already has owner-authorized SpreadsheetApp access to this workbook.
Use that same authenticated receiver for a new fixed READ-ONLY loan-status action;
do not create a connection, OAuth client, alternate authority or fallback.
Scope addition before edits: google-apps-script/financial-handoff/Code.gs and README;
supabase/functions/savings-settlement/loan-status.js; isolated reader/receiver tests;
guarded deployment helper; this evidence, changelog, SOURCE_OF_TRUTH/LEGACY docs
SECURITY_RULES.md and derived architecture registry. Savings index, financial evaluators, SQL, RLS,
formulas, triggers, balances and business writers remain unchanged.
Read boundary: same workbook and sheetId 1245291756, exact A:D/G/X display values,
all source rows; same header, exact Folio and status validation. Receiver refuses
caller-selected workbook/ranges and invalid shared secret before opening Sheets.
OAuth uses the existing isolated receiver credentials, same endpoint and secret.
Backup live Apps Script v16/head/deployment and Savings Edge before changes; compile
and read back exact source. Compare live read to the connected Sheets oracle, then
service-only source-status and anonymous denial. No financial test transactions.
Recovery: restore captured receiver version and Edge sources; this restores prior
code but cannot itself repair unavailable direct-reader credentials. Keep working
forward until both services pass; do not claim the prior OAuth blocker is solved
before live verification. The transport change supersedes the earlier proposed
requirement for a dedicated-client JSON, not the Google authority or financial rules.

## PRE-CHANGE AUDIT

Owner explicitly authorized repair and use of C:/Users/david/.clasprc.json.
Scope: existing Google connection's three GOOGLE_VISIBILITY_OAUTH_* Supabase
secrets; existing automatic request outbox delivery; read-only verification.
Evidence files: this report and request-google-oauth-repair-20260921.json.
No source, schema, financial calculation, business status, shared secret,
receiver deployment or endpoint change is authorized/needed by this repair.
Supabase program_requests remains authority; Google is its existing projection.
Navigator stale changes concern savings/docs, not this transport implementation.

Verified before repair: local owner credential obtains exactly drive.file and
script.webapp.deploy scopes; existing receiver returns JSON UNAUTHORIZED to an
intentionally invalid shared secret (zero sheet writes). All three deployed
OAuth secret digests differ; their updated_at is 2026-09-21T08:16:12.980Z.
The original failing job is SR-2026-000316, REQUEST_SYNC_GOOGLE_AUTH_FAILED.

Risk: credentials shared with existing Google readers. Validate automatic delivery,
unique Sheet folios, immutable initial payloads and unchanged business fields.
Recovery: Management API exposes secret hashes, not recoverable prior plaintext;
the rejected old credential cannot be reconstructed. If replacement fails, stop
further changes and restore access via existing owner OAuth authorization flow.
Do not write business rows manually or recreate requests. Existing retry/lease
and idempotency controls govern delivery. No migration or frontend build applies.

Status: repair pending verification.

## Scope correction before source changes

The prior Savings OAuth repair installed a dedicated drive.file-only client into
the same shared names (see H-SAVINGS-P0-WITHDRAWAL-SETTLEMENT-001). The request
receiver asks for script.webapp.deploy too. Restoring clasp credentials fixes the
receiver but regresses direct Sheets reads (SERVICE_DISABLED, project 1072944905499).
Do not close PASS until Savings is restored. Owner was informed immediately.

Necessary minimal prevention: isolate request receiver OAuth into
GOOGLE_REQUEST_SYNC_OAUTH_* in financial-legacy/request-google-sync.js and
request-delete/index.ts. No fallback to shared reader credentials. Same receiver,
secret, data, authorization, leases and contracts. Add focused isolated coverage
and deployment evidence. Preserve current remote Edge bundles before deployment.
Reader reauthorization requires the existing dedicated OAuth client whose helper
deleted its local JSON; request for its location is pending. No fabricated recovery.
Additional scoped files: scripts/test-request-google-oauth-isolation.js,
scripts/repair-request-google-oauth.js (guarded backup/compile/deploy),
docs/AGENT_CHANGELOG.md, derived architecture registry if these dependencies change.
Existing retry RPC was used once for the ten baseline IDs; no manual Sheet writer.

## Verified implementation

financial-legacy v48 and request-delete v6 deployed and exact source readback passed.
Only three secret-name references in each receiver consumer changed. Existing JWT,
receiver endpoint, shared authentication secret, request business logic and Google
script version 16 preserved. Dedicated GOOGLE_REQUEST_SYNC_OAUTH_* configured from
the owner-authorized credential. Baseline bundles and sources are retained under
the OS temporary directory sutiapp-request-oauth-20260921, without OAuth plaintext.
Candidate server compilation and isolated credential-routing/failure test PASS.
Rollback code is the captured baseline; never restore the shared credential coupling
after reader OAuth is repaired. Prefer forward correction with the isolated names.

Live read: SR-2026-000316 is Historial de solicitudes!A2441, Caja Chica,
Y=PENDIENTE, date 21/09/2026. Supabase phase synced, revision=synced_revision=1.
All baseline business hashes and immutable payload hashes remain unchanged.
Temporary HANDOFF_BUSY/timeouts recovered through existing leases/retry RPC/cron.
Second explicit retry targeted only 315/319/323 after Sheets already held their rows.
No manual row creation, no approval, no new request and no deletion performed.

Sheets changed A2442/A2443 to legacy numeric IDs 2652/2653 after acknowledgment
of approved requests 317/318. This later Google behavior was observed, not modified
or reversed; do not claim all ten still have SR folios in Google column A.

## Historical regression / BLOCKED — resolved by current result above

Restoring the original receiver credential into the shared GOOGLE_VISIBILITY_*
names regressed the deployed savings-settlement direct Sheets reader. Token refresh
succeeds, but Google Sheets API returns SERVICE_DISABLED for project 1072944905499.
Using the existing dedicated project as quota project produced 404, not a valid read.
The owner was told explicitly. Do not claim Savings PASS or overall PASS.
The dedicated OAuth client for project expanded-talon-506522-r7 must be reauthorized
with its existing drive.file + workbook Picker consent. Its previous helper deleted
the local JSON and did not persist its refresh token locally. Prior deployed secret
values are unrecoverable from Management API hashes. Owner was asked for client
JSON location; no additional credential files were probed.

Architecture registry incremental refused unrelated pre-existing stale entries.
Routes, tables, RPCs, authority and dependency edges are unchanged; only environment
credential names changed. No unrelated full registry regeneration performed.
No UI or shared frontend change: frontend build/global image regression NOT APPLICABLE.
WORK_QUEUE_HISTORY.md absent; existing WORK_QUEUE is a historical milestone.
This repair is authorized directly by the owner, not an advance to another H.

## Final verification

All ten baseline jobs reached synced, error_code null, revision=synced_revision.
All business and initial-payload hashes equal baseline. Anonymous HTTP 401 on both
deployed Edges. No code, schema, approval or financial calculation changed beyond
the two credential lookups. Supporting JSON contains before/after proof and versions.

```text
H-REQUEST-GOOGLE-OAUTH-REPAIR-20260921 RESULT
Status: BLOCKED — original request delivery recovered; Savings regression unresolved
Files changed: two Edge credential lookups; two focused scripts; report, JSON and changelog
Source-of-truth verdict: PASS — Supabase requests / existing Google projection
Invariant verdict: PASS for original requests; shared reader availability FAIL
Build: PASS — both server bundles compiled; frontend NOT APPLICABLE
Tests: PASS — isolated credential selection, exact deployed source, 10/10 delivery, hashes
Security: PASS — secrets server-only, JWT retained, anonymous 401
Legacy impact: existing request delivery only; Savings direct reading unavailable
Unexpected files changed: 0; earlier test artifact line endings restored
Known limitations: dedicated reader OAuth restoration requires unavailable client JSON/consent
Evidence: request-google-oauth-repair-20260921.json and this report
```

## SUTIAPP ARCHITECT REVIEW

Task: Repair missing Caja Chica Google delivery without collateral regressions.
Verdict: BLOCKED
Critical findings: Delivery objective verified, but initial shared credential update
regressed deployed Savings reader. Credential isolation prevents recurrence but does
not itself restore the missing dedicated reader authorization.
Source of truth: unchanged. Architecture: same receivers/readers, separated credentials.
Security: no exposed secrets or relaxed JWT. Data: original hashes unchanged.
Legacy: no financial writes; reader availability unresolved.
Owner decision: NO new business decision. Missing existing OAuth client is required input.
Next action: restore the existing dedicated Google reader OAuth via verified consent,
then verify savings-settlement/source-status and receiver delivery concurrently.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Do not close this H as PASS. Obtain the existing dedicated client location/consent,
restore only GOOGLE_VISIBILITY_OAUTH_* using the existing Picker authorization flow,
retain GOOGLE_REQUEST_SYNC_OAUTH_* unchanged. Verify live Savings source-status HTTP
200/PASS and receiver authorization, preserve all financial/request data, update
the evidence and reviewer verdict. Do not advance to another H.
