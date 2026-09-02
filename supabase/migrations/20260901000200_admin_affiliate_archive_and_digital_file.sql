begin;

-- H-ADMIN-AFFILIATE-ARCHIVE-AND-DIGITAL-FILE-001
-- Additive lifecycle state over the existing public.affiliates authority.
-- No affiliate, Auth identity, document, request or historical row is deleted.

create table public.admin_affiliate_archive_migration_state_20260901000200 (
  migration_key text primary key check(migration_key='20260901000200'),
  applied_at timestamptz not null default now(),
  prior_function_definitions jsonb not null check(jsonb_typeof(prior_function_definitions)='object'),
  prior_event_constraint_name text not null,
  prior_event_constraint_definition text not null,
  baseline_counts jsonb not null check(jsonb_typeof(baseline_counts)='object')
);
alter table public.admin_affiliate_archive_migration_state_20260901000200 enable row level security;
alter table public.admin_affiliate_archive_migration_state_20260901000200 force row level security;
revoke all on public.admin_affiliate_archive_migration_state_20260901000200 from public,anon,authenticated;

insert into public.admin_affiliate_archive_migration_state_20260901000200(
  migration_key,prior_function_definitions,prior_event_constraint_name,
  prior_event_constraint_definition,baseline_counts
)
select '20260901000200',jsonb_build_object(
  'claim_affiliate_identity',pg_get_functiondef('public.claim_affiliate_identity()'::regprocedure),
  'start_affiliate_impersonation',pg_get_functiondef('public.start_affiliate_impersonation(uuid,text)'::regprocedure),
  'get_impersonation_context',pg_get_functiondef('public.get_impersonation_context()'::regprocedure),
  'get_effective_affiliate_id',pg_get_functiondef('public.get_effective_affiliate_id()'::regprocedure),
  'search_affiliates_for_impersonation',pg_get_functiondef('public.search_affiliates_for_impersonation(text)'::regprocedure),
  'list_admin_affiliates',pg_get_functiondef('public.list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text)'::regprocedure),
  'find_admin_affiliate_duplicates',pg_get_functiondef('public.find_admin_affiliate_duplicates(jsonb,uuid)'::regprocedure),
  'register_admin_affiliate_document',pg_get_functiondef('public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure)
),c.conname,pg_get_constraintdef(c.oid),jsonb_build_object(
  'affiliates',(select count(*) from public.affiliates),
  'affiliate_admin_events',(select count(*) from public.affiliate_admin_events),
  'affiliate_documents',(select count(*) from public.affiliate_documents),
  'program_requests',(select count(*) from public.program_requests),
  'impersonation_sessions',(select count(*) from public.impersonation_sessions)
)
from pg_constraint c
where c.conrelid='public.affiliate_admin_events'::regclass
  and c.contype='c' and pg_get_constraintdef(c.oid) like '%STATUS_CHANGE%';

do $$ begin
  if (select count(*) from public.admin_affiliate_archive_migration_state_20260901000200)<>1 then
    raise exception 'ARCHIVE_MIGRATION_PREFLIGHT_FAILED' using errcode='P0001';
  end if;
end $$;

alter table public.affiliates
  add column is_archived boolean not null default false,
  add column archived_at timestamptz null,
  add column archived_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  add column archive_reason text null,
  add column archive_previous_status_raw text null,
  add column restored_at timestamptz null,
  add column restored_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  add column restore_reason text null,
  add constraint affiliates_archive_state_check check(
    (is_archived and archived_at is not null and archived_by_auth_user_id is not null
      and length(btrim(archive_reason)) between 8 and 500
      and archive_previous_status_raw is not null)
    or
    (not is_archived and archived_at is null and archived_by_auth_user_id is null
      and archive_reason is null and archive_previous_status_raw is null)
  ),
  add constraint affiliates_restore_state_check check(
    (restored_at is null and restored_by_auth_user_id is null and restore_reason is null)
    or
    (restored_at is not null and restored_by_auth_user_id is not null
      and length(btrim(restore_reason)) between 8 and 500)
  );
create index affiliates_archive_roster_idx
  on public.affiliates(is_archived,archived_at desc,id);

do $$ declare v_name text;
begin
  select prior_event_constraint_name into v_name
  from public.admin_affiliate_archive_migration_state_20260901000200;
  execute format('alter table public.affiliate_admin_events drop constraint %I',v_name);
end $$;
alter table public.affiliate_admin_events
  add constraint affiliate_admin_events_action_check
  check(action in ('CREATE','UPDATE','STATUS_CHANGE','ARCHIVE','RESTORE'));

create or replace function public.get_current_affiliate_access_state()
returns text language sql stable security definer set search_path=''
as $$
  select case
    when exists(
      select 1 from public.impersonation_sessions s
      join public.affiliates a on a.id=s.usuario_contexto_affiliate_id
      where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null
        and s.expires_at>now() and public.is_active_admin() and a.is_archived
    ) then 'ARCHIVED'
    when exists(
      select 1 from public.impersonation_sessions s
      join public.affiliates a on a.id=s.usuario_contexto_affiliate_id
      where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null
        and s.expires_at>now() and public.is_active_admin() and not a.is_archived
    ) then 'ACTIVE'
    when exists(select 1 from public.affiliates a where a.auth_user_id=(select auth.uid()) and a.is_archived) then 'ARCHIVED'
    when exists(select 1 from public.affiliates a where a.auth_user_id=(select auth.uid()) and not a.is_archived) then 'ACTIVE'
    else 'UNLINKED'
  end
$$;

create or replace function public.get_effective_affiliate_id()
returns uuid language sql stable security definer set search_path=''
as $$ select coalesce(
 (select s.usuario_contexto_affiliate_id from public.impersonation_sessions s
  join public.affiliates a on a.id=s.usuario_contexto_affiliate_id and not a.is_archived
  where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null
    and s.expires_at>now() and public.is_active_admin() limit 1),
 (select a.id from public.affiliates a where a.auth_user_id=(select auth.uid()) and not a.is_archived limit 1)
) $$;

create or replace function public.get_impersonation_context()
returns table(session_id uuid,actor_real_auth_user_id uuid,usuario_contexto_affiliate_id uuid,reason text,expires_at timestamptz)
language sql stable security definer set search_path=''
as $$ select s.id,s.actor_real_auth_user_id,s.usuario_contexto_affiliate_id,s.reason,s.expires_at
 from public.impersonation_sessions s
 join public.affiliates a on a.id=s.usuario_contexto_affiliate_id and not a.is_archived
 where s.actor_real_auth_user_id=(select auth.uid()) and s.ended_at is null and s.expires_at>now()
 and public.is_active_admin() limit 1 $$;

create or replace function public.start_affiliate_impersonation(p_affiliate_id uuid,p_reason text)
returns table(session_id uuid,affiliate_id uuid,expires_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare principal uuid:=(select auth.uid());created public.impersonation_sessions%rowtype;v_archived boolean;
begin
  if principal is null or not public.is_active_admin() then raise exception 'ADMIN_DENIED' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<8 then raise exception 'REASON_REQUIRED' using errcode='22023'; end if;
  select a.is_archived into v_archived from public.affiliates a where a.id=p_affiliate_id;
  if v_archived is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_archived then raise exception 'AFFILIATE_ARCHIVED' using errcode='42501'; end if;
  update public.impersonation_sessions s set ended_at=now(),ended_by_auth_user_id=principal
   where s.actor_real_auth_user_id=principal and s.ended_at is null and s.expires_at<=now();
  if exists(select 1 from public.impersonation_sessions s where s.actor_real_auth_user_id=principal and s.ended_at is null) then
    raise exception 'IMPERSONATION_ALREADY_ACTIVE' using errcode='P0001';
  end if;
  insert into public.impersonation_sessions(actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,expires_at)
  values(principal,p_affiliate_id,btrim(p_reason),now()+interval '30 minutes') returning * into created;
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result,details)
  values(principal,p_affiliate_id,'IMPERSONATION_STARTED','SUCCESS',jsonb_build_object('session_id',created.id,'expires_at',created.expires_at,'reason',created.reason,'scope','ASSISTED_AFFILIATE_SERVICE'));
  return query select created.id,created.usuario_contexto_affiliate_id,created.expires_at;
end $$;

create or replace function public.search_affiliates_for_impersonation(p_query text)
returns table(id uuid,numero_control text,display_name text,full_name text,auth_eligibility text)
language plpgsql stable security definer set search_path=''
as $$ begin
 if not public.is_active_admin() then raise exception 'ADMIN_DENIED' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_query,'')))<2 then return; end if;
 return query select a.id,a.numero_control,a.display_name,a.full_name,a.auth_eligibility
 from public.affiliates a where not a.is_archived and (
   a.numero_control ilike '%'||btrim(p_query)||'%' or a.display_name ilike '%'||btrim(p_query)||'%'
   or a.full_name ilike '%'||btrim(p_query)||'%')
 order by a.source_row_ordinal limit 20;
