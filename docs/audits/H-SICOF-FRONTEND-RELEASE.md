# H-SICOF-FRONTEND-RELEASE

## PRE-CHANGE AUDIT

Objective: prepare the owner-authorized SICOF frontend activation on an isolated current origin/main checkout. Publication remains gated on the parent task's backend PASS signal; this preparation does not push or modify production.

Authority: the parent delegated the user's explicit activation/publication authorization. The approved candidate is the frozen H-SICOF-001 manifest; bundle SHA-256 `fe8e56e0e87c9119a613548363e747acaff708284d3e6365385f2316c08e6484`.

Scope: `.tmp/sicof/release` isolated Git clone; four new modules `app/sicof-repository.js`, `app/sicof-payment-behavior.jsx`, `app/sicof-admin.jsx`, `app/savings-period-breakdown.jsx`; four focal integrations `app/screens-admin.jsx`, `app/screens-admin-finanzas.jsx`, `app/screens-savings.jsx`, `app/savings-runtime-admin.jsx`; build registration `scripts/build-bundle.js`; generated `app/bundle.js`, `SutiApp.html`, `sw.js`. Packaging/verification scripts `scripts/package-sicof-release.js`, `scripts/test-sicof-release.js`, focal browser tests and this audit plus sanitized evidence under `docs/qa/evidence/sicof/` are in scope. Actual production screen-registration metadata is required by the existing build guard; copying its verified post-migration snapshot into the isolated checkout is allowed. Any needed migration/recovery references and current SICOF authority notes are copied narrowly, never the dirty workspace wholesale.

Outside scope: modifying the approved root sources; publishing unrelated work; broad rebuilds; changing Auth, asset helpers, workflow deployment rules, service-worker logic or financial calculations; database/GAS/Edge deployment (parent task); workbook, business-row, credential or private evidence publication.

Sources of truth: canonical Savings ledger and existing writers; authenticated fixed Historial P V2 reader. No source authority changes in this release. Historical workbook remains private backend evidence and is excluded from Git/Pages packaging.

Plan: inspect current main and deployed bundle; verify frozen input hashes; replay only the audited focal integration against current main; preserve all unrelated bundle chunks; use the original source compiler per focal chunk; generate cachebuster-only HTML/SW changes; prove frontend/backend registration using live metadata; run isolated browser and public-artifact checks. If main advanced, preserve its unrelated changes and record the new candidate hash and comparison to the original approved candidate.

Invariants: no production business writes; no copied secrets/Excel/PII; exactly four existing bundle chunks changed and four added; existing Admin/Finance/Savings interactions preserved; approved new module bytes unchanged; only explicit integration hunks on existing sources; Pages allowlist/guards unchanged; no push before backend PASS.

Risk: concurrent remote changes and stale source/bundle pairs. Resolve through exact baseline/source equivalence, targeted patch conflict rejection and published-baseline comparison, never by overwriting current main from the dirty workspace.

Recovery: immutable Git baseline commit in isolated clone, local prepackage file snapshots and hashes; candidate is reversible until publication. After authorized publication, frontend recovery is a new revert commit of this isolated release; do not reset or force-push shared main. Backend recovery is owned separately and must remain compatible with already-open clients.

Navigator: registry freshness was FRESH and SICOF lookup resolved the audited sources, module, repository, migration and permission boundaries. UI/authority/post-change guardians applied; original UI contract is `docs/qa/evidence/sicof/ui-contract.json`.

Status: preparation in progress. No publication performed.

## Verified production baseline and prepared candidate

The isolated clone is based on `origin/main` commit `30a120e3cae13415a347f838e6d2fdeee64e98f8` (private summary access fix). Both `https://sutiapp.com/SutiApp.html` and GitHub Pages served bundle v310 with exact SHA-256 `65de47766b3aa10b5ae4ae82bae2bcd44ce7ef07bbd7257041144dc0771f5a23` during the read-only preflight.

Current production contains 145 chunks, including the later RH savings modules and nine changed existing chunks relative to the original SICOF audit baseline. All four focal preintegration sources remain equivalent after line-ending normalization. The Finance source now has a Babel-compiled production chunk, which was verified exactly against that source and retained as its compiler mode. No unrelated module was reverted to the old local candidate.

The prepared release has 149 chunks: four new modules and four replaced integrations, with **141 existing production chunks preserved byte-for-byte**. Candidate SHA-256: `6ab062c6a110588bf33073fe6c5f4707d80bfa320db5980572cc9ca2242af2ea`; bundle version311. This supersedes the original local candidate hash only for packaging against the current production baseline; the eight approved frontend source files match their frozen manifest. HTML and worker changes are version strings only, with the worker script's logic unchanged.

Production metadata was captured through `node scripts/audit-screen-permission-coverage.js` after the parent reported both migrations applied. That script issues read-only schema/catalog queries. The fresh metadata registers SICOF as ENFORCED and supplies its existing administrative visibility mapping. The existing unmodified screen-permission guard passes. No proposed SQL or test fixture substituted for installed metadata.

