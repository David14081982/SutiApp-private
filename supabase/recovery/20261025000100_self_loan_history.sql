begin;
revoke all on function public.get_self_loan_history_context() from authenticated;
drop function public.get_self_loan_history_context();
-- Approval timestamps, events, requests and Google history are untouched.
commit;
