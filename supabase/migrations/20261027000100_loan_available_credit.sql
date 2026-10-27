begin;
set local lock_timeout='3s';
set local statement_timeout='60s';

-- H-LOAN-AVAILABLE-CREDIT-001. Google remains the authority for amortization.
-- This policy changes only the capital available for a NEW Suti Prestamo request.
-- Existing program eligibility, pricing, workflow and historical rows are untouched.
create schema loan_capacity_private;
revoke all on schema loan_capacity_private from public,anon,authenticated,service_role;
create table loan_capacity_private.function_backup(
 signature text primary key,definition text not null,installed_definition text,
 original_acl text,original_owner oid not null,original_oid oid not null
);
create table public.loan_capacity_policy(
 id boolean primary key default true check(id),
 allow_full boolean not null default false,
 version integer not null default 0 check(version>=0),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid references auth.users(id) on delete restrict
);
insert into public.loan_capacity_policy(id) values(true);
create table public.loan_capacity_overrides(
 affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 fund_id uuid not null references public.financial_funds(id) on delete restrict,
 allow_full boolean not null,
 version integer not null check(version>0),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null references auth.users(id) on delete restrict,
 primary key(affiliate_id,fund_id)
);
create table public.loan_capacity_events(
 id uuid primary key default gen_random_uuid(),
 action text not null check(action in('GLOBAL','INDIVIDUAL','SUBMIT')),
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 affiliate_id uuid references public.affiliates(id) on delete restrict,
 fund_id uuid references public.financial_funds(id) on delete restrict,
 request_id uuid,
 reason text not null,
 before_state jsonb,after_state jsonb not null,
 command jsonb not null,
 client_action_id uuid unique,
 created_at timestamptz not null default clock_timestamp()
);
create unique index loan_capacity_submission_event on public.loan_capacity_events(request_id) where action='SUBMIT';
create index loan_capacity_events_affiliate on public.loan_capacity_events(affiliate_id,created_at desc);
alter table public.financial_session_snapshots add column loan_capacity jsonb
 check(loan_capacity is null or jsonb_typeof(loan_capacity)='object');

do $$ declare t text;begin
 foreach t in array array['public.loan_capacity_policy','public.loan_capacity_overrides','public.loan_capacity_events','loan_capacity_private.function_backup'] loop
  execute format('alter table %s enable row level security',t);
  execute format('alter table %s force row level security',t);
  execute format('revoke all on %s from public,anon,authenticated,service_role',t);
 end loop;
end $$;
create function loan_capacity_private.immutable_event() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'LOAN_CAPACITY_AUDIT_IMMUTABLE';end $$;
create trigger loan_capacity_event_immutable before update or delete on public.loan_capacity_events
 for each row execute function loan_capacity_private.immutable_event();

create function loan_capacity_private.assert_identity(p_affiliate_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare person public.affiliates%rowtype;
begin
 select * into person from public.affiliates where id=p_affiliate_id;
 if person.id is null or person.is_archived or person.numero_control is null
 or person.numero_control='' or person.numero_control<>btrim(person.numero_control) or person.numero_control='0'
 or (select count(*) from public.affiliates a where not a.is_archived and a.numero_control=person.numero_control)<>1
 then raise exception 'AFFILIATE_CONTROL_NOT_UNIQUE_OR_MISSING' using errcode='42501';end if;
 return person.numero_control;
end $$;

-- Exact criterion identity is retained by every request; versions are not a new fund.
create function loan_capacity_private.criterion_fund(p_identity text) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];
begin
 select array_agg(distinct fund_id) into ids from public.financial_rules r
 where coalesce(r.legacy_criterion_identity,'SUPABASE_RULE:'||r.id::text)=p_identity;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'LOAN_CAPACITY_FUND_UNRESOLVED';end if;
 return ids[1];
end $$;

create function public.get_loan_capacity_runtime(p_affiliate_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 perform loan_capacity_private.assert_identity(p_affiliate_id);
 return jsonb_build_object('policy',(select to_jsonb(p)-'id'-'updated_by' from public.loan_capacity_policy p where id),
  'funds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'program_id',program_id) order by id),'[]') from public.financial_funds),
  'rules',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'fund_id',fund_id,'criterion_identity',coalesce(legacy_criterion_identity,'SUPABASE_RULE:'||id::text)) order by id),'[]') from public.financial_rules),
  'overrides',(select coalesce(jsonb_agg(jsonb_build_object('fund_id',fund_id,'allow_full',allow_full,'version',version) order by fund_id),'[]') from public.loan_capacity_overrides where affiliate_id=p_affiliate_id),
  'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'folio',r.folio,'program_id',r.program_id,
   'criterion_identity',r.financial_submission_snapshot->>'criterion_identity','requested_amount',r.requested_amount,
   'status',r.status,'approved_at',r.financial_approved_at,'financial',r.financial_processing_status is not null and r.rental_start is null) order by r.created_at,r.id),'[]')
   from public.program_requests r where r.affiliate_id=p_affiliate_id));
