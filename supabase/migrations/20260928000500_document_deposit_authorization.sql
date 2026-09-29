-- Owner-authorized complete deposit data in private PDFs; domain-bound operator access.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Capture exact definitions for forward recovery; never copy business rows.
alter table document_private.installation add column deposit_recovery jsonb;
update document_private.installation set deposit_recovery=jsonb_build_object(
 'command',pg_get_functiondef('public.document_generation_command(text,jsonb)'::regprocedure),
 'visible',pg_get_functiondef('document_private.visible(document_private.records,boolean)'::regprocedure),
 'affiliate',pg_get_functiondef('document_private.capture_affiliate_fields()'::regprocedure));
alter table document_private.records drop constraint records_business_version_check;
alter table document_private.records add constraint records_business_version_check check(business_version>=1);
alter table document_private.layouts drop constraint layouts_engine_version_check;
alter table document_private.layouts add constraint layouts_engine_version_check check(engine_version in ('suti-layout-1','suti-layout-2','suti-layout-3'));
create or replace function public.document_layout_persist(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare prog text:=p_data->>'program';typ text:=p_data->>'document_type';actor uuid:=(p_data->>'actor')::uuid;context_id uuid:=(p_data->>'context_affiliate')::uuid;resource uuid:=(p_data->>'id')::uuid;v document_private.layouts%rowtype;revision integer;layout_id uuid;existing document_private.layout_activations%rowtype;
begin
 if actor is null or resource is null or p_action not in ('SAVE','ACTIVATE','SYSTEM') then raise exception 'DOCUMENT_LAYOUT_WRITE_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('document_layout:'||prog||':'||typ,0));
 if not exists(select 1 from document_private.configurations where program=prog and document_type=typ) then raise exception 'DOCUMENT_CONFIGURATION_MISSING';end if;
 if p_action='SAVE' then
  select * into v from document_private.layouts where id=resource;
  if v.id is not null then
   if v.program is distinct from prog or v.document_type is distinct from typ or v.created_by is distinct from actor or v.definition is distinct from p_data->'definition' or v.template_id is distinct from (p_data->>'template_id')::uuid then raise exception 'DOCUMENT_LAYOUT_RETRY_CONFLICT';end if;
   return to_jsonb(v)-array['created_by','context_affiliate'];
  end if;
  select coalesce(max(version),0)+1 into revision from document_private.layouts where program=prog and document_type=typ;
  insert into document_private.layouts(id,program,document_type,version,template_id,contract_version,engine_version,definition,created_by,context_affiliate)
  values(resource,prog,typ,revision,(p_data->>'template_id')::uuid,case when p_data#>>'{definition,version}'in ('suti-layout-2','suti-layout-3') then '2' else '1' end,p_data#>>'{definition,version}',p_data->'definition',actor,context_id) returning * into v;
 else
  layout_id:=case when p_action='SYSTEM' then null else (p_data->>'layout_id')::uuid end;
  if p_action='ACTIVATE' and not exists(select 1 from document_private.layouts where id=layout_id and program=prog and document_type=typ) then raise exception 'DOCUMENT_LAYOUT_SCOPE_DENIED';end if;
  select * into existing from document_private.layout_activations where id=resource;
  if existing.id is not null then
   if existing.program is distinct from prog or existing.document_type is distinct from typ or existing.layout_id is distinct from layout_id or existing.created_by is distinct from actor then raise exception 'DOCUMENT_LAYOUT_RETRY_CONFLICT';end if;
   return jsonb_build_object('id',resource,'layout_id',layout_id);
  end if;
  insert into document_private.layout_activations(id,program,document_type,layout_id,created_by,context_affiliate) values(resource,prog,typ,layout_id,actor,context_id);
 end if;
 insert into document_private.audit(actor,context_affiliate,action,resource_id,details) values(actor,context_id,'LAYOUT_'||p_action,resource,jsonb_build_object('program',prog,'document_type',typ));
 return case when p_action='SAVE' then to_jsonb(v)-array['created_by','context_affiliate'] else jsonb_build_object('id',resource,'layout_id',layout_id) end;
end $$;
revoke all on function public.document_layout_persist(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.document_layout_persist(text,jsonb) to service_role;


create function document_private.capture_deposit_fields() returns trigger language plpgsql security definer set search_path='' as $$
declare bank jsonb;
begin
 if new.document_type<>'LOAN_APPROVAL' then return new;end if;
 select jsonb_build_object('bank_name',b.bank_name,'account_holder',b.account_holder,'card_number',b.card_number,'clabe',b.clabe,'card_last4',right(b.card_number,4),'clabe_last4',right(b.clabe,4),'disclosure','FULL_DEPOSIT','source','loan_request_deposit_snapshots') into bank
 from public.loan_request_deposit_snapshots b where b.request_id=new.operation_id;
 if bank is not null then
  new.source_snapshot:=jsonb_set(new.source_snapshot,'{bank}',bank);
  if new.document_snapshot is not null then new.document_snapshot:=jsonb_set(new.document_snapshot,'{bank}',bank);end if;
 end if;
 return new;
end $$;
revoke all on function document_private.capture_deposit_fields() from public,anon,authenticated,service_role;
create trigger document_deposit_fields before insert on document_private.records for each row execute function document_private.capture_deposit_fields();

create or replace function document_private.visible(r document_private.records,p_admin boolean) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and case when p_admin then
  case when r.domain='program' then public.has_admin_permission('program_requests.read') and public.admin_request_module_boundary(r.operation_id)
   else public.has_admin_permission('savings.read') and public.admin_module_boundary(array['savings']) end
  else r.affiliate_id=public.get_effective_affiliate_id() end
 and case when r.domain='program' then exists(select 1 from public.program_requests where id=r.operation_id and affiliate_id=r.affiliate_id)
 else exists(select 1 from public.savings_requests q join public.savings_participants p on p.id=q.participant_id where q.id=r.operation_id and p.affiliate_id=r.affiliate_id) end;
$$;

-- A correction copies the sealed business event; it never changes a request or replays approval.
create function document_private.reissue(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old document_private.records%rowtype;existing document_private.records%rowtype;cfg jsonb;snapshot jsonb;revision integer;resource uuid:=(p_data->>'revision_id')::uuid;parent uuid:=(p_data->>'id')::uuid;uid uuid:=auth.uid();
begin
 if uid is null or not public.has_admin_permission('document_generation.retry') or not public.has_admin_permission('document_generation.config.write') then raise exception 'DOCUMENT_PERMISSION_DENIED';end if;
 select * into old from document_private.records where id=parent;
 if old.id is null or not document_private.visible(old,true) then raise exception 'DOCUMENT_ACCESS_DENIED';end if;
 if resource is null then raise exception 'DOCUMENT_REVISION_ID_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('document_revision:'||old.domain||':'||old.operation_id::text||':'||old.document_type,0));
 select * into existing from document_private.records where id=resource;
 if existing.id is not null then
  if existing.source_snapshot#>>'{revision,parent_id}' is distinct from parent::text or existing.source_snapshot#>>'{revision,actor}' is distinct from uid::text then raise exception 'DOCUMENT_REVISION_RETRY_CONFLICT';end if;
  return jsonb_build_object('id',existing.id,'status',existing.status,'business_version',existing.business_version);
 end if;
 if not (select enabled from document_private.installation) then raise exception 'DOCUMENT_GENERATION_DISABLED';end if;
 if old.status<>'READY' or old.document_snapshot is null then raise exception 'DOCUMENT_NOT_READY';end if;
 select max(business_version) into revision from document_private.records where domain=old.domain and operation_id=old.operation_id and final_event_id=old.final_event_id and document_type=old.document_type;
 if revision<>old.business_version then raise exception 'DOCUMENT_REVISION_ALREADY_EXISTS';end if;
 cfg:=document_private.resolve_configuration(old.program,old.document_type,clock_timestamp());
 -- Historical signers stay attached to the authorization, even if the current roster changed.
 snapshot:=old.source_snapshot||jsonb_build_object('revision',jsonb_build_object('parent_id',parent,'actor',uid,'created_at',clock_timestamp()));
 insert into document_private.records(id,domain,operation_id,final_event_id,document_type,business_version,affiliate_id,program,folio,occurred_at,source_snapshot,document_snapshot)
 values(resource,old.domain,old.operation_id,old.final_event_id,old.document_type,revision+1,old.affiliate_id,old.program,old.folio,old.occurred_at,snapshot,
 snapshot||cfg||jsonb_build_object('signers',old.document_snapshot->'signers'));
 insert into document_private.audit(actor,context_affiliate,action,resource_id,details) values(uid,public.get_effective_affiliate_id(),'REISSUE',resource,jsonb_build_object('parent_id',parent,'business_version',revision+1));
 return jsonb_build_object('id',resource,'status','PENDING','business_version',revision+1);
end $$;
revoke all on function document_private.reissue(jsonb) from public,anon,authenticated,service_role;
-- Narrow, guarded patches preserve the existing configuration and access command paths.
do $$ declare definition text;patched text;begin
 definition:=pg_get_functiondef('public.document_generation_command(text,jsonb)'::regprocedure);
 if position('if p_action=''DASHBOARD'' then' in definition)=0 or position('''document_type'',q.document_type' in definition)=0 then raise exception 'DOCUMENT_COMMAND_BASELINE_DRIFT';end if;
 patched:=replace(definition,'if p_action=''DASHBOARD'' then','if p_action=''REISSUE'' then return document_private.reissue(p_data);end if; if p_action=''DASHBOARD'' then');
 patched:=replace(patched,'''document_type'',q.document_type','''business_version'',q.business_version,''can_reissue'',coalesce((p_data->>''admin'')::boolean,false) and public.has_admin_permission(''document_generation.retry'') and public.has_admin_permission(''document_generation.config.write'') and q.status=''READY'' and not exists(select 1 from document_private.records newer where newer.domain=q.domain and newer.operation_id=q.operation_id and newer.final_event_id=q.final_event_id and newer.document_type=q.document_type and newer.business_version>q.business_version),''document_type'',q.document_type');
 execute patched;
 definition:=pg_get_functiondef('document_private.capture_affiliate_fields()'::regprocedure);
 if position('begin' in definition)=0 then raise exception 'DOCUMENT_AFFILIATE_BASELINE_DRIFT';end if;
 execute replace(definition,'begin','begin if new.business_version>1 then return new;end if;');
 update document_private.installation set deposit_recovery=deposit_recovery||jsonb_build_object('command_hash',md5(pg_get_functiondef('public.document_generation_command(text,jsonb)'::regprocedure)),'visible_hash',md5(pg_get_functiondef('document_private.visible(document_private.records,boolean)'::regprocedure)),'affiliate_hash',md5(pg_get_functiondef('document_private.capture_affiliate_fields()'::regprocedure)));
end $$;
notify pgrst,'reload schema';
commit;
