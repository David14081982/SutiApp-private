begin;
set local lock_timeout='2s';
set local statement_timeout='90s';

-- H-REPORTS-JC-001. Additive operational evidence, never a savings ledger writer.
create schema savings_refunds_private;
revoke all on schema savings_refunds_private from public,anon,authenticated,service_role;

create table savings_refunds_private.cases (
 id uuid primary key default extensions.gen_random_uuid(),
 folio text not null unique,
 participant_id uuid not null references public.savings_participants(id) on delete restrict,
 affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 numero_control text not null check(length(numero_control) between 1 and 80),
 origin text not null default 'CURRENT' check(origin in ('CURRENT','HISTORICAL')),
 cause text not null check(cause in ('POST_TERMINATION','DUPLICATE_DISCOUNT','OTHER')),
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','PARTIAL','PAID','REJECTED','CANCELLED')),
 version integer not null default 1 check(version>0),
 authorized_amount numeric(14,2),
 created_at timestamptz not null default clock_timestamp(),
 submitted_at timestamptz, approved_at timestamptz, paid_at timestamptz,
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 usuario_contexto_affiliate_id uuid references public.affiliates(id) on delete restrict,
 check(authorized_amount is null or authorized_amount>0),
 check((status in ('APPROVED','PARTIAL','PAID'))=(authorized_amount is not null and approved_at is not null)),
 check((status='PAID')=(paid_at is not null))
);
create index savings_refunds_participant on savings_refunds_private.cases(participant_id,created_at desc);
create index savings_refunds_completed on savings_refunds_private.cases(paid_at) where status='PAID';

create table savings_refunds_private.deductions (
 id uuid primary key default extensions.gen_random_uuid(),
 case_id uuid not null references savings_refunds_private.cases(id) on delete restrict,
 participant_id uuid not null references public.savings_participants(id) on delete restrict,
 source_reference text not null check(length(btrim(source_reference)) between 3 and 180),
 deduction_on date not null, sent_to_rh_on date, sent_to_rh_unknown_reason text,
 historical_payroll_code integer, historical_payroll_reference text,
 expected_amount numeric(14,2) not null check(expected_amount>=0),
 actual_amount numeric(14,2), confirmed_on date, confirmation_reference text,
 balance_treatment text not null check(balance_treatment in ('NOT_CREDITED','ALREADY_EXCLUDED','EXISTING_ADJUSTMENT')),
 balance_note text not null check(length(btrim(balance_note)) between 3 and 1000),
 adjustment_id uuid references public.savings_transactions(id) on delete restrict,
 unique(case_id,id),
 check(sent_to_rh_on<=deduction_on),
 check((sent_to_rh_on is not null and sent_to_rh_unknown_reason is null)
   or (sent_to_rh_on is null and length(btrim(sent_to_rh_unknown_reason)) between 3 and 1000 and sent_to_rh_unknown_reason is not null)),
 check((historical_payroll_code is null and historical_payroll_reference is null)
   or (historical_payroll_code is not null and historical_payroll_code in (573,580)
    and historical_payroll_reference is not null and length(btrim(historical_payroll_reference)) between 3 and 180)),
 check(actual_amount is null or actual_amount>=expected_amount),
 check((actual_amount is null and confirmed_on is null and confirmation_reference is null)
   or (actual_amount is not null and confirmed_on is not null and confirmation_reference is not null and length(btrim(confirmation_reference)) between 3 and 180)),
 check((balance_treatment='EXISTING_ADJUSTMENT')=(adjustment_id is not null))
);
-- Retain reservations after cancellation/rejection; rework a rejected case, never duplicate its discount.
create unique index savings_refunds_discount_once on savings_refunds_private.deductions(participant_id,lower(btrim(source_reference)));
create unique index savings_refunds_adjustment_once on savings_refunds_private.deductions(adjustment_id) where adjustment_id is not null;
create index savings_refunds_case_deductions on savings_refunds_private.deductions(case_id);

