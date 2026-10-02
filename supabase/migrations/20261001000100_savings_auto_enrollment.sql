begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- OWNER: valid new self-service JOINs register automatically. Existing requests,
-- receipts, money, yield rules and enrollment tenure are not rewritten.
create table public.savings_auto_enrollment_backup(
 signature text primary key, definition text not null, installed_hash text
);
alter table public.savings_auto_enrollment_backup enable row level security;
alter table public.savings_auto_enrollment_backup force row level security;
revoke all on public.savings_auto_enrollment_backup from public,anon,authenticated,service_role;
insert into public.savings_auto_enrollment_backup(signature,definition)
select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc
where oid in (
 'public.savings_runtime_submit(uuid,jsonb,uuid,boolean)'::regprocedure,
 'public.admin_save_savings_operation(jsonb,uuid)'::regprocedure,
 'public.get_self_savings_join_context(numeric)'::regprocedure,
 'public.get_admin_savings_runtime_requests(text)'::regprocedure
);

-- One private activation writer, reused by automatic enrollment and the existing
-- administrative review. It receives an already validated, locked request.
create function public.savings_activate_join(p_request_id uuid,p_process text,p_effective date)
returns public.savings_enrollments language plpgsql security definer set search_path='' as $$
declare r public.savings_requests%rowtype; enrollment public.savings_enrollments%rowtype;
begin
 if auth.uid() is null then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 select * into r from public.savings_requests where id=p_request_id for update;
 if r.id is null or r.request_type<>'JOIN' or r.status not in ('SUBMITTED','UNDER_REVIEW')
 or r.data_classification<>'CANONICAL' or r.metadata->>'origin' is distinct from 'SAVINGS_RUNTIME_V1'
 then raise exception 'SAVINGS_OPERATIONAL_REQUEST_REQUIRED';end if;
 if p_effective is null or p_effective<=public.savings_operation_today()
 or public.savings_next_contribution_date(p_effective,p_process)<>p_effective
 then raise exception 'SAVINGS_AUTHORIZED_DATE_INVALID';end if;
 if exists(select 1 from public.savings_enrollments where participant_id=r.participant_id
  and (status in ('REQUESTED','ACTIVE','TERMINATION_PENDING') or terminated_at>clock_timestamp()))
 then raise exception 'SAVINGS_ENROLLMENT_ALREADY_OPEN';end if;
 insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,
  requested_at,approved_at,first_expected_contribution_date,process_snapshot,data_classification)
 values(r.participant_id,(select coalesce(max(sequence_number),0)+1 from public.savings_enrollments where participant_id=r.participant_id),
  'ACTIVE',p_effective::timestamp at time zone 'America/Hermosillo',r.submitted_at,clock_timestamp(),p_effective,p_process,'CANONICAL')
 returning * into enrollment;
 update public.savings_participants set current_process=p_process where id=r.participant_id;
 insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,source_request_id,data_classification,created_by_auth_user_id)
 values(enrollment.id,r.new_contribution_amount,p_process,p_effective,r.id,'CANONICAL',auth.uid());
 return enrollment;
end $$;
revoke all on function public.savings_activate_join(uuid,text,date) from public,anon,authenticated,service_role;

