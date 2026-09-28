begin;
-- H-SUTIAPP-DOCUMENT-GENERATION-CORE-001. Additive document projection only.
set local lock_timeout='2s';
set local statement_timeout='60s';
create schema document_private;
revoke all on schema document_private from public,anon,authenticated;
create table document_private.installation(id boolean primary key default true check(id),enabled boolean not null default true,prior_permission_check text not null,prior_visibility_definition text not null,applied_visibility_hash text);
insert into document_private.installation(prior_permission_check,prior_visibility_definition) select pg_get_constraintdef(oid),pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure) from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check';
do $$ declare prior text; begin
 select prior_permission_check into strict prior from document_private.installation;
 if position('''authorization.read''::text' in prior)=0 then raise exception 'DOCUMENT_PERMISSION_BASELINE_DRIFT'; end if;
 alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
 execute 'alter table public.admin_assignments add constraint admin_assignments_permissions_check '||replace(prior,'''authorization.read''::text','''document_generation.read''::text,''document_generation.retry''::text,''document_generation.config.read''::text,''document_generation.templates.write''::text,''document_generation.signers.write''::text,''document_generation.signatures.read''::text,''document_generation.signatures.write''::text,''document_generation.config.write''::text,''authorization.read''::text');
end $$;
-- Capture at the final event, not at submission and not on a later UI visit.
create function document_private.capture_event() returns trigger language plpgsql security definer set search_path='' as $$
declare op jsonb;identity jsonb;source jsonb;typ text;prog text;af uuid;oid uuid;happened timestamptz;config jsonb;err text;
begin
 if not exists(select 1 from document_private.installation where enabled) then return new;end if;
 if tg_table_name='program_request_admin_events' then
  if new.to_status<>'approved' or new.from_status='approved' then return new;end if;
  select to_jsonb(r) into op from public.program_requests r where r.id=new.request_id;
  typ:=case when op->>'membership_offering_id' is not null then 'MEMBERSHIP_APPROVAL'
   when op#>>'{financial_approval_snapshot,approval_contract_version}'='PROGRAM_PRODUCT_PAYMENT_APPROVAL_V1' then 'PROGRAM_FINANCING_APPROVAL'
   when op->>'financial_approval_snapshot' is not null and op->>'program_id' in ('prestamo','caja','nomina') then 'LOAN_APPROVAL' end;
  if typ is null then return new;end if;
  af:=(op->>'affiliate_id')::uuid;oid:=new.request_id;prog:=op->>'program_id';happened:=new.created_at;
  source:=jsonb_build_object('operation',jsonb_build_object('id',oid,'folio',op->>'folio','program',prog,'approved_at',happened,'authorized_by_user',new.actor_auth_user_id,
   'financial',case when typ='MEMBERSHIP_APPROVAL' then op->'financial_submission_snapshot' else op->'financial_approval_snapshot' end,'profile',op->'financial_profile_snapshot','terms_version_id',op->>'terms_version_id','terms_accepted',op->'terms_accepted'));
  if typ='LOAN_APPROVAL' then source:=source||jsonb_build_object('bank',(select jsonb_build_object('bank_name',b.bank_name,'card_last4',right(b.card_number,4),'clabe_last4',right(b.clabe,4),'source','loan_request_deposit_snapshots') from public.loan_request_deposit_snapshots b where b.request_id=oid));end if;
 else
  if new.resource<>'savings_runtime' or new.action<>'APPROVE' then return new;end if;
  op:=new.after_data->'result';if op->>'status'<>'APPROVED' or op->>'data_classification'<>'CANONICAL' then return new;end if;
  typ:=case op->>'request_type' when 'JOIN' then 'SAVINGS_ENROLLMENT_APPROVAL' when 'CHANGE_AMOUNT' then 'SAVINGS_CONTRIBUTION_CHANGE' when 'TERMINATE' then 'SAVINGS_CESSATION_APPROVAL' when 'WITHDRAW' then 'SAVINGS_WITHDRAWAL_APPROVAL' end;
  if typ is null then return new;end if;
  af:=new.usuario_contexto_affiliate_id;oid:=(op->>'id')::uuid;prog:='caja';happened:=(op->>'reviewed_at')::timestamptz;
  source:=jsonb_build_object('operation',jsonb_build_object('id',oid,'folio',op->>'folio','program',prog,'approved_at',happened,'authorized_by_user',new.actor_real_auth_user_id,
   'request_type',op->>'request_type','requested_amount',op->'requested_amount','authorized_amount',op->'requested_amount','new_contribution_amount',op->'new_contribution_amount','withdrawal_kind',op->>'withdrawal_kind','component',op->>'component','continue_saving',op->'continue_saving','effective_from',op->>'effective_from','reason',op->>'reason',
   'process',coalesce((select process_snapshot from public.savings_contribution_plans where source_request_id=oid limit 1),op#>>'{metadata,process}'),
   'previous_contribution_amount',(select amount from public.savings_contribution_plans where enrollment_id=(op->>'enrollment_id')::uuid and source_request_id is distinct from oid and effective_to=(op->>'effective_from')::date-1 order by effective_from desc limit 1),
   'date_exception',case when op#>>'{metadata,calculated_date}' is not null and op#>>'{metadata,calculated_date}' is distinct from op->>'effective_from' then new.reason end));
 end if;
 -- Keep only document contract inputs, never the Google export row, phone or applicant PII.
 if source#>'{operation,financial}' is not null and source#>'{operation,financial}'<>'null'::jsonb then
  source:=jsonb_set(source,'{operation,financial}',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(source#>'{operation,financial}') where key=any(array['contract_version','approval_contract_version','financialResult','product','offering','authorized_price','price_source','down_payment','financed_amount','financing_conditions','payment_schedule'])));
 end if;
 select jsonb_build_object('affiliate_id',a.id,'numero_control',a.numero_control,'full_name',a.full_name,'union_code',a.financial_union_code,'category_code',a.financial_employee_category_code,'unit',a.unit_raw) into identity from public.affiliates a where a.id=af;
 source:=source||jsonb_build_object('identity',identity,'domain',case when tg_table_name='program_request_admin_events' then 'program' else 'savings' end,'event_id',new.id,'document_type',typ,'contract_version','1','renderer_version','pdf-lib-1.17.1/suti-1');
 begin config:=document_private.resolve_configuration(prog,typ,happened);exception when others then err:=case when sqlerrm like 'DOCUMENT_%' then sqlerrm else 'DOCUMENT_CONFIGURATION_INVALID' end;end;
 insert into document_private.records(domain,operation_id,final_event_id,document_type,affiliate_id,program,folio,occurred_at,source_snapshot,document_snapshot,status,error_code)
 values(source->>'domain',oid,new.id::text,typ,af,prog,op->>'folio',happened,source,case when config is not null then source||config end,case when err is null then 'PENDING' else 'FAILED' end,err)
 on conflict(domain,operation_id,final_event_id,document_type,business_version) do nothing;return new;
end $$;
insert into public.admin_role_permissions(role_id,permission) select id,p from public.admin_roles cross join unnest(array['document_generation.read','document_generation.retry','document_generation.config.read','document_generation.templates.write','document_generation.signers.write','document_generation.signatures.read','document_generation.signatures.write','document_generation.config.write']) p where code='principal_admin';
-- Independently delegable; ordinary finance/savings roles gain no document capabilities.
insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order)
select 'admin_'||k,label,'Private generated documents',array['read','update'],'ENFORCED',k,array['document_generation.config.read'],permissions,array[]::text[],false,100+n from (values
 (1,'document_generation','Documentos y Firmas',array[]::text[]),
 (2,'document_templates','Documentos · Plantillas',array['document_generation.templates.write']),
 (3,'document_signers','Documentos · Identidad de firmantes',array['document_generation.signers.write']),
 (4,'document_signatures_read','Documentos · Ver imágenes de firma',array['document_generation.signatures.read']),
 (5,'document_signatures_write','Documentos · Cambiar imágenes de firma',array['document_generation.signatures.write']),
 (6,'document_configuration','Documentos · Asignaciones',array['document_generation.config.write']),
 (7,'document_read','Documentos · Lectura administrativa',array['document_generation.read']),
 (8,'document_retry','Documentos · Reintentos',array['document_generation.retry'])
) x(n,k,label,permissions);
-- Preserve function OID, grants and every existing visibility branch; add one mapping.
do $$ declare prior text; replacement text; begin
 select prior_visibility_definition into prior from document_private.installation;
 if position('from (values ' in prior)=0 or position('''document_generation''' in prior)>0 then raise exception 'DOCUMENT_VISIBILITY_BASELINE_DRIFT';end if;
 replacement:=replace(prior,'from (values ', 'from (values (''document_generation'',''document_generation.config.read'',array[]::text[]),');
 execute replacement;
 update document_private.installation set applied_visibility_hash=md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure));
end $$;
create table document_private.assets(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('TEMPLATE','SIGNATURE')),path text not null unique,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),mime text not null check(mime in ('application/pdf','image/png','image/jpeg')),
 size integer not null check(size between 1 and 8388608),dimensions jsonb not null,created_by uuid not null,created_at timestamptz not null default now());
create table document_private.templates(
 id uuid primary key default gen_random_uuid(),family_id uuid not null,version integer not null check(version>0),
 name text not null check(length(btrim(name)) between 1 and 160),version_label text not null default '',asset_id uuid not null references document_private.assets(id),
 margins jsonb not null,page_size jsonb not null,orientation text not null check(orientation in ('portrait','landscape')),
 valid_from date not null,created_by uuid not null,created_at timestamptz not null default now(),unique(family_id,version));
create table document_private.template_default(id boolean primary key default true check(id),template_id uuid not null references document_private.templates(id));
create table document_private.signers(
 id uuid primary key default gen_random_uuid(),person_id uuid not null,version integer not null check(version>0),
 full_name text not null check(length(btrim(full_name)) between 1 and 180),title text not null check(length(btrim(title)) between 1 and 180),
 asset_id uuid not null references document_private.assets(id),valid_from date not null,valid_until date,enabled boolean not null,
 created_by uuid not null,created_at timestamptz not null default now(),unique(person_id,version),check(valid_until is null or valid_until>=valid_from));
create table document_private.configurations(
 id uuid primary key default gen_random_uuid(),program text not null,document_type text not null,
 template_id uuid not null references document_private.templates(id),follow_active boolean not null default false,signers jsonb not null check(jsonb_typeof(signers)='array' and jsonb_array_length(signers)>0),
 valid_from date not null,valid_until date,created_by uuid not null,created_at timestamptz not null default now(),check(valid_until is null or valid_until>=valid_from),
 check(document_type in ('LOAN_APPROVAL','PROGRAM_FINANCING_APPROVAL','MEMBERSHIP_APPROVAL','SAVINGS_ENROLLMENT_APPROVAL','SAVINGS_CONTRIBUTION_CHANGE','SAVINGS_CESSATION_APPROVAL','SAVINGS_WITHDRAWAL_APPROVAL')));
create index document_configuration_scope on document_private.configurations(program,document_type,valid_from,created_at desc);
create table document_private.records(
 id uuid primary key default gen_random_uuid(),domain text not null check(domain in ('program','savings')),operation_id uuid not null,final_event_id text not null,
 document_type text not null,business_version integer not null default 1 check(business_version=1),affiliate_id uuid not null,program text not null,folio text not null,occurred_at timestamptz not null,
 source_snapshot jsonb not null,document_snapshot jsonb,status text not null default 'PENDING' check(status in ('PENDING','GENERATING','FAILED','READY')),
 error_code text,attempt_count integer not null default 0,lease_id uuid,lease_until timestamptz,next_attempt_at timestamptz not null default now(),path text unique,sha256 text,snapshot_sha256 text,ready_at timestamptz,created_at timestamptz not null default now(),
 unique(domain,operation_id,final_event_id,document_type,business_version),check(status<>'READY' or (path is not null and sha256 ~ '^[a-f0-9]{64}$' and ready_at is not null)));
create index document_record_work on document_private.records(next_attempt_at) where status<>'READY';
create index document_record_operation on document_private.records(domain,operation_id);
create table document_private.audit(id bigint generated always as identity primary key,actor uuid,context_affiliate uuid,action text not null,resource_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
do $$ declare n text; begin foreach n in array array['installation','assets','templates','template_default','signers','configurations','records','audit'] loop
 execute format('alter table document_private.%I enable row level security',n);execute format('alter table document_private.%I force row level security',n);end loop;end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('generated-documents','generated-documents',false,8388608,array['application/pdf','image/png','image/jpeg']);
-- Restrictive policy prevents broad existing permissive asset policies from granting access.
create policy generated_documents_isolation on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'generated-documents') with check(bucket_id<>'generated-documents');
create function document_private.immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'DOCUMENT_HISTORY_IMMUTABLE';end $$;
create trigger document_template_immutable before update or delete on document_private.templates for each row execute function document_private.immutable();
create trigger document_signer_immutable before update or delete on document_private.signers for each row execute function document_private.immutable();
create trigger document_configuration_immutable before update or delete on document_private.configurations for each row execute function document_private.immutable();
create trigger document_asset_immutable before update or delete on document_private.assets for each row execute function document_private.immutable();
create trigger document_audit_immutable before update or delete on document_private.audit for each row execute function document_private.immutable();
create function document_private.guard_record() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='DELETE' then raise exception 'DOCUMENT_HISTORY_IMMUTABLE';end if;
 if (to_jsonb(new)-array['document_snapshot','status','error_code','attempt_count','lease_id','lease_until','next_attempt_at','path','sha256','snapshot_sha256','ready_at']) is distinct from (to_jsonb(old)-array['document_snapshot','status','error_code','attempt_count','lease_id','lease_until','next_attempt_at','path','sha256','snapshot_sha256','ready_at']) or (old.document_snapshot is not null and new.document_snapshot is distinct from old.document_snapshot) or (old.status='READY' and to_jsonb(new) is distinct from to_jsonb(old)) then raise exception 'DOCUMENT_HISTORY_IMMUTABLE';end if;return new;end $$;
create trigger document_record_immutable before update or delete on document_private.records for each row execute function document_private.guard_record();
create function document_private.resolve_configuration(p_program text,p_type text,p_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare c document_private.configurations%rowtype;t jsonb;s jsonb;day date:=(p_at at time zone 'America/Hermosillo')::date;
begin
 select * into c from document_private.configurations where program=p_program and document_type=p_type and valid_from<=day and (valid_until is null or valid_until>=day) order by created_at desc,id desc limit 1;
 if c.id is null then raise exception 'DOCUMENT_CONFIGURATION_MISSING';end if;
 select to_jsonb(v)||jsonb_build_object('asset',to_jsonb(a)) into t from document_private.templates v join document_private.assets a on a.id=v.asset_id where v.id=case when c.follow_active then (select template_id from document_private.template_default where id) else c.template_id end and v.valid_from<=day;
 if t is null then raise exception 'DOCUMENT_TEMPLATE_NOT_EFFECTIVE';end if;
 select jsonb_agg(to_jsonb(v)||jsonb_build_object('asset',to_jsonb(a),'role',x.item->>'role','position',x.ordinality) order by x.ordinality) into s from jsonb_array_elements(c.signers) with ordinality x(item,ordinality) join document_private.signers assigned on assigned.id=(x.item->>'version_id')::uuid join lateral (select latest.* from document_private.signers latest where latest.person_id=assigned.person_id and latest.valid_from<=day order by latest.version desc limit 1) v on true join document_private.assets a on a.id=v.asset_id where v.enabled and v.valid_from<=day and (v.valid_until is null or v.valid_until>=day);
 if coalesce(jsonb_array_length(s),0)<>jsonb_array_length(c.signers) then raise exception 'DOCUMENT_SIGNER_NOT_EFFECTIVE';end if;
 return jsonb_build_object('configuration_id',c.id,'template',t,'signers',s);
end $$;
create trigger document_program_approval after insert on public.program_request_admin_events for each row execute function document_private.capture_event();
create trigger document_savings_approval after insert on public.savings_audit_events for each row execute function document_private.capture_event();
create function document_private.visible(r document_private.records,p_admin boolean) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and case when p_admin then public.has_admin_permission('document_generation.read') and case when r.domain='savings' then public.has_admin_permission('savings.read') else public.has_admin_permission('program_requests.read') end else r.affiliate_id=public.get_effective_affiliate_id() end
 and case when r.domain='program' then exists(select 1 from public.program_requests where id=r.operation_id and affiliate_id=r.affiliate_id)
 else exists(select 1 from public.savings_requests q join public.savings_participants p on p.id=q.participant_id where q.id=r.operation_id and p.affiliate_id=r.affiliate_id) end;
$$;
create function public.document_generation_command(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare permission text;result jsonb;asset document_private.assets%rowtype;t document_private.templates%rowtype;s document_private.signers%rowtype;r document_private.records%rowtype;uid uuid:=auth.uid();group_id uuid;revision integer;item jsonb;ids uuid[]:='{}';resource uuid;margins jsonb;dims jsonb;assignment jsonb;config_row document_private.configurations%rowtype;assignments jsonb;
begin
 if uid is null then raise exception 'DOCUMENT_AUTH_REQUIRED' using errcode='42501';end if;
 permission:=case p_action when 'DASHBOARD' then 'config.read' when 'SAVE_TEMPLATE' then 'templates.write' when 'ACTIVATE_TEMPLATE' then 'templates.write' when 'SAVE_SIGNER' then 'signers.write' when 'SAVE_CONFIGURATION' then 'config.write' when 'RETRY' then 'retry' end;
 if permission is not null and not public.has_admin_permission('document_generation.'||permission) then raise exception 'DOCUMENT_PERMISSION_DENIED' using errcode='42501';end if;
 if p_action='DASHBOARD' then
  return jsonb_build_object('templates',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('asset',to_jsonb(a)-'path','active',exists(select 1 from document_private.template_default d where d.template_id=v.id)) order by v.created_at desc) from document_private.templates v join document_private.assets a on a.id=v.asset_id),'[]'),
   'signers',coalesce((select jsonb_agg(to_jsonb(v) order by v.full_name) from document_private.signers v where not exists(select 1 from document_private.signers n where n.person_id=v.person_id and n.version>v.version)),'[]'),
   'signer_versions',coalesce((select jsonb_agg(to_jsonb(v)-'asset_id') from document_private.signers v),'[]'),
   'configurations',coalesce((select jsonb_agg(to_jsonb(c) order by c.program,c.document_type) from document_private.configurations c where not exists(select 1 from document_private.configurations n where n.program=c.program and n.document_type=c.document_type and n.created_at>c.created_at)),'[]'),
   'programs',coalesce((select jsonb_agg(distinct program_key) from public.program_catalog_items),'[]'),
   'permissions',(select jsonb_object_agg(k,public.has_admin_permission('document_generation.'||k)) from unnest(array['read','retry','config.read','templates.write','signers.write','signatures.read','signatures.write','config.write']) k));
 elsif p_action='LIST' then
  return coalesce((select jsonb_agg(x.data order by x.occurred_at desc) from (
   select jsonb_build_object('id',q.id,'domain',q.domain,'operation_id',q.operation_id,'document_type',q.document_type,'program',q.program,'folio',q.folio,'occurred_at',q.occurred_at,'status',q.status,'error_code',q.error_code,'can_retry',public.has_admin_permission('document_generation.retry') and coalesce((p_data->>'admin')::boolean,false) and q.status='FAILED') data,q.occurred_at
   from document_private.records q where document_private.visible(q,coalesce((p_data->>'admin')::boolean,false)) and (p_data->>'operation_id' is null or q.operation_id=(p_data->>'operation_id')::uuid) and (p_data->>'domain' is null or q.domain=p_data->>'domain') order by q.occurred_at desc limit 100)x),'[]');
 elsif p_action in ('ACCESS','RETRY') then
  select * into r from document_private.records where id=(p_data->>'id')::uuid for update;
  if r.id is null or not document_private.visible(r,coalesce((p_data->>'admin')::boolean,false)) then raise exception 'DOCUMENT_ACCESS_DENIED' using errcode='42501';end if;
  if p_action='RETRY' then
   if r.status='READY' then return jsonb_build_object('id',r.id,'status',r.status);end if;
   if r.status<>'FAILED' then raise exception 'DOCUMENT_RETRY_NOT_FAILED';end if;
   update document_private.records set status='PENDING',error_code=null,next_attempt_at=now(),lease_id=null,lease_until=null where id=r.id;
   result:=jsonb_build_object('id',r.id,'status','PENDING');
  else
   if r.status<>'READY' then raise exception 'DOCUMENT_NOT_READY';end if;
   result:=jsonb_build_object('path',r.path,'sha256',r.sha256,'id',r.id);
  end if;resource:=r.id;
 elsif p_action='SAVE_TEMPLATE' then
  select * into asset from document_private.assets where id=(p_data->>'asset_id')::uuid and kind='TEMPLATE';
  if asset.id is null then raise exception 'DOCUMENT_TEMPLATE_ASSET_REQUIRED';end if;
  if p_data->>'previous_id' is not null then select * into t from document_private.templates where id=(p_data->>'previous_id')::uuid; if t.id is null then raise exception 'DOCUMENT_TEMPLATE_NOT_FOUND';end if;end if;
  if asset.created_by<>uid and asset.id is distinct from t.asset_id then raise exception 'DOCUMENT_ASSET_DENIED';end if;
  group_id:=coalesce(t.family_id,gen_random_uuid());perform pg_advisory_xact_lock(hashtextextended(group_id::text,0));
  select coalesce(max(version),0)+1 into revision from document_private.templates where family_id=group_id;
  margins:=p_data->'margins';dims:=asset.dimensions;
  if jsonb_typeof(margins) is distinct from 'object' or not margins ?& array['top','bottom','left','right'] then raise exception 'DOCUMENT_MARGINS_INVALID';end if;
  for item in select value from jsonb_each(margins) loop if jsonb_typeof(item)<>'number' or item::text::numeric<10 or item::text::numeric>55 then raise exception 'DOCUMENT_MARGINS_INVALID';end if;end loop;
  if ((margins->>'left')::numeric+(margins->>'right')::numeric)*72/25.4>(dims->>'width')::numeric-120 or ((margins->>'top')::numeric+(margins->>'bottom')::numeric)*72/25.4>(dims->>'height')::numeric-150 then raise exception 'DOCUMENT_SAFE_AREA_TOO_SMALL';end if;
  insert into document_private.templates(family_id,version,name,version_label,asset_id,margins,page_size,orientation,valid_from,created_by)
  values(group_id,revision,p_data->>'name',coalesce(p_data->>'version_label',''),asset.id,margins,dims,case when (dims->>'width')::numeric>(dims->>'height')::numeric then 'landscape' else 'portrait' end,(p_data->>'valid_from')::date,uid) returning id into resource;
  result:=jsonb_build_object('id',resource,'version',revision);
 elsif p_action='ACTIVATE_TEMPLATE' then
  select * into t from document_private.templates where id=(p_data->>'id')::uuid;
  if t.id is null or t.valid_from>(now() at time zone 'America/Hermosillo')::date then raise exception 'DOCUMENT_TEMPLATE_NOT_EFFECTIVE';end if;
  insert into document_private.template_default values(true,t.id) on conflict(id) do update set template_id=excluded.template_id;
  resource:=t.id;result:=jsonb_build_object('id',t.id);
 elsif p_action='SAVE_SIGNER' then
  if p_data->>'previous_id' is not null then select * into s from document_private.signers where id=(p_data->>'previous_id')::uuid;if s.id is null then raise exception 'DOCUMENT_SIGNER_NOT_FOUND';end if;end if;
  select * into asset from document_private.assets where id=(p_data->>'asset_id')::uuid and kind='SIGNATURE';
  if asset.id is null then raise exception 'DOCUMENT_SIGNATURE_REQUIRED';end if;
  if asset.id is distinct from s.asset_id and (asset.created_by<>uid or not public.has_admin_permission('document_generation.signatures.write')) then raise exception 'DOCUMENT_SIGNATURE_WRITE_DENIED';end if;
  group_id:=coalesce(s.person_id,gen_random_uuid());perform pg_advisory_xact_lock(hashtextextended(group_id::text,0));
  select coalesce(max(version),0)+1 into revision from document_private.signers where person_id=group_id;
  insert into document_private.signers(person_id,version,full_name,title,asset_id,valid_from,valid_until,enabled,created_by)
  values(group_id,revision,p_data->>'full_name',p_data->>'title',asset.id,(p_data->>'valid_from')::date,nullif(p_data->>'valid_until','')::date,coalesce((p_data->>'enabled')::boolean,true),uid) returning id into resource;
  result:=jsonb_build_object('id',resource,'version',revision);
  if p_data ? 'assignments' then
   if not public.has_admin_permission('document_generation.config.write') then raise exception 'DOCUMENT_PERMISSION_DENIED';end if;
   for assignment in select value from jsonb_array_elements(p_data->'assignments') loop
    select * into config_row from document_private.configurations where program=assignment->>'program' and document_type=assignment->>'document_type' order by created_at desc,id desc limit 1;
    assignments:=coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(config_row.signers,'[]')) x where not exists(select 1 from document_private.signers oldsign where oldsign.id=(x->>'version_id')::uuid and oldsign.person_id=group_id)),'[]');
    if coalesce((assignment->>'selected')::boolean,false) then assignments:=assignments||jsonb_build_array(jsonb_build_object('version_id',resource,'role',p_data->>'role'));end if;
    perform public.document_generation_command('SAVE_CONFIGURATION',jsonb_build_object('program',assignment->>'program','document_type',assignment->>'document_type','template_id',coalesce(nullif(assignment->>'template_id','')::uuid,config_row.template_id),'follow_active',coalesce(config_row.follow_active,false),'signers',assignments,'valid_from',p_data->>'valid_from','valid_until',config_row.valid_until));
   end loop;
  end if;
 elsif p_action='SAVE_CONFIGURATION' then
  if nullif(btrim(p_data->>'program'),'') is null then raise exception 'DOCUMENT_PROGRAM_REQUIRED';end if;
  if not exists(select 1 from document_private.templates where id=(p_data->>'template_id')::uuid) then raise exception 'DOCUMENT_TEMPLATE_REQUIRED';end if;
  if jsonb_typeof(p_data->'signers') is distinct from 'array' or jsonb_array_length(p_data->'signers')=0 then raise exception 'DOCUMENT_SIGNERS_REQUIRED';end if;
  for item in select value from jsonb_array_elements(p_data->'signers') loop
   select * into s from document_private.signers where id=(item->>'version_id')::uuid;
   if s.id is null or not s.enabled or s.person_id=any(ids) or length(btrim(coalesce(item->>'role',''))) not between 1 and 120 then raise exception 'DOCUMENT_SIGNER_ASSIGNMENT_INVALID';end if;ids:=array_append(ids,s.person_id);
  end loop;
  insert into document_private.configurations(program,document_type,template_id,follow_active,signers,valid_from,valid_until,created_by)
  values(p_data->>'program',p_data->>'document_type',(p_data->>'template_id')::uuid,coalesce((p_data->>'follow_active')::boolean,false),p_data->'signers',(p_data->>'valid_from')::date,nullif(p_data->>'valid_until','')::date,uid) returning id into resource;
  update document_private.records set status='PENDING',error_code=null,next_attempt_at=now() where program=p_data->>'program' and document_type=p_data->>'document_type' and document_snapshot is null and status='FAILED' and error_code in ('DOCUMENT_CONFIGURATION_MISSING','DOCUMENT_TEMPLATE_NOT_EFFECTIVE','DOCUMENT_SIGNER_NOT_EFFECTIVE');
  result:=jsonb_build_object('id',resource);
 elsif p_action='ASSET_ACCESS' then
  select * into asset from document_private.assets where id=(p_data->>'id')::uuid;
  if asset.id is null or not public.has_admin_permission(case when asset.kind='SIGNATURE' then 'document_generation.signatures.read' else 'document_generation.config.read' end) then raise exception 'DOCUMENT_ASSET_ACCESS_DENIED' using errcode='42501';end if;
  resource:=asset.id;result:=jsonb_build_object('id',asset.id,'path',asset.path,'mime',asset.mime);
 elsif p_action='PREVIEW_CONFIG' then
  if not public.has_admin_permission('document_generation.config.read') then raise exception 'DOCUMENT_PERMISSION_DENIED' using errcode='42501';end if;
  if p_data->>'template_id' is not null then
   select to_jsonb(v)||jsonb_build_object('asset',to_jsonb(a),'margins',coalesce(p_data->'margins',v.margins)) into result from document_private.templates v join document_private.assets a on a.id=v.asset_id where v.id=(p_data->>'template_id')::uuid;
   if result is null then raise exception 'DOCUMENT_TEMPLATE_REQUIRED';end if;
   assignments:='[]';
   for item in select value from jsonb_array_elements(coalesce(p_data->'signers','[]')) loop
    select * into s from document_private.signers where id=(item->>'version_id')::uuid;
    if s.id is null then raise exception 'DOCUMENT_SIGNERS_REQUIRED';end if;
    assignments:=assignments||jsonb_build_array(jsonb_build_object('role',item->>'role'));
   end loop;
   if jsonb_array_length(assignments)=0 then raise exception 'DOCUMENT_SIGNERS_REQUIRED';end if;
   return jsonb_build_object('template',result,'signers',assignments);
  end if;
  return document_private.resolve_configuration(p_data->>'program',p_data->>'document_type',now());
 elsif p_action='UPLOAD_PERMISSION' then
  if not public.has_admin_permission(case p_data->>'kind' when 'TEMPLATE' then 'document_generation.templates.write' when 'SIGNATURE' then 'document_generation.signatures.write' else 'INVALID' end) then raise exception 'DOCUMENT_UPLOAD_DENIED' using errcode='42501';end if;return jsonb_build_object('actor',uid);
 else raise exception 'DOCUMENT_ACTION_INVALID';end if;
 insert into document_private.audit(actor,context_affiliate,action,resource_id) values(uid,public.get_effective_affiliate_id(),p_action,resource);
 return result;
