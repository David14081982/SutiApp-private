begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Restore behavior, never delete financial/exception history. Fail closed first.
do $restore$ declare item record; definition text; begin
 for item in select b.signature,b.definition from public.savings_requests_runtime_backup b
 where signature like 'P0_20260920:%' and signature<>'P0_20260920:permissions_constraint' loop execute item.definition;end loop;
 -- Keep capability metadata after business use; removal could hide audit access.
 if not exists(select 1 from public.savings_audit_events where resource in
 ('savings_withdrawal_override','savings_yield_override','savings_settlement_verification')) then
  if exists(select 1 from public.admin_role_permissions p join public.admin_roles r on r.id=p.role_id
    where p.permission in ('savings.withdrawal.override','savings.yield.override') and r.code<>'principal_admin')
    or exists(select 1 from public.admin_section_responsibilities where section_key in ('admin_savings_withdrawal_override','admin_savings_yield_override'))
    or exists(select 1 from public.admin_assignments where permissions && array['savings.withdrawal.override','savings.yield.override']) then
   raise exception 'SAVINGS_EXCEPTION_RECOVERY_ASSIGNED_PERMISSIONS';
  end if;
  delete from public.admin_role_permissions where permission in ('savings.withdrawal.override','savings.yield.override');
  delete from public.admin_section_definitions where section_key in ('admin_savings_withdrawal_override','admin_savings_yield_override');
  select b.definition into definition from public.savings_requests_runtime_backup b where signature='P0_20260920:permissions_constraint';
  alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
  execute 'alter table public.admin_assignments add constraint admin_assignments_permissions_check '||definition;
 end if;
end $restore$;
-- Disable new writes; evidence and restore definitions remain for forward recovery.
revoke all on function public.service_savings_settlement(uuid,uuid,uuid,uuid,text,jsonb,uuid,jsonb),
public.admin_authorize_savings_yield_override(uuid,uuid,text,text,boolean,uuid),public.admin_revoke_savings_exception(bigint,text,uuid),
public.get_admin_savings_settlement_context(uuid) from authenticated,service_role;
notify pgrst,'reload schema';
commit;
