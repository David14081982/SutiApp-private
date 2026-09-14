begin;
-- One canonical receipt writer for imported, new and renewed Savings accounts.
create table public.savings_account_receipts_backup(signature text primary key,definition text not null);
alter table public.savings_account_receipts_backup enable row level security;
alter table public.savings_account_receipts_backup force row level security;
revoke all on public.savings_account_receipts_backup from public,anon,authenticated,service_role;
insert into public.savings_account_receipts_backup
 select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
 and proname in ('admin_confirm_savings_receipt','admin_override_savings_contribution','get_admin_savings_financial_account');

create function public.admin_confirm_savings_account_receipt(p_participant_id uuid,p_enrollment_id uuid,p_date date,p_actual numeric,p_version integer,p_observation text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare en public.savings_enrollments%rowtype; prior public.savings_contribution_overrides%rowtype; old public.savings_audit_events%rowtype;
 c public.savings_balance_certifications%rowtype; bal record; expected numeric; posted numeric; delta numeric; target uuid; result jsonb;
 command jsonb:=jsonb_build_object('participant_id',p_participant_id,'enrollment_id',p_enrollment_id,'date',p_date,'actual',p_actual,'version',p_version,'observation',p_observation);
begin
 if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 if p_participant_id is null or p_enrollment_id is null or p_client_action_id is null or p_date is null or p_date>public.savings_operation_today()
  or p_actual is null or p_actual<0 or p_actual>999999999999.99 or p_actual<>round(p_actual,2) or p_version is null or p_version<0 or length(coalesce(p_observation,''))>1000 then raise exception 'SAVINGS_RECEIPT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-account-receipt:'||p_client_action_id,0));
 select * into old from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
  if old.actor_real_auth_user_id<>auth.uid() or old.resource<>'savings_account_receipts' or old.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return old.after_data->'result';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 target:=public.savings_runtime_assert_identity(p_participant_id);
 if not exists(select 1 from public.savings_participants where id=p_participant_id and certification_status='CERTIFIED' and data_classification='CANONICAL') then raise exception 'SAVINGS_OPENING_CONFIRMATION_REQUIRED';end if;
 select * into en from public.savings_enrollments where id=p_enrollment_id and participant_id=p_participant_id and data_classification='CANONICAL' for update;
 if not found then raise exception 'SAVINGS_ENROLLMENT_NOT_FOUND';end if;
 select * into c from public.savings_balance_certifications where participant_id=p_participant_id;
 if c.id is not null and p_date<=c.cutoff_on then raise exception 'SAVINGS_CERTIFIED_PERIOD_PROTECTED';end if;
 -- A received date has an economic date independent of its later audit timestamp.
 -- Posted or final excluded yield decisions must remain immutable.
 if exists(select 1 from public.savings_yield_allocations a join public.savings_withdrawal_openings o on o.yield_period_id=a.yield_period_id
  where a.participant_id=p_participant_id and a.status in ('CREDITED','EXCLUDED') and o.opening_kind in ('ORDINARY','EARLY') and p_date<=o.cutoff_on)
  then raise exception 'SAVINGS_YIELD_PERIOD_PROTECTED';end if;
 select s.expected_amount into expected from public.generate_savings_schedule(en.id,p_date,p_date)s;
 if expected is null then raise exception 'SAVINGS_DATE_NOT_EXPECTED';end if;
 select * into prior from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date=p_date order by version_number desc limit 1;
 if coalesce(prior.version_number,0)<>p_version then raise exception 'SAVINGS_PREVIEW_STALE';end if;
 select coalesce(sum(case direction when 'CREDIT' then amount else -amount end),0) into posted
 from public.savings_transactions where enrollment_id=en.id and contribution_date=p_date and component='CAPITAL' and data_classification='CANONICAL';
 if posted<>coalesce(prior.actual_amount,0) or exists(select 1 from public.savings_transactions where enrollment_id=en.id and contribution_date=p_date and data_classification<>'CANONICAL') then raise exception 'SAVINGS_RECEIPT_HISTORY_MISMATCH';end if;
 delta:=p_actual-coalesce(prior.actual_amount,0);
 if prior.id is not null and delta=0 then raise exception 'SAVINGS_NO_CHANGE';end if;
 select * into bal from public.savings_participant_balance(p_participant_id);
 if bal.capital+delta<bal.held_capital then raise exception 'SAVINGS_RECEIPT_EXCEEDS_AVAILABLE_CAPITAL';end if;
 insert into public.savings_contribution_overrides(enrollment_id,contribution_date,expected_amount,actual_amount,version_number,reason,editor_auth_user_id,client_action_id)
 values(en.id,p_date,expected,p_actual,p_version+1,coalesce(nullif(btrim(p_observation),''),'Descuento confirmado'),auth.uid(),p_client_action_id);
 if delta<>0 then
  insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,contribution_date,expected_amount,actual_amount,difference_amount,idempotency_key,data_classification,created_by_auth_user_id)
  values(p_participant_id,en.id,case when prior.id is null then 'CONTRIBUTION' else 'ADJUSTMENT' end,'CAPITAL',case when delta>0 then 'CREDIT' else 'DEBIT' end,abs(delta),p_date,p_date,expected,p_actual,p_actual-expected,'ACCOUNT_RECEIPT:'||p_client_action_id,'CANONICAL',auth.uid());
 end if;
 update public.savings_enrollments set first_actual_contribution_date=case when c.enrollment_id=en.id then public.savings_panel_date(c.command->>'first_date') else
  (select min(o.contribution_date) from (select distinct on (contribution_date) contribution_date,actual_amount from public.savings_contribution_overrides where enrollment_id=en.id order by contribution_date,version_number desc)o where o.actual_amount>0) end where id=en.id;
 result:=jsonb_build_object('participant_id',p_participant_id,'enrollment_id',en.id,'date',p_date,'expected',expected,'actual',p_actual,'difference',p_actual-expected,'version',p_version+1);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,reason,client_action_id)
 values(auth.uid(),target,p_participant_id,'savings_account_receipts','CONFIRM_RECEIPT',en.id||':'||p_date,coalesce(to_jsonb(prior),'{}'),jsonb_build_object('command',command,'result',result),coalesce(p_observation,''),p_client_action_id);
 return result;
