begin;

-- H-SAVINGS-SHADOW-FOUNDATION-USER-UI-AND-ADMIN-001
-- Google Savings remains the productive/historical authority. These objects are
-- an explicitly classified SHADOW + NEW FOUNDATION and do not perform cutover.

-- Dedicated least-privilege capabilities. Keep this list in lockstep with the
-- latest save_admin_role() allowlist.
alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check(permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read',
  'program_catalog.read','program_catalog.write','savings.read','savings.write','savings.approve','savings.config','savings.reports','savings.identity_review'
]::text[]);

insert into public.admin_role_permissions(role_id,permission)
select id,permission from public.admin_roles
cross join unnest(array['savings.read','savings.write','savings.approve','savings.config','savings.reports','savings.identity_review']::text[]) permission
where code='principal_admin' on conflict do nothing;

update public.admin_assignments a
set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=a.role_id),updated_at=now()
where a.enabled;

create or replace function public.save_admin_role(p_role_id uuid,p_name text,p_description text,p_permissions text[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_allowed text[]:=array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write','banners.read','banners.write',
  'documents.read','documents.write','affiliates.read','affiliates.write','affiliates.impersonate','news.read','news.write','content.read','content.write',
  'marketplace.read','marketplace.write','marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write',
  'company_portal.read','company_portal.write','program_requests.read','program_requests.write','authorization.read','authorization.write',
  'segmentation.read','segmentation.write','workflow.read','workflow.write','union_content.read','union_content.write','data_exports.read',
  'financial_criteria.visibility.read','financial_criteria.visibility.write','financial_programs.read','financial_programs.write',
  'financial_rules.read','financial_rules.write','financial_rules.publish','financial_rates.write','bank_accounts.read',
  'program_catalog.read','program_catalog.write','savings.read','savings.write','savings.approve','savings.config','savings.reports','savings.identity_review'];
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
  insert into public.admin_role_permissions(role_id,permission) select v_id,p from(select distinct unnest(p_permissions) p) q;
  update public.admin_assignments a set permissions=(select array_agg(permission order by permission) from public.admin_role_permissions where role_id=v_id),updated_at=now() where role_id=v_id;
  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result) values(auth.uid(),'admin_roles',case when p_role_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS');
  return v_id;
end $$;

create function public.admin_review_savings_request(
  p_request_id uuid,p_decision text,p_reason text,p_effective_from date,p_first_expected_contribution_date date,p_process text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_request record;v_enrollment record;v_plan record;v_sequence integer;v_decision text:=upper(coalesce(p_decision,''));v_process text:=upper(coalesce(p_process,''));
begin
  if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<3 or v_decision not in ('APPROVE','REJECT','UNDER_REVIEW') then raise exception 'SAVINGS_REVIEW_INVALID' using errcode='22023'; end if;
  select * into v_request from public.savings_requests where id=p_request_id for update;
  if not found or v_request.status not in ('SUBMITTED','UNDER_REVIEW') then raise exception 'SAVINGS_REQUEST_NOT_REVIEWABLE' using errcode='P0001'; end if;
  if v_request.request_type='EXTRAORDINARY_WITHDRAWAL' and v_decision='APPROVE' then raise exception 'SAVINGS_DUAL_APPROVAL_REQUIRED' using errcode='42501'; end if;
  if v_decision='UNDER_REVIEW' then
    update public.savings_requests set status='UNDER_REVIEW',reviewed_by_auth_user_id=auth.uid(),reason=case when reason='' then btrim(p_reason) else reason||E'\nRevisión: '||btrim(p_reason) end where id=p_request_id returning * into v_request;
  elsif v_decision='REJECT' then
    update public.savings_requests set status='REJECTED',reviewed_at=now(),reviewed_by_auth_user_id=auth.uid(),reason=case when reason='' then btrim(p_reason) else reason||E'\nRechazo: '||btrim(p_reason) end where id=p_request_id returning * into v_request;
  elsif v_request.request_type='JOIN' then
    if p_first_expected_contribution_date is null or p_first_expected_contribution_date<current_date or v_process not in ('JUB','PROCESS_1','PROCESS_3') then raise exception 'SAVINGS_FIRST_EXPECTED_DATE_AND_PROCESS_REQUIRED' using errcode='22023'; end if;
    if exists(select 1 from public.savings_enrollments where participant_id=v_request.participant_id and status in ('REQUESTED','ACTIVE','TERMINATION_PENDING')) then raise exception 'SAVINGS_ENROLLMENT_ALREADY_OPEN' using errcode='23505'; end if;
    select coalesce(max(sequence_number),0)+1 into v_sequence from public.savings_enrollments where participant_id=v_request.participant_id;
    insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,requested_at,approved_at,first_expected_contribution_date,process_snapshot,data_classification)
    values(v_request.participant_id,v_sequence,'ACTIVE',v_request.submitted_at,v_request.submitted_at,now(),p_first_expected_contribution_date,v_process,'SHADOW') returning * into v_enrollment;
    insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,source_request_id,data_classification,created_by_auth_user_id)
    values(v_enrollment.id,v_request.new_contribution_amount,v_process,p_first_expected_contribution_date,v_request.id,'SHADOW',auth.uid());
    update public.savings_participants set current_process=v_process,process_source='SHADOW' where id=v_request.participant_id;
    update public.savings_requests set enrollment_id=v_enrollment.id,status='APPROVED',reviewed_at=now(),reviewed_by_auth_user_id=auth.uid(),effective_from=p_first_expected_contribution_date,
      reason=case when reason='' then btrim(p_reason) else reason||E'\nAprobación: '||btrim(p_reason) end where id=p_request_id returning * into v_request;
  elsif v_request.request_type='CHANGE_AMOUNT' then
    if coalesce(p_effective_from,v_request.effective_from) is null or coalesce(p_effective_from,v_request.effective_from)<=current_date then raise exception 'SAVINGS_FUTURE_AMOUNT_CHANGE_REQUIRED' using errcode='22023'; end if;
    select * into v_plan from public.savings_contribution_plans where enrollment_id=v_request.enrollment_id and effective_from<=coalesce(p_effective_from,v_request.effective_from)
      and (effective_to is null or effective_to>=coalesce(p_effective_from,v_request.effective_from)) order by effective_from desc limit 1 for update;
    if not found then raise exception 'SAVINGS_ACTIVE_PLAN_REQUIRED' using errcode='P0001'; end if;
    update public.savings_contribution_plans set effective_to=coalesce(p_effective_from,v_request.effective_from)-1 where id=v_plan.id;
    insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,source_request_id,data_classification,created_by_auth_user_id)
    values(v_request.enrollment_id,v_request.new_contribution_amount,v_plan.process_snapshot,coalesce(p_effective_from,v_request.effective_from),v_request.id,'SHADOW',auth.uid());
    update public.savings_requests set status='APPROVED',reviewed_at=now(),reviewed_by_auth_user_id=auth.uid(),effective_from=coalesce(p_effective_from,effective_from),
      reason=case when reason='' then btrim(p_reason) else reason||E'\nAprobación: '||btrim(p_reason) end where id=p_request_id returning * into v_request;
  else
    update public.savings_requests set status='APPROVED',reviewed_at=now(),reviewed_by_auth_user_id=auth.uid(),reason=case when reason='' then btrim(p_reason) else reason||E'\nAprobación: '||btrim(p_reason) end where id=p_request_id returning * into v_request;
    if v_request.request_type='TERMINATE' then update public.savings_enrollments set status='TERMINATION_PENDING',continue_saving=false where id=v_request.enrollment_id; end if;
  end if;
  insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason)
  values(auth.uid(),v_request.usuario_contexto_affiliate_id,v_request.participant_id,'savings_requests',v_decision,v_request.id::text,to_jsonb(v_request),btrim(p_reason));
  return to_jsonb(v_request);
end $$;

create function public.admin_record_savings_request_approval(p_request_id uuid,p_approval_role text,p_decision text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_request record;v_approval record;v_approved integer;v_rejected integer;begin
  if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'SAVINGS_APPROVAL_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_request from public.savings_requests where id=p_request_id for update;
  if not found or v_request.request_type<>'EXTRAORDINARY_WITHDRAWAL' or v_request.status not in ('SUBMITTED','UNDER_REVIEW') then raise exception 'SAVINGS_DUAL_APPROVAL_NOT_APPLICABLE' using errcode='P0001'; end if;
  insert into public.savings_request_approvals(request_id,approval_role,decision,reason,actor_real_auth_user_id)
  values(p_request_id,upper(p_approval_role),upper(p_decision),btrim(p_reason),auth.uid()) returning * into v_approval;
  select count(*) filter(where decision='APPROVE' and approval_role in ('GENERAL_SECRETARY','FINANCE_SECRETARY')),
    count(*) filter(where decision='REJECT') into v_approved,v_rejected from public.savings_request_approvals where request_id=p_request_id;
  update public.savings_requests set status=case when v_rejected>0 then 'REJECTED' when v_approved=2 then 'APPROVED' else 'UNDER_REVIEW' end,
    reviewed_at=case when v_rejected>0 or v_approved=2 then now() else reviewed_at end,
    reviewed_by_auth_user_id=case when v_rejected>0 or v_approved=2 then auth.uid() else reviewed_by_auth_user_id end where id=p_request_id returning * into v_request;
  insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason)
  values(auth.uid(),v_request.usuario_contexto_affiliate_id,v_request.participant_id,'savings_request_approvals',upper(p_decision),v_approval.id::text,to_jsonb(v_approval),btrim(p_reason));
  return jsonb_build_object('approval',to_jsonb(v_approval),'request',to_jsonb(v_request));
end $$;

create function public.admin_settle_savings_request(p_request_id uuid,p_capital_amount numeric,p_yield_amount numeric,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_request record;v_balance record;v_capital numeric:=coalesce(p_capital_amount,0);v_yield numeric:=coalesce(p_yield_amount,0);v_existing record;
begin
  if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
  if p_client_action_id is null or length(btrim(coalesce(p_reason,'')))<3 or v_capital<0 or v_yield<0 or v_capital+v_yield<=0 then raise exception 'SAVINGS_SETTLEMENT_INVALID' using errcode='22023'; end if;
  select * into v_existing from public.savings_audit_events where client_action_id=p_client_action_id;
  if found then return v_existing.after_data; end if;
  select * into v_request from public.savings_requests where id=p_request_id for update;
  if not found or v_request.status<>'APPROVED' or v_request.request_type not in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL','TERMINATE') then raise exception 'SAVINGS_REQUEST_NOT_SETTLEABLE' using errcode='P0001'; end if;
  select * into v_balance from public.savings_participant_balance(v_request.participant_id);
  if v_request.component='CAPITAL' and v_yield<>0 or v_request.component='YIELD' and v_capital<>0 then raise exception 'SAVINGS_SETTLEMENT_COMPONENT_MISMATCH' using errcode='22023'; end if;
  if v_request.request_type='EXTRAORDINARY_WITHDRAWAL' and v_yield<>0 then raise exception 'SAVINGS_EXTRAORDINARY_CAPITAL_ONLY' using errcode='22023'; end if;
  if v_capital>greatest(v_balance.capital-v_balance.held_capital,0) or v_yield>greatest(v_balance.yield_amount-v_balance.held_yield,0) then raise exception 'SAVINGS_AVAILABLE_BALANCE_EXCEEDED' using errcode='22023'; end if;
  if v_request.request_type<>'TERMINATE' and v_request.requested_amount is distinct from v_capital+v_yield then raise exception 'SAVINGS_SETTLEMENT_BREAKDOWN_MISMATCH' using errcode='22023'; end if;
  if v_request.request_type='TERMINATE' and (v_capital<>greatest(v_balance.capital-v_balance.held_capital,0) or v_yield<>greatest(v_balance.yield_amount-v_balance.held_yield,0)) then raise exception 'SAVINGS_TERMINATION_REQUIRES_FULL_AVAILABLE' using errcode='22023'; end if;
  if v_capital>0 then insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,created_by_auth_user_id)
    values(v_request.participant_id,v_request.enrollment_id,'WITHDRAWAL','CAPITAL','DEBIT',v_capital,current_date,'SAVINGS_SETTLEMENT:'||p_request_id||':CAPITAL',auth.uid()); end if;
  if v_yield>0 then insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,created_by_auth_user_id)
    values(v_request.participant_id,v_request.enrollment_id,'WITHDRAWAL','YIELD','DEBIT',v_yield,current_date,'SAVINGS_SETTLEMENT:'||p_request_id||':YIELD',auth.uid()); end if;
  update public.savings_requests set status='SETTLED',settled_at=now(),requested_capital_amount=v_capital,requested_yield_amount=v_yield,
    reason=case when reason='' then btrim(p_reason) else reason||E'\nLiquidación: '||btrim(p_reason) end where id=p_request_id returning * into v_request;
  if v_request.request_type='TERMINATE' then update public.savings_enrollments set status='TERMINATED',continue_saving=false,terminated_at=now() where id=v_request.enrollment_id; end if;
  insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason,client_action_id)
  values(auth.uid(),v_request.usuario_contexto_affiliate_id,v_request.participant_id,'savings_requests','SETTLE',v_request.id::text,to_jsonb(v_request),btrim(p_reason),p_client_action_id);
  return to_jsonb(v_request);
