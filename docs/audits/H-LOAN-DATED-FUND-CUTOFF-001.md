# H-LOAN-DATED-FUND-CUTOFF-001

## PRE-CHANGE AUDIT

- Objective: hide dated funds starting one calendar month before maturity,
  inclusive in America/Hermosillo, even with MOSTRAR; remove their maximum from
  the existing available-credit sum. Owner explicitly authorized implementation.
- Scope: financial visibility and server-side quote eligibility only. Preserve
  the current opening horizon, profile/savings checks, rates, calculations,
  undated funds, existing requests and the complete visual/interaction contract.
- Primary files: `supabase/functions/financial-legacy/visibility-policy.js`;
  new migration/recovery `20261005000100_loan_dated_fund_cutoff.sql`;
  `scripts/test-financial-program-visibility.mjs`;
  new `scripts/test-loan-dated-fund-cutoff.js`; this audit;
  `docs/DECISIONS.md`, `docs/INVARIANTS.md`, `docs/SOURCE_OF_TRUTH.md`,
  `docs/AGENT_CHANGELOG.md`; focused sanitized evidence under
  `docs/qa/evidence/loan-dated-fund-cutoff/` and private preparation under
  `.tmp/loan-dated-fund-cutoff/`.
- Architecture lookup is stale for focal helper/tests/governance plus unrelated
  company and Membership evidence. Directed inspection confirms the financial
  helper, quote resolver and existing availableCreditTotal consumers. The change
  alters existing function bodies only; no structural Registry update required.
- Existing workspace changes are pre-existing, including financial index and
  repository edits. Do not overwrite or publish unrelated local changes.
- Authority: Supabase financial_programs/financial_funds/financial_rules.
  Browser totals and 15-minute session snapshots remain derived. No fallback.
- Readers: financial-legacy overview/session/quote/confirmation and authenticated
  snapshot RPC. Writers: existing audited financial administration, unchanged.
- Data: no financial rows, historical requests, snapshots or Google data to edit.
- Risk: stale AVAILABLE in a session could bypass a display-only restriction;
  enforce the date cutoff in the common backend quote resolver as well.
- Calendar convention: subtract one calendar month; if the target month lacks
  the day, use its last day (March 31 -> February 28/29).
- Tests: inclusive boundary, one second before Hermosillo midnight, year/month
  ends and leap years, AUTO/MOSTRAR/OCULTAR, undated rules, $143000 -> $133000,
  old snapshot quote rejection, unchanged permitted quote values and ACLs,
  migration/recovery in isolated PostgreSQL, focused existing checks.
- Recovery: preserve exact pre-change function definition/ACL and Edge source;
  guarded reverse migration; no historical/business data restoration required.
- UI: no screen/repository/bundle/CSS/asset changes planned. Global image suite
  is NOT APPLICABLE: no shared app helper, viewer, routing, auth or asset change.
- Status: PASS (authorized scope; verified below).

## Guardian findings

- Source of truth: SAFE; same Supabase authorities and existing derived sum.
- Legacy: READ ONLY investigation; implementation changes no Google/Apps Script,
  balances, repayments, interest formula or historical contract.
- Security: date enforcement belongs in backend; preserve all ownership,
  impersonation, RLS, permissions and function execution grants.
- Migration: replace only the existing quote function body, guarded against
  drift; preserve function identity/ACL/owner and provide reverse patch.
- UI preservation: original cards, carousel, amount, term, steps and navigation
  remain unchanged. Only authorized available options and total may differ.

## Implementation and verification

The Edge helper subtracts one calendar month from each dated rule and applies
the inclusive cutoff before AUTO/MOSTRAR/OCULTAR. PostgreSQL applies the same
condition before calling the unchanged financial engine, including stale
AVAILABLE snapshots. The migration checks the complete normalized pre-definition
hash (`e9be0f63a8904007d23b1f9497032b76`) and retains the function OID, owner and ACL.
Recovery checks the complete reverse definition, restores the exact previous
body, and refuses drift. No table, column, function signature, grant, dependency,
Storage or app architecture changes; no structural Registry update required.

