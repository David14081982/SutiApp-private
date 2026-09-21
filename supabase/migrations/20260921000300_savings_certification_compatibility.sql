begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Exact active identity remains mandatory; archived duplicates are not a second owner.
-- Zero opening balances may precede their genuine enrollment start.
insert into public.savings_certification_function_backup(signature,definition)
select 'P1_Q_20260921:'||oid::regprocedure::text,pg_get_functiondef(oid)
from pg_proc where pronamespace='public'::regnamespace and proname in
 ('admin_save_savings_review','preview_savings_balance_certification','admin_confirm_savings_balance');
do $patch$ declare d text; revised text; old_text text; new_text text;begin
 if (select count(*) from public.savings_certification_function_backup where signature like 'P1_Q_20260921:%')<>3
 then raise exception 'SAVINGS_CERTIFICATION_CONTRACT_DRIFT';end if;

 d:=pg_get_functiondef('public.admin_save_savings_review(uuid,integer,jsonb,text,text,uuid)'::regprocedure);
 old_text:=$old$(ident->>'match_count')::integer<>1 or (ident->>'active_match_count')::integer<>1$old$;
 new_text:=$new$(ident->>'active_match_count')::integer<>1$new$;
 if position(old_text in d)=0 then raise exception 'SAVINGS_REVIEW_IDENTITY_CONTRACT_DRIFT';end if;
 execute replace(d,old_text,new_text);

 d:=pg_get_functiondef('public.preview_savings_balance_certification(uuid,jsonb)'::regprocedure);
 old_text:='or first_date>cut or';
 if position(old_text in d)=0 then raise exception 'SAVINGS_FIRST_DATE_CONTRACT_DRIFT';end if;
 revised:=replace(d,old_text,'or (first_date>cut and cap+y<>0) or');
 old_text:='or enrollment_start>cut then';
 if position(old_text in revised)=0 then raise exception 'SAVINGS_START_DATE_CONTRACT_DRIFT';end if;
 execute replace(revised,old_text,'or (enrollment_start>cut and cap+y<>0) then');

 d:=pg_get_functiondef('public.admin_confirm_savings_balance(uuid,jsonb,text,uuid)'::regprocedure);
 old_text:=$old$(d#>>'{identity,match_count}')::int<>1 or (d#>>'{identity,active_match_count}')::int<>1$old$;
 new_text:=$new$(d#>>'{identity,active_match_count}')::int<>1$new$;
 if position(old_text in d)=0 then raise exception 'SAVINGS_CERT_IDENTITY_CONTRACT_DRIFT';end if;
 revised:=replace(d,old_text,new_text);
 -- A future planned discount is not an actual receipt. Original dates remain in
 -- command/source_snapshot and enrollment_started_at; no date is backdated.
 old_text:='end,first_date,case when not active';
 new_text:='end,case when first_date<=cut then first_date end,case when not active';
 if position(old_text in revised)=0 then raise exception 'SAVINGS_ACTUAL_DATE_CONTRACT_DRIFT';end if;
 execute replace(revised,old_text,new_text);
end $patch$;
-- CREATE OR REPLACE preserves the existing grants, owner and security boundaries.
notify pgrst,'reload schema';
commit;