end $$;

create or replace function public.claim_affiliate_identity()
returns uuid language plpgsql security definer set search_path=''
as $$
declare principal uuid:=(select auth.uid());principal_email text;confirmed timestamptz;candidate public.affiliates%rowtype;matches integer;
begin
  if principal is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  select lower(btrim(u.email)),u.email_confirmed_at into principal_email,confirmed from auth.users u where u.id=principal;
  if principal_email is null or principal_email='' or confirmed is null then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='P0001'; end if;
  select count(*) into matches from public.affiliates a
   where a.historical_email_normalized=principal_email and a.auth_eligibility='eligible' and not a.is_archived;
  if matches=0 and exists(select 1 from public.affiliates a where a.historical_email_normalized=principal_email and a.is_archived) then
    raise exception 'AFFILIATE_ARCHIVED' using errcode='42501';
  end if;
  if matches<>1 then raise exception 'AFFILIATE_NOT_UNIQUELY_ELIGIBLE' using errcode='P0001'; end if;
  select * into candidate from public.affiliates a
   where a.historical_email_normalized=principal_email and a.auth_eligibility='eligible' and not a.is_archived for update;
  if candidate.auth_user_id is not null and candidate.auth_user_id<>principal then raise exception 'AFFILIATE_ALREADY_LINKED' using errcode='P0001'; end if;
  update public.affiliates set auth_user_id=principal,updated_at=now()
   where id=candidate.id and not is_archived and (auth_user_id is null or auth_user_id=principal);
  insert into public.identity_audit_log(actor_real_auth_user_id,usuario_contexto_affiliate_id,action,result)
  values(principal,candidate.id,'AFFILIATE_CLAIMED','SUCCESS');
  return candidate.id;