create table savings_refunds_private.payments (
 id uuid primary key default extensions.gen_random_uuid(),
 case_id uuid not null references savings_refunds_private.cases(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0), paid_on date not null,
 bank_reference text not null check(length(btrim(bank_reference)) between 3 and 180),
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 captured_at timestamptz not null default clock_timestamp(),
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 usuario_contexto_affiliate_id uuid references public.affiliates(id) on delete restrict,
 client_action_id uuid not null unique,
 supersedes_payment_id uuid unique,
 unique(case_id,id),
 foreign key(case_id,supersedes_payment_id) references savings_refunds_private.payments(case_id,id) on delete restrict,
 check(supersedes_payment_id is null or supersedes_payment_id<>id)
);
-- One bank transfer batch may legitimately cover several separate cases.
-- Original references stay reserved. Corrections use the case lock and compare
-- effective rows; their predecessor is retained and can be superseded only once.
create unique index savings_refunds_payment_reference_once on savings_refunds_private.payments(case_id,lower(btrim(bank_reference))) where supersedes_payment_id is null;
create index savings_refunds_case_payments on savings_refunds_private.payments(case_id,paid_on,id);
create table savings_refunds_private.payroll_evidence_versions (
 id uuid primary key default extensions.gen_random_uuid(),
 case_id uuid not null references savings_refunds_private.cases(id) on delete restrict,
 deduction_id uuid not null,
 version integer not null check(version>0),
 historical_payroll_code integer not null check(historical_payroll_code in (573,580)),
 historical_payroll_reference text not null check(length(btrim(historical_payroll_reference)) between 3 and 180),
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 captured_at timestamptz not null default clock_timestamp(),
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 usuario_contexto_affiliate_id uuid references public.affiliates(id) on delete restrict,
 client_action_id uuid not null unique,
 foreign key(case_id,deduction_id) references savings_refunds_private.deductions(case_id,id) on delete restrict,
 unique(deduction_id,version)
);
create table savings_refunds_private.events (
 id bigint generated always as identity primary key,
 case_id uuid references savings_refunds_private.cases(id) on delete restrict,
 action text not null, command jsonb not null, before_data jsonb, result jsonb not null,
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 usuario_contexto_affiliate_id uuid references public.affiliates(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(), client_action_id uuid not null unique
);
create index savings_refunds_case_events on savings_refunds_private.events(case_id,id);
create table savings_refunds_private.reporting_periods (
 period date primary key check(extract(day from period)=1),
 version integer not null check(version>0),
 confirmed_at timestamptz not null, invalidated_at timestamptz,
 confirmed_case_count integer not null check(confirmed_case_count>=0),
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 usuario_contexto_affiliate_id uuid references public.affiliates(id) on delete restrict
);

do $$ declare t text; begin
 foreach t in array array['cases','deductions','payments','payroll_evidence_versions','events','reporting_periods'] loop
  execute format('alter table savings_refunds_private.%I enable row level security',t);
  execute format('alter table savings_refunds_private.%I force row level security',t);
  execute format('revoke all on savings_refunds_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
create function savings_refunds_private.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'SAVINGS_REFUND_HISTORY_IMMUTABLE' using errcode='42501'; end $$;
create trigger savings_refunds_payments_immutable before update or delete on savings_refunds_private.payments for each row execute function savings_refunds_private.immutable();
create trigger savings_refunds_events_immutable before update or delete on savings_refunds_private.events for each row execute function savings_refunds_private.immutable();
create trigger savings_refunds_payroll_evidence_immutable before update or delete on savings_refunds_private.payroll_evidence_versions for each row execute function savings_refunds_private.immutable();
create trigger savings_refunds_cases_no_delete before delete on savings_refunds_private.cases for each row execute function savings_refunds_private.immutable();
create trigger savings_refunds_deductions_no_delete before delete on savings_refunds_private.deductions for each row execute function savings_refunds_private.immutable();
create trigger savings_refunds_periods_no_delete before delete on savings_refunds_private.reporting_periods for each row execute function savings_refunds_private.immutable();

create function savings_refunds_private.authorize(p_action text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.has_admin_permission('savings.read'),false)
  or not coalesce(public.has_admin_permission('savings.'||p_action),false)
  or not coalesce(public.admin_module_boundary(array['savings'],case when p_action='read' then 'read' else 'update' end),false)
  or exists(select 1 from admin_support_private.context())
 then raise exception 'SAVINGS_REFUND_DENIED' using errcode='42501';end if;
end $$;
create function savings_refunds_private.money(p_value jsonb) returns numeric
language plpgsql immutable set search_path='' as $$
declare v numeric;
begin
 if jsonb_typeof(p_value) is distinct from 'number' then raise exception 'SAVINGS_REFUND_AMOUNT_INVALID';end if;
 v:=p_value::text::numeric;
 if v<0 or v>999999999999.99 or v<>round(v,2) then raise exception 'SAVINGS_REFUND_AMOUNT_INVALID';end if;
 return v;
end $$;
create function savings_refunds_private.payroll_source(p_participant_id uuid,p_deduction_on date) returns jsonb
language sql stable security definer set search_path='' as $$
 -- Pick the enrollment first. A plan from an earlier cycle cannot override
 -- a later enrollment's process. The last applicable cycle remains usable
 -- after termination because already-sent payroll can still be deducted.
 with cycle as (
  select e.* from public.savings_enrollments e where e.participant_id=p_participant_id and e.data_classification='CANONICAL'
   and (e.enrollment_started_at at time zone 'America/Hermosillo')::date<=p_deduction_on
  order by e.enrollment_started_at desc,e.sequence_number desc,e.id desc limit 1
 ), resolved as (
  select coalesce((select cp.process_snapshot from public.savings_contribution_plans cp where cp.enrollment_id=e.id
   and cp.data_classification='CANONICAL' and cp.effective_from<=p_deduction_on order by cp.effective_from desc,cp.id desc limit 1),e.process_snapshot) process,e.id enrollment_id
  from cycle e
 )
 select jsonb_build_object('process',(select process from resolved),'enrollment_id',(select enrollment_id from resolved),
  'code',(select case when process='JUB' then 580 when process in ('PROCESS_1','PROCESS_3') then 573 end from resolved));
$$;
create function savings_refunds_private.payroll_evidence(p_deduction_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('historical_payroll_code',coalesce(v.historical_payroll_code,d.historical_payroll_code),
  'historical_payroll_reference',coalesce(v.historical_payroll_reference,d.historical_payroll_reference),'version',coalesce(v.version,0))
 from savings_refunds_private.deductions d left join lateral(select * from savings_refunds_private.payroll_evidence_versions x where x.deduction_id=d.id order by version desc limit 1)v on true
 where d.id=p_deduction_id;
$$;
create function savings_refunds_private.deduction_snapshot(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(d)||jsonb_build_object(
  'effective_historical_payroll_code',evidence.value->'historical_payroll_code','effective_historical_payroll_reference',evidence.value->'historical_payroll_reference',
  'payroll_resolution',jsonb_build_object('canonical_code',canonical.value->'code','effective_code',coalesce(canonical.value->>'code',evidence.value->>'historical_payroll_code')::integer,
   'conflict',canonical.value->>'code' is not null and evidence.value->>'historical_payroll_code' is not null and canonical.value->>'code'<>evidence.value->>'historical_payroll_code',
   'source',case when canonical.value->>'code' is not null then 'CANONICAL' when evidence.value->>'historical_payroll_code' is not null then 'HISTORICAL_ATTESTATION' else 'UNRESOLVED' end),
  'payroll_history',coalesce((select jsonb_agg(to_jsonb(v) order by version desc) from savings_refunds_private.payroll_evidence_versions v where v.deduction_id=d.id),'[]'::jsonb))
 from savings_refunds_private.deductions d
 cross join lateral(select savings_refunds_private.payroll_evidence(d.id) value)evidence
 cross join lateral(select savings_refunds_private.payroll_source(d.participant_id,d.deduction_on) value)canonical where d.id=p_id;
$$;
create function savings_refunds_private.snapshot(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object(
  'case_id',c.id,
  'name',(select coalesce(to_jsonb(a)->>'full_name',to_jsonb(p)->>'display_name') from public.savings_participants p join public.affiliates a on a.id=p.affiliate_id where p.id=c.participant_id),
  'paid_amount',coalesce((select sum(p.amount) from savings_refunds_private.payments p where p.case_id=c.id and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id)),0),
  'pending_amount',case when c.authorized_amount is not null then c.authorized_amount-coalesce((select sum(p.amount) from savings_refunds_private.payments p where p.case_id=c.id and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id)),0) end,
  'deductions',coalesce((select jsonb_agg(savings_refunds_private.deduction_snapshot(d.id) order by deduction_on,id) from savings_refunds_private.deductions d where d.case_id=c.id),'[]'),
  'payments',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('is_superseded',exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id),'superseded_by_payment_id',(select n.id from savings_refunds_private.payments n where n.supersedes_payment_id=p.id)) order by paid_on,id) from savings_refunds_private.payments p where p.case_id=c.id),'[]'))
 from savings_refunds_private.cases c where c.id=p_id;