end $$;

create or replace function public.admin_confirm_savings_receipt(p_record_id uuid,p_date date,p_actual numeric,p_version integer,p_observation text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.savings_balance_certifications%rowtype; en uuid; n integer;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 select * into c from public.savings_balance_certifications where record_id=p_record_id;
 if not found or p_date<=c.cutoff_on then raise exception 'SAVINGS_CERTIFIED_PERIOD_PROTECTED';end if;
 perform public.savings_runtime_assert_identity(c.participant_id);
 select count(*),(array_agg(e.id))[1] into n,en from public.savings_enrollments e
 where e.participant_id=c.participant_id and e.data_classification='CANONICAL'
  and exists(select 1 from public.generate_savings_schedule(e.id,p_date,p_date));
 if n<>1 then raise exception 'SAVINGS_DATE_ENROLLMENT_REQUIRED';end if;
 return public.admin_confirm_savings_account_receipt(c.participant_id,en,p_date,p_actual,p_version,p_observation,p_client_action_id);
end $$;

create or replace function public.admin_override_savings_contribution(p_enrollment_id uuid,p_contribution_date date,p_actual_amount numeric,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 if exists(select 1 from public.savings_enrollments e join public.savings_participants p on p.id=e.participant_id
  where e.id=p_enrollment_id and (e.data_classification='CANONICAL' or p.data_classification='CANONICAL')) then raise exception 'SAVINGS_USE_CONFIRMED_RECEIPT';end if;
 return public.savings_override_before_runtime(p_enrollment_id,p_contribution_date,p_actual_amount,p_reason,p_client_action_id);
end $$;

create function public.savings_enrollment_effective_status(p_status text,p_terminated_at timestamptz,p_as_of date) returns text
language sql stable set search_path='' as $$
 select case
  when p_status in ('ACTIVE','TERMINATION_PENDING','TERMINATED') and (p_terminated_at at time zone 'America/Hermosillo')::date<=p_as_of then 'TERMINATED'
  when p_status in ('TERMINATION_PENDING','TERMINATED') and (p_terminated_at at time zone 'America/Hermosillo')::date>p_as_of then 'ACTIVE'
  else p_status end;
$$;
revoke all on function public.savings_enrollment_effective_status(text,timestamptz,date) from public,anon,authenticated,service_role;

create function public.get_admin_savings_account(p_participant_id uuid,p_until date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.savings_participants%rowtype; c public.savings_balance_certifications%rowtype; en public.savings_enrollments%rowtype;
 plan public.savings_contribution_plans%rowtype; bal jsonb; schedule jsonb; history jsonb; identity jsonb; until_date date; start_date date; mode text; current_status text;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 select * into p from public.savings_participants where id=p_participant_id and data_classification='CANONICAL';
 if not found then raise exception 'SAVINGS_CANONICAL_ACCOUNT_REQUIRED';end if;
 select * into c from public.savings_balance_certifications where participant_id=p.id;
 select * into en from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL' order by sequence_number desc limit 1;
 current_status:=public.savings_enrollment_effective_status(en.status,en.terminated_at,public.savings_operation_today());
 until_date:=coalesce(p_until,public.savings_operation_today()+366);
 if until_date>public.savings_operation_today()+1098 or until_date<coalesce(c.cutoff_on,(p.created_at at time zone 'America/Hermosillo')::date) then raise exception 'SAVINGS_PROJECTION_RANGE_INVALID';end if;
 select coalesce(c.cutoff_on+1,min(first_expected_contribution_date),public.savings_operation_today()) into start_date from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL';
 select * into plan from public.savings_contribution_plans where enrollment_id=en.id and data_classification='CANONICAL'
  and (effective_to is null or effective_to>=public.savings_operation_today()) order by case when effective_from<=public.savings_operation_today() then 0 else 1 end,effective_from limit 1;
 select to_jsonb(b) into bal from public.savings_participant_balance(p.id)b;
 select coalesce(jsonb_agg(jsonb_build_object('enrollment_id',e.id,'date',s.contribution_date,'expected',s.expected_amount,
  'actual',o.actual_amount,'version',coalesce(o.version_number,0),'confirmed',o.id is not null,'future',s.contribution_date>public.savings_operation_today()) order by s.contribution_date,e.sequence_number),'[]') into schedule
 from public.savings_enrollments e cross join lateral public.generate_savings_schedule(e.id,greatest(start_date,e.first_expected_contribution_date),until_date)s
 left join lateral(select * from public.savings_contribution_overrides where enrollment_id=e.id and contribution_date=s.contribution_date order by version_number desc limit 1)o on true
 where e.participant_id=p.id and e.data_classification='CANONICAL' and e.first_expected_contribution_date<=until_date;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'at',a.created_at,'action',a.action,'observation',a.reason,'before',a.before_data,'after',a.after_data,'actor','Encargado autorizado') order by a.id desc),'[]') into history
 from public.savings_audit_events a where a.participant_id=p.id;
 identity:=public.savings_review_identity(p.legacy_folio);
 select s.mode into mode from public.savings_publication_state s where id;
 return jsonb_build_object('participant_id',p.id,'certified',true,'native',c.id is null,
  'context',jsonb_build_object('person',jsonb_build_object('folio',p.legacy_folio,'nombre',identity->>'name','aporte',plan.amount,'inicio',(select min(first_actual_contribution_date) from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL'),
   'plan_inicio',(en.enrollment_started_at at time zone 'America/Hermosillo')::date,'estado',case when en.id is null then 'Por iniciar' when current_status='ACTIVE' then 'Ahorrando' when current_status='TERMINATED' then 'Dejo de ahorrar' else 'En revision' end,
   'frecuencia',case when plan.process_snapshot='JUB' then 'MONTHLY' else 'TWICE_MONTHLY' end,'identity',identity),'cutoff_on',c.cutoff_on),
  'balance',bal,'latest_enrollment',to_jsonb(en)||jsonb_build_object('status',current_status,'recorded_status',en.status),'schedule',schedule,'history',history,'today',public.savings_operation_today(),'publication',mode,
  'enrollments',coalesce((select jsonb_agg(to_jsonb(e) order by sequence_number desc) from public.savings_enrollments e where participant_id=p.id and data_classification='CANONICAL'),'[]'),
  'can_confirm',false,'can_write',public.has_admin_permission('savings.write') and (identity->>'match_count')::int=1 and (identity->>'active_match_count')::int=1
   and exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)),
  'unconfirmed_dates',(select count(*) from jsonb_array_elements(schedule)x where x->>'future'='false' and x->>'confirmed'='false'),
  'projected_total',(bal->>'total')::numeric+coalesce((select sum((x->>'expected')::numeric) from jsonb_array_elements(schedule)x where x->>'future'='true'),0),
  'balance_version',md5(jsonb_build_array(p.id,bal,(select coalesce(max(id),0) from public.savings_audit_events where participant_id=p.id))::text));