end $$;

create function public.guard_archived_affiliate_new_operation()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  if exists(select 1 from public.affiliates a where a.id=new.affiliate_id and a.is_archived) then
    raise exception 'AFFILIATE_ARCHIVED' using errcode='42501';
  end if;
  return new;
end $$;
create trigger program_requests_guard_archived_affiliate
before insert on public.program_requests for each row
execute function public.guard_archived_affiliate_new_operation();

create function public.archive_admin_affiliate(
  p_affiliate_id uuid,p_expected_updated_at timestamptz,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_reason text:=btrim(coalesce(p_reason,''));
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_ARCHIVE_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='40001'; end if;
  if v_old.is_archived then raise exception 'AFFILIATE_ALREADY_ARCHIVED' using errcode='22023'; end if;
  update public.affiliates set is_archived=true,archived_at=now(),archived_by_auth_user_id=auth.uid(),
    archive_reason=v_reason,archive_previous_status_raw=coalesce(affiliate_status_raw,'Sin estado'),
    restored_at=null,restored_by_auth_user_id=null,restore_reason=null
  where id=p_affiliate_id returning * into v_new;
  update public.impersonation_sessions set ended_at=now(),ended_by_auth_user_id=auth.uid()
   where usuario_contexto_affiliate_id=p_affiliate_id and ended_at is null;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),'ARCHIVE',
    jsonb_build_object('is_archived',false,'affiliate_status_raw',v_old.affiliate_status_raw),
    jsonb_build_object('is_archived',true,'archived_at',v_new.archived_at,'archive_previous_status_raw',v_new.archive_previous_status_raw),
    array['is_archived','archived_at','archived_by_auth_user_id','archive_reason','archive_previous_status_raw'],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $$;