end $$;

create function public.admin_create_savings_hold(p_participant_id uuid,p_enrollment_id uuid,p_component text,p_amount numeric,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_balance record;v_hold record;begin
  if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501'; end if;
  if p_amount is null or p_amount<=0 or upper(coalesce(p_component,'')) not in ('CAPITAL','YIELD') or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'SAVINGS_HOLD_INVALID' using errcode='22023'; end if;
  select * into v_balance from public.savings_participant_balance(p_participant_id);
  if upper(p_component)='CAPITAL' and p_amount>v_balance.capital-v_balance.held_capital or upper(p_component)='YIELD' and p_amount>v_balance.yield_amount-v_balance.held_yield then raise exception 'SAVINGS_HOLD_EXCEEDS_BALANCE' using errcode='22023'; end if;
  insert into public.savings_holds(participant_id,enrollment_id,component,amount,reason,created_by_auth_user_id)
  values(p_participant_id,p_enrollment_id,upper(p_component),p_amount,btrim(p_reason),auth.uid()) returning * into v_hold;
  insert into public.savings_audit_events(actor_real_auth_user_id,participant_id,resource,action,target_id,after_data,reason)
  values(auth.uid(),p_participant_id,'savings_holds','CREATE',v_hold.id::text,to_jsonb(v_hold),btrim(p_reason));
  return to_jsonb(v_hold);
end $$;

create function public.admin_release_savings_hold(p_hold_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_hold record;begin
  if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'SAVINGS_HOLD_REASON_REQUIRED' using errcode='22023'; end if;
  update public.savings_holds set status='RELEASED',released_at=now(),reason=reason||E'\nLiberación: '||btrim(p_reason) where id=p_hold_id and status='ACTIVE' returning * into v_hold;
  if not found then raise exception 'SAVINGS_ACTIVE_HOLD_NOT_FOUND' using errcode='P0001'; end if;
  insert into public.savings_audit_events(actor_real_auth_user_id,participant_id,resource,action,target_id,after_data,reason)
  values(auth.uid(),v_hold.participant_id,'savings_holds','RELEASE',v_hold.id::text,to_jsonb(v_hold),btrim(p_reason));
  return to_jsonb(v_hold);
end $$;


create function public.submit_self_savings_request(
  p_request_type text,p_amount numeric,p_component text,p_withdrawal_kind text,p_new_contribution_amount numeric,
  p_continue_saving boolean,p_effective_from date,p_reason text,p_supporting_document_id uuid,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();v_affiliate uuid:=public.get_effective_affiliate_id();
  v_participant record;v_enrollment record;v_request record;v_balance record;v_enrollment_id uuid;v_has_enrollment boolean:=false;
  v_type text:=upper(coalesce(p_request_type,''));v_component text:=upper(coalesce(p_component,''));v_kind text:=upper(coalesce(p_withdrawal_kind,'PARTIAL'));v_total_available numeric;
begin
  if v_actor is null or v_affiliate is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if p_idempotency_key is null then raise exception 'SAVINGS_IDEMPOTENCY_REQUIRED' using errcode='22023'; end if;
  select * into v_request from public.savings_requests where actor_real_auth_user_id=v_actor and idempotency_key=p_idempotency_key;
  if found then return to_jsonb(v_request); end if;
  if v_type not in ('JOIN','CHANGE_AMOUNT','WITHDRAW','TERMINATE','EXTRAORDINARY_WITHDRAWAL') then raise exception 'SAVINGS_REQUEST_TYPE_INVALID' using errcode='22023'; end if;
  select * into v_participant from public.savings_participants where affiliate_id=v_affiliate;
  if not found then
    if v_type<>'JOIN' then raise exception 'SAVINGS_PARTICIPANT_REQUIRED' using errcode='P0001'; end if;
    insert into public.savings_participants(participant_type,affiliate_id,legacy_folio,display_name,identity_status,certification_status,process_source,data_classification)
    select 'AFFILIATE',a.id,a.numero_control,coalesce(a.display_name,a.full_name),'RESOLVED','CERTIFIED','SHADOW','SHADOW' from public.affiliates a where a.id=v_affiliate
    returning * into v_participant;
  end if;
  if not public.savings_effective_action(case when v_type='EXTRAORDINARY_WITHDRAWAL' then 'WITHDRAW' else v_type end,v_participant.id) then
    raise exception 'SAVINGS_ACTION_DISABLED' using errcode='42501';
  end if;
  select * into v_enrollment from public.savings_enrollments where participant_id=v_participant.id order by sequence_number desc limit 1;
  v_has_enrollment:=found;
  if v_has_enrollment then v_enrollment_id:=v_enrollment.id; end if;
  if v_type='JOIN' then
    if v_has_enrollment and v_enrollment.status in ('REQUESTED','ACTIVE','TERMINATION_PENDING') then raise exception 'SAVINGS_ENROLLMENT_ALREADY_OPEN' using errcode='23505'; end if;
    if coalesce(p_new_contribution_amount,0)<=0 then raise exception 'SAVINGS_CONTRIBUTION_AMOUNT_REQUIRED' using errcode='22023'; end if;
  elsif not v_has_enrollment or v_enrollment.status<>'ACTIVE' then
    raise exception 'SAVINGS_ACTIVE_ENROLLMENT_REQUIRED' using errcode='P0001';
  end if;
  if v_type='CHANGE_AMOUNT' and (coalesce(p_new_contribution_amount,0)<=0 or p_effective_from is null or p_effective_from<=current_date) then
    raise exception 'SAVINGS_FUTURE_AMOUNT_CHANGE_REQUIRED' using errcode='22023';
  end if;
  if v_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') and (coalesce(p_amount,0)<=0 or v_component not in ('CAPITAL','YIELD','BOTH')) then
    raise exception 'SAVINGS_WITHDRAWAL_AMOUNT_INVALID' using errcode='22023';
  end if;
  if v_type='WITHDRAW' and v_kind not in ('PARTIAL','TOTAL') then raise exception 'SAVINGS_WITHDRAWAL_KIND_INVALID' using errcode='22023'; end if;
  if v_type='WITHDRAW' and v_kind='TOTAL' then
    select * into v_balance from public.savings_participant_balance(v_participant.id);
    v_total_available:=case v_component when 'CAPITAL' then greatest(v_balance.capital-v_balance.held_capital,0)
      when 'YIELD' then greatest(v_balance.yield_amount-v_balance.held_yield,0) else v_balance.available end;
    if p_amount is distinct from v_total_available or v_total_available<=0 then raise exception 'SAVINGS_TOTAL_WITHDRAWAL_AMOUNT_MISMATCH' using errcode='22023'; end if;
  end if;
  if v_type='EXTRAORDINARY_WITHDRAWAL' then
    if length(btrim(coalesce(p_reason,'')))<3 or p_supporting_document_id is null then raise exception 'SAVINGS_EXTRAORDINARY_DOCUMENT_REQUIRED' using errcode='22023'; end if;
    if v_component<>'CAPITAL' then raise exception 'SAVINGS_EXTRAORDINARY_CAPITAL_ONLY' using errcode='22023'; end if;
    if not exists(select 1 from public.affiliate_documents d where d.id=p_supporting_document_id and d.affiliate_id=v_affiliate) then raise exception 'SAVINGS_DOCUMENT_ACCESS_DENIED' using errcode='42501'; end if;
  end if;
  insert into public.savings_requests(
    folio,participant_id,enrollment_id,request_type,withdrawal_kind,component,requested_amount,new_contribution_amount,
    continue_saving,supporting_document_id,effective_from,reason,actor_real_auth_user_id,usuario_contexto_affiliate_id,idempotency_key
  ) values(
    'AHO-'||to_char(clock_timestamp(),'YYYY')||'-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,8)),
    v_participant.id,v_enrollment_id,v_type,
    case when v_type='EXTRAORDINARY_WITHDRAWAL' then 'EXTRAORDINARY' when v_type='WITHDRAW' then v_kind else null end,
    nullif(v_component,''),p_amount,p_new_contribution_amount,case when v_type='TERMINATE' then false else p_continue_saving end,
    p_supporting_document_id,p_effective_from,btrim(coalesce(p_reason,'')),v_actor,v_affiliate,p_idempotency_key
  ) returning * into v_request;
  insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason,client_action_id)
  values(v_actor,v_affiliate,v_participant.id,'savings_requests','SUBMIT',v_request.id::text,to_jsonb(v_request),v_request.reason,p_idempotency_key);
  return to_jsonb(v_request);
end $$;

create function public.replace_self_savings_beneficiaries(p_beneficiaries jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_affiliate uuid:=public.get_effective_affiliate_id();v_participant uuid;v_version integer;v_version_id uuid;v_total numeric;v_count integer;
begin
  if v_actor is null or v_affiliate is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if p_idempotency_key is null or jsonb_typeof(p_beneficiaries)<>'array' then raise exception 'SAVINGS_BENEFICIARIES_INVALID' using errcode='22023'; end if;
  if exists(select 1 from public.savings_audit_events where client_action_id=p_idempotency_key) then
    return coalesce((select after_data from public.savings_audit_events where client_action_id=p_idempotency_key),'{}'::jsonb);
  end if;
  select id into v_participant from public.savings_participants where affiliate_id=v_affiliate and certification_status='CERTIFIED';
  if v_participant is null or not exists(select 1 from public.savings_enrollments where participant_id=v_participant and status in ('ACTIVE','TERMINATION_PENDING')) then raise exception 'SAVINGS_ACTIVE_ENROLLMENT_REQUIRED' using errcode='P0001'; end if;
  select count(*),coalesce(sum((x->>'percentage')::numeric),0) into v_count,v_total from jsonb_array_elements(p_beneficiaries)x;
  if v_count<1 or v_count>20 or v_total<>100 or exists(select 1 from jsonb_array_elements(p_beneficiaries)x where length(btrim(x->>'full_name'))<3 or length(btrim(x->>'relationship'))<2 or (x->>'percentage')::numeric<=0) then
    raise exception 'SAVINGS_BENEFICIARIES_MUST_TOTAL_100' using errcode='22023';
  end if;
  select coalesce(max(version_number),0)+1 into v_version from public.savings_beneficiary_versions where participant_id=v_participant;
  update public.savings_beneficiary_versions set status='SUPERSEDED',superseded_at=now() where participant_id=v_participant and status='ACTIVE';
  insert into public.savings_beneficiary_versions(participant_id,version_number,status,actor_real_auth_user_id) values(v_participant,v_version,'ACTIVE',v_actor) returning id into v_version_id;
  insert into public.savings_beneficiaries(version_id,full_name,relationship,percentage)
  select v_version_id,btrim(x->>'full_name'),btrim(x->>'relationship'),(x->>'percentage')::numeric from jsonb_array_elements(p_beneficiaries)x;
  insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,client_action_id)
  values(v_actor,v_affiliate,v_participant,'savings_beneficiaries','REPLACE_VERSION',v_version_id::text,jsonb_build_object('version',v_version,'beneficiaries',p_beneficiaries),p_idempotency_key);
  return jsonb_build_object('version_id',v_version_id,'version_number',v_version,'beneficiaries',p_beneficiaries);
end $$;

create function public.admin_set_savings_action(
  p_action_code text,p_enabled boolean,p_scope_type text,p_participant_id uuid,p_reason text,p_effective_from timestamptz,p_effective_to timestamptz
)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid;begin
  if auth.uid() is null or not public.has_admin_permission('savings.config') then raise exception 'SAVINGS_CONFIG_DENIED' using errcode='42501'; end if;
  insert into public.savings_action_availability(action_code,scope_type,participant_id,enabled,reason,effective_from,effective_to,configured_by_auth_user_id)
  values(upper(p_action_code),upper(p_scope_type),p_participant_id,p_enabled,btrim(p_reason),coalesce(p_effective_from,now()),p_effective_to,auth.uid()) returning id into v_id;
  insert into public.savings_audit_events(actor_real_auth_user_id,participant_id,resource,action,target_id,after_data,reason)
  values(auth.uid(),p_participant_id,'savings_action_availability','INSERT',v_id::text,jsonb_build_object('action',upper(p_action_code),'scope',upper(p_scope_type),'enabled',p_enabled),btrim(p_reason));
  return v_id;
end $$;

create function public.admin_override_savings_contribution(
  p_enrollment_id uuid,p_contribution_date date,p_actual_amount numeric,p_reason text,p_client_action_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_enrollment record;v_expected numeric;v_previous numeric;v_version integer;v_override record;v_delta numeric;v_transaction uuid;
begin
  if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501'; end if;
  if p_contribution_date is null or p_contribution_date>current_date or p_actual_amount<0 or length(btrim(coalesce(p_reason,'')))<3 or p_client_action_id is null then raise exception 'SAVINGS_OVERRIDE_INVALID' using errcode='22023'; end if;
  select * into v_override from public.savings_contribution_overrides where client_action_id=p_client_action_id;
  if found then return to_jsonb(v_override); end if;
  select * into v_enrollment from public.savings_enrollments where id=p_enrollment_id;
  if not found then raise exception 'SAVINGS_ENROLLMENT_NOT_FOUND' using errcode='P0001'; end if;
  select expected_amount into v_expected from public.generate_savings_schedule(p_enrollment_id,p_contribution_date,p_contribution_date) limit 1;
  if v_expected is null then raise exception 'SAVINGS_DATE_NOT_EXPECTED' using errcode='22023'; end if;
  select actual_amount into v_previous from public.savings_contribution_overrides where enrollment_id=p_enrollment_id and contribution_date=p_contribution_date order by version_number desc limit 1;
  v_previous:=coalesce(v_previous,v_expected);
  select coalesce(max(version_number),0)+1 into v_version from public.savings_contribution_overrides where enrollment_id=p_enrollment_id and contribution_date=p_contribution_date;
  insert into public.savings_contribution_overrides(enrollment_id,contribution_date,expected_amount,actual_amount,version_number,reason,editor_auth_user_id,client_action_id)
  values(p_enrollment_id,p_contribution_date,v_expected,p_actual_amount,v_version,btrim(p_reason),auth.uid(),p_client_action_id) returning * into v_override;
  v_delta:=p_actual_amount-v_previous;
  if v_delta<>0 and exists(select 1 from public.savings_transactions where enrollment_id=p_enrollment_id and contribution_date=p_contribution_date and transaction_type='CONTRIBUTION') then
    insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,expected_amount,actual_amount,difference_amount,idempotency_key,created_by_auth_user_id)
    values(v_enrollment.participant_id,p_enrollment_id,'ADJUSTMENT','CAPITAL',case when v_delta>0 then 'CREDIT' else 'DEBIT' end,abs(v_delta),current_date,p_contribution_date,v_expected,p_actual_amount,p_actual_amount-v_expected,'SAVINGS_OVERRIDE:'||v_override.id,auth.uid()) returning id into v_transaction;
  end if;
  insert into public.savings_audit_events(actor_real_auth_user_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
  values(auth.uid(),v_enrollment.participant_id,'savings_contribution_overrides','INSERT_VERSION',v_override.id::text,jsonb_build_object('actual_amount',v_previous),to_jsonb(v_override),btrim(p_reason),p_client_action_id);
  return to_jsonb(v_override)||jsonb_build_object('adjustment_transaction_id',v_transaction);
end $$;

create function public.materialize_savings_contributions(p_as_of date)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_row record;v_actual numeric;v_inserted integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'SAVINGS_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_as_of is null or p_as_of>current_date then raise exception 'SAVINGS_AS_OF_INVALID' using errcode='22023'; end if;
  for v_row in
    select e.id enrollment_id,e.participant_id,s.contribution_date,s.expected_amount
    from public.savings_enrollments e cross join lateral public.generate_savings_schedule(e.id,e.first_expected_contribution_date,p_as_of)s
    where e.status in ('ACTIVE','TERMINATION_PENDING') and e.first_expected_contribution_date<=p_as_of
  loop
    select actual_amount into v_actual from public.savings_contribution_overrides
    where enrollment_id=v_row.enrollment_id and contribution_date=v_row.contribution_date order by version_number desc limit 1;
    v_actual:=coalesce(v_actual,v_row.expected_amount);
    if v_actual>0 then
      insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,expected_amount,actual_amount,difference_amount,idempotency_key,data_classification)
      values(v_row.participant_id,v_row.enrollment_id,'CONTRIBUTION','CAPITAL','CREDIT',v_actual,v_row.contribution_date,v_row.contribution_date,v_row.expected_amount,v_actual,v_actual-v_row.expected_amount,
        'CONTRIBUTION:'||v_row.enrollment_id||':'||v_row.contribution_date,'SHADOW') on conflict(idempotency_key) do nothing;
      if found then
        v_inserted:=v_inserted+1;
        update public.savings_enrollments set first_actual_contribution_date=coalesce(first_actual_contribution_date,v_row.contribution_date) where id=v_row.enrollment_id;
      end if;
    end if;
  end loop;
  return jsonb_build_object('as_of',p_as_of,'inserted',v_inserted,'authority','SHADOW');
end $$;

create function public.admin_record_savings_process_change(p_participant_id uuid,p_new_process text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_participant record;v_active boolean;v_event record;begin
  if auth.uid() is null or not (public.has_admin_permission('savings.write') and public.has_admin_permission('affiliates.write')) then raise exception 'SAVINGS_PROCESS_CHANGE_DENIED' using errcode='42501'; end if;
  select * into v_participant from public.savings_participants where id=p_participant_id for update;
  if not found or upper(p_new_process) not in ('JUB','PROCESS_1','PROCESS_3') or length(btrim(coalesce(p_reason,'')))<3 then raise exception 'SAVINGS_PROCESS_CHANGE_INVALID' using errcode='22023'; end if;
  select exists(select 1 from public.savings_enrollments where participant_id=p_participant_id and status in ('ACTIVE','TERMINATION_PENDING')) into v_active;
  insert into public.savings_process_change_events(participant_id,affiliate_id,legacy_folio,old_process,new_process,status,current_plan_snapshot,reason,actor_real_auth_user_id)
  values(p_participant_id,v_participant.affiliate_id,v_participant.legacy_folio,v_participant.current_process,upper(p_new_process),case when v_active then 'SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED' else 'NO_ACTIVE_ENROLLMENT' end,
    coalesce((select to_jsonb(p) from public.savings_contribution_plans p join public.savings_enrollments e on e.id=p.enrollment_id where e.participant_id=p_participant_id order by p.effective_from desc limit 1),'{}'::jsonb),btrim(p_reason),auth.uid()) returning * into v_event;
  update public.savings_participants set current_process=upper(p_new_process),process_source='SHADOW' where id=p_participant_id;
  insert into public.savings_audit_events(actor_real_auth_user_id,participant_id,resource,action,target_id,before_data,after_data,reason)
  values(auth.uid(),p_participant_id,'savings_process_change_events','INSERT',v_event.id::text,jsonb_build_object('process',v_participant.current_process),jsonb_build_object('process',upper(p_new_process),'status',v_event.status),btrim(p_reason));
  return to_jsonb(v_event);
end $$;

create function public.admin_review_savings_process_change(p_event_id uuid,p_decision text,p_effective_from date,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_event record;v_enrollment uuid;v_plan record;begin
  if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'SAVINGS_PROCESS_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_event from public.savings_process_change_events where id=p_event_id for update;
  if not found or v_event.status<>'SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED' then raise exception 'SAVINGS_PROCESS_CHANGE_NOT_PENDING' using errcode='P0001'; end if;
  if upper(p_decision)='DISMISS' then
    update public.savings_process_change_events set status='DISMISSED',reviewed_by_auth_user_id=auth.uid(),reviewed_at=now(),reason=reason||E'\nRevisión: '||btrim(p_reason) where id=p_event_id returning * into v_event;
  elsif upper(p_decision)='APPLY' then
    if p_effective_from is null or p_effective_from<=current_date then raise exception 'SAVINGS_PROCESS_FUTURE_DATE_REQUIRED' using errcode='22023'; end if;
    select id into v_enrollment from public.savings_enrollments where participant_id=v_event.participant_id and status in ('ACTIVE','TERMINATION_PENDING') order by sequence_number desc limit 1;
    select * into v_plan from public.savings_contribution_plans where enrollment_id=v_enrollment and effective_from<=p_effective_from and (effective_to is null or effective_to>=p_effective_from) order by effective_from desc limit 1 for update;
    if not found then raise exception 'SAVINGS_ACTIVE_PLAN_REQUIRED' using errcode='P0001'; end if;
    update public.savings_contribution_plans set effective_to=p_effective_from-1 where id=v_plan.id;
    insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,source_request_id,data_classification,created_by_auth_user_id)
    values(v_enrollment,v_plan.amount,v_event.new_process,p_effective_from,null,'SHADOW',auth.uid());
    update public.savings_process_change_events set status='APPLIED',effective_from=p_effective_from,reviewed_by_auth_user_id=auth.uid(),reviewed_at=now(),reason=reason||E'\nRevisión: '||btrim(p_reason) where id=p_event_id returning * into v_event;
  else raise exception 'SAVINGS_PROCESS_DECISION_INVALID' using errcode='22023'; end if;
  insert into public.savings_audit_events(actor_real_auth_user_id,participant_id,resource,action,target_id,after_data,reason)
  values(auth.uid(),v_event.participant_id,'savings_process_change_events',upper(p_decision),v_event.id::text,to_jsonb(v_event),btrim(p_reason));
  return to_jsonb(v_event);
end $$;


create table public.savings_import_batches(
  id uuid primary key default extensions.gen_random_uuid(),
  source_workbook_id text not null,
  source_workbook_name text not null,
  source_snapshot_sha256 text not null unique,
  certification_status text not null default 'PENDING_REVIEW',
  status text not null default 'VALIDATED',
  row_counts jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  imported_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  constraint savings_import_hash_check check(source_snapshot_sha256 ~ '^[A-F0-9]{64}$'),
  constraint savings_import_cert_check check(certification_status in ('PENDING_REVIEW','CERTIFIED')),
  constraint savings_import_status_check check(status in ('VALIDATED','APPLIED','FAILED'))
);

create table public.savings_participants(
  id uuid primary key default extensions.gen_random_uuid(),
  participant_type text not null,
  affiliate_id uuid null references public.affiliates(id) on delete restrict,
  legacy_folio text null,
  display_name text null,
  identity_status text not null,
  certification_status text not null default 'PENDING_REVIEW',
  current_process text null,
  process_source text not null default 'PENDING_REVIEW',
  data_classification text not null default 'SHADOW',
  legacy_reported_balance numeric(14,2) null,
  legacy_balance_status text not null default 'PENDING_REVIEW',
  import_batch_id uuid null references public.savings_import_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_participant_type_check check(participant_type in ('AFFILIATE','NON_AFFILIATE','LEGACY_UNRESOLVED')),
  constraint savings_participant_identity_check check(identity_status in ('RESOLVED','AMBIGUOUS','ORPHAN','NON_AFFILIATE')),
  constraint savings_participant_cert_check check(certification_status in ('PENDING_REVIEW','CERTIFIED')),
  constraint savings_participant_process_check check(current_process is null or current_process in ('JUB','PROCESS_1','PROCESS_3')),
  constraint savings_participant_process_source_check check(process_source in ('LEGACY','SHADOW','PENDING_REVIEW')),
  constraint savings_participant_class_check check(data_classification in ('LEGACY','SHADOW','PENDING_REVIEW','CANONICAL')),
  constraint savings_participant_balance_check check(legacy_reported_balance is null or legacy_reported_balance>=0),
  constraint savings_participant_balance_status_check check(legacy_balance_status in ('MATCH','MISMATCH','PENDING_REVIEW')),
  constraint savings_participant_link_check check(
    (identity_status='RESOLVED' and affiliate_id is not null and participant_type='AFFILIATE')
    or (identity_status in ('AMBIGUOUS','ORPHAN') and affiliate_id is null and participant_type='LEGACY_UNRESOLVED')
    or (identity_status='NON_AFFILIATE' and affiliate_id is null and participant_type='NON_AFFILIATE')
  )
);
create unique index savings_participants_affiliate_unique on public.savings_participants(affiliate_id) where affiliate_id is not null;
create unique index savings_participants_legacy_folio_unique on public.savings_participants(legacy_folio) where legacy_folio is not null;
create index savings_participants_identity_idx on public.savings_participants(identity_status,certification_status);

create table public.savings_enrollments(
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.savings_participants(id) on delete restrict,
  sequence_number integer not null,
  status text not null,
  enrollment_started_at timestamptz not null,
  requested_at timestamptz null,
  approved_at timestamptz null,
  first_expected_contribution_date date null,
  first_actual_contribution_date date null,
  terminated_at timestamptz null,
  continue_saving boolean not null default true,
  process_snapshot text null,
  data_classification text not null default 'SHADOW',
  import_batch_id uuid null references public.savings_import_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint savings_enrollment_sequence_check check(sequence_number>0),
  constraint savings_enrollment_status_check check(status in ('REQUESTED','ACTIVE','TERMINATION_PENDING','TERMINATED','REJECTED')),
  constraint savings_enrollment_process_check check(process_snapshot is null or process_snapshot in ('JUB','PROCESS_1','PROCESS_3')),
  constraint savings_enrollment_class_check check(data_classification in ('LEGACY','SHADOW','PENDING_REVIEW','CANONICAL')),
  constraint savings_enrollment_activation_check check(status not in ('ACTIVE','TERMINATION_PENDING') or (approved_at is not null and first_expected_contribution_date is not null and process_snapshot is not null)),
  constraint savings_enrollment_termination_check check(status<>'TERMINATED' or terminated_at is not null),
  unique(participant_id,sequence_number)
);
create unique index savings_enrollments_one_open_idx on public.savings_enrollments(participant_id) where status in ('REQUESTED','ACTIVE','TERMINATION_PENDING');
create index savings_enrollments_participant_status_idx on public.savings_enrollments(participant_id,status);

create table public.savings_contribution_plans(
  id uuid primary key default extensions.gen_random_uuid(),
  enrollment_id uuid not null references public.savings_enrollments(id) on delete restrict,
  amount numeric(14,2) not null,
  process_snapshot text not null,
  effective_from date not null,
  effective_to date null,
  source_request_id uuid null,
  data_classification text not null default 'SHADOW',
  import_batch_id uuid null references public.savings_import_batches(id) on delete restrict,
  created_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint savings_plan_amount_check check(amount>0),
  constraint savings_plan_process_check check(process_snapshot in ('JUB','PROCESS_1','PROCESS_3')),
  constraint savings_plan_dates_check check(effective_to is null or effective_to>=effective_from),
  constraint savings_plan_class_check check(data_classification in ('LEGACY','SHADOW','PENDING_REVIEW','CANONICAL'))
);
create unique index savings_plans_one_start_idx on public.savings_contribution_plans(enrollment_id,effective_from);
create index savings_plans_effective_idx on public.savings_contribution_plans(enrollment_id,effective_from,effective_to);

create table public.savings_contribution_overrides(
  id uuid primary key default extensions.gen_random_uuid(),
  enrollment_id uuid not null references public.savings_enrollments(id) on delete restrict,
  contribution_date date not null,
  expected_amount numeric(14,2) not null,
  actual_amount numeric(14,2) not null,
  version_number integer not null,
  reason text not null,
  editor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  client_action_id uuid not null unique,
  created_at timestamptz not null default now(),
  constraint savings_override_amount_check check(expected_amount>=0 and actual_amount>=0),
  constraint savings_override_version_check check(version_number>0),
  constraint savings_override_reason_check check(length(btrim(reason)) between 3 and 1000),
  unique(enrollment_id,contribution_date,version_number)
);
create index savings_overrides_latest_idx on public.savings_contribution_overrides(enrollment_id,contribution_date,version_number desc);

create table public.savings_transactions(
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.savings_participants(id) on delete restrict,
  enrollment_id uuid null references public.savings_enrollments(id) on delete restrict,
  transaction_type text not null,
  component text not null,
  direction text not null,
  amount numeric(14,2) not null,
  effective_date date not null,
  contribution_date date null,
  expected_amount numeric(14,2) null,
  actual_amount numeric(14,2) null,
  difference_amount numeric(14,2) null,
  idempotency_key text not null unique,
  reversal_of_transaction_id uuid null references public.savings_transactions(id) on delete restrict,
  data_classification text not null default 'SHADOW',
  import_batch_id uuid null references public.savings_import_batches(id) on delete restrict,
  source_evidence_id uuid null,
  created_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint savings_transaction_type_check check(transaction_type in ('CONTRIBUTION','YIELD_CREDIT','WITHDRAWAL','REGULARIZATION','ADJUSTMENT','REVERSAL','HOLD_SETTLEMENT')),
  constraint savings_transaction_component_check check(component in ('CAPITAL','YIELD')),
  constraint savings_transaction_direction_check check(direction in ('CREDIT','DEBIT')),
  constraint savings_transaction_amount_check check(amount>0),
  constraint savings_transaction_class_check check(data_classification in ('LEGACY','SHADOW','PENDING_REVIEW','CANONICAL')),
  constraint savings_transaction_actual_check check((expected_amount is null and actual_amount is null and difference_amount is null) or (expected_amount is not null and actual_amount is not null and difference_amount=actual_amount-expected_amount)),
  constraint savings_transaction_reversal_check check(transaction_type<>'REVERSAL' or reversal_of_transaction_id is not null)
);
create index savings_transactions_balance_idx on public.savings_transactions(participant_id,component,effective_date,id);
create index savings_transactions_enrollment_idx on public.savings_transactions(enrollment_id,contribution_date);

create table public.savings_action_availability(
  id uuid primary key default extensions.gen_random_uuid(),
  action_code text not null,
  scope_type text not null,
  participant_id uuid null references public.savings_participants(id) on delete restrict,
  enabled boolean not null,
  reason text not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  configured_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint savings_action_code_check check(action_code in ('JOIN','CHANGE_AMOUNT','WITHDRAW','TERMINATE')),
  constraint savings_action_scope_check check((scope_type='GLOBAL' and participant_id is null) or (scope_type='PARTICIPANT' and participant_id is not null)),
  constraint savings_action_dates_check check(effective_to is null or effective_to>effective_from),
  constraint savings_action_reason_check check(length(btrim(reason)) between 3 and 1000)
);
create index savings_action_effective_idx on public.savings_action_availability(action_code,scope_type,participant_id,effective_from desc);

create table public.savings_beneficiary_versions(
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.savings_participants(id) on delete restrict,
  version_number integer not null,
  status text not null default 'ACTIVE',
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  superseded_at timestamptz null,
  constraint savings_beneficiary_version_check check(version_number>0),
  constraint savings_beneficiary_version_status_check check(status in ('ACTIVE','SUPERSEDED')),
  unique(participant_id,version_number)
);
create unique index savings_beneficiary_one_active_idx on public.savings_beneficiary_versions(participant_id) where status='ACTIVE';

create table public.savings_beneficiaries(
  id uuid primary key default extensions.gen_random_uuid(),
  version_id uuid not null references public.savings_beneficiary_versions(id) on delete restrict,
  full_name text not null,
  relationship text not null,
  percentage numeric(5,2) not null,
  created_at timestamptz not null default now(),
  constraint savings_beneficiary_name_check check(length(btrim(full_name)) between 3 and 180),
  constraint savings_beneficiary_relationship_check check(length(btrim(relationship)) between 2 and 80),
  constraint savings_beneficiary_percentage_check check(percentage>0 and percentage<=100)
);
create index savings_beneficiaries_version_idx on public.savings_beneficiaries(version_id);

create table public.savings_requests(
  id uuid primary key default extensions.gen_random_uuid(),
  folio text not null unique,
  participant_id uuid not null references public.savings_participants(id) on delete restrict,
  enrollment_id uuid null references public.savings_enrollments(id) on delete restrict,
  request_type text not null,
  withdrawal_kind text null,
  component text null,
  requested_amount numeric(14,2) null,
  requested_capital_amount numeric(14,2) null,
  requested_yield_amount numeric(14,2) null,
  new_contribution_amount numeric(14,2) null,
  continue_saving boolean null,
  supporting_document_id uuid null references public.affiliate_documents(id) on delete restrict,
  status text not null default 'SUBMITTED',
  effective_from date null,
  reason text not null default '',
  actor_real_auth_user_id uuid null references auth.users(id) on delete restrict,
  usuario_contexto_affiliate_id uuid null references public.affiliates(id) on delete restrict,
  idempotency_key uuid not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  settled_at timestamptz null,
  data_classification text not null default 'SHADOW',
  metadata jsonb not null default '{}'::jsonb,
  constraint savings_request_type_check check(request_type in ('JOIN','CHANGE_AMOUNT','WITHDRAW','TERMINATE','EXTRAORDINARY_WITHDRAWAL')),
  constraint savings_request_withdrawal_kind_check check(withdrawal_kind is null or withdrawal_kind in ('PARTIAL','TOTAL','EXTRAORDINARY')),
  constraint savings_request_component_check check(component is null or component in ('CAPITAL','YIELD','BOTH')),
  constraint savings_request_status_check check(status in ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED','SETTLED')),
  constraint savings_request_class_check check(data_classification in ('LEGACY','SHADOW','PENDING_REVIEW','CANONICAL')),
  constraint savings_request_actor_check check(data_classification='LEGACY' or (actor_real_auth_user_id is not null and usuario_contexto_affiliate_id is not null)),
  constraint savings_request_amount_check check(coalesce(requested_amount,0)>=0 and coalesce(requested_capital_amount,0)>=0 and coalesce(requested_yield_amount,0)>=0 and coalesce(new_contribution_amount,0)>=0),
  constraint savings_request_extraordinary_doc_check check(request_type<>'EXTRAORDINARY_WITHDRAWAL' or (supporting_document_id is not null and length(btrim(reason))>=3)),
  constraint savings_request_join_amount_check check(request_type<>'JOIN' or new_contribution_amount>0),
  constraint savings_request_change_amount_check check(request_type<>'CHANGE_AMOUNT' or (new_contribution_amount>0 and effective_from is not null)),
  constraint savings_request_terminate_check check(request_type<>'TERMINATE' or continue_saving=false),
  unique(actor_real_auth_user_id,idempotency_key)
);
create index savings_requests_queue_idx on public.savings_requests(status,request_type,submitted_at);
create index savings_requests_participant_idx on public.savings_requests(participant_id,submitted_at desc);

create table public.savings_request_approvals(
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null references public.savings_requests(id) on delete restrict,
  approval_role text not null,
  decision text not null,
  reason text not null,
  actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  constraint savings_approval_role_check check(approval_role in ('GENERAL_SECRETARY','FINANCE_SECRETARY','SAVINGS_ADMIN')),
  constraint savings_approval_decision_check check(decision in ('APPROVE','REJECT')),
  constraint savings_approval_reason_check check(length(btrim(reason)) between 3 and 1000),
  unique(request_id,approval_role)
);

create table public.savings_holds(
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.savings_participants(id) on delete restrict,
  enrollment_id uuid null references public.savings_enrollments(id) on delete restrict,
  component text not null,
  amount numeric(14,2) not null,
  status text not null default 'ACTIVE',
  reason text not null,
  created_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  released_at timestamptz null,
  constraint savings_hold_component_check check(component in ('CAPITAL','YIELD')),
  constraint savings_hold_amount_check check(amount>0),
  constraint savings_hold_status_check check(status in ('ACTIVE','RELEASED','SETTLED')),
  constraint savings_hold_reason_check check(length(btrim(reason)) between 3 and 1000)
);
create index savings_holds_active_idx on public.savings_holds(participant_id,status);

create table public.savings_yield_periods(
  id uuid primary key default extensions.gen_random_uuid(),
  period_year integer not null,
  semester integer not null,
  starts_on date not null,
  ends_on date not null,
  rate numeric(9,6) null,
  eligibility_policy jsonb not null default '{}'::jsonb,
  exclusion_policy jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT',
  productive_enabled boolean not null default false,
  approved_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint savings_yield_semester_check check(semester in (1,2)),
  constraint savings_yield_dates_check check(ends_on>=starts_on),
  constraint savings_yield_rate_check check(rate is null or rate>=0),
  constraint savings_yield_status_check check(status in ('DRAFT','APPROVED','CREDITED','DISABLED')),
  constraint savings_yield_disabled_check check(productive_enabled=false),
  unique(period_year,semester)
);

create table public.savings_yield_allocations(
  id uuid primary key default extensions.gen_random_uuid(),
  yield_period_id uuid not null references public.savings_yield_periods(id) on delete restrict,
  participant_id uuid not null references public.savings_participants(id) on delete restrict,
  eligible boolean not null,
  exclusion_reason text null,
  calculation_basis numeric(14,2) not null default 0,
  calculated_amount numeric(14,2) not null default 0,
  approved_amount numeric(14,2) null,
  status text not null default 'PENDING_REVIEW',
  approved_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint savings_yield_allocation_amount_check check(calculation_basis>=0 and calculated_amount>=0 and coalesce(approved_amount,0)>=0),
  constraint savings_yield_allocation_status_check check(status in ('PENDING_REVIEW','APPROVED','EXCLUDED','CREDITED')),
  unique(yield_period_id,participant_id)
);

create table public.savings_process_change_events(
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.savings_participants(id) on delete restrict,
  affiliate_id uuid null references public.affiliates(id) on delete restrict,
  legacy_folio text null,
  old_process text null,
  new_process text not null,
  status text not null,
  effective_from date null,
  current_plan_snapshot jsonb not null default '{}'::jsonb,
  reason text not null,
  actor_real_auth_user_id uuid null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  reviewed_by_auth_user_id uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  constraint savings_process_change_old_check check(old_process is null or old_process in ('JUB','PROCESS_1','PROCESS_3')),
  constraint savings_process_change_new_check check(new_process in ('JUB','PROCESS_1','PROCESS_3')),
  constraint savings_process_change_status_check check(status in ('SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED','APPLIED','DISMISSED','NO_ACTIVE_ENROLLMENT')),
  constraint savings_process_change_reason_check check(length(btrim(reason)) between 3 and 1000)
);
create index savings_process_change_queue_idx on public.savings_process_change_events(status,created_at);

create table public.savings_legacy_evidence(
  id uuid primary key default extensions.gen_random_uuid(),
  import_batch_id uuid not null references public.savings_import_batches(id) on delete restrict,
  participant_id uuid null references public.savings_participants(id) on delete restrict,
  source_workbook_id text not null,
  source_sheet text not null,
  source_column text not null,
  source_row integer not null,
  legacy_folio text null,
  observed_on date null,
  numeric_value numeric(14,2) null,
  record_type text not null,
  data_classification text not null,
  source_row_sha256 text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint savings_evidence_row_check check(source_row>0),
  constraint savings_evidence_type_check check(record_type in ('PARTICIPANT','ENROLLMENT','PLAN','CONTRIBUTION','WITHDRAWAL','AMOUNT_CHANGE','REQUEST','YIELD','DOCUMENT','REPORT','LEGACY_REPORTED_BALANCE','AA_DO_CELL','DP_DW_CELL')),
  constraint savings_evidence_class_check check(data_classification in ('RAW_LEGACY','EXPECTED','ACTUAL','LEGACY_SNAPSHOT','CANONICAL','PENDING_REVIEW')),
  constraint savings_evidence_hash_check check(source_row_sha256 ~ '^[A-F0-9]{64}$'),
  unique(import_batch_id,source_sheet,source_column,source_row,record_type)
);

create table public.savings_audit_events(
  id bigint generated always as identity primary key,
  actor_real_auth_user_id uuid null references auth.users(id) on delete restrict,
  usuario_contexto_affiliate_id uuid null references public.affiliates(id) on delete restrict,
  participant_id uuid null references public.savings_participants(id) on delete restrict,
  resource text not null,
  action text not null,
  target_id text null,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  reason text not null default '',
  client_action_id uuid null unique,
  created_at timestamptz not null default now()
);
create index savings_audit_created_idx on public.savings_audit_events(created_at desc);
create index savings_audit_participant_idx on public.savings_audit_events(participant_id,created_at desc);

alter table public.savings_contribution_plans
  add constraint savings_plan_source_request_fk foreign key(source_request_id) references public.savings_requests(id) on delete restrict;
alter table public.savings_transactions
  add constraint savings_transaction_evidence_fk foreign key(source_evidence_id) references public.savings_legacy_evidence(id) on delete restrict;

comment on table public.savings_transactions is 'Append-only savings ledger. Balances are projections of this table; legacy Q is never a ledger source.';
comment on table public.savings_legacy_evidence is 'Immutable cell/row provenance for certified legacy snapshots. It does not reproduce AA:DO or DP:DW as schema columns.';
comment on table public.savings_yield_periods is 'Semestral yield foundation. Productive calculation/credit is intentionally disabled pending later owner authorization.';

create function public.reject_savings_history_mutation()
returns trigger language plpgsql security definer set search_path=''
as $$ begin raise exception 'SAVINGS_APPEND_ONLY_HISTORY' using errcode='55000'; end $$;

create trigger savings_transactions_append_only before update or delete on public.savings_transactions
for each row execute function public.reject_savings_history_mutation();
create trigger savings_legacy_evidence_append_only before update or delete on public.savings_legacy_evidence
for each row execute function public.reject_savings_history_mutation();
create trigger savings_audit_events_append_only before update or delete on public.savings_audit_events
for each row execute function public.reject_savings_history_mutation();
create trigger savings_beneficiaries_append_only before update or delete on public.savings_beneficiaries
for each row execute function public.reject_savings_history_mutation();
create trigger savings_request_approvals_append_only before update or delete on public.savings_request_approvals
for each row execute function public.reject_savings_history_mutation();

create trigger savings_participants_updated_at before update on public.savings_participants
for each row execute function public.set_h0072_updated_at();

create function public.capture_savings_process_change_from_affiliate()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_old_process text;v_new_process text;v_participant record;v_enrollment record;v_plan jsonb;
begin
  v_old_process:=case old.financial_employee_category_code
    when 'SUPLENTES_VARIABLES' then 'PROCESS_3' when 'JUBILADOS_PENSIONADOS' then 'JUB'
    when 'SUPLENTES_FIJOS' then 'PROCESS_1' when 'EVENTUALES' then 'PROCESS_1' when 'BASE' then 'PROCESS_1' else null end;
  v_new_process:=case new.financial_employee_category_code
    when 'SUPLENTES_VARIABLES' then 'PROCESS_3' when 'JUBILADOS_PENSIONADOS' then 'JUB'
    when 'SUPLENTES_FIJOS' then 'PROCESS_1' when 'EVENTUALES' then 'PROCESS_1' when 'BASE' then 'PROCESS_1' else null end;
  if v_new_process is null or v_new_process is not distinct from v_old_process then return new; end if;
  select * into v_participant from public.savings_participants where affiliate_id=new.id;
  if not found then return new; end if;
  select * into v_enrollment from public.savings_enrollments
    where participant_id=v_participant.id and status in ('ACTIVE','TERMINATION_PENDING')
    order by sequence_number desc limit 1;
  if found then
    select to_jsonb(p) into v_plan from public.savings_contribution_plans p
      where p.enrollment_id=v_enrollment.id order by p.effective_from desc limit 1;
  end if;
  insert into public.savings_process_change_events(
    participant_id,affiliate_id,legacy_folio,old_process,new_process,status,current_plan_snapshot,reason,actor_real_auth_user_id
  ) values(
    v_participant.id,new.id,v_participant.legacy_folio,coalesce(v_participant.current_process,v_old_process),v_new_process,
    case when v_enrollment.id is null then 'NO_ACTIVE_ENROLLMENT' else 'SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED' end,
    coalesce(v_plan,'{}'::jsonb),'Cambio detectado desde Admin Afiliados',auth.uid()
  );
  update public.savings_participants set current_process=v_new_process,process_source='SHADOW' where id=v_participant.id;
  insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason)
  values(auth.uid(),new.id,v_participant.id,'affiliates.financial_employee_category_code','PROCESS_CHANGE_DETECTED',new.id::text,
    jsonb_build_object('category',old.financial_employee_category_code,'process',coalesce(v_participant.current_process,v_old_process)),
    jsonb_build_object('category',new.financial_employee_category_code,'process',v_new_process),'Plan histórico sin modificar; revisión futura requerida');
  return new;
end $$;

create trigger savings_capture_affiliate_process_change
after update of financial_employee_category_code on public.affiliates
for each row when(old.financial_employee_category_code is distinct from new.financial_employee_category_code)
execute function public.capture_savings_process_change_from_affiliate();

create function public.savings_participant_balance(p_participant_id uuid)
returns table(capital numeric,yield_amount numeric,total numeric,held_capital numeric,held_yield numeric,held numeric,available numeric)
language sql stable security definer set search_path=''
as $$
  with ledger as(
    select
      coalesce(sum(case when component='CAPITAL' then case direction when 'CREDIT' then amount else -amount end else 0 end),0)::numeric as capital,
      coalesce(sum(case when component='YIELD' then case direction when 'CREDIT' then amount else -amount end else 0 end),0)::numeric as yield_amount
    from public.savings_transactions where participant_id=p_participant_id
  ),holds as(
    select
      coalesce(sum(case when component='CAPITAL' then amount else 0 end),0)::numeric as held_capital,
      coalesce(sum(case when component='YIELD' then amount else 0 end),0)::numeric as held_yield
    from public.savings_holds where participant_id=p_participant_id and status='ACTIVE'
  )
  select ledger.capital,ledger.yield_amount,ledger.capital+ledger.yield_amount,
    holds.held_capital,holds.held_yield,holds.held_capital+holds.held_yield,
    greatest(ledger.capital+ledger.yield_amount-holds.held_capital-holds.held_yield,0)::numeric
  from ledger cross join holds
$$;

create function public.generate_savings_schedule(p_enrollment_id uuid,p_from date,p_to date)
returns table(contribution_date date,expected_amount numeric,process_snapshot text,plan_id uuid)
language sql stable security definer set search_path=''
as $$
  with enrollment as(
    select e.* from public.savings_enrollments e where e.id=p_enrollment_id
      and e.first_expected_contribution_date is not null
  ),months as(
    select generate_series(date_trunc('month',p_from::timestamp),date_trunc('month',p_to::timestamp),interval '1 month')::date month_start
    where p_from is not null and p_to is not null and p_to>=p_from
  ),candidates as(
    select e.id enrollment_id,e.first_expected_contribution_date,
      case when p.process_snapshot='JUB' then (m.month_start+4)::date else (m.month_start+14)::date end contribution_date,
      p.amount,p.process_snapshot,p.id plan_id,p.effective_from,p.effective_to
    from enrollment e cross join months m join public.savings_contribution_plans p on p.enrollment_id=e.id
    union all
    select e.id,e.first_expected_contribution_date,
      least((m.month_start+interval '1 month - 1 day')::date,(m.month_start+29)::date),
      p.amount,p.process_snapshot,p.id,p.effective_from,p.effective_to
    from enrollment e cross join months m join public.savings_contribution_plans p on p.enrollment_id=e.id
    where p.process_snapshot in ('PROCESS_1','PROCESS_3')
  )
  select c.contribution_date,c.amount,c.process_snapshot,c.plan_id from candidates c
  where c.contribution_date between p_from and p_to
    and c.contribution_date>=c.first_expected_contribution_date
    and c.contribution_date>=c.effective_from
    and (c.effective_to is null or c.contribution_date<=c.effective_to)
  order by c.contribution_date,c.plan_id
$$;

create function public.savings_effective_action(p_action_code text,p_participant_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce((
    select a.enabled from public.savings_action_availability a
    where a.action_code=p_action_code
      and ((a.scope_type='PARTICIPANT' and a.participant_id=p_participant_id) or a.scope_type='GLOBAL')
      and a.effective_from<=now() and (a.effective_to is null or a.effective_to>now())
    order by case when a.scope_type='PARTICIPANT' then 0 else 1 end,a.effective_from desc,a.created_at desc limit 1
  ),false)
$$;

create function public.get_self_savings_dashboard()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_affiliate uuid:=public.get_effective_affiliate_id();
  v_participant public.savings_participants%rowtype;
  v_enrollment public.savings_enrollments%rowtype;
  v_plan public.savings_contribution_plans%rowtype;
  v_balance record;
  v_actions jsonb;
  v_certified boolean:=false;
begin
  if auth.uid() is null or v_affiliate is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501'; end if;
  select * into v_participant from public.savings_participants where affiliate_id=v_affiliate;
  v_actions:=jsonb_build_object(
    'JOIN',public.savings_effective_action('JOIN',v_participant.id),
    'CHANGE_AMOUNT',public.savings_effective_action('CHANGE_AMOUNT',v_participant.id),
    'WITHDRAW',public.savings_effective_action('WITHDRAW',v_participant.id),
    'TERMINATE',public.savings_effective_action('TERMINATE',v_participant.id)
  );
  if v_participant.id is null then
    return jsonb_build_object('authority','SHADOW','cutover_status','NOT_CUTOVER','participant',null,'enrollment',null,
      'balances',null,'annual','[]'::jsonb,'history','[]'::jsonb,'upcoming','[]'::jsonb,'beneficiaries','[]'::jsonb,'requests','[]'::jsonb,'actions',v_actions);
  end if;
  v_certified:=v_participant.certification_status='CERTIFIED';
  select * into v_enrollment from public.savings_enrollments where participant_id=v_participant.id order by sequence_number desc limit 1;
  if v_enrollment.id is not null then
    select * into v_plan from public.savings_contribution_plans where enrollment_id=v_enrollment.id
      and effective_from<=current_date and (effective_to is null or effective_to>=current_date) order by effective_from desc limit 1;
  end if;
  v_actions:=jsonb_build_object(
    'JOIN',public.savings_effective_action('JOIN',v_participant.id) and (v_enrollment.id is null or v_enrollment.status in ('TERMINATED','REJECTED')),
    'CHANGE_AMOUNT',public.savings_effective_action('CHANGE_AMOUNT',v_participant.id) and v_enrollment.status='ACTIVE',
    'WITHDRAW',public.savings_effective_action('WITHDRAW',v_participant.id) and v_enrollment.status='ACTIVE',
    'TERMINATE',public.savings_effective_action('TERMINATE',v_participant.id) and v_enrollment.status='ACTIVE'
  );
  select * into v_balance from public.savings_participant_balance(v_participant.id);
  return jsonb_build_object(
    'authority','SHADOW','cutover_status','NOT_CUTOVER','certified',v_certified,
    'participant',jsonb_build_object('id',v_participant.id,'participant_type',v_participant.participant_type,'identity_status',v_participant.identity_status,
      'certification_status',v_participant.certification_status,'current_process',v_participant.current_process,'data_classification',v_participant.data_classification),
    'enrollment',case when v_enrollment.id is null then null else jsonb_build_object('id',v_enrollment.id,'sequence_number',v_enrollment.sequence_number,'status',v_enrollment.status,
      'enrollment_started_at',v_enrollment.enrollment_started_at,'requested_at',v_enrollment.requested_at,'approved_at',v_enrollment.approved_at,
      'first_expected_contribution_date',v_enrollment.first_expected_contribution_date,'first_actual_contribution_date',v_enrollment.first_actual_contribution_date,
      'process_snapshot',v_enrollment.process_snapshot,'continue_saving',v_enrollment.continue_saving,
      'current_contribution_amount',v_plan.amount,'frequency',case when v_plan.process_snapshot='JUB' then 'MONTHLY' when v_plan.process_snapshot in ('PROCESS_1','PROCESS_3') then 'TWICE_MONTHLY' else null end,
      'yield_eligibility','NOT_ENABLED') end,
    'balances',case when not v_certified then null else jsonb_build_object('capital',v_balance.capital,'yield',v_balance.yield_amount,'total',v_balance.total,
      'held_capital',v_balance.held_capital,'held_yield',v_balance.held_yield,'held',v_balance.held,'available',v_balance.available) end,
    'annual',case when not v_certified then '[]'::jsonb else coalesce((select jsonb_agg(row_to_json(a) order by a."year" desc) from(
      select extract(year from effective_date)::integer as "year",
        sum(case when component='CAPITAL' then case direction when 'CREDIT' then amount else -amount end else 0 end)::numeric capital,
        sum(case when component='YIELD' then case direction when 'CREDIT' then amount else -amount end else 0 end)::numeric yield,
        sum(case direction when 'CREDIT' then amount else -amount end)::numeric subtotal
      from public.savings_transactions where participant_id=v_participant.id group by extract(year from effective_date))a),'[]'::jsonb) end,
    'history',case when not v_certified then '[]'::jsonb else coalesce((select jsonb_agg(row_to_json(t) order by t.effective_date desc,t.created_at desc) from(
      select id,transaction_type,component,direction,amount,effective_date,contribution_date,expected_amount,actual_amount,difference_amount,data_classification,created_at
      from public.savings_transactions where participant_id=v_participant.id order by effective_date desc,created_at desc limit 250)t),'[]'::jsonb) end,
    'upcoming',case when v_enrollment.id is null or v_enrollment.status not in ('ACTIVE','TERMINATION_PENDING') then '[]'::jsonb else
      coalesce((select jsonb_agg(row_to_json(s) order by s.contribution_date) from(
        select contribution_date,expected_amount,process_snapshot from public.generate_savings_schedule(v_enrollment.id,current_date+1,(current_date+interval '12 months')::date) limit 40)s),'[]'::jsonb) end,
    'beneficiaries',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'full_name',b.full_name,'relationship',b.relationship,'percentage',b.percentage) order by b.id)
      from public.savings_beneficiary_versions v join public.savings_beneficiaries b on b.version_id=v.id where v.participant_id=v_participant.id and v.status='ACTIVE'),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(row_to_json(r) order by r.submitted_at desc) from(
      select id,folio,request_type,withdrawal_kind,component,requested_amount,new_contribution_amount,continue_saving,status,effective_from,reason,submitted_at,reviewed_at,settled_at
      from public.savings_requests where participant_id=v_participant.id order by submitted_at desc limit 50)r),'[]'::jsonb),
    'actions',v_actions
  );
