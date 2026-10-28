-- Retire UI readers only; safety guards and immutable cases/events are retained.
-- Restore the prior Edge/frontend before retiring these readers; the new Edge
-- intentionally fails closed if its review RPC is unavailable.
-- Restoring credit while cases remain pending is not an operational rollback.
begin;
set local lock_timeout='2s';
revoke execute on function public.get_self_loan_historical_review(),public.list_admin_loan_historical_reviews(uuid) from authenticated;
commit;
