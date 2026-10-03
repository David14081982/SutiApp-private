begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Exact audited authorization contracts, verified before catalog/schema writes.
do $$ declare expected record; actual record;begin
 for expected in select * from (values
  ('admin_support_private.module_visible(uuid,text)','40eb823f8d48ae5200b53fad63ee33ca','{postgres=X/postgres}'),
  ('public.has_admin_permission(text)','ede6d35b74b6163f3765b518adead8ce','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
  ('public.admin_module_boundary(text[],text)','ff60b8b05a6d990574e3a34c903419c1','{postgres=X/postgres,authenticated=X/postgres}')
 ) audited(signature,definition_md5,acl) loop
  select md5(pg_get_functiondef(p.oid)) definition_md5,pg_get_userbyid(p.proowner) owner_name,p.proacl
   into actual from pg_proc p where p.oid=to_regprocedure(expected.signature);
  if not found or actual.definition_md5 is distinct from expected.definition_md5 or actual.owner_name is distinct from 'postgres'
   or not(coalesce(actual.proacl,'{}'::aclitem[]) @> expected.acl::aclitem[] and coalesce(actual.proacl,'{}'::aclitem[]) <@ expected.acl::aclitem[])
  then raise exception 'SICOF_INSTALL_BASELINE_DRIFT: %',expected.signature;end if;
 end loop;
end $$;
create schema sicof_private;
revoke all on schema sicof_private from public,anon,authenticated,service_role;

create table sicof_private.visibility_backup(id boolean primary key check(id),definition text not null,installed_definition text,original_acl aclitem[],original_owner text not null);
alter table sicof_private.visibility_backup enable row level security;
alter table sicof_private.visibility_backup force row level security;
insert into sicof_private.visibility_backup(id,definition,original_acl,original_owner)
 select true,pg_get_functiondef(oid),proacl,pg_get_userbyid(proowner) from pg_proc where oid='admin_support_private.module_visible(uuid,text)'::regprocedure;
do $$ declare definition text; marker text:=') modules(key,permission,section_keys)';begin
 select b.definition into strict definition from sicof_private.visibility_backup b where id;
 if position(marker in definition)=0 or position('''sicof''' in definition)>0
  or (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1 then raise exception 'SICOF_MODULE_VISIBILITY_DRIFT';end if;
 execute replace(definition,marker,',(''sicof'',''savings.read'',array[]::text[])'||marker);
 update sicof_private.visibility_backup set installed_definition=pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure) where id;
end $$;

insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,
 module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order)
values('admin_sicof','Sicof','Loan observations and canonical Savings projections; simulations create no money',array['read','update'],'ENFORCED','sicof',
 array['savings.read','savings.reports'],array['savings.config'],array[]::text[],false,9);