create function public.restore_admin_affiliate(
  p_affiliate_id uuid,p_expected_updated_at timestamptz,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_old public.affiliates%rowtype;v_new public.affiliates%rowtype;v_reason text:=btrim(coalesce(p_reason,''));v_email text;v_eligibility text;
begin
  if not public.has_admin_permission('affiliates.write') then raise exception 'AFFILIATE_WRITE_DENIED' using errcode='42501'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'AFFILIATE_RESTORE_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_old from public.affiliates where id=p_affiliate_id for update;
  if v_old.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='40001'; end if;
  if not v_old.is_archived then raise exception 'AFFILIATE_NOT_ARCHIVED' using errcode='22023'; end if;
  v_email:=v_old.historical_email_normalized;
  v_eligibility:=case when v_email is null then 'missing_email'
    when v_email!~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then 'invalid_email'
    when exists(select 1 from public.affiliates a where a.id<>p_affiliate_id and a.historical_email_normalized=v_email) then 'duplicate_email'
    else 'eligible' end;
  update public.affiliates set is_archived=false,archived_at=null,archived_by_auth_user_id=null,
    archive_reason=null,archive_previous_status_raw=null,restored_at=now(),
    restored_by_auth_user_id=auth.uid(),restore_reason=v_reason,auth_eligibility=v_eligibility,
    auth_ineligibility_reason=case when v_eligibility='eligible' then null else v_eligibility end
  where id=p_affiliate_id returning * into v_new;
  insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
  values(p_affiliate_id,auth.uid(),'RESTORE',
    jsonb_build_object('is_archived',true,'archived_at',v_old.archived_at,'archive_previous_status_raw',v_old.archive_previous_status_raw),
    jsonb_build_object('is_archived',false,'restored_at',v_new.restored_at,'affiliate_status_raw',v_new.affiliate_status_raw,'auth_eligibility',v_new.auth_eligibility),
    array['is_archived','restored_at','restored_by_auth_user_id','restore_reason','auth_eligibility'],v_reason);
  return public.get_admin_affiliate_workbench(p_affiliate_id);
end $$;

create or replace function public.find_admin_affiliate_duplicates(p_values jsonb,p_exclude_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  if jsonb_typeof(p_values)<>'object' then raise exception 'AFFILIATE_VALUES_REQUIRED' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'numero_control',a.numero_control,'name',coalesce(a.full_name,a.display_name,'Sin nombre'),
    'match_state',case when a.is_archived then 'ARCHIVED_MATCH' else 'ACTIVE_MATCH' end,
    'matches',array_remove(array[
      case when nullif(btrim(p_values->>'numero_control'),'') is not null and a.numero_control=p_values->>'numero_control' then 'numero_control' end,
      case when nullif(upper(btrim(p_values->>'rfc_raw')),'') is not null and upper(btrim(a.rfc_raw))=upper(btrim(p_values->>'rfc_raw')) then 'rfc' end,
      case when nullif(upper(btrim(p_values->>'curp_raw')),'') is not null and upper(btrim(a.curp_raw))=upper(btrim(p_values->>'curp_raw')) then 'curp' end,
      case when nullif(lower(btrim(p_values->>'historical_email_raw')),'') is not null and a.historical_email_normalized=lower(btrim(p_values->>'historical_email_raw')) then 'email' end
    ],null)) order by a.source_row_ordinal nulls last,a.created_at),'[]'::jsonb) into v_result
  from public.affiliates a where (p_exclude_id is null or a.id<>p_exclude_id) and (
    (nullif(btrim(p_values->>'numero_control'),'') is not null and a.numero_control=p_values->>'numero_control')
    or (nullif(upper(btrim(p_values->>'rfc_raw')),'') is not null and upper(btrim(a.rfc_raw))=upper(btrim(p_values->>'rfc_raw')))
    or (nullif(upper(btrim(p_values->>'curp_raw')),'') is not null and upper(btrim(a.curp_raw))=upper(btrim(p_values->>'curp_raw')))
    or (nullif(lower(btrim(p_values->>'historical_email_raw')),'') is not null and a.historical_email_normalized=lower(btrim(p_values->>'historical_email_raw'))));
  return v_result;