$$;
create function public.get_admin_savings_refunds(p_case_id uuid default null,p_folio text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform savings_refunds_private.authorize('read');
 if length(coalesce(p_folio,''))>80 then raise exception 'SAVINGS_REFUND_FILTER_INVALID';end if;
 select jsonb_build_object('cases',coalesce(jsonb_agg(savings_refunds_private.snapshot(c.id)||jsonb_build_object(
  'events',case when p_case_id is not null then coalesce((select jsonb_agg(to_jsonb(e)-'command' order by e.id) from savings_refunds_private.events e where e.case_id=c.id),'[]') else '[]'::jsonb end)
  order by c.created_at desc,c.id),'[]'),
  'permissions',jsonb_build_object('can_write',public.has_admin_permission('savings.write') and public.admin_module_boundary(array['savings'],'update'),
   'can_approve',public.has_admin_permission('savings.approve') and public.admin_module_boundary(array['savings'],'update')),
  'coveragePeriods',coalesce((select jsonb_agg(to_jsonb(p) order by p.period desc) from savings_refunds_private.reporting_periods p),'[]'),
  'coverageEvents',coalesce((select jsonb_agg(to_jsonb(e)-'command' order by e.id desc) from savings_refunds_private.events e where e.action='CONFIRM_PERIOD'),'[]'),
  'today',public.savings_operation_today()) into result
 from savings_refunds_private.cases c where (p_case_id is null or c.id=p_case_id) and (p_folio is null or c.numero_control=p_folio);
 return result;
end $$;

create function public.get_admin_savings_refund_people(p_search text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; term text:=btrim(coalesce(p_search,''));
begin
 perform savings_refunds_private.authorize('read');
 if length(term)>180 then raise exception 'SAVINGS_REFUND_FILTER_INVALID';end if;
 select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(x) order by x.folio,x.participant_id),'[]')) into result from (
  select p.id participant_id,p.legacy_folio folio,
   coalesce(nullif(to_jsonb(a)->>'display_name',''),nullif(to_jsonb(a)->>'full_name',''),nullif(to_jsonb(p)->>'display_name',''),p.legacy_folio) nombre,
   coalesce(a.is_archived,false) is_archived
  from public.savings_participants p join public.affiliates a on a.id=p.affiliate_id and a.numero_control=p.legacy_folio
  where p.data_classification='CANONICAL' and p.identity_status='RESOLVED'
   and (select count(*) from public.savings_participants same where same.legacy_folio=p.legacy_folio and same.data_classification='CANONICAL' and same.identity_status='RESOLVED')=1
   and (term='' or strpos(lower(p.legacy_folio),lower(term))>0 or strpos(lower(coalesce(to_jsonb(a)->>'display_name',to_jsonb(a)->>'full_name',to_jsonb(p)->>'display_name','')),lower(term))>0)
 ) x;
 return result;
end $$;

