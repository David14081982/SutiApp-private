begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- H-LOAN-ADVANCE-INTEREST-001: no business rows or historical contracts change.
create table loan_advance_private.interest_function_backup(
 signature text primary key,definition text not null,installed_definition text,
 original_acl text,original_owner text not null
);
alter table loan_advance_private.interest_function_backup enable row level security;
alter table loan_advance_private.interest_function_backup force row level security;
revoke all on loan_advance_private.interest_function_backup from public,anon,authenticated,service_role;

do $$ declare s text; expected text; actual text;begin
 for s,expected in select * from (values
 ('public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb)','d7206f79c562115aa04287f609bfbc33'),
 ('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)','b59cd24cd6ed5473aac8934d1930c67c')
 ) x(signature,hash) loop
  actual:=pg_get_functiondef(s::regprocedure);
  if md5(actual)<>expected then raise exception 'ADVANCE_INTEREST_FUNCTION_DRIFT: %',s;end if;
  insert into loan_advance_private.interest_function_backup
   select s,actual,null,p.proacl::text,pg_get_userbyid(p.proowner) from pg_proc p where p.oid=s::regprocedure;
 end loop;
 if md5(pg_get_functiondef('public.resolve_suti_loan_quote_contract_v1_engine(jsonb,text,text,text,numeric,integer,jsonb)'::regprocedure))
 <> 'd2cc0ef9e84d7cad725a14ac5a79d162' then raise exception 'ADVANCE_INTEREST_ENGINE_DRIFT';end if;
end $$;

create or replace function public.resolve_suti_loan_quote_contract(
 p_eligible_rules jsonb,p_financial_union text,p_financial_employee_category text,p_program_id text,
 p_amount numeric,p_term integer,p_policy jsonb
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; r jsonb; calendar jsonb; fee numeric; accrued_interest numeric; total numeric; due date;
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
 accrued_interest:=round(p_amount*(r->>'rate_factor')::numeric*(calendar->>'periodCount')::integer,2);
 total:=round(p_amount+accrued_interest+fee,2);
 -- Simple interest on principal; one rounding after all payroll periods.
 -- Eligibility, capital, fee calendar and exactly one final payment are preserved.
 return result||jsonb_build_object(
  'interest',accrued_interest,'administrativeFeeTotal',fee,'total',total,'paymentPerPeriod',total,
  'administrativeFeePeriodCount',(calendar->>'periodCount')::integer,
  'administrativeFeePeriod',calendar->>'period',
  'interestPeriodCount',(calendar->>'periodCount')::integer,
  'interestPeriod',calendar->>'period','ratePeriod',calendar->>'period',
  'interestCalculationVersion','ADVANCE_PAYROLL_INTEREST_V1',
  'administrativeFeeCalendar',calendar||jsonb_build_object('anchorBasis','REQUEST_DATE'),
  'administrativeFeeRule','$15 por periodo de nómina hasta el vencimiento',
  'administrativeFeeVersion','ADVANCE_PAYROLL_PERIODS_V1',
  'termOptions',coalesce((select jsonb_agg(value||jsonb_build_object(
   'interest',accrued_interest,'administrativeFeeTotal',fee,'total',total,'paymentPerPeriod',total,
   'administrativeFeePeriodCount',(calendar->>'periodCount')::integer))
   from jsonb_array_elements(result->'termOptions')),'[]'::jsonb));
end $$;

-- Reject pre-interest sessions without changing identity/date/access checks.
do $$ declare original text;begin
 original:=pg_get_functiondef('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)'::regprocedure);
 if original not like '%SUTI_LOAN_QUOTE_V2%' then raise exception 'ADVANCE_INTEREST_SNAPSHOT_DRIFT';end if;
 execute replace(original,'SUTI_LOAN_QUOTE_V2','SUTI_LOAN_QUOTE_V3');
end $$;

update loan_advance_private.interest_function_backup set installed_definition=pg_get_functiondef(signature::regprocedure);
do $$ declare b record;begin
 for b in select * from loan_advance_private.interest_function_backup loop
  if (select p.proacl::text is distinct from b.original_acl or pg_get_userbyid(p.proowner)<>b.original_owner from pg_proc p where p.oid=b.signature::regprocedure)
  then raise exception 'ADVANCE_INTEREST_PRIVILEGE_DRIFT';end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
