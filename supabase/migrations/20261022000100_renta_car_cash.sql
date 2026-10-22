-- H-RENTA-CAR-CASH-001. New rentals only; historical requests remain untouched.
begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
create schema renta_private;
revoke all on schema renta_private from public,anon,authenticated,service_role;
create table renta_private.settings(id boolean primary key default true check(id),enabled boolean not null default true);
insert into renta_private.settings default values;
create table renta_private.definitions(signature text primary key,definition text not null,installed_hash text);
alter table renta_private.settings enable row level security;
alter table renta_private.settings force row level security;
alter table renta_private.definitions enable row level security;
alter table renta_private.definitions force row level security;
revoke all on all tables in schema renta_private from public,anon,authenticated,service_role;
-- Dedicated cash rental API. Existing request/workflow/dossier authorities remain canonical.
alter table public.program_requests add column rental_start date, add column rental_end date;
alter table public.program_requests add constraint renta_car_dates_check check (
 (rental_start is null and rental_end is null) or
 (program_id='renta' and rental_start is not null and rental_end is not null and isfinite(rental_start) and isfinite(rental_end) and rental_end>=rental_start));
create extension if not exists btree_gist with schema extensions;
set local search_path=public,extensions;
alter table public.program_requests add constraint renta_car_no_overlap exclude using gist
 (program_item_id with =, daterange(rental_start,rental_end,'[]') with &&)
 where (program_id='renta' and status='approved' and rental_start is not null);
set local search_path='';