do $patch$
declare original text; changed text; needle text; replacement text; signature text;
begin
 signature:='public.admin_save_savings_operation(jsonb,uuid)';
 original:=replace(pg_get_functiondef(signature::regprocedure),chr(13),'');changed:=original;
 needle:=$old$     insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,requested_at,approved_at,first_expected_contribution_date,process_snapshot,data_classification)
     values(r.participant_id,(select coalesce(max(sequence_number),0)+1 from public.savings_enrollments where participant_id=r.participant_id),'ACTIVE',effective::timestamp at time zone 'America/Hermosillo',r.submitted_at,clock_timestamp(),effective,proc,'CANONICAL') returning * into en;
     update public.savings_participants set current_process=proc where id=r.participant_id;$old$;
 if position(needle in changed)=0 then raise exception 'SAVINGS_AUTO_JOIN_REVIEW_CONTRACT_CHANGED';end if;
 changed:=replace(changed,needle,'     select * into en from public.savings_activate_join(r.id,proc,effective);');
 needle:=$old$    insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,effective_to,source_request_id,data_classification,created_by_auth_user_id)
     values(en.id,r.new_contribution_amount,proc,effective,case when r.request_type='CHANGE_AMOUNT' then plan.effective_to end,r.id,'CANONICAL',auth.uid());$old$;
 if position(needle in changed)=0 then raise exception 'SAVINGS_AUTO_JOIN_PLAN_CONTRACT_CHANGED';end if;
 changed:=replace(changed,needle,'    if r.request_type=''CHANGE_AMOUNT'' then'||chr(10)||needle||chr(10)||'    end if;');
 execute changed;

 signature:='public.savings_runtime_submit(uuid,jsonb,uuid,boolean)';
 original:=replace(pg_get_functiondef(signature::regprocedure),chr(13),'');changed:=original;
 needle:=$old$ command jsonb:=jsonb_build_object('affiliate_id',p_affiliate_id,'command',p_command,'admin',p_admin);$old$;
 if position(needle in changed)=0 or position('typ is distinct from ''JOIN''' in changed)=0
 then raise exception 'SAVINGS_AUTO_JOIN_SUBMIT_CONTRACT_CHANGED';end if;
 changed:=replace(changed,needle,needle||chr(10)||' automatic_before jsonb; registration_result jsonb;');
 needle:=$old$ insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason,client_action_id)
 values(actor,af.id,p.id,'savings_runtime','SUBMIT',r.id::text,jsonb_build_object('command',command,'result',to_jsonb(r)),note,p_key);
 return to_jsonb(r);$old$;
 replacement:=$new$ if typ='JOIN' and not p_admin then
  automatic_before:=to_jsonb(r);
  select * into en from public.savings_activate_join(r.id,proc,next_date);
  update public.savings_requests set status='APPROVED',enrollment_id=en.id,reviewed_at=clock_timestamp(),reviewed_by_auth_user_id=actor,
   metadata=metadata||jsonb_build_object('registration_mode','SELF_SERVICE_AUTOMATIC','calculated_date',next_date,'authorized_date',next_date)
   where id=r.id returning * into r;
 end if;
 registration_result:=to_jsonb(r)||case when automatic_before is not null then jsonb_build_object('automatic_join',true) else '{}'::jsonb end;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason,client_action_id)
 values(actor,af.id,p.id,'savings_runtime','SUBMIT',r.id::text,jsonb_build_object('command',command,'result',registration_result),note,p_key);
 if automatic_before is not null then
  -- APPROVE preserves the existing documentary final-event consumer. The actor
  -- remains the real principal; metadata records the automatic policy decision.
  insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason)
  values(actor,af.id,p.id,'savings_runtime','APPROVE',r.id::text,automatic_before,
   jsonb_build_object('registration_mode','SELF_SERVICE_AUTOMATIC','result',registration_result),'Ingreso automático tras validar los requisitos vigentes');
 end if;
 return registration_result;$new$;
 if position(needle in changed)=0 then raise exception 'SAVINGS_AUTO_JOIN_AUDIT_CONTRACT_CHANGED';end if;
 changed:=replace(changed,needle,replacement);execute changed;

 signature:='public.get_self_savings_join_context(numeric)';
 original:=replace(pg_get_functiondef(signature::regprocedure),chr(13),'');
 needle:='return jsonb_build_object(''can_join'',';
 if (length(original)-length(replace(original,needle,'')))/length(needle)<>3
 then raise exception 'SAVINGS_AUTO_JOIN_CONTEXT_CONTRACT_CHANGED';end if;
 changed:=replace(original,needle,'return jsonb_build_object(''auto_join_enabled'',true,''can_join'',');execute changed;

 signature:='public.get_admin_savings_runtime_requests(text)';
 original:=replace(pg_get_functiondef(signature::regprocedure),chr(13),'');
 needle:='return jsonb_build_object(''requests'',';
 if position(needle in original)=0 then raise exception 'SAVINGS_AUTO_JOIN_READER_CONTRACT_CHANGED';end if;
 changed:=replace(original,needle,'return jsonb_build_object(''auto_join_enabled'',true,''requests'',');execute changed;
 update public.savings_auto_enrollment_backup b set installed_hash=md5(pg_get_functiondef(b.signature::regprocedure));
end $patch$;
notify pgrst,'reload schema';
commit;