create table sicof_private.scenarios(
 id uuid primary key default extensions.gen_random_uuid(),title text not null check(length(btrim(title)) between 1 and 180),
 parameters jsonb not null, result jsonb not null,context_fingerprint text not null,source_fingerprint text not null,
 actor_real_auth_user_id uuid not null references auth.users(id),usuario_contexto_affiliate_id uuid references public.affiliates(id),
 client_action_id uuid not null unique,created_at timestamptz not null default clock_timestamp(),
 command jsonb not null,classification text not null default 'SIMULATION' check(classification='SIMULATION')
);
create table sicof_private.scenario_events(
 id uuid primary key default extensions.gen_random_uuid(),scenario_id uuid not null references sicof_private.scenarios(id),
 action text not null check(action='ARCHIVE'),actor_real_auth_user_id uuid not null references auth.users(id),
 usuario_contexto_affiliate_id uuid references public.affiliates(id),client_action_id uuid not null unique,
 created_at timestamptz not null default clock_timestamp(),unique(scenario_id,action)
);
create table sicof_private.preferences(
 id bigint generated always as identity primary key, value jsonb not null,
 actor_real_auth_user_id uuid not null references auth.users(id),usuario_contexto_affiliate_id uuid references public.affiliates(id),
 client_action_id uuid not null unique,created_at timestamptz not null default clock_timestamp()
);
create table sicof_private.historical_reports(
 id uuid primary key default extensions.gen_random_uuid(),filename text not null,sha256 text not null unique check(sha256 ~ '^[a-f0-9]{64}$'),
 template bytea not null,rows jsonb not null,metadata jsonb not null,
 actor_real_auth_user_id uuid not null references auth.users(id),usuario_contexto_affiliate_id uuid references public.affiliates(id),
 client_action_id uuid not null unique,created_at timestamptz not null default clock_timestamp(),
 classification text not null default 'HISTORICAL_REPORT_REFERENCE' check(classification='HISTORICAL_REPORT_REFERENCE')
);
do $$ declare tab text;begin
 foreach tab in array array['scenarios','scenario_events','preferences','historical_reports'] loop
  execute format('alter table sicof_private.%I enable row level security',tab);
  execute format('alter table sicof_private.%I force row level security',tab);
  execute format('create trigger immutable_history before update or delete on sicof_private.%I for each row execute function public.reject_savings_history_mutation()',tab);
 end loop;
end $$;
revoke all on all tables in schema sicof_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema sicof_private from public,anon,authenticated,service_role;

create function sicof_private.require_admin(p_permission text,p_write boolean default false) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission(p_permission)
  or not public.admin_module_boundary(array['sicof'],case when p_write then 'update' else 'read' end)
 then raise exception 'SICOF_ADMIN_DENIED' using errcode='42501';end if;
end $$;