end $$;

create function public.admin_save_savings_yield_period(
  p_period_year integer,p_semester integer,p_starts_on date,p_ends_on date,p_rate numeric,p_eligibility_policy jsonb,p_exclusion_policy jsonb,p_status text
)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_period record;begin
  if auth.uid() is null or not public.has_admin_permission('savings.config') then raise exception 'SAVINGS_CONFIG_DENIED' using errcode='42501'; end if;
  if upper(p_status) not in ('DRAFT','APPROVED','DISABLED') then raise exception 'SAVINGS_YIELD_STATUS_INVALID' using errcode='22023'; end if;
  insert into public.savings_yield_periods(period_year,semester,starts_on,ends_on,rate,eligibility_policy,exclusion_policy,status,productive_enabled,approved_by_auth_user_id,approved_at)
  values(p_period_year,p_semester,p_starts_on,p_ends_on,p_rate,coalesce(p_eligibility_policy,'{}'::jsonb),coalesce(p_exclusion_policy,'{}'::jsonb),upper(p_status),false,
    case when upper(p_status)='APPROVED' then auth.uid() else null end,case when upper(p_status)='APPROVED' then now() else null end)
  on conflict(period_year,semester) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,rate=excluded.rate,
    eligibility_policy=excluded.eligibility_policy,exclusion_policy=excluded.exclusion_policy,status=excluded.status,productive_enabled=false,
    approved_by_auth_user_id=excluded.approved_by_auth_user_id,approved_at=excluded.approved_at
  returning * into v_period;
  insert into public.savings_audit_events(actor_real_auth_user_id,resource,action,target_id,after_data,reason)
  values(auth.uid(),'savings_yield_periods','UPSERT',v_period.id::text,to_jsonb(v_period),'Rendimiento semestral permanece deshabilitado productivamente');
  return to_jsonb(v_period);
