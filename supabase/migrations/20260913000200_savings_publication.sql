begin;
-- Prepared only. Installing this migration NEVER publishes any Savings account.
create table public.savings_publication_state(
 id boolean primary key default true check(id),
 mode text not null default 'PRIVATE' check(mode in ('PRIVATE','PUBLISHED')),
 version integer not null default 1 check(version>0),
 fingerprint text, published_at timestamptz,
 actor_real_auth_user_id uuid references auth.users(id),
 check((mode='PRIVATE' and published_at is null) or (mode='PUBLISHED' and published_at is not null and actor_real_auth_user_id is not null))
);
insert into public.savings_publication_state(id) values(true);
create table public.savings_publication_events(
 id uuid primary key default extensions.gen_random_uuid(),
 actor_real_auth_user_id uuid not null references auth.users(id),
 usuario_contexto_affiliate_id uuid references public.affiliates(id),
 created_at timestamptz not null default clock_timestamp(),
 command jsonb not null, result jsonb not null,
 client_action_id uuid not null unique
);
create trigger savings_publication_events_immutable before update or delete on public.savings_publication_events
 for each row execute function public.reject_savings_history_mutation();
create table public.savings_publication_function_backup(signature text primary key,definition text not null,original_acl aclitem[],original_owner text not null);
insert into public.savings_publication_function_backup
 select oid::regprocedure::text,pg_get_functiondef(oid),proacl,proowner::regrole::text from pg_proc where pronamespace='public'::regnamespace
 and proname in ('get_self_savings_live_readonly','get_self_savings_if_changed','get_self_savings_dashboard','replace_self_savings_beneficiaries');
alter table public.savings_publication_state enable row level security;
alter table public.savings_publication_state force row level security;
alter table public.savings_publication_events enable row level security;
alter table public.savings_publication_events force row level security;
alter table public.savings_publication_function_backup enable row level security;
alter table public.savings_publication_function_backup force row level security;
revoke all on public.savings_publication_state,public.savings_publication_events,public.savings_publication_function_backup from public,anon,authenticated,service_role;

