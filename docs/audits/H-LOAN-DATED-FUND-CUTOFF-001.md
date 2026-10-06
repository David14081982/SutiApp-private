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
- Architecture lookup is stale only for unrelated company evidence/scripts.
  Directed inspection confirms the financial Edge helper, quote resolver and
  existing `availableCreditTotal` consumers in Inicio/Financiera.
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
- Status: PASS (authorized scope; implementation/verification pending).

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

## Publication limitation

### Authorized release continuation — 2026-10-05

Owner now explicitly requests commit, push and publication. Scope expands only
to isolated release preparation under `.tmp/loan-dated-fund-cutoff/release`,
`scripts/package-loan-dated-fund-cutoff.js`, focused release evidence in the
existing evidence directory, and this H's sections in governance documents.
Use latest remote main, copy the exact focal delta, preserve all other deployed
sources/frontend, commit and push without resetting the dirty main workspace.
Re-check management credentials and perform the original live drift preflight
before any backend mutation. GitHub publication does not itself deploy Supabase.

Release candidate is based on remote main
`81273504905a197a7c0a5b851037408659d51d48`. Independent agent review approved the
focal commit and re-ran all four suites. The isolated checkout independently
passes all 140 behavioral/SQL checks and three focal suites. The fixture setup
normalizes only the historical fee migration to its original LF installation
before its existing hash-guarded successor; production files are untouched.
Mixed line endings in unrelated governance entries are preserved verbatim.
Live checks on both `sutiapp.com` and GitHub Pages confirm exact normalized
hashes for the candidate bundle, service worker and financial repository;
`frontend-parity.json` records them. The automatic Pages deployment on push
therefore preserves the published frontend. No backend deployment secret is
configured in GitHub; the local management preflight still returns HTTP 401.

Commit/push completed: `de183ec61db0e7ee397d2b3a464cb47e1c70d242` on main,
14 focal files. Independent review verified the actual commit, clean release
checkout and preservation of all unrelated governance/frontend. Pages run
`37394050518` succeeded; post-deployment checks confirmed the same frontend
hashes on both domains. The separate Membership Google contract workflow fails
at `test-membership-payment-contract.js:43` with exactly the same pre-existing
FinanceBlocksRepository baseline difference as run `37360128239`; this H does
not modify that repository or test. Full release remains BLOCKED: neither the
SQL migration nor Edge helper is active in Supabase. Evidence:
`../qa/evidence/loan-dated-fund-cutoff/deployment.json`.

The read-only management API inspection using existing local configuration
failed with HTTP 401 after network access was available. No remote mutation,
deployment, migration, login reset or business-data write was attempted.
The deployed function definition and Edge version therefore remain unverified.
Once management access is restored, read/capture the live function and deployed
Edge source first; match migration precondition, preserve unrelated deployed
files, apply only the migration and visibility helper, then verify the live
overview and available-credit total. Do not deploy the dirty local index.ts.

## H-LOAN-DATED-FUND-CUTOFF-001 RESULT

Status: BLOCKED for production publication; local implementation/verification PASS.
Files changed: visibility-policy.js; new migration/recovery; two focused test
files; DECISIONS.md, INVARIANTS.md, SOURCE_OF_TRUTH.md, AGENT_CHANGELOG.md; this
audit and isolated evidence. Private inspection preparation is under ignored .tmp.
Source-of-truth verdict: SAFE, same Supabase authority and existing derived total.
Invariant verdict: PASS for authorized local scope; live adoption pending.
Build: PASS Edge module compilation; frontend NOT APPLICABLE.
Tests: PASS, 140 behavioral/SQL checks and three existing focal suites.
Security: PASS isolated authenticated/anonymous/other-actor checks; ACLs unchanged.
Legacy impact: none; zero Google/Apps Script or financial business-data writes.
Unexpected files changed: none by this task; pre-existing workspace changes retained.
Known limitations: management HTTP 401 blocks live verification and publication.
Evidence: ../qa/evidence/loan-dated-fund-cutoff/isolated.json and commands above.

## CLAUDE UI PRESERVATION REVIEW

Screen: Suti Préstamo, Inicio and Financiera.
Original sections: loan result, available-fund carousel, amount/term controls,
deposit/documents/summary steps; Inicio/Financiera financial cards.
Current sections: unchanged source and generated frontend.
Missing sections: none.
Added sections: none.
Interactions preserved: yes; existing selection, quote, refresh and sum consumers.
Navigation preserved: yes.
Visual structure preserved: yes, no frontend modification.
Unauthorized redesign: NO.
Verdict: PASS (source parity; no claim of new live browser verification).

## SUTIAPP ARCHITECT REVIEW

Task: H-LOAN-DATED-FUND-CUTOFF-001, focused final read-only review.
Verdict: BLOCKED for production release, local implementation accepted.

Critical findings:

- Verified actual helper diff, executable SQL, RPC behavior and evidence, rather
  than relying on completion text. Local calendar, totals and stale-session
  enforcement satisfy the approved requirement.
- Final review identified a Windows CRLF portability issue in the SQL literal;
  corrected it within scope and verified both LF/CRLF installation and recovery.
- No mathematical changes or request-history changes; unchanged approved
  historical contracts are explicitly exercised. Only eligibility changes.
- A read-only Supabase management request returned 401. No valid alternative
  management token exists in process environment or the usual CLI login file.
  Live function/source comparison and deployment remain unperformed.
- WORK_QUEUE_HISTORY.md is absent. Existing WORK_QUEUE is historical; this
  implementation is directly owner-authorized in the current conversation.
- `git diff --check` on touched tracked files and JS syntax check passed.

Source of truth: SAFE, existing Supabase criteria; no alternate authority.
Architecture: existing helper and resolver bodies only, no new dependencies.
Security: unchanged OID/owner/ACL/SECURITY DEFINER/search_path and guarded recovery;
anonymous/cross-actor access denied by the existing authenticated RPC.
Data: zero business/history writes; isolated fixtures only.
Legacy: no Google, Apps Script, payroll writer, rate or amortization edits.

Owner decision: NO new business decision; valid management access is required.

Next action: restore the configured Supabase management connection, then run
live read-only drift checks before publishing the reviewed focal artifacts.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Do not mark H-LOAN-DATED-FUND-CUTOFF-001 published or fully PASS. Preserve the
accepted local implementation. Once management access works, capture current
function definitions/ACLs and deployed financial-legacy files privately. Require
the migration hash precondition; deploy only this SQL guard and the reviewed
visibility-policy.js while preserving other deployed files. Verify eligibility,
the existing total, MOSTRAR precedence, undated options and authentication without
creating a real loan or altering catalog/history. Stop if live definitions differ;
audit the precise difference instead of overwriting it. Do not advance to another H.