end $$;

create function public.admin_credit_savings_yield_period(p_yield_period_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
  if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
  raise exception 'SAVINGS_YIELD_PRODUCTIVE_DISABLED' using errcode='55000',hint='A later owner-authorized cutover must replace this fail-closed function.';
end $$;

create function public.admin_resolve_savings_identity(p_participant_id uuid,p_affiliate_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_participant record;v_affiliate record;begin
  if auth.uid() is null or not public.has_admin_permission('savings.identity_review') then raise exception 'SAVINGS_IDENTITY_REVIEW_DENIED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'SAVINGS_IDENTITY_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_participant from public.savings_participants where id=p_participant_id for update;
  if not found or v_participant.identity_status not in ('AMBIGUOUS','ORPHAN') then raise exception 'SAVINGS_IDENTITY_NOT_PENDING' using errcode='P0001'; end if;
  select id,numero_control,coalesce(display_name,full_name) display_name into v_affiliate from public.affiliates where id=p_affiliate_id and not is_archived;
  if not found then raise exception 'SAVINGS_AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
  if coalesce(v_affiliate.numero_control,'')<>coalesce(v_participant.legacy_folio,'') then raise exception 'SAVINGS_FOLIO_LINK_MISMATCH' using errcode='22023'; end if;
  update public.savings_participants set affiliate_id=p_affiliate_id,participant_type='AFFILIATE',identity_status='RESOLVED',display_name=v_affiliate.display_name,
    certification_status='PENDING_REVIEW',data_classification='PENDING_REVIEW' where id=p_participant_id returning * into v_participant;
  insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason)
  values(auth.uid(),p_affiliate_id,p_participant_id,'savings_participants','LINK_AFFILIATE_ONLY',p_participant_id::text,to_jsonb(v_participant),btrim(p_reason));
  return to_jsonb(v_participant);
end $$;

create function public.get_admin_savings_dashboard(p_participant_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_participants jsonb;begin
  if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.display_name,x.legacy_folio),'[]'::jsonb) into v_participants from(
    select p.id,p.affiliate_id,p.legacy_folio,p.display_name,p.participant_type,p.identity_status,p.certification_status,p.current_process,p.process_source,p.data_classification,
      p.legacy_reported_balance,b.capital,b.yield_amount as yield,b.total,b.held,b.available,
      case when p.legacy_reported_balance is null then 'PENDING_REVIEW' when p.legacy_reported_balance=b.total then 'MATCH' else 'MISMATCH' end legacy_balance_status,
      e.id enrollment_id,e.status enrollment_status,e.sequence_number,e.enrollment_started_at,e.first_expected_contribution_date,e.first_actual_contribution_date,coalesce(pl.process_snapshot,e.process_snapshot) process_snapshot,
      pl.amount current_contribution_amount,case when coalesce(pl.process_snapshot,e.process_snapshot)='JUB' then 'MONTHLY' when coalesce(pl.process_snapshot,e.process_snapshot) in ('PROCESS_1','PROCESS_3') then 'TWICE_MONTHLY' else null end frequency
    from public.savings_participants p cross join lateral public.savings_participant_balance(p.id)b
    left join lateral(select * from public.savings_enrollments where participant_id=p.id order by sequence_number desc limit 1)e on true
    left join lateral(select * from public.savings_contribution_plans where enrollment_id=e.id and effective_from<=current_date and (effective_to is null or effective_to>=current_date) order by effective_from desc limit 1)pl on true
    where p_participant_id is null or p.id=p_participant_id
  )x;
  return jsonb_build_object(
    'authority','SHADOW','cutover_status','NOT_CUTOVER','yield_productive_enabled',false,
    'kpis',jsonb_build_object(
      'participants',(select count(*) from public.savings_participants),
      'active_enrollments',(select count(*) from public.savings_enrollments where status='ACTIVE'),
      'pending_requests',(select count(*) from public.savings_requests where status in ('SUBMITTED','UNDER_REVIEW')),
      'capital_total',(select coalesce(sum(case when direction='CREDIT' then amount else -amount end),0) from public.savings_transactions where component='CAPITAL'),
      'yield_total',(select coalesce(sum(case when direction='CREDIT' then amount else -amount end),0) from public.savings_transactions where component='YIELD'),
      'balance_total',(select coalesce(sum(case when direction='CREDIT' then amount else -amount end),0) from public.savings_transactions),
      'held_total',(select coalesce(sum(amount),0) from public.savings_holds where status='ACTIVE'),
      'pending_withdrawals',(select count(*) from public.savings_requests where request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') and status in ('SUBMITTED','UNDER_REVIEW','APPROVED')),
      'pending_amount_changes',(select count(*) from public.savings_requests where request_type='CHANGE_AMOUNT' and status in ('SUBMITTED','UNDER_REVIEW')),
      'pending_identity',(select count(*) from public.savings_participants where identity_status in ('AMBIGUOUS','ORPHAN')),
      'ambiguous_identity',(select count(*) from public.savings_participants where identity_status='AMBIGUOUS'),
      'orphan_identity',(select count(*) from public.savings_participants where identity_status='ORPHAN'),
      'process_reviews',(select count(*) from public.savings_process_change_events where status='SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED'),
      'ledger_total',(select coalesce(sum(case direction when 'CREDIT' then amount else -amount end),0) from public.savings_transactions)
    ),
    'participants',v_participants,
    'contributions',coalesce((select jsonb_agg(row_to_json(o) order by o.created_at desc) from public.savings_contribution_overrides o where p_participant_id is null or exists(select 1 from public.savings_enrollments e where e.id=o.enrollment_id and e.participant_id=p_participant_id)),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(row_to_json(t) order by t.effective_date desc,t.created_at desc) from(select * from public.savings_transactions where p_participant_id is null or participant_id=p_participant_id order by effective_date desc,created_at desc limit 500)t),'[]'::jsonb),
    'calendar',case when p_participant_id is null then '[]'::jsonb else coalesce((select jsonb_agg(row_to_json(s) order by s.contribution_date) from public.savings_enrollments e
      cross join lateral public.generate_savings_schedule(e.id,greatest(current_date,e.first_expected_contribution_date),(current_date+interval '18 months')::date)s
      where e.participant_id=p_participant_id and e.status in ('ACTIVE','TERMINATION_PENDING')),'[]'::jsonb) end,
    'amount_changes',coalesce((select jsonb_agg(row_to_json(r) order by r.submitted_at desc) from public.savings_requests r where r.request_type='CHANGE_AMOUNT' and (p_participant_id is null or r.participant_id=p_participant_id)),'[]'::jsonb),
    'withdrawals',coalesce((select jsonb_agg(row_to_json(r) order by r.submitted_at desc) from public.savings_requests r where r.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') and (p_participant_id is null or r.participant_id=p_participant_id)),'[]'::jsonb),
    'terminations',coalesce((select jsonb_agg(row_to_json(r) order by r.submitted_at desc) from public.savings_requests r where r.request_type='TERMINATE' and (p_participant_id is null or r.participant_id=p_participant_id)),'[]'::jsonb),
    'beneficiaries',coalesce((select jsonb_agg(jsonb_build_object('version',row_to_json(v),'items',(select coalesce(jsonb_agg(row_to_json(b) order by b.id),'[]'::jsonb) from public.savings_beneficiaries b where b.version_id=v.id)) order by v.created_at desc)
      from public.savings_beneficiary_versions v where p_participant_id is null or v.participant_id=p_participant_id),'[]'::jsonb),
    'yield_periods',coalesce((select jsonb_agg(row_to_json(y) order by y.period_year desc,y.semester desc) from public.savings_yield_periods y),'[]'::jsonb),
    'omissions',coalesce((select jsonb_agg(row_to_json(o) order by o.contribution_date desc) from(
      select distinct on(enrollment_id,contribution_date) id,enrollment_id,contribution_date,expected_amount,actual_amount,expected_amount-actual_amount difference,
        case when actual_amount=0 and expected_amount>0 then 'MISSING' when actual_amount>0 and actual_amount<expected_amount then 'PARTIAL' else 'MATCH' end status,reason,editor_auth_user_id,created_at
      from public.savings_contribution_overrides where actual_amount<expected_amount order by enrollment_id,contribution_date,version_number desc)o
      where p_participant_id is null or exists(select 1 from public.savings_enrollments e where e.id=o.enrollment_id and e.participant_id=p_participant_id)),'[]'::jsonb),
    'holds',coalesce((select jsonb_agg(row_to_json(h) order by h.created_at desc) from public.savings_holds h where p_participant_id is null or h.participant_id=p_participant_id),'[]'::jsonb),
    'process_changes',coalesce((select jsonb_agg(row_to_json(c) order by c.created_at desc) from public.savings_process_change_events c where p_participant_id is null or c.participant_id=p_participant_id),'[]'::jsonb),
    'pending_identity',coalesce((select jsonb_agg(row_to_json(q) order by q.legacy_folio) from(
      select p.id,p.legacy_folio,p.participant_type,p.identity_status,p.certification_status,p.data_classification,
        (select count(*)::integer from public.affiliates a where a.numero_control=p.legacy_folio) possible_matches_count,
        (p.legacy_reported_balance is not null
          or exists(select 1 from public.savings_enrollments e where e.participant_id=p.id)
          or exists(select 1 from public.savings_transactions t where t.participant_id=p.id)
          or exists(select 1 from public.savings_requests r where r.participant_id=p.id)
          or exists(select 1 from public.savings_legacy_evidence le where le.participant_id=p.id)) financial_record_exists
      from public.savings_participants p
      where p.identity_status in ('AMBIGUOUS','ORPHAN') and (p_participant_id is null or p.id=p_participant_id)
    )q),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(jsonb_build_object('request_id',r.id,'folio',r.folio,'participant_id',r.participant_id,'document_id',r.supporting_document_id,'status',r.status) order by r.submitted_at desc)
      from public.savings_requests r where r.supporting_document_id is not null and (p_participant_id is null or r.participant_id=p_participant_id)),'[]'::jsonb),
    'reports',coalesce((select jsonb_agg(row_to_json(b) order by b.started_at desc) from public.savings_import_batches b),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(row_to_json(a) order by a.created_at desc) from(select * from public.savings_audit_events where p_participant_id is null or participant_id=p_participant_id order by created_at desc limit 500)a),'[]'::jsonb),
    'configuration',coalesce((select jsonb_agg(row_to_json(a) order by a.action_code,a.scope_type,a.effective_from desc) from public.savings_action_availability a),'[]'::jsonb),
    'owner_decisions',jsonb_build_array('FIRST_EXPECTED_CONTRIBUTION_RULE','JUB_FOUR_CONSECUTIVE_MISSES')
  );
