# ARCHITECT REVIEW

Task reviewed: H-HISTORY-IMMEDIATE-APPROVAL-001, implementation candidate and installed backend, before frontend publication.

Verdict: APPROVED for the reviewed implementation and continuation through the already-authorized release gates. This is not a declaration that frontend publication or the complete H is finished.

Reviewer: Codex independent agent `/root/approval_safety_review`, 2026-10-26. The reviewer did not implement the feature, deploy infrastructure, access production credentials, create a production approval, or change business data. The only reviewer-authored file is this report.

## Scope and authority

The owner explicitly requested immediate approval presentation for the affected user, the first 24 hours in Aprobadas even with blank X, real source status after expiry, unchanged daily/manual synchronization, and independent amortization updates. The existing confirmed Finance decision and immutable approval display fields are the authority for the new card presentation. The published Google observation remains the authority for quotas, paid amounts, balances and real loan status. No new financial authority or Google writer is introduced.

Reviewed the focused audit, actual product and migration/recovery diffs, applicable governance and current authorization, source/test files, local SQL/browser evidence, and backend installation/parity receipts. `docs/WORK_QUEUE.md` is the historical master-plan queue; `docs/WORK_QUEUE_HISTORY.md` is absent. Neither expands this task or authorizes a productive test loan or a different H. Current direct owner authorization governs this narrow correction. This report does not certify unrelated historical work recorded in the repository.

## What Codex did correctly

- Uses an own metadata RPC with no owner argument. The existing authenticated effective-identity resolver and exact unique active Folio remain the backend boundary.
- Publishes only `affiliate_id` and an opaque revision in the new signal table. Forced RLS, authenticated own SELECT, and denied browser/service writes preserve isolation. The trigger is the only writer.
- Emits a changed revision only for the affected affiliate(s), after the approval transaction commits. No-op/handoff edits do not update that revision. There is no Google call, schedule generation, global publication update, cron change or financial DML in the trigger.
- Returns an allowlist of immutable approval display fields. The approval response has no installment array. Existing loans retain their published financial values and schedules.
- Preserves the original approval clock. Settled source states remain Liquidadas; active states become En pago on expiry; blank/unknown states become Estado por revisar instead of inventing a repayment status.
- Uses separate approval and snapshot request guards, coalesces revisions, discards responses from previous identities, purges on access denial, and retains an open amortization/scroll during an approval update.
- Preserves the existing verified sourceId link across SR-to-loan publication. Ambiguous links are not guessed by names, dates or amounts.
- Saves the exact previous SQL context definition/OID/owner/ACL and rejects recovery if the installed function drifted. Recovery removes only new metadata infrastructure after frontend/Edge rollback; no business history is removed.

## Important finding and resolution

The first review found a real subscription gap: SUBSCRIBED could arrive while LOAD was pending, and both the subscription check and final LOAD completion skipped revision reconciliation. A committed approval in that interval would remain invisible until a later foreground/remount.

The reviewer reproduced the defect with the actual repository in an isolated VM: one LOAD, zero metadata reads, missed approval. The corrected implementation remembers a pending subscription reconciliation and consumes it after the in-flight request. It also verifies the channel instance to reject stale subscription callbacks.

Independent repeat against the corrected source produced:

```json
{"status":"PASS","actions":["LOAD","APPROVALS"],"metadataReads":1,"ownApprovalShown":true,"noScheduleReload":true}
```

This is one lightweight revision read and one approval payload, with no second LOAD. The dedicated browser suite also covers the initial and refresh subscription gaps at 320, 390 and 1440 px. The earlier NEEDS_FIX finding is resolved.

## Evidence examined

- `db.json`: 15 local PostgreSQL groups pass, including actual migration/recovery, RLS/grants, exact-control isolation, atomic commit, targeted changes, no-op suppression, removal, owner transfer, missing/archived/ambiguous identities, cascade safety and preserved business/global state.
- Dedicated browser evidence: own signal, duplicate revision, no schedule reload, financial-value preservation, blank/settled states, sourceId continuity, scroll, revocation, lightweight retry, malformed payload, coalesced races, expiry without polling, missed revision recovery, identity separation and denial purge; all pass at 320/390/1440 px.
- Existing history browser evidence: filters, monetary progress, quota rules, numbering, PDF download, metadata resume, no polling, errors, assistance-context cycles and source deletion remain passing. The 210-row PDF case is exercised at 390 px; the other viewport fixtures intentionally contain fewer rows.
- Private `database-install.json`: installed migration hash matches the reviewed source; business rows and observations are exactly preserved; global state/publication/cron unchanged; no Google operation.
- Private `deployment-proof.json`: Edge version 6, JWT enabled, three deployed modules AST-equivalent to reviewed sources, anonymous request rejected with 401.
- Private `database-verified.json`: forced RLS/own grants and original context backup verified; existing identity/snapshot functions and daily cron preserved. Read-only inspection of the affected case with the shipped projectors returns one Aprobadas, two No aprobadas and 12 quota rows. Its approval payload is 347 bytes versus 2,882 bytes for the complete history; these are measured example payload sizes, not a network-latency or universal-size guarantee.
- Independent source comparisons against HEAD confirm unchanged PDF generator, history screen, Edge entry point, synchronization Edge/worker, snapshot source parser, and previous two history migrations.

