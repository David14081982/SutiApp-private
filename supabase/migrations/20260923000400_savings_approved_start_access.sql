begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Approval and planned first deduction are distinct; preserve both dates.
do $patch$
declare before_def text; after_def text;
begin
 select pg_get_functiondef('public.savings_loan_eligibility(uuid)'::regprocedure) into before_def;
 if strpos(before_def,$a$or (e.enrollment_started_at at time zone 'America/Hermosillo')::date>today$a$)=0 or strpos(before_def,$b$start_on:=case p.starts_from when 'ENROLLMENT' then (e.enrollment_started_at at time zone 'America/Hermosillo')::date else first_deduction end;$b$)=0
 or strpos(before_def,'and not coalesce(p.minimum_months=0')=0 then
  raise exception 'SAVINGS_APPROVED_START_DEFINITION_DRIFT';
 end if;
 after_def:=replace(replace(before_def,$a$or (e.enrollment_started_at at time zone 'America/Hermosillo')::date>today$a$,$a$or ((e.enrollment_started_at at time zone 'America/Hermosillo')::date>today
      and not coalesce(p.minimum_months=0 and p.starts_from='ENROLLMENT'
        and e.approved_at is not null and e.approved_at<=now(),false))$a$),$b$start_on:=case p.starts_from when 'ENROLLMENT' then (e.enrollment_started_at at time zone 'America/Hermosillo')::date else first_deduction end;$b$,$b$start_on:=case when p.minimum_months=0 and p.starts_from='ENROLLMENT'
    and e.approved_at is not null and e.approved_at<=now()
    then least((e.enrollment_started_at at time zone 'America/Hermosillo')::date,(e.approved_at at time zone 'America/Hermosillo')::date)
    when p.starts_from='ENROLLMENT' then (e.enrollment_started_at at time zone 'America/Hermosillo')::date else first_deduction end;$b$);
 insert into public.savings_loan_function_backup(signature,definition,installed_definition)
 values('public.savings_loan_eligibility(uuid):20260923000400',before_def,after_def);
 execute after_def;
end $patch$;
update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='SAVINGS_APPROVED_START_ACCESS_CHANGED'
where invalidated_at is null and session_purpose='LOAN';
commit;