create function sicof_private.context(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.savings_participants%rowtype; e public.savings_enrollments%rowtype; c public.savings_balance_certifications%rowtype;
 people jsonb:='[]'; person jsonb; tx jsonb; composition jsonb; history jsonb; periods jsonb; existing_preview jsonb:='[]';
 reasons jsonb; policy_reasons jsonb; source_review jsonb; identity_ok boolean; certified boolean; expected_count integer; actual_count integer;
 present date:=public.savings_operation_today(); as_of date; result jsonb; yr public.savings_yield_periods%rowtype;
begin
 if p_from is null or p_to is null or p_to<p_from or p_to>p_from+1098 or p_from<date '2000-01-01'
  or p_to>present+366 then raise exception 'SICOF_RANGE_INVALID';end if;
 as_of:=least(p_to,present);
 for p in select * from public.savings_participants order by legacy_folio,id loop
  identity_ok:=p.identity_status='RESOLVED' and exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))
   and (select count(*) from public.affiliates a where a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))=1;
  certified:=p.certification_status='CERTIFIED' and p.data_classification='CANONICAL';
  select * into c from public.savings_balance_certifications where participant_id=p.id;
  select * into e from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL'
   and (enrollment_started_at at time zone 'America/Hermosillo')::date<=as_of order by sequence_number desc limit 1;
  composition:=null;history:='[]';tx:='[]';reasons:='[]';policy_reasons:='[]';source_review:=null;expected_count:=0;actual_count:=0;
  if not identity_ok then reasons:=reasons||'"IDENTITY_REVIEW_REQUIRED"'::jsonb;end if;
  if not certified then reasons:=reasons||'"CERTIFICATION_REQUIRED"'::jsonb;end if;
  if identity_ok and certified then
   if exists(select 1 from public.savings_transactions t where t.participant_id=p.id and (t.data_classification<>'CANONICAL' or t.effective_date>present)) then
    reasons:=reasons||'"NONCANONICAL_MOVEMENTS"'::jsonb;
   else composition:=savings_period_private.composition(p.id,as_of);end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'enrollment_id',t.enrollment_id,'component',t.component,'direction',t.direction,'amount',t.amount,
    'effective_date',t.effective_date,'contribution_date',t.contribution_date,'transaction_type',t.transaction_type,'reversal_of_transaction_id',t.reversal_of_transaction_id,
    'origins',(select jsonb_agg(jsonb_build_object('origin_key',o.origin_key,'amount',o.amount) order by o.origin_key)
     from savings_period_private.origins(p.id,as_of)o where o.transaction_id=t.id)) order by t.effective_date,t.id),'[]') into tx
   from public.savings_transactions t where t.participant_id=p.id and t.data_classification='CANONICAL' and t.effective_date<=as_of;
   select coalesce(jsonb_agg(to_jsonb(h) order by h.date,h.id),'[]') into history
    from public.savings_workspace_history(p.id)h where h.date between p_from and as_of;
   if e.id is null then reasons:=reasons||'"ENROLLMENT_UNVERIFIED"'::jsonb;
   elsif greatest(p_from,e.first_expected_contribution_date)<=as_of then
    select count(*) into expected_count from public.generate_savings_schedule(e.id,greatest(p_from,e.first_expected_contribution_date),as_of);
    select count(*) into actual_count from public.generate_savings_schedule(e.id,greatest(p_from,e.first_expected_contribution_date),as_of)s
     where exists(select 1 from jsonb_array_elements(history)h where (h->>'date')::date=s.contribution_date
      and h->>'amount' is not null and h->>'expected' is not null and h->>'data_conflict'='false' and h->>'includes_yield'='false');
   end if;
   if expected_count<>actual_count then reasons:=reasons||'"CONTRIBUTION_EVIDENCE_INCOMPLETE"'::jsonb;end if;
   if exists(select 1 from jsonb_array_elements(history)h where h->>'data_conflict'='true') then reasons:=reasons||'"CONTRIBUTION_CONFLICT"'::jsonb;end if;
   if exists(select 1 from jsonb_array_elements(history)h where h->>'includes_yield'='true') then reasons:=reasons||'"MIXED_CAPITAL_YIELD_HISTORY"'::jsonb;end if;
   if exists(select 1 from jsonb_array_elements(history)h where h->>'source'='CERTIFIED_HISTORY' and h->>'expected' is null) then reasons:=reasons||'"HISTORICAL_EXPECTATION_UNVERIFIED"'::jsonb;end if;
   if e.id is not null and ((e.enrollment_started_at at time zone 'America/Hermosillo')::date+interval '6 months')::date>as_of then policy_reasons:=policy_reasons||'"MINIMUM_TENURE"'::jsonb;end if;
   if e.id is not null and (e.status not in ('ACTIVE','TERMINATION_PENDING','TERMINATED') or (e.terminated_at at time zone 'America/Hermosillo')::date<=as_of)
    then policy_reasons:=policy_reasons||'"INACTIVE_ENROLLMENT"'::jsonb;end if;
   if exists(select 1 from jsonb_array_elements(history)h where (h->>'amount')::numeric<(h->>'expected')::numeric) then policy_reasons:=policy_reasons||'"SHORT_CONTRIBUTION"'::jsonb;end if;
   if p.import_batch_id is not null and p.historical_yield_reconciled_through is null then reasons:=reasons||'"HISTORICAL_YIELD_UNRECONCILED"'::jsonb;
   elsif as_of<=p.historical_yield_reconciled_through then policy_reasons:=policy_reasons||'"PERIOD_ALREADY_RECONCILED"'::jsonb;
   elsif p_from<=p.historical_yield_reconciled_through then reasons:=reasons||'"HISTORICAL_PERIOD_OVERLAP"'::jsonb;end if;
   if exists(select 1 from public.savings_holds h where h.participant_id=p.id and h.status='ACTIVE') then reasons:=reasons||'"HOLD_REVIEW_REQUIRED"'::jsonb;end if;
   if exists(select 1 from public.savings_requests r where r.participant_id=p.id and r.enrollment_id=e.id and r.status='SETTLED'
    and (r.settled_at at time zone 'America/Hermosillo')::date between p_from and as_of
    and (r.request_type='EXTRAORDINARY_WITHDRAWAL' or (r.settled_at at time zone 'America/Hermosillo')::date<((e.enrollment_started_at at time zone 'America/Hermosillo')::date+interval '6 months')::date))
    then policy_reasons:=policy_reasons||'"EARLY_OR_EXTRAORDINARY_WITHDRAWAL"'::jsonb;end if;
   if c.id is not null then
    source_review:=public.get_admin_savings_financial_account(c.record_id,null);
    if source_review->>'source_changed'='true' or source_review#>>'{context,source_update,pending}'='true' then reasons:=reasons||'"SOURCE_REVIEW_REQUIRED"'::jsonb;end if;
   end if;
  end if;
  person:=jsonb_build_object('id',p.id,'affiliate_id',p.affiliate_id,'folio',p.legacy_folio,
   'name',case when identity_ok then (select full_name from public.affiliates where id=p.affiliate_id) else p.display_name end,
   'identity_resolved',identity_ok,'certified',certified,'certified_as_of',c.cutoff_on,'historical_yield_reconciled_through',p.historical_yield_reconciled_through,
   'enrollment',case when e.id is null then null else jsonb_build_object('id',e.id,'status',e.status,'enrollment_started_at',e.enrollment_started_at,
    'first_actual_contribution_date',e.first_actual_contribution_date,'first_expected_contribution_date',e.first_expected_contribution_date,
    'terminated_at',e.terminated_at,'process',e.process_snapshot,'frequency',case when e.process_snapshot='JUB' then 'MONTHLY' else 'TWICE_MONTHLY' end) end,
   'transactions',tx,'composition',composition,'history',history,
   'eligibility',jsonb_build_object('complete',jsonb_array_length(reasons)=0,'reasons',reasons,'policy_reasons',policy_reasons,
    'status',case when jsonb_array_length(reasons)>0 then 'REVIEW_REQUIRED' when jsonb_array_length(policy_reasons)>0 then 'EXCLUDED_BY_CURRENT_POLICY' else 'EVIDENCE_READY' end,
    'expected_count',expected_count,'proved_count',actual_count));
  people:=people||jsonb_build_array(person);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(y) order by period_year,semester),'[]') into periods from public.savings_yield_periods y;
 for yr in select * from public.savings_yield_periods where starts_on<=p_to and ends_on>=p_from loop
  existing_preview:=existing_preview||jsonb_build_array(public.preview_savings_period_yield(yr.id));
 end loop;
 result:=jsonb_build_object('participants',people,'periods',periods,'existing_period_previews',existing_preview,'from',p_from,'to',p_to,'as_of',as_of,'today',present);
 return result||jsonb_build_object('fingerprint',md5(result::text));
