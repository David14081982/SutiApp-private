begin;

do $$
begin
  if exists(
    select 1 from public.program_requests
    where requested_term between 1 and 5
  ) then
    raise exception 'RECOVERY_BLOCKED_CUSTOM_TERM_REQUESTS_EXIST';
  end if;
  if not exists(
    select 1 from public.loan_term_policy
    where id='primary' and enabled and standard_terms=array[6,12,18,24]
      and custom_min_term=1 and custom_step=1
      and decision_reference='OWNER_DECISION_2026-08-24_CUSTOM_MIN_1'
  ) then
    raise exception 'LOAN_TERM_POLICY_RECOVERY_PRECONDITION_FAILED';
  end if;
end $$;

update public.loan_term_policy
set custom_min_term=6,
    decision_reference='OWNER_DECISION_2026-08-24',
    updated_at=now()
where id='primary';

comment on table public.loan_term_policy is 'Owner-approved selectable-term UX policy; Google remains the authority for rate, amount and per-fund maximum term.';

commit;