-- Internal projection. UUID is accepted only here; this function has no client grant.
create function public.savings_canonical_user_projection(p_participant_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.savings_participants%rowtype; e public.savings_enrollments%rowtype;
 c public.savings_balance_certifications%rowtype; r public.savings_review_records%rowtype;
 plan public.savings_contribution_plans%rowtype; d jsonb; accepted jsonb; related jsonb:='[]'; transition jsonb; bal jsonb; hist jsonb; annual jsonb;
 withdrawals jsonb; upcoming jsonb; actions jsonb; requests jsonb; changes jsonb;
 today date:=public.savings_operation_today(); published boolean; effective_status text;
begin
 select * into p from public.savings_participants where id=p_participant_id;
 if not found or p.identity_status<>'RESOLVED' or p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL'
  or not exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))
  or (select count(*) from public.affiliates where numero_control=p.legacy_folio)<>1 then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';
 end if;
 select * into c from public.savings_balance_certifications where participant_id=p.id;
 if c.id is not null then
  select * into r from public.savings_review_records where id=c.record_id;
  select a.after_data->'source_snapshot' into accepted from public.savings_audit_events a where a.participant_id=p.id and a.action='ADJUST_CONFIRMED_BALANCE' order by a.id desc limit 1;
  accepted:=coalesce(accepted,c.source_snapshot);related:=coalesce(accepted->'related','[]');
  d:=(accepted->'source')||(accepted->'proposal');
  if d->>'A' is distinct from p.legacy_folio then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED';end if;
 elsif p.import_batch_id is not null then raise exception 'SAVINGS_CERTIFICATION_REQUIRED';
 end if;
 if exists(select 1 from public.savings_transactions where participant_id=p.id and (data_classification<>'CANONICAL' or effective_date>today)) then
  raise exception 'SAVINGS_NONCANONICAL_MOVEMENTS' using errcode='55000';
 end if;
 select * into e from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL'
  order by sequence_number desc limit 1;
 -- A future authorized cessation stops deductions only on its effective date.
 -- Keep stored history intact and derive today's state for every user action.
 effective_status:=case when (e.terminated_at at time zone 'America/Hermosillo')::date<=today then 'TERMINATED'
  when e.status='TERMINATED' and (e.terminated_at at time zone 'America/Hermosillo')::date>today then 'ACTIVE' else e.status end;
 select * into plan from public.savings_contribution_plans where enrollment_id=e.id and data_classification='CANONICAL'
  and effective_from<=today and (effective_to is null or effective_to>=today) order by effective_from desc limit 1;
 -- Before the first debit the accepted initial plan is still the person's plan.
 if plan.id is null and effective_status='ACTIVE' then
  select * into plan from public.savings_contribution_plans where enrollment_id=e.id and data_classification='CANONICAL'
   and effective_from>today order by effective_from limit 1;
 end if;
 select to_jsonb(b)||jsonb_build_object('yield',b.yield_amount,'canonical',true,'total_source','CERTIFIED_SAVINGS_TRANSACTIONS')
  into bal from public.savings_participant_balance(p.id)b;
 if (bal->>'capital')::numeric<0 or (bal->>'yield_amount')::numeric<0 then raise exception 'SAVINGS_NEGATIVE_COMPONENT';end if;

 -- Closed source summaries retain their exact period. September receipts never
 -- appear under the old June subtotal. Opening credits are excluded throughout.
 with corrections as (
  select sum(coalesce(public.savings_panel_number(d->(f->>'key')),0)-coalesce(public.savings_panel_number(accepted->'source'->(f->>'key')),0)) amount
  from jsonb_array_elements(coalesce(r.field_defs,'[]'))f
  where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and f->>'label' like '%Descuento registrado%'
   and left(f->>'label',10)::date between '2026-01-30'::date and '2026-06-30'::date
 ), historical as (
  select 2025 as period_year,2 semester,'2025'::text as year,'2025'::text label,'Subtotal hasta 2025'::text subtotal_label,
   public.savings_panel_number(d->'DP') capital,public.savings_panel_number(d->'DQ') yield_amount,true closed
  union all select 2026,1,'2026','2026 - Enero a junio','Subtotal a junio 2026',
   public.savings_panel_number(d->'DS')+coalesce((select amount from corrections),0),public.savings_panel_number(d->'DT'),true
 ), subsequent_history as (
  select left(f->>'label',10)::date as day,public.savings_panel_number(d->(f->>'key')) amount
  from jsonb_array_elements(coalesce(r.field_defs,'[]'))f where f->>'label' ~ '^\d{4}-\d{2}-\d{2}'
   and f->>'label' like '%Descuento registrado%' and left(f->>'label',10)::date>'2026-06-30'::date
   and public.savings_panel_number(d->(f->>'key')) is not null
 ), new_money as (
  select extract(year from day)::int period_year,case when extract(month from day)<=6 then 1 else 2 end semester,sum(amount) capital
  from (
   select day,amount from subsequent_history
   union all
   select contribution_date,case direction when 'CREDIT' then amount else -amount end from public.savings_transactions
    where participant_id=p.id and data_classification='CANONICAL' and component='CAPITAL' and contribution_date is not null
     and effective_date<=today and (c.id is null or contribution_date>c.cutoff_on)
  ) q group by 1,2
 ), yields as (
  select yp.period_year,yp.semester,a.approved_amount amount,yp.productive_enabled and a.status in ('CREDITED','EXCLUDED') closed
  from public.savings_yield_allocations a join public.savings_yield_periods yp on yp.id=a.yield_period_id
  where a.participant_id=p.id and a.status in ('CREDITED','EXCLUDED')
   and (p.historical_yield_reconciled_through is null or yp.starts_on>p.historical_yield_reconciled_through)
 ), subsequent as (
  select coalesce(n.period_year,y.period_year) period_year,coalesce(n.semester,y.semester) semester,
   coalesce(n.capital,0) capital,y.amount yield_amount,coalesce(y.closed,false) closed
  from new_money n full join yields y using(period_year,semester)
 ), periods as (
  select * from historical where capital is not null or yield_amount is not null
  union all
  select period_year,semester,period_year::text||'-S'||semester,
   period_year::text||case semester when 1 then ' - Enero a junio' else ' - Julio a diciembre' end,
   'Subtotal registrado',capital,yield_amount,closed from subsequent
 ) select coalesce(jsonb_agg(jsonb_build_object('year',year,'label',label,'subtotal_label',subtotal_label,'closed',closed,
   'capital',capital,'yield',yield_amount,'period_state',case when closed then 'CLOSED' else 'RECORDED' end)
   order by period_year desc,semester desc),'[]') into annual from periods;

 with recorded as (
  select r.id::text||':'||(f->>'key') id,left(f->>'label',10)::date effective_date,
   public.savings_panel_number(d->(f->>'key')) amount,'HISTORICAL_RECORDED'::text source,
   case when f->>'key'='AR' then 'CONTRIBUTION_WITH_INCLUDED_YIELD' else 'CONTRIBUTION' end transaction_type
  from jsonb_array_elements(coalesce(r.field_defs,'[]'))f where f->>'label' ~ '^\d{4}-\d{2}-\d{2}'
   and f->>'label' like '%Descuento registrado%' and public.savings_panel_number(d->(f->>'key'))>0
  union all
  select o.id::text,o.contribution_date,o.actual_amount,'CONFIRMED_RECEIPT','CONTRIBUTION' from (
   select distinct on(enrollment_id,contribution_date) o.* from public.savings_contribution_overrides o
   join public.savings_enrollments en on en.id=o.enrollment_id where en.participant_id=p.id
   and (c.id is null or o.contribution_date>c.cutoff_on) and o.contribution_date<=today
   order by enrollment_id,contribution_date,version_number desc
  )o
 ) select coalesce(jsonb_agg(to_jsonb(v) order by effective_date desc,id),'[]') into hist from recorded v;
 with w as (
  select q.id::text id,public.savings_panel_date(v.d->>'D') effective_date,
   public.savings_panel_number(v.d->'G') amount,v.d->>'E' withdrawal_kind,
   v.d->>'F' continue_saving,v.d->>'H' status,'HISTORICAL_RECORDED'::text source
  from public.savings_review_records q join jsonb_array_elements(related) a on a->>'id'=q.id::text
  cross join lateral(select (a->'source')||(a->'proposal') d)v
  where q.source_sheet='Solicitud de retiro' and q.source_folio=p.legacy_folio and v.d->>'A'=p.legacy_folio
  union all
  select q.id::text,(q.settled_at at time zone 'America/Hermosillo')::date,q.requested_amount,q.withdrawal_kind,q.continue_saving::text,q.status,'CANONICAL'
  from public.savings_requests q where q.participant_id=p.id and q.data_classification='CANONICAL' and q.status='SETTLED'
   and q.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL','TERMINATE')
 ) select coalesce(jsonb_agg(to_jsonb(w) order by effective_date desc,id),'[]') into withdrawals from w;
 select coalesce(jsonb_agg(jsonb_build_object('contribution_date',s.contribution_date,'expected_amount',s.expected_amount,
  'process_snapshot',s.process_snapshot,'source','DATED_SAVINGS_PLAN') order by s.contribution_date),'[]') into upcoming
  from public.generate_savings_schedule(e.id,today+1,(today+interval '12 months')::date)s where effective_status in ('ACTIVE','TERMINATION_PENDING');
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'folio',q.folio,'request_type',q.request_type,'withdrawal_kind',q.withdrawal_kind,
  'requested_amount',q.requested_amount,'new_contribution_amount',q.new_contribution_amount,'continue_saving',q.continue_saving,
  'status',q.status,'effective_from',q.effective_from,'submitted_at',q.submitted_at,'settled_at',q.settled_at) order by q.submitted_at desc),'[]') into requests
  from public.savings_requests q where q.participant_id=p.id and q.data_classification='CANONICAL';
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'effective_date',public.savings_panel_date(v.d->>'B'),
  'old_amount',public.savings_panel_number(v.d->'C'),'new_amount',public.savings_panel_number(v.d->'D'),
  'applied',v.d->>'E','source','HISTORICAL_RECORDED') order by q.source_row desc),'[]') into changes
  from public.savings_review_records q join jsonb_array_elements(related) a on a->>'id'=q.id::text
  cross join lateral(select (a->'source')||(a->'proposal') d)v
  where q.source_sheet='Solicitud Cambio ahorro' and q.source_folio=p.legacy_folio and v.d->>'A'=p.legacy_folio;
 select jsonb_build_object('event_id',ev.id,'previous_amount',ev.conversion_snapshot->'previous_amount','new_amount',ev.conversion_snapshot->'new_amount',
  'effective_from',ev.effective_from,'first_discount_on',ev.conversion_snapshot->'first_discount_on',
  'status',case when ev.effective_from>today then 'SCHEDULED' else 'ACTIVE' end) into transition
 from public.savings_process_change_events ev where ev.participant_id=p.id and ev.status='APPLIED'
  and ev.conversion_snapshot->>'enrollment_id'=e.id::text and ev.conversion_snapshot->>'conversion_rule'='TWO_FORTNIGHTS_TO_ONE_MONTH'
  and (ev.effective_from>today or plan.id::text=ev.conversion_snapshot->>'new_plan_id') order by ev.effective_from desc,ev.reviewed_at desc limit 1;
 select mode='PUBLISHED' into published from public.savings_publication_state where id;
 actions:=jsonb_build_object('JOIN',(e.id is null or effective_status='TERMINATED') and public.savings_effective_action('JOIN',p.id),'CHANGE_AMOUNT',coalesce(effective_status='ACTIVE',false) and public.savings_effective_action('CHANGE_AMOUNT',p.id),
  'WITHDRAW',coalesce((bal->>'available')::numeric>0,false) and public.savings_effective_action('WITHDRAW',p.id),
  'TERMINATE',coalesce(effective_status='ACTIVE',false));
 return jsonb_build_object('schema_version','SAVINGS_CERTIFIED_SELF_V1','authority','SUPABASE','projection','CERTIFIED_OPERATION',
  'cutover_status',case when published then 'PUBLISHED' else 'PRIVATE_PREVIEW' end,'canonical_ledger_used',true,'yield_calculated',false,
  'participant',jsonb_build_object('id',p.id,'legacy_folio',p.legacy_folio,'identity_status',p.identity_status,'participant_type',p.participant_type,'current_process',p.current_process),
  'enrollment',case when e.id is null then null else jsonb_build_object('id',e.id,'status',case effective_status when 'ACTIVE' then 'Ahorrando' when 'TERMINATED' then 'Dejó de ahorrar' else 'En revisión' end,
   'enrollment_started_at',e.first_actual_contribution_date,'plan_started_at',(e.enrollment_started_at at time zone 'America/Hermosillo')::date,
   'current_contribution_amount',plan.amount,'frequency',case when plan.process_snapshot='JUB' then 'MONTHLY' when plan.process_snapshot in ('PROCESS_1','PROCESS_3') then 'TWICE_MONTHLY' end) end,
  'balances',bal,'annual',annual,'history',hist,'upcoming',upcoming,'withdrawals',withdrawals,'requests',requests,'plan_changes',changes,'retirement_transition',transition,
  'beneficiaries',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'full_name',b.full_name,'relationship',b.relationship,'percentage',b.percentage) order by b.id)
   from public.savings_beneficiary_versions v join public.savings_beneficiaries b on b.version_id=v.id where v.participant_id=p.id and v.status='ACTIVE'),'[]'),
  'actions',actions,'write_capabilities',jsonb_build_object('requests',published,'beneficiaries',published and coalesce(effective_status in ('ACTIVE','TERMINATION_PENDING'),false)));
