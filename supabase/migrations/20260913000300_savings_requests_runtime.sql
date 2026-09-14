begin;
-- H-SAVINGS-RUNTIME-001: Savings-only requests. No source/history rewrites or publication.
-- Requires operations 001/retirement 002, certified accounts and publication-state schema.
create table public.savings_requests_runtime_backup(signature text primary key,definition text not null);
alter table public.savings_requests_runtime_backup enable row level security;
alter table public.savings_requests_runtime_backup force row level security;
revoke all on public.savings_requests_runtime_backup from public,anon,authenticated,service_role;
insert into public.savings_requests_runtime_backup
 select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
 and proname in ('submit_self_savings_request','admin_review_savings_request','admin_settle_savings_request');

create function public.savings_runtime_assert_identity(p_participant_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.savings_participants%rowtype;
begin
 lock table public.affiliates in share mode;
 select * into p from public.savings_participants where id=p_participant_id for update;
 if p.id is null or p.identity_status<>'RESOLVED' or (select count(*) from public.affiliates where numero_control=p.legacy_folio)<>1
 or not exists(select 1 from public.affiliates where id=p.affiliate_id and numero_control=p.legacy_folio and not coalesce(is_archived,false)) then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED';
 end if;
 return p.affiliate_id;
end $$;

create function public.savings_runtime_submit(p_affiliate_id uuid,p_command jsonb,p_key uuid,p_admin boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); af public.affiliates%rowtype; p public.savings_participants%rowtype;
 en public.savings_enrollments%rowtype; r public.savings_requests%rowtype; bal record;
 typ text:=upper(p_command->>'type'); proc text; amt numeric; contribution numeric; available_value numeric; next_date date; keep_saving boolean;
 kind text; doc uuid; note text:=coalesce(p_command->>'observation',''); prior public.savings_audit_events%rowtype;
 command jsonb:=jsonb_build_object('affiliate_id',p_affiliate_id,'command',p_command,'admin',p_admin);
begin
 if actor is null or (p_admin and not public.has_admin_permission('savings.write')) or (not p_admin and p_affiliate_id is distinct from public.get_effective_affiliate_id()) then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501'; end if;
 if not p_admin and not exists(select 1 from public.savings_publication_state where id and mode='PUBLISHED') then raise exception 'SAVINGS_PRIVATE_REVIEW_NOT_PUBLISHED' using errcode='55000'; end if;
 if p_key is null or p_command is null or jsonb_typeof(p_command)<>'object' or typ is null or typ not in ('JOIN','CHANGE_AMOUNT','WITHDRAW','TERMINATE','EXTRAORDINARY_WITHDRAWAL') or length(note)>1000 then raise exception 'SAVINGS_COMMAND_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-runtime:'||p_key,0));
 select * into prior from public.savings_audit_events where client_action_id=p_key;
 if found then
  if prior.actor_real_auth_user_id<>actor or prior.resource<>'savings_runtime' or prior.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
  return prior.after_data->'result';
 end if;
 lock table public.affiliates in share mode;
 select * into af from public.affiliates where id=p_affiliate_id and not coalesce(is_archived,false);
 if af.id is null or af.numero_control is null or (select count(*) from public.affiliates where numero_control=af.numero_control)<>1 then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-folio:'||af.numero_control,0));
 select * into p from public.savings_participants where affiliate_id=af.id or legacy_folio=af.numero_control for update;
 if p.id is null then
  if typ<>'JOIN' then raise exception 'SAVINGS_PARTICIPANT_REQUIRED'; end if;
  if exists(select 1 from public.savings_review_records where source_sheet='Ahorro' and source_folio=af.numero_control) then raise exception 'SAVINGS_OPENING_CONFIRMATION_REQUIRED'; end if;
  insert into public.savings_participants(participant_type,affiliate_id,legacy_folio,display_name,identity_status,certification_status,data_classification)
   values('AFFILIATE',af.id,af.numero_control,af.full_name,'RESOLVED','CERTIFIED','CANONICAL') returning * into p;
 end if;
 perform public.savings_runtime_assert_identity(p.id);
 if p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL' then raise exception 'SAVINGS_OPENING_CONFIRMATION_REQUIRED'; end if;
 select * into en from public.savings_enrollments where participant_id=p.id order by sequence_number desc limit 1 for update;
 if typ='JOIN' then
  if en.id is not null and ((en.status in ('REQUESTED','ACTIVE','TERMINATION_PENDING') and (en.terminated_at is null or (en.terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today())) or (en.terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today()) then raise exception 'SAVINGS_ENROLLMENT_ALREADY_OPEN'; end if;
 elsif en.id is null or en.data_classification<>'CANONICAL' or (typ in ('CHANGE_AMOUNT','TERMINATE') and not (en.status='ACTIVE' and (en.terminated_at is null or (en.terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today()) or en.status in ('TERMINATED','TERMINATION_PENDING') and (en.terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today())) then raise exception 'SAVINGS_ACTIVE_ENROLLMENT_REQUIRED'; end if;
 if typ<>'TERMINATE' and not public.savings_effective_action(case when typ='EXTRAORDINARY_WITHDRAWAL' then 'WITHDRAW' else typ end,p.id) then raise exception 'SAVINGS_ACTION_DISABLED' using errcode='42501'; end if;
 if exists(select 1 from public.savings_requests where participant_id=p.id and status in ('SUBMITTED','UNDER_REVIEW','APPROVED')
   and (request_type=typ and (typ in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') or (typ in ('JOIN','CHANGE_AMOUNT','TERMINATE') and status<>'APPROVED')))) then raise exception 'SAVINGS_PENDING_REQUEST_EXISTS'; end if;
 proc:=case af.financial_employee_category_code when 'JUBILADOS_PENSIONADOS' then 'JUB' when 'SUPLENTES_VARIABLES' then 'PROCESS_3' when 'SUPLENTES_FIJOS' then 'PROCESS_1' when 'EVENTUALES' then 'PROCESS_1' when 'BASE' then 'PROCESS_1' when 'CONFIANZA' then 'PROCESS_1' end;
 if p_admin and p_command->>'process' is not null then proc:=p_command->>'process'; end if;
 if typ in ('JOIN','CHANGE_AMOUNT') then
  if jsonb_typeof(p_command->'new_amount') is distinct from 'number' then raise exception 'SAVINGS_CONTRIBUTION_AMOUNT_REQUIRED'; end if;
  contribution:=(p_command->>'new_amount')::numeric;
  if contribution<200 or contribution>999999999999.99 or contribution<>round(contribution,2) then raise exception 'SAVINGS_MINIMUM_200'; end if;
  if typ='JOIN' then next_date:=public.savings_next_contribution_date(public.savings_operation_today()+30,proc);
  else next_date:=public.savings_next_enrollment_date(en.id,public.savings_operation_today()+30); end if;
 end if;
 if typ in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') then
  select * into bal from public.savings_participant_balance(p.id);
  available_value:=bal.available;
  if jsonb_typeof(p_command->'amount') is distinct from 'number' then raise exception 'SAVINGS_WITHDRAWAL_AMOUNT_INVALID'; end if;
  amt:=(p_command->>'amount')::numeric;
  if amt<=0 or amt<>round(amt,2) or amt>bal.available then raise exception 'SAVINGS_AVAILABLE_BALANCE_EXCEEDED'; end if;
  kind:=case when amt=bal.available then 'TOTAL' else 'PARTIAL' end;
  keep_saving:=case when kind='PARTIAL' then true else coalesce((p_command->>'continue_saving')::boolean,true) end;
  if typ='EXTRAORDINARY_WITHDRAWAL' then
   doc:=nullif(p_command->>'document_id','')::uuid;
   if length(btrim(note))<3 or doc is null or not exists(select 1 from public.affiliate_documents where id=doc and affiliate_id=af.id) then raise exception 'SAVINGS_EXTRAORDINARY_DOCUMENT_REQUIRED'; end if;
   if amt>greatest(bal.capital-bal.held_capital,0) then raise exception 'SAVINGS_EXTRAORDINARY_CAPITAL_ONLY'; end if;
   kind:='EXTRAORDINARY';
  end if;
 elsif typ='TERMINATE' then amt:=0; keep_saving:=false; next_date:=public.savings_operation_today()+1;
 else keep_saving:=true; end if;
 insert into public.savings_requests(folio,participant_id,enrollment_id,request_type,withdrawal_kind,component,requested_amount,new_contribution_amount,continue_saving,supporting_document_id,effective_from,reason,actor_real_auth_user_id,usuario_contexto_affiliate_id,idempotency_key,data_classification,metadata)
 values('AHO-'||to_char(clock_timestamp(),'YYYY')||'-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12)),p.id,case when typ='JOIN' then null else en.id end,typ,kind,
  case when typ='EXTRAORDINARY_WITHDRAWAL' then 'CAPITAL' when typ='WITHDRAW' then 'BOTH' end,amt,contribution,keep_saving,doc,next_date,note,actor,af.id,p_key,'CANONICAL',
  jsonb_build_object('origin','SAVINGS_RUNTIME_V1','submitted_command',command,'process',proc,'cessation_only',typ='TERMINATE','available_when_requested',available_value)) returning * into r;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason,client_action_id)
 values(actor,af.id,p.id,'savings_runtime','SUBMIT',r.id::text,jsonb_build_object('command',command,'result',to_jsonb(r)),note,p_key);
 return to_jsonb(r);
end $$;

-- Adapter boundary only. The existing approved loan authority must supply this contract;
-- absence never means clearance and does not prevent saving/reviewing requests.
create function public.savings_runtime_assert_payout(p_participant_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 raise exception 'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE' using errcode='55000';
end $$;

create function public.admin_save_savings_operation(p_command jsonb,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text:=p_command->>'kind'; r public.savings_requests%rowtype; prior public.savings_audit_events%rowtype;
 en public.savings_enrollments%rowtype; plan public.savings_contribution_plans%rowtype; af uuid; result jsonb; before_row jsonb;
 decision text:=upper(p_command->>'decision'); note text:=coalesce(p_command->>'observation',''); proc text; calculated date; effective date; participant uuid;
 bal record; capital numeric; yield_value numeric; component text; amount numeric;
begin
 if auth.uid() is null or not public.has_admin_permission(case when k='SUBMIT' then 'savings.write' else 'savings.approve' end) then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or p_command is null or jsonb_typeof(p_command)<>'object' or k is null or k not in ('SUBMIT','REVIEW','SETTLE','CANCEL') or length(note)>1000 then raise exception 'SAVINGS_COMMAND_INVALID'; end if;
 if k='SUBMIT' then
  select id into af from public.affiliates where numero_control=p_command->>'folio' and not coalesce(is_archived,false);
  if af is null or (select count(*) from public.affiliates where numero_control=p_command->>'folio')<>1 then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED'; end if;
  return public.savings_runtime_submit(af,p_command,p_client_action_id,true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-runtime:'||p_client_action_id,0));
 select * into prior from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.resource<>'savings_runtime' or prior.after_data->'command' is distinct from p_command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
  return prior.after_data->'result';
 end if;
 select participant_id into participant from public.savings_requests where id=(p_command->>'request_id')::uuid;
 af:=public.savings_runtime_assert_identity(participant);
 select * into r from public.savings_requests where id=(p_command->>'request_id')::uuid for update;
 if r.id is null or r.data_classification<>'CANONICAL' or r.metadata->>'origin'<>'SAVINGS_RUNTIME_V1' then raise exception 'SAVINGS_OPERATIONAL_REQUEST_REQUIRED'; end if;
 if not exists(select 1 from public.savings_participants where id=r.participant_id and data_classification='CANONICAL' and certification_status='CERTIFIED') then raise exception 'SAVINGS_OPENING_CONFIRMATION_REQUIRED'; end if;
 before_row:=to_jsonb(r);
 select * into en from public.savings_enrollments where id=r.enrollment_id for update;
 if k='CANCEL' then
  if r.status not in ('SUBMITTED','UNDER_REVIEW') and not (r.status='APPROVED' and r.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL')) then raise exception 'SAVINGS_REQUEST_NOT_CANCELABLE'; end if;
  update public.savings_requests set status='CANCELLED',metadata=metadata||jsonb_build_object('cancellation',p_command,'cancelled_at',clock_timestamp()) where id=r.id returning * into r;
 elsif k='REVIEW' then
  if decision is null or decision not in ('APPROVE','REJECT') or r.status not in ('SUBMITTED','UNDER_REVIEW') then raise exception 'SAVINGS_REQUEST_NOT_REVIEWABLE'; end if;
  if decision='REJECT' and length(btrim(note))<3 then raise exception 'SAVINGS_REJECTION_REASON_REQUIRED'; end if;
  if decision='APPROVE' then
   if r.request_type='EXTRAORDINARY_WITHDRAWAL' then raise exception 'SAVINGS_DUAL_APPROVAL_REQUIRED' using errcode='42501'; end if;
   if r.request_type in ('JOIN','CHANGE_AMOUNT') then
    proc:=coalesce(nullif(p_command->>'process',''),r.metadata->>'process');
    calculated:=case when r.request_type='JOIN' then public.savings_next_contribution_date((r.submitted_at at time zone 'America/Hermosillo')::date+30,proc)
     else public.savings_next_enrollment_date(en.id,(r.submitted_at at time zone 'America/Hermosillo')::date+30) end;
    effective:=coalesce(nullif(p_command->>'effective_date','')::date,calculated);
    if effective<=public.savings_operation_today() or (r.request_type='JOIN' and public.savings_next_contribution_date(effective,proc)<>effective)
     or (r.request_type='CHANGE_AMOUNT' and public.savings_next_enrollment_date(en.id,effective)<>effective) then raise exception 'SAVINGS_AUTHORIZED_DATE_INVALID'; end if;
    if effective<>calculated and length(btrim(note))<3 then raise exception 'SAVINGS_DATE_EXCEPTION_REASON_REQUIRED'; end if;
    if r.request_type='JOIN' then
     if exists(select 1 from public.savings_enrollments where participant_id=r.participant_id and (status in ('REQUESTED','ACTIVE','TERMINATION_PENDING') or terminated_at>clock_timestamp())) then raise exception 'SAVINGS_ENROLLMENT_ALREADY_OPEN'; end if;
     insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,requested_at,approved_at,first_expected_contribution_date,process_snapshot,data_classification)
     values(r.participant_id,(select coalesce(max(sequence_number),0)+1 from public.savings_enrollments where participant_id=r.participant_id),'ACTIVE',effective::timestamp at time zone 'America/Hermosillo',r.submitted_at,clock_timestamp(),effective,proc,'CANONICAL') returning * into en;
     update public.savings_participants set current_process=proc where id=r.participant_id;
    else
     if not (en.status='ACTIVE' and (en.terminated_at is null or (en.terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today()) or en.status in ('TERMINATED','TERMINATION_PENDING') and (en.terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today()) then raise exception 'SAVINGS_ACTIVE_ENROLLMENT_REQUIRED'; end if;
     perform 1 from public.savings_contribution_plans where enrollment_id=en.id for update;
     if exists(select 1 from public.savings_contribution_plans where enrollment_id=en.id and effective_from>=effective)
      or exists(select 1 from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date>=effective)
      or exists(select 1 from public.savings_transactions where enrollment_id=en.id and coalesce(contribution_date,effective_date)>=effective) then raise exception 'SAVINGS_FUTURE_PLAN_CONFLICT'; end if;
     select * into plan from public.savings_contribution_plans where enrollment_id=en.id and effective_from<effective and (effective_to is null or effective_to>=effective) order by effective_from desc limit 1;
     if plan.id is null or plan.data_classification<>'CANONICAL' then raise exception 'SAVINGS_ACTIVE_PLAN_REQUIRED'; end if;
     proc:=plan.process_snapshot;
     update public.savings_contribution_plans set effective_to=effective-1 where id=plan.id;
    end if;
    insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,effective_to,source_request_id,data_classification,created_by_auth_user_id)
     values(en.id,r.new_contribution_amount,proc,effective,case when r.request_type='CHANGE_AMOUNT' then plan.effective_to end,r.id,'CANONICAL',auth.uid());
   elsif r.request_type='TERMINATE' then
    effective:=coalesce(nullif(p_command->>'effective_date','')::date,public.savings_operation_today()+1);
    if effective<=public.savings_operation_today() then raise exception 'SAVINGS_AUTHORIZED_DATE_INVALID'; end if;
    if effective<>public.savings_operation_today()+1 and length(btrim(note))<3 then raise exception 'SAVINGS_DATE_EXCEPTION_REASON_REQUIRED'; end if;
    if exists(select 1 from public.savings_contribution_plans where enrollment_id=en.id and effective_from>=effective)
     or exists(select 1 from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date>=effective) then raise exception 'SAVINGS_FUTURE_PLAN_CONFLICT'; end if;
    update public.savings_enrollments set status='TERMINATED',continue_saving=false,terminated_at=effective::timestamp at time zone 'America/Hermosillo' where id=en.id;
   elsif r.request_type='WITHDRAW' then
    select * into bal from public.savings_participant_balance(r.participant_id);
    if r.requested_amount>bal.available then raise exception 'SAVINGS_AVAILABLE_BALANCE_EXCEEDED'; end if;
   end if;
  end if;
  update public.savings_requests set status=case when decision='REJECT' then 'REJECTED' else 'APPROVED' end,reviewed_at=clock_timestamp(),reviewed_by_auth_user_id=auth.uid(),
   enrollment_id=coalesce(en.id,enrollment_id),effective_from=coalesce(effective,effective_from),metadata=metadata||jsonb_build_object('review',p_command,'calculated_date',calculated,'authorized_date',effective)
   where id=r.id returning * into r;
 else
  if r.status<>'APPROVED' or r.request_type not in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') then raise exception 'SAVINGS_REQUEST_NOT_SETTLEABLE'; end if;
  if not public.savings_effective_action('WITHDRAW',r.participant_id) then raise exception 'SAVINGS_ACTION_DISABLED' using errcode='42501'; end if;
  if jsonb_typeof(p_command->'capital') is distinct from 'number' or jsonb_typeof(p_command->'yield') is distinct from 'number' then raise exception 'SAVINGS_SETTLEMENT_INVALID'; end if;
  capital:=(p_command->>'capital')::numeric;yield_value:=(p_command->>'yield')::numeric;
  if capital<0 or yield_value<0 or capital<>round(capital,2) or yield_value<>round(yield_value,2) or capital+yield_value<>r.requested_amount then raise exception 'SAVINGS_SETTLEMENT_BREAKDOWN_MISMATCH'; end if;
  select * into bal from public.savings_participant_balance(r.participant_id);
  if capital>greatest(bal.capital-bal.held_capital,0) or yield_value>greatest(bal.yield_amount-bal.held_yield,0) then raise exception 'SAVINGS_AVAILABLE_BALANCE_EXCEEDED'; end if;
  if r.request_type='EXTRAORDINARY_WITHDRAWAL' and yield_value<>0 then raise exception 'SAVINGS_EXTRAORDINARY_CAPITAL_ONLY'; end if;
  if r.continue_saving=false and capital+yield_value<>bal.available then raise exception 'SAVINGS_TOTAL_WITHDRAWAL_AMOUNT_MISMATCH'; end if;
  perform public.savings_runtime_assert_payout(r.participant_id);
  foreach component in array array['CAPITAL','YIELD'] loop
   amount:=case when component='CAPITAL' then capital else yield_value end;
   if amount>0 then insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification,created_by_auth_user_id)
    values(r.participant_id,r.enrollment_id,'WITHDRAWAL',component,'DEBIT',amount,public.savings_operation_today(),'SAVINGS_RUNTIME_PAYMENT:'||r.id||':'||component,'CANONICAL',auth.uid()); end if;
  end loop;
  update public.savings_requests set status='SETTLED',settled_at=clock_timestamp(),requested_capital_amount=capital,requested_yield_amount=yield_value where id=r.id returning * into r;
  if r.continue_saving=false then update public.savings_enrollments set status='TERMINATED',continue_saving=false,terminated_at=(public.savings_operation_today()+1)::timestamp at time zone 'America/Hermosillo' where id=r.enrollment_id; end if;
 end if;
 result:=to_jsonb(r);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),af,r.participant_id,'savings_runtime',case when k='REVIEW' then decision else k end,r.id::text,before_row,jsonb_build_object('command',p_command,'result',result),note,p_client_action_id);
 return result;
end $$;

create or replace function public.submit_self_savings_request(p_request_type text,p_amount numeric,p_component text,p_withdrawal_kind text,p_new_contribution_amount numeric,p_continue_saving boolean,p_effective_from date,p_reason text,p_supporting_document_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return public.savings_runtime_submit(public.get_effective_affiliate_id(),jsonb_build_object('type',p_request_type,'amount',p_amount,'new_amount',p_new_contribution_amount,'continue_saving',p_continue_saving,'observation',p_reason,'document_id',p_supporting_document_id),p_idempotency_key,false);
end $$;
create or replace function public.admin_review_savings_request(p_request_id uuid,p_decision text,p_reason text,p_effective_from date,p_first_expected_contribution_date date,p_process text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cmd jsonb:=jsonb_build_object('kind','REVIEW','request_id',p_request_id,'decision',p_decision,'observation',p_reason,'effective_date',coalesce(p_first_expected_contribution_date,p_effective_from),'process',p_process);
begin return public.admin_save_savings_operation(cmd,md5(auth.uid()::text||cmd::text)::uuid); end $$;
create or replace function public.admin_settle_savings_request(p_request_id uuid,p_capital_amount numeric,p_yield_amount numeric,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin return public.admin_save_savings_operation(jsonb_build_object('kind','SETTLE','request_id',p_request_id,'capital',p_capital_amount,'yield',p_yield_amount,'observation',p_reason),p_client_action_id); end $$;

create function public.get_admin_savings_runtime_requests(p_folio text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
 return jsonb_build_object('requests',coalesce((select jsonb_agg(x.data order by x.submitted_at desc) from (
  select to_jsonb(r)-array['metadata','idempotency_key','supporting_document_id']||jsonb_build_object('saver_folio',p.legacy_folio,'name',p.display_name,'process',coalesce(r.metadata->>'process',p.current_process),
   'can_review',public.has_admin_permission('savings.approve') and r.status in ('SUBMITTED','UNDER_REVIEW'),
   'can_cancel',public.has_admin_permission('savings.approve') and (r.status in ('SUBMITTED','UNDER_REVIEW') or (r.status='APPROVED' and r.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL'))),
   'can_settle',false,'settlement_block_reason','La comprobacion de prestamos existente debe estar conectada antes de entregar dinero') data,r.submitted_at
  from public.savings_requests r join public.savings_participants p on p.id=r.participant_id where r.metadata->>'origin'='SAVINGS_RUNTIME_V1'
   and (p_folio is null or p.legacy_folio=p_folio) order by r.submitted_at desc limit 500)x),'[]'),
  'can_create',public.has_admin_permission('savings.write'),'can_approve',public.has_admin_permission('savings.approve'),'payment_verification','EXISTING_LOAN_GUARD_REQUIRED');
end $$;
revoke all on function public.savings_runtime_assert_identity(uuid),public.savings_runtime_submit(uuid,jsonb,uuid,boolean),public.savings_runtime_assert_payout(uuid),public.admin_save_savings_operation(jsonb,uuid),public.get_admin_savings_runtime_requests(text),public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid),public.admin_review_savings_request(uuid,text,text,date,date,text),public.admin_settle_savings_request(uuid,numeric,numeric,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_savings_operation(jsonb,uuid),public.get_admin_savings_runtime_requests(text),public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid),public.admin_review_savings_request(uuid,text,text,date,date,text),public.admin_settle_savings_request(uuid,numeric,numeric,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
