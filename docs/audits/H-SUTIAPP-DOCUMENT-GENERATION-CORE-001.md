# H-SUTIAPP-DOCUMENT-GENERATION-CORE-001

Owner authorization: approved seven-contract implementation, exact supplied Admin
HTML/CSS, autonomous verification and release. Base: 16a8a16f7c4b075d5dcc87142e62e9f5fff46009.

## Scope and authority

One Supabase document domain: `document_private`, `document-generation` Edge,
`generated-documents` private bucket, repository and Admin panel. Sources remain
the existing final approval events and frozen financial snapshots. No financial
calculator, Google writer, business-state replay, optional contract or backfill.
`numero_control` stays text. Real actor and effective affiliate remain separate.
New document permissions extend the existing permission catalog and preserve
existing assignments; ordinary administrators receive no automatic capability.

| Contract | Final event | Printed authority |
|---|---|---|
| LOAN_APPROVAL | program approval event | financial_approval_snapshot; masked loan_request_deposit_snapshots |
| PROGRAM_FINANCING_APPROVAL | program approval event | approved product, price, down payment, financialResult, payment_schedule |
| MEMBERSHIP_APPROVAL | program approval event | sealed membership financial_submission_snapshot; no activation assertion |
| SAVINGS_ENROLLMENT_APPROVAL | canonical APPROVE/JOIN audit | approved contribution, process and effective date |
| SAVINGS_CONTRIBUTION_CHANGE | canonical APPROVE/CHANGE_AMOUNT audit | previous authoritative plan when available, new amount and effective date |
| SAVINGS_CESSATION_APPROVAL | canonical APPROVE/TERMINATE audit | cessation date/reason; no withdrawal assertion |
| SAVINGS_WITHDRAWAL_APPROVAL | canonical APPROVE/WITHDRAW audit | approved amount, kind, component and continuation; no payout assertion |

Savings event IDs are bigint, general event IDs UUID; composite document identity
includes domain, operation, final event (text), contract and business version.
Snapshots capture identity and immutable template/signer versions at the event.
Missing configuration creates an explicit failed documentary record. Configuration
repair resolves only an unsealed configuration; already sealed inputs never change.
Worker claims committed records with lease fencing and deterministic object paths.
Rendering and storage errors never rerun the financial operation. Retry is an
independent permission. Historical documents and assets cannot be updated/deleted.

## Visual and access contract

Original CSS tokens, cards, three tabs, three KPIs, alerts, sticky preview, safe
area, template history, six dialogs/drawers, uploads, signer search/filter,
program assignments, ordering and responsive breakpoints are preserved. Native
PDF previews replace the static illustrated sheet. Explicit document-type
selection implements program + contract assignments. Active-template following
and fixed historical version selection are distinct. Every preview uses the same
contract/renderer with synthetic identity and signer labels, without records.
Session/context changes unmount document views and revoke transient blob URLs.
Historial, Finance, requests and savings project the same issued record.

Backend capabilities separate configuration, templates, signer identity, signature
read/write, document read and retry. Eight private tables force RLS, no direct
browser schema access, service-role-only worker, manual JWT validation at Edge,
origin checks, two-minute signed URLs, restrictive Storage isolation. Access also
requires the original operation to exist and match the affiliate. No permanent
browser cache or production fallback. Bank values retain only last four digits.

## Implementation and validation

Migration: `20260928000100_document_generation_core.sql`; matching recovery
disables dispatch and restores the prior assisted-visibility function with a
drift guard, while retaining documents, templates, signatures and audit history.
Installed on 2026-09-28 after isolated PostgreSQL validation. Edge ACTIVE; private
bucket, two capture triggers, one cron, eight forced-RLS tables; anonymous HTTP
401; browser cannot execute worker. No templates/signatures/requests inserted as QA.

- `node scripts/test-document-generation-core.js --browser`: 12 PASS checks.
  Seven contracts; 240 frozen payments; multipage/header repetition; deterministic
  bytes; effective margins; cross-user denial; lease fencing; retry; historical
  immutability; bigint savings events; correct loan/membership sources; recovery;
  real Chromium desktop/mobile panel interactions. Synthetic PDFs stay in memory.
