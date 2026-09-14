# H-SAVINGS-SELF-JOIN-001

AUDIT → AUTHORITY → PLAN → RISK → IMPLEMENT → VERIFY → EVIDENCE

Owner authorizes new self-service Savings registrations in Supabase while existing balances remain PRIVATE. Day 10 was explicitly withdrawn as a typo. Existing calendar authority is savings_next_contribution_date: JUB day5, others15/30, February15/28; first eligible date on/after server-local request date+30 days. Admin approval remains the existing operation; request projections are predictions, not received money.

Scope: new 20260914000100_savings_self_join migration/recovery, get_self_savings_join_context RPC, existing Savings runtime JOIN gate only; app/savings-repository.js, app/screens-savings.jsx, app/savings-request-form.jsx; focal tests/test scripts; build-savings-release.js baseline, bundle and cache versions only; Savings authority/decision/changelog and derived architecture entries. No Google writes, no existing balance publication, no other program, global Auth or Storage changes.

Authority: affiliates exact Folio/category; savings_requests immutable submitted timestamp/amount/process; approved savings_enrollments/contribution_plans through existing Admin approval. Context and preview are derived on the server, not a new store. Requests use existing actor/context and idempotency. Unknown category, duplicates, unresolved historical opening and closed intake remain visible denials. No history deletion or balance certification at install.

UI contract: preserve existing empty Savings card, button, header, close/refresh, sheets and CSS. Connect JOIN only. Show requested amount, registration/first-discount dates and future schedule within the existing sheet/card. Other actions retain publication gate. Optional observations remain optional.

Risk: accidentally opening other actions, mismatching person/calendar, stale previews, duplicate submission, presenting forecast as balance. Verify PRIVATE remains unchanged, direct self JOIN only, exact Folio, category matrix, calendar edge dates, retries, per-user isolation, Admin approval creates plan without cash, mobile/desktop navigation and no unrelated bundle changes.

Recovery: restricted backup of prior runtime function; restore it and drop only new read RPC, preserve any new business registrations. All financial fixtures ROLLBACK before additive installation; exact installed definition checked before apply.

Status: implementation authorized; no publication authorized.

Integration audit extension: submit_self_savings_join validates the expected effective affiliate before using the existing runtime writer. JOIN invalidates only its memory cache without clearing the displayed balance/store mid-submit, because joining creates no money; the existing request sheet refreshes its own registration context after save. Add real Repository/Store browser integration to verify loading and confirmation, plus response identity guards. No shared store change. Recovery drops both new self RPCs and restores the prior runtime gate.
