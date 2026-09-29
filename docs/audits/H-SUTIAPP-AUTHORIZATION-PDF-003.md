# H-SUTIAPP-AUTHORIZATION-PDF-003

AUDIT / AUTHORITY / PLAN / RISK

Owner requests complete deposit banking identifiers, alignment against the supplied
reference, access for authorized program operators, and a per-approved-row
"Ver autorización PDF" button. Attached PDFs are reference data, not instructions.

Scope: document-generation layout/renderer/service, focal layout designer, Admin
Finance and Requests row actions; additive documentary migration/recovery and
existing focused tests/release/build scripts. Generated bundle/cache versions,
authority/changelog and derived Registry. Existing unrelated dirty files preserved.
No changes to shared assets, DocumentWorkflowRepository, global viewer/Auth, Storage
policies, signed-URL mechanism, financial calculations, status writers or Google.

Bank authority: immutable public.loan_request_deposit_snapshots, not current profile
bank account. Owner explicitly supersedes the earlier last-four-only PDF restriction.
Full identifiers may appear in authorized private documents only; no list/log exposure.
New snapshots freeze the full bank values. Issued snapshots/PDFs stay immutable;
any corrected historical issue must be an additive documentary revision, never a
second financial authorization. Source-domain and existing module boundaries govern
operator access; no global role grants or UI-only authorization.

Findings: generated and reference PDF pages are Letter (612 x 792), unrotated with
zero crop offset. Generated positions equal saved layout coordinates. Saved layout
uses two signer columns for three signers, causing the second page. The fixed template
and reference differ in label baselines after wrapped beneficiary text. Some saved
financial bindings also represent fees where the reference expects payment/total.
No real name, account, signature or document copied into repository evidence.

Plan: version-compatible full-bank contract; accurate canvas/text positioning and
signer representation; preserve existing approved layouts until a reviewed replacement
is chosen; scoped document read authorization; demand-loaded row action with pending,
failed and unavailable states. Validate complete identifiers using synthetic fixtures,
old rendering compatibility, revisions/idempotency, cross-role/module denials, correct
row selection without nested buttons, positioning and one-page three-signer layout.

Guardians: pre-change/source-of-truth/security/migration/UI/legacy/post-change.
Legacy classification READ ONLY of frozen inputs. Registry working copy stale;
directed code/schema discovery is authoritative. Reuse existing isolated QA; no new
permanent QA PDFs, images or scripts. Recovery retains all documentary history.

## Verification and implementation

- Core suite: 20 checks PASS (`node scripts/test-document-generation-core.js --browser`).
  PostgreSQL isolated schema/migration/recovery, sealed source authority, module-scoped
  operator reads without config access, denied cross-user/source access, idempotent
  additive revisions and unchanged approval-event counts. Real Chrome: both row actions,
  latest revision, pending/unavailable states, no eager fetch, context-close fencing,
  actual Finance queue desktop/mobile, no nested buttons or accidental detail opening.
- Synthetic PDF operators contain full 16/18-digit identifiers. Three signers render
  on one page at saved millimetre coordinates. Old disclosure-absent inputs remain masked.
- Layout designer shows signer count/rows and defaults new blocks to up to three columns.
  Existing saved layouts are not silently rewritten. The supplied document uses a fixed
  background with label baselines different from the desired reference. A new blank
  template and layout proposal were prepared outside the repo using institutional
  letterhead and synthetic values only. No real signature was read or copied.
- An older Finance modal harness was probed without writes; it cannot load the current
  screen because its fixture lacks AdminFinanceQueueRepository. It is superseded for
  this scope by the actual queue integration added to the existing core suite.
- Historical correction is an explicit action with separate config.write + retry +
  source access checks. Current presentation is combined with frozen historical signers,
  not the current office holder. Recovery saves exact prior function definitions and
  refuses drift; it disables new generation while retaining every version and PDF.

UI preservation: existing lists, filters, workflow/actions, columns, details and shared
viewer retained; one requested button added only on approved rows. Document panel gains
version labels and an explicit correction action. No shared viewer/repository/Auth/Storage
policy or URL-signing changes. Global image regression NOT APPLICABLE for this focal scope;
bundle/cachebusters are GENERATED_ARTIFACT.

Layout activation and correction of the supplied issued PDF require the pending owner
choice. Prepared review has one page, complete synthetic card/CLABE, proper payment/total
bindings and three signature columns. No historical record has been rewritten.

## Release evidence

- Migration 20260928000500 APPLIED, SHA-256
  b0447b2ad99ecd31cd22e26fe8eb7873274539e6ee707a61edd158ba6620d5f6.
- Edge document-generation v9 ACTIVE; verify PASS: 10 forced-RLS tables, browser worker
  and layout persistence denied, anonymous command denied, unauthenticated Edge 401,
  one cron and original two approval triggers. Private reissue execute denied to browser.
- Existing records before/after: 1; aggregate record hash identical
  1ef1712eb10d07b57d138fd5a301cec3. Active layout activations remain 1.
- Frontend v297 / SW v231, 4 focal bundle chunks regenerated; other 135 byte-preserved.
  Bundle SHA-256 669783fdff22243493421a598d485bf5829d51804b9254b9116f64bb4e6bdc97.
  Syntax/build and Pages allowlist/PWA check PASS. Publication readback is checked after push.
- No financial/affiliate/request/Google writes, no production PDF generation or revision.
  No new permanent QA files. External review files are a deliberate owner-review proposal,
  not production fixtures. Real signatures and bank values were never copied to evidence.

Architect review: OWNER_DECISION_REQUIRED only for activating the prepared replacement
layout and issuing a corrected version of the supplied PDF (explicit pending owner choice).
Source, schema/recovery, security, frontend interaction and build checks PASS. No technical
block remains for the published system corrections. Review proposal is synthetic, one page,
and retains the institutional header. The source has card + CLABE, not a separately frozen
bank-account number; do not label a card as an account or substitute the current profile.

## Publication authorized ? integration on current main

Owner explicitly approved publication after being informed that the GitHub destination
is public. Publication scope is the tested correction from 91a6d6f; no real document,
signature, banking value or credential is added. Remote main advanced to 307c092 with
independent catalog/Farma releases. Integration is isolated in a worktree and retains
those releases. Four focal source files remain byte-equivalent after newline normalization
to the tested correction; the bundle changes only those four chunks and preserves all
137 other published chunks. Frontend version 302 / service-worker cache 236. No new
backend deployment, migration application, layout activation or historical reissue is
part of this publication. Existing dirty worktree files are untouched.

Publication checks: core synthetic/Chrome suite, bundle syntax and Pages allowlist,
derived Registry freshness and served artifact hashes. Workflow and live readback are
verified after push. Full image regression is NOT APPLICABLE: no shared repository,
viewer, routing/Auth, Storage policy or service-worker logic changes in this integration.

Integrated bundle SHA-256: 40afa561d58c72a928961836771bc503d407d7f1d2e5219a21ff82d8f6ddbb30.