end $$;

create function public.import_savings_shadow_manifest(p_manifest jsonb,p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_hash text:=upper(coalesce(p_manifest->>'source_snapshot_sha256',''));v_cert_hash text:=upper(coalesce(p_manifest#>>'{certification,evidence_sha256}',''));
  v_certified boolean:=upper(coalesce(p_manifest#>>'{certification,status}',''))='CERTIFIED';v_batch uuid;v_row jsonb;v_participant uuid;v_enrollment uuid;
  v_counts jsonb:=jsonb_build_object('participants',jsonb_array_length(coalesce(p_manifest->'participants','[]'::jsonb)),
    'enrollments',jsonb_array_length(coalesce(p_manifest->'enrollments','[]'::jsonb)),'plans',jsonb_array_length(coalesce(p_manifest->'plans','[]'::jsonb)),
    'transactions',jsonb_array_length(coalesce(p_manifest->'transactions','[]'::jsonb)),'requests',jsonb_array_length(coalesce(p_manifest->'requests','[]'::jsonb)),
    'evidence',jsonb_array_length(coalesce(p_manifest->'evidence','[]'::jsonb)));
begin
  if auth.role()<>'service_role' then raise exception 'SAVINGS_IMPORT_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_manifest)<>'object' or v_hash!~'^[A-F0-9]{64}$' then raise exception 'SAVINGS_IMPORT_MANIFEST_INVALID' using errcode='22023'; end if;
  if not v_certified or v_cert_hash<>v_hash then raise exception 'SAVINGS_CERTIFIED_SNAPSHOT_REQUIRED' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_manifest->'participants','[]'::jsonb))x
    where upper(x->>'identity_status') in ('AMBIGUOUS','ORPHAN') and nullif(x->>'affiliate_id','') is not null) then
    raise exception 'SAVINGS_UNRESOLVED_IDENTITY_MUST_BE_NULL' using errcode='22023';
  end if;
  if not p_apply then return jsonb_build_object('mode','DRY_RUN','authority','SHADOW','certified',true,'source_snapshot_sha256',v_hash,'counts',v_counts); end if;
  insert into public.savings_import_batches(source_workbook_id,source_workbook_name,source_snapshot_sha256,certification_status,status,row_counts,provenance,finished_at)
  values(coalesce(p_manifest->>'source_workbook_id','UNKNOWN'),coalesce(p_manifest->>'source_workbook_name','UNKNOWN'),v_hash,'CERTIFIED','APPLIED',v_counts,
    coalesce(p_manifest->'provenance','{}'::jsonb),now()) returning id into v_batch;
  for v_row in select value from jsonb_array_elements(coalesce(p_manifest->'participants','[]'::jsonb)) loop
    insert into public.savings_participants(participant_type,affiliate_id,legacy_folio,display_name,identity_status,certification_status,current_process,process_source,data_classification,legacy_reported_balance,legacy_balance_status,import_batch_id)
    values(upper(v_row->>'participant_type'),nullif(v_row->>'affiliate_id','')::uuid,nullif(v_row->>'legacy_folio',''),nullif(v_row->>'display_name',''),upper(v_row->>'identity_status'),'CERTIFIED',
      nullif(upper(coalesce(v_row->>'current_process','')),''),upper(coalesce(v_row->>'process_source','LEGACY')),'LEGACY',nullif(v_row->>'legacy_reported_balance','')::numeric,'PENDING_REVIEW',v_batch);
  end loop;
  for v_row in select value from jsonb_array_elements(coalesce(p_manifest->'enrollments','[]'::jsonb)) loop
    select id into strict v_participant from public.savings_participants where import_batch_id=v_batch and legacy_folio=v_row->>'legacy_folio';
    insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,requested_at,approved_at,first_expected_contribution_date,first_actual_contribution_date,terminated_at,continue_saving,process_snapshot,data_classification,import_batch_id)
    values(v_participant,(v_row->>'sequence_number')::integer,upper(v_row->>'status'),(v_row->>'enrollment_started_at')::timestamptz,nullif(v_row->>'requested_at','')::timestamptz,
      nullif(v_row->>'approved_at','')::timestamptz,nullif(v_row->>'first_expected_contribution_date','')::date,nullif(v_row->>'first_actual_contribution_date','')::date,
      nullif(v_row->>'terminated_at','')::timestamptz,coalesce((v_row->>'continue_saving')::boolean,true),nullif(upper(coalesce(v_row->>'process_snapshot','')),''),'LEGACY',v_batch);
  end loop;
  for v_row in select value from jsonb_array_elements(coalesce(p_manifest->'plans','[]'::jsonb)) loop
    select e.id into strict v_enrollment from public.savings_enrollments e join public.savings_participants p on p.id=e.participant_id
      where p.import_batch_id=v_batch and p.legacy_folio=v_row->>'legacy_folio' and e.sequence_number=(v_row->>'enrollment_sequence')::integer;
    insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,effective_to,data_classification,import_batch_id)
    values(v_enrollment,(v_row->>'amount')::numeric,upper(v_row->>'process_snapshot'),(v_row->>'effective_from')::date,nullif(v_row->>'effective_to','')::date,'LEGACY',v_batch);
  end loop;
  for v_row in select value from jsonb_array_elements(coalesce(p_manifest->'evidence','[]'::jsonb)) loop
    select id into v_participant from public.savings_participants where import_batch_id=v_batch and legacy_folio=v_row->>'legacy_folio';
    insert into public.savings_legacy_evidence(import_batch_id,participant_id,source_workbook_id,source_sheet,source_column,source_row,legacy_folio,observed_on,numeric_value,record_type,data_classification,source_row_sha256,raw_payload)
    values(v_batch,v_participant,coalesce(v_row->>'source_workbook_id',p_manifest->>'source_workbook_id'),v_row->>'source_sheet',v_row->>'source_column',(v_row->>'source_row')::integer,
      nullif(v_row->>'legacy_folio',''),nullif(v_row->>'observed_on','')::date,nullif(v_row->>'numeric_value','')::numeric,upper(v_row->>'record_type'),upper(v_row->>'data_classification'),
      upper(v_row->>'source_row_sha256'),coalesce(v_row->'raw_payload','{}'::jsonb));
  end loop;
  for v_row in select value from jsonb_array_elements(coalesce(p_manifest->'transactions','[]'::jsonb)) loop
    select id into strict v_participant from public.savings_participants where import_batch_id=v_batch and legacy_folio=v_row->>'legacy_folio';
    v_enrollment:=null;
    if nullif(v_row->>'enrollment_sequence','') is not null then select e.id into strict v_enrollment from public.savings_enrollments e where e.participant_id=v_participant and e.sequence_number=(v_row->>'enrollment_sequence')::integer; end if;
    insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,expected_amount,actual_amount,difference_amount,idempotency_key,data_classification,import_batch_id)
    values(v_participant,v_enrollment,upper(v_row->>'transaction_type'),upper(v_row->>'component'),upper(v_row->>'direction'),(v_row->>'amount')::numeric,(v_row->>'effective_date')::date,
      nullif(v_row->>'contribution_date','')::date,nullif(v_row->>'expected_amount','')::numeric,nullif(v_row->>'actual_amount','')::numeric,nullif(v_row->>'difference_amount','')::numeric,
      'LEGACY:'||v_hash||':'||coalesce(v_row->>'source_key',extensions.gen_random_uuid()::text),'LEGACY',v_batch);
  end loop;
  for v_row in select value from jsonb_array_elements(coalesce(p_manifest->'requests','[]'::jsonb)) loop
    select id into strict v_participant from public.savings_participants where import_batch_id=v_batch and legacy_folio=v_row->>'legacy_folio';
    insert into public.savings_requests(folio,participant_id,request_type,withdrawal_kind,component,requested_amount,new_contribution_amount,continue_saving,status,effective_from,reason,idempotency_key,submitted_at,reviewed_at,settled_at,data_classification,metadata)
    values(coalesce(v_row->>'folio','LEGACY-'||upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12))),v_participant,upper(v_row->>'request_type'),nullif(upper(coalesce(v_row->>'withdrawal_kind','')),''),
      nullif(upper(coalesce(v_row->>'component','')),''),nullif(v_row->>'requested_amount','')::numeric,nullif(v_row->>'new_contribution_amount','')::numeric,nullif(v_row->>'continue_saving','')::boolean,
      upper(coalesce(v_row->>'status','SETTLED')),nullif(v_row->>'effective_from','')::date,coalesce(v_row->>'reason','Legacy certificado'),extensions.gen_random_uuid(),
      (v_row->>'submitted_at')::timestamptz,nullif(v_row->>'reviewed_at','')::timestamptz,nullif(v_row->>'settled_at','')::timestamptz,'LEGACY',coalesce(v_row->'metadata','{}'::jsonb));
  end loop;
  insert into public.savings_audit_events(resource,action,target_id,after_data,reason)
  values('savings_import_batches','IMPORT_CERTIFIED_SHADOW',v_batch::text,jsonb_build_object('hash',v_hash,'counts',v_counts),'No cutover; Google remains productive authority');
  return jsonb_build_object('mode','APPLY','authority','SHADOW','batch_id',v_batch,'source_snapshot_sha256',v_hash,'counts',v_counts);
