begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Audited production baseline (2026-10-03): abort before capturing or mutating
-- any object. Role names and effective ACLs are portable; OIDs are not.
do $$ declare expected record; actual record;begin
 for expected in select * from (values
  ('public.admin_save_savings_operation(jsonb,uuid)','d1016223a7e816ea7902d0da40282be4','{postgres=X/postgres,authenticated=X/postgres}'),
  ('public.savings_canonical_user_projection(uuid)','2afe16124983e6b74b4c6a0950b3eada','{postgres=X/postgres}')
 ) audited(signature,definition_md5,acl) loop
  select md5(pg_get_functiondef(p.oid)) definition_md5,pg_get_userbyid(p.proowner) owner_name,p.proacl
   into actual from pg_proc p where p.oid=to_regprocedure(expected.signature);
  if not found or actual.definition_md5 is distinct from expected.definition_md5 or actual.owner_name is distinct from 'postgres'
   or not(coalesce(actual.proacl,'{}'::aclitem[]) @> expected.acl::aclitem[] and coalesce(actual.proacl,'{}'::aclitem[]) <@ expected.acl::aclitem[])
  then raise exception 'SAVINGS_PERIOD_INSTALL_BASELINE_DRIFT: %',expected.signature;end if;
 end loop;
end $$;
-- Classification metadata only. The existing ledger remains the sole money writer.
create schema savings_period_private;
revoke all on schema savings_period_private from public,anon,authenticated,service_role;

create table savings_period_private.function_backup(
 signature text primary key, definition text not null, installed_definition text,
 original_acl aclitem[], original_owner text not null
);
insert into savings_period_private.function_backup(signature,definition,original_acl,original_owner)
 select oid::regprocedure::text,pg_get_functiondef(oid),proacl,pg_get_userbyid(proowner)
 from pg_proc where oid in ('public.admin_save_savings_operation(jsonb,uuid)'::regprocedure,
 'public.savings_canonical_user_projection(uuid)'::regprocedure);

