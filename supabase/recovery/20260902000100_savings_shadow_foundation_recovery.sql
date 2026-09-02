begin;

-- Recovery for an EMPTY shadow installation only. Once any savings history,
-- configuration or import exists, deleting it would violate data governance.
do $recovery_guard$
declare v_rows bigint;
begin
  select
    (select count(*) from public.savings_import_batches)+
    (select count(*) from public.savings_participants)+
    (select count(*) from public.savings_enrollments)+
    (select count(*) from public.savings_contribution_plans)+
    (select count(*) from public.savings_contribution_overrides)+
    (select count(*) from public.savings_transactions)+
    (select count(*) from public.savings_action_availability)+
    (select count(*) from public.savings_beneficiary_versions)+
    (select count(*) from public.savings_beneficiaries)+
    (select count(*) from public.savings_requests)+
    (select count(*) from public.savings_request_approvals)+
    (select count(*) from public.savings_holds)+
    (select count(*) from public.savings_yield_periods)+
    (select count(*) from public.savings_yield_allocations)+
    (select count(*) from public.savings_process_change_events)+
    (select count(*) from public.savings_legacy_evidence)+
    (select count(*) from public.savings_audit_events)
  into v_rows;
  if v_rows>0 then
    raise exception 'RECOVERY_BLOCKED_SAVINGS_HISTORY_EXISTS' using errcode='55000',
      hint='Preserve history. Prepare an owner-approved archival migration instead of destructive rollback.';
  end if;
end $recovery_guard$;

drop function public.import_savings_shadow_manifest(jsonb,boolean);
drop function public.get_admin_savings_dashboard(uuid);
drop function public.admin_resolve_savings_identity(uuid,uuid,text);
drop function public.admin_credit_savings_yield_period(uuid);
drop function public.admin_save_savings_yield_period(integer,integer,date,date,numeric,jsonb,jsonb,text);
drop function public.admin_release_savings_hold(uuid,text);
drop function public.admin_create_savings_hold(uuid,uuid,text,numeric,text);
drop function public.admin_settle_savings_request(uuid,numeric,numeric,text,uuid);
drop function public.admin_record_savings_request_approval(uuid,text,text,text);
drop function public.admin_review_savings_request(uuid,text,text,date,date,text);
drop function public.admin_review_savings_process_change(uuid,text,date,text);
drop function public.admin_record_savings_process_change(uuid,text,text);
drop function public.materialize_savings_contributions(date);
drop function public.admin_override_savings_contribution(uuid,date,numeric,text,uuid);
drop function public.admin_set_savings_action(text,boolean,text,uuid,text,timestamptz,timestamptz);
drop function public.replace_self_savings_beneficiaries(jsonb,uuid);
drop function public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid);
drop function public.get_self_savings_dashboard();
drop function public.savings_effective_action(text,uuid);
drop function public.generate_savings_schedule(uuid,date,date);
drop function public.savings_participant_balance(uuid);
drop trigger savings_capture_affiliate_process_change on public.affiliates;
drop function public.capture_savings_process_change_from_affiliate();

alter table public.savings_contribution_plans drop constraint savings_plan_source_request_fk;
alter table public.savings_transactions drop constraint savings_transaction_evidence_fk;

drop table public.savings_request_approvals;
drop table public.savings_audit_events;
drop table public.savings_beneficiaries;
drop table public.savings_beneficiary_versions;
drop table public.savings_yield_allocations;
drop table public.savings_yield_periods;
drop table public.savings_process_change_events;
drop table public.savings_holds;
drop table public.savings_contribution_overrides;
drop table public.savings_transactions;
drop table public.savings_legacy_evidence;
drop table public.savings_requests;
drop table public.savings_action_availability;
drop table public.savings_contribution_plans;
drop table public.savings_enrollments;
drop table public.savings_participants;
drop table public.savings_import_batches;
drop function public.reject_savings_history_mutation();

delete from public.admin_role_permissions where permission in('savings.read','savings.write','savings.approve','savings.config','savings.reports','savings.identity_review');

update public.admin_assignments a
set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),updated_at=now()
where a.enabled;

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check(permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read',
  'program_catalog.read','program_catalog.write'
]::text[]);

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read',
  'program_catalog.read','program_catalog.write'];
begin
  if not public.has_admin_permission('authorization.write') then raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
  if p_permissions is null or exists(select 1 from unnest(p_permissions) p where not(p=any(v_allowed))) then raise exception 'INVALID_PERMISSION' using errcode='22023'; end if;
  if p_role_id is null then
    insert into public.admin_roles(code,name,description) values('role_'||replace(extensions.gen_random_uuid()::text,'-',''),btrim(p_name),coalesce(p_description,'')) returning id into v_id;
  else
    if exists(select 1 from public.admin_roles where id=p_role_id and system_role) then raise exception 'SYSTEM_ROLE_IMMUTABLE' using errcode='P0001'; end if;
    update public.admin_roles set name=btrim(p_name),description=coalesce(p_description,''),updated_at=now() where id=p_role_id returning id into v_id;
    if v_id is null then raise exception 'ROLE_NOT_FOUND' using errcode='P0001'; end if;
    delete from public.admin_role_permissions where role_id=v_id;
  end if;
  insert into public.admin_role_permissions(role_id,permission) select v_id,p from(select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=v_id),updated_at=now() where role_id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS');
  return v_id;
end $$;

commit;