end $$;

create function public.get_admin_sicof_context(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; scenarios jsonb; preferences jsonb; report jsonb;
begin
 perform sicof_private.require_admin('savings.read');
 result:=sicof_private.context(p_from,p_to);
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'parameters',s.parameters,'result',s.result,
  'created_at',s.created_at,'context_fingerprint',s.context_fingerprint,'source_fingerprint',s.source_fingerprint,'classification',s.classification) order by s.created_at desc),'[]') into scenarios
 from (select * from sicof_private.scenarios s where not exists(select 1 from sicof_private.scenario_events e where e.scenario_id=s.id and e.action='ARCHIVE') order by created_at desc limit 100)s;
 select value into preferences from sicof_private.preferences order by id desc limit 1;
 if public.has_admin_permission('savings.reports') then
  select jsonb_build_object('id',r.id,'filename',r.filename,'sha256',r.sha256,'rows',r.rows,'metadata',r.metadata,'classification',r.classification) into report
  from sicof_private.historical_reports r order by created_at desc,id desc limit 1;
 end if;
 return result||jsonb_build_object('scenarios',scenarios,'preferences',coalesce(preferences,'{}'),'report',report,
  'context',jsonb_build_object('actor',auth.uid(),'session',auth.jwt()->>'session_id','effective_affiliate',public.get_effective_affiliate_id()),
  'can_configure',public.has_admin_permission('savings.config') and public.admin_module_boundary(array['sicof'],'update'),
  'can_attribute',public.has_admin_permission('savings.approve'),
  'can_export',public.has_admin_permission('savings.reports'));