create table savings_period_private.attribution_events(
 id uuid primary key default extensions.gen_random_uuid(),
 transaction_id uuid not null unique references public.savings_transactions(id) on delete restrict,
 participant_id uuid not null references public.savings_participants(id) on delete restrict,
 kind text not null check(kind in ('OPENING','WITHDRAWAL')),
 actor_real_auth_user_id uuid not null references auth.users(id) on delete restrict,
 usuario_contexto_affiliate_id uuid references public.affiliates(id) on delete restrict,
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 client_action_id uuid not null unique, command jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table savings_period_private.attribution_slices(
 event_id uuid not null references savings_period_private.attribution_events(id) on delete restrict,
 origin_key text not null check(origin_key='OPENING' or origin_key ~ '^[12][0-9]{3}(-S[12])?$'),
 amount numeric(14,2) not null check(amount>0),
 primary key(event_id,origin_key)
);
create index savings_period_attributions_participant on savings_period_private.attribution_events(participant_id);
create trigger savings_period_events_immutable before update or delete on savings_period_private.attribution_events
 for each row execute function public.reject_savings_history_mutation();
create trigger savings_period_slices_immutable before update or delete on savings_period_private.attribution_slices
 for each row execute function public.reject_savings_history_mutation();
alter table savings_period_private.function_backup enable row level security;
alter table savings_period_private.function_backup force row level security;
alter table savings_period_private.attribution_events enable row level security;
alter table savings_period_private.attribution_events force row level security;
alter table savings_period_private.attribution_slices enable row level security;
alter table savings_period_private.attribution_slices force row level security;
revoke all on all tables in schema savings_period_private from public,anon,authenticated,service_role;

-- Exact captured bodies retain all pre-existing authorization and finance rules.
do $$ declare definition text; begin
 select b.definition into strict definition from savings_period_private.function_backup b where b.signature='admin_save_savings_operation(jsonb,uuid)';
 execute replace(definition,'FUNCTION public.admin_save_savings_operation(', 'FUNCTION savings_period_private.operation_before(');
 select b.definition into strict definition from savings_period_private.function_backup b where b.signature='savings_canonical_user_projection(uuid)';
 execute replace(definition,'FUNCTION public.savings_canonical_user_projection(', 'FUNCTION savings_period_private.projection_before(');
end $$;

create function savings_period_private.resolve_origin(p_transaction_id uuid,p_as_of date,p_path uuid[] default array[]::uuid[])
returns table(origin_key text,amount numeric,economic_type text)
language plpgsql stable security definer set search_path='' as $$
declare t public.savings_transactions%rowtype; original public.savings_transactions%rowtype;
 source_rows jsonb; source_row jsonb; resolved_key text; reversed numeric;
begin
 select * into t from public.savings_transactions where id=p_transaction_id and data_classification='CANONICAL' and effective_date<=p_as_of;
 if t.id is null then return;end if;
 if t.id=any(p_path) or cardinality(p_path)>100 then
  return query select 'UNALLOCATED_REVERSAL'::text,t.amount::numeric,t.transaction_type;return;
 end if;
 if exists(select 1 from savings_period_private.attribution_events e where e.transaction_id=t.id) then
  return query select s.origin_key,s.amount::numeric,t.transaction_type from savings_period_private.attribution_events e
   join savings_period_private.attribution_slices s on s.event_id=e.id where e.transaction_id=t.id;
  return;
 end if;
 if t.transaction_type='REVERSAL' then
  select * into original from public.savings_transactions where id=t.reversal_of_transaction_id and data_classification='CANONICAL';
  select coalesce(sum(r.amount),0) into reversed from public.savings_transactions r where r.reversal_of_transaction_id=original.id
   and r.transaction_type='REVERSAL' and r.data_classification='CANONICAL' and r.effective_date<=p_as_of;
  if original.id is null or original.participant_id<>t.participant_id or original.component<>t.component
   or original.direction=t.direction or original.effective_date>t.effective_date or reversed>original.amount then
   return query select 'UNALLOCATED_REVERSAL'::text,t.amount::numeric,'REVERSAL'::text;return;
  end if;
  select jsonb_agg(to_jsonb(o)) into source_rows from savings_period_private.resolve_origin(original.id,p_as_of,p_path||t.id)o;
  if source_rows is null or exists(select 1 from jsonb_array_elements(source_rows)r where r->>'origin_key' like 'UNALLOCATED_%')
   or (t.amount<>original.amount and jsonb_array_length(source_rows)<>1) then
   return query select 'UNALLOCATED_REVERSAL'::text,t.amount::numeric,'REVERSAL'::text;return;
  end if;
  for source_row in select v from jsonb_array_elements(source_rows)v loop
   return query select source_row->>'origin_key',case when t.amount=original.amount then (source_row->>'amount')::numeric else t.amount end,source_row->>'economic_type';
  end loop;
  return;
 end if;
 if t.component='CAPITAL' and t.contribution_date is not null and
  (t.transaction_type='CONTRIBUTION' or (t.transaction_type='ADJUSTMENT' and t.enrollment_id is not null and exists(
   select 1 from public.savings_transactions c where c.participant_id=t.participant_id and c.enrollment_id=t.enrollment_id
    and c.component='CAPITAL' and c.transaction_type='CONTRIBUTION' and c.data_classification='CANONICAL'
    and c.contribution_date=t.contribution_date and c.effective_date<=t.effective_date))) then
  resolved_key:=extract(year from t.contribution_date)::integer::text||'-S'||case when extract(month from t.contribution_date)<=6 then '1' else '2' end;
 elsif t.transaction_type='YIELD_CREDIT' and t.component='YIELD' and t.direction='CREDIT' then
  select yp.period_year::text||'-S'||yp.semester::text into resolved_key from public.savings_yield_allocations a
   join public.savings_yield_periods yp on yp.id=a.yield_period_id where a.participant_id=t.participant_id and a.status='CREDITED'
    and a.approved_amount=t.amount and t.idempotency_key='PERIOD_YIELD:'||yp.id||':'||t.participant_id;
 end if;
 resolved_key:=coalesce(resolved_key,case when t.transaction_type='WITHDRAWAL' and t.direction='DEBIT' then 'UNALLOCATED_WITHDRAWAL'
  when t.direction='DEBIT' then 'UNALLOCATED_ADJUSTMENT' when t.transaction_type='REGULARIZATION' then 'OPENING' else 'UNALLOCATED_CREDIT' end);
 return query select resolved_key,t.amount::numeric,t.transaction_type;
end $$;

create function savings_period_private.origins(p_participant_id uuid,p_as_of date)
returns table(transaction_id uuid,component text,transaction_type text,direction text,effective_date date,origin_key text,amount numeric,economic_type text)
language sql stable security definer set search_path='' as $$
 select t.id,t.component,t.transaction_type,t.direction,t.effective_date,o.origin_key,o.amount,o.economic_type
 from public.savings_transactions t cross join lateral savings_period_private.resolve_origin(t.id,p_as_of)o
 where t.participant_id=p_participant_id and t.data_classification='CANONICAL' and t.effective_date<=p_as_of
$$;

create function savings_period_private.composition(p_participant_id uuid,p_as_of date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.savings_participants%rowtype; as_of date:=coalesce(p_as_of,public.savings_operation_today());
 rows jsonb; movements jsonb; bal jsonb; version text; unresolved jsonb; historical_balance jsonb; supported_from date; as_of_complete boolean;
begin
 select * into p from public.savings_participants where id=p_participant_id;
 if p.id is null or p.identity_status<>'RESOLVED' or p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL'
  or not exists(select 1 from public.affiliates a where a.id=p.affiliate_id and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))
  or (select count(*) from public.affiliates a where a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false))<>1
 then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';end if;
 if as_of>public.savings_operation_today() then raise exception 'SAVINGS_PERIOD_FUTURE_CUTOFF';end if;
 if exists(select 1 from public.savings_transactions t where t.participant_id=p.id and
  (t.data_classification<>'CANONICAL' or t.effective_date>public.savings_operation_today())) then raise exception 'SAVINGS_NONCANONICAL_MOVEMENTS';end if;
 select to_jsonb(b) into bal from public.savings_participant_balance(p.id)b;
 if (bal->>'capital')::numeric<0 or (bal->>'yield_amount')::numeric<0 then raise exception 'SAVINGS_NEGATIVE_COMPONENT';end if;
 select coalesce((select c.cutoff_on from public.savings_balance_certifications c where c.participant_id=p.id),
  (select min(t.effective_date) from public.savings_transactions t where t.participant_id=p.id and t.transaction_type='REGULARIZATION'),
  (select min((e.enrollment_started_at at time zone 'America/Hermosillo')::date) from public.savings_enrollments e where e.participant_id=p.id and e.data_classification='CANONICAL')) into supported_from;
 as_of_complete:=supported_from is not null and as_of>=supported_from;
 with resolved as materialized(select * from savings_period_private.origins(p.id,as_of)),
 amounts as(select o.origin_key,o.component,
  sum(o.amount) filter(where o.direction='CREDIT' and o.economic_type<>'WITHDRAWAL') recognized,
  sum(case when o.direction='DEBIT' then o.amount else -o.amount end) filter(where o.economic_type='WITHDRAWAL') withdrawn,
  sum(o.amount) filter(where o.direction='DEBIT' and o.economic_type<>'WITHDRAWAL') adjustments,
  sum(case o.direction when 'CREDIT' then o.amount else -o.amount end) remainder
  from resolved o group by o.origin_key,o.component),
 -- Unknown credits never prove which previously recognized origin paid an
 -- unknown debit. Keep debit uncertainty independent of unidentified inflows.
 pending as(select component,sum(amount) amount from resolved
  where origin_key like 'UNALLOCATED_%' and (direction='DEBIT' or origin_key='UNALLOCATED_REVERSAL') group by component)
 select coalesce(jsonb_agg(jsonb_build_object('origin_key',a.origin_key,'component',a.component,
  'period_year',case when a.origin_key ~ '^[12][0-9]{3}' then left(a.origin_key,4)::integer end,
  'semester',case when a.origin_key ~ '-S[12]$' then right(a.origin_key,1)::integer end,
  'recognized',coalesce(a.recognized,0),'withdrawn',coalesce(a.withdrawn,0),'adjustments',coalesce(a.adjustments,0),
  'remaining_before_unallocated',a.remainder,'remaining',case when coalesce(u.amount,0)>0 then null else a.remainder end,
  'origin_state',case when a.origin_key='OPENING' then 'OPENING_UNALLOCATED' when a.origin_key like 'UNALLOCATED_%' then 'REQUIRES_ALLOCATION' else 'CLASSIFIED' end)
  order by a.origin_key,a.component),'[]') into rows from amounts a left join pending u using(component);
 select coalesce(jsonb_agg(jsonb_build_object('transaction_id',t.id,'component',t.component,'type',t.transaction_type,
  'effective_date',t.effective_date,'amount',t.amount,'direction',t.direction,
  'can_classify',not exists(select 1 from savings_period_private.attribution_events e where e.transaction_id=t.id)
   and ((t.transaction_type='REGULARIZATION' and t.direction='CREDIT') or (t.transaction_type='WITHDRAWAL' and t.direction='DEBIT')),
  'origins',(select jsonb_agg(jsonb_build_object('origin_key',o.origin_key,'amount',o.amount) order by o.origin_key)
   from savings_period_private.origins(p.id,as_of)o where o.transaction_id=t.id)) order by t.effective_date,t.id),'[]') into movements
 from public.savings_transactions t where t.participant_id=p.id and t.effective_date<=as_of;
 select jsonb_build_object('capital',coalesce(sum(case when t.component='CAPITAL' then case t.direction when 'CREDIT' then t.amount else -t.amount end end),0),
  'yield_amount',coalesce(sum(case when t.component='YIELD' then case t.direction when 'CREDIT' then t.amount else -t.amount end end),0),
  'total',coalesce(sum(case t.direction when 'CREDIT' then t.amount else -t.amount end),0))
 into historical_balance from public.savings_transactions t where t.participant_id=p.id and t.effective_date<=as_of;
 if not as_of_complete then historical_balance:=jsonb_build_object('capital',null,'yield_amount',null,'total',null);end if;
 select coalesce(jsonb_agg(v),'[]') into unresolved from jsonb_array_elements(rows)v where v->>'origin_state'='REQUIRES_ALLOCATION';
 version:=md5(jsonb_build_array(p,as_of,bal,rows,movements)::text);
 return jsonb_build_object('schema_version','SAVINGS_PERIOD_COMPOSITION_V1','participant_id',p.id,'folio',p.legacy_folio,
  'as_of',as_of,'version',version,'balances',bal,'as_of_balance',historical_balance,'as_of_complete',as_of_complete,'as_of_supported_from',supported_from,'periods',rows,'movements',movements,
  'unresolved',unresolved,'complete',jsonb_array_length(unresolved)=0,
  'historical_note','La apertura sin periodo comprobado no se suma nuevamente. El disponible se valida por componente; las retenciones no se distribuyen entre periodos.');
