begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- H-LOAN-ADVANCE-ADMIN-FEE-001. No business rows or historical contracts change.
create schema loan_advance_private;
revoke all on schema loan_advance_private from public,anon,authenticated,service_role;
create table loan_advance_private.function_backup(
 signature text primary key,definition text not null,installed_definition text,
 original_acl text,original_owner text not null
);
alter table loan_advance_private.function_backup enable row level security;
alter table loan_advance_private.function_backup force row level security;
revoke all on loan_advance_private.function_backup from public,anon,authenticated,service_role;

do $$ declare s text; expected text; actual text;begin
 for s,expected in select * from (values
 ('public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)','b8ef84c5e491871bb695bf1fb6038809'),
 ('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)','da6b935968fbf7639115d9e77cb1c313')
 ) x(signature,hash) loop
  actual:=pg_get_functiondef(s::regprocedure);
  if md5(actual)<>expected then raise exception 'ADVANCE_FEE_FUNCTION_DRIFT: %',s;end if;
  insert into loan_advance_private.function_backup
   select s,actual,null,p.proacl::text,pg_get_userbyid(p.proowner) from pg_proc p where p.oid=s::regprocedure;
 end loop;
 if md5(pg_get_functiondef('public.resolve_suti_loan_quote_contract_v1_engine(jsonb,text,text,text,numeric,integer,jsonb)'::regprocedure))
 <> 'd2cc0ef9e84d7cad725a14ac5a79d162' then raise exception 'ADVANCE_FEE_ENGINE_DRIFT';end if;
end $$;