end $$;

create function loan_capacity_private.resolve(p_affiliate_id uuid,p_source jsonb,p_rule_ids uuid[],p_exclude_request uuid default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare control text; person public.affiliates%rowtype; policy public.loan_capacity_policy%rowtype;
 rule record; item jsonb; items jsonb:='[]'; pending numeric; reserved numeric; active integer;
 allowed numeric; mode text; ov public.loan_capacity_overrides%rowtype; observed timestamptz;
 publication_version uuid; publication_updated_at timestamptz; supplied_source_updated_at timestamptz;
 today date:=(clock_timestamp() at time zone 'America/Hermosillo')::date;
 represented uuid[]; chosen integer:=0;
begin
 control:=loan_capacity_private.assert_identity(p_affiliate_id);
 select * into person from public.affiliates where id=p_affiliate_id;
 if p_rule_ids is not null and array_position(p_rule_ids,null) is not null then raise exception 'LOAN_CAPACITY_RULE_CHANGED';end if;
 -- Reuse the existing daily/manual History publication. Its age is NOT a new
 -- validity rule; only the derived calculation expires after fifteen minutes.
 select version,source_updated_at into publication_version,publication_updated_at
 from public.loan_history_publication where id for share;
 if publication_version is null or p_source->>'source_version' is distinct from publication_version::text
 then raise exception 'LOAN_CAPACITY_SOURCE_VERSION_CHANGED';end if;
 -- A valid expiring observation is mandatory even when a policy waives its debt.
 if p_source is null or jsonb_typeof(p_source)<>'object'
 or p_source->>'version' is distinct from '1' or p_source->>'affiliate_id' is distinct from p_affiliate_id::text
 or p_source->>'numero_control' is distinct from control
 or p_source->>'business_day' is distinct from today::text
 or jsonb_typeof(p_source->'funds') is distinct from 'array'
 or jsonb_typeof(p_source->'represented_request_ids') is distinct from 'array'
 then raise exception 'LOAN_CAPACITY_SOURCE_INVALID';end if;
 begin
  observed:=(p_source->>'observed_at')::timestamptz;
  supplied_source_updated_at:=(p_source->>'source_updated_at')::timestamptz;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into represented from jsonb_array_elements_text(p_source->'represented_request_ids');
 exception when others then raise exception 'LOAN_CAPACITY_SOURCE_INVALID';end;
 if supplied_source_updated_at is distinct from publication_updated_at then raise exception 'LOAN_CAPACITY_SOURCE_VERSION_CHANGED';end if;
 if observed is null or not isfinite(observed) or observed>clock_timestamp()+interval '30 seconds'
 or observed<clock_timestamp()-interval '15 minutes'
 then raise exception 'LOAN_CAPACITY_SOURCE_EXPIRED';end if;
 if (select count(*)<>count(distinct value) from jsonb_array_elements_text(p_source->'represented_request_ids'))
 or exists(select 1 from unnest(represented) id where not exists(select 1 from public.program_requests r where r.id=id and r.affiliate_id=p_affiliate_id))
 or (select count(*)<>count(distinct value->>'fund_id') from jsonb_array_elements(p_source->'funds'))
 then raise exception 'LOAN_CAPACITY_SOURCE_INVALID';end if;
 select * into policy from public.loan_capacity_policy where id for share;
 if not found then raise exception 'LOAN_CAPACITY_POLICY_UNAVAILABLE';end if;
 for rule in select r.* from public.financial_rules r
 join public.financial_criteria_authority a on a.id='primary' and a.authority='SUPABASE' and a.active_import_batch_id=r.imported_batch_id
 join public.financial_funds f on f.id=r.fund_id and f.enabled and f.publication_status='PUBLISHED'
 join public.financial_programs p on p.id=r.program_id and p.enabled and p.publication_status='PUBLISHED'
 where r.enabled and r.lifecycle_status in('PUBLISHED','SCHEDULED')
 and r.financial_union_code=person.financial_union_code and r.financial_employee_category_code=person.financial_employee_category_code
 and (p_rule_ids is null or r.id=any(p_rule_ids)) order by r.id loop
  chosen:=chosen+1;
  select value into item from jsonb_array_elements(p_source->'funds') where value->>'fund_id'=rule.fund_id::text;
  if item is null or jsonb_typeof(item->'pending_amount') is distinct from 'number'
  or jsonb_typeof(item->'active_loans') is distinct from 'number' then raise exception 'LOAN_CAPACITY_SOURCE_INVALID';end if;
  begin pending:=(item->>'pending_amount')::numeric;active:=(item->>'active_loans')::integer;
  exception when others then raise exception 'LOAN_CAPACITY_SOURCE_INVALID';end;
  if pending<0 or pending::text in('NaN','Infinity','-Infinity') or pending<>round(pending,2)
  or active<0 or (item->>'active_loans')::numeric<>active then raise exception 'LOAN_CAPACITY_SOURCE_INVALID';end if;
  -- Canonical requests reserve only requested principal until their exact ID is
  -- represented by an amortization. At that point the existing History balance replaces
  -- the reservation; rejected/cancelled requests never reserve credit.
  if exists(select 1 from public.program_requests r where r.affiliate_id=p_affiliate_id and r.program_id='prestamo'
   and r.status in('submitted','in_review','requires_financial_processing','approved')
   and r.id is distinct from p_exclude_request and not(r.id=any(represented))
   and (r.requested_amount is null or r.requested_amount<=0 or r.requested_amount::text in('NaN','Infinity','-Infinity')))
  then raise exception 'LOAN_CAPACITY_RESERVATION_INVALID';end if;
  select coalesce(sum(r.requested_amount),0) into reserved from public.program_requests r
  where r.affiliate_id=p_affiliate_id and r.program_id='prestamo'
  and r.status in('submitted','in_review','requires_financial_processing','approved')
  and r.id is distinct from p_exclude_request and not(r.id=any(represented))
  and loan_capacity_private.criterion_fund(r.financial_submission_snapshot->>'criterion_identity')=rule.fund_id;
  if reserved<0 or reserved::text in('NaN','Infinity','-Infinity') then raise exception 'LOAN_CAPACITY_RESERVATION_INVALID';end if;
  select * into ov from public.loan_capacity_overrides where affiliate_id=p_affiliate_id and fund_id=rule.fund_id;
  mode:=case when policy.allow_full then 'GLOBAL' when coalesce(ov.allow_full,false) then 'INDIVIDUAL' else null end;
  allowed:=case when mode is not null then rule.max_amount else greatest(0,rule.max_amount-pending-reserved) end;
  items:=items||jsonb_build_array(jsonb_build_object('rule_id',rule.id,'fund_id',rule.fund_id,
   'max_amount',rule.max_amount,'pending_amount',pending,'reserved_amount',reserved,'active_loans',active,
   'available_amount',allowed,'exemption',mode,'override_version',coalesce(ov.version,0)));
 end loop;
 if p_rule_ids is not null and chosen<>(select count(distinct id) from unnest(p_rule_ids) id)
 then raise exception 'LOAN_CAPACITY_RULE_CHANGED';end if;
 return jsonb_build_object('policy_version',policy.version,'global_allow_full',policy.allow_full,
  'funds',items,'observed_at',observed,'business_day',today,
  'source_version',publication_version,'source_updated_at',publication_updated_at);
end $$;

create function public.resolve_loan_available_capacity(p_affiliate_id uuid,p_source jsonb,p_rule_ids uuid[] default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 return loan_capacity_private.resolve(p_affiliate_id,p_source,p_rule_ids);
end $$;

create function loan_capacity_private.quote(p_affiliate_id uuid,p_source jsonb,p_selected_id text,p_rules jsonb,p_amount numeric)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare chosen jsonb; candidates jsonb; result jsonb;
begin
 select coalesce(jsonb_agg(value),'[]') into candidates from jsonb_array_elements(p_rules)
 where value->>'status'='AVAILABLE' and value->>'id'=p_selected_id;
 if jsonb_array_length(candidates)=0 then
  select coalesce(jsonb_agg(value),'[]') into candidates from jsonb_array_elements(p_rules)
  where value->>'status'='AVAILABLE' and value->>'program_id'=p_selected_id;
 end if;
 if jsonb_array_length(candidates)<>1 then raise exception 'FINANCIAL_PROGRAM_NOT_ELIGIBLE';end if;
 chosen:=candidates->0;
 if nullif(chosen->>'rule_id','') is null then raise exception 'LOAN_CAPACITY_RULE_CHANGED';end if;
 result:=(loan_capacity_private.resolve(p_affiliate_id,p_source,array[(chosen->>'rule_id')::uuid])->'funds')->0;
 if result is null or jsonb_typeof(result->'available_amount') is distinct from 'number' then raise exception 'LOAN_CAPACITY_RULE_CHANGED';end if;
 if p_amount is null or p_amount<=0 or p_amount::text in('NaN','Infinity','-Infinity')
 or p_amount>(result->>'available_amount')::numeric then raise exception 'LOAN_CAPACITY_EXCEEDED' using errcode='22023';end if;
 return jsonb_build_object('availableAmount',result->'available_amount','loanCapacity',jsonb_build_object(
  'fundId',result->'fund_id','pendingAmount',result->'pending_amount','reservedAmount',result->'reserved_amount',
  'activeLoans',result->'active_loans','exemption',result->'exemption'));
end $$;

create function public.enforce_loan_available_credit() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare rule_id uuid; result jsonb; decision jsonb;
begin
 if new.program_id<>'prestamo' then return new;end if;
 -- Existing writers already lock this row; the trigger also protects any future
 -- writer. A competing request observes committed prior reservations after lock.
 perform 1 from public.affiliates where id=new.affiliate_id for update;
 select r.id into rule_id from public.financial_rules r
 where coalesce(r.legacy_criterion_identity,'SUPABASE_RULE:'||r.id::text)=new.financial_submission_snapshot->>'criterion_identity'
 and r.enabled and r.lifecycle_status in('PUBLISHED','SCHEDULED') order by r.version desc limit 1;
 if rule_id is null then raise exception 'LOAN_CAPACITY_RULE_CHANGED';end if;
 result:=loan_capacity_private.resolve(new.affiliate_id,new.financial_submission_snapshot->'loan_capacity',array[rule_id],new.id);
 decision:=result->'funds'->0;
 if new.requested_amount is null or new.requested_amount<=0
 or new.requested_amount::text in('NaN','Infinity','-Infinity')
 or new.requested_amount>(decision->>'available_amount')::numeric
 then raise exception 'LOAN_CAPACITY_EXCEEDED' using errcode='22023';end if;
 insert into public.loan_capacity_events(action,actor_real_auth_user_id,affiliate_id,fund_id,request_id,reason,after_state,command)
 values('SUBMIT',new.actor_real_auth_user_id,new.affiliate_id,(decision->>'fund_id')::uuid,new.id,
  'Validación transaccional de disponibilidad',decision||jsonb_build_object('policy_version',result->'policy_version',
    'observed_at',result->'observed_at','business_day',result->'business_day',
    'source_version',result->'source_version','source_updated_at',result->'source_updated_at'),
  jsonb_build_object('requested_amount',new.requested_amount,'impersonation_session_id',new.impersonation_session_id));
 return new;
end $$;
create trigger program_requests_loan_available_credit after insert on public.program_requests
 for each row execute function public.enforce_loan_available_credit();

create function public.get_admin_loan_capacity(p_numero_control text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid; person jsonb; fund_list jsonb:='[]'; writable boolean; n integer; history jsonb;
begin
 writable:=public.has_admin_permission('financial_rules.write') and public.admin_module_boundary(array['finanzas'],'update');
 if auth.uid() is null or not((public.has_admin_permission('financial_rules.read') or public.has_admin_permission('financial_rules.write'))
 and public.admin_module_boundary(array['finanzas'],'read')) then raise exception 'LOAN_CAPACITY_ACCESS_DENIED' using errcode='42501';end if;
 if nullif(btrim(p_numero_control),'') is not null then
  select count(*),(array_agg(id))[1] into n,target from public.affiliates where numero_control=btrim(p_numero_control) and not is_archived;
  if n<>1 then raise exception 'AFFILIATE_CONTROL_NOT_UNIQUE_OR_MISSING';end if;
  perform loan_capacity_private.assert_identity(target);
  select jsonb_build_object('id',id,'name',coalesce(nullif(display_name,''),full_name),'numero_control',numero_control) into person from public.affiliates where id=target;
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'label',f.name,'program_id',f.program_id,
   'allow_full',coalesce(o.allow_full,false),'version',coalesce(o.version,0)) order by f.program_id,f.sort_order,f.name),'[]') into fund_list
  from public.financial_funds f left join public.loan_capacity_overrides o on o.fund_id=f.id and o.affiliate_id=target
  where exists(select 1 from public.financial_rules r join public.affiliates a on a.id=target
   join public.financial_criteria_authority authority on authority.id='primary' and authority.authority='SUPABASE' and authority.active_import_batch_id=r.imported_batch_id
   where r.fund_id=f.id and r.enabled and r.lifecycle_status in('PUBLISHED','SCHEDULED')
   and r.financial_union_code=a.financial_union_code and r.financial_employee_category_code=a.financial_employee_category_code);
 end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') into history from
  (select ev.action,ev.created_at,ev.reason,f.name fund_label,
   coalesce((select coalesce(nullif(a.display_name,''),a.full_name) from public.affiliates a where a.auth_user_id=ev.actor_real_auth_user_id and not a.is_archived limit 1),ev.actor_real_auth_user_id::text) actor_label
   from public.loan_capacity_events ev left join public.financial_funds f on f.id=ev.fund_id
   where ev.action<>'SUBMIT' and ((target is null and ev.action='GLOBAL') or ev.affiliate_id=target)
   order by ev.created_at desc,ev.id desc limit 30)e;
 return jsonb_build_object('policy',(select to_jsonb(p)-'id'-'updated_by' from public.loan_capacity_policy p where id),
  'can_configure',writable,'can_authorize',writable,'person',person,'funds',fund_list,'history',history);
