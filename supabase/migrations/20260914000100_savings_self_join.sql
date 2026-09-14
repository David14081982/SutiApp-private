begin;
-- New registrations are independent from publishing reviewed historical balances.
create table public.savings_self_join_backup(signature text primary key,definition text not null);
alter table public.savings_self_join_backup enable row level security;
alter table public.savings_self_join_backup force row level security;
revoke all on public.savings_self_join_backup from public,anon,authenticated,service_role;
insert into public.savings_self_join_backup select oid::regprocedure::text,pg_get_functiondef(oid)
from pg_proc where oid='public.savings_runtime_submit(uuid,jsonb,uuid,boolean)'::regprocedure;
do $$ declare prior text; updated text; begin
 select definition into prior from public.savings_self_join_backup;
 updated:=replace(prior,'if not p_admin and not exists(select 1 from public.savings_publication_state where id and mode=''PUBLISHED'')',
 'if not p_admin and typ is distinct from ''JOIN'' and not exists(select 1 from public.savings_publication_state where id and mode=''PUBLISHED'')');
 if updated=prior then raise exception 'SAVINGS_JOIN_GATE_CONTRACT_CHANGED';end if;
 execute updated;
end $$;

create function public.get_self_savings_join_context(p_amount numeric default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare af public.affiliates%rowtype; p public.savings_participants%rowtype; e public.savings_enrollments%rowtype;
 r public.savings_requests%rowtype; proc text; first_date date; amount_value numeric; reason text; schedule jsonb:='[]';
 today date:=public.savings_operation_today(); result jsonb; current_request jsonb;
begin
 if auth.uid() is null then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 select * into af from public.affiliates where id=public.get_effective_affiliate_id() and not coalesce(is_archived,false);
 if af.id is null or af.numero_control is null or (select count(*) from public.affiliates where numero_control=af.numero_control)<>1 then
  return jsonb_build_object('can_join',false,'reason','IDENTITY_REVIEW','upcoming','[]'::jsonb,'context',jsonb_build_object('actor_auth_user_id',auth.uid(),'effective_affiliate_id',af.id));
 end if;
 select * into p from public.savings_participants where affiliate_id=af.id or legacy_folio=af.numero_control;
 if p.id is not null and (p.affiliate_id is distinct from af.id or p.legacy_folio is distinct from af.numero_control or p.identity_status<>'RESOLVED') then
  return jsonb_build_object('can_join',false,'reason','IDENTITY_REVIEW','upcoming','[]'::jsonb,'context',jsonb_build_object('actor_auth_user_id',auth.uid(),'effective_affiliate_id',af.id));
 end if;
 proc:=case af.financial_employee_category_code when 'JUBILADOS_PENSIONADOS' then 'JUB' when 'SUPLENTES_VARIABLES' then 'PROCESS_3'
 when 'SUPLENTES_FIJOS' then 'PROCESS_1' when 'EVENTUALES' then 'PROCESS_1' when 'BASE' then 'PROCESS_1' when 'CONFIANZA' then 'PROCESS_1' end;
 select * into e from public.savings_enrollments where participant_id=p.id order by sequence_number desc limit 1;
 select * into r from public.savings_requests where participant_id=p.id and request_type='JOIN' and data_classification='CANONICAL' order by submitted_at desc,id desc limit 1;
 if p.id is not null and (p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL')
 or p.id is null and exists(select 1 from public.savings_review_records where source_sheet='Ahorro' and source_folio=af.numero_control) then reason:='OPENING_REVIEW';
 elsif e.id is not null and ((e.status in ('REQUESTED','ACTIVE','TERMINATION_PENDING') and (e.terminated_at is null or (e.terminated_at at time zone 'America/Hermosillo')::date>today)) or (e.terminated_at at time zone 'America/Hermosillo')::date>today) then reason:='ALREADY_SAVING';
 elsif r.status in ('SUBMITTED','UNDER_REVIEW') then reason:='REQUEST_PENDING';
 elsif proc is null then reason:='CATEGORY_REQUIRED';
 elsif not public.savings_effective_action('JOIN',p.id) then reason:='INTAKE_CLOSED';end if;
 if p_amount is not null and (p_amount<200 or p_amount>999999999999.99 or p_amount<>round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity')) then raise exception 'SAVINGS_MINIMUM_200';end if;
 if proc is not null then first_date:=public.savings_next_contribution_date(today+30,proc);end if;
 amount_value:=p_amount;
 if p_amount is null and r.id is not null then
  current_request:=jsonb_build_object('id',r.id,'folio',r.folio,'status',r.status,'submitted_at',r.submitted_at,'effective_from',r.effective_from,'amount',r.new_contribution_amount);
  if r.status in ('SUBMITTED','UNDER_REVIEW','APPROVED') then
   first_date:=r.effective_from;amount_value:=r.new_contribution_amount;proc:=r.metadata->>'process';
   if r.status='APPROVED' and r.enrollment_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('contribution_date',s.contribution_date,'expected_amount',s.expected_amount) order by s.contribution_date),'[]') into schedule
    from public.generate_savings_schedule(r.enrollment_id,greatest(today,first_date),(greatest(today,first_date)+interval '1 year'-interval '1 day')::date) s;
   end if;
  end if;
 end if;
 if schedule='[]'::jsonb and first_date is not null and amount_value is not null and proc in ('JUB','PROCESS_1','PROCESS_3')
 and (reason is null or p_amount is null and r.status in ('SUBMITTED','UNDER_REVIEW')) then
  select coalesce(jsonb_agg(jsonb_build_object('contribution_date',d::date,'expected_amount',amount_value) order by d),'[]') into schedule
  from generate_series(first_date::timestamp,(first_date+interval '1 year'-interval '1 day')::timestamp,interval '1 day') d
  where public.savings_next_contribution_date(d::date,proc)=d::date;
 end if;
 return jsonb_build_object('can_join',reason is null,'reason',reason,'registration_date',today,'first_discount_on',first_date,
  'frequency',case when proc='JUB' then 'MONTHLY' when proc in ('PROCESS_1','PROCESS_3') then 'TWICE_MONTHLY' end,
  'context',jsonb_build_object('actor_auth_user_id',auth.uid(),'effective_affiliate_id',af.id),'amount',amount_value,'request',current_request,'upcoming',schedule,'projection_only',true);
end $$;
revoke all on function public.get_self_savings_join_context(numeric) from public,anon,authenticated,service_role;
grant execute on function public.get_self_savings_join_context(numeric) to authenticated;

create function public.submit_self_savings_join(p_amount numeric,p_expected_affiliate_id uuid,p_observation text,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_expected_affiliate_id is null or p_expected_affiliate_id is distinct from public.get_effective_affiliate_id() then raise exception 'SAVINGS_CONTEXT_CHANGED' using errcode='42501';end if;
 return public.savings_runtime_submit(p_expected_affiliate_id,jsonb_build_object('type','JOIN','new_amount',p_amount,'observation',coalesce(p_observation,'')),p_idempotency_key,false);
end $$;
revoke all on function public.submit_self_savings_join(numeric,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.submit_self_savings_join(numeric,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