end $$;

create or replace function public.list_admin_affiliates(
  p_query text default null,p_status text default null,p_auth_linked boolean default null,
  p_document_state text default null,p_has_pending_documents boolean default null,
  p_union_code text default null,p_category_code text default null,p_page integer default 1,
  p_page_size integer default 25,p_sort text default 'name'
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_query text:=lower(btrim(coalesce(p_query,'')));v_page integer:=greatest(coalesce(p_page,1),1);v_page_size integer:=least(greatest(coalesce(p_page_size,25),10),100);v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  if p_document_state is not null and upper(p_document_state) not in('COMPLETE','INCOMPLETE','NOT_CONFIGURED') then raise exception 'AFFILIATE_DOCUMENT_FILTER_INVALID' using errcode='22023'; end if;
  if coalesce(p_sort,'name') not in('name','control','recent') then raise exception 'AFFILIATE_SORT_INVALID' using errcode='22023'; end if;
  with required as(select count(*)::integer required_count from public.document_types where enabled and required_by_default),
  docs as(select d.affiliate_id,count(*) filter(where d.status<>'REJECTED')::integer document_count,count(*) filter(where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED'))::integer pending_document_count,count(distinct d.document_type_id) filter(where d.status='VERIFIED' and t.enabled and t.required_by_default)::integer verified_required_count from public.affiliate_documents d join public.document_types t on t.id=d.document_type_id group by d.affiliate_id),
  requests as(select r.affiliate_id,count(*)::integer request_count,count(*) filter(where r.status in('submitted','in_review','requires_financial_processing'))::integer pending_request_count from public.program_requests r group by r.affiliate_id),
  base as(select a.id,a.numero_control,a.full_name,a.display_name,a.historical_email_raw,a.phone_raw,a.rfc_raw,a.curp_raw,a.affiliate_status_raw,a.affiliation_raw,a.financial_union_code,a.financial_employee_category_code,a.financial_affiliation_status,a.financial_employment_status,a.updated_at,a.record_origin,(a.auth_user_id is not null) auth_linked,coalesce(d.document_count,0) document_count,coalesce(d.pending_document_count,0) pending_document_count,coalesce(d.verified_required_count,0) verified_required_count,required.required_count,case when required.required_count=0 then 'NOT_CONFIGURED' when coalesce(d.verified_required_count,0)>=required.required_count then 'COMPLETE' else 'INCOMPLETE' end document_state,coalesce(r.request_count,0) request_count,coalesce(r.pending_request_count,0) pending_request_count,lower(coalesce(a.full_name,a.display_name,'')) sort_name from public.affiliates a cross join required left join docs d on d.affiliate_id=a.id left join requests r on r.affiliate_id=a.id where not a.is_archived),
  filtered as(select * from base b where (v_query='' or position(v_query in lower(concat_ws(' ',b.full_name,b.display_name,b.numero_control,b.historical_email_raw,b.phone_raw,b.rfc_raw,b.curp_raw)))>0) and (p_status is null or b.affiliate_status_raw=p_status) and (p_auth_linked is null or b.auth_linked=p_auth_linked) and (p_document_state is null or b.document_state=upper(p_document_state)) and (p_has_pending_documents is null or (b.pending_document_count>0)=p_has_pending_documents) and (p_union_code is null or b.financial_union_code=p_union_code) and (p_category_code is null or b.financial_employee_category_code=p_category_code)),
  page_rows as(select * from filtered order by case when p_sort='control' then coalesce(numero_control,'') end,case when p_sort='recent' then updated_at end desc,case when p_sort='name' then sort_name end,sort_name,id offset (v_page-1)*v_page_size limit v_page_size)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)-'sort_name') from(select * from page_rows)x),'[]'::jsonb),'total',(select count(*) from filtered),'page',v_page,'page_size',v_page_size,'filter_options',jsonb_build_object('statuses',coalesce((select jsonb_agg(value order by value) from(select distinct affiliate_status_raw value from public.affiliates where not is_archived and affiliate_status_raw is not null and btrim(affiliate_status_raw)<>'')s),'[]'::jsonb),'unions',coalesce((select jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) from public.segmentation_catalog_entries where catalog_type='union' and enabled),'[]'::jsonb),'categories',coalesce((select jsonb_agg(jsonb_build_object('code',code,'label',label) order by sort_order,label) from public.segmentation_catalog_entries where catalog_type='employment_category' and enabled),'[]'::jsonb))) into v_result;
  return v_result;
