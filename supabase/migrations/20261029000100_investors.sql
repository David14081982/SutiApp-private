begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
create schema investors_private;
revoke all on schema investors_private from public,anon,authenticated,service_role;

create table investors_private.investors (
 id uuid primary key default gen_random_uuid(), source_key text unique,
 name text not null check(length(btrim(name)) between 2 and 200), reference text not null default '',
 email text not null default '', phone text not null default '', notes text not null default '', source jsonb,
 version integer not null default 1, created_at timestamptz not null default clock_timestamp()
);
create table investors_private.contracts (
 id uuid primary key default gen_random_uuid(), investor_id uuid not null references investors_private.investors,
 source_key text unique, code text not null check(length(btrim(code)) between 1 and 200),
 starts_on date, ends_on date, months integer check(months between 1 and 600),
 principal numeric(18,2) check(principal>0), monthly_rate numeric(10,7) not null default .025 check(monthly_rate between 0 and 1),
 payment_mode text not null default 'Mensual', payment_method text not null default '',
 status text not null check(status in('historical','active','closed','renewed','review')),
 opening_balance numeric(18,2) check(opening_balance>=0), balance_on date,
 history_complete boolean not null default false,
 parent_id uuid references investors_private.contracts, notes text not null default '',
 source jsonb, version integer not null default 1, created_at timestamptz not null default clock_timestamp(),
 unique(investor_id,code,starts_on), check(status not in('active','closed','renewed') or (starts_on is not null and ends_on>=starts_on and principal is not null and balance_on is not null)),
 check((opening_balance is null)=(balance_on is null)),check(principal<>'NaN'::numeric and opening_balance<>'NaN'::numeric),
 check(isfinite(starts_on) and isfinite(ends_on) and isfinite(balance_on))
);
create table investors_private.terms (
 id uuid primary key default gen_random_uuid(), contract_id uuid not null references investors_private.contracts,
 effective_on date not null, monthly_rate numeric(10,7) not null check(monthly_rate between 0 and 1),
 actor uuid not null, created_at timestamptz not null default clock_timestamp(), unique(contract_id,effective_on),check(isfinite(effective_on))
);
create table investors_private.obligations (
 id uuid primary key default gen_random_uuid(), contract_id uuid not null references investors_private.contracts,
 period_start date not null, period_end date not null, due_on date not null,
 concept text not null check(concept in('yield','capital','other')),
 amount numeric(18,2) not null check(amount>=0), principal_basis numeric(18,2), rate_snapshot numeric(10,7),
 cancelled boolean not null default false, origin text not null, created_at timestamptz not null default clock_timestamp(),
 check(period_end>period_start), check(isfinite(due_on) and isfinite(period_start) and isfinite(period_end)),check(amount<>'NaN'::numeric)
);
create unique index investors_obligation_current on investors_private.obligations(contract_id,period_start,concept) where not cancelled;
create table investors_private.movements (
 id uuid primary key default gen_random_uuid(), contract_id uuid not null references investors_private.contracts,
 replaces_id uuid unique references investors_private.movements, obligation_id uuid references investors_private.obligations,
 effective_on date not null, concept text not null check(concept in('contribution','withdrawal','yield','adjustment','other')),
 direction text not null check(direction in('in','out')), amount numeric(18,2) not null check(amount>0),
 period_start date, period_end date, payment_method text not null check(length(btrim(payment_method))>0),
 reference text not null default '', notes text not null default '', voided boolean not null default false,
 actor uuid not null, created_at timestamptz not null default clock_timestamp(),
 check(isfinite(effective_on) and isfinite(period_start) and isfinite(period_end)),check(amount<>'NaN'::numeric),check((period_start is null and period_end is null) or (period_start is not null and period_end>=period_start)),
 check(concept<>'yield' or (direction='out' and period_start is not null and period_end is not null)),
 check(concept<>'contribution' or direction='in'),check(concept<>'withdrawal' or direction='out')
);
create index investors_movements_contract on investors_private.movements(contract_id,effective_on);
create table investors_private.documents (
 id uuid primary key default gen_random_uuid(), investor_id uuid not null references investors_private.investors,
 contract_id uuid references investors_private.contracts, movement_id uuid references investors_private.movements,
 replaces_id uuid unique references investors_private.documents, filename text not null, mime text not null,
 content bytea not null check(octet_length(content) between 1 and 5242880), actor uuid not null,
 created_at timestamptz not null default clock_timestamp()
);
create table investors_private.audit (
 id bigint generated always as identity primary key, entity text not null, entity_id uuid not null,
 action text not null, actor_real uuid, usuario_contexto uuid, session_id text,
 reason text not null, before_state jsonb, after_state jsonb, created_at timestamptz not null default clock_timestamp()
);
create table investors_private.actions (
 id uuid primary key, actor uuid not null, payload jsonb not null, result jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create table investors_private.imports (
 sha256 text primary key check(length(sha256)=64), filename text not null, workbook bytea not null,
 manifest jsonb not null, imported_at timestamptz not null default clock_timestamp()
);
create table investors_private.source_rows (
 id uuid primary key default gen_random_uuid(), batch text not null references investors_private.imports,
 sheet text not null, row_number integer not null, cells jsonb not null,
 unique(batch,sheet,row_number)
);
create table investors_private.reviews (
 id uuid primary key default gen_random_uuid(), batch text references investors_private.imports,
 source_key text unique, investor_id uuid references investors_private.investors, contract_id uuid references investors_private.contracts,
 kind text not null, detail jsonb not null, resolved_at timestamptz, resolution text, resolved_by uuid,
 version integer not null default 1
);
do $$ declare t text;begin
 foreach t in array array['investors','contracts','terms','obligations','movements','documents','audit','actions','imports','source_rows','reviews'] loop
 execute format('alter table investors_private.%I enable row level security',t);
 execute format('alter table investors_private.%I force row level security',t);
 execute format('revoke all on investors_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create function investors_private.guard(p_write boolean default false) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.has_admin_permission(case when p_write then 'program_requests.write' else 'program_requests.read' end)
 and public.admin_module_boundary(array['finanzas'],case when p_write then 'write' else 'read' end)) then
 raise exception 'INVESTORS_ACCESS_DENIED' using errcode='42501';end if;
end $$;
create function investors_private.log(p_entity text,p_id uuid,p_action text,p_reason text,p_before jsonb,p_after jsonb) returns void
language sql security definer set search_path='' as $$
 insert into investors_private.audit(entity,entity_id,action,actor_real,usuario_contexto,session_id,reason,before_state,after_state)
 values(p_entity,p_id,p_action,auth.uid(),public.get_effective_affiliate_id(),auth.jwt()->>'session_id',p_reason,p_before,p_after)
$$;
create function investors_private.balance(p_id uuid,p_on date) returns numeric
language sql stable security definer set search_path='' as $$
 select c.opening_balance+coalesce((select sum(case when m.direction='in' then m.amount else -m.amount end)
 from investors_private.movements m where m.contract_id=c.id and m.concept in('contribution','withdrawal','adjustment')
 and m.effective_on between c.balance_on and p_on and not m.voided and not exists(select 1 from investors_private.movements r where r.replaces_id=m.id)),0)
 from investors_private.contracts c where c.id=p_id
$$;
create function investors_private.schedule(p_id uuid,p_from date,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare c investors_private.contracts; d date; e date; due date; n integer:=0; amount numeric; rate numeric; o investors_private.obligations;
begin
 select * into strict c from investors_private.contracts where id=p_id;
 if c.status<>'active' then return;end if;
 -- Only unearned, unpaid periods may be regenerated. Past snapshots survive every rate change.
 for o in select * from investors_private.obligations where contract_id=p_id and not cancelled and period_start>=p_from loop
  if not exists(select 1 from investors_private.movements m where m.obligation_id=o.id and not m.voided and not exists(select 1 from investors_private.movements r where r.replaces_id=m.id)) then
   update investors_private.obligations set cancelled=true where id=o.id;
   perform investors_private.log('obligation',o.id,'RESCHEDULE',p_reason,to_jsonb(o),jsonb_build_object('cancelled',true));
  end if;
 end loop;
 loop
  d:=(c.starts_on+make_interval(months=>n))::date;
  exit when d>=c.ends_on or n>=600;
  e:=least((c.starts_on+make_interval(months=>n+1))::date,c.ends_on);
  n:=n+1;
  if d<p_from then continue;end if;
  if e<>(c.starts_on+make_interval(months=>n))::date then
   -- A partial month has no implicit day-count convention. Operator schedules it explicitly.
   continue;
  end if;
  if exists(select 1 from investors_private.obligations where contract_id=p_id and period_start=d and concept='yield' and not cancelled) then continue;end if;
  select t.monthly_rate into rate from investors_private.terms t where t.contract_id=p_id and t.effective_on<=d order by t.effective_on desc limit 1;
  if rate is null then rate:=c.monthly_rate;end if;
  amount:=investors_private.balance(p_id,d);
  due:=case when c.payment_mode='Al vencimiento' then c.ends_on else e end;
  insert into investors_private.obligations(contract_id,period_start,period_end,due_on,concept,amount,principal_basis,rate_snapshot,origin)
  values(p_id,d,e,due,'yield',round(amount*rate,2),amount,rate,'monthly_simple');
 end loop;
end $$;

create function public.get_admin_investors(p_investor_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; today date:=(clock_timestamp() at time zone 'America/Hermosillo')::date;
begin
 perform investors_private.guard(false);
 select jsonb_build_object(
 'today',today,'can_write',public.has_admin_permission('program_requests.write') and public.admin_module_boundary(array['finanzas'],'write'),
 'investors',coalesce((select jsonb_agg(to_jsonb(i) order by i.name) from investors_private.investors i),'[]'::jsonb),
 'contracts',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('balance',case when c.balance_on<=today then investors_private.balance(c.id,today) else null end,'terms',coalesce((select jsonb_agg(to_jsonb(t) order by effective_on) from investors_private.terms t where t.contract_id=c.id),'[]'::jsonb)) order by c.starts_on desc,c.id) from investors_private.contracts c where p_investor_id is null or c.investor_id=p_investor_id),'[]'::jsonb),
 'movements',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('superseded',exists(select 1 from investors_private.movements r where r.replaces_id=m.id)) order by m.effective_on desc,m.created_at desc) from investors_private.movements m join investors_private.contracts c on c.id=m.contract_id where p_investor_id is null or c.investor_id=p_investor_id),'[]'::jsonb),
 'obligations',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('paid',coalesce((select sum(m.amount) from investors_private.movements m where m.obligation_id=o.id and not m.voided and not exists(select 1 from investors_private.movements r where r.replaces_id=m.id)),0)) order by due_on,period_start) from investors_private.obligations o join investors_private.contracts c on c.id=o.contract_id where not o.cancelled and (p_investor_id is null or c.investor_id=p_investor_id)),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.resolved_at nulls first,r.kind) from investors_private.reviews r where p_investor_id is null or r.investor_id=p_investor_id or r.contract_id in(select id from investors_private.contracts where investor_id=p_investor_id)),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'investor_id',d.investor_id,'contract_id',d.contract_id,'movement_id',d.movement_id,'replaces_id',d.replaces_id,'filename',d.filename,'mime',d.mime,'bytes',octet_length(d.content),'actor',d.actor,'created_at',d.created_at) order by d.created_at desc) from investors_private.documents d where p_investor_id is null or d.investor_id=p_investor_id),'[]'::jsonb),
 'audit',case when p_investor_id is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from investors_private.audit a where a.entity_id=p_investor_id or a.entity_id in(select id from investors_private.contracts where investor_id=p_investor_id) or a.entity_id in(select m.id from investors_private.movements m join investors_private.contracts c on c.id=m.contract_id where c.investor_id=p_investor_id)),'[]'::jsonb) end,
 'imports',coalesce((select jsonb_agg(jsonb_build_object('sha256',sha256,'filename',filename,'manifest',manifest,'imported_at',imported_at)) from investors_private.imports),'[]'::jsonb)
 ) into result;
 return jsonb_build_object('data',result,'context',jsonb_build_object('actor',auth.uid(),'session',auth.jwt()->>'session_id','effective_affiliate',public.get_effective_affiliate_id()));
