begin;
-- Fail-safe recovery: stop every new profile mutation/approval without deleting current values, audit, or snapshots.
revoke execute on function public.update_affiliate_admin_profile(uuid,integer,jsonb,text) from authenticated;
revoke execute on function public.set_financial_program_request_terms(uuid,numeric,numeric,text) from authenticated;
revoke execute on function public.approve_financial_program_request(uuid,jsonb,uuid) from service_role;
delete from public.admin_role_permissions where permission='affiliates.write';
update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),updated_at=now();
notify pgrst, 'reload schema';
commit;