end $$;

create function public.get_admin_savings_period_composition(p_participant_id uuid,p_as_of date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501';end if;
 return savings_period_private.composition(p_participant_id,p_as_of)||jsonb_build_object('can_attribute',public.has_admin_permission('savings.approve'));
end $$;

-- One attribution per existing movement; corrections must be explicit future work,
-- never UPDATE/DELETE of a decision or a second debit.
create function savings_period_private.attribute(p_transaction_id uuid,p_slices jsonb,p_version text,p_reason text,p_key uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.savings_transactions%rowtype; prior savings_period_private.attribution_events%rowtype;
 report jsonb; item jsonb; total numeric:=0; value numeric; key text; available_amount numeric; available_then numeric; event_id uuid;
 command jsonb:=jsonb_build_object('transaction_id',p_transaction_id,'slices',p_slices,'version',p_version,'reason',p_reason,'kind',p_kind);
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501';end if;
 if p_key is null or p_version is null or jsonb_typeof(p_slices) is distinct from 'array' or jsonb_array_length(p_slices)=0
  or jsonb_array_length(p_slices)>100 or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'SAVINGS_PERIOD_COMMAND_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-period-attribution:'||p_key,0));
 select * into prior from savings_period_private.attribution_events where client_action_id=p_key;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.command is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('event_id',prior.id,'transaction_id',prior.transaction_id,'attributed',true);
 end if;
 select * into t from public.savings_transactions where id=p_transaction_id;
 if t.id is null or t.data_classification<>'CANONICAL' or
  not ((p_kind='OPENING' and t.transaction_type='REGULARIZATION' and t.direction='CREDIT')
   or (p_kind='WITHDRAWAL' and t.transaction_type='WITHDRAWAL' and t.direction='DEBIT')) then raise exception 'SAVINGS_PERIOD_TRANSACTION_INVALID';end if;
 perform public.savings_runtime_assert_identity(t.participant_id);
 if exists(select 1 from savings_period_private.attribution_events where transaction_id=t.id) then raise exception 'SAVINGS_PERIOD_ALREADY_CLASSIFIED';end if;
 report:=savings_period_private.composition(t.participant_id,null);
 if report->>'version' is distinct from p_version then raise exception 'SAVINGS_PERIOD_VERSION_CHANGED';end if;
 if p_kind='OPENING' and exists(select 1 from savings_period_private.attribution_events e
  join public.savings_transactions other on other.id=e.transaction_id
  join savings_period_private.attribution_slices s on s.event_id=e.id
  where e.participant_id=t.participant_id and e.kind='WITHDRAWAL' and other.component=t.component and s.origin_key='OPENING')
 then raise exception 'SAVINGS_OPENING_ALREADY_USED';end if;
 for item in select v from jsonb_array_elements(p_slices)v loop
  key:=item->>'origin_key';
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'amount') is distinct from 'number'
   or key is null or not(key='OPENING' or key ~ '^[12][0-9]{3}(-S[12])?$') then raise exception 'SAVINGS_PERIOD_SLICE_INVALID';end if;
  value:=(item->>'amount')::numeric;
  if value<=0 or value>999999999999.99 or value<>round(value,2) then raise exception 'SAVINGS_PERIOD_SLICE_INVALID';end if;
  if p_kind='OPENING' and key='OPENING' then raise exception 'SAVINGS_OPENING_COMPLETE_CLASSIFICATION_REQUIRED';end if;
  if key<>'OPENING' and (left(key,4)::integer>extract(year from t.effective_date)
   or (length(key)=7 and make_date(left(key,4)::integer,(right(key,1)::integer-1)*6+1,1)>t.effective_date)) then raise exception 'SAVINGS_PERIOD_FUTURE_ORIGIN';end if;
  if (select count(*) from jsonb_array_elements(p_slices)v where v->>'origin_key'=key)<>1 then raise exception 'SAVINGS_PERIOD_DUPLICATE_ORIGIN';end if;
  if p_kind='WITHDRAWAL' then
   select (v->>'remaining_before_unallocated')::numeric into available_amount from jsonb_array_elements(report->'periods')v
    where v->>'origin_key'=key and v->>'component'=t.component;
   if available_amount is null or available_amount<value then raise exception 'SAVINGS_PERIOD_ORIGIN_EXCEEDED';end if;
   select coalesce(sum(case o.direction when 'CREDIT' then o.amount else -o.amount end),0) into available_then
    from savings_period_private.origins(t.participant_id,t.effective_date)o where o.origin_key=key and o.component=t.component;
   if available_then<value then raise exception 'SAVINGS_PERIOD_ORIGIN_NOT_AVAILABLE_AT_PAYMENT';end if;
  end if;
  total:=total+value;
 end loop;
 if total<>t.amount then raise exception 'SAVINGS_PERIOD_BREAKDOWN_MISMATCH';end if;
 insert into savings_period_private.attribution_events(transaction_id,participant_id,kind,actor_real_auth_user_id,usuario_contexto_affiliate_id,reason,client_action_id,command)
 values(t.id,t.participant_id,p_kind,auth.uid(),public.get_effective_affiliate_id(),btrim(p_reason),p_key,command) returning id into event_id;
 insert into savings_period_private.attribution_slices(event_id,origin_key,amount)
 select event_id,v->>'origin_key',(v->>'amount')::numeric from jsonb_array_elements(p_slices)v;
 return jsonb_build_object('event_id',event_id,'transaction_id',t.id,'attributed',true);
