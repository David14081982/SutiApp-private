begin;

revoke all on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) from public,anon,authenticated;
revoke all on function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) from public,anon,authenticated,service_role;
drop function if exists public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer);
drop function if exists public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb);
drop function if exists public.normalize_suti_financial_key(text);

notify pgrst, 'reload schema';
commit;
