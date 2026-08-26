begin;
drop policy if exists affiliates_select_effective on public.affiliates;
create policy affiliates_select_own on public.affiliates for select to authenticated using ((select auth.uid()) = auth_user_id);
drop function if exists public.search_affiliates_for_impersonation(text);
drop function if exists public.get_effective_affiliate_id();
drop function if exists public.get_impersonation_context();
drop function if exists public.stop_affiliate_impersonation();
drop function if exists public.start_affiliate_impersonation(uuid,text);
drop function if exists public.claim_affiliate_identity();
alter table public.admin_audit_log drop column if exists reason, drop column if exists impersonation_session_id, drop column if exists usuario_contexto_affiliate_id;
create or replace function public.audit_admin_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare row_data jsonb; target text;
begin
  if (select auth.uid()) is null then return coalesce(new, old); end if;
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target := coalesce(row_data->>'id', row_data->>'company_id', row_data->>'asset_id', row_data->>'asset_key');
  insert into public.admin_audit_log(actor_auth_user_id, resource, action, target_id, result)
  values ((select auth.uid()), tg_table_name, tg_op, target, 'SUCCESS');
  return coalesce(new, old);
end;
$$;
drop table if exists public.impersonation_sessions;
drop table if exists public.identity_audit_log;
do $$
declare affected integer;
begin
  if (select count(*) from public.admin_assignments where enabled and role='visual_admin' and 'affiliates.read'=any(permissions) and 'affiliates.impersonate'=any(permissions)) <> 1 then
    raise exception 'RECOVERY_REQUIRES_EXACTLY_ONE_PHASE1_ADMIN';
  end if;
  update public.admin_assignments set permissions=array_remove(array_remove(permissions,'affiliates.read'),'affiliates.impersonate')
  where enabled and role='visual_admin' and 'affiliates.read'=any(permissions) and 'affiliates.impersonate'=any(permissions);
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'RECOVERY_PERMISSION_RECONCILIATION_FAILED'; end if;
end $$;
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array['assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write','documents.read','documents.write']::text[]);
commit;