end $$;

create function public.get_admin_sicof_behavior_context(p_affiliate_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sicof boolean; subjects jsonb;
begin
 sicof:=auth.uid() is not null and public.has_admin_permission('savings.read') and public.admin_module_boundary(array['sicof']);
 if not sicof and not(auth.uid() is not null and public.has_admin_permission('program_requests.read') and public.admin_module_boundary(array['finanzas']))
 then raise exception 'SICOF_BEHAVIOR_DENIED' using errcode='42501';end if;
 if p_affiliate_ids is null or cardinality(p_affiliate_ids) not between 1 and 100 or array_position(p_affiliate_ids,null) is not null then raise exception 'SICOF_SUBJECTS_INVALID';end if;
 if exists(select 1 from unnest(p_affiliate_ids)requested(id) where not exists(select 1 from public.affiliates a where a.id=requested.id and not coalesce(a.is_archived,false)
  and nullif(a.numero_control,'') is not null and (select count(*) from public.affiliates b where b.numero_control=a.numero_control and not coalesce(b.is_archived,false))=1
  and (sicof or exists(select 1 from public.program_requests r where r.affiliate_id=a.id and public.admin_request_module_boundary(r.id)))))
 then raise exception 'SICOF_SUBJECT_UNAVAILABLE' using errcode='42501';end if;
 select jsonb_agg(jsonb_build_object('affiliate_id',a.id,'folio',a.numero_control) order by a.id) into subjects from public.affiliates a where a.id=any(p_affiliate_ids);
 return jsonb_build_object('subjects',subjects,'today',public.savings_operation_today(),'context',jsonb_build_object('actor',auth.uid(),'session',auth.jwt()->>'session_id','effective_affiliate',public.get_effective_affiliate_id()));
end $$;

-- Service entry points impersonate only an existing live session, then re-run
-- the same effective-role/module checks. The browser cannot submit calculated results.
create function sicof_private.service_actor(p_actor uuid,p_session uuid,p_effective_affiliate uuid) returns text
language plpgsql security definer set search_path='' as $$
declare original text:=current_setting('request.jwt.claims',true);
begin
 if auth.role() is distinct from 'service_role' or p_actor is null or p_session is null
  or not exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_actor and (s.not_after is null or s.not_after>now()))
 then raise exception 'SICOF_SERVICE_CONTEXT_REQUIRED' using errcode='42501';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_session,'role','authenticated')::text,true);
 if public.get_effective_affiliate_id() is distinct from p_effective_affiliate then raise exception 'SICOF_CONTEXT_CHANGED' using errcode='42501';end if;
 perform sicof_private.require_admin('savings.config',true);
 return original;
end $$;