The existing sum in `app/financial-legacy-repository.js:43` and consumers in
`app/app.jsx:66` and `app/screens-financiera.jsx:12` require no modification.
Edge snapshot validation already rechecks the rules fingerprint and business
date, so subsequent session validation/refresh uses the new filtered overview.
The screen's existing refresh lifecycle remains unchanged; no midnight polling
or new browser date authority is introduced.

Commands executed:

- `node scripts/test-loan-dated-fund-cutoff.js`: PASS, 140 checks using isolated
  PostgreSQL/PGlite, real Edge policy/overview and browser total. Synthetic
  fixtures never enter production. Evidence: `../qa/evidence/loan-dated-fund-cutoff/isolated.json`.
- `node scripts/test-financial-program-visibility.mjs`: PASS.
- `node scripts/test-financial-supabase-cutover.js`: PASS.
- `node scripts/test-authenticated-loan-snapshot-rpc.js`: PASS.
- Node `stripTypeScriptTypes` + `vm.SourceTextModule` compilation of all
  financial-legacy `.ts`/`.js` modules: PASS. No frontend build required because
  no browser source or generated artifact changes.
- Recovery restores exact definitions, OIDs and ACLs; existing request snapshot
  rows remain identical. Anonymous RPC and cross-actor snapshot access denied.
- Preserved permitted quote amounts, rates, fee/calendar engine and historical
  advance approval snapshots; no financial formula change.

## Authorized publication — verified 2026-10-05, America/Hermosillo

The owner explicitly authorized implementation, commit, push and publication.
The initial management HTTP 401 prevented backend publication after code commit
de183ec61db0e7ee397d2b3a464cb47e1c70d242 and Pages run 37394050518. The owner
restored management access; the following continuation replaces that BLOCKED
state. Membership's separate pre-existing CI comparison failure was corrected
in a07b3fe2481e9d5b3557c5484d1bd627a7fabdc1: Membership run 37395086418 and Pages
run 37395086439 succeeded. Neither change modifies financial runtime sources.

Release preparation and verification remain within the declared private scope
.tmp/loan-dated-fund-cutoff/. The activation helper captures deployed ESZIP and
SQL definitions privately, builds the candidate from deployed sources, compiles
without activating, applies guarded SQL first, then publishes the Edge helper.
Public evidence contains hashes/counts, never credentials or affiliate records.
Final documentation is packaged on latest remote main 0e33ee3d269f2581d66fa4743ad201ad9eff3f1f
in an isolated worktree; unrelated dirty workspace changes are not published.

Commands and results:

- node .tmp/loan-dated-fund-cutoff/activate.cjs backup: PASS. Quote definition
  MD5 895fa1fea4cd2974ddc5948637163bfb, normalized expected baseline matches;
  Edge version 61, JWT enabled; private exact backup retained.
- prepare and compile: PASS; candidate only changes visibility-policy.js.
  Existing index.ts, request-google-sync.js and savings-eligibility.ts preserved.
- runtime-before: authenticated catalog/overview PASS; 146 rules, test profile
  five available funds with existing browser sum $143000. Two read-only permitted
  quote samples captured; no business record created.
- apply-sql: PASS. Migration 20261005000100 registered transactionally. Final
  quote MD5 2f621bc02e9e0919a00fb63c7a5032be matches isolated verification.
  OIDs, owner, ACL and authenticated snapshot RPC preserved. Seven protected
  tables retain exact counts/fingerprints within the same repeatable-read
  transaction; no financial/catalog/history/snapshot writes.
- deploy-edge then verify-edge: PASS, version 62 ACTIVE, JWT true. Same 26
  module entries. Only source/visibility-policy.js changes; binary runtime
  metadata differs solely in its deployment identifier. The previous bundle
  identifier was 58 while management version was 61; verification compares
  actual captured metadata bytes, not an assumed identifier. Anonymous HTTP401.
