begin;
-- Explicit private financial opening. Requires reviewed operations 001--004.
create table public.savings_balance_certifications(
 id uuid primary key default extensions.gen_random_uuid(),
 record_id uuid not null unique references public.savings_review_records(id),
 participant_id uuid not null unique references public.savings_participants(id),
 enrollment_id uuid references public.savings_enrollments(id),
 cutoff_on date not null, source_version integer not null,
 source_snapshot jsonb not null, command jsonb not null,
 capital numeric(14,2) not null check(capital>=0), yield_amount numeric(14,2) not null check(yield_amount>=0),
 actor_real_auth_user_id uuid not null references auth.users(id),
 usuario_contexto_affiliate_id uuid references public.affiliates(id),
 observation text, client_action_id uuid not null unique,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.savings_balance_certifications enable row level security;
alter table public.savings_balance_certifications force row level security;
revoke all on public.savings_balance_certifications from public,anon,authenticated,service_role;
create trigger savings_certification_immutable before update or delete on public.savings_balance_certifications
 for each row execute function public.reject_savings_history_mutation();

create table public.savings_certification_function_backup(signature text primary key,definition text not null);
alter table public.savings_certification_function_backup enable row level security;
alter table public.savings_certification_function_backup force row level security;
revoke all on public.savings_certification_function_backup from public,anon,authenticated,service_role;
insert into public.savings_certification_function_backup
select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
and proname in ('get_self_savings_dashboard','get_self_savings_live_readonly','submit_self_savings_request');

-- The private account must not change any self-service surface before publication.
-- Restore the exact pre-retirement live reader; preserve the staged wrapper above.
do $$ declare d text; begin
 select definition into d from public.savings_retirement_migration_backup where signature='get_self_savings_live_readonly()';
 if d is null then raise exception 'SAVINGS_ORIGINAL_SELF_READER_REQUIRED'; end if;
 execute d;
end $$;
alter function public.get_self_savings_dashboard() rename to savings_dashboard_before_certification;
revoke all on function public.savings_dashboard_before_certification() from public,anon,authenticated,service_role;
create function public.get_self_savings_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501'; end if;
 if exists(select 1 from public.savings_balance_certifications c join public.savings_participants p on p.id=c.participant_id where p.affiliate_id=public.get_effective_affiliate_id()) then
  raise exception 'SAVINGS_PRIVATE_REVIEW_NOT_PUBLISHED' using errcode='55000';
 end if;
 return public.savings_dashboard_before_certification();
end $$;
alter function public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid) rename to savings_submit_before_certification;
revoke all on function public.savings_submit_before_certification(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid) from public,anon,authenticated,service_role;
create function public.submit_self_savings_request(p_request_type text,p_amount numeric,p_component text,p_withdrawal_kind text,p_new_contribution_amount numeric,p_continue_saving boolean,p_effective_from date,p_reason text,p_supporting_document_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501'; end if;
 if exists(select 1 from public.savings_balance_certifications c join public.savings_participants p on p.id=c.participant_id where p.affiliate_id=public.get_effective_affiliate_id()) then raise exception 'SAVINGS_PRIVATE_REVIEW_NOT_PUBLISHED' using errcode='55000'; end if;
 return public.savings_submit_before_certification(p_request_type,p_amount,p_component,p_withdrawal_kind,p_new_contribution_amount,p_continue_saving,p_effective_from,p_reason,p_supporting_document_id,p_idempotency_key);
end $$;

create function public.savings_certification_context(p_record_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.savings_review_records%rowtype; b public.savings_review_batches%rowtype;
 person jsonb; identity jsonb; links jsonb; related jsonb;
begin
 select * into r from public.savings_review_records where id=p_record_id and source_sheet='Ahorro';
 if not found then raise exception 'SAVINGS_RECORD_REQUIRED'; end if;
 select * into b from public.savings_review_batches where id=r.batch_id;
 select value into person from public.savings_panel_people(p_record_id) value;
 -- S is the currently approved amount; R is the original enrollment amount.
 person:=person||jsonb_build_object('aporte',case when r.proposed_data ? 'R' then public.savings_panel_number(r.proposed_data->'R') else coalesce(public.savings_panel_number(r.source_data->'S'),public.savings_panel_number(r.source_data->'R')) end,'plan_fin',public.savings_panel_date((r.source_data||r.proposed_data)->>'Z'));
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'control',numero_control,'archived',is_archived) order by id),'[]') into identity from public.affiliates where numero_control=r.source_folio;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into links from public.savings_participants p
 where legacy_folio=r.source_folio or affiliate_id in(select id from public.affiliates where numero_control=r.source_folio);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'source',source_data,'proposal',proposed_data,'status',status) order by id),'[]') into related
 from public.savings_review_records where source_folio=r.source_folio;
 return jsonb_build_object('person',person,'record_status',r.status,'source_version',r.version,'cutoff_on',(b.observed_at at time zone 'America/Hermosillo')::date,
 'snapshot',jsonb_build_object('batch_sha',b.source_sha256,'record_id',r.id,'source',r.source_data,'proposal',r.proposed_data,'related',related,'identity',identity,'participants',links,'historical_yield_through','2026-06-30'));