create function public.service_save_sicof_scenario(p_actor uuid,p_session uuid,p_effective_affiliate uuid,p_key uuid,
 p_title text,p_parameters jsonb,p_result jsonb,p_context_fingerprint text,p_source_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original text; prior sicof_private.scenarios%rowtype; id uuid; fresh jsonb;
 command jsonb:=jsonb_build_object('title',p_title,'parameters',p_parameters,'result',p_result,'context_fingerprint',p_context_fingerprint,'source_fingerprint',p_source_fingerprint);
begin
 original:=sicof_private.service_actor(p_actor,p_session,p_effective_affiliate);
 if p_key is null or length(btrim(coalesce(p_title,''))) not between 1 and 180 or jsonb_typeof(p_parameters) is distinct from 'object'
  or jsonb_typeof(p_result) is distinct from 'object' or length(p_parameters::text)>100000 or length(p_result::text)>10000000
  or coalesce(p_context_fingerprint,'') !~ '^[a-f0-9]{32}$' or coalesce(p_source_fingerprint,'') !~ '^[a-f0-9]{32,64}$'
 then raise exception 'SICOF_SCENARIO_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('sicof-scenario:'||p_key,0));
 select * into prior from sicof_private.scenarios where client_action_id=p_key;
 if found then
  if prior.actor_real_auth_user_id<>p_actor or prior.command is distinct from command then raise exception 'SICOF_IDEMPOTENCY_CONFLICT';end if;
  id:=prior.id;
 else
  perform sicof_private.require_admin('savings.read');
  fresh:=sicof_private.context((p_parameters->>'from')::date,(p_parameters->>'to')::date);
  if fresh->>'fingerprint' is distinct from p_context_fingerprint then raise exception 'SICOF_SOURCE_CHANGED';end if;
  insert into sicof_private.scenarios(title,parameters,result,context_fingerprint,source_fingerprint,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id,command)
   values(btrim(p_title),p_parameters,p_result,p_context_fingerprint,p_source_fingerprint,p_actor,p_effective_affiliate,p_key,command) returning scenarios.id into id;
 end if;
 perform set_config('request.jwt.claims',original,true);
 return jsonb_build_object('id',id,'classification','SIMULATION','saved',true);
end $$;

create function public.admin_archive_sicof_scenario(p_scenario_id uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior sicof_private.scenario_events%rowtype;
begin
 perform sicof_private.require_admin('savings.config',true);
 if p_key is null then raise exception 'SICOF_KEY_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('sicof-archive:'||p_scenario_id,0));
 select * into prior from sicof_private.scenario_events where client_action_id=p_key;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.scenario_id<>p_scenario_id then raise exception 'SICOF_IDEMPOTENCY_CONFLICT';end if;
 elsif not exists(select 1 from sicof_private.scenario_events where scenario_id=p_scenario_id and action='ARCHIVE') then
  insert into sicof_private.scenario_events(scenario_id,action,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id)
   values(p_scenario_id,'ARCHIVE',auth.uid(),public.get_effective_affiliate_id(),p_key);
 end if;
 return jsonb_build_object('id',p_scenario_id,'archived',true);
end $$;

create function public.admin_save_sicof_preferences(p_value jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior sicof_private.preferences%rowtype;
begin
 perform sicof_private.require_admin('savings.config',true);
 if p_key is null or jsonb_typeof(p_value) is distinct from 'object' or length(p_value::text)>20000
  or exists(select 1 from jsonb_object_keys(p_value)k where k not in ('tab_order','labels'))
  or (p_value ? 'tab_order' and (jsonb_typeof(p_value->'tab_order')<>'array' or jsonb_array_length(p_value->'tab_order')>30))
  or (p_value ? 'labels' and jsonb_typeof(p_value->'labels')<>'object') then raise exception 'SICOF_PREFERENCES_INVALID';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_value->'tab_order','[]'))v where jsonb_typeof(v)<>'string' or length(v::text)>100)
  or exists(select 1 from jsonb_each(coalesce(p_value->'labels','{}'))v where jsonb_typeof(v.value)<>'string' or length(v.value::text)>500)
 then raise exception 'SICOF_PREFERENCES_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('sicof-preferences:'||p_key,0));
 select * into prior from sicof_private.preferences where client_action_id=p_key;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.value is distinct from p_value then raise exception 'SICOF_IDEMPOTENCY_CONFLICT';end if;
 else insert into sicof_private.preferences(value,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id)
  values(p_value,auth.uid(),public.get_effective_affiliate_id(),p_key);end if;
 return jsonb_build_object('saved',true,'preferences',p_value);
end $$;

