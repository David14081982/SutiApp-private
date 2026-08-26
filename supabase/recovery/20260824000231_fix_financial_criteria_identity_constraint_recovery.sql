begin;

do $$
begin
  if exists(select 1 from public.financial_criteria_visibility_audit where length(criterion_identity) < 80) then
    raise exception 'RECOVERY_BLOCKED_PRESERVE_SHORT_VALID_IDENTITY_HISTORY';
  end if;
end $$;

alter table public.financial_criteria_visibility_audit
  drop constraint financial_criteria_visibility_audit_criterion_identity_check;

alter table public.financial_criteria_visibility_audit
  add constraint financial_criteria_visibility_audit_criterion_identity_check
  check (length(criterion_identity) between 80 and 160);

commit;