Verification completed on the isolated release:

- `node scripts/test-sicof-release.js`: PASS static preservation/allowlist checks plus all three browser suites using the release sources and bundle.
- `node scripts/package-sicof-release.js sync-metadata`: PASS against the captured production catalog.
- `node scripts/test-sicof-release.js --static-only --require-backend --build-pages`: PASS; actual Pages build emitted exactly its public allowlist, with no workbook, docs, SQL, private files or environment files.
- `node scripts/package-sicof-release.js contracts-live`: PASS official Auth and critical request backend compatibility guards, using only public configuration and read-only probes.
- Global legitimate-image/document regression: PASS against the exact release artifact on `http://localhost:8080/`; verified bundle hash matches the candidate. All194 public asset checks and226 catalog asset checks passed, as did Login seal, profile, Admin images/documents, Membership, Loan, Marketplace, fullscreen, legitimate PDF, refresh and service-worker comparison. Zero browser errors and zero business-data writes. Evidence: `docs/qa/evidence/sicof/frontend-release-global-local.json`. Port4173 was not used for that check because existing deployed viewer CORS does not authorize it. No CORS rules were changed.

The first public artifact is `.tmp/sicof/release/.tmp/sicof/public-artifact-1791058515149`; later reproducible builds may use a new timestamped directory. `frontend-release-build.json` records the exact current artifact directory and bundle hash. Build/test artifacts stay ignored and are not Git/Pages content.

## Exact release procedure and gate

Run from the primary workspace while the isolated clone remains at the recorded baseline:

```powershell
node scripts/package-sicof-release.js inspect-live
node scripts/package-sicof-release.js prepare
node scripts/audit-screen-permission-coverage.js
node scripts/package-sicof-release.js sync-metadata
node scripts/test-sicof-release.js --require-backend --build-pages
node scripts/package-sicof-release.js contracts-live
git -C .tmp/sicof/release diff --check
```

`prepare` rejects changed frozen inputs or any focal remote-source drift. It constructs the bundle from the isolated HEAD, proves the source/compiler relationship, preserves nonfocal chunks and uses a declared file allowlist. It never runs database mutations, deploys or pushes. Runtime/backend source updates discovered during activation require a separately reviewed manifest delta before repackaging.

After the parent reports complete backend/live PASS, and after any final governance/evidence refresh, stage only the reviewed manifest paths and inspect the staged result:

```powershell
$sicofReleaseRoot = Join-Path (Get-Location) '.tmp/sicof/release'
$sicofReleaseProof = Get-Content 'docs/qa/evidence/sicof/frontend-release-package.json' -Raw | ConvertFrom-Json
$sicofReleasePaths = @($sicofReleaseProof.files | Where-Object { Test-Path -LiteralPath (Join-Path $sicofReleaseRoot $_) })
git -C $sicofReleaseRoot add -- $sicofReleasePaths
git -C $sicofReleaseRoot diff --cached --stat
git -C $sicofReleaseRoot diff --cached --check
git -C $sicofReleaseRoot commit -m 'feat(sicof): add period returns and savings reports'
git -C $sicofReleaseRoot fetch origin main
```

Confirm fetched origin/main still equals the recorded baseline before `git -C $sicofReleaseRoot push origin HEAD:main`. Any remote advancement requires a new isolated preservation comparison. Never force-push or publish the root dirty workspace. The main push invokes the unchanged Pages workflow; verify its result and both published bundle hashes, then rerun production global regression. These publication steps have not been executed by this preparation task.

## Read-only live UI activation check

The parent expanded verification to `scripts/verify-sicof-ui-live.js`, prepared for execution only after backend confirmation. It uses the real authorized H005 login and the exact current candidate at localhost8080. It visits SICOF's eight tabs, checks the real server calculation/report/source, opens actual savings and loan details, checks the Finance behavior indicator and verifies the authenticated user's period amounts and global availability against the canonical self projection. Source responses remain in process memory; evidence stores only counts, contract outcomes and bundle hashes. No screenshot or row data is saved in published evidence.

Network guards abort any attempted SICOF writer and Savings financial/attribution writer; such an attempt fails verification. The script does not save preferences, scenarios, reports or origins, and never submits or settles a financial request. An existing access-history event from legitimate authentication may occur under the unchanged login contract. If the authorized test account has no Savings account, self-period verification fails explicitly instead of substituting another person's data or a fixture. Private diagnostics, if needed, remain under ignored `.tmp/sicof/activation`.

```powershell
$env:SUTIAPP_SICOF_UI_URL = 'http://localhost:8080/'
$env:SUTIAPP_SICOF_UI_SHA256 = '6ab062c6a110588bf33073fe6c5f4707d80bfa320db5980572cc9ca2242af2ea'
node scripts/verify-sicof-ui-live.js
```

