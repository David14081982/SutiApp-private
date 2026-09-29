# H-SUTIAPP-DOCUMENT-LAYOUT-RENDER-FIX-001

## Pre-change audit — 2026-09-29

Owner authorizes a focal renderer fix and publication. Preserve every absolute
FIELD/TEXT rectangle and every issued PDF. Only SIGNERS internal arrangement and
two demonstrated incorrect financial bindings may change. No recalculation,
financial writes, historical regeneration, schema migration or designer redesign.

Scope: `supabase/functions/document-generation/render-layout.mjs`, `renderer.mjs`,
existing `scripts/test-document-generation-core.js`, this audit and
`docs/AGENT_CHANGELOG.md`. The existing versioned layout persistence may append
one corrected LOAN_APPROVAL configuration; no values or rectangles change.
Expand this list before editing another file.

Authority: document_private layouts/activations and sealed document snapshots;
reader: existing shared renderer, used by preview and worker. Writer: existing
permission-gated layout persistence. Financial and deposit snapshots are read-only.
No Google access, signature downloads, fallback, browser cache or parallel authority.
Source-of-truth: SAFE. Legacy: READ ONLY (sealed snapshot, no Google calls).
Security: unchanged Auth/RLS/Storage. No personal values in published evidence.

Navigator: isolated base 3203a4d; registry stale only for the prior finance release;
direct reads verified renderer, layout validation, service, persistence and tests.
No new dependency, route, schema, permission or authority is proposed.
Global image regression: NOT APPLICABLE; only the documentary renderer is changed.

Evidence before modification: attached PDF has two Letter pages, zero rotation.
Active layout has one page; all 16 elements explicitly have page=1. SIGNERS is
x=23, y=204, width=171.9, height=45 mm, gap=5, font=Helvetica 10 pt, columns=2.
Three columns give 53.9667 mm each. Actual signer metadata wraps to four text lines
per signer, requiring 43.6389 mm; therefore all three fit the existing rectangle.
The extra blank form comes from the template background, not cloned FIELD/TEXT.

The isolated number is element initial_1, binding identity.numero_control, from
document_snapshot.identity.numero_control, x=25.5/y=37 mm. It belongs to the active
layout and is retained. CLABE and its last-four projection are empty in the sealed
snapshot; FULL_DEPOSIT aliases correctly resolve the absent CLABE. No invented value.

Binding findings (prefix operation.financial.financialResult): amount/paymentCount/
interest are correct. The rectangle labelled Cuota fija binds administrativeFeePerPayment
and should bind paymentPerPeriod; Total a pagar binds administrativeFeeTotal and
should bind total. Interest-rate label has no FIELD element; rate exists in the
snapshot. Do not add or position a new element without owner layout instruction.

Plan: measured signer rows; deterministic horizontal 1/2/3-column fit; atomic signer
blocks and keep-together when possible; reserve explicit pages and append overflow
with only institutional header/footer bands from the existing margins. No page-one
body on automatic continuation. Validate preview/issued geometry with identical
synthetic inputs and an unchanged snapshot; reuse existing in-memory tests.

Recovery: redeploy renderer from parent commit; reactivate the previous immutable
layout if needed. Neither operation changes issued PDFs or financial records.
Risk: shared renderer pagination; mitigation: real PDF operator checks for 1..N
signers, long names, continuation background clipping, explicit page isolation,
absolute positions, null fields and deterministic bytes. No new QA files/PDFs.
Pre-change status: PASS.

## Validation before publication

`node scripts/test-document-generation-core.js --render-only`: 7 grouped checks PASS,
including all seven documentary contracts, one/two/three/four/24 signers, 120 frozen
schedule rows, preview/issued operator parity, deterministic bytes, explicit page
isolation, header/footer clipping, unchanged absolute positions and null banking fields.
Tests use in-memory synthetic PDFs; no database or financial tests execute in this mode.
Node syntax checks PASS for both renderer modules and the reused test script.
Frontend build compiles all 141 existing files in memory using the existing builder;
no frontend artifact changes. Management `bundleOnly` compilation PASS.

Chrome/PDF.js read the attached two-page PDF in memory: the repeated form labels
belong to the template. The same active template/16-element layout with synthetic
identity, bank and signer data renders one page after the fix. Its visual inspection
confirms three complete signer columns at the original x=23/y=204 mm. Zero new
overlaps. No real signatures downloaded; no PDF or screenshot files written.

Configuration baseline: active version 2 still matches the attached sealed layout;
three current signers. The existing WRITE gate accepts the layout creator (principal
administrator and the approving actor). The original deposit source confirms empty
CLABE. Existing documents and request values will not be updated.
All five deployed Edge v10 source modules match origin/main before release.