end $$;

create function public.save_admin_investors(p_action text,p_values jsonb,p_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb:=p_values; old jsonb; result jsonb; target uuid; investor uuid; c investors_private.contracts; m investors_private.movements;
 o investors_private.obligations; prior investors_private.actions; d date; rate numeric; n numeric; balance numeric; minbalance numeric; closing_amount numeric;
 today date:=(clock_timestamp() at time zone 'America/Hermosillo')::date; reason text:=btrim(coalesce(v->>'reason','')); payload jsonb;
begin
 perform investors_private.guard(true);
 if p_action_id is null or length(reason) not between 1 and 2000 or v is null then raise exception 'INVESTORS_REASON_REQUIRED';end if;
 payload:=jsonb_build_object('action',p_action,'values',v);
 perform pg_advisory_xact_lock(hashtextextended(p_action_id::text,0));
 select * into prior from investors_private.actions where id=p_action_id;
 if found then
  if prior.actor<>auth.uid() or prior.payload<>payload then raise exception 'INVESTORS_ACTION_CONFLICT';end if;
  return prior.result;
 end if;
 target:=nullif(v->>'id','')::uuid;
 if p_action='investor' then
  if target is null then
   insert into investors_private.investors(name,reference,email,phone,notes) values(btrim(v->>'name'),coalesce(v->>'reference',''),coalesce(v->>'email',''),coalesce(v->>'phone',''),coalesce(v->>'notes','')) returning id into target;
  else
   select to_jsonb(i) into old from investors_private.investors i where id=target for update;
   if old is null or (old->>'version')::int is distinct from (v->>'version')::int then raise exception 'INVESTORS_VERSION_CHANGED';end if;
   update investors_private.investors set name=btrim(v->>'name'),reference=coalesce(v->>'reference',''),email=coalesce(v->>'email',''),phone=coalesce(v->>'phone',''),notes=coalesce(v->>'notes',''),version=version+1 where id=target;
  end if;
  select to_jsonb(i) into result from investors_private.investors i where id=target;
 elsif p_action in('contract','activate') then
  if p_action='activate' then
   select * into c from investors_private.contracts where id=target for update;
   if not found or c.status not in('historical','review') or c.version is distinct from (v->>'version')::int then raise exception 'INVESTORS_VERSION_CHANGED';end if;
   old:=to_jsonb(c);investor:=c.investor_id;
   if exists(select 1 from investors_private.reviews where contract_id=target and resolved_at is null) then raise exception 'INVESTORS_REVIEW_REQUIRED';end if;
  else
   if target is not null then raise exception 'INVESTORS_USE_TERMS_OR_RENEWAL';end if;
   investor:=(v->>'investor_id')::uuid;
  end if;
  if v->>'payment_mode' is null or v->>'payment_mode' not in('Mensual','Al vencimiento','Manual') or v->>'months' is null or (v->>'months')::int not between 1 and 600 or v->>'starts_on' is null or v->>'ends_on' is null or (v->>'ends_on')::date <= (v->>'starts_on')::date or v->>'principal' is null or (v->>'principal')::numeric<=0 then raise exception 'INVESTORS_CONTRACT_INVALID';end if;
  if p_action='contract' and nullif(v->>'parent_id','') is not null then raise exception 'INVESTORS_USE_RENEWAL';end if;
  d:=coalesce(nullif(v->>'balance_on','')::date,(v->>'starts_on')::date);
  if d<(v->>'starts_on')::date or d>(v->>'ends_on')::date or d>today then raise exception 'INVESTORS_BALANCE_DATE_INVALID';end if;
  if p_action='contract' then
   insert into investors_private.contracts(investor_id,code,starts_on,ends_on,months,principal,monthly_rate,payment_mode,payment_method,status,opening_balance,balance_on,history_complete,notes,parent_id)
   values(investor,btrim(v->>'code'),(v->>'starts_on')::date,(v->>'ends_on')::date,(v->>'months')::int,(v->>'principal')::numeric,coalesce((v->>'monthly_rate')::numeric,.025),v->>'payment_mode',coalesce(v->>'payment_method',''),'active',0,d,true,coalesce(v->>'notes',''),nullif(v->>'parent_id','')::uuid) returning id into target;
   -- Creating a contract records the expressly supplied initial contribution, never an inferred payment.
   insert into investors_private.movements(contract_id,effective_on,concept,direction,amount,payment_method,reference,notes,actor)
   values(target,d,'contribution','in',(v->>'principal')::numeric,coalesce(nullif(v->>'payment_method',''),'No especificado'),coalesce(v->>'reference',''),reason,auth.uid());
  else
   update investors_private.contracts set code=btrim(v->>'code'),starts_on=(v->>'starts_on')::date,ends_on=(v->>'ends_on')::date,months=(v->>'months')::int,principal=(v->>'principal')::numeric,monthly_rate=coalesce((v->>'monthly_rate')::numeric,.025),payment_mode=v->>'payment_mode',payment_method=coalesce(v->>'payment_method',''),status='active',opening_balance=(v->>'opening_balance')::numeric,balance_on=d,history_complete=false,notes=coalesce(v->>'notes',''),version=version+1 where id=target;
  end if;
  select * into c from investors_private.contracts where id=target;
  if c.opening_balance is null then raise exception 'INVESTORS_BALANCE_REQUIRED';end if;
  insert into investors_private.terms(contract_id,effective_on,monthly_rate,actor) values(target,c.starts_on,c.monthly_rate,auth.uid());
  if c.payment_mode<>'Manual' then perform investors_private.schedule(target,d,reason);end if;
  select to_jsonb(x) into result from investors_private.contracts x where id=target;
 elsif p_action in('rate','close','renew','movement','obligation') then
  select * into c from investors_private.contracts where id=(v->>'contract_id')::uuid for update;
  if not found or (c.status<>'active' and not (p_action='movement' and c.status in('closed','renewed') and v->>'concept' in('yield','other'))) then raise exception 'INVESTORS_ACTIVE_CONTRACT_REQUIRED';end if;
  if p_action in('rate','close','renew') and c.version is distinct from (v->>'version')::int then raise exception 'INVESTORS_VERSION_CHANGED';end if;
  old:=to_jsonb(c);
  if p_action='rate' then
   d:=(v->>'effective_on')::date;rate:=(v->>'monthly_rate')::numeric;
   if d is null or d<today or d>=c.ends_on or rate is null then raise exception 'INVESTORS_FUTURE_RATE_REQUIRED';end if;
   insert into investors_private.terms(contract_id,effective_on,monthly_rate,actor) values(c.id,d,rate,auth.uid());
   update investors_private.contracts set version=version+1 where id=c.id;
   if c.payment_mode<>'Manual' then perform investors_private.schedule(c.id,d,reason);end if;
   target:=c.id; result:=jsonb_build_object('id',target,'effective_on',d,'monthly_rate',rate);
  elsif p_action in('close','renew') then
   d:=(v->>'effective_on')::date;
   if d is null or d<>today or d<c.balance_on then raise exception 'INVESTORS_CLOSURE_DATE_INVALID';end if;
   balance:=investors_private.balance(c.id,d);
   if p_action='close' and balance<>0 then raise exception 'INVESTORS_RETURN_CAPITAL_FIRST';end if;
   -- Early termination needs an explicitly agreed amount, never an invented prorating rule.
   for o in select * from investors_private.obligations where contract_id=c.id and concept='yield' and not cancelled and period_start<d and period_end>d loop
    closing_amount:=nullif(v->>'closing_yield','')::numeric;
    if closing_amount is null or closing_amount<0 or closing_amount='NaN'::numeric then raise exception 'INVESTORS_CLOSING_YIELD_REQUIRED';end if;
    if exists(select 1 from investors_private.movements x where x.obligation_id=o.id and not x.voided and not exists(select 1 from investors_private.movements r where r.replaces_id=x.id)) then raise exception 'INVESTORS_PREPAID_PERIOD_REVIEW_REQUIRED';end if;
    update investors_private.obligations set cancelled=true where id=o.id;
    perform investors_private.log('obligation',o.id,'CANCEL_FUTURE',reason,to_jsonb(o),jsonb_build_object('agreed_closing_yield',closing_amount));
    insert into investors_private.obligations(contract_id,period_start,period_end,due_on,concept,amount,origin)
    values(c.id,o.period_start,d,d,'yield',closing_amount,'agreed_early_close');
   end loop;
   if p_action='renew' then
    if balance<=0 or (v->>'ends_on')::date<=d or v->>'payment_mode' not in('Mensual','Al vencimiento','Manual') then raise exception 'INVESTORS_RENEWAL_INVALID';end if;
    insert into investors_private.contracts(investor_id,code,starts_on,ends_on,months,principal,monthly_rate,payment_mode,payment_method,status,opening_balance,balance_on,history_complete,parent_id,notes)
    values(c.investor_id,btrim(v->>'code'),d,(v->>'ends_on')::date,(v->>'months')::int,balance,coalesce((v->>'monthly_rate')::numeric,.025),v->>'payment_mode',c.payment_method,'active',balance,d,c.history_complete,c.id,reason) returning id into target;
    insert into investors_private.terms(contract_id,effective_on,monthly_rate,actor) values(target,d,coalesce((v->>'monthly_rate')::numeric,.025),auth.uid());
    if v->>'payment_mode'<>'Manual' then perform investors_private.schedule(target,d,reason);end if;
   else target:=c.id;end if;
   update investors_private.contracts set status=case when p_action='renew' then 'renewed' else 'closed' end,version=version+1 where id=c.id;
   for o in select * from investors_private.obligations where contract_id=c.id and not cancelled and period_start>=d loop
    if not exists(select 1 from investors_private.movements x where x.obligation_id=o.id and not x.voided and not exists(select 1 from investors_private.movements r where r.replaces_id=x.id)) then
     update investors_private.obligations set cancelled=true where id=o.id;
     perform investors_private.log('obligation',o.id,'CANCEL_FUTURE',reason,to_jsonb(o),jsonb_build_object('cancelled',true));
    end if;
   end loop;
   perform investors_private.log('contract',c.id,p_action,reason,old,(select to_jsonb(x) from investors_private.contracts x where id=c.id));
   result:=jsonb_build_object('id',target,'previous_id',c.id);
  elsif p_action='obligation' then
   if v->>'period_start' is null or v->>'period_end' is null or (v->>'period_start')::date<c.starts_on or (v->>'period_end')::date>c.ends_on or (v->>'amount')::numeric<=0 then raise exception 'INVESTORS_PERIOD_INVALID';end if;
   insert into investors_private.obligations(contract_id,period_start,period_end,due_on,concept,amount,origin)
   values(c.id,(v->>'period_start')::date,(v->>'period_end')::date,(v->>'due_on')::date,v->>'concept',(v->>'amount')::numeric,'manual') returning id into target;
   select to_jsonb(x) into result from investors_private.obligations x where id=target;old:=null;
  else
   d:=(v->>'effective_on')::date;n:=(v->>'amount')::numeric;
   if d is null or d>today or d<c.starts_on or (v->>'concept' in('contribution','withdrawal','adjustment') and d<c.balance_on) or n is null or n<=0 then raise exception 'INVESTORS_MOVEMENT_DATE_AMOUNT_INVALID';end if;
   if v->>'concept'='yield' and ((v->>'period_start')::date<c.starts_on or (v->>'period_end')::date>c.ends_on) then raise exception 'INVESTORS_PERIOD_INVALID';end if;
   if nullif(v->>'replaces_id','') is not null then
    select * into m from investors_private.movements where id=(v->>'replaces_id')::uuid;
    if not found or m.contract_id<>c.id or exists(select 1 from investors_private.movements where replaces_id=m.id) then raise exception 'INVESTORS_MOVEMENT_VERSION_CHANGED';end if;
    old:=to_jsonb(m);
   else old:=null;end if;
   if v->>'concept'='yield' and nullif(v->>'obligation_id','') is null then raise exception 'INVESTORS_OBLIGATION_REQUIRED';end if;
   if nullif(v->>'obligation_id','') is not null then
    select * into o from investors_private.obligations where id=(v->>'obligation_id')::uuid;
    if not found or o.cancelled or o.contract_id<>c.id or v->>'direction'<>'out' or (o.concept='yield' and v->>'concept'<>'yield') or (o.concept='capital' and v->>'concept'<>'withdrawal') or (o.concept='other' and v->>'concept'<>'other') then raise exception 'INVESTORS_OBLIGATION_MISMATCH';end if;
    if o.concept='yield' and ((v->>'period_start')::date is distinct from o.period_start or (v->>'period_end')::date is distinct from o.period_end) then raise exception 'INVESTORS_PERIOD_MISMATCH';end if;
   end if;
   insert into investors_private.movements(contract_id,replaces_id,obligation_id,effective_on,concept,direction,amount,period_start,period_end,payment_method,reference,notes,voided,actor)
   values(c.id,nullif(v->>'replaces_id','')::uuid,nullif(v->>'obligation_id','')::uuid,d,v->>'concept',v->>'direction',n,nullif(v->>'period_start','')::date,nullif(v->>'period_end','')::date,v->>'payment_method',coalesce(v->>'reference',''),coalesce(v->>'notes',''),coalesce((v->>'voided')::boolean,false),auth.uid()) returning id into target;
   if o.id is not null and not coalesce((v->>'voided')::boolean,false) and (select coalesce(sum(x.amount),0) from investors_private.movements x where x.obligation_id=o.id and not x.voided and not exists(select 1 from investors_private.movements r where r.replaces_id=x.id))>o.amount then raise exception 'INVESTORS_OVERPAYMENT';end if;
   select min(investors_private.balance(c.id,x.check_on)) into minbalance from (select c.balance_on as check_on union select effective_on from investors_private.movements where contract_id=c.id) x;
   if minbalance<0 then raise exception 'INVESTORS_NEGATIVE_CAPITAL';end if;
   if v->>'concept' in('contribution','withdrawal','adjustment') or m.concept in('contribution','withdrawal','adjustment') then
    if c.payment_mode<>'Manual' then perform investors_private.schedule(c.id,greatest(today,d+1),reason);end if;
   end if;
   select to_jsonb(x) into result from investors_private.movements x where id=target;
  end if;
 elsif p_action='review' then
  select to_jsonb(r) into old from investors_private.reviews r where id=target for update;
  if old is null or (old->>'version')::int is distinct from (v->>'version')::int or old->>'resolved_at' is not null then raise exception 'INVESTORS_VERSION_CHANGED';end if;
  update investors_private.reviews set resolved_at=clock_timestamp(),resolution=reason,resolved_by=auth.uid(),version=version+1 where id=target;
  select to_jsonb(r) into result from investors_private.reviews r where id=target;
 else raise exception 'INVESTORS_ACTION_INVALID';end if;
 perform investors_private.log(case when p_action in('rate','activate','close','renew') then 'contract' else p_action end,target,p_action,reason,old,result);
 result:=jsonb_build_object('data',result,'context',jsonb_build_object('actor',auth.uid(),'session',auth.jwt()->>'session_id','effective_affiliate',public.get_effective_affiliate_id()));
 insert into investors_private.actions(id,actor,payload,result) values(p_action_id,auth.uid(),payload,result);
 return result;
end $$;

create function public.investors_document(p_id uuid default null,p_values jsonb default null,p_action_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb:=p_values; d investors_private.documents; bytes bytea; investor uuid; cid uuid; mid uuid; prior investors_private.actions; result jsonb;
begin
 perform investors_private.guard(p_values is not null);
 if v is null then
  select * into d from investors_private.documents where id=p_id;
  if not found then raise exception 'INVESTORS_DOCUMENT_NOT_FOUND';end if;
  perform investors_private.log('document',d.id,'READ','Consulta documental',null,jsonb_build_object('filename',d.filename));
  result:=jsonb_build_object('id',d.id,'filename',d.filename,'mime',d.mime,'base64',encode(d.content,'base64'));
 else
  if p_action_id is null then raise exception 'INVESTORS_ACTION_REQUIRED';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_action_id::text,0));
  select * into prior from investors_private.actions where id=p_action_id;
  if found then
   if prior.actor<>auth.uid() or prior.payload<>v then raise exception 'INVESTORS_ACTION_CONFLICT';end if;return prior.result;
  end if;
  bytes:=decode(v->>'base64','base64');investor:=(v->>'investor_id')::uuid;cid:=nullif(v->>'contract_id','')::uuid;mid:=nullif(v->>'movement_id','')::uuid;
  if octet_length(bytes)>5242880 or length(v->>'filename') not between 1 and 200 or v->>'filename' ~ '[/\\]' then raise exception 'INVESTORS_DOCUMENT_INVALID';end if;
  if not ((v->>'mime'='application/pdf' and substring(bytes from 1 for 5)=decode('255044462d','hex')) or (v->>'mime'='image/png' and substring(bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')) or (v->>'mime'='image/jpeg' and substring(bytes from 1 for 3)=decode('ffd8ff','hex'))) then raise exception 'INVESTORS_DOCUMENT_TYPE_INVALID';end if;
  if cid is not null and not exists(select 1 from investors_private.contracts where id=cid and investor_id=investor) then raise exception 'INVESTORS_DOCUMENT_CONTEXT_INVALID';end if;
  if mid is not null and (cid is null or not exists(select 1 from investors_private.movements where id=mid and contract_id=cid)) then raise exception 'INVESTORS_DOCUMENT_CONTEXT_INVALID';end if;
  if nullif(v->>'replaces_id','') is not null and not exists(select 1 from investors_private.documents where id=(v->>'replaces_id')::uuid and investor_id=investor and contract_id is not distinct from cid) then raise exception 'INVESTORS_DOCUMENT_CONTEXT_INVALID';end if;
  insert into investors_private.documents(investor_id,contract_id,movement_id,replaces_id,filename,mime,content,actor)
  values(investor,cid,mid,nullif(v->>'replaces_id','')::uuid,v->>'filename',v->>'mime',bytes,auth.uid()) returning * into d;
  result:=jsonb_build_object('id',d.id,'filename',d.filename);
  perform investors_private.log('document',d.id,'UPLOAD','Carga documental',null,result);
 end if;
 result:=jsonb_build_object('data',result,'context',jsonb_build_object('actor',auth.uid(),'session',auth.jwt()->>'session_id','effective_affiliate',public.get_effective_affiliate_id()));
 if v is not null then insert into investors_private.actions(id,actor,payload,result) values(p_action_id,auth.uid(),v,result);end if;
 return result;
end $$;

create function public.get_admin_investors_source(p_sheet text,p_row integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform investors_private.guard(false);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from investors_private.source_rows r where r.sheet=p_sheet and r.row_number=p_row;
 return jsonb_build_object('data',result,'context',jsonb_build_object('actor',auth.uid(),'session',auth.jwt()->>'session_id','effective_affiliate',public.get_effective_affiliate_id()));
end $$;
revoke all on all functions in schema investors_private from public,anon,authenticated,service_role;
revoke all on function public.get_admin_investors(uuid),public.save_admin_investors(text,jsonb,uuid),public.investors_document(uuid,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_investors(uuid),public.save_admin_investors(text,jsonb,uuid),public.investors_document(uuid,jsonb,uuid) to authenticated;
revoke all on function public.get_admin_investors_source(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_investors_source(text,integer) to authenticated;
commit;
