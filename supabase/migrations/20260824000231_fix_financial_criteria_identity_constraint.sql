begin;

alter table public.financial_criteria_visibility_audit
  drop constraint financial_criteria_visibility_audit_criterion_identity_check;

alter table public.financial_criteria_visibility_audit
  add constraint financial_criteria_visibility_audit_criterion_identity_check
  check (criterion_identity ~ '^CRITERIA_V1:[0-9]+:[A-F0-9]{64}$');

commit;