end $$;

alter function public.get_admin_savings_financial_account(uuid,date) rename to savings_financial_before_accounts;
revoke all on function public.savings_financial_before_accounts(uuid,date) from public,anon,authenticated,service_role;
create function public.get_admin_savings_financial_account(p_record_id uuid,p_until date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; account jsonb;
begin
 base:=public.savings_financial_before_accounts(p_record_id,p_until);
 if base->>'certified'='true' then
  account:=public.get_admin_savings_account((base#>>'{certificate,participant_id}')::uuid,p_until);
  base:=base||jsonb_build_object('schedule',account->'schedule','balance',account->'balance','latest_enrollment',account->'latest_enrollment',
   'enrollments',account->'enrollments','projected_total',account->'projected_total','unconfirmed_dates',account->'unconfirmed_dates','history',account->'history','publication',account->'publication');
 end if;
 return base;
end $$;

create function public.get_admin_savings_native_accounts(p_search text default '',p_limit integer default 20,p_offset integer default 0,p_filter text default 'todos') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; v_total integer;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 or length(coalesce(p_search,''))>200
  or p_filter is null or p_filter not in ('todos','ahorrando','pausado','baja','revision','pendientes','resueltas') then raise exception 'SAVINGS_PAGE_INVALID';end if;
 with base as (
  select p.*,d,en.id enrollment_id,en.status enrollment_status,(select min(first_actual_contribution_date) from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL') first_actual_contribution_date,
   (en.enrollment_started_at at time zone 'America/Hermosillo')::date plan_start,(en.terminated_at at time zone 'America/Hermosillo')::date ended_on,
   plan.amount,plan.process_snapshot,plan.id plan_id,b.total,b.capital,b.yield_amount,
   last_paid.contribution_date last_date,last_due.actual_amount last_actual,next_due.contribution_date next_date,next_due.expected_amount next_amount,
   case when en.id is null or en.status in ('REQUESTED','REJECTED') then 'revision'
    when public.savings_enrollment_effective_status(en.status,en.terminated_at,public.savings_operation_today())='TERMINATED' then 'baja' when plan.id is null then 'pausado'
    when public.savings_enrollment_effective_status(en.status,en.terminated_at,public.savings_operation_today()) in ('ACTIVE','TERMINATION_PENDING') then 'ahorrando' else 'revision' end state
  from public.savings_participants p cross join lateral public.savings_participant_balance(p.id)b
  cross join lateral(select public.savings_review_identity(p.legacy_folio)d)i
  left join lateral(select * from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL' order by sequence_number desc limit 1)en on true
  left join lateral(select * from public.savings_contribution_plans where enrollment_id=en.id and data_classification='CANONICAL'
   and (effective_to is null or effective_to>=public.savings_operation_today())
   order by case when effective_from<=public.savings_operation_today() then 0 else 1 end,effective_from limit 1)plan on true
  left join lateral(select max(o.contribution_date) contribution_date from (
   select distinct on (o.enrollment_id,o.contribution_date) o.contribution_date,o.actual_amount from public.savings_contribution_overrides o
   join public.savings_enrollments e on e.id=o.enrollment_id where e.participant_id=p.id and e.data_classification='CANONICAL' and o.contribution_date<=public.savings_operation_today()
   order by o.enrollment_id,o.contribution_date,o.version_number desc)o where o.actual_amount>0)last_paid on true
  left join lateral(select o.actual_amount from public.generate_savings_schedule(en.id,public.savings_operation_today()-70,public.savings_operation_today())s
   left join lateral(select actual_amount from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date=s.contribution_date order by version_number desc limit 1)o on true
   order by s.contribution_date desc limit 1)last_due on true
  left join lateral(select * from public.generate_savings_schedule(en.id,public.savings_operation_today()+1,public.savings_operation_today()+70) order by contribution_date limit 1)next_due on true
  where p.data_classification='CANONICAL' and not exists(select 1 from public.savings_review_records r where r.source_sheet='Ahorro' and r.source_folio=p.legacy_folio)
   and (p_search is null or p_search='' or p.legacy_folio ilike '%'||p_search||'%' or d->>'name' ilike '%'||p_search||'%')
 ), filtered as (
  select * from base where p_filter='todos' or state=p_filter
   or p_filter='pausado' and state='ahorrando' and last_actual=0
   or p_filter='pendientes' and (state='revision' or (d->>'match_count')::int<>1 or (d->>'active_match_count')::int<>1)
   or p_filter='resueltas' and state<>'revision' and (d->>'match_count')::int=1 and (d->>'active_match_count')::int=1
 ), page as(select * from filtered order by d->>'name',legacy_folio,id limit p_limit offset p_offset)
 select (select count(*) from filtered),coalesce((select jsonb_agg(jsonb_build_object('id',id,'participant_id',id,'native',true,
  'folio',legacy_folio,'nombre',d->>'name','identity',d,'saldo',total,'capital',capital,'yield',yield_amount,'estado',state,
  'aporte',amount,'proceso',case process_snapshot when 'PROCESS_1' then '1' when 'PROCESS_3' then '3' else process_snapshot end,
  'ultimo',last_date,'inicio',first_actual_contribution_date,'plan_inicio',plan_start,'bajaAt',ended_on,'prox',next_date,'porRecibir',next_amount,
  'zero_recorded',coalesce(state='ahorrando' and last_actual=0,false)) order by d->>'name',legacy_folio,id) from page),'[]') into v_total,rows;
 return jsonb_build_object('items',rows,'total',v_total,'limit',p_limit,'offset',p_offset,'filter',p_filter);
end $$;

revoke all on function public.admin_confirm_savings_account_receipt(uuid,uuid,date,numeric,integer,text,uuid),public.admin_confirm_savings_receipt(uuid,date,numeric,integer,text,uuid),public.admin_override_savings_contribution(uuid,date,numeric,text,uuid),public.get_admin_savings_account(uuid,date),public.get_admin_savings_financial_account(uuid,date),public.get_admin_savings_native_accounts(text,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_confirm_savings_account_receipt(uuid,uuid,date,numeric,integer,text,uuid),public.admin_confirm_savings_receipt(uuid,date,numeric,integer,text,uuid),public.admin_override_savings_contribution(uuid,date,numeric,text,uuid),public.get_admin_savings_account(uuid,date),public.get_admin_savings_financial_account(uuid,date),public.get_admin_savings_native_accounts(text,integer,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