end $$;
create function public.document_generation_worker(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare r document_private.records%rowtype;config jsonb;aid uuid;err text;
begin
 if p_action='REGISTER_ASSET' then
  insert into document_private.assets(kind,path,sha256,mime,size,dimensions,created_by) values(p_data->>'kind',p_data->>'path',p_data->>'sha256',p_data->>'mime',(p_data->>'size')::integer,p_data->'dimensions',(p_data->>'actor')::uuid) returning id into aid;
  return jsonb_build_object('id',aid);
 elsif p_action='CLAIM' then
  if not exists(select 1 from document_private.installation where enabled) then return null;end if;
  select * into r from document_private.records q where (q.status='PENDING' or (q.status='GENERATING' and q.lease_until<now())) and q.next_attempt_at<=now() order by q.created_at for update skip locked limit 1;
  if r.id is null then return null;end if;
  if r.document_snapshot is null then
   begin config:=document_private.resolve_configuration(r.program,r.document_type,r.occurred_at);update document_private.records set document_snapshot=source_snapshot||config where id=r.id;
   exception when others then err:=case when sqlerrm like 'DOCUMENT_%' then sqlerrm else 'DOCUMENT_CONFIGURATION_INVALID' end;update document_private.records set status='FAILED',error_code=err where id=r.id;return jsonb_build_object('skipped',true,'id',r.id);end;
  end if;
  update document_private.records set status='GENERATING',attempt_count=attempt_count+1,lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',error_code=null where id=r.id returning * into r;return to_jsonb(r);
 elsif p_action in ('READY','FAILED') then
  select * into r from document_private.records where id=(p_data->>'id')::uuid for update;
  if r.id is null or r.status<>'GENERATING' or r.lease_id is distinct from (p_data->>'lease_id')::uuid or r.lease_until<now() then raise exception 'DOCUMENT_LEASE_LOST';end if;
  if p_action='READY' then
   if p_data->>'path' is distinct from 'issued/'||r.id::text||'.pdf' or p_data->>'snapshot_sha256' !~ '^[a-f0-9]{64}$' then raise exception 'DOCUMENT_PATH_INVALID';end if;
   update document_private.records set status='READY',path=p_data->>'path',sha256=p_data->>'sha256',snapshot_sha256=p_data->>'snapshot_sha256',ready_at=now(),lease_id=null,lease_until=null where id=r.id;
  else update document_private.records set status='FAILED',error_code=left(coalesce(p_data->>'error_code','DOCUMENT_RENDER_FAILED'),100),lease_id=null,lease_until=null where id=r.id;end if;
  insert into document_private.audit(action,resource_id,details) values(p_action,r.id,jsonb_build_object('attempt',r.attempt_count));return jsonb_build_object('id',r.id);
 else raise exception 'DOCUMENT_WORKER_ACTION_INVALID';end if;
end $$;
revoke all on all functions in schema document_private from public,anon,authenticated,service_role;
revoke all on function public.document_generation_command(text,jsonb),public.document_generation_worker(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.document_generation_command(text,jsonb) to authenticated;
grant execute on function public.document_generation_worker(text,jsonb) to service_role;
create function public.wake_document_generation() returns bigint language plpgsql security definer set search_path='' as $$
declare edge_url text;worker_key text;result bigint;
begin
 if not exists(select 1 from document_private.installation where enabled) or not exists(select 1 from document_private.records where status='PENDING' or (status='GENERATING' and lease_until<now())) then return null;end if;
 select decrypted_secret into edge_url from vault.decrypted_secrets where name='document_generation_edge_url';select decrypted_secret into worker_key from vault.decrypted_secrets where name='document_generation_worker_key';
 if edge_url is null or worker_key is null then raise exception 'DOCUMENT_WORKER_NOT_CONFIGURED';end if;
 select net.http_post(url:=edge_url,headers:=jsonb_build_object('Content-Type','application/json','x-document-worker-key',worker_key),body:='{"action":"WORK"}'::jsonb,timeout_milliseconds:=60000) into result;return result;
end $$;
revoke all on function public.wake_document_generation() from public,anon,authenticated,service_role;
select cron.schedule('document-generation-core','* * * * *','select public.wake_document_generation()');
notify pgrst,'reload schema';
commit;