The activation correction allowlist is `docs/qa/evidence/sicof-release/source-deltas.json`. Packaging accepts an altered frozen backend source only when the delta is APPROVED, its original hash equals the original frozen manifest and its new hash equals the actual source. The original manifest is retained. New migration files require an explicit release-scope addition.

For final governance, `node scripts/package-sicof-release.js governance` copies only SICOF sections onto each current main document, merges only SICOF semantic overrides and regenerates the Registry from the isolated checkout. It never copies the root's full dirty normative files or generated Registry. Execute after backend/source/evidence freeze and before the final scoped staging review.

## Final prepublication gate

Backend activation is verified: migrations001/002/003, Edge v2, fixed Google reader v19, private historical workbook and production denials/conservation passed. The package includes the exact approved003 additions and transport/date-memo deltas, their tests, recoveries and sanitized evidence; `source-deltas.json` is checked without replacing the original frozen manifest. Six normative documents receive only SICOF sections from the root workspace. The independent frontend review is APPROVED for its stated package scope.

`ui-live-local.json` records seven real UI checks on the exact candidate. Admin LOAD/CALCULATE and the visible pool match passed; the source was READY at2026-10-03T20:47:28.141Z, with2373 loans,5656 period payments,354 participants and836 report rows. All eight tabs, savings/loan details and Finance behavior/modal passed. The original full run passed all six administrative checks but the verifier used a hash navigation that did not open self Savings. Only that test navigation was corrected to the normal Financiera/Ahorrar controls and repeated independently, without another Google query; the original failed attempt remains in `ui-live-admin.json`. Earlier verifier diagnostics identified an informational popup and Chrome inspector eviction of the large LOAD body. The final verifier observes a clone of the unmodified fetch response in browser memory and transfers only aggregates needed for assertions; product sources remain frozen.

The authorized self account has zero period rows and zero annual references. Its actual canonical availability and empty period component match the real self reader. This proves the empty real state; nonempty historical periods are additionally covered by the354-account SQL equivalence and isolated UI tests, not claimed as a nonempty live account demonstration. No account, movement or impersonation was created to obtain evidence.

The observed default calculation has `rateResolved=false`. The UI preserves that uncertainty and does not invent a yield percentage. Production verification captures aggregate reasons from the same calculation response for the user-facing handover. Neither activation nor this check credits yields.

After final documentation and evidence copy, regenerate/check Registry once more in the isolated checkout so it describes those final files. Commit only the declared manifest, fetch and compare origin/main to30a120e immediately before the non-force push. The parent has authorized publication conditioned on these gates; no additional approval request is needed. Publication still requires the workflow, exact deployed bundle and production UI/global checks before final closure.

## Published baseline and focal eligibility correction

The preceding preparation was published as commit `b1e562a83e85eabe5e271b0117bc705312a242aa`, bundle311, SHA256 `6ab062c6a110588bf33073fe6c5f4707d80bfa320db5980572cc9ca2242af2ea`. Workflow37153432882, both public domains, seven real UI checks and the global production regression passed. The H005 self check covered its real empty period state and canonical balance; no nonempty live account was claimed.

Independent review then found a concrete certainty defect: `review_required` rows displayed “No” in Califica, and missing enrollment dates could appear as zero months and a failed minimum. The authorized correction preserves unknown values: the table and saver detail display “Por verificar”; measured exclusions retain “No”. EngineV2 preserves a missing start as unknown and exports the same three states. Formulated exports use the exact “Sí” criterion. The reviewed backend was deployed as Edge3 before frontend publication.

The corrective candidate is built from the already published `b1e562` checkout, not from the dirty root bundle. Only the `sicof-admin.jsx` chunk changes; all148 other published chunks remain byte identical. Bundle312 SHA256 is `de642fb5b24c986c0b1c116c0dce8c8b12f2383fb086d68681ee47ef65b31d6a`; worker244 only changes generated cache versions. The original manifest and v311 production proofs remain retained. The earlier packaging helper is specific to the first release and must not be rerun against this new baseline.

Focal verification passed26 UI checks,13 integration checks and10 attribution checks with network blocked and zero production writes. The UI tests distinguish verified eligibility, measured exclusion, and unknown eligibility/tenure in both the table and detail. Engine,20 export groups and Edge contract tests passed independently; the independent reviewer approved the correction and byte preservation. The public Pages artifact must pass its unchanged permission/build guards before staging. Final publication checks observe the actual CALCULATE response once, assert engineV2 and no minimum-age exclusion for unknown dates, and compare visible eligibility/unknown-month counts with that same response without another Google read.

Before the corrective commit, copy only declared SICOF files/evidence and SICOF sections of the six normative documents into the isolated checkout; regenerate/check its Registry after all evidence writes. Compare origin/main to `b1e562a83e85eabe5e271b0117bc705312a242aa`, then use a normal push. Actual correction publication, UI and global outcomes are recorded separately after deployment; this paragraph does not claim those pending checks have passed.