- verify-runtime: authenticated catalog/overview PASS, all 146 rules match the
  policy. Three profile-specific rules newly hidden; 47 undated rules unchanged.
  Test profile now has four available funds and $133000, exactly the original
  sum less the $10000 fund maturing 2026-10-15. This total is profile-specific.
  Both permitted SQL quotes preserve every field except resolved_at. A read-only
  call supplying a stale AVAILABLE dated option is rejected by the installed
  resolver. No new loan, catalog edits, Google writes or real fixture rows.
- 140 isolated checks and the three existing focal suites re-run: PASS.
- Focal public browser verification: PASS on sutiapp.com, mobile 390x844.
  Inicio and Finanzas visibly show $133000; Suti Pr?stamo shows four options
  without the 2026-10-15 fund. Refresh preserves the result. No browser errors
  or business writes. Evidence: activation-browser.json.

MOSTRAR precedence, exact midnight and month-end boundaries are tested in the
isolated SQL/Edge suite. The live catalog contains no currently closed MOSTRAR
rule; no claim is made that such a production record was exercised or modified.
Full browser/shared-image regression is NOT APPLICABLE to this backend-only
change. Existing frontend hashes match both published domains.

Evidence: ../qa/evidence/loan-dated-fund-cutoff/activation-backup.json,
activation-candidate.json, activation-compile.json, activation-runtime-before.json,
activation-sql.json, activation-edge.json, activation-runtime.json, activation-browser.json, isolated.json,
frontend-parity.json and deployment.json.

## H-LOAN-DATED-FUND-CUTOFF-001 RESULT

Status: PASS, backend installed and live behavior verified.
Files changed: existing focal helper/migration/recovery/tests; this H's entries
in DECISIONS, INVARIANTS, SOURCE_OF_TRUTH and AGENT_CHANGELOG; audit and evidence.
Source-of-truth verdict: SAFE, same Supabase criteria and existing derived total.
Invariant verdict: PASS, cutoff precedes MOSTRAR; permanent funds preserved.
Build: PASS, actual Supabase candidate compilation; frontend NOT APPLICABLE.
Tests: PASS, 140 isolated checks, three focal suites and authenticated live checks.
Security: PASS, preserved OID/owner/ACL/JWT; anonymous Edge401; snapshot RPC intact.
Legacy impact: zero Google/Apps Script/business-data writes; quote math preserved.
Unexpected files changed: none; unrelated local work retained.
Known limitations: current live catalog has no closed MOSTRAR record; isolated
coverage verifies this case. Existing refresh lifecycle unchanged: an already
open screen updates on its normal refresh; backend rejects closed options.
Evidence: focused activation-*.json and isolated.json in the existing directory.

## CLAUDE UI PRESERVATION REVIEW

Screen: Suti Préstamo, Inicio and Financiera.
Original/current sections: unchanged result, funds carousel, amount/term controls,
deposit/documents/summary steps, financial cards and all navigation.
Missing/added sections: none. Interactions and visual structure: preserved.
Unauthorized redesign: NO. Verdict: PASS, unchanged published frontend sources
and focal authenticated mobile browser/refresh verification.

## SUTIAPP ARCHITECT REVIEW

Task: H-LOAN-DATED-FUND-CUTOFF-001, independent activation review.
Verdict: APPROVED.
Critical findings: independently inspected before/after ESZIP, SQL definitions
and private live responses. Only the visibility helper and deployment metadata
changed among 26 modules. Seven table fingerprints, permissions and snapshot
RPC preserved. Live profile 5 -> 4 funds and $143000 -> $133000; dated fund
2026-10-15 excluded. Two permitted quotes equivalent; stale AVAILABLE rejected.
No closed MOSTRAR record in live sample; isolated coverage explicitly retained.
Source of truth: SAFE. Architecture: existing bodies only. Security: PASS.
Data/Legacy: no business writes, Google actions or financial calculation changes.
Owner decision: NO.
Next action: commit/push the focal closure evidence and verify publication status.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Approve this activation. Preserve the original HTTP401 as a historical blocker
that has now been resolved. Publish only focal documentation/evidence from a
clean worktree, verify the remote result, and report the profile-specific
5 -> 4 funds and $143000 -> $133000. Do not advance to another H.