-- Internal, deterministic calendar: (today, maturity], not a count of repayments.
create function loan_advance_private.payroll_periods(p_today date,p_due date,p_category text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare m date; d date; dates date[]:=array[]::date[]; category text:=public.normalize_suti_financial_key(p_category);
 monthly boolean; days integer[]; day_number integer;
begin
 if p_today is null or p_due is null or not isfinite(p_today) or not isfinite(p_due) then
  raise exception 'FINANCIAL_RULES_INVALID' using errcode='22023';end if;
 if p_due<p_today then raise exception 'FINANCIAL_PROGRAM_NOT_ELIGIBLE' using errcode='P0001';end if;
 if category in ('JUBILADOS Y PENS.','JUBILADOS Y PENS') then monthly:=true;
 elsif category in ('BASE','EVENTUALES','SUPLENTES FIJOS','SUPLENTES VARIABLES','CONFIANZA') then monthly:=false;
 else raise exception 'AFFILIATE_FINANCIAL_PROFILE_INCOMPLETE' using errcode='P0001';end if;
 m:=date_trunc('month',p_today)::date;
 while m<=p_due loop
  days:=case when monthly then array[5] else array[15,case when extract(month from m)=2 then 28 else 30 end] end;
  foreach day_number in array days loop
   d:=make_date(extract(year from m)::integer,extract(month from m)::integer,day_number);
   if d>p_today and d<=p_due then dates:=array_append(dates,d);end if;
  end loop;
  m:=(m+interval '1 month')::date;
 end loop;
 return jsonb_build_object('anchorDate',p_today,'dueDate',p_due,'dates',to_jsonb(dates),
  'periodCount',cardinality(dates),'period',case when monthly then 'mensual' else 'quincenal' end);
end $$;
revoke all on function loan_advance_private.payroll_periods(date,date,text) from public,anon,authenticated,service_role;

create or replace function public.resolve_suti_loan_quote_contract(
 p_eligible_rules jsonb,p_financial_union text,p_financial_employee_category text,p_program_id text,
 p_amount numeric,p_term integer,p_policy jsonb
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; r jsonb; calendar jsonb; fee numeric; total numeric; due date;
 today date:=(now() at time zone 'America/Hermosillo')::date;
begin
 result:=public.resolve_suti_loan_quote_contract_v1_engine($1,$2,$3,$4,$5,$6,$7)
  ||jsonb_build_object('source','SUPABASE_FINANCIAL_CRITERIA');
 select value into r from jsonb_array_elements(p_eligible_rules) c(value)
 where value->>'status'='AVAILABLE'
 and public.normalize_suti_financial_key(value->>'category')=public.normalize_suti_financial_key(p_financial_employee_category)
 and public.normalize_suti_financial_key(value->>'union')=public.normalize_suti_financial_key(p_financial_union)
 and (value->>'id'=p_program_id or value->>'program_id'=p_program_id)
 order by (value->>'id'=p_program_id) desc limit 1;
 if r->>'program_id'<>'prestamo' or (r->>'payment_count')::integer<>1 or r->>'available_on' is null then return result;end if;
 due:=(r->>'available_on')::date;
 if due<date '2026-01-01' then return result;end if;
 calendar:=loan_advance_private.payroll_periods(today,due,p_financial_employee_category);
 fee:=round((result->>'administrativeFeePerPayment')::numeric*(calendar->>'periodCount')::integer,2);
 total:=round(p_amount+(result->>'interest')::numeric+fee,2);
 -- Preserve interest, eligibility, capital and exactly one final payment.
 return result||jsonb_build_object(
  'administrativeFeeTotal',fee,'total',total,'paymentPerPeriod',total,
  'administrativeFeePeriodCount',(calendar->>'periodCount')::integer,
  'administrativeFeePeriod',calendar->>'period',
  'administrativeFeeCalendar',calendar||jsonb_build_object('anchorBasis','REQUEST_DATE'),
  'administrativeFeeRule','$15 por periodo de nómina hasta el vencimiento',
  'administrativeFeeVersion','ADVANCE_PAYROLL_PERIODS_V1',
  'termOptions',coalesce((select jsonb_agg(value||jsonb_build_object(
   'administrativeFeeTotal',fee,'total',total,'paymentPerPeriod',total,
   'administrativeFeePeriodCount',(calendar->>'periodCount')::integer))
   from jsonb_array_elements(result->'termOptions')),'[]'::jsonb));
end $$;

-- Retain the exact identity, RLS, impersonation and savings access checks.
do $$ declare original text; changed text;begin
 original:=pg_get_functiondef('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)'::regprocedure);
 if original not like '%v_snapshot.calculation_contract_version<>''SUTI_LOAN_QUOTE_V1'' then%'
 then raise exception 'ADVANCE_FEE_SNAPSHOT_GUARD_DRIFT';end if;
 changed:=replace(original,'v_snapshot.calculation_contract_version<>''SUTI_LOAN_QUOTE_V1'' then',
 'v_snapshot.calculation_contract_version<>''SUTI_LOAN_QUOTE_V2''
     or (v_snapshot.created_at at time zone ''America/Hermosillo'')::date<>(now() at time zone ''America/Hermosillo'')::date then');
 execute changed;
end $$;

-- The quote and INSERT use separate calls. Reject a rollover between them so
-- the stored basis always equals the immutable actual request date.
create function loan_advance_private.enforce_request_date()
returns trigger language plpgsql set search_path='' as $$
declare result jsonb:=new.financial_submission_snapshot->'financialResult';
begin
 if result->>'administrativeFeeVersion'='ADVANCE_PAYROLL_PERIODS_V1' then
  if new.created_at is null
   or result#>>'{administrativeFeeCalendar,anchorBasis}' is distinct from 'REQUEST_DATE'
   or (result#>>'{administrativeFeeCalendar,anchorDate}')::date is distinct from
     (new.created_at at time zone 'America/Hermosillo')::date
   or (new.created_at at time zone 'America/Hermosillo')::date<>(now() at time zone 'America/Hermosillo')::date
  then raise exception 'CONDITIONS_CHANGED' using errcode='40001';end if;
 end if;
 return new;
end $$;
revoke all on function loan_advance_private.enforce_request_date() from public,anon,authenticated,service_role;
create trigger program_requests_advance_fee_date before insert on public.program_requests
for each row execute function loan_advance_private.enforce_request_date();

update loan_advance_private.function_backup set installed_definition=pg_get_functiondef(signature::regprocedure);
do $$ declare b record;begin
 for b in select * from loan_advance_private.function_backup loop
  if (select p.proacl::text is distinct from b.original_acl or pg_get_userbyid(p.proowner)<>b.original_owner from pg_proc p where p.oid=b.signature::regprocedure)
  then raise exception 'ADVANCE_FEE_PRIVILEGE_DRIFT';end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