end $$;

create function public.list_admin_archived_affiliates(
  p_query text default null,p_page integer default 1,p_page_size integer default 25,p_sort text default 'recent'
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_query text:=lower(btrim(coalesce(p_query,'')));v_page integer:=greatest(coalesce(p_page,1),1);v_page_size integer:=least(greatest(coalesce(p_page_size,25),10),100);v_result jsonb;
begin
  if not public.has_admin_permission('affiliates.read') then raise exception 'AFFILIATE_READ_DENIED' using errcode='42501'; end if;
  if coalesce(p_sort,'recent') not in('name','control','recent') then raise exception 'AFFILIATE_SORT_INVALID' using errcode='22023'; end if;
  with docs as(select affiliate_id,count(*)::integer document_count from public.affiliate_documents group by affiliate_id),requests as(select affiliate_id,count(*)::integer request_count from public.program_requests group by affiliate_id),base as(
    select a.id,a.numero_control,a.full_name,a.display_name,a.historical_email_raw,a.rfc_raw,a.curp_raw,a.affiliate_status_raw,a.archive_previous_status_raw,a.archived_at,a.archived_by_auth_user_id,a.archive_reason,a.updated_at,a.record_origin,(a.auth_user_id is not null) auth_linked,coalesce(d.document_count,0) document_count,coalesce(r.request_count,0) request_count,lower(coalesce(a.full_name,a.display_name,'')) sort_name
    from public.affiliates a left join docs d on d.affiliate_id=a.id left join requests r on r.affiliate_id=a.id where a.is_archived
  ),filtered as(select * from base b where v_query='' or position(v_query in lower(concat_ws(' ',b.full_name,b.display_name,b.numero_control,b.historical_email_raw,b.rfc_raw,b.curp_raw)))>0),page_rows as(
    select * from filtered order by case when p_sort='control' then coalesce(numero_control,'') end,case when p_sort='recent' then archived_at end desc,case when p_sort='name' then sort_name end,sort_name,id offset (v_page-1)*v_page_size limit v_page_size)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)-'sort_name') from(select * from page_rows)x),'[]'::jsonb),'total',(select count(*) from filtered),'page',v_page,'page_size',v_page_size,'filter_options','{}'::jsonb) into v_result;
  return v_result;
end $$;