end $$;

create function public.get_admin_savings_publication_preview(p_record_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.savings_balance_certifications%rowtype;begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 select * into c from public.savings_balance_certifications where record_id=p_record_id;
 if not found then raise exception 'SAVINGS_CERTIFICATION_REQUIRED' using errcode='55000';end if;
 return public.savings_canonical_user_projection(c.participant_id)||jsonb_build_object('admin_preview',true);
end $$;

-- A new or renewed native account can be previewed without a Google review row.
-- The same canonical reader validates its exact Folio and certified authority.
create function public.get_admin_savings_publication_account_preview(p_participant_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 return public.savings_canonical_user_projection(p_participant_id)||jsonb_build_object('admin_preview',true);
end $$;

create function public.get_admin_savings_publication_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r record; c public.savings_balance_certifications%rowtype; p public.savings_participants%rowtype;
 ctx jsonb; account jsonb; accepted_snapshot jsonb; reasons jsonb; rows jsonb:='[]'; pending int:=0; total int:=0; mark jsonb:='{}';
 t text; digest text; state public.savings_publication_state%rowtype; batch_count int; native_total int:=0; missing_receipts bigint; native_balance record;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 select * into state from public.savings_publication_state where id;
 select count(distinct batch_id) into batch_count from public.savings_review_records where source_sheet='Ahorro';
 for r in select id,source_folio,version,status from public.savings_review_records where source_sheet='Ahorro' order by source_folio,id loop
  total:=total+1;reasons:='[]';
  select * into c from public.savings_balance_certifications where record_id=r.id;
  ctx:=public.savings_certification_context(r.id);
  if ctx#>>'{source_update,pending}'='true' then reasons:=reasons||jsonb_build_array('Actualizacion de la informacion original pendiente');end if;
  if c.id is null then reasons:=reasons||jsonb_build_array('Saldo sin confirmar');
  else
   select * into p from public.savings_participants where id=c.participant_id;
   select a.after_data->'source_snapshot' into accepted_snapshot from public.savings_audit_events a
    where a.participant_id=c.participant_id and a.action='ADJUST_CONFIRMED_BALANCE' order by a.id desc limit 1;
   accepted_snapshot:=coalesce(accepted_snapshot,c.source_snapshot);
   if ctx#>'{snapshot,related}' is distinct from accepted_snapshot->'related'
    or ctx#>'{snapshot,identity}' is distinct from accepted_snapshot->'identity' then reasons:=reasons||jsonb_build_array('Información corregida después de confirmar');end if;
   if p.identity_status<>'RESOLVED' or p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL'
    or p.legacy_folio is distinct from r.source_folio or not exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=r.source_folio and not coalesce(a.is_archived,false)) then
    reasons:=reasons||jsonb_build_array('Vínculo del ahorrador por revisar');end if;
   if jsonb_array_length(reasons)=0 and to_regprocedure('public.get_admin_savings_account(uuid,date)') is not null then
    account:=public.get_admin_savings_account(p.id,public.savings_operation_today());
   else account:=public.get_admin_savings_financial_account(r.id,public.savings_operation_today());end if;
   if coalesce((account->>'unconfirmed_dates')::int,0)>0 then reasons:=reasons||jsonb_build_array('Descuentos pasados sin confirmar');end if;
   if coalesce((account#>>'{balance,capital}')::numeric,-1)<0 or coalesce((account#>>'{balance,yield_amount}')::numeric,-1)<0 then reasons:=reasons||jsonb_build_array('Saldo por revisar');end if;
   if exists(select 1 from public.savings_transactions where participant_id=p.id and (data_classification<>'CANONICAL' or effective_date>public.savings_operation_today())) then
    reasons:=reasons||jsonb_build_array('Movimientos por revisar');end if;
  end if;
  if r.status<>'RESOLVED' then reasons:=reasons||jsonb_build_array('Expediente sin terminar de revisar');end if;
  if ctx#>>'{person,identity_pending}'='true' or (ctx#>>'{person,identity,match_count}')::int<>1 or (ctx#>>'{person,identity,active_match_count}')::int<>1
   or (select count(*) from public.savings_review_records where source_sheet='Ahorro' and source_folio=r.source_folio)<>1 then reasons:=reasons||jsonb_build_array('Folio sin coincidencia única');end if;
  if jsonb_array_length(reasons)>0 then pending:=pending+1;end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('record_id',r.id,'folio',r.source_folio,'ready',jsonb_array_length(reasons)=0,'reasons',reasons));
 end loop;
 -- Accounts opened directly in Supabase have no Google review row. They are
 -- included explicitly, with the same identity and actual-receipt requirements.
 for p in select v.* from public.savings_participants v where not exists(
  select 1 from public.savings_review_records q where q.source_sheet='Ahorro' and q.source_folio=v.legacy_folio
 ) order by v.legacy_folio,v.id loop
  native_total:=native_total+1;total:=total+1;reasons:='[]';
  if p.identity_status<>'RESOLVED' or p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL'
   or (select count(*) from public.affiliates where numero_control=p.legacy_folio)<>1
   or not exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)) then
   reasons:=reasons||jsonb_build_array('Folio sin coincidencia unica');end if;
  if p.import_batch_id is not null then reasons:=reasons||jsonb_build_array('Importacion anterior sin expediente de confirmacion');end if;
  if exists(select 1 from public.savings_transactions where participant_id=p.id and (data_classification<>'CANONICAL' or effective_date>public.savings_operation_today()))
   or exists(select 1 from public.savings_enrollments where participant_id=p.id and data_classification<>'CANONICAL') then reasons:=reasons||jsonb_build_array('Movimientos por revisar');end if;
  select * into native_balance from public.savings_participant_balance(p.id);
  if native_balance.capital<0 or native_balance.yield_amount<0 then reasons:=reasons||jsonb_build_array('Saldo por revisar');end if;
  if jsonb_array_length(reasons)=0 and to_regprocedure('public.get_admin_savings_account(uuid,date)') is not null then
   account:=public.get_admin_savings_account(p.id,public.savings_operation_today());missing_receipts:=coalesce((account->>'unconfirmed_dates')::bigint,0);
  else
   select count(*) into missing_receipts from public.savings_enrollments en
    cross join lateral public.generate_savings_schedule(en.id,en.first_expected_contribution_date,public.savings_operation_today()) x
    where en.participant_id=p.id and en.data_classification='CANONICAL' and not exists(select 1 from public.savings_contribution_overrides o where o.enrollment_id=en.id and o.contribution_date=x.contribution_date);
  end if;
  if missing_receipts>0 then reasons:=reasons||jsonb_build_array('Descuentos pasados sin confirmar');end if;
  if jsonb_array_length(reasons)>0 then pending:=pending+1;end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('record_id',null,'participant_id',p.id,'folio',p.legacy_folio,
   'origin',case when p.import_batch_id is null then 'NATIVE' else 'PREVIOUS_IMPORT' end,'ready',jsonb_array_length(reasons)=0,'reasons',reasons));
 end loop;
 -- Include real receipts and every dated plan/configuration input in the confirmation
 -- fingerprint. A changed date, manual correction or rate always invalidates preview.
 foreach t in array array['savings_review_records','savings_balance_certifications','savings_participants','savings_enrollments',
  'savings_contribution_plans','savings_contribution_overrides','savings_transactions','savings_holds','savings_requests',
  'savings_yield_periods','savings_yield_allocations','savings_process_change_events','savings_action_availability','savings_withdrawal_openings','savings_operation_settings','savings_beneficiary_versions','savings_beneficiaries','savings_audit_events'] loop
  execute format('select md5(coalesce(string_agg(md5(to_jsonb(v)::text),'''' order by id),'''')) from public.%I v',t) into digest;
  mark:=mark||jsonb_build_object(t,digest);
 end loop;
 foreach t in array array['savings_source_observations','savings_source_acceptances'] loop
  if to_regclass('public.'||t) is not null then
   execute format('select md5(coalesce(string_agg(md5(to_jsonb(v)::text),'''' order by id),'''')) from public.%I v',t) into digest;
   mark:=mark||jsonb_build_object(t,digest);
  end if;
 end loop;
 return jsonb_build_object('mode',state.mode,'version',state.version,'published_at',state.published_at,'total',total,'native_total',native_total,'pending',pending,'rows',rows,
  'ready',state.mode='PRIVATE' and total>0 and pending=0 and batch_count=1,'can_publish',public.has_admin_permission('savings.config') and public.has_admin_permission('savings.approve'),
  'fingerprint',md5(jsonb_build_array('SAVINGS_PUBLICATION_V1',state.version,public.savings_operation_today(),mark,rows)::text));
