begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Owner-authorized zero-month enrollment access; no financial data mutation.
do $patch$
declare before_def text; after_def text;
begin
 select pg_get_functiondef('public.savings_loan_eligibility(uuid)'::regprocedure) into before_def;
 if strpos(before_def,$old$elsif first_deduction is null or first_deduction>today then why:='NO_ACTUAL_DEDUCTION';$old$)=0 then raise exception 'SAVINGS_ZERO_MONTH_DEFINITION_DRIFT'; end if;
 after_def:=replace(before_def,$old$elsif first_deduction is null or first_deduction>today then why:='NO_ACTUAL_DEDUCTION';$old$,$new$elsif (first_deduction is null or first_deduction>today)
   and not coalesce(p.minimum_months=0 and p.starts_from='ENROLLMENT',false) then why:='NO_ACTUAL_DEDUCTION';$new$);
 insert into public.savings_loan_function_backup(signature,definition,installed_definition)
 values('public.savings_loan_eligibility(uuid):20260923000300',before_def,after_def);
 execute after_def;
end $patch$;
update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='SAVINGS_ZERO_MONTH_ACCESS_CHANGED'
where invalidated_at is null and session_purpose='LOAN';
commit;