create or replace function public.register_admin_affiliate_document(
  p_affiliate_id uuid,p_document_type_id uuid,p_storage_path text,p_mime_type text,
  p_file_size bigint,p_sha256 text,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_type public.document_types%rowtype;v_asset public.private_assets%rowtype;v_doc public.affiliate_documents%rowtype;v_replaced uuid;v_path text:=btrim(coalesce(p_storage_path,''));v_reason text:=btrim(coalesce(p_reason,''));v_cleanup_path text;
begin
  if not public.has_admin_permission('documents.write') then raise exception 'ADMIN_DOCUMENT_WRITE_DENIED' using errcode='42501'; end if;
  if auth.uid() is null or not exists(select 1 from public.affiliates where id=p_affiliate_id) then raise exception 'AFFILIATE_NOT_FOUND' using errcode='22023'; end if;
  if length(v_reason) not between 8 and 500 then raise exception 'DOCUMENT_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_type from public.document_types where id=p_document_type_id and enabled;
  if v_type.id is null then raise exception 'DOCUMENT_TYPE_UNAVAILABLE' using errcode='22023'; end if;
  if not v_type.file_upload_allowed or not(p_mime_type=any(v_type.accepted_mime_types)) or p_file_size<1 or p_file_size>v_type.max_file_size_bytes or upper(coalesce(p_sha256,''))!~'^[A-F0-9]{64}$' then raise exception 'INVALID_DOCUMENT_FILE' using errcode='22023'; end if;
  if v_path!~('^affiliate-documents/'||p_affiliate_id::text||'/[A-Za-z0-9._-]+$') then raise exception 'INVALID_STORAGE_PATH' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='private-assets' and name=v_path and owner_id=auth.uid()::text) then raise exception 'UPLOAD_NOT_FOUND' using errcode='22023'; end if;
  select d.id into v_replaced from public.affiliate_documents d where d.affiliate_id=p_affiliate_id and d.document_type_id=p_document_type_id order by d.created_at desc,d.id desc limit 1;
  select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;
  if v_asset.id is null then begin
    insert into public.private_assets(asset_key,asset_type,title,storage_bucket,storage_path,mime_type,file_size,content_sha256)
    values('affiliate_document_'||replace(extensions.gen_random_uuid()::text,'-',''),'AFFILIATE_DOCUMENT',v_type.label,'private-assets',v_path,p_mime_type,p_file_size,upper(p_sha256)) returning * into v_asset;
  exception when unique_violation then select * into v_asset from public.private_assets where content_sha256=upper(p_sha256) for update;end;end if;
  if v_asset.id is null then raise exception 'DOCUMENT_ASSET_REGISTRATION_FAILED'; end if;
  if v_asset.storage_path is distinct from v_path then v_cleanup_path:=v_path; end if;
  update public.affiliate_documents set status='REJECTED',review_observation='Reemplazado por una nueva carga administrativa.',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now()
   where affiliate_id=p_affiliate_id and document_type_id=p_document_type_id and status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED');
  insert into public.affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id,replaces_document_id)
   values(p_affiliate_id,p_document_type_id,v_asset.id,'PENDING_REVIEW',auth.uid(),v_replaced) returning * into v_doc;
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata)
   values(auth.uid(),p_affiliate_id,'affiliate_documents',case when v_replaced is null then 'ADMIN_UPLOAD' else 'ADMIN_REPLACEMENT_UPLOAD' end,v_doc.id,jsonb_strip_nulls(jsonb_build_object('document_type_id',p_document_type_id,'mime_type',p_mime_type,'file_size',p_file_size,'reason',v_reason,'replaces_document_id',v_replaced)));
  return jsonb_build_object('document',to_jsonb(v_doc),'cleanup_storage_path',v_cleanup_path);
end $$;

revoke all on function public.get_current_affiliate_access_state(),public.archive_admin_affiliate(uuid,timestamptz,text),public.restore_admin_affiliate(uuid,timestamptz,text),public.list_admin_archived_affiliates(text,integer,integer,text) from public,anon;
grant execute on function public.get_current_affiliate_access_state(),public.archive_admin_affiliate(uuid,timestamptz,text),public.restore_admin_affiliate(uuid,timestamptz,text),public.list_admin_archived_affiliates(text,integer,integer,text) to authenticated;
revoke all on function public.guard_archived_affiliate_new_operation() from public,anon,authenticated;

comment on column public.affiliates.is_archived is 'Reversible administrative archive; distinct from affiliate_status_raw and never a hard delete.';
comment on function public.get_effective_affiliate_id() is 'Central self-service identity boundary; archived affiliates resolve to no effective business identity.';
comment on function public.list_admin_archived_affiliates(text,integer,integer,text) is 'Permission-gated Eliminados projection over the same public.affiliates authority.';
comment on function public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text) is 'Permission-gated Admin upload/replacement with immutable version lineage and private Storage ownership verification.';

notify pgrst,'reload schema';
commit;