end $$;

create function public.admin_publish_savings(p_version integer,p_fingerprint text,p_confirmed boolean,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare state public.savings_publication_state%rowtype; old public.savings_publication_events%rowtype; preview jsonb; result jsonb;
 command jsonb:=jsonb_build_object('version',p_version,'fingerprint',p_fingerprint,'confirmed',p_confirmed); t text;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') or not public.has_admin_permission('savings.config') or not public.has_admin_permission('savings.approve') then
  raise exception 'SAVINGS_PUBLICATION_DENIED' using errcode='42501';end if;
 if p_client_action_id is null or p_version is null or p_fingerprint is null or p_confirmed is distinct from true then raise exception 'SAVINGS_PUBLICATION_CONFIRMATION_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-publish:'||p_client_action_id,0));
 select * into old from public.savings_publication_events where client_action_id=p_client_action_id;
 if found then
  if old.actor_real_auth_user_id<>auth.uid() or old.command is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return old.result;
 end if;
 select * into state from public.savings_publication_state where id for update;
 if state.mode<>'PRIVATE' then raise exception 'SAVINGS_ALREADY_PUBLISHED';end if;
 if state.version<>p_version then raise exception 'SAVINGS_PUBLICATION_PREVIEW_STALE';end if;
 -- One brief lock covers all changed rows and inserts, including new Folios. No
 -- user is switched until the entire confirmation has passed atomically.
 lock table public.affiliates,public.savings_review_batches,public.savings_review_records,public.savings_balance_certifications,
  public.savings_participants,public.savings_enrollments,public.savings_contribution_plans,public.savings_contribution_overrides,
  public.savings_transactions,public.savings_holds,public.savings_requests,public.savings_yield_periods,public.savings_yield_allocations,public.savings_process_change_events,public.savings_action_availability,
  public.savings_withdrawal_openings,public.savings_operation_settings,public.savings_beneficiary_versions,public.savings_beneficiaries,public.savings_audit_events in share mode;
 foreach t in array array['savings_source_observations','savings_source_acceptances'] loop
  if to_regclass('public.'||t) is not null then execute format('lock table public.%I in share mode',t);end if;
 end loop;
 preview:=public.get_admin_savings_publication_status();
 if preview->>'fingerprint' is distinct from p_fingerprint then raise exception 'SAVINGS_PUBLICATION_PREVIEW_STALE';end if;
 if preview->>'ready' is distinct from 'true' then raise exception 'SAVINGS_PUBLICATION_REVIEW_REQUIRED';end if;
 update public.savings_publication_state set mode='PUBLISHED',version=version+1,fingerprint=p_fingerprint,published_at=clock_timestamp(),actor_real_auth_user_id=auth.uid() where id returning * into state;
 result:=jsonb_build_object('mode',state.mode,'version',state.version,'published_at',state.published_at,'total',preview->'total');
 insert into public.savings_publication_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,command,result,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),command,result,p_client_action_id);
 return result;