No employee name, business control, request/loan identifier, amount, credential or private record payload is included in this report.

## Reviewed source fingerprints

SHA-256 below uses UTF-8 with CRLF normalized to LF, except the explicitly labeled browser hash.

| Source | SHA-256 |
| --- | --- |
| history-loans-repository.js | `37f33184c22dbf222433c44617c883c17cd8310213d07b12e02f6cb4e61db748` |
| history-loans-repository.js, raw browser-tested bytes | `09abbc948feed7528676d41972a018750ccbe8eacc076adec14cdf649fa3d39b` |
| history-loans.jsx | `fa971c1f39acf8966293253f5fa089a166b2866fa6a78b0d1310ebec0f4843ff` |
| loan-history/history.mjs | `23cff1a868dc2915a28d54157f7187079e94e4098e4c00b4c75b98973103d94a` |
| loan-history/snapshot.mjs | `e74305afd9d2853a27fe2f075cf93b11f6d3230dcd9ff7db61beef08cdc19d30` |
| 20261026000200 migration | `ee422be13eb497c4eae27a7e68a06f6637abfea1f5500ad7fee344055aec26d1` |
| 20261026000200 recovery | `6f6092d5ec8c50515fe622b6399a50f4e2fee62832ae2094b92ae48c2036d1b1` |

## Problems detected and limits

No unresolved implementation blocker remains in the reviewed sources. Frontend bundle generation/parity, final Registry reconciliation and public frontend publication were still in progress when this review was signed. Their final receipts must be checked before declaring the entire H complete or telling the owner the frontend is published.

The websocket transport was exercised in isolated browser tests. No real financial approval was created solely to test realtime delivery. Production evidence verifies the installed SQL/RLS and Edge, preserved existing records, and read-only projection of the existing affected case. It does not claim a newly approved productive loan or a measured end-to-end delivery SLA.

The reviewer did not modify legacy systems, approve a new financial rule, or authorize new work. Registry output is derived evidence and cannot supersede the reviewed code/SQL/RLS.

Architecture implications: one additive own approval revision/RPC and a separate presentation channel; unchanged independent amortization publication.

Source-of-truth implications: SAFE within the explicit owner-authorized approval presentation exception; no installment/balance fallback.

Security implications: PASS for the reviewed backend boundary and isolated cross-context tests; no frontend credential or service-role exposure.

Data implications: reviewed installation receipts preserve business/source data; recovery and synthetic deletion tests do not authorize production deletion.

Owner decision required: NO.

Recommended next action: finish only the remaining build/Registry/publication verification for this H, preserving the reviewed source fingerprints and publication evidence.

# RESPONSE TO CODEX

Approve the reviewed implementation candidate; the subscription-gap defect is fixed. Complete the existing authorized release: finalize Registry evidence, generate the focal bundle, verify that unrelated chunks and protected sources remain unchanged, run required Pages/PWA/build checks, publish the exact reviewed commit, and verify the served artifacts. Do not claim frontend publication or complete-H PASS until those receipts exist. Do not create a productive test approval, force a global synchronization, change Google, alter financial values, or start another H. This review does not substitute for task-orchestrator authority; no independent queue advancement is authorized.

# SUTIAPP ARCHITECT REVIEW

Task: H-HISTORY-IMMEDIATE-APPROVAL-001 implementation/backend release candidate.

Verdict: APPROVED for reviewed scope; final frontend release acceptance pending.

Critical findings: subscription reconciliation gap reproduced independently and resolved; no unresolved blocker in reviewed code.

Source of truth: approved decision display separate from authoritative published amortization.

Architecture: focal additive metadata channel; unchanged shared identity and daily/manual source workflows.

Security: exact effective identity, forced own RLS, no caller owner selector, protected recovery.

Data: no financial/historical value changes in reviewed implementation or installation receipts.

Legacy: no Google changes or extra source reads from approval events.

Owner decision: NO.

Next action: complete and verify the already-authorized frontend release; only then close the H.

Response generated for Codex: YES.

Signed: `/root/approval_safety_review` — independent Codex reviewer, 2026-10-26.