end $$;

create function public.preview_savings_balance_certification(p_record_id uuid,p_command jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb; d jsonb; cut date; first_date date; next_date date; proc text; cap numeric; y numeric; amt numeric; active boolean; rows jsonb; enrollment_start date; plan_end date;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
 ctx:=public.savings_certification_context(p_record_id);d:=ctx->'person';cut:=(ctx->>'cutoff_on')::date;
 if ctx#>>'{source_update,pending}'='true' then raise exception 'SAVINGS_SOURCE_UPDATE_PENDING';end if;
 if p_command is null or jsonb_typeof(p_command)<>'object' then raise exception 'SAVINGS_CONFIRMATION_FIELDS_REQUIRED'; end if;
 cap:=public.savings_panel_number(p_command->'capital');y:=public.savings_panel_number(p_command->'yield');amt:=public.savings_panel_number(p_command->'amount');
 first_date:=public.savings_panel_date(p_command->>'first_date');next_date:=public.savings_panel_date(p_command->>'next_date');proc:=nullif(p_command->>'process','');
 if p_command->>'active' not in ('true','false') or jsonb_typeof(p_command->'active')<>'boolean' then raise exception 'SAVINGS_CONFIRMATION_FIELDS_REQUIRED'; end if;
 active:=(p_command->>'active')::boolean;
 if cap is null or y is null or cap<0 or y<0 or cap+y>999999999999.99 or cap<>round(cap,2) or y<>round(y,2)
  or (first_date is null and (active or cap+y<>0 or nullif(d->>'inicio','') is not null or nullif(d->>'plan_inicio','') is not null)) or first_date>cut or (proc is null and (active or first_date is not null)) or (proc is not null and proc not in ('JUB','PROCESS_1','PROCESS_3'))
  or length(coalesce(p_command->>'observation',''))>1000 then raise exception 'SAVINGS_CONFIRMATION_FIELDS_REQUIRED'; end if;
 if active and (amt is null or amt<200 or amt>999999999999.99 or amt<>round(amt,2) or next_date is null or next_date<=cut or next_date>cut+70
  or public.savings_next_contribution_date(next_date,proc)<>next_date) then raise exception 'SAVINGS_PLAN_FIELDS_REQUIRED'; end if;
 if not active then next_date:=null; end if;
 if public.savings_panel_number(d->'saldo_revision') is null or cap+y<>public.savings_panel_number(d->'saldo_revision') then raise exception 'SAVINGS_REVIEWED_BALANCE_MISMATCH'; end if;
 enrollment_start:=coalesce(public.savings_panel_date(p_command->>'enrollment_start'),public.savings_panel_date(d->>'plan_inicio'));
 plan_end:=coalesce(public.savings_panel_date(p_command->>'plan_end'),public.savings_panel_date(d->>'plan_fin'));
 if (first_date is not null and enrollment_start is null) or (first_date is null and enrollment_start is not null) or enrollment_start<first_date or enrollment_start>cut then raise exception 'SAVINGS_ENROLLMENT_START_REQUIRED'; end if;
 if active then
  select coalesce(jsonb_agg(jsonb_build_object('date',day::date,'expected',amt) order by day),'[]') into rows
  from generate_series(next_date::timestamp,(cut+366)::timestamp,interval '1 day') day
  where public.savings_next_contribution_date(day::date,proc)=day::date and day::date<=plan_end;
 else rows:='[]'; end if;
 return jsonb_build_object('context',ctx,'total',cap+y,'capital',cap,'yield',y,'source_total',d->'saldo','review_total',d->'saldo_revision',
  'difference',cap+y-public.savings_panel_number(d->'saldo_revision'),'schedule',rows,
  'fingerprint',md5(ctx::text||p_command::text),'can_confirm',public.has_admin_permission('savings.approve'),
  'already_confirmed',exists(select 1 from public.savings_balance_certifications where record_id=p_record_id));
end $$;

create function public.admin_confirm_savings_balance(p_record_id uuid,p_command jsonb,p_fingerprint text,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare preview jsonb; ctx jsonb; d jsonb; old public.savings_balance_certifications%rowtype; p public.savings_participants%rowtype;
 af uuid; e uuid; cert uuid; cut date; first_date date; active boolean; component text; amount numeric;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or p_fingerprint is null or p_command->>'confirmed' is distinct from 'true' then raise exception 'SAVINGS_EXPLICIT_CONFIRMATION_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-certify:'||p_client_action_id,0));
 select * into old from public.savings_balance_certifications where client_action_id=p_client_action_id;
 if found then
  if old.record_id<>p_record_id or old.command is distinct from p_command or old.actor_real_auth_user_id<>auth.uid() then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('id',old.id,'participant_id',old.participant_id,'total',old.capital+old.yield_amount);
 end if;
 -- Prevent an exact Folio from acquiring a duplicate affiliate concurrently.
 lock table public.affiliates in share mode;
 perform 1 from public.savings_review_records where source_folio=(select source_folio from public.savings_review_records where id=p_record_id) order by id for update;
 ctx:=public.savings_certification_context(p_record_id);d:=ctx->'person';
 perform pg_advisory_xact_lock(hashtextextended('savings-folio:'||(d->>'folio'),0));
 perform 1 from public.savings_participants where legacy_folio=d->>'folio' or affiliate_id in(select id from public.affiliates where numero_control=d->>'folio') order by id for update;
 preview:=public.preview_savings_balance_certification(p_record_id,p_command);
 if preview->>'fingerprint' is distinct from p_fingerprint then raise exception 'SAVINGS_PREVIEW_STALE'; end if;
 if ctx->>'record_status'<>'RESOLVED' then raise exception 'SAVINGS_REVIEW_REQUIRED'; end if;
 if (d#>>'{identity,match_count}')::int<>1 or (d#>>'{identity,active_match_count}')::int<>1 or d->>'identity_pending'='true' then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED'; end if;
 if (select count(*) from public.savings_review_records where source_sheet='Ahorro' and source_folio=d->>'folio')<>1 then raise exception 'SAVINGS_DUPLICATE_SOURCE'; end if;
 if exists(select 1 from public.savings_balance_certifications where record_id=p_record_id) then raise exception 'SAVINGS_ALREADY_CONFIRMED'; end if;
 select id into af from public.affiliates where numero_control=d->>'folio' and not coalesce(is_archived,false);
 select * into p from public.savings_participants where legacy_folio=d->>'folio' or affiliate_id=af;
 if (select count(*) from public.savings_participants where legacy_folio=d->>'folio' or affiliate_id=af)>1
  or (p.id is not null and (p.legacy_folio is distinct from d->>'folio' or p.affiliate_id is distinct from af or p.identity_status<>'RESOLVED')) then raise exception 'SAVINGS_PARTICIPANT_IDENTITY_CONFLICT'; end if;
 if p.id is not null and (exists(select 1 from public.savings_transactions where participant_id=p.id) or exists(select 1 from public.savings_enrollments where participant_id=p.id)) then raise exception 'SAVINGS_EXISTING_FINANCIAL_HISTORY'; end if;
 cut:=(ctx->>'cutoff_on')::date;first_date:=(p_command->>'first_date')::date;active:=(p_command->>'active')::boolean;
 if p.id is null then
  insert into public.savings_participants(participant_type,affiliate_id,legacy_folio,display_name,identity_status)
  values('AFFILIATE',af,d->>'folio',d->>'nombre','RESOLVED') returning * into p;
 end if;
 update public.savings_participants set certification_status='CERTIFIED',data_classification='CANONICAL',current_process=nullif(p_command->>'process',''),historical_yield_reconciled_through='2026-06-30' where id=p.id;
 if first_date is not null then
 insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,approved_at,first_expected_contribution_date,first_actual_contribution_date,terminated_at,continue_saving,process_snapshot,data_classification)
 values(p.id,1,case when active then 'ACTIVE' else 'TERMINATED' end,coalesce(public.savings_panel_date(p_command->>'enrollment_start'),public.savings_panel_date(d->>'plan_inicio'))::timestamp at time zone 'America/Hermosillo',clock_timestamp(),
  case when active then (p_command->>'next_date')::date else first_date end,first_date,case when not active then (cut+1)::timestamp at time zone 'America/Hermosillo' end,active,p_command->>'process','CANONICAL') returning id into e;
 end if;
 if active then
  if coalesce(public.savings_panel_date(p_command->>'plan_end'),public.savings_panel_date(d->>'plan_fin')) is null or coalesce(public.savings_panel_date(p_command->>'plan_end'),public.savings_panel_date(d->>'plan_fin'))<(p_command->>'next_date')::date then raise exception 'SAVINGS_PLAN_END_REQUIRED';end if;
  insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,effective_to,data_classification,created_by_auth_user_id)
  values(e,(p_command->>'amount')::numeric,p_command->>'process',(p_command->>'next_date')::date,coalesce(public.savings_panel_date(p_command->>'plan_end'),public.savings_panel_date(d->>'plan_fin')),'CANONICAL',auth.uid());
 end if;
 insert into public.savings_balance_certifications(record_id,participant_id,enrollment_id,cutoff_on,source_version,source_snapshot,command,capital,yield_amount,actor_real_auth_user_id,usuario_contexto_affiliate_id,observation,client_action_id)
 values(p_record_id,p.id,e,cut,(ctx->>'source_version')::int,ctx->'snapshot',p_command,(p_command->>'capital')::numeric,(p_command->>'yield')::numeric,auth.uid(),public.get_effective_affiliate_id(),nullif(btrim(p_command->>'observation'),''),p_client_action_id) returning id into cert;
 foreach component in array array['CAPITAL','YIELD'] loop
  amount:=(p_command->>case when component='CAPITAL' then 'capital' else 'yield' end)::numeric;
  if amount>0 then insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification,created_by_auth_user_id)
   values(p.id,e,'REGULARIZATION',component,'CREDIT',amount,cut,'CERTIFICATION:'||cert||':'||component,'CANONICAL',auth.uid()); end if;
 end loop;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),p.id,'savings_balance_certifications','CONFIRM_PRIVATE',cert::text,preview||jsonb_build_object('command',p_command),coalesce(p_command->>'observation',''),p_client_action_id);
 return jsonb_build_object('id',cert,'participant_id',p.id,'total',preview->'total');