end $$;

alter function public.get_self_savings_live_readonly() rename to savings_self_before_publication;
revoke all on function public.savings_self_before_publication() from public,anon,authenticated,service_role;
create function public.get_self_savings_live_readonly() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare af uuid:=public.get_effective_affiliate_id(); pid uuid; mode text; result jsonb; control text;
begin
 if auth.uid() is null or af is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';end if;
 select s.mode into mode from public.savings_publication_state s where id;
 if mode='PRIVATE' then return public.savings_self_before_publication();end if;
 if mode is distinct from 'PUBLISHED' then raise exception 'SAVINGS_PUBLICATION_STATE_REQUIRED';end if;
 select a.numero_control into control from public.affiliates a where a.id=af and not coalesce(a.is_archived,false);
 if nullif(btrim(control),'') is null or (select count(*) from public.affiliates where numero_control=control)<>1 then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';end if;
 if exists(select 1 from public.savings_participants p where (p.affiliate_id=af or p.legacy_folio=control)
  and (p.affiliate_id is distinct from af or p.legacy_folio is distinct from control)) then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';end if;
 select p.id into pid from public.savings_participants p join public.affiliates a on a.id=p.affiliate_id
  where a.id=af and p.legacy_folio=a.numero_control;
 if pid is null then
  if exists(select 1 from public.savings_review_records r join public.affiliates a on a.numero_control=r.source_folio where a.id=af and r.source_sheet='Ahorro') then
   raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED';end if;
  return jsonb_build_object('schema_version','SAVINGS_CERTIFIED_SELF_V1','authority','SUPABASE','projection','CERTIFIED_OPERATION','cutover_status','PUBLISHED',
   'participant',null,'enrollment',null,'balances',null,'annual','[]'::jsonb,'history','[]'::jsonb,'withdrawals','[]'::jsonb,'beneficiaries','[]'::jsonb,'upcoming','[]'::jsonb,'requests','[]'::jsonb,
   'actions',jsonb_build_object('JOIN',public.savings_effective_action('JOIN',null),'CHANGE_AMOUNT',false,'WITHDRAW',false,'TERMINATE',false),
   'write_capabilities',jsonb_build_object('requests',true,'beneficiaries',false));
 end if;
 return public.savings_canonical_user_projection(pid);
