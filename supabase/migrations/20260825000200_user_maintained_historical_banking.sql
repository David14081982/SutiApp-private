begin;

alter table public.affiliate_bank_accounts
  alter column account_holder drop not null,
  alter column bank_name drop not null,
  add column data_status text not null default 'COMPLETE',
  add column incomplete_fields text[] not null default '{}'::text[],
  add column source_kind text not null default 'USER_MAINTAINED',
  add column source_file_hash text null,
  add column source_row_ordinal integer null,
  add column seeded_at timestamptz null,
  add column user_maintained_at timestamptz null;

alter table public.affiliate_bank_accounts
  drop constraint affiliate_bank_holder_check,
  drop constraint affiliate_bank_name_check,
  drop constraint affiliate_bank_identifier_check,
  add constraint affiliate_bank_holder_check check(account_holder is null or length(btrim(account_holder)) between 2 and 160),
  add constraint affiliate_bank_name_check check(bank_name is null or length(btrim(bank_name)) between 2 and 100),
  add constraint affiliate_bank_status_check check(data_status in('COMPLETE','INCOMPLETE_HISTORICAL_DATA')),
  add constraint affiliate_bank_incomplete_fields_check check(incomplete_fields <@ array['account_holder','bank_name','clabe','account_number']::text[]),
  add constraint affiliate_bank_source_check check(source_kind in('USER_MAINTAINED','HISTORICAL_SEED')),
  add constraint affiliate_bank_provenance_check check(
    (source_kind='USER_MAINTAINED' and source_file_hash is null and source_row_ordinal is null and seeded_at is null)
    or (source_kind='HISTORICAL_SEED' and source_file_hash ~ '^[A-F0-9]{64}$' and source_row_ordinal > 0 and seeded_at is not null)
  ),
  add constraint affiliate_bank_complete_check check(
    (data_status='COMPLETE' and account_holder is not null and bank_name is not null and account_number is not null and cardinality(incomplete_fields)=0)
    or (data_status='INCOMPLETE_HISTORICAL_DATA' and source_kind='HISTORICAL_SEED' and (bank_name is not null or clabe is not null or account_number is not null))
  );

create unique index affiliate_bank_historical_source_idx
  on public.affiliate_bank_accounts(source_file_hash,source_row_ordinal)
  where source_kind='HISTORICAL_SEED';

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write',
  'authorization.read','authorization.write','segmentation.read','segmentation.write',
  'workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','bank_accounts.read'
]::text[]);
insert into public.admin_role_permissions(role_id,permission)
select id,'bank_accounts.read' from public.admin_roles where code='principal_admin' on conflict do nothing;
update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),updated_at=now() where a.enabled;

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','bank_accounts.read'];
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
  insert into public.admin_role_permissions(role_id,permission) select v_id,p from (select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=v_id),updated_at=now() where role_id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS');
  return v_id;
end $$;

create or replace function public.save_affiliate_bank_account(p_id uuid,p_holder text,p_bank text,p_clabe text,p_account text,p_primary boolean)
returns public.affiliate_bank_accounts language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid;v_row public.affiliate_bank_accounts%rowtype;v_action text; begin
  v_affiliate:=public.get_effective_affiliate_id();
  if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_holder,''))) not between 2 and 160 or length(btrim(coalesce(p_bank,''))) not between 2 and 100
    or coalesce(p_account,'') !~ '^[0-9]{4,20}$' or (p_clabe is not null and p_clabe<>'' and p_clabe !~ '^[0-9]{18}$')
  then raise exception 'INVALID_BANK_ACCOUNT' using errcode='22023'; end if;
  if p_id is null then
    insert into public.affiliate_bank_accounts(affiliate_id,account_holder,bank_name,clabe,account_number,is_primary,data_status,incomplete_fields,source_kind,user_maintained_at)
    values(v_affiliate,btrim(p_holder),btrim(p_bank),nullif(p_clabe,''),p_account,false,'COMPLETE','{}','USER_MAINTAINED',now()) returning * into v_row;
    v_action:='BANK_ACCOUNT_CREATED';
  else
    update public.affiliate_bank_accounts set account_holder=btrim(p_holder),bank_name=btrim(p_bank),clabe=nullif(p_clabe,''),account_number=p_account,
      data_status='COMPLETE',incomplete_fields='{}',user_maintained_at=now(),updated_at=now()
    where id=p_id and affiliate_id=v_affiliate returning * into v_row;
    v_action:='BANK_ACCOUNT_UPDATED';
  end if;
  if v_row.id is null then raise exception 'BANK_ACCOUNT_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
  values(auth.uid(),v_affiliate,'affiliate_bank_accounts',v_action,v_row.id,jsonb_build_object('has_clabe',v_row.clabe is not null,'has_account',true,'completed',true));
  if p_primary then
    update public.affiliate_bank_accounts set is_primary=false,updated_at=now() where affiliate_id=v_affiliate and is_primary and id<>v_row.id;
    update public.affiliate_bank_accounts set is_primary=true,updated_at=now() where id=v_row.id returning * into v_row;
    insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id) values(auth.uid(),v_affiliate,'affiliate_bank_accounts','BANK_ACCOUNT_SET_PRIMARY',v_row.id);
  end if;
  return v_row;
end $$;

create or replace function public.delete_affiliate_bank_account(p_id uuid) returns boolean language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid;v_deleted uuid; begin
  v_affiliate:=public.get_effective_affiliate_id();if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  delete from public.affiliate_bank_accounts where id=p_id and affiliate_id=v_affiliate returning id into v_deleted;
  if v_deleted is null then raise exception 'BANK_ACCOUNT_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id) values(auth.uid(),v_affiliate,'affiliate_bank_accounts','BANK_ACCOUNT_DELETED',v_deleted);
  return true;
end $$;

create or replace function public.set_primary_affiliate_bank_account(p_id uuid) returns public.affiliate_bank_accounts
language plpgsql security definer set search_path=''
as $$ declare v_affiliate uuid;v_row public.affiliate_bank_accounts%rowtype; begin
  v_affiliate:=public.get_effective_affiliate_id();if auth.uid() is null or v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.affiliate_bank_accounts where id=p_id and affiliate_id=v_affiliate and data_status='COMPLETE') then raise exception 'COMPLETE_BANK_ACCOUNT_REQUIRED' using errcode='22023'; end if;
  update public.affiliate_bank_accounts set is_primary=false,updated_at=now() where affiliate_id=v_affiliate and is_primary and id<>p_id;
  update public.affiliate_bank_accounts set is_primary=true,updated_at=now() where id=p_id and affiliate_id=v_affiliate returning * into v_row;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id) values(auth.uid(),v_affiliate,'affiliate_bank_accounts','BANK_ACCOUNT_SET_PRIMARY',v_row.id);
  return v_row;
end $$;

revoke execute on function public.set_primary_affiliate_bank_account(uuid) from public,anon;
grant execute on function public.set_primary_affiliate_bank_account(uuid) to authenticated;
drop policy bank_accounts_self_read on public.affiliate_bank_accounts;
create policy bank_accounts_owner_or_capability_read on public.affiliate_bank_accounts for select to authenticated
using(affiliate_id=public.get_effective_affiliate_id() or public.has_admin_permission('bank_accounts.read'));
drop policy sensitive_audit_admin_read on public.sensitive_change_audit;
create policy sensitive_audit_admin_read on public.sensitive_change_audit for select to authenticated
using(public.has_admin_permission('documents.read') or public.has_admin_permission('bank_accounts.read'));

comment on table public.affiliate_bank_accounts is 'Supabase productive authority. Historical Excel is provenance-only seed input and never runtime.';
commit;
