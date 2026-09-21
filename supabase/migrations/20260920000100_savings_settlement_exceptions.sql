begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Owner 2026-09-20: Google is read-only; audit events are not a loan master.
insert into public.savings_requests_runtime_backup(signature,definition)
select 'P0_20260920:'||oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc
where pronamespace='public'::regnamespace and proname in
('savings_runtime_assert_payout','get_admin_savings_runtime_requests','preview_savings_period_yield','admin_confirm_savings_period_yield');
insert into public.savings_requests_runtime_backup values ('P0_20260920:permissions_constraint',
(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check'));
do $permissions$ declare prior text; begin
 select definition into prior from public.savings_requests_runtime_backup where signature='P0_20260920:permissions_constraint';
 if position('savings.withdrawal.override' in prior)>0 then raise exception 'SAVINGS_MIGRATION_ALREADY_PRESENT';end if;
 if prior is null or position('''savings.read''::text' in prior)=0 then raise exception 'SAVINGS_PERMISSION_CONSTRAINT_DRIFT';end if;
 execute 'alter table public.admin_assignments drop constraint admin_assignments_permissions_check';
 execute 'alter table public.admin_assignments add constraint admin_assignments_permissions_check '||replace(prior,'''savings.read''::text','''savings.withdrawal.override''::text, ''savings.yield.override''::text, ''savings.read''::text');
end $permissions$;
-- Full-access principals; no ordinary Savings role/module gains either capability.
insert into public.admin_role_permissions(role_id,permission)
select id,p from public.admin_roles cross join unnest(array['savings.withdrawal.override','savings.yield.override']) p where code='principal_admin';
insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order) values
('admin_savings_withdrawal_override','Ahorro · Autorizar retiro excepcional','Specific withdrawal exception',array['read','update'],'ENFORCED','savings_withdrawal_override',array['savings.read'],array['savings.withdrawal.override'],array[]::text[],false,90),
('admin_savings_yield_override','Ahorro · Excepción de permanencia','Specific period tenure exception',array['read','update'],'ENFORCED','savings_yield_override',array['savings.read'],array['savings.yield.override'],array[]::text[],false,91);

create function public.savings_exception_active(p_resource text,p_target text,p_participant uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',a.id,'actor',a.actor_real_auth_user_id,'created_at',a.created_at,'reason',a.reason,'authorization',a.after_data)
 from (select distinct on (participant_id) * from public.savings_audit_events
 where resource=p_resource and target_id=p_target and action='AUTHORIZE'
 and (participant_id=p_participant or (p_resource='savings_yield_override' and participant_id is null))
 order by participant_id,id desc) a
 where true
 and not exists(select 1 from public.savings_audit_events v where v.resource=p_resource and v.action='REVOKE' and v.target_id=a.id::text)
 order by (a.participant_id is not null) desc,a.id desc limit 1;
$$;

create function public.get_admin_savings_settlement_context(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.savings_requests%rowtype; af uuid; fol text;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 select * into r from public.savings_requests where id=p_request_id;
 if r.id is null or r.request_type<>'WITHDRAW' or r.data_classification<>'CANONICAL' or r.metadata->>'origin' is distinct from 'SAVINGS_RUNTIME_V1' then raise exception 'SAVINGS_OPERATIONAL_REQUEST_REQUIRED';end if;
 af:=public.savings_runtime_assert_identity(r.participant_id);
 select numero_control into fol from public.affiliates where id=af;
 return jsonb_build_object('actor',auth.uid(),'session',auth.jwt()->>'session_id','effective_affiliate',public.get_effective_affiliate_id(),
 'affiliate_id',af,'participant_id',r.participant_id,'folio',fol,'request_status',r.status,
 'can_approve',public.has_admin_permission('savings.approve'),'can_override',public.has_admin_permission('savings.withdrawal.override'));
end $$;

create function public.savings_settlement_check(p_request_id uuid,p_observation jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; r public.savings_requests%rowtype; bal record; loan jsonb; overdue jsonb; override_event jsonb; fingerprint text; code text; eligible boolean;
begin
 ctx:=public.get_admin_savings_settlement_context(p_request_id);
 select * into r from public.savings_requests where id=p_request_id;
 if p_observation is null or p_observation->>'source' is distinct from '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80:1245291756'
 or p_observation->>'folio' is distinct from ctx->>'folio' or jsonb_typeof(p_observation->'loans') is distinct from 'array'
 or coalesce((p_observation->>'scanned_rows')::integer,0)<1 or (p_observation->>'observed_at')::timestamptz is null
 or (p_observation->>'observed_at')::timestamptz<clock_timestamp()-interval '60 seconds'
 or (p_observation->>'observed_at')::timestamptz>clock_timestamp()+interval '5 seconds' then raise exception 'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE';end if;
 for loan in select value from jsonb_array_elements(p_observation->'loans') loop
  if nullif(loan->>'id','') is null or nullif(loan->>'fund','') is null or coalesce((loan->>'rows')::integer,0)<1
   or coalesce(loan->>'status','') not in ('LIQUIDADO','PAGO DE MAS','LIQUIDADO O PAGO DE MAS','AL CORRIENTE','SALDO ATRASADO') then raise exception 'LOAN_STATUS_DATA_INCONSISTENCY';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_observation->'loans') l group by l->>'id' having count(*)>1) then raise exception 'LOAN_STATUS_DATA_INCONSISTENCY';end if;
 select coalesce(jsonb_agg(l order by l->>'id'),'[]') into overdue from jsonb_array_elements(p_observation->'loans') l where l->>'status'='SALDO ATRASADO';
 fingerprint:=md5(jsonb_build_array(ctx->>'affiliate_id',p_request_id,r.requested_amount,overdue)::text);
 override_event:=public.savings_exception_active('savings_withdrawal_override',p_request_id::text,r.participant_id);
 if override_event#>>'{authorization,fingerprint}' is distinct from fingerprint then override_event:=null;end if;
 select * into bal from public.savings_participant_balance(r.participant_id);
 eligible:=r.status='APPROVED' and (ctx->>'can_approve')::boolean
 and exists(select 1 from public.savings_participants where id=r.participant_id and certification_status='CERTIFIED' and data_classification='CANONICAL')
 and public.savings_effective_action('WITHDRAW',r.participant_id) and r.requested_amount>0 and r.requested_amount<=bal.available
 and (r.continue_saving or r.requested_amount=bal.available);
 code:=case when r.status<>'APPROVED' then 'SAVINGS_REQUEST_NOT_SETTLEABLE'
 when not (ctx->>'can_approve')::boolean then 'SAVINGS_APPROVE_DENIED'
 when eligible is not true then 'SAVINGS_SETTLEMENT_REQUIREMENTS_PENDING'
 when jsonb_array_length(overdue)>0 and override_event is null then 'WITHDRAWAL_BLOCKED_BY_OVERDUE_LOAN' else 'PASS' end;
 return jsonb_build_object('can_settle',code='PASS','code',code,'loans',p_observation->'loans','overdue_loans',overdue,
 'fingerprint',fingerprint,'override',override_event,'can_override',(ctx->>'can_override')::boolean and r.status='APPROVED' and jsonb_array_length(overdue)>0,
 'affiliate_id',ctx->'affiliate_id','participant_id',r.participant_id,'source',p_observation->>'source','observed_at',p_observation->>'observed_at');
end $$;

create or replace function public.savings_runtime_assert_payout(p_participant_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare envelope jsonb; check_result jsonb;
begin
 envelope:=nullif(current_setting('suti.savings_settlement_attestation',true),'')::jsonb;
 if envelope is null or envelope->>'participant_id' is distinct from p_participant_id::text or envelope->>'actor' is distinct from auth.uid()::text then raise exception 'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE' using errcode='55000';end if;
 check_result:=public.savings_settlement_check((envelope->>'request_id')::uuid,envelope->'observation');
 if check_result->>'code'<>'PASS' then raise exception '%',check_result->>'code';end if;
end $$;

create function public.service_savings_settlement(p_actor uuid,p_session uuid,p_effective_affiliate uuid,p_request_id uuid,p_action text,p_command jsonb,p_key uuid,p_observation jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; result jsonb; previous public.savings_audit_events%rowtype; data jsonb; event_id bigint; r public.savings_requests%rowtype; original_claims text; command jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SAVINGS_SERVICE_REQUIRED' using errcode='42501';end if;
 if p_action is null or p_action not in ('PREVIEW','OVERRIDE','SETTLE') or p_actor is null or p_session is null or not exists(select 1 from auth.sessions where id=p_session and user_id=p_actor and (not_after is null or not_after>now())) then raise exception 'SAVINGS_CONTEXT_CHANGED' using errcode='42501';end if;
 original_claims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_session,'role','authenticated')::text,true);
 if public.get_effective_affiliate_id() is distinct from p_effective_affiliate then raise exception 'SAVINGS_CONTEXT_CHANGED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-exception:'||p_request_id,0));
 if p_action<>'PREVIEW' then perform pg_advisory_xact_lock(hashtextextended('savings-runtime:'||p_key,0));end if;
 ctx:=public.get_admin_savings_settlement_context(p_request_id);
 select * into r from public.savings_requests where id=p_request_id for update;
 if p_action='PREVIEW' then result:=public.savings_settlement_check(p_request_id,p_observation);
 else
  if p_key is null or jsonb_typeof(p_command) is distinct from 'object' then raise exception 'SAVINGS_COMMAND_INVALID';end if;
  if p_action='OVERRIDE' and not public.has_admin_permission('savings.withdrawal.override') then raise exception 'SAVINGS_OVERRIDE_DENIED' using errcode='42501';end if;
  if p_action='SETTLE' and not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('savings-runtime:'||p_key,0));
  command:=p_command||jsonb_build_object('request_id',p_request_id,'kind',p_action);
  select * into previous from public.savings_audit_events where client_action_id=p_key;
  if found then
   if previous.actor_real_auth_user_id<>p_actor or previous.after_data->'command' is distinct from command
    or previous.resource is distinct from (case when p_action='OVERRIDE' then 'savings_withdrawal_override' else 'savings_runtime' end)
    then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
   result:=case when p_action='OVERRIDE' then jsonb_build_object('event_id',previous.id,'authorized',true) else previous.after_data->'result' end;
  else
   data:=public.savings_settlement_check(p_request_id,p_observation);
   if p_action='OVERRIDE' then
    if not (data->>'can_override')::boolean or p_command->>'confirmed' is distinct from 'true' or p_command->>'fingerprint' is distinct from data->>'fingerprint'
     or coalesce(p_command->>'reason','') not in ('DESPIDO','RENUNCIA','FALLECIMIENTO','CONTINGENCIA','OTRO')
     or length(coalesce(p_command->>'justification',''))>1000
     or (p_command->>'reason'='OTRO' and length(btrim(coalesce(p_command->>'justification','')))<3) then raise exception 'SAVINGS_OVERRIDE_INVALID';end if;
    insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
    values(p_actor,(ctx->>'affiliate_id')::uuid,r.participant_id,'savings_withdrawal_override','AUTHORIZE',r.id::text,
     jsonb_build_object('ordinary_result','WITHDRAWAL_BLOCKED_BY_OVERDUE_LOAN','observation',p_observation),
     jsonb_build_object('command',command,'fingerprint',data->>'fingerprint','affiliate_id',ctx->'affiliate_id','override_result','ALLOW_OVERDUE_ONLY','observation',p_observation,'justification',p_command->>'justification'),p_command->>'reason',p_key) returning id into event_id;
    result:=jsonb_build_object('event_id',event_id,'authorized',true);
   else
    if data->>'code'<>'PASS' then raise exception '%',data->>'code';end if;
    perform set_config('suti.savings_settlement_attestation',jsonb_build_object('actor',p_actor,'participant_id',r.participant_id,'request_id',r.id,'observation',p_observation)::text,true);
    result:=public.admin_save_savings_operation(command,p_key);
    insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason)
    values(p_actor,(ctx->>'affiliate_id')::uuid,r.participant_id,'savings_settlement_verification','USED',r.id::text,
      jsonb_build_object('observation',p_observation,'verification',data,'override_event_id',data#>>'{override,id}'),'LIVE_LOAN_CHECK');
    perform set_config('suti.savings_settlement_attestation','',true);
   end if;
  end if;
 end if;
 perform set_config('request.jwt.claims',original_claims,true);
 return result;
end $$;

create function public.admin_authorize_savings_yield_override(p_period_id uuid,p_participant_id uuid,p_reason text,p_justification text,p_confirmed boolean,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare command jsonb; prior public.savings_audit_events%rowtype; event_id bigint; preview jsonb; snapshot jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.yield.override') or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_OVERRIDE_DENIED' using errcode='42501';end if;
 if p_confirmed is distinct from true or p_key is null or length(btrim(coalesce(p_reason,'')))<3 or length(btrim(coalesce(p_justification,'')))<3 or length(p_reason)>200 or length(p_justification)>1000 then raise exception 'SAVINGS_OVERRIDE_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-yield-override:'||p_period_id,0));
 perform pg_advisory_xact_lock(hashtextextended('savings-runtime:'||p_key,0));
 command:=jsonb_build_object('period_id',p_period_id,'participant_id',p_participant_id,'reason',p_reason,'justification',p_justification);
 select * into prior from public.savings_audit_events where client_action_id=p_key;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.resource<>'savings_yield_override' or prior.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('event_id',prior.id,'authorized',true);
 end if;
 perform 1 from public.savings_yield_periods where id=p_period_id and status<>'DISABLED' for update;
 if not found or exists(select 1 from public.savings_yield_allocations where yield_period_id=p_period_id) then raise exception 'SAVINGS_OVERRIDE_PERIOD_FROZEN';end if;
 if p_participant_id is not null then perform public.savings_runtime_assert_identity(p_participant_id);end if;
 preview:=public.preview_savings_period_yield(p_period_id);
 select coalesce(jsonb_agg(row),'[]') into snapshot from jsonb_array_elements(preview->'rows') row
 where p_participant_id is null or row->>'participant_id'=p_participant_id::text;
 if p_participant_id is not null and jsonb_array_length(snapshot)<>1 then raise exception 'SAVINGS_ACTIVE_ENROLLMENT_REQUIRED';end if;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),p_participant_id,'savings_yield_override','AUTHORIZE',p_period_id::text,
 jsonb_build_object('rule','MINIMUM_SIX_MONTHS','participants',snapshot),jsonb_build_object('command',command,'scope',case when p_participant_id is null then 'GLOBAL' else 'INDIVIDUAL' end,
 'period_id',p_period_id,'criterion','BYPASS_TENURE_ONLY','justification',p_justification,'override_result','TENURE_SATISFIED_FOR_THIS_PERIOD'),p_reason,p_key) returning id into event_id;
 return jsonb_build_object('event_id',event_id,'authorized',true);