end $$;

-- The older self dashboard is also a public entry point. It must not expose a
-- private canonical opening, including accounts that have no Google certificate.
alter function public.get_self_savings_dashboard() rename to savings_dashboard_before_publication;
revoke all on function public.savings_dashboard_before_publication() from public,anon,authenticated,service_role;
create function public.get_self_savings_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare af uuid:=public.get_effective_affiliate_id(); mode text;
begin
 if auth.uid() is null or af is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';end if;
 select s.mode into mode from public.savings_publication_state s where id;
 if mode='PUBLISHED' then return public.get_self_savings_live_readonly();end if;
 if mode is distinct from 'PRIVATE' then raise exception 'SAVINGS_PUBLICATION_STATE_REQUIRED';end if;
 if exists(select 1 from public.savings_participants where affiliate_id=af and data_classification='CANONICAL') then
  raise exception 'SAVINGS_PRIVATE_REVIEW_NOT_PUBLISHED' using errcode='55000';end if;
 return public.savings_dashboard_before_publication();
end $$;

alter function public.replace_self_savings_beneficiaries(jsonb,uuid) rename to savings_beneficiaries_before_publication;
revoke all on function public.savings_beneficiaries_before_publication(jsonb,uuid) from public,anon,authenticated,service_role;
create function public.replace_self_savings_beneficiaries(p_beneficiaries jsonb,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();af uuid:=public.get_effective_affiliate_id();p public.savings_participants%rowtype;
 prior public.savings_audit_events%rowtype;total numeric;item jsonb;new_version integer;new_version_id uuid;
begin
 if actor is null or af is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';end if;
 if not exists(select 1 from public.savings_publication_state where id and mode='PUBLISHED') then
  raise exception 'SAVINGS_PRIVATE_REVIEW_NOT_PUBLISHED' using errcode='55000';end if;
 if p_idempotency_key is null or jsonb_typeof(p_beneficiaries) is distinct from 'array'
  or jsonb_array_length(p_beneficiaries) not between 1 and 20 then raise exception 'SAVINGS_BENEFICIARIES_INVALID' using errcode='22023';end if;
 total:=0;
 for item in select value from jsonb_array_elements(p_beneficiaries) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'full_name') is distinct from 'string'
   or jsonb_typeof(item->'relationship') is distinct from 'string' or jsonb_typeof(item->'percentage') is distinct from 'number'
   or length(btrim(item->>'full_name')) not between 3 and 180 or length(btrim(item->>'relationship')) not between 2 and 80
   or (item->>'percentage')::numeric<=0 or (item->>'percentage')::numeric>100
   or (item->>'percentage')::numeric<>round((item->>'percentage')::numeric,2) then raise exception 'SAVINGS_BENEFICIARIES_INVALID' using errcode='22023';end if;
  total:=total+(item->>'percentage')::numeric;
 end loop;
 if total<>100 then raise exception 'SAVINGS_BENEFICIARIES_MUST_TOTAL_100' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-beneficiaries:'||p_idempotency_key,0));
 lock table public.affiliates in share mode;
 select * into p from public.savings_participants where affiliate_id=af for update;
 if p.id is null or p.identity_status<>'RESOLVED' or p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL'
  or (select count(*) from public.affiliates where numero_control=p.legacy_folio)<>1
  or not exists(select 1 from public.affiliates a where a.id=af and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)) then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';end if;
 select * into prior from public.savings_audit_events where client_action_id=p_idempotency_key;
 if found then
  if prior.actor_real_auth_user_id is distinct from actor or prior.usuario_contexto_affiliate_id is distinct from af
   or prior.participant_id is distinct from p.id or prior.resource<>'savings_beneficiaries' or prior.action<>'REPLACE_VERSION'
   or prior.after_data->'beneficiaries' is distinct from p_beneficiaries
   or not exists(select 1 from public.savings_beneficiary_versions v where v.id::text=prior.target_id and v.participant_id=p.id and v.actor_real_auth_user_id=actor) then
   raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT' using errcode='22023';end if;
  return jsonb_build_object('version_id',prior.target_id,'version_number',prior.after_data->'version','beneficiaries',prior.after_data->'beneficiaries');
 end if;
 if not exists(select 1 from public.savings_enrollments where participant_id=p.id and data_classification='CANONICAL'
  and (status in ('ACTIVE','TERMINATION_PENDING') or status='TERMINATED' and (terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today())
  and (terminated_at is null or (terminated_at at time zone 'America/Hermosillo')::date>public.savings_operation_today())) then
  raise exception 'SAVINGS_ACTIVE_ENROLLMENT_REQUIRED';end if;
 -- Write only after the participant lock and scoped replay check. The old writer
 -- had an unscoped retry branch; delegating to it could race another resource.
 select coalesce(max(version_number),0)+1 into new_version from public.savings_beneficiary_versions where participant_id=p.id;
 update public.savings_beneficiary_versions set status='SUPERSEDED',superseded_at=clock_timestamp() where participant_id=p.id and status='ACTIVE';
 insert into public.savings_beneficiary_versions(participant_id,version_number,status,actor_real_auth_user_id)
 values(p.id,new_version,'ACTIVE',actor) returning id into new_version_id;
 insert into public.savings_beneficiaries(version_id,full_name,relationship,percentage)
 select new_version_id,btrim(x->>'full_name'),btrim(x->>'relationship'),(x->>'percentage')::numeric from jsonb_array_elements(p_beneficiaries)x;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,client_action_id)
 values(actor,af,p.id,'savings_beneficiaries','REPLACE_VERSION',new_version_id::text,jsonb_build_object('version',new_version,'beneficiaries',p_beneficiaries),p_idempotency_key);
 return jsonb_build_object('version_id',new_version_id,'version_number',new_version,'beneficiaries',p_beneficiaries);