create function renta_private.quote(p_item uuid,p_start date,p_end date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.program_catalog_items%rowtype; a public.affiliates%rowtype; days integer; total numeric;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 select * into a from public.affiliates where id=public.get_effective_affiliate_id();
 if a.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501';end if;
 select * into i from public.program_catalog_items where id=p_item and program_key='renta' and enabled and not sold and request_mode='supabase' and commercial_mode<>'DIRECT_CONTACT' for share;
 if i.id is null or i.price_cash is null or i.price_cash<=0 or i.requires_quote then raise exception 'RENTA_VEHICLE_UNAVAILABLE';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start<(now() at time zone 'America/Hermosillo')::date or p_end<p_start then raise exception 'RENTA_DATES_INVALID';end if;
 if exists(select 1 from public.program_requests r where r.program_item_id=i.id and r.status='approved' and r.rental_start is not null and daterange(r.rental_start,r.rental_end,'[]')&&daterange(p_start,p_end,'[]')) then raise exception 'RENTA_DATES_UNAVAILABLE';end if;
 days:=p_end-p_start+1;total:=round(i.price_cash*days,2);
 return jsonb_build_object('contract_version','RENTA_CAR_CASH_V1','product',jsonb_build_object('id',i.id,'name',i.name,'program_key','renta'),
 'rental',jsonb_build_object('start_date',p_start,'end_date',p_end,'days',days,'daily_rate',i.price_cash,'total',total,'payment_due_date',p_start,'payment_count',1,'payment_method','CONTADO','contract_status','PENDING_CREATION','signature_on_pdf',false),
 'financialResult',jsonb_build_object('fund','Renta Car','amount',0,'rate',0,'paymentCount',1,'paymentPeriod','CONTADO','interest',0,'administrativeFeeTotal',0,'total',total,'paymentPerPeriod',total),
 'applicant',jsonb_build_object('affiliate_id',a.id,'numero_control',a.numero_control,'full_name',a.full_name,'rfc',a.rfc_raw,'curp',a.curp_raw,'phone',a.phone_raw,'email',a.historical_email_raw,'address',a.address_raw,'city',a.city_raw),
 'confirmed_at',now());
end $$;

create function public.renta_car_context(p_item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.program_catalog_items%rowtype; day date:=(now() at time zone 'America/Hermosillo')::date;
begin
 if auth.uid() is null or public.get_effective_affiliate_id() is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501';end if;
 select * into i from public.program_catalog_items where id=p_item and program_key='renta' and enabled and not sold and request_mode='supabase' and commercial_mode<>'DIRECT_CONTACT';
 if i.id is null or i.price_cash is null or i.price_cash<=0 or i.requires_quote then raise exception 'RENTA_VEHICLE_UNAVAILABLE';end if;
 return jsonb_build_object('today',day,'daily_rate',i.price_cash,'booked',coalesce((select jsonb_agg(jsonb_build_object('start',rental_start,'end',rental_end) order by rental_start) from public.program_requests where program_item_id=p_item and status='approved' and rental_end>=day),'[]'));
end $$;
create function public.renta_car_quote(p_item uuid,p_start date,p_end date) returns jsonb language sql security definer set search_path='' as $$select renta_private.quote(p_item,p_start,p_end)$$;

create function renta_private.guard() returns trigger language plpgsql security definer set search_path='' as $$
declare q jsonb;
begin
 if tg_op='INSERT' then
  if new.program_id<>'renta' then return new;end if;
  if not exists(select 1 from renta_private.settings where enabled) then raise exception 'RENTA_DISABLED';end if;
  if new.rental_start is null or new.rental_end is null or new.affiliate_id is distinct from public.get_effective_affiliate_id() or new.actor_real_auth_user_id is distinct from auth.uid() or new.status<>'requires_financial_processing' or new.request_type<>'benefit' or new.signature_data is null or length(new.signature_data)>1000000 or new.signature_data!~'^data:image/png;base64,' or new.terms_accepted is distinct from true then raise exception 'RENTA_CONFIRMATION_REQUIRED';end if;
  q:=renta_private.quote(new.program_item_id,new.rental_start,new.rental_end);
  new.financial_submission_snapshot:=q;
  new.applicant_profile_snapshot:=q->'applicant';
  new.requested_amount:=(q#>>'{rental,total}')::numeric;
  new.requested_term:=1;new.requested_term_semantics:='CONTADO';new.financial_processing_status:='pending';
  new.terms_version_id:=null;
 elsif old.rental_start is null then
  if new.rental_start is not null or new.rental_end is not null then raise exception 'RENTA_SNAPSHOT_IMMUTABLE';end if;
 elsif old.rental_start is not null then
  if new.rental_start is distinct from old.rental_start or new.rental_end is distinct from old.rental_end or new.program_item_id is distinct from old.program_item_id or new.program_id is distinct from old.program_id or new.affiliate_id is distinct from old.affiliate_id or new.applicant_profile_snapshot is distinct from old.applicant_profile_snapshot or new.signature_data is distinct from old.signature_data then raise exception 'RENTA_SNAPSHOT_IMMUTABLE';end if;
  if new.status is distinct from old.status and new.status in('approved','cancelled') then
   if auth.uid() is null or not public.has_admin_permission('program_requests.write') or not public.admin_request_module_boundary(old.id) then raise exception 'RENTA_ADMIN_REQUIRED' using errcode='42501';end if;
   if new.status='approved' and (old.status not in('requires_financial_processing','in_review') or new.rental_start<(now() at time zone 'America/Hermosillo')::date) then raise exception 'RENTA_APPROVAL_INVALID';end if;
  end if;
 end if;
 return new;
end $$;
create trigger program_requests_000_renta before insert or update on public.program_requests for each row execute function renta_private.guard();

create function public.renta_car_submit(p_item uuid,p_start date,p_end date,p_daily_rate numeric,p_signature text,p_accepted boolean,p_documents uuid[],p_idempotency uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.affiliates%rowtype;r public.program_requests%rowtype;q jsonb; missing integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 select * into a from public.affiliates where id=public.get_effective_affiliate_id();
 if a.id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501';end if;
 if p_idempotency is null or p_accepted is distinct from true then raise exception 'RENTA_ACCEPTANCE_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(a.id::text||p_idempotency::text,0));
 select * into r from public.program_requests where affiliate_id=a.id and idempotency_key=p_idempotency;
 if r.id is not null then
  if r.actor_real_auth_user_id is distinct from auth.uid() or r.program_id<>'renta' or r.program_item_id is distinct from p_item or r.rental_start is distinct from p_start or r.rental_end is distinct from p_end or (r.financial_submission_snapshot#>>'{rental,daily_rate}')::numeric is distinct from p_daily_rate then raise exception 'IDEMPOTENCY_CONTRACT_MISMATCH';end if;
 else
  q:=renta_private.quote(p_item,p_start,p_end);
  if (q#>>'{rental,daily_rate}')::numeric is distinct from p_daily_rate then raise exception 'CONDITIONS_CHANGED';end if;
  insert into public.program_requests(actor_real_auth_user_id,affiliate_id,numero_control,program_id,program_item_id,request_type,status,quantity,notes,signature_data,terms_accepted,source_context,financial_processing_status,idempotency_key,rental_start,rental_end)
  values(auth.uid(),a.id,a.numero_control,'renta',p_item,'benefit','requires_financial_processing',1,'Renta Car Â· pago de contado antes de entrega',p_signature,true,jsonb_build_object('source','sutiapp','flow','RENTA_CAR_CASH_V1','contract_pending',true),'pending',p_idempotency,p_start,p_end) returning * into r;
  select count(*) into missing from jsonb_array_elements(r.document_requirements_snapshot) req where coalesce((req->>'required')::boolean,true) and not exists(
   select 1 from public.affiliate_documents d left join public.affiliate_files af on af.id=d.affiliate_file_id
   join public.private_assets pa on pa.id=coalesce(d.private_asset_id,af.private_asset_id) and pa.status='READY'
   join storage.objects so on so.bucket_id=pa.storage_bucket and so.name=pa.storage_path
   where d.id=any(coalesce(p_documents,'{}')) and d.affiliate_id=a.id and d.document_type_id=(req->>'document_type_id')::uuid and d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')
   and not exists(select 1 from public.affiliate_documents newer where newer.affiliate_id=d.affiliate_id and newer.document_type_id=d.document_type_id and (newer.created_at,newer.id)>(d.created_at,d.id)));
  if missing>0 then raise exception 'REQUIRED_DOCUMENTS_MISSING';end if;
  perform public.attach_request_documents(r.id,coalesce(p_documents,'{}'));
  insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata) values(auth.uid(),a.id,'program_requests','RENTA_CAR_SUBMITTED',r.id,jsonb_build_object('days',p_end-p_start+1));
 end if;
 return jsonb_build_object('id',r.id,'folio',r.folio,'status',r.status,'snapshot',r.financial_submission_snapshot,'workflow_state',public.resolve_program_request_workflow_state(r.id));
end $$;

create function public.renta_car_admin(p_request uuid,p_action text,p_comment text,p_action_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.program_requests%rowtype;e public.program_request_admin_events%rowtype; next_status text;label text;state jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('program_requests.write') or not public.admin_request_module_boundary(p_request) then raise exception 'RENTA_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_action is null or p_action not in('APPROVE','CANCEL') or p_action_id is null then raise exception 'RENTA_ACTION_INVALID';end if;
 if length(coalesce(p_comment,''))>2000 or (p_action='CANCEL' and length(btrim(coalesce(p_comment,'')))<3) then raise exception 'PROGRAM_REQUEST_COMMENT_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_action_id::text,0));
 select * into e from public.program_request_admin_events where client_action_id=p_action_id;
 if e.id is not null then
  if e.request_id<>p_request or e.actor_auth_user_id<>auth.uid() or e.action<>p_action then raise exception 'CLIENT_ACTION_ID_CONFLICT';end if;
  return jsonb_build_object('id',p_request,'status',e.to_status,'idempotent',true);
 end if;
 select * into r from public.program_requests where id=p_request for update;
 if r.id is null or r.program_id<>'renta' or r.rental_start is null then raise exception 'RENTA_REQUEST_NOT_FOUND';end if;
 if p_action='APPROVE' then
  if r.status='approved' then return jsonb_build_object('id',r.id,'status',r.status,'idempotent',true);end if;
  if r.status not in('requires_financial_processing','in_review') then raise exception 'RENTA_APPROVAL_INVALID';end if;
  state:=public.resolve_program_request_workflow_state(r.id);
  if not coalesce((state->>'available')::boolean,false) or not coalesce((select s->'status_references'?'approved' from jsonb_array_elements(state->'stages') s where s->>'state'='upcoming' limit 1),false) then raise exception 'REQUEST_WORKFLOW_UNAVAILABLE';end if;
  -- Exclusion constraint serializes approval, even across independent sessions.
  update public.program_requests set status='approved',financial_processing_status='completed',financial_approval_snapshot=financial_submission_snapshot||jsonb_build_object('approval_contract_version','RENTA_CAR_CASH_APPROVAL_V1','approved_at',now(),'approved_by',auth.uid()),financial_approved_at=now(),financial_approved_by=auth.uid() where id=r.id;
  next_status:='approved';
 else
  if r.status not in('submitted','requires_financial_processing','in_review','approved') then raise exception 'RENTA_CANCELLATION_INVALID';end if;
  update public.program_requests set status='cancelled' where id=r.id;next_status:='cancelled';
 end if;
 select coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Personal autorizado') into label from auth.users where id=auth.uid();
 insert into public.program_request_admin_events(request_id,actor_auth_user_id,actor_label,action,from_status,to_status,comment,client_action_id) values(r.id,auth.uid(),left(label,160),p_action,r.status,next_status,nullif(btrim(p_comment),''),p_action_id);
 insert into public.sensitive_change_audit(actor_auth_user_id,affiliate_id,resource,action,target_id,metadata) values(auth.uid(),r.affiliate_id,'program_requests','RENTA_CAR_'||p_action,r.id,jsonb_build_object('from_status',r.status,'to_status',next_status));
 return jsonb_build_object('id',r.id,'status',next_status,'workflow_state',public.resolve_program_request_workflow_state(r.id));
exception when exclusion_violation then raise exception 'RENTA_DATES_UNAVAILABLE' using errcode='23P01';
end $$;

create function public.renta_car_detail(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.program_requests%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 select * into r from public.program_requests where id=p_request and program_id='renta' and rental_start is not null;
 if r.id is null or not coalesce(r.affiliate_id=public.get_effective_affiliate_id() or (public.has_admin_permission('program_requests.read') and public.admin_request_module_boundary(r.id)),false) then raise exception 'RENTA_ACCESS_DENIED' using errcode='42501';end if;
 return jsonb_build_object('id',r.id,'status',r.status,'folio',r.folio,'created_at',r.created_at,'snapshot',r.financial_submission_snapshot,'approval',r.financial_approval_snapshot);
end $$;
revoke all on all functions in schema renta_private from public,anon,authenticated,service_role;
revoke all on function public.renta_car_context(uuid),public.renta_car_quote(uuid,date,date),public.renta_car_submit(uuid,date,date,numeric,text,boolean,uuid[],uuid),public.renta_car_admin(uuid,text,text,uuid),public.renta_car_detail(uuid) from public,anon,authenticated,service_role;
grant execute on function public.renta_car_context(uuid),public.renta_car_quote(uuid,date,date),public.renta_car_submit(uuid,date,date,numeric,text,boolean,uuid[],uuid),public.renta_car_admin(uuid,text,text,uuid),public.renta_car_detail(uuid) to authenticated;

do $guard$ begin if md5(pg_get_functiondef('public.enforce_program_catalog_requestability()'::regprocedure))<>'9ca03b2c4d8907ace959dae72346655b' then raise exception 'RENTA_BASELINE_DRIFT: enforce_program_catalog_requestability';end if;end $guard$;
insert into renta_private.definitions values ('public.enforce_program_catalog_requestability()',pg_get_functiondef('public.enforce_program_catalog_requestability()'::regprocedure),null);
CREATE OR REPLACE FUNCTION public.enforce_program_catalog_requestability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_item public.program_catalog_items%rowtype;
begin
  if new.program_item_id is null then return new; end if;
  select * into v_item from public.program_catalog_items where id=new.program_item_id;
  if v_item.id is null then raise exception 'PROGRAM_PRODUCT_NOT_FOUND' using errcode='P0001'; end if;
  if v_item.sold then raise exception 'PROGRAM_PRODUCT_SOLD' using errcode='P0001'; end if;
  if v_item.commercial_mode='DIRECT_CONTACT' then
    raise exception 'PROGRAM_PRODUCT_DIRECT_CONTACT_ONLY' using errcode='P0001';
  end if;
  if v_item.program_key='renta' and new.program_id='renta' and new.rental_start is not null and new.financial_submission_snapshot->>'contract_version'='RENTA_CAR_CASH_V1' then return new; end if;
  if v_item.program_key='prestamo' then return new; end if;
  if v_item.commercial_mode='PAYROLL_QUOTE' and new.request_type='quote'
     and new.financial_submission_snapshot is null then return new; end if;
  if new.request_type='benefit'
     and new.financial_submission_snapshot->>'contract_version'='PROGRAM_PRODUCT_PAYMENT_V1' then return new; end if;
  raise exception 'PROGRAM_PRODUCT_PAYMENT_FLOW_REQUIRED' using errcode='P0001';
end $function$
;
update renta_private.definitions set installed_hash=md5(pg_get_functiondef('public.enforce_program_catalog_requestability()'::regprocedure)) where signature='public.enforce_program_catalog_requestability()';

do $guard$ begin if md5(pg_get_functiondef('public.protect_approved_financial_request_state()'::regprocedure))<>'e5938647fbe2b10d5383e4c5354a5c4c' then raise exception 'RENTA_BASELINE_DRIFT: protect_approved_financial_request_state';end if;end $guard$;
insert into renta_private.definitions values ('public.protect_approved_financial_request_state()',pg_get_functiondef('public.protect_approved_financial_request_state()'::regprocedure),null);
CREATE OR REPLACE FUNCTION public.protect_approved_financial_request_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin
  if old.program_id='renta' and old.rental_start is not null and old.status='approved' and new.status='cancelled' and auth.uid() is not null and public.has_admin_permission('program_requests.write') and public.admin_request_module_boundary(old.id) then return new; end if;
  if old.financial_approval_snapshot is not null and new.status is distinct from old.status then
    raise exception 'APPROVED_FINANCIAL_REQUEST_STATUS_IMMUTABLE' using errcode='P0001';
  end if;
  return new;
end $function$
;
update renta_private.definitions set installed_hash=md5(pg_get_functiondef('public.protect_approved_financial_request_state()'::regprocedure)) where signature='public.protect_approved_financial_request_state()';

do $guard$ begin if md5(pg_get_functiondef('public.list_self_program_request_history()'::regprocedure))<>'eba027e381df956549b77f86ddfa82e5' then raise exception 'RENTA_BASELINE_DRIFT: list_self_program_request_history';end if;end $guard$;
insert into renta_private.definitions values ('public.list_self_program_request_history()',pg_get_functiondef('public.list_self_program_request_history()'::regprocedure),null);
CREATE OR REPLACE FUNCTION public.list_self_program_request_history()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_affiliate_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  v_affiliate_id:=public.get_effective_affiliate_id();
  if v_affiliate_id is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  return query
  select jsonb_strip_nulls(jsonb_build_object(
    'id',r.id,'folio',r.folio,'program_id',r.program_id,'program_item_id',r.program_item_id,'product_id',r.product_id,
    'membership_offering_id',r.membership_offering_id,'company_id',r.company_id,'request_type',r.request_type,'status',r.status,
    'rental',case when r.rental_start is not null then r.financial_submission_snapshot->'rental' end,'quantity',r.quantity,'notes',r.notes,'financial_processing_status',r.financial_processing_status,
    'requested_amount',r.requested_amount,'requested_term',r.requested_term,'requested_term_semantics',r.requested_term_semantics,
    'quoted_amount',r.quoted_amount,'quote_note',r.quote_note,'valid_until',r.valid_until,'responded_at',r.responded_at,
    'created_at',r.created_at,'updated_at',r.updated_at,
    'workflow_state',public.resolve_program_request_workflow_state(r.id),
    'decision_comment',(select e.comment from public.program_request_admin_events e where e.request_id=r.id and e.action in('REJECT','CANCEL') order by e.created_at desc,e.id desc limit 1),
    'google_sync',public.get_program_request_google_sync(r.id),
    'program_item',case when pi.id is null then null else jsonb_build_object('name',pi.name,'program_key',pi.program_key,'price_cash',pi.price_cash) end,
    'product',case when p.id is null then null else jsonb_build_object('name',p.name,'price',p.price) end,
    'membership',case when m.id is null then null else jsonb_build_object('company_raw',m.company_raw,'concept',m.concept,'amount',m.amount) end,
    'company',case when c.id is null then null else jsonb_build_object('display_name',c.display_name) end
  ))
  from public.program_requests r
  left join public.program_catalog_items pi on pi.id=r.program_item_id
  left join public.marketplace_products p on p.id=r.product_id
  left join public.membership_offerings m on m.id=r.membership_offering_id
  left join public.companies c on c.id=r.company_id
  where r.affiliate_id=v_affiliate_id order by r.created_at desc,r.id desc;
end $function$
;
update renta_private.definitions set installed_hash=md5(pg_get_functiondef('public.list_self_program_request_history()'::regprocedure)) where signature='public.list_self_program_request_history()';

do $guard$ begin if md5(pg_get_functiondef('document_private.capture_event()'::regprocedure))<>'851166a787504e472348082f6bdf14a3' then raise exception 'RENTA_BASELINE_DRIFT: document_private.capture_event';end if;end $guard$;
insert into renta_private.definitions values ('document_private.capture_event()',pg_get_functiondef('document_private.capture_event()'::regprocedure),null);
CREATE OR REPLACE FUNCTION document_private.capture_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare op jsonb;identity jsonb;source jsonb;typ text;prog text;af uuid;oid uuid;happened timestamptz;config jsonb;err text;
begin
 if not exists(select 1 from document_private.installation where enabled) then return new;end if;
 if tg_table_name='program_request_admin_events' then
  if new.to_status<>'approved' or new.from_status='approved' then return new;end if;
  select to_jsonb(r) into op from public.program_requests r where r.id=new.request_id;
  typ:=case when op->>'program_id'='renta' and op#>>'{financial_approval_snapshot,approval_contract_version}'='RENTA_CAR_CASH_APPROVAL_V1' then 'RENTA_CAR_APPROVAL' when op->>'membership_offering_id' is not null then 'MEMBERSHIP_APPROVAL'
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
  source:=jsonb_set(source,'{operation,financial}',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(source#>'{operation,financial}') where key=any(array['contract_version','approval_contract_version','financialResult','product','offering','authorized_price','price_source','down_payment','financed_amount','financing_conditions','payment_schedule','rental','applicant'])));
 end if;
 select jsonb_build_object('affiliate_id',a.id,'numero_control',a.numero_control,'full_name',a.full_name,'union_code',a.financial_union_code,'category_code',a.financial_employee_category_code,'unit',a.unit_raw) into identity from public.affiliates a where a.id=af;
 if typ='RENTA_CAR_APPROVAL' then identity:=coalesce(op#>'{financial_submission_snapshot,applicant}','{}'::jsonb)||jsonb_build_object('affiliate',op#>'{financial_submission_snapshot,applicant}');end if;
 source:=source||jsonb_build_object('identity',identity,'domain',case when tg_table_name='program_request_admin_events' then 'program' else 'savings' end,'event_id',new.id,'document_type',typ,'contract_version','1','renderer_version','pdf-lib-1.17.1/suti-1');
 source:=source||jsonb_build_object('layout_scope_version','1'); begin config:=document_private.resolve_scoped_layout(prog,typ,happened,source);exception when others then err:=case when sqlerrm like 'DOCUMENT_%' then sqlerrm else 'DOCUMENT_CONFIGURATION_INVALID' end;end;
 insert into document_private.records(domain,operation_id,final_event_id,document_type,affiliate_id,program,folio,occurred_at,source_snapshot,document_snapshot,status,error_code)
 values(source->>'domain',oid,new.id::text,typ,af,prog,op->>'folio',happened,source,case when config is not null then source||config end,case when err is null then 'PENDING' else 'FAILED' end,err)
 on conflict(domain,operation_id,final_event_id,document_type,business_version) do nothing;return new;
end $function$
;
update renta_private.definitions set installed_hash=md5(pg_get_functiondef('document_private.capture_event()'::regprocedure)) where signature='document_private.capture_event()';

-- A dedicated document type cannot accidentally use the loan PDF assignment.
do $$declare c record;updated text;n integer:=0;begin
 for c in select conname,pg_get_constraintdef(oid) def from pg_constraint where conrelid='document_private.configurations'::regclass and contype='c' and pg_get_constraintdef(oid) like '%LOAN_APPROVAL%' loop
  n:=n+1;
  updated:=replace(c.def,'''LOAN_APPROVAL''::text','''RENTA_CAR_APPROVAL''::text, ''LOAN_APPROVAL''::text');
  if updated=c.def then raise exception 'RENTA_DOCUMENT_CONSTRAINT_DRIFT';end if;
  insert into renta_private.definitions(signature,definition) values('constraint:'||c.conname,c.def);
  execute format('alter table document_private.configurations drop constraint %I',c.conname);
  execute format('alter table document_private.configurations add constraint %I %s',c.conname,updated);
 end loop;
 if n<>1 then raise exception 'RENTA_DOCUMENT_CONSTRAINT_DRIFT';end if;
end $$;
commit;