create function public.service_import_sicof_report(p_actor uuid,p_session uuid,p_effective_affiliate uuid,p_key uuid,
 p_filename text,p_sha256 text,p_template_base64 text,p_rows jsonb,p_metadata jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original text; template bytea; prior sicof_private.historical_reports%rowtype; id uuid;
begin
 original:=sicof_private.service_actor(p_actor,p_session,p_effective_affiliate);
 perform sicof_private.require_admin('savings.reports');
 if p_key is null or length(coalesce(p_filename,'')) not between 1 and 250 or coalesce(p_sha256,'') !~ '^[a-f0-9]{64}$'
  or length(coalesce(p_template_base64,'')) not between 8 and 14000000 or jsonb_typeof(p_rows) is distinct from 'array'
  or jsonb_array_length(p_rows)>10000 or length(p_rows::text)>10000000 or jsonb_typeof(p_metadata) is distinct from 'object'
  or length(p_metadata::text)>100000 then raise exception 'SICOF_REPORT_INVALID';end if;
 template:=decode(p_template_base64,'base64');
 if encode(sha256(template),'hex')<>p_sha256 or substring(template from 1 for 2)<>decode('504b','hex') then raise exception 'SICOF_REPORT_HASH_MISMATCH';end if;
 if exists(select 1 from jsonb_array_elements(p_rows)r where jsonb_typeof(r) is distinct from 'object'
  or jsonb_typeof(r->'folio') is distinct from 'string' or nullif(r->>'folio','') is null or jsonb_typeof(r->'cells') is distinct from 'object')
 then raise exception 'SICOF_REPORT_ROWS_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('sicof-report:'||p_sha256,0));
 select * into prior from sicof_private.historical_reports where client_action_id=p_key;
 if found then
  if prior.actor_real_auth_user_id<>p_actor or prior.sha256<>p_sha256 or prior.rows is distinct from p_rows or prior.metadata is distinct from p_metadata or prior.filename<>p_filename
   then raise exception 'SICOF_IDEMPOTENCY_CONFLICT';end if;id:=prior.id;
 elsif exists(select 1 from sicof_private.historical_reports where sha256=p_sha256) then raise exception 'SICOF_REPORT_ALREADY_IMPORTED';
 else insert into sicof_private.historical_reports(filename,sha256,template,rows,metadata,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id)
  values(p_filename,p_sha256,template,p_rows,p_metadata,p_actor,p_effective_affiliate,p_key) returning historical_reports.id into id;end if;
 perform set_config('request.jwt.claims',original,true);
 return jsonb_build_object('id',id,'classification','HISTORICAL_REPORT_REFERENCE','imported',true);
end $$;

create function public.get_admin_sicof_report_template(p_report_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform sicof_private.require_admin('savings.reports');
 select jsonb_build_object('id',id,'filename',filename,'sha256',sha256,'template_base64',encode(template,'base64'),'rows',rows,'metadata',metadata)
 into result from sicof_private.historical_reports where id=p_report_id;
 if result is null then raise exception 'SICOF_REPORT_NOT_FOUND';end if;return result;
end $$;

revoke all on all functions in schema sicof_private from public,anon,authenticated,service_role;
revoke all on function public.get_admin_sicof_context(date,date),public.get_admin_sicof_behavior_context(uuid[]),
 public.admin_archive_sicof_scenario(uuid,uuid),public.admin_save_sicof_preferences(jsonb,uuid),public.get_admin_sicof_report_template(uuid),
 public.service_save_sicof_scenario(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text),public.service_import_sicof_report(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.get_admin_sicof_context(date,date),public.get_admin_sicof_behavior_context(uuid[]),
 public.admin_archive_sicof_scenario(uuid,uuid),public.admin_save_sicof_preferences(jsonb,uuid),public.get_admin_sicof_report_template(uuid) to authenticated;
grant execute on function public.service_save_sicof_scenario(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text),public.service_import_sicof_report(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