end $$;

alter function public.get_self_savings_if_changed(text) rename to savings_if_changed_before_publication;
revoke all on function public.savings_if_changed_before_publication(text) from public,anon,authenticated,service_role;
-- Preserve the existing H05 private read optimization. Only the internal reader
-- name and its two installation-time dependency hashes change. Future dependency
-- drift still fails closed to a fresh read, exactly as H05 originally required.
do $private_cache$
declare definition text; legacy_hash text; action_hash text;
begin
 select b.definition into definition from public.savings_publication_function_backup b where b.signature='get_self_savings_if_changed(text)';
 if definition is null or position('H05_V1' in definition)=0
  or position('74f504337e4f336e6b12da3ab32f30a6' in definition)=0
  or position('407fefd589bc4f840a0fc36d988e831b' in definition)=0 then
  raise exception 'SAVINGS_PRIVATE_READ_CONTRACT_CHANGED';end if;
 legacy_hash:=md5(pg_get_functiondef('public.savings_self_before_publication()'::regprocedure));
 action_hash:=md5(pg_get_functiondef('public.savings_effective_action(text,uuid)'::regprocedure));
 definition:=replace(definition,'public.get_self_savings_if_changed(', 'public.savings_if_changed_before_publication(');
 definition:=replace(definition,'public.get_self_savings_live_readonly()', 'public.savings_self_before_publication()');
 definition:=replace(definition,'74f504337e4f336e6b12da3ab32f30a6',legacy_hash);
 definition:=replace(definition,'407fefd589bc4f840a0fc36d988e831b',action_hash);
 execute definition;