- `node scripts/test-screen-permission-contract.js`: 20 PASS checks. Reuses current
  read-only metadata after the historical permission migration; temporary fixture
  directory is outside the repository and cleaned, no new permanent evidence dump.
- `node scripts/test-admin-access-protected-contract.js`: PASS.
- `node scripts/test-pages-deployment.js`: PASS; public artifact excludes secrets.
- Canonical Babel compilation: 137 modules. Release retains the exact 128 unrelated
  baseline chunks and updates only nine focal chunks. Bundle v294, worker v228.
- `scripts/test-global-image-regression-production-live.js` against
  `http://localhost:8080/`: PASS. 194 app assets, 226 catalog assets, 29 affiliate
  images, protected image previews, Admin profile/documents, Marketplace,
  membership logos, gallery/fullscreen, legitimate protected PDF HTTP 200,
  refresh and with/without-service-worker comparison. Zero browser errors and
  zero business data mutations. Initial port 4173 attempt was rejected by existing
  CORS; rerun used the already authorized 8080 origin, with no policy change.
- Authenticated Chromium on local release + live backend: new panel opens,
  three tabs/KPIs, configuration cards loaded, no JavaScript error or writes.
- Production cron: succeeded; worker HTTP 200, no timeout, no documentary QA rows.
- Seven production rendering paths also tested in memory with twelve synthetic
  signature images each; multiple pages and byte-identical re-render confirmed.

Global local regression bundle SHA-256:
`6acc3b4f5d5c491b937d471f7ad7eedbc9d765853c6d122b2aaef6dff996e311`.

Existing permission metadata is refreshed in place, without personal records.
Architecture index is derived from the release candidate, separately from the
owner's pre-existing dirty registry files. Pre-existing loan-transfer, audit and
historical migration edits are outside this release.

## Operational limits

Real institutional template and authorized signers must be configured in the
panel. No hardcoded member, template or real signature substitutes them. First
release accepts one-page PDF letterheads; DOCX conversion is explicitly deferred.
No retrospective document generation, extraordinary withdrawal or nine optional
contracts. Dispatch processes one document per minute; failed rows require an
authorized retry after correcting their cause. Loan amortization is printed only
when a sealed schedule exists. Standard PDF fonts support the current Spanish
contracts; unsupported glyphs fail visibly rather than silently dropping text.

Permanent QA files added: 1 shared critical-contract test. Permanent QA PDFs: 0.
Real PDFs/signatures copied as fixtures: 0. QA business data in production: 0.
Release authorization is complete; final published commit and production regression
are reported in the delivery message after Pages deployment. No production PDF is
issued solely to demonstrate the feature.

## Architect review of release candidate

APPROVED for the authorized release, conditioned on matching published bundle hash
and the mandatory production regression. UI, authority, security, immutability,
recovery and protected Admin contract verified above. No new owner business
decision. `WORK_QUEUE_HISTORY.md` is absent; this H uses the explicit owner approval,
not an inferred queue authorization. Pre-existing queue work is not resumed.
Next instruction: publish the verified candidate, verify sutiapp.com and stop.

Final focal signer refinement: migration `20260928000200_document_signer_assignment_order.sql`
preserves signer position during identity edits; panel deactivation does not try
to assign the disabled version. No existing data rewritten. Isolated contract
suite and browser reverified (12 PASS), including deactivate/reactivate and order.
Final release bundle: `51d3ec0a252ffe4694c8a46e4bddc05dfdec505d4156f81ad9d4fbf13361b325`.
Only the focal document panel chunk differs from the globally tested local build;
shared modules remain identical. Published global regression verifies this hash.
Architecture validation reuses the existing suite. Its absent-feature phrase now
uses an unambiguous identifier; credential photo discovery permits genuine finance
consumers while still requiring identity, AffiliateRepository and Avatar. The
generator prefilters absent ASCII literals before the unchanged Unicode-aware regex,
preserving evidence while avoiding repeated expensive negative searches.
