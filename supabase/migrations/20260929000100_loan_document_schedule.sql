-- Owner-approved documentary calendar; financial writers and historical rows stay unchanged.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

create function document_private.loan_payment_schedule(p_source jsonb,p_request_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f jsonb:=p_source#>'{operation,financial,financialResult}';category text;
 process text;result jsonb;due date;count_payments integer;total numeric;regular numeric;
begin
 if p_request_date is null or not isfinite(p_request_date) then raise exception 'DOCUMENT_SCHEDULE_DATE_MISSING';end if;
 count_payments:=(f->>'paymentCount')::integer;total:=(f->>'total')::numeric;regular:=(f->>'paymentPerPeriod')::numeric;
 if count_payments is null or count_payments not between 1 and 240 or total is null or total<=0 or regular is null or regular<=0 then raise exception 'DOCUMENT_SCHEDULE_INPUT_INVALID';end if;
 -- An advance maturity is already authorized. Do not shift it by the new periodic rule.
 if count_payments=1 and nullif(f#>>'{administrativeFeeCalendar,dueDate}','') is not null then
  due:=(f#>>'{administrativeFeeCalendar,dueDate}')::date;
  if not isfinite(due) or due<p_request_date or round(total,2)<>round(regular,2) then raise exception 'DOCUMENT_SCHEDULE_MATURITY_INVALID';end if;
  return jsonb_build_object('version','LOAN_DOCUMENT_FIXED_MATURITY_V1','source','FROZEN_LOAN_APPROVAL','anchor_date',p_request_date,
   'anchor_basis','REQUEST_DATE','first_payment_date',due,'last_payment_date',due,'payment_count',1,'total',round(total,2),
   'rows',jsonb_build_array(jsonb_build_object('number',1,'date',due,'payment',round(total,2),'remaining_total',0,'final_payment',true)));
 end if;
 category:=public.normalize_suti_financial_key(p_source#>>'{operation,profile,financial_employee_category}');
 process:=case when category='SUPLENTES VARIABLES' then '3'
  when category in ('BASE','EVENTUALES','SUPLENTES FIJOS') then '1'
  when category in ('JUBILADOS Y PENS.','JUBILADOS Y PENS') then 'JUB' end;
 if process is null then raise exception 'DOCUMENT_SCHEDULE_PROCESS_UNRESOLVED';end if;
 result:=public.generate_program_product_payment_schedule(p_request_date,process,count_payments,total,regular);
 return result||jsonb_build_object('source','FROZEN_LOAN_APPROVAL','anchor_basis','REQUEST_DATE');
end $$;
revoke all on function document_private.loan_payment_schedule(jsonb,date) from public,anon,authenticated,service_role;

create function document_private.capture_loan_payment_schedule()
returns trigger language plpgsql security definer set search_path='' as $$
declare request_date date;calendar jsonb;code text;
begin
 if new.document_type<>'LOAN_APPROVAL' then return new;end if;
 -- A revision of an already enriched document retains the exact frozen calendar.
 if new.source_snapshot ? 'loan_payment_schedule' then return new;end if;
 begin
  select (r.created_at at time zone 'America/Hermosillo')::date into request_date
   from public.program_requests r where r.id=new.operation_id and r.affiliate_id=new.affiliate_id;
  if request_date is null then raise exception 'DOCUMENT_SCHEDULE_DATE_MISSING';end if;
  calendar:=document_private.loan_payment_schedule(new.source_snapshot,request_date);
 exception when others then
  -- Documentary failure must never roll back approval. The renderer fails visibly
  -- from this sealed error, without inventing dates or falling back to current data.
  code:=case when sqlerrm like 'DOCUMENT_SCHEDULE_%' then sqlerrm else 'DOCUMENT_SCHEDULE_INPUT_INVALID' end;
  calendar:=jsonb_build_object('error',code,'source','FROZEN_LOAN_APPROVAL');
 end;
 new.source_snapshot:=new.source_snapshot||jsonb_build_object('loan_payment_schedule',calendar);
 if new.document_snapshot is not null then new.document_snapshot:=new.document_snapshot||jsonb_build_object('loan_payment_schedule',calendar);end if;
 return new;
end $$;
revoke all on function document_private.capture_loan_payment_schedule() from public,anon,authenticated,service_role;
create trigger document_loan_payment_schedule before insert on document_private.records
 for each row execute function document_private.capture_loan_payment_schedule();
commit;