end $private_cache$;

create function public.get_self_savings_if_changed(p_known_version text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); af uuid:=public.get_effective_affiliate_id(); context jsonb; imp jsonb;
begin
 if actor is null or af is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';end if;
 if exists(select 1 from public.savings_publication_state where id and mode='PRIVATE') then
  return public.savings_if_changed_before_publication(p_known_version);
 end if;
 select to_jsonb(i) into imp from public.get_impersonation_context()i;
 context:=jsonb_build_object('actor_auth_user_id',actor,'effective_affiliate_id',af,'actor_session_id',auth.jwt()->>'session_id','impersonation_id',imp->>'session_id');
 -- Published accounts use a fresh dependency graph. No local value can
 -- outlive the atomic authority change or a confirmed real receipt.
 return jsonb_build_object('version',null,'modified',true,'cacheable',false,'context',context,'data',public.get_self_savings_live_readonly());
end $$;

revoke all on function public.savings_canonical_user_projection(uuid),public.get_admin_savings_publication_preview(uuid),public.get_admin_savings_publication_account_preview(uuid),public.get_admin_savings_publication_status(),
 public.admin_publish_savings(integer,text,boolean,uuid),public.get_self_savings_live_readonly(),public.get_self_savings_if_changed(text),public.get_self_savings_dashboard(),public.replace_self_savings_beneficiaries(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_publication_preview(uuid),public.get_admin_savings_publication_account_preview(uuid),public.get_admin_savings_publication_status(),public.admin_publish_savings(integer,text,boolean,uuid),
 public.get_self_savings_live_readonly(),public.get_self_savings_if_changed(text),public.get_self_savings_dashboard(),public.replace_self_savings_beneficiaries(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