end $$;

create function public.get_admin_savings_financial_account(p_record_id uuid,p_until date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.savings_balance_certifications%rowtype; ctx jsonb; schedule jsonb; end_date date; bal jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
 ctx:=public.savings_certification_context(p_record_id);
 select * into c from public.savings_balance_certifications where record_id=p_record_id;
 if not found then return jsonb_build_object('certified',false,'context',ctx,'today',public.savings_operation_today(),'can_confirm',public.has_admin_permission('savings.approve')); end if;
 end_date:=coalesce(p_until,greatest(public.savings_operation_today(),c.cutoff_on)+366);
 if end_date<c.cutoff_on or end_date>greatest(public.savings_operation_today(),c.cutoff_on)+1098 then raise exception 'SAVINGS_PROJECTION_RANGE_INVALID'; end if;
 select to_jsonb(b) into bal from public.savings_participant_balance(c.participant_id) b;
 select coalesce(jsonb_agg(jsonb_build_object('date',s.contribution_date,'expected',s.expected_amount,'actual',o.actual_amount,'version',coalesce(o.version_number,0),'confirmed',o.id is not null,'future',s.contribution_date>public.savings_operation_today()) order by s.contribution_date),'[]') into schedule
 from public.generate_savings_schedule(c.enrollment_id,c.cutoff_on+1,end_date) s
 left join lateral(select * from public.savings_contribution_overrides where enrollment_id=c.enrollment_id and contribution_date=s.contribution_date order by version_number desc limit 1)o on true;
 return jsonb_build_object('certified',true,'context',ctx,'certificate',to_jsonb(c)-array['command','source_snapshot','client_action_id'],'balance',bal,'schedule',schedule,
 'source_changed',(ctx->'snapshot'->'related') is distinct from (c.source_snapshot->'related'),
 'can_write',public.has_admin_permission('savings.write'),'can_confirm',public.has_admin_permission('savings.approve'),'publication','PRIVATE','today',public.savings_operation_today(),
 'balance_version',(select coalesce(max(id),0) from public.savings_audit_events where participant_id=c.participant_id),
 'projected_total',public.savings_panel_number(bal->'total')+coalesce((select sum((x->>'expected')::numeric) from jsonb_array_elements(schedule)x where x->>'future'='true'),0),
 'unconfirmed_dates',(select count(*) from jsonb_array_elements(schedule)x where x->>'future'='false' and x->>'confirmed'='false'),
 'history',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'at',a.created_at,'action',a.action,'observation',a.reason,'before',a.before_data,'after',a.after_data,'actor',coalesce(f.full_name,'Encargado autorizado')) order by a.id desc)
 from public.savings_audit_events a left join public.affiliates f on f.auth_user_id=a.actor_real_auth_user_id where a.participant_id=c.participant_id),'[]'));