end $$;

create function public.set_admin_loan_capacity_policy(p_allow_full boolean,p_expected_version integer,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare old public.loan_capacity_policy%rowtype; after_value jsonb; prior public.loan_capacity_events%rowtype;
 command_value jsonb:=jsonb_build_object('allow_full',p_allow_full,'expected_version',p_expected_version,'reason',p_reason);
begin
 if auth.uid() is null or not(public.has_admin_permission('financial_rules.write') and public.admin_module_boundary(array['finanzas'],'update')) then raise exception 'LOAN_CAPACITY_WRITE_DENIED' using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'LOAN_CAPACITY_INVALID_REASON';end if;
 if p_allow_full is null or p_expected_version is null or p_client_action_id is null then raise exception 'LOAN_CAPACITY_COMMAND_INVALID';end if;
 select * into old from public.loan_capacity_policy where id for update;
 select * into prior from public.loan_capacity_events where client_action_id=p_client_action_id;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.action<>'GLOBAL' or prior.command<>command_value then raise exception 'LOAN_CAPACITY_IDEMPOTENCY_CONFLICT';end if;
  return public.get_admin_loan_capacity();
 end if;
 if old.version is distinct from p_expected_version then raise exception 'LOAN_CAPACITY_STALE' using errcode='40001';end if;
 update public.loan_capacity_policy set allow_full=p_allow_full,version=version+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id returning to_jsonb(loan_capacity_policy) into after_value;
 insert into public.loan_capacity_events(action,actor_real_auth_user_id,reason,before_state,after_state,command,client_action_id)
 values('GLOBAL',auth.uid(),btrim(p_reason),to_jsonb(old),after_value,command_value,p_client_action_id);
 update public.financial_session_snapshots set invalidated_at=clock_timestamp(),invalidation_reason='LOAN_CAPACITY_POLICY_CHANGED' where session_purpose='LOAN' and invalidated_at is null;
 return public.get_admin_loan_capacity();
end $$;

create function public.set_admin_loan_capacity_override(p_affiliate_id uuid,p_fund_id uuid,p_allow_full boolean,p_expected_version integer,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare old public.loan_capacity_overrides%rowtype; after_value jsonb; control text; prior public.loan_capacity_events%rowtype;
 command_value jsonb:=jsonb_build_object('affiliate_id',p_affiliate_id,'fund_id',p_fund_id,'allow_full',p_allow_full,'expected_version',p_expected_version,'reason',p_reason);
begin
 if auth.uid() is null or not(public.has_admin_permission('financial_rules.write') and public.admin_module_boundary(array['finanzas'],'update')) then raise exception 'LOAN_CAPACITY_WRITE_DENIED' using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'LOAN_CAPACITY_INVALID_REASON';end if;
 if p_affiliate_id is null or p_fund_id is null or p_allow_full is null or p_expected_version is null or p_client_action_id is null then raise exception 'LOAN_CAPACITY_COMMAND_INVALID';end if;
 perform 1 from public.affiliates where id=p_affiliate_id for update;
 control:=loan_capacity_private.assert_identity(p_affiliate_id);
 if not exists(select 1 from public.financial_funds where id=p_fund_id) then raise exception 'LOAN_CAPACITY_FUND_UNRESOLVED';end if;
 select * into prior from public.loan_capacity_events where client_action_id=p_client_action_id;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.action<>'INDIVIDUAL' or prior.command<>command_value then raise exception 'LOAN_CAPACITY_IDEMPOTENCY_CONFLICT';end if;
  return public.get_admin_loan_capacity(control);
 end if;
 select * into old from public.loan_capacity_overrides where affiliate_id=p_affiliate_id and fund_id=p_fund_id for update;
 if coalesce(old.version,0)<>p_expected_version then raise exception 'LOAN_CAPACITY_STALE' using errcode='40001';end if;
 insert into public.loan_capacity_overrides(affiliate_id,fund_id,allow_full,version,updated_by)
 values(p_affiliate_id,p_fund_id,p_allow_full,1,auth.uid())
 on conflict(affiliate_id,fund_id) do update set allow_full=excluded.allow_full,version=loan_capacity_overrides.version+1,updated_at=clock_timestamp(),updated_by=auth.uid()
 returning to_jsonb(loan_capacity_overrides) into after_value;
 insert into public.loan_capacity_events(action,actor_real_auth_user_id,affiliate_id,fund_id,reason,before_state,after_state,command,client_action_id)
 values('INDIVIDUAL',auth.uid(),p_affiliate_id,p_fund_id,btrim(p_reason),case when old.version is null then null else to_jsonb(old) end,after_value,command_value,p_client_action_id);
 update public.financial_session_snapshots set invalidated_at=clock_timestamp(),invalidation_reason='LOAN_CAPACITY_OVERRIDE_CHANGED' where affiliate_id=p_affiliate_id and session_purpose='LOAN' and invalidated_at is null;
 return public.get_admin_loan_capacity(control);
end $$;

-- Preserve exact live signature/OID/grants and add only a capacity check/projection.
do $$ declare original text; patched text; signature text:='public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)';
 anchor text:=E'  perform public.assert_savings_loan_quote_access(v_affiliate_id,p_program_id,v_snapshot.eligible_rules);';
begin
 original:=pg_get_functiondef(signature::regprocedure);
 if md5(original)<>'caa656046218f8956bf40f93c6d8a688' or position(anchor in original)=0 then raise exception 'LOAN_CAPACITY_QUOTE_FUNCTION_DRIFT';end if;
 insert into loan_capacity_private.function_backup select signature,original,null,proacl::text,proowner,oid from pg_proc where oid=signature::regprocedure;
 patched:=replace(original,anchor,anchor||E'\n  v_quote := v_quote || loan_capacity_private.quote(v_affiliate_id,v_snapshot.loan_capacity,p_program_id,v_snapshot.eligible_rules,p_amount);');
 execute patched;
 update loan_capacity_private.function_backup b set installed_definition=pg_get_functiondef(b.signature::regprocedure);
 if exists(select 1 from loan_capacity_private.function_backup b join pg_proc p on p.oid=b.original_oid where p.proacl::text is distinct from b.original_acl or p.proowner<>b.original_owner)
 then raise exception 'LOAN_CAPACITY_QUOTE_PRIVILEGE_DRIFT';end if;
end $$;

revoke all on all functions in schema loan_capacity_private from public,anon,authenticated,service_role;
revoke all on function public.get_loan_capacity_runtime(uuid),public.resolve_loan_available_capacity(uuid,jsonb,uuid[]),
 public.enforce_loan_available_credit(),public.get_admin_loan_capacity(text),
 public.set_admin_loan_capacity_policy(boolean,integer,text,uuid),
 public.set_admin_loan_capacity_override(uuid,uuid,boolean,integer,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_loan_capacity_runtime(uuid),public.resolve_loan_available_capacity(uuid,jsonb,uuid[]) to service_role;
grant execute on function public.get_admin_loan_capacity(text),public.set_admin_loan_capacity_policy(boolean,integer,text,uuid),
 public.set_admin_loan_capacity_override(uuid,uuid,boolean,integer,text,uuid) to authenticated;
comment on column public.financial_session_snapshots.loan_capacity is 'Private calculation from existing daily/manual History publication; exact identity/source version, same Hermosillo day, 15-minute calculation TTL; no interactive Google read, balance authority or fallback.';
comment on table public.loan_capacity_policy is 'Owner-authorized global waiver of pending-debt reduction only; never waives fund/profile eligibility, pricing or approval.';
notify pgrst,'reload schema';
commit;