exception when unique_violation then raise exception 'SAVINGS_IMPORT_ALREADY_APPLIED_OR_DUPLICATE' using errcode='23505';
end $$;

do $savings_rls$
declare v_table text;
begin
  foreach v_table in array array[
    'savings_import_batches','savings_participants','savings_enrollments','savings_contribution_plans','savings_contribution_overrides',
    'savings_transactions','savings_action_availability','savings_beneficiary_versions','savings_beneficiaries','savings_requests',
    'savings_request_approvals','savings_holds','savings_yield_periods','savings_yield_allocations','savings_process_change_events',
    'savings_legacy_evidence','savings_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('alter table public.%I force row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated',v_table);
  end loop;
end $savings_rls$;

create policy savings_participants_self_or_admin on public.savings_participants for select to authenticated
using(affiliate_id=public.get_effective_affiliate_id() or public.has_admin_permission('savings.read'));
create policy savings_enrollments_self_or_admin on public.savings_enrollments for select to authenticated
using(public.has_admin_permission('savings.read') or exists(select 1 from public.savings_participants p where p.id=participant_id and p.affiliate_id=public.get_effective_affiliate_id()));
create policy savings_plans_self_or_admin on public.savings_contribution_plans for select to authenticated
using(public.has_admin_permission('savings.read') or exists(select 1 from public.savings_enrollments e join public.savings_participants p on p.id=e.participant_id where e.id=enrollment_id and p.affiliate_id=public.get_effective_affiliate_id()));
create policy savings_transactions_self_or_admin on public.savings_transactions for select to authenticated
using(public.has_admin_permission('savings.read') or exists(select 1 from public.savings_participants p where p.id=participant_id and p.affiliate_id=public.get_effective_affiliate_id()));
create policy savings_requests_self_or_admin on public.savings_requests for select to authenticated
using(public.has_admin_permission('savings.read') or (actor_real_auth_user_id=auth.uid() and usuario_contexto_affiliate_id=public.get_effective_affiliate_id()));
create policy savings_beneficiary_versions_self_or_admin on public.savings_beneficiary_versions for select to authenticated
using(public.has_admin_permission('savings.read') or exists(select 1 from public.savings_participants p where p.id=participant_id and p.affiliate_id=public.get_effective_affiliate_id()));
create policy savings_beneficiaries_self_or_admin on public.savings_beneficiaries for select to authenticated
using(public.has_admin_permission('savings.read') or exists(select 1 from public.savings_beneficiary_versions v join public.savings_participants p on p.id=v.participant_id where v.id=version_id and p.affiliate_id=public.get_effective_affiliate_id()));
create policy savings_holds_self_or_admin on public.savings_holds for select to authenticated
using(public.has_admin_permission('savings.read') or exists(select 1 from public.savings_participants p where p.id=participant_id and p.affiliate_id=public.get_effective_affiliate_id()));

create policy savings_import_batches_admin on public.savings_import_batches for select to authenticated using(public.has_admin_permission('savings.reports'));
create policy savings_overrides_admin on public.savings_contribution_overrides for select to authenticated using(public.has_admin_permission('savings.read'));
create policy savings_actions_admin on public.savings_action_availability for select to authenticated using(public.has_admin_permission('savings.read'));
create policy savings_approvals_admin on public.savings_request_approvals for select to authenticated using(public.has_admin_permission('savings.read'));
create policy savings_yield_periods_admin on public.savings_yield_periods for select to authenticated using(public.has_admin_permission('savings.read'));
create policy savings_yield_allocations_admin on public.savings_yield_allocations for select to authenticated using(public.has_admin_permission('savings.read'));
create policy savings_process_changes_admin on public.savings_process_change_events for select to authenticated using(public.has_admin_permission('savings.read'));
create policy savings_legacy_evidence_admin on public.savings_legacy_evidence for select to authenticated using(public.has_admin_permission('savings.reports'));
create policy savings_audit_admin on public.savings_audit_events for select to authenticated using(public.has_admin_permission('savings.read'));

revoke all on function public.savings_participant_balance(uuid),public.generate_savings_schedule(uuid,date,date),public.savings_effective_action(text,uuid),
  public.get_self_savings_dashboard(),public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid),
  public.replace_self_savings_beneficiaries(jsonb,uuid),public.admin_set_savings_action(text,boolean,text,uuid,text,timestamptz,timestamptz),
  public.admin_override_savings_contribution(uuid,date,numeric,text,uuid),public.materialize_savings_contributions(date),
  public.admin_record_savings_process_change(uuid,text,text),public.admin_review_savings_process_change(uuid,text,date,text),
  public.admin_review_savings_request(uuid,text,text,date,date,text),public.admin_record_savings_request_approval(uuid,text,text,text),
  public.admin_settle_savings_request(uuid,numeric,numeric,text,uuid),public.admin_create_savings_hold(uuid,uuid,text,numeric,text),
  public.admin_release_savings_hold(uuid,text),public.admin_save_savings_yield_period(integer,integer,date,date,numeric,jsonb,jsonb,text),
  public.admin_credit_savings_yield_period(uuid),public.admin_resolve_savings_identity(uuid,uuid,text),public.get_admin_savings_dashboard(uuid),
  public.import_savings_shadow_manifest(jsonb,boolean) from public,anon,authenticated;

