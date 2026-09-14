'use strict';
const {query,forward,recovery}=require('./savings-runtime-db');
const assert=require('assert/strict');
const checks=`
do $t$ declare actor uuid; r public.savings_review_records; ctx jsonb; cmd jsonb; pre jsonb; result jsonb; k uuid:=extensions.gen_random_uuid(); receipt_key uuid; begin
 select auth_user_id into actor from public.admin_assignments where enabled and 'savings.approve'=any(permissions) limit 1;
 if actor is null then raise exception 'TEST_ADMIN_REQUIRED'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 select rr.* into r from public.savings_review_records rr join public.savings_participants p on p.legacy_folio=rr.source_folio
 where rr.source_sheet='Ahorro' and rr.source_data->>'W'='Ahorrando' and rr.source_data->>'D'='1'
 and p.identity_status='RESOLVED' and (public.savings_review_identity(rr.source_folio)->>'match_count')::int=1
 and rr.source_data->>'F'=rr.source_data->>'X' and public.savings_panel_number(rr.source_data->'Q')>1000 order by rr.id limit 1;
 if r.id is null then raise exception 'FIXTURE_SOURCE_REQUIRED';end if;
 perform public.admin_save_savings_panel(r.id,r.version,'{}','RESOLVED',null,extensions.gen_random_uuid());
 ctx:=public.savings_certification_context(r.id);
 cmd:=jsonb_build_object('capital',ctx#>'{person,saldo_revision}','yield',0,'amount',ctx#>'{person,aporte}','first_date',ctx#>>'{person,inicio}','next_date','2026-09-15','process','PROCESS_1','active',true,'observation','','confirmed',true);
 pre:=public.preview_savings_balance_certification(r.id,cmd);
 if (select count(*) from public.savings_transactions)<>0 then raise exception 'PREVIEW_CREATED_MONEY';end if;
 begin perform public.preview_savings_balance_certification(r.id,cmd||'{"capital":1}');raise exception 'ARBITRARY_BALANCE';exception when raise_exception then if sqlerrm<>'SAVINGS_REVIEWED_BALANCE_MISMATCH' then raise;end if;end;
 begin perform public.admin_confirm_savings_balance(r.id,cmd,'stale',k);raise exception 'STALE_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_PREVIEW_STALE' then raise;end if;end;
 result:=public.admin_confirm_savings_balance(r.id,cmd,pre->>'fingerprint',k);
 perform public.admin_confirm_savings_balance(r.id,cmd,pre->>'fingerprint',k);
 if (select count(*) from public.savings_balance_certifications where record_id=r.id)<>1 then raise exception 'DUPLICATE_CERT';end if;
 if (select sum(amount) from public.savings_transactions where participant_id=(result->>'participant_id')::uuid)<>(cmd->>'capital')::numeric then raise exception 'DOUBLE_YIELD_OR_WITHDRAWAL';end if;
 if (select historical_yield_reconciled_through from public.savings_participants where id=(result->>'participant_id')::uuid)<>'2026-06-30'::date then raise exception 'WRONG_YIELD_BOUNDARY';end if;
 begin perform public.admin_confirm_savings_balance(r.id,cmd||'{"observation":"changed"}',pre->>'fingerprint',k);raise exception 'CHANGED_RETRY';exception when raise_exception then if sqlerrm<>'SAVINGS_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',500,0,null,extensions.gen_random_uuid());raise exception 'FUTURE_CASH';exception when raise_exception then if sqlerrm<>'SAVINGS_RECEIPT_INVALID' then raise;end if;end;
 -- Simulated business day only in this rollback transaction, without system-clock changes.
 execute $f$create or replace function public.savings_operation_today() returns date language sql stable set search_path='' as 'select date ''2026-09-30'''$f$;
 receipt_key:=extensions.gen_random_uuid();
 perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',100,0,null,receipt_key);
 perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',100,0,null,receipt_key);
 perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',50,1,'',extensions.gen_random_uuid());
 perform public.admin_confirm_savings_receipt(r.id,'2026-09-30',0,0,'',extensions.gen_random_uuid());
 pre:=public.get_admin_savings_financial_account(r.id,'2026-10-30');
 if (pre#>>'{balance,total}')::numeric<>(cmd->>'capital')::numeric+50 then raise exception 'WRONG_ACTUAL_BALANCE';end if;
 if (pre->>'unconfirmed_dates')::int<>0 then raise exception 'ZERO_IS_NOT_CONFIRMED';end if;
 if not exists(select 1 from jsonb_array_elements(pre->'schedule') d where d->>'date'='2026-09-30' and (d->>'actual')::numeric=0 and d->>'confirmed'='true') then raise exception 'ZERO_LOST';end if;
 begin perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',60,1,null,extensions.gen_random_uuid());raise exception 'LOST_UPDATE';exception when raise_exception then if sqlerrm<>'SAVINGS_PREVIEW_STALE' then raise;end if;end;
 begin perform public.admin_confirm_savings_receipt(r.id,'2026-08-30',100,0,null,extensions.gen_random_uuid());raise exception 'HISTORY_OVERWRITTEN';exception when raise_exception then if sqlerrm<>'SAVINGS_CERTIFIED_PERIOD_PROTECTED' then raise;end if;end;
 -- Changing reviewed source invalidates a previously opened balance correction.
 pre:=public.get_admin_savings_financial_account(r.id);
 select * into r from public.savings_review_records where id=r.id;
 perform public.admin_save_savings_panel(r.id,r.version,jsonb_build_object('AC',public.savings_panel_number(r.source_data->'AC')+50),'RESOLVED',null,extensions.gen_random_uuid());
 begin perform public.admin_adjust_savings_balance(r.id,(pre#>>'{balance,capital}')::numeric,0,pre->>'balance_version',null,extensions.gen_random_uuid());raise exception 'SOURCE_RACE_ALLOWED';exception when raise_exception then if sqlerrm<>'SAVINGS_PREVIEW_STALE' then raise;end if;end;
 pre:=public.get_admin_savings_financial_account(r.id);
 perform public.admin_adjust_savings_balance(r.id,(pre#>>'{balance,capital}')::numeric,0,pre->>'balance_version','',extensions.gen_random_uuid());
 if public.get_admin_savings_financial_account(r.id)->>'source_changed'<>'false' then raise exception 'EXPLICIT_SOURCE_ACCEPTANCE_LOST';end if;
 select * into r from public.savings_review_records where id=r.id;
 perform public.admin_save_savings_panel(r.id,r.version,jsonb_build_object('R',(cmd->>'amount')::numeric+75),'RESOLVED',null,extensions.gen_random_uuid());
 pre:=public.get_admin_savings_financial_account(r.id);
 begin perform public.admin_adjust_savings_balance(r.id,(pre#>>'{balance,capital}')::numeric,0,pre->>'balance_version',null,extensions.gen_random_uuid());raise exception 'PLAN_CORRECTION_SILENTLY_ACCEPTED';exception when raise_exception then if sqlerrm<>'SAVINGS_PLAN_REVIEW_REQUIRED' then raise;end if;end;
 if has_table_privilege('authenticated','public.savings_balance_certifications','insert') or has_function_privilege('authenticated','public.savings_certification_context(uuid)','execute') then raise exception 'DIRECT_ACCESS';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_financial_account(r.id);raise exception 'ANON_READ';exception when insufficient_privilege then null;end;
 begin perform public.admin_confirm_savings_balance(r.id,cmd,pre->>'fingerprint',extensions.gen_random_uuid());raise exception 'ANON_WRITE';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',extensions.gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.get_admin_savings_financial_account(r.id);raise exception 'OTHER_USER_READ';exception when insufficient_privilege then null;end;
end $t$;
do $zero$ declare actor uuid;r public.savings_review_records;cmd jsonb;pre jsonb;result jsonb;begin
 select auth_user_id into actor from public.admin_assignments where enabled and 'savings.approve'=any(permissions) limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 select rr.* into r from public.savings_review_records rr where source_sheet='Ahorro' and public.savings_panel_number(source_data->'Q')=0 and public.savings_panel_date(source_data->>'F') is null and public.savings_panel_date(source_data->>'X') is null and (public.savings_review_identity(source_folio)->>'match_count')::int=1 and (public.savings_review_identity(source_folio)->>'active_match_count')::int=1 limit 1;
 if r.id is null then raise exception 'ZERO_FIXTURE_REQUIRED';end if;
 perform public.admin_save_savings_panel(r.id,r.version,'{}','RESOLVED',null,extensions.gen_random_uuid());
 cmd:='{"capital":0,"yield":0,"amount":0,"first_date":null,"enrollment_start":null,"next_date":null,"process":null,"active":false,"confirmed":true}';
 pre:=public.preview_savings_balance_certification(r.id,cmd);
 result:=public.admin_confirm_savings_balance(r.id,cmd,pre->>'fingerprint',extensions.gen_random_uuid());
 if exists(select 1 from public.savings_enrollments where participant_id=(result->>'participant_id')::uuid) or exists(select 1 from public.savings_transactions where participant_id=(result->>'participant_id')::uuid) then raise exception 'INVENTED_ZERO_HISTORY';end if;
 if public.get_admin_savings_financial_account(r.id)->'schedule'<>'[]'::jsonb then raise exception 'INVENTED_ZERO_PROJECTION';end if;
end $zero$;
`;
async function main(){
 const fp=()=>query("select (select md5(string_agg(to_jsonb(r)::text,'' order by id)) from savings_review_records r) reviews,(select count(*) from savings_review_events) events,(select count(*) from savings_transactions) transactions,(select md5(string_agg(to_jsonb(p)::text,'' order by id)) from savings_participants p) participants");
 const before=await fp();await query('begin;'+forward()+recovery()+'rollback;');
 await query('begin;'+forward()+checks+'rollback;');assert.deepEqual(await fp(),before);
 console.log('PASS certification: Q equality, optional notes, source version, idempotency, actual/expected, zero, future rejection, security, recovery; persistent changes 0');
}
module.exports={checks};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
