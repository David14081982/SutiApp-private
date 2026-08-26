begin;

do $$
declare changed integer;
begin
  update public.loan_term_policy
  set custom_min_term=1,
      decision_reference='OWNER_DECISION_2026-08-24_CUSTOM_MIN_1',
      updated_at=now()
  where id='primary' and enabled and standard_terms=array[6,12,18,24]
    and custom_min_term=6 and custom_step=1;
  get diagnostics changed=row_count;
  if changed<>1 then
    raise exception 'LOAN_TERM_POLICY_PRECONDITION_FAILED';
  end if;
end $$;

comment on table public.loan_term_policy is 'Owner-approved selectable-term UX policy: suggested 6/12/18/24 and custom 1..Google maximum; Google remains authority for rate, amount and per-fund maximum.';

commit;