Database guardian: PASS for additive configuration through existing persistence;
no migration/schema/RLS/grant/financial change. Activation retains all 16 rectangles,
IDs, fonts, page assignments and the existing template/signers. The two changes are:

| Printed label | Element | Frozen field after correction |
| --- | --- | --- |
| Monto solicitado | initial_5 | operation.financial.financialResult.amount |
| Numero de pagos | initial_6 | operation.financial.financialResult.paymentCount |
| Cuota fija | ca5a82ea-61c4-4f9d-98a4-9345f0cca9b0 | operation.financial.financialResult.paymentPerPeriod |
| Interes quincenal | No FIELD in saved layout | None; rate exists but has no placed element |
| Total de intereses | b2fdf4c8-3939-4f42-81c1-71fbfe8da8a9 | operation.financial.financialResult.interest |
| Total a pagar | 7a7ba8a5-5f2d-495c-8c2f-bbffd66e427a | operation.financial.financialResult.total |

Architect review of the candidate: APPROVED for the authorized focal release.
No new authority, reader privilege or business write. No frontend changes; UI
preservation verified by unchanged app files. Known limitation: the existing
background's interest-rate label is intentionally retained without inventing a FIELD.
Historical PDF bytes remain unchanged; opening an old READY record does not regenerate
it. Next action: publish the verified renderer, append/activate the two-binding
correction, verify readback and stop. Live release verification remains pending.

## Published result — PASS

- Code commit: `b851a2a` (push to main PASS).
- Pages workflow `36569212783`: SUCCESS; existing Membership contract workflow
  `36569212387`: SUCCESS. No financial test suite rerun.
- Edge `document-generation` v11 ACTIVE. All five deployed source modules extracted
  in memory from ESZIP match the published candidate. No worker-key rotation.
- New active layout version 3: `54c1ac2f-7108-43b2-8e35-04c27c8040ca`;
  activation `f9bfa420-e5b7-4acd-a761-5695c31af5b9`. Exactly two bindings changed;
  all 16 element geometries and remaining properties equal the previous definition.
- Existing WRITE gate verified the principal administrator who created the design
  and approved the operation. Existing service persistence appended SAVE/ACTIVATE;
  separate OWNER_DIRECTED_BINDING_REPAIR audit identifies the owner-authorized
  management channel. Fixed IDs make the correction idempotent; lock and baseline
  assertions prevent overwriting a concurrent design. Existing versions retained.
- Transaction checked all existing READY records byte-for-byte at row level;
  readback also confirmed the supplied document's PDF hash and snapshot hash unchanged.
- Security postflight: ten forced-RLS tables, one existing cron, two existing business
  triggers; browser worker/persistence and anonymous context/command remain denied;
  anonymous Edge ACCESS returns 401. No business or Storage writes by this task.
- sutiapp.com and GitHub Pages: HTTP 200; unchanged bundle v303 SHA256
  `4033308e40846949b68e703d6276768e0752904da4e474071fa9d28fbb4d875b`
  equals the committed artifact. Frontend build passed without changing generated files.

SIGNERS 3-COLUMN: PASS. SIGNERS KEEP-TOGETHER: PASS.
UNNECESSARY PAGE 2: 0 in the corrected same-layout synthetic render.
PAGE-1 CONTENT DUPLICATED: 0 on automatic continuations (body outside clipped bands).
NEW OVERLAPS: 0. PREVIEW/PDF PARITY: PASS for identical content and coordinates.
NULL CLABE: EXPECTED in both the sealed snapshot and original deposit source.
PERMANENT QA FILES ADDED: 0. PERMANENT QA PDFs: 0. QA RESIDUAL DATA: 0.
PDF/Screenshot files written: 0. Real signatures downloaded: 0.
Build/tests/security/source-of-truth/invariants: PASS. Legacy writes: 0.
Unexpected changed files: 0; unrelated dirty root workspace preserved.

Limitations: `Interes quincenal` is a static label with no configured FIELD; the
existing rate was not placed automatically. The isolated control stays where the
owner positioned initial_1. The original two-page PDF remains historical; the existing
**Emitir version corregida** action produces a separate revision using the active
layout without authorizing the financial operation again. This task generated no
new production PDF and did not automatically reissue historical records.

Final architect review: APPROVED. One documentary authority, unchanged security and
financial writers; no new infrastructure or architecture-registry dependency.
Owner decision required: NO for the completed scope. Next instruction: stop after
the diagnosis/correction result; do not move fields, add the absent rate element,
or reissue any historical document automatically.