end $$;

create function public.admin_revoke_savings_exception(p_event_id bigint,p_reason text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.savings_audit_events%rowtype; prior public.savings_audit_events%rowtype;
begin
 select * into e from public.savings_audit_events where id=p_event_id and action='AUTHORIZE' and resource in ('savings_yield_override','savings_withdrawal_override');
 if e.id is null or auth.uid() is null or not public.has_admin_permission(case when e.resource='savings_yield_override' then 'savings.yield.override' else 'savings.withdrawal.override' end) then raise exception 'SAVINGS_OVERRIDE_DENIED' using errcode='42501';end if;
 if p_key is null or length(btrim(coalesce(p_reason,'')))<3 or length(p_reason)>1000 then raise exception 'SAVINGS_OVERRIDE_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(case when e.resource='savings_yield_override' then 'savings-yield-override:' else 'savings-exception:' end||e.target_id,0));
 perform pg_advisory_xact_lock(hashtextextended('savings-runtime:'||p_key,0));
 select * into prior from public.savings_audit_events where client_action_id=p_key;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.resource<>e.resource or prior.action<>'REVOKE' or prior.target_id<>e.id::text or prior.reason<>p_reason then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('revoked',true);
 end if;
 if e.resource='savings_yield_override' and exists(select 1 from public.savings_yield_allocations where yield_period_id=e.target_id::uuid)
 or e.resource='savings_withdrawal_override' and exists(select 1 from public.savings_requests where id=e.target_id::uuid and status='SETTLED') then raise exception 'SAVINGS_OVERRIDE_ALREADY_USED';end if;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),e.participant_id,e.resource,'REVOKE',e.id::text,p_reason,p_key);
 return jsonb_build_object('revoked',true);