create function public.save_admin_savings_refund(p_command jsonb,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare kind text:=p_command->>'kind'; c savings_refunds_private.cases%rowtype; prior savings_refunds_private.events%rowtype;
 participant public.savings_participants%rowtype; d jsonb; source_ref text; adjusted public.savings_transactions%rowtype;
 before_row jsonb; result jsonb; actor uuid:=auth.uid(); context_id uuid:=public.get_effective_affiliate_id();
 amount numeric; actual numeric; expected numeric; total numeric; paid numeric; paid_day date; confirmed date; deduction_day date;
 today date:=public.savings_operation_today(); new_case_id uuid; note text:=btrim(coalesce(p_command->>'reason','')); report_period date;
 historical boolean:=kind='REGISTER_HISTORICAL'; old_payment savings_refunds_private.payments%rowtype;
 payment jsonb; payment_total numeric; completion_day date; affected_periods date[]:=array[]::date[];
 historical_code integer; historical_reference text; canonical_code integer;
 corrected_deduction savings_refunds_private.deductions%rowtype; evidence_version integer;
begin
 if kind is null or kind not in ('CREATE','SAVE','SUBMIT','APPROVE','REJECT','CANCEL','PAY','CONFIRM_PERIOD','REGISTER_HISTORICAL','CORRECT_PAYMENT','CORRECT_PAYROLL_EVIDENCE') or p_client_action_id is null
  or jsonb_typeof(p_command) is distinct from 'object' or length(note) not between 3 and 1000
  or pg_column_size(p_command)>200000
 then raise exception 'SAVINGS_REFUND_COMMAND_INVALID';end if;
 perform savings_refunds_private.authorize(case when kind in ('APPROVE','REJECT','PAY','CANCEL','CONFIRM_PERIOD','REGISTER_HISTORICAL','CORRECT_PAYMENT','CORRECT_PAYROLL_EVIDENCE') then 'approve' else 'write' end);
 if kind in ('CONFIRM_PERIOD','REGISTER_HISTORICAL','CORRECT_PAYMENT','CORRECT_PAYROLL_EVIDENCE') then perform savings_refunds_private.authorize('write');end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-refund:'||p_client_action_id,0));
 select * into prior from savings_refunds_private.events where client_action_id=p_client_action_id;
 if found then
  if prior.command is distinct from p_command or prior.actor_real_auth_user_id<>actor or prior.usuario_contexto_affiliate_id is distinct from context_id
  then raise exception 'SAVINGS_REFUND_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 if kind='CONFIRM_PERIOD' then
  report_period:=(p_command->>'period')::date;
  if report_period is null or extract(day from report_period)<>1 or report_period<date '2000-01-01' or report_period>=date_trunc('month',today)::date then raise exception 'SAVINGS_REFUND_PERIOD_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('savings-refund-month:'||report_period,0));
  select to_jsonb(p) into before_row from savings_refunds_private.reporting_periods p where p.period=report_period;
  insert into savings_refunds_private.reporting_periods(period,version,confirmed_at,confirmed_case_count,reason,actor_real_auth_user_id,usuario_contexto_affiliate_id)
  select report_period,1,clock_timestamp(),count(*),note,actor,context_id from savings_refunds_private.cases x
   where x.status='PAID' and (x.paid_at at time zone 'America/Hermosillo')::date>=report_period and (x.paid_at at time zone 'America/Hermosillo')::date<(report_period+interval '1 month')::date
  on conflict(period) do update set version=savings_refunds_private.reporting_periods.version+1,confirmed_at=excluded.confirmed_at,invalidated_at=null,
   confirmed_case_count=excluded.confirmed_case_count,reason=excluded.reason,actor_real_auth_user_id=excluded.actor_real_auth_user_id,usuario_contexto_affiliate_id=excluded.usuario_contexto_affiliate_id;
  select to_jsonb(p) into result from savings_refunds_private.reporting_periods p where p.period=report_period;
  insert into savings_refunds_private.events(action,command,before_data,result,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id)
  values(kind,p_command,before_row,result,actor,context_id,p_client_action_id);
  return result;
 end if;
 if kind in ('CREATE','REGISTER_HISTORICAL') then
  select * into participant from public.savings_participants where id=(p_command->>'participant_id')::uuid for share;
  if participant.id is null or participant.data_classification<>'CANONICAL' or participant.identity_status<>'RESOLVED'
   or not exists(select 1 from public.affiliates a where a.id=participant.affiliate_id and a.numero_control=participant.legacy_folio and (historical or not coalesce(a.is_archived,false)))
   or (not historical and (select count(*) from public.affiliates where numero_control=participant.legacy_folio and not coalesce(is_archived,false))<>1)
   or (historical and (select count(*) from public.savings_participants same where same.legacy_folio=participant.legacy_folio and same.data_classification='CANONICAL' and same.identity_status='RESOLVED')<>1)
  then raise exception 'SAVINGS_REFUND_EXACT_IDENTITY_REQUIRED';end if;
  new_case_id:=extensions.gen_random_uuid();
  insert into savings_refunds_private.cases(id,folio,participant_id,affiliate_id,numero_control,origin,cause,reason,actor_real_auth_user_id,usuario_contexto_affiliate_id)
  values(new_case_id,'RE-'||to_char(today,'YYYY')||'-'||upper(replace(new_case_id::text,'-','')),participant.id,participant.affiliate_id,participant.legacy_folio,case when historical then 'HISTORICAL' else 'CURRENT' end,p_command->>'cause',note,actor,context_id) returning * into c;
 else
  select * into c from savings_refunds_private.cases where id=(p_command->>'case_id')::uuid for update;
  if c.id is null then raise exception 'SAVINGS_REFUND_NOT_FOUND';end if;
  if p_command ? 'participant_id' and (p_command->>'participant_id')::uuid is distinct from c.participant_id then raise exception 'SAVINGS_REFUND_IDENTITY_IMMUTABLE';end if;
  if (p_command->>'expected_version')::integer is distinct from c.version then raise exception 'SAVINGS_REFUND_VERSION_CONFLICT';end if;
  before_row:=savings_refunds_private.snapshot(c.id);
 end if;
 if kind in ('CREATE','SAVE','REGISTER_HISTORICAL') then
  if c.status not in ('DRAFT','SUBMITTED','REJECTED') then raise exception 'SAVINGS_REFUND_STATE_INVALID';end if;
  if jsonb_typeof(p_command->'deductions') is distinct from 'array' or jsonb_array_length(p_command->'deductions') not between 1 and 100 then raise exception 'SAVINGS_REFUND_DEDUCTIONS_REQUIRED';end if;
  if exists(select 1 from savings_refunds_private.deductions old where old.case_id=c.id and not exists(select 1 from jsonb_array_elements(p_command->'deductions') n where lower(btrim(n->>'source_reference'))=lower(btrim(old.source_reference))))
  then raise exception 'SAVINGS_REFUND_DISCOUNT_HISTORY_REQUIRED';end if;
  if (select count(distinct lower(btrim(x->>'source_reference'))) from jsonb_array_elements(p_command->'deductions')x)<>jsonb_array_length(p_command->'deductions') then raise exception 'SAVINGS_REFUND_DUPLICATE_DISCOUNT';end if;
  for d in select value from jsonb_array_elements(p_command->'deductions') order by lower(btrim(value->>'source_reference')) loop
   source_ref:=btrim(d->>'source_reference'); expected:=savings_refunds_private.money(d->'expected_amount');
   actual:=case when d->'actual_amount' is null or d->'actual_amount'='null'::jsonb then null else savings_refunds_private.money(d->'actual_amount') end;
   deduction_day:=(d->>'deduction_on')::date; confirmed:=nullif(d->>'confirmed_on','')::date;
   historical_code:=nullif(d->>'historical_payroll_code','')::integer;historical_reference:=nullif(btrim(d->>'historical_payroll_reference'),'');
   if (not historical and (historical_code is not null or historical_reference is not null))
    or (historical_code is not null and historical_code not in (573,580))
    or ((historical_code is not null)<>(historical_reference is not null))
    or (historical_reference is not null and length(historical_reference) not between 3 and 180)
    then raise exception 'SAVINGS_REFUND_PAYROLL_EVIDENCE_INVALID';end if;
   if historical then
    canonical_code:=(savings_refunds_private.payroll_source(c.participant_id,deduction_day)->>'code')::integer;
    if canonical_code is null and historical_code is null then raise exception 'SAVINGS_REFUND_PAYROLL_EVIDENCE_REQUIRED';end if;
    if canonical_code is not null and historical_code is not null and canonical_code<>historical_code then raise exception 'SAVINGS_REFUND_PAYROLL_EVIDENCE_CONFLICT';end if;
   end if;
   if nullif(d->>'sent_to_rh_on','') is null and (not historical or length(btrim(coalesce(d->>'sent_to_rh_unknown_reason',''))) not between 3 and 1000)
    then raise exception 'SAVINGS_REFUND_RH_DATE_REQUIRED';end if;
   if deduction_day is null or (actual is not null and (deduction_day>today or confirmed>today or confirmed<deduction_day))
    or nullif(d->>'sent_to_rh_on','')::date>today then raise exception 'SAVINGS_REFUND_DISCOUNT_DATE_INVALID';end if;
   if d->>'balance_treatment'='EXISTING_ADJUSTMENT' then
    select * into adjusted from public.savings_transactions where id=nullif(d->>'adjustment_id','')::uuid;
    if adjusted.id is null or adjusted.participant_id<>c.participant_id or adjusted.data_classification<>'CANONICAL'
     or adjusted.transaction_type<>'ADJUSTMENT' or adjusted.component<>'CAPITAL' or adjusted.direction<>'DEBIT'
     or actual is null or adjusted.amount<actual-expected then raise exception 'SAVINGS_REFUND_ADJUSTMENT_INVALID';end if;
   end if;
   insert into savings_refunds_private.deductions(case_id,participant_id,source_reference,deduction_on,sent_to_rh_on,sent_to_rh_unknown_reason,historical_payroll_code,historical_payroll_reference,expected_amount,actual_amount,confirmed_on,confirmation_reference,balance_treatment,balance_note,adjustment_id)
   values(c.id,c.participant_id,source_ref,deduction_day,nullif(d->>'sent_to_rh_on','')::date,nullif(btrim(d->>'sent_to_rh_unknown_reason'),''),historical_code,historical_reference,expected,actual,confirmed,nullif(btrim(d->>'confirmation_reference'),''),d->>'balance_treatment',d->>'balance_note',nullif(d->>'adjustment_id','')::uuid)
   on conflict (participant_id,lower(btrim(source_reference))) do update set
    deduction_on=excluded.deduction_on,sent_to_rh_on=excluded.sent_to_rh_on,sent_to_rh_unknown_reason=excluded.sent_to_rh_unknown_reason,expected_amount=excluded.expected_amount,actual_amount=excluded.actual_amount,
    historical_payroll_code=excluded.historical_payroll_code,historical_payroll_reference=excluded.historical_payroll_reference,
    confirmed_on=excluded.confirmed_on,confirmation_reference=excluded.confirmation_reference,balance_treatment=excluded.balance_treatment,balance_note=excluded.balance_note,adjustment_id=excluded.adjustment_id
   where savings_refunds_private.deductions.case_id=c.id;
   if not found then raise exception 'SAVINGS_REFUND_DISCOUNT_ALREADY_CLAIMED';end if;
  end loop;
  update savings_refunds_private.cases set cause=p_command->>'cause',reason=note,status='DRAFT',submitted_at=null where id=c.id;
  if historical then
   if exists(select 1 from savings_refunds_private.deductions where case_id=c.id and (actual_amount is null or confirmed_on is null or deduction_on>today))
    then raise exception 'SAVINGS_REFUND_CONFIRM_DISCOUNTS_FIRST';end if;
   select sum(actual_amount-expected_amount) into total from savings_refunds_private.deductions where case_id=c.id;
   total:=savings_refunds_private.money(to_jsonb(total));
   if total<=0 then raise exception 'SAVINGS_REFUND_FULL_EXCESS_REQUIRED';end if;
   if jsonb_typeof(p_command->'payments') is distinct from 'array' or jsonb_array_length(p_command->'payments') not between 1 and 100
    then raise exception 'SAVINGS_REFUND_HISTORICAL_PAYMENTS_REQUIRED';end if;
   payment_total:=0;
   for payment in select value from jsonb_array_elements(p_command->'payments') order by value->>'paid_on',value->>'bank_reference' loop
    amount:=savings_refunds_private.money(payment->'amount');paid_day:=(payment->>'paid_on')::date;
    if amount<=0 then raise exception 'SAVINGS_REFUND_AMOUNT_INVALID';end if;
    if paid_day is null or paid_day>today or exists(select 1 from savings_refunds_private.deductions where case_id=c.id and deduction_on>paid_day)
     then raise exception 'SAVINGS_REFUND_PAYMENT_DATE_INVALID';end if;
    if exists(select 1 from savings_refunds_private.payments p where p.case_id=c.id and lower(btrim(p.bank_reference))=lower(btrim(payment->>'bank_reference')))
     then raise exception 'SAVINGS_REFUND_PAYMENT_ALREADY_RECORDED';end if;
    insert into savings_refunds_private.payments(case_id,amount,paid_on,bank_reference,reason,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id)
    values(c.id,amount,paid_day,btrim(payment->>'bank_reference'),btrim(payment->>'reason'),actor,context_id,extensions.gen_random_uuid());
    payment_total:=payment_total+amount;completion_day:=greatest(completion_day,paid_day);
    affected_periods:=array_append(affected_periods,date_trunc('month',paid_day)::date);
   end loop;
   if payment_total<>total then raise exception 'SAVINGS_REFUND_FULL_EXCESS_REQUIRED';end if;
   -- These timestamps document capture and validation now, never a newly
   -- authorized transfer. The actual bank dates remain in immutable payments.
   update savings_refunds_private.cases set status='PAID',authorized_amount=total,approved_at=clock_timestamp(),
    paid_at=completion_day::timestamp at time zone 'America/Hermosillo' where id=c.id;
  end if;
 elsif kind='SUBMIT' then
  if c.status<>'DRAFT' then raise exception 'SAVINGS_REFUND_STATE_INVALID';end if;
  update savings_refunds_private.cases set status='SUBMITTED',submitted_at=clock_timestamp() where id=c.id;
 elsif kind='APPROVE' then
  if c.status<>'SUBMITTED' then raise exception 'SAVINGS_REFUND_STATE_INVALID';end if;
  if not exists(select 1 from savings_refunds_private.deductions where case_id=c.id) or exists(select 1 from savings_refunds_private.deductions where case_id=c.id and (actual_amount is null or confirmed_on is null or deduction_on>today))
  then raise exception 'SAVINGS_REFUND_CONFIRM_DISCOUNTS_FIRST';end if;
  select sum(actual_amount-expected_amount) into total from savings_refunds_private.deductions where case_id=c.id;
  -- Authorization covers the entire confirmed excess. Partial payments are
  -- supported, but this module has no authority to forgive an unpaid remainder.
  amount:=savings_refunds_private.money(to_jsonb(total));
  if amount<=0 or (p_command ? 'authorized_amount' and savings_refunds_private.money(p_command->'authorized_amount')<>amount)
  then raise exception 'SAVINGS_REFUND_FULL_EXCESS_REQUIRED';end if;
  update savings_refunds_private.cases set status='APPROVED',authorized_amount=amount,approved_at=clock_timestamp() where id=c.id;
 elsif kind in ('REJECT','CANCEL') then
  if c.status not in ('DRAFT','SUBMITTED','APPROVED') then raise exception 'SAVINGS_REFUND_STATE_INVALID';end if;
  update savings_refunds_private.cases set status=case when kind='REJECT' then 'REJECTED' else 'CANCELLED' end,authorized_amount=null,approved_at=null where id=c.id;
 elsif kind='CORRECT_PAYROLL_EVIDENCE' then
  if c.origin<>'HISTORICAL' or c.status not in ('PARTIAL','PAID') then raise exception 'SAVINGS_REFUND_STATE_INVALID';end if;
  select * into corrected_deduction from savings_refunds_private.deductions where id=(p_command->>'deduction_id')::uuid and case_id=c.id;
  if corrected_deduction.id is null then raise exception 'SAVINGS_REFUND_DEDUCTION_REQUIRED';end if;
  historical_code:=(p_command->>'historical_payroll_code')::integer;historical_reference:=btrim(coalesce(p_command->>'historical_payroll_reference',''));
  if historical_code is null or historical_code not in (573,580) or length(historical_reference) not between 3 and 180 then raise exception 'SAVINGS_REFUND_PAYROLL_EVIDENCE_INVALID';end if;
  canonical_code:=(savings_refunds_private.payroll_source(c.participant_id,corrected_deduction.deduction_on)->>'code')::integer;
  if canonical_code is not null and canonical_code<>historical_code then raise exception 'SAVINGS_REFUND_PAYROLL_EVIDENCE_CONFLICT';end if;
  select coalesce(max(version),0)+1 into evidence_version from savings_refunds_private.payroll_evidence_versions where deduction_id=corrected_deduction.id;
  insert into savings_refunds_private.payroll_evidence_versions(case_id,deduction_id,version,historical_payroll_code,historical_payroll_reference,reason,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id)
  values(c.id,corrected_deduction.id,evidence_version,historical_code,historical_reference,note,actor,context_id,p_client_action_id);
  if c.paid_at is not null then affected_periods:=array_append(affected_periods,date_trunc('month',c.paid_at at time zone 'America/Hermosillo')::date);end if;
 elsif kind='CORRECT_PAYMENT' then
  if c.status not in ('PARTIAL','PAID') then raise exception 'SAVINGS_REFUND_STATE_INVALID';end if;
  select * into old_payment from savings_refunds_private.payments p where p.id=(p_command->>'payment_id')::uuid and p.case_id=c.id
   and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id);
  if old_payment.id is null then raise exception 'SAVINGS_REFUND_EFFECTIVE_PAYMENT_REQUIRED';end if;
  amount:=savings_refunds_private.money(p_command->'amount');paid_day:=(p_command->>'paid_on')::date;
  select coalesce(sum(p.amount),0) into paid from savings_refunds_private.payments p where p.case_id=c.id
   and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id);
  if amount<=0 or paid-old_payment.amount+amount>c.authorized_amount then raise exception 'SAVINGS_REFUND_PAYMENT_EXCEEDED';end if;
  if paid_day is null or paid_day>today or exists(select 1 from savings_refunds_private.deductions where case_id=c.id and deduction_on>paid_day)
   then raise exception 'SAVINGS_REFUND_PAYMENT_DATE_INVALID';end if;
  if exists(select 1 from savings_refunds_private.payments p where p.case_id=c.id and p.id<>old_payment.id
   and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id)
   and lower(btrim(p.bank_reference))=lower(btrim(p_command->>'bank_reference')))
   then raise exception 'SAVINGS_REFUND_PAYMENT_ALREADY_RECORDED';end if;
  select coalesce(array_agg(distinct date_trunc('month',p.paid_on)::date),'{}'::date[]) into affected_periods
   from savings_refunds_private.payments p where p.case_id=c.id and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id);
  affected_periods:=array_append(affected_periods,date_trunc('month',paid_day)::date);
  if c.paid_at is not null then affected_periods:=array_append(affected_periods,date_trunc('month',c.paid_at at time zone 'America/Hermosillo')::date);end if;
  insert into savings_refunds_private.payments(case_id,amount,paid_on,bank_reference,reason,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id,supersedes_payment_id)
  values(c.id,amount,paid_day,btrim(p_command->>'bank_reference'),note,actor,context_id,p_client_action_id,old_payment.id);
  select sum(p.amount),max(p.paid_on) into paid,completion_day from savings_refunds_private.payments p where p.case_id=c.id
   and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id);
  update savings_refunds_private.cases set status=case when paid=authorized_amount then 'PAID' else 'PARTIAL' end,
   paid_at=case when paid=authorized_amount then completion_day::timestamp at time zone 'America/Hermosillo' end where id=c.id;
 else
  if c.status not in ('APPROVED','PARTIAL') then raise exception 'SAVINGS_REFUND_STATE_INVALID';end if;
  amount:=savings_refunds_private.money(p_command->'amount');paid_day:=(p_command->>'paid_on')::date;
  select coalesce(sum(p.amount),0) into paid from savings_refunds_private.payments p where p.case_id=c.id and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id);
  if amount<=0 or paid+amount>c.authorized_amount then raise exception 'SAVINGS_REFUND_PAYMENT_EXCEEDED';end if;
  if paid_day is null or paid_day>today or exists(select 1 from savings_refunds_private.deductions where case_id=c.id and (actual_amount is null or confirmed_on is null or deduction_on>paid_day))
   or exists(select 1 from savings_refunds_private.payments p where p.case_id=c.id and p.paid_on>paid_day and not exists(select 1 from savings_refunds_private.payments n where n.supersedes_payment_id=p.id))
  then raise exception 'SAVINGS_REFUND_PAYMENT_DATE_INVALID';end if;
  -- The case row is already locked. Reject a second capture for that case,
  -- including a fresh action UUID, without blocking other cases in the batch.
  if exists(select 1 from savings_refunds_private.payments p where p.case_id=c.id
   and lower(btrim(p.bank_reference))=lower(btrim(p_command->>'bank_reference')))
  then raise exception 'SAVINGS_REFUND_PAYMENT_ALREADY_RECORDED';end if;
  report_period:=date_trunc('month',paid_day)::date;
  perform pg_advisory_xact_lock(hashtextextended('savings-refund-month:'||report_period,0));
  insert into savings_refunds_private.payments(case_id,amount,paid_on,bank_reference,reason,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id)
  values(c.id,amount,paid_day,btrim(p_command->>'bank_reference'),note,actor,context_id,p_client_action_id);
  update savings_refunds_private.cases set status=case when paid+amount=authorized_amount then 'PAID' else 'PARTIAL' end,
   paid_at=case when paid+amount=authorized_amount then paid_day::timestamp at time zone 'America/Hermosillo' end where id=c.id;
  if paid+amount=c.authorized_amount then
   update savings_refunds_private.reporting_periods set invalidated_at=clock_timestamp() where period=report_period;
  end if;
 end if;
 if kind in ('REGISTER_HISTORICAL','CORRECT_PAYMENT','CORRECT_PAYROLL_EVIDENCE') then
  -- Sorted locks prevent multi-period correction/confirmation deadlocks.
  for report_period in select distinct x from unnest(affected_periods) x order by x loop
   perform pg_advisory_xact_lock(hashtextextended('savings-refund-month:'||report_period,0));
   update savings_refunds_private.reporting_periods set invalidated_at=clock_timestamp() where period=report_period;
  end loop;
 end if;
 update savings_refunds_private.cases set version=version+case when kind in ('CREATE','REGISTER_HISTORICAL') then 0 else 1 end where id=c.id;
 result:=savings_refunds_private.snapshot(c.id);
 if kind='PAY' and result->>'status'='PAID' then result:=result||jsonb_build_object('coverage_invalidated_period',report_period);end if;
 if kind in ('REGISTER_HISTORICAL','CORRECT_PAYMENT','CORRECT_PAYROLL_EVIDENCE') then result:=result||jsonb_build_object('coverage_invalidated_periods',coalesce((select jsonb_agg(x order by x) from (select distinct unnest(affected_periods) x) a),'[]'::jsonb));end if;
 insert into savings_refunds_private.events(case_id,action,command,before_data,result,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id)
 values(c.id,kind,p_command,before_row,result,actor,context_id,p_client_action_id);
 return result;