grant execute on function public.get_self_savings_dashboard(),
  public.submit_self_savings_request(text,numeric,text,text,numeric,boolean,date,text,uuid,uuid),
  public.replace_self_savings_beneficiaries(jsonb,uuid) to authenticated;

grant execute on function public.admin_set_savings_action(text,boolean,text,uuid,text,timestamptz,timestamptz),
  public.admin_override_savings_contribution(uuid,date,numeric,text,uuid),
  public.admin_record_savings_process_change(uuid,text,text),public.admin_review_savings_process_change(uuid,text,date,text),
  public.admin_review_savings_request(uuid,text,text,date,date,text),public.admin_record_savings_request_approval(uuid,text,text,text),
  public.admin_settle_savings_request(uuid,numeric,numeric,text,uuid),public.admin_create_savings_hold(uuid,uuid,text,numeric,text),
  public.admin_release_savings_hold(uuid,text),public.admin_save_savings_yield_period(integer,integer,date,date,numeric,jsonb,jsonb,text),
  public.admin_credit_savings_yield_period(uuid),public.admin_resolve_savings_identity(uuid,uuid,text),public.get_admin_savings_dashboard(uuid) to authenticated;

grant execute on function public.materialize_savings_contributions(date),public.import_savings_shadow_manifest(jsonb,boolean) to service_role;

comment on function public.get_self_savings_dashboard() is 'Fail-closed, user-scoped savings projection. Returns no uncertified financial balance and never falls back to Google or local data.';
comment on function public.import_savings_shadow_manifest(jsonb,boolean) is 'Idempotent certified-snapshot importer. service_role only; dry-run by default in the companion CLI.';

commit;