end $$;

create function public.admin_confirm_savings_receipt(p_record_id uuid,p_date date,p_actual numeric,p_version integer,p_observation text,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.savings_balance_certifications%rowtype; previous public.savings_contribution_overrides%rowtype; expected numeric; delta numeric; result jsonb; old public.savings_audit_events%rowtype;
 command jsonb:=jsonb_build_object('record_id',p_record_id,'date',p_date,'actual',p_actual,'version',p_version,'observation',p_observation);
begin
 if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or p_actual is null or p_actual<0 or p_actual>999999999999.99 or p_actual<>round(p_actual,2) or p_date is null or p_date>public.savings_operation_today() or p_version is null or length(coalesce(p_observation,''))>1000 then raise exception 'SAVINGS_RECEIPT_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-receipt:'||p_client_action_id,0));
 select * into old from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
  if old.after_data->'command' is distinct from command or old.actor_real_auth_user_id<>auth.uid() then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
  return old.after_data->'result';
 end if;
 select * into c from public.savings_balance_certifications where record_id=p_record_id;
 if not found or p_date<=c.cutoff_on then raise exception 'SAVINGS_CERTIFIED_PERIOD_PROTECTED'; end if;
 perform 1 from public.savings_participants where id=c.participant_id for update;
 if not exists(select 1 from public.savings_participants p join public.affiliates a on a.id=p.affiliate_id where p.id=c.participant_id and p.legacy_folio=a.numero_control and not coalesce(a.is_archived,false))
  or (select count(*) from public.affiliates where numero_control=(select source_folio from public.savings_review_records where id=p_record_id))<>1 then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED'; end if;
 select expected_amount into expected from public.generate_savings_schedule(c.enrollment_id,p_date,p_date);
 if expected is null then raise exception 'SAVINGS_DATE_NOT_EXPECTED'; end if;
 select * into previous from public.savings_contribution_overrides where enrollment_id=c.enrollment_id and contribution_date=p_date order by version_number desc limit 1;
 if coalesce(previous.version_number,0)<>p_version then raise exception 'SAVINGS_PREVIEW_STALE'; end if;
 delta:=p_actual-coalesce(previous.actual_amount,0);
 if previous.id is not null and delta=0 then raise exception 'SAVINGS_NO_CHANGE'; end if;
 -- Older override table requires text; this neutral system label is not a user justification.
 insert into public.savings_contribution_overrides(enrollment_id,contribution_date,expected_amount,actual_amount,version_number,reason,editor_auth_user_id,client_action_id)
 values(c.enrollment_id,p_date,expected,p_actual,p_version+1,coalesce(nullif(btrim(p_observation),''),'Descuento confirmado'),auth.uid(),p_client_action_id);
 if delta<>0 then
  insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,expected_amount,actual_amount,difference_amount,idempotency_key,data_classification,created_by_auth_user_id)
  values(c.participant_id,c.enrollment_id,case when previous.id is null then 'CONTRIBUTION' else 'ADJUSTMENT' end,'CAPITAL',case when delta>0 then 'CREDIT' else 'DEBIT' end,abs(delta),public.savings_operation_today(),p_date,expected,p_actual,p_actual-expected,'RECEIPT:'||p_client_action_id,'CANONICAL',auth.uid());
 end if;
 result:=jsonb_build_object('date',p_date,'expected',expected,'actual',p_actual,'difference',p_actual-expected,'version',p_version+1);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),c.participant_id,'savings_contribution_overrides','CONFIRM_RECEIPT',c.enrollment_id||':'||p_date,coalesce(to_jsonb(previous),'{}'),jsonb_build_object('command',command,'result',result),coalesce(p_observation,''),p_client_action_id);
 return result;
end $$;

revoke all on function public.savings_certification_context(uuid),public.preview_savings_balance_certification(uuid,jsonb),public.admin_confirm_savings_balance(uuid,jsonb,text,uuid),public.get_admin_savings_financial_account(uuid,date),public.admin_confirm_savings_receipt(uuid,date,numeric,integer,text,uuid),public.get_self_savings_dashboard(),public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.preview_savings_balance_certification(uuid,jsonb),public.admin_confirm_savings_balance(uuid,jsonb,text,uuid),public.get_admin_savings_financial_account(uuid,date),public.admin_confirm_savings_receipt(uuid,date,numeric,integer,text,uuid),public.get_self_savings_dashboard(),public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