end $$;

revoke all on all tables in schema savings_refunds_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema savings_refunds_private from public,anon,authenticated,service_role;
revoke all on all functions in schema savings_refunds_private from public,anon,authenticated,service_role;
revoke all on function public.get_admin_savings_refunds(uuid,text),public.get_admin_savings_refund_people(text),public.save_admin_savings_refund(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_refunds(uuid,text),public.get_admin_savings_refund_people(text),public.save_admin_savings_refund(jsonb,uuid) to authenticated;

-- All amounts already recorded in Savings are accepted. This reader never
-- certifies, reconciles or writes them. Null dates/unknown events stay visible.
create function public.get_admin_reports_jc_savings(p_year integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; first_day date; last_day date; source_batch public.savings_review_batches%rowtype; source_count integer; archived_source_count integer;
begin
 if auth.uid() is null or not coalesce(public.has_admin_permission('savings.read'),false)
  or not coalesce(public.has_admin_permission('savings.reports'),false)
  or not coalesce(public.has_admin_permission('program_requests.read'),false)
  or not coalesce(public.admin_module_boundary(array['reportes_jc'],'read'),false)
 then raise exception 'REPORTS_JC_DENIED' using errcode='42501';end if;
 perform public.get_admin_reports_jc_context();
 if p_year is null or p_year not between 2000 and 2100 then raise exception 'REPORTS_JC_YEAR_INVALID';end if;
 first_day:=make_date(p_year,1,1);last_day:=make_date(p_year,12,31);
 -- import-savings-admin-review.js uses this one logical source name, captures
 -- all sheets together and inserts the batch before uploading 40-row chunks.
 -- Select the batch before considering its rows; an absent sheet stays absent.
 select * into source_batch from public.savings_review_batches where source_name='SutiApp Final'
  order by observed_at desc,created_at desc,id desc limit 1;
 if source_batch.id is null then raise exception 'REPORTS_JC_SAVINGS_IMPORT_UNAVAILABLE';end if;
 select count(*) into source_count from public.savings_review_records where batch_id=source_batch.id;
 -- Owner-authorized never-saver removals retain exact original UUID/batch in
 -- this immutable private archive. Count absent archived IDs for transport
 -- completeness only. Never restore them, expose snapshots or emit their events.
 select count(distinct removed->>'id') into archived_source_count
 from public.savings_registration_removal_archive a
 cross join lateral jsonb_array_elements(coalesce(a.snapshots->'savings_review_records','[]'::jsonb)) removed
 where removed->>'batch_id'=source_batch.id::text and nullif(removed->>'id','') is not null
  and not exists(select 1 from public.savings_review_records live where live.id::text=removed->>'id');
 if source_count+archived_source_count<>source_batch.expected_records then raise exception 'REPORTS_JC_SAVINGS_IMPORT_INCOMPLETE'
  using detail=format('Observed %s active and %s authorized archived records; batch expects %s.',source_count,archived_source_count,source_batch.expected_records);end if;
 with latest as materialized (
  -- Raw evidence is another representation, never an additional event source.
  select r.*,r.source_data||r.proposed_data d from public.savings_review_records r
  where r.batch_id=source_batch.id and r.source_sheet in ('Solicitud de Ahorro','Solicitud de retiro','Solicitud Cambio ahorro','Ingreso ahorro')
 ), historical as materialized (
  select r.id::text id,
   case r.source_sheet when 'Solicitud de Ahorro' then 'intake' when 'Solicitud de retiro' then 'withdrawal_requested' when 'Solicitud Cambio ahorro' then 'contribution_changed' end kind,
   public.savings_panel_date(r.d->>case when r.source_sheet='Solicitud de retiro' then 'D' else 'B' end) occurred_on,
   'savings_review_records'::text source_table,r.id::text source_id,coalesce(nullif(r.d->>'A',''),r.source_folio) numero_control,
   jsonb_build_object('sheet',r.source_sheet,'row',r.source_row,'state',r.d->>case when r.source_sheet='Solicitud de retiro' then 'H' when r.source_sheet='Solicitud Cambio ahorro' then 'E' else 'G' end,'historical',true) detail,
   case when r.source_sheet='Solicitud Cambio ahorro' then lower(btrim(coalesce(r.d->>'E',''))) in ('true','si','sí','aplicado','realizado','1') else true end applied
  from latest r where r.source_sheet<>'Ingreso ahorro'
   and lower(btrim(coalesce(r.d->>'A',r.source_folio,''))) not in ('folio','numero de control','número de control')
   and not exists(select 1 from public.savings_requests q where q.metadata->>'source_record_id'=r.id::text)
 ), canonical as materialized (
  select 'request:'||q.id id,case when q.request_type='JOIN' then 'intake' else 'withdrawal_requested' end kind,
   (q.submitted_at at time zone 'America/Hermosillo')::date occurred_on,'savings_requests'::text source_table,q.id::text source_id,p.legacy_folio numero_control,
   jsonb_build_object('status',q.status,'request_type',q.request_type) detail
  from public.savings_requests q join public.savings_participants p on p.id=q.participant_id
  where q.data_classification='CANONICAL' and q.request_type in ('JOIN','WITHDRAW','EXTRAORDINARY_WITHDRAWAL')
  union all
  select 'paid:'||q.id,'withdrawal_paid',(q.settled_at at time zone 'America/Hermosillo')::date,'savings_requests',q.id::text,p.legacy_folio,
   jsonb_build_object('status',q.status,'capital',q.requested_capital_amount,'yield',q.requested_yield_amount)
  from public.savings_requests q join public.savings_participants p on p.id=q.participant_id
  where q.data_classification='CANONICAL' and q.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL') and q.status='SETTLED'
  union all
  select 'change:'||cp.id,'contribution_changed',cp.effective_from,'savings_contribution_plans',cp.id::text,p.legacy_folio,
   jsonb_build_object('request_id',q.id,'amount',cp.amount,'process',cp.process_snapshot)
  from public.savings_contribution_plans cp join public.savings_requests q on q.id=cp.source_request_id and q.request_type='CHANGE_AMOUNT'
  join public.savings_enrollments e on e.id=cp.enrollment_id join public.savings_participants p on p.id=e.participant_id
  where cp.data_classification='CANONICAL' and q.status='APPROVED' and cp.effective_from<=public.savings_operation_today()
  union all
  select 'termination:'||e.id,'cancellation',(e.terminated_at at time zone 'America/Hermosillo')::date,'savings_enrollments',e.id::text,p.legacy_folio,
   jsonb_build_object('status',e.status,'process',e.process_snapshot)
  from public.savings_enrollments e join public.savings_participants p on p.id=e.participant_id
  where e.data_classification='CANONICAL' and e.terminated_at is not null and (e.terminated_at at time zone 'America/Hermosillo')::date<=public.savings_operation_today()
  union all
  select 'refund:'||c.id,'refund_paid',(c.paid_at at time zone 'America/Hermosillo')::date,'savings_refunds_private.cases',c.id::text,c.numero_control,
   jsonb_build_object('folio',c.folio,'amount',c.authorized_amount,'processes',ep.processes,'payroll_code',ep.payroll_code,'payroll_evidence',ep.evidence)
  from savings_refunds_private.cases c left join lateral(
   select jsonb_agg(distinct mapped.process) processes,
    case when count(*)=count(mapped.code) and count(distinct mapped.code)=1 and not bool_or(mapped.conflict) then min(mapped.code) end payroll_code,
    jsonb_agg(jsonb_build_object('deduction_id',d.id,'source',case when origin.code is not null then 'CANONICAL' when evidence.code is not null and c.origin='HISTORICAL' then 'HISTORICAL_ATTESTATION' else 'UNRESOLVED' end,
     'canonical_code',origin.code,'historical_code',evidence.code,'reference',evidence.reference,'version',evidence.version,'conflict',mapped.conflict) order by d.deduction_on,d.id) evidence
   from savings_refunds_private.deductions d
   cross join lateral(select savings_refunds_private.payroll_source(c.participant_id,d.deduction_on) value) source
   cross join lateral(select source.value->>'process' process,(source.value->>'code')::integer code)origin
   cross join lateral(select savings_refunds_private.payroll_evidence(d.id) value)ev
   cross join lateral(select (ev.value->>'historical_payroll_code')::integer code,ev.value->>'historical_payroll_reference' reference,(ev.value->>'version')::integer version)evidence
   cross join lateral(select origin.process,coalesce(origin.code,case when c.origin='HISTORICAL' then evidence.code end) code,
    origin.code is not null and evidence.code is not null and origin.code<>evidence.code conflict)mapped
   where d.case_id=c.id)ep on true where c.status='PAID'
 ), received as materialized (
  select 'discount:'||h.id id,'payroll_discount'::text kind,h.date occurred_on,h.source source_table,h.id source_id,p.legacy_folio numero_control,
   jsonb_build_object('amount',h.amount,'process',coalesce(plan.process_snapshot,cert.process),
    'payroll_code',case when coalesce(plan.process_snapshot,cert.process)='JUB' then 580 when coalesce(plan.process_snapshot,cert.process) in ('1','3','PROCESS_1','PROCESS_3') then 573 end,
    'phase','RECORDED','includes_yield',h.includes_yield,'status',h.status,'data_conflict',h.data_conflict) detail,
   h.amount,h.status,h.data_conflict
  from public.savings_participants p cross join lateral public.savings_workspace_history(p.id) h
  left join lateral(select cp.process_snapshot from public.savings_contribution_plans cp join public.savings_enrollments e on e.id=cp.enrollment_id
   where e.participant_id=p.id and cp.data_classification='CANONICAL' and cp.effective_from<=h.date and (cp.effective_to is null or cp.effective_to>=h.date)
   order by cp.effective_from desc,e.sequence_number desc limit 1)plan on true
  left join lateral(select coalesce(c.command->>'process',c.source_snapshot#>>'{proposal,D}',c.source_snapshot#>>'{source,D}') process from public.savings_balance_certifications c where c.participant_id=p.id)cert on true
  where p.data_classification='CANONICAL' and h.date between first_day and last_day and h.date<=public.savings_operation_today()
 ), scheduled as materialized (
  select 'schedule:'||e.id||':'||s.contribution_date id,'payroll_discount'::text kind,s.contribution_date occurred_on,'savings_contribution_plans'::text source_table,s.plan_id::text source_id,p.legacy_folio numero_control,
   jsonb_build_object('amount',v.instruction->'scheduled_amount','process',s.process_snapshot,
    'payroll_code',case when s.process_snapshot='JUB' then 580 when s.process_snapshot in ('PROCESS_1','PROCESS_3') then 573 end,
    'phase','SCHEDULED','instruction',v.instruction) detail,
   (v.instruction->>'scheduled_amount')::numeric amount
  from public.savings_enrollments e join public.savings_participants p on p.id=e.participant_id
  cross join lateral public.generate_savings_schedule(e.id,first_day,last_day)s
  cross join lateral(select savings_automatic_private.scheduled(e.id,s.contribution_date) instruction)v
  where e.data_classification='CANONICAL' and e.status not in ('REQUESTED','REJECTED') and s.contribution_date>public.savings_operation_today()
 ), events as materialized (
  select id,kind,occurred_on,source_table,source_id,numero_control,detail from canonical
  union all select id,kind,occurred_on,source_table,source_id,numero_control,detail from historical where applied and nullif(numero_control,'') is not null
  union all select 'historical-paid:'||id,'withdrawal_paid',occurred_on,source_table,source_id,numero_control,
   detail||jsonb_build_object('date_semantics','Fecha de retiro','completion_evidence','Estado Completado')
   from historical where kind='withdrawal_requested' and lower(btrim(detail->>'state'))='completado' and nullif(numero_control,'') is not null
  union all select id,kind,occurred_on,source_table,source_id,numero_control,detail from received where amount>0
  union all select id,kind,occurred_on,source_table,source_id,numero_control,detail from scheduled where amount>0
 ), issues as (
  select 'MISSING_EVENT_DATE' code,count(*) count,jsonb_build_object('metric',kind,'severity','blocking') detail from events where occurred_on is null group by kind
  union all select 'HISTORICAL_WITHDRAWAL_NOT_COMPLETED',count(*),jsonb_build_object('metric','withdrawal_paid','severity','warning') from historical where kind='withdrawal_requested' and lower(btrim(coalesce(detail->>'state','')))<>'completado' and occurred_on between first_day and last_day having count(*)>0
  union all select 'HISTORICAL_CHANGE_NOT_MARKED_APPLIED',count(*),jsonb_build_object('metric','contribution_changed','severity','warning') from historical where kind='contribution_changed' and not applied and occurred_on between first_day and last_day having count(*)>0
  union all select 'PAYROLL_AMOUNT_NOT_RECORDED',count(*),jsonb_build_object('metric','payroll_discount','severity','blocking','months',jsonb_agg(distinct extract(month from occurred_on)::integer),'sourceIds',jsonb_agg(source_id)) from received where amount is null having count(*)>0
  union all select 'PAYROLL_SCHEDULE_UNRESOLVED',count(*),jsonb_build_object('metric','payroll_discount','severity','blocking','months',jsonb_agg(distinct extract(month from occurred_on)::integer),'sourceIds',jsonb_agg(source_id)) from scheduled where amount is null having count(*)>0
  union all select 'PAYROLL_PROCESS_UNRESOLVED',count(*),jsonb_build_object('metric','payroll_discount','severity','blocking','months',jsonb_agg(distinct extract(month from occurred_on)::integer),'sourceIds',jsonb_agg(source_id)) from events where kind='payroll_discount' and detail->>'payroll_code' is null having count(*)>0
  union all select 'REFUND_PAYROLL_PROCESS_UNRESOLVED',count(*),jsonb_build_object('metric','refund_paid','severity','blocking','months',jsonb_agg(distinct extract(month from occurred_on)::integer),'sourceIds',jsonb_agg(source_id)) from canonical where kind='refund_paid' and occurred_on between first_day and last_day and detail->>'payroll_code' is null having count(*)>0
  union all select 'REFUND_PERIOD_UNCONFIRMED',count(*),jsonb_build_object('metric','refund_paid','severity','blocking','months',jsonb_agg(extract(month from m.day)::integer),'note','Confirmar que todos los reembolsos concluidos de este mes están registrados.')
   from generate_series(first_day::timestamp,last_day::timestamp,interval '1 month')m(day)
   where m.day::date<date_trunc('month',public.savings_operation_today())::date and not exists(select 1 from savings_refunds_private.reporting_periods p where p.period=m.day::date and p.invalidated_at is null) having count(*)>0
  union all select 'HISTORICAL_IDENTITY_MISSING',count(*),jsonb_build_object('severity','blocking') from historical where nullif(numero_control,'') is null and occurred_on between first_day and last_day having count(*)>0
  union all select 'HISTORICAL_TERMINATION_UNMAPPED',count(*),jsonb_build_object('metric','cancellation','columns',jsonb_build_array('G','H'),'severity','blocking',
   'months',to_jsonb(array(select generate_series(1,case when p_year=extract(year from public.savings_operation_today()) then extract(month from public.savings_operation_today())::integer else 12 end))),
   'sourceIds',jsonb_agg(r.id),'note','Estado Terminado sin vínculo explícito a una baja canónica; Fecha de finalización no se infiere como fecha efectiva.')
   from latest r where r.source_sheet='Solicitud de Ahorro' and lower(btrim(r.d->>'G'))='terminado'
   and p_year<=extract(year from public.savings_operation_today()) and (public.savings_panel_date(r.d->>'B') is null or public.savings_panel_date(r.d->>'B')<=last_day)
   and not exists(select 1 from public.savings_enrollments e join public.savings_requests q on q.enrollment_id=e.id
    where q.metadata->>'source_record_id'=r.id::text and e.data_classification='CANONICAL' and e.terminated_at is not null) having count(*)>0
 )
 select jsonb_build_object('year',p_year,'events',coalesce((select jsonb_agg(to_jsonb(e) order by occurred_on,kind,id) from events e where occurred_on between first_day and last_day),'[]'),
  'issues',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('severity',i.detail->>'severity','scope',case when i.code like 'PAYROLL_%' then 'payroll' when i.code like 'REFUND_%' then 'refund' else 'savings' end,'months',coalesce(i.detail->'months','[]'::jsonb),'sourceIds',coalesce(i.detail->'sourceIds','[]'::jsonb))) from issues i),'[]'),
  'coverage',jsonb_build_object('historical_representation','savings_review_records latest complete authoritative batch; no per-sheet fallback; raw evidence excluded',
   'import_batch',jsonb_build_object('id',source_batch.id,'source_name',source_batch.source_name,'observed_at',source_batch.observed_at,'expected_records',source_batch.expected_records,'record_count',source_count,'archived_record_count',archived_source_count,'accounted_record_count',source_count+archived_source_count,'archive_usage','COMPLETENESS_ONLY_NO_EVENT_FALLBACK'),
   'historical_withdrawal_paid','Fecha de retiro D, Estado Completado H','historical_refunds','NO_IMPLICIT_BACKFILL','refund_rule','ONE_CASE_ON_FULL_PAYMENT_DATE',
   'intake_reference_only',(select count(*) from latest where source_sheet='Ingreso ahorro'),
   'refund_periods',coalesce((select jsonb_agg(to_jsonb(p) order by p.period) from savings_refunds_private.reporting_periods p where extract(year from p.period)=p_year),'[]'),
   'refund_current_month','Registered to date; not a closed accounting period',
   'payroll_source','savings_workspace_history and dated future schedule','timezone','America/Hermosillo','unpaginated',true)) into result;
 return result;
end $$;
revoke all on function public.get_admin_reports_jc_savings(integer) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_reports_jc_savings(integer) to authenticated;
commit;
