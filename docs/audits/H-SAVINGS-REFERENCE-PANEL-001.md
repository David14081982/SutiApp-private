# H-SAVINGS-REFERENCE-PANEL-001

## PRE-CHANGE AUDIT

Status: PASS for the bounded implementation below; financial cutover remains unproven.

Authorization: owner requests integration of the attached mobile Ahorro design in the existing administrative route, responsive desktop, real per-Folio data, and an explicit final list of omissions. Subsequent direct clarification: correction observations are OPTIONAL. Rejection reasons and exceptional opening/date justifications remain required by their distinct rules.

Navigator: check and lookup ahorro completed. Registry stale only for three prior withdrawal evidence files, with no changed runtime files relative to the recorded graph. Directed discovery inspected the two extracted reference screen modules, reference store, current Savings route/repositories, foundation schema, private review 005–009, and pending operations 001–004. No reference store is a production authority.

Scope: existing SavingsAdminModule route; reconstruct the approved four-tab screen and detail; server-side private review read model, search, pagination, aggregates, dated history, review/correction commands. Preserve access administration and original source review. Authorizations cannot turn imported history into a second payout. Any operation that requires financial certification must enforce that boundary in the server and expose the actual reason in the UI.

Files: new app/savings-panel-repository.js, app/savings-panel-admin.jsx, app/savings-panel-reference.jsx; focal export integration in app/screens-admin-savings.jsx; scripts/build-bundle.js and generated app/bundle.js; new migration/recovery 20260906001000_savings_reference_panel; focal panel audit/browser/live test scripts; this audit and docs/qa/evidence/savings-reference-panel-20260906; delivery cache identifiers only if a verified release is made; derived architecture registry for new modules/RPCs. Existing unrelated local changes must survive byte-for-byte. Expanding into financial canonical activation requires a further evidenced audit, not a blind application of pending migrations.

Outside scope: Google Sheets formulas/scripts/writes, financial public reader/cutover, identity reassignment, deletion of historical data, unrelated screens/Auth/Storage, invented yield, PDF generation. The reference is a visual specification, not an instruction to execute its seeds or client financial formulas.

## Source mapping before implementation

| Visual element | Actual authority | Field/calculation | Access |
|---|---|---|---|
| Saver list and name | savings_review_records / affiliates | Ahorro rows; exact original source_folio = numero_control; savings_review_identity retains DUPLICADO/SIN REGISTRO | Paginated read |
| Recognized balance | immutable Ahorro import in savings_review_records | source_data.Q; review changes shown separately; never credit DT again | Derived review display |
| Contribution/status/start | same record | R / W / F, with X separately retained as plan start; proposals are private corrections | Read / allowed proposal write |
| Dated deductions | same record / field_defs | AA:DO with explicit historical/future labels; AR includes DT; no wall-clock promotion of projected values | Paginated read / correction proposal |
| Withdrawals | savings_review_records | Exact original Folio, source_sheet Solicitud de retiro, D date / G amount / H status; one row per request | Read / private review |
| Amount-change requests | savings_review_records / savings_requests | Imported requests separate from canonical requests; no inferred duplicate or paid status | Read / authorized workflow only |
| Received vs expected | captured dated receipts / certified contribution_plans + overrides | Original dated value is observed data, not proof that projected amount was collected; absent historical plan means expected amount unknown | Derived |
| Yield | imported DQ/DT and canonical credited allocations | Recorded amounts only; annual totals not new credits; no assumed 6% | Read |
| Review issues and audit | savings_review_records.issues/status / savings_review_events | Existing backend review state, before/after, authenticated actor, timestamp, optional observation | Read/write |
| Admin access | admin_section_responsibilities + savings_admin_access_mode | Existing savings.read/review edit checks; financial approve remains separate | Existing manager RPC |

Risks: zero/blank distinction, unknown historical expected contribution, projected versus received values, AR double counting, multiple source records, missing Folios, stale responses, dual writers, historical request replay. Controls: immutable source; exact original identity; explicit provenance/cutoff; transaction locks/version/idempotency; no whole-padron browser aggregation; server authorization; no runtime fixture fallback.

Recovery: additive functions revoked/dropped after frontend rollback; private proposal/history authority retained; no source rewrites, balance posting, delete or canonical activation. Test migrations in ROLLBACK before application. Take financial/source fingerprints before and after.

Scope refinement before edit: app/savings-review-admin.jsx gains an optional read-only presentation prop used only when opened as the new panel's historical archive. Existing consumers keep their current behavior. This prevents archived derived fields from becoming editable through the new screen; it changes no backend permission or source authority. The new affiliate-entry RPC resolves the existing UUID to the original Folio on the server and preserves ambiguous choices.

Scope refinement before edit: app/savings-withdrawal-list.jsx accepts an explicit, parent-ID-checked result from the same withdrawal RPC already included in the detail response. The new panel supplies it and its refresh callback; existing readers continue using their original RPC path. This removes a duplicate request and preserves the withdrawal page while a correction is refreshed. It is a query-result prop, not a cache or fallback authority.

Verification plan: live rollback permission/identity/search/pagination/derived arithmetic/concurrent-version/idempotency tests; private five-row reconciliation before mutation; browser interaction/load/error/retry/pagination/responsive/keyboard tests and reference screenshots; targeted production artifact validation only after passing local checks. Real device/session coverage reported accurately. No PASS for the entire request while approved functionality remains unimplemented or financially blocked.

Registry refinement: the automatic classifier assigned the new repository to identity because it contains Folio checks. Add explicit finance-domain entries for only SavingsPanelRepository and SavingsPanelAdmin in architecture-overrides.json; these describe demonstrated code and the private review boundary, and do not change any runtime authority.
