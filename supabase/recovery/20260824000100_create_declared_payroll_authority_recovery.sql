begin;

do $$
begin
  if to_regclass('public.affiliate_payroll_declarations') is not null and
     exists(select 1 from public.affiliate_payroll_declarations) then
    raise exception 'RECOVERY_BLOCKED: export and preserve declared payroll rows before removing this authority';
  end if;
end;
$$;

drop function if exists public.get_current_declared_payroll_impact(numeric);
drop function if exists public.save_current_declared_payroll(numeric,numeric,integer);
drop function if exists public.get_current_declared_payroll();
drop table if exists public.affiliate_payroll_declaration_audit;
drop table if exists public.affiliate_payroll_declarations;

notify pgrst, 'reload schema';
commit;