end $$;

-- Extend only the installed tenure gate. All other yield checks stay in place.
do $yield$ declare definition text; begin
 definition:=pg_get_functiondef('public.preview_savings_period_yield(uuid)'::regprocedure);
 if position('if cutoff<eligible_on then' in definition)=0 then raise exception 'SAVINGS_YIELD_DEFINITION_DRIFT';end if;
 definition:=replace(definition,'source_review jsonb;','tenure_exception jsonb; source_review jsonb;');
 definition:=replace(definition,'if cutoff<eligible_on then', 'tenure_exception:=public.savings_exception_active(''savings_yield_override'',period.id::text,p.id); if cutoff<eligible_on and tenure_exception is null then');
 definition:=replace(definition,'v_status:=''ELIGIBLE'';', 'tenure_exception:=null; v_status:=''ELIGIBLE'';');
 definition:=replace(definition,'''eligible_on'',eligible_on,', '''eligible_on'',eligible_on,''real_join_date'',en.enrollment_started_at,''ordinary_tenure_pass'',cutoff>=((en.enrollment_started_at at time zone ''America/Hermosillo'')::date+interval ''6 months'')::date,''tenure_override'',tenure_exception,');
 definition:=replace(definition,'''period'',to_jsonb(period),', $patch$'period',to_jsonb(period),'tenure_exceptions',(
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'actor',e.actor_real_auth_user_id,'created_at',e.created_at,'reason',e.reason,'authorization',e.after_data) order by e.id),'[]')
  from (select distinct on (participant_id) * from public.savings_audit_events where resource='savings_yield_override' and action='AUTHORIZE' and target_id=period.id::text order by participant_id,id desc)e
  where not exists(select 1 from public.savings_audit_events v where v.resource=e.resource and v.action='REVOKE' and v.target_id=e.id::text)), $patch$);
 if position('real_join_date' in definition)=0 then raise exception 'SAVINGS_YIELD_DEFINITION_DRIFT';end if;
 execute definition;
 definition:=pg_get_functiondef('public.admin_confirm_savings_period_yield(uuid,text,text,uuid)'::regprocedure);
 if position('lock table public.affiliates,' in definition)=0 then raise exception 'SAVINGS_YIELD_CONFIRM_DEFINITION_DRIFT';end if;
 definition:=replace(definition,'lock table public.affiliates,',
 'perform pg_advisory_xact_lock(hashtextextended(''savings-yield-override:''||p_yield_period_id,0)); lock table public.affiliates,');
 execute definition;
 definition:=pg_get_functiondef('public.get_admin_savings_runtime_requests(text)'::regprocedure);
 definition:=replace(definition,'''can_settle'',false,', '''requires_loan_verification'',r.status=''APPROVED'' and r.request_type=''WITHDRAW'',''can_settle'',false,');
 definition:=replace(definition,'La comprobacion de prestamos existente debe estar conectada antes de entregar dinero','Comprueba el estado actual de los préstamos antes de registrar la entrega');
 definition:=replace(definition,'EXISTING_LOAN_GUARD_REQUIRED','LIVE_LOAN_CHECK_REQUIRED');
 execute definition;
end $yield$;
revoke all on function public.savings_exception_active(text,text,uuid),public.savings_settlement_check(uuid,jsonb),public.get_admin_savings_settlement_context(uuid),public.service_savings_settlement(uuid,uuid,uuid,uuid,text,jsonb,uuid,jsonb),public.admin_authorize_savings_yield_override(uuid,uuid,text,text,boolean,uuid),public.admin_revoke_savings_exception(bigint,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_settlement_context(uuid),public.admin_authorize_savings_yield_override(uuid,uuid,text,text,boolean,uuid),public.admin_revoke_savings_exception(bigint,text,uuid) to authenticated;
grant execute on function public.service_savings_settlement(uuid,uuid,uuid,uuid,text,jsonb,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