end $$;

create function public.admin_attribute_savings_opening(p_transaction_id uuid,p_slices jsonb,p_version text,p_reason text,p_key uuid)
returns jsonb language sql security definer set search_path='' as $$
 select savings_period_private.attribute(p_transaction_id,p_slices,p_version,p_reason,p_key,'OPENING')
$$;
create function public.admin_attribute_savings_withdrawal(p_transaction_id uuid,p_slices jsonb,p_version text,p_reason text,p_key uuid)
returns jsonb language sql security definer set search_path='' as $$
 select savings_period_private.attribute(p_transaction_id,p_slices,p_version,p_reason,p_key,'WITHDRAWAL')
$$;

create or replace function public.admin_save_savings_operation(p_command jsonb,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; participant uuid; report jsonb; tx public.savings_transactions%rowtype;
 prior public.savings_audit_events%rowtype; slices jsonb; total numeric; requested numeric; item jsonb; comp text;
begin
 if p_command->>'kind' is distinct from 'SETTLE' or not(p_command ? 'origin_allocations') then
  return savings_period_private.operation_before(p_command,p_client_action_id);
 end if;
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501';end if;
 if p_client_action_id is null or jsonb_typeof(p_command->'origin_allocations') is distinct from 'array'
  or jsonb_array_length(p_command->'origin_allocations')>100 then raise exception 'SAVINGS_PERIOD_COMMAND_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-runtime:'||p_client_action_id,0));
 select * into prior from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then return savings_period_private.operation_before(p_command,p_client_action_id);end if;
 select participant_id into participant from public.savings_requests where id=(p_command->>'request_id')::uuid;
 perform public.savings_runtime_assert_identity(participant);
 report:=savings_period_private.composition(participant,null);
 if report->>'version' is distinct from p_command->>'allocation_version' then raise exception 'SAVINGS_PERIOD_VERSION_CHANGED';end if;
 for item in select v from jsonb_array_elements(p_command->'origin_allocations')v loop
  if jsonb_typeof(item) is distinct from 'object' or item->>'component' not in ('CAPITAL','YIELD') or item->>'component' is null
   or jsonb_typeof(item->'amount') is distinct from 'number' then raise exception 'SAVINGS_PERIOD_SLICE_INVALID';end if;
 end loop;
 foreach comp in array array['CAPITAL','YIELD'] loop
  if jsonb_typeof(p_command->case comp when 'CAPITAL' then 'capital' else 'yield' end) is distinct from 'number' then raise exception 'SAVINGS_SETTLEMENT_INVALID';end if;
  requested:=(p_command->>case comp when 'CAPITAL' then 'capital' else 'yield' end)::numeric;
  select coalesce(sum((v->>'amount')::numeric),0) into total from jsonb_array_elements(p_command->'origin_allocations')v where v->>'component'=comp;
  if total<>requested then raise exception 'SAVINGS_PERIOD_BREAKDOWN_MISMATCH';end if;
 end loop;
 -- Original writer establishes payout evidence, request state and ledger debits.
 result:=savings_period_private.operation_before(p_command,p_client_action_id);
 for tx in select t.* from public.savings_transactions t where t.participant_id=participant
  and t.transaction_type='WITHDRAWAL' and t.idempotency_key='SAVINGS_RUNTIME_PAYMENT:'||(p_command->>'request_id')||':'||t.component loop
  select jsonb_agg(v-'component') into slices from jsonb_array_elements(p_command->'origin_allocations')v where v->>'component'=tx.component;
  report:=savings_period_private.composition(participant,null);
  perform savings_period_private.attribute(tx.id,slices,report->>'version',coalesce(nullif(btrim(p_command->>'observation'),''),'Desglose confirmado al registrar la entrega'),
   md5(p_client_action_id::text||':ORIGIN:'||tx.component)::uuid,'WITHDRAWAL');
 end loop;
 return result;
end $$;

create or replace function public.savings_canonical_user_projection(p_participant_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; composition jsonb;
begin
 result:=savings_period_private.projection_before(p_participant_id);
 composition:=savings_period_private.composition(p_participant_id,null);
 -- No raw transaction IDs or administrative attribution controls in self DTO.
 return result||jsonb_build_object('period_balances',composition-array['movements','version']);
end $$;

revoke all on all functions in schema savings_period_private from public,anon,authenticated,service_role;
revoke all on function public.get_admin_savings_period_composition(uuid,date),
 public.admin_attribute_savings_opening(uuid,jsonb,text,text,uuid),public.admin_attribute_savings_withdrawal(uuid,jsonb,text,text,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_period_composition(uuid,date),
 public.admin_attribute_savings_opening(uuid,jsonb,text,text,uuid),public.admin_attribute_savings_withdrawal(uuid,jsonb,text,text,uuid) to authenticated;
update savings_period_private.function_backup b set installed_definition=pg_get_functiondef(to_regprocedure('public.'||b.signature));
notify pgrst,'reload schema';
commit;
