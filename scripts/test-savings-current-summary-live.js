'use strict';
const assert = require('assert/strict');
const {query,body} = require('./savings-admin-review-db');
const {dependencies} = require('./test-savings-requests-runtime-live');
const forward='supabase/migrations/20260913000600_savings_admin_current_summary.sql';
const recovery='supabase/recovery/20260913000600_savings_admin_current_summary_recovery.sql';
const checks=`
do $test$ declare actor uuid; r public.savings_review_records; ctx jsonb; cmd jsonb; preview jsonb; certified jsonb;
 before_data jsonb; after_data jsonb; source_before jsonb; expected_total numeric; opening numeric; fol text; p uuid; en uuid; req jsonb; result jsonb; first_date date;
 original_count int; original_altas int; rows_before jsonb; q numeric; field_key text; field_amount numeric; prior_neighbor jsonb; next_neighbor jsonb;
begin
 select auth_user_id into actor from public.admin_assignments where enabled and ('*'=any(permissions) or ('savings.write'=any(permissions) and 'savings.approve'=any(permissions) and 'savings.read'=any(permissions))) limit 1;
 if actor is null then raise exception 'TEST_ADMIN_REQUIRED';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 before_data:=public.get_admin_savings_panel('padron','','todos',0,20);
 if before_data#>>'{kpis,current_summary}'<>'true' or before_data->>'publication_mode'<>'PRIVATE' then raise exception 'PRIVATE_CURRENT_SUMMARY_MISSING';end if;
 rows_before:=public.savings_panel_before_current_summary('cobranza','','todos',0,20)->'rows';
 if exists(select 1 from jsonb_array_elements(public.get_admin_savings_panel('cobranza','','todos',0,20)->'rows') a
  join jsonb_array_elements(rows_before) b on a->>'id'=b->>'id' where a->'last_scheduled'<>b->'last_scheduled') then raise exception 'LEGACY_CORRECTION_TARGET_CHANGED';end if;
 select rr.* into r from public.savings_review_records rr join public.savings_participants sp on sp.legacy_folio=rr.source_folio
  where rr.source_sheet='Ahorro' and rr.source_data->>'W'='Ahorrando' and rr.source_data->>'D'='1'
   and sp.identity_status='RESOLVED' and (public.savings_review_identity(rr.source_folio)->>'match_count')::int=1
   and rr.source_data->>'F'=rr.source_data->>'X' and public.savings_panel_number(rr.source_data->'Q')>1000 order by rr.id limit 1;
 if r.id is null then raise exception 'TEST_CERTIFIABLE_SOURCE_REQUIRED';end if;
 source_before:=r.source_data;q:=public.savings_panel_number(source_before->'Q');
 select f->>'key',public.savings_panel_number((r.source_data||r.proposed_data)->(f->>'key')) into field_key,field_amount
  from jsonb_array_elements(r.field_defs) f where f->>'label' like '%Descuento registrado%' and left(f->>'label',10)::date>=public.savings_panel_date(r.source_data->>'X')
   and public.savings_panel_number((r.source_data||r.proposed_data)->(f->>'key'))>100 order by f->>'label' limit 1;
 if field_key is null then raise exception 'TEST_SOURCE_DISCOUNT_REQUIRED';end if;
 perform public.admin_save_savings_panel(r.id,r.version,jsonb_build_object(field_key,field_amount+10),'RESOLVED',null,extensions.gen_random_uuid());
 after_data:=public.get_admin_savings_panel('padron',r.source_folio,'todos',0,20);
 if not exists(select 1 from jsonb_array_elements(after_data->'rows')a where a->>'id'=r.id::text and (a->>'saldo')::numeric=q+10 and (a->>'source_saldo')::numeric=q) then raise exception 'UNCERTIFIED_REVIEW_BALANCE_NOT_USED';end if;
 if (after_data#>>'{kpis,total}')::numeric<>(before_data#>>'{kpis,total}')::numeric+10 then raise exception 'REVIEW_TOTAL_NOT_UPDATED';end if;
 ctx:=public.savings_certification_context(r.id);
 cmd:=jsonb_build_object('capital',ctx#>'{person,saldo_revision}','yield',0,'amount',ctx#>'{person,aporte}',
  'first_date',ctx#>>'{person,inicio}','enrollment_start',ctx#>>'{person,plan_inicio}',
  'next_date','2026-09-15','process','PROCESS_1','active',true,'observation','','confirmed',true);
 opening:=(cmd->>'capital')::numeric;
 preview:=public.preview_savings_balance_certification(r.id,cmd);
 certified:=public.admin_confirm_savings_balance(r.id,cmd,preview->>'fingerprint',extensions.gen_random_uuid());
 after_data:=public.get_admin_savings_panel('padron',r.source_folio,'todos',0,20);
 if (after_data#>>'{kpis,total}')::numeric<>(before_data#>>'{kpis,total}')::numeric+10 then raise exception 'CERTIFICATION_DOUBLE_COUNTED_Q';end if;
 if not exists(select 1 from jsonb_array_elements(after_data->'rows')a where a->>'id'=r.id::text and a->>'certified'='true' and (a->>'saldo')::numeric=opening) then raise exception 'CERTIFIED_ROW_NOT_CANONICAL';end if;
 if public.get_admin_savings_panel_detail(r.id)#>'{record,source_data}' is null then raise exception 'SOURCE_DETAIL_REMOVED';end if;
 -- A genuinely new account is counted without manufacturing a Google review row.
 select a.numero_control into fol from public.affiliates a where not coalesce(a.is_archived,false) and a.numero_control is not null
  and (select count(*) from public.affiliates b where b.numero_control=a.numero_control)=1
  and not exists(select 1 from public.savings_participants where affiliate_id=a.id or legacy_folio=a.numero_control)
  and not exists(select 1 from public.savings_review_records where source_sheet='Ahorro' and source_folio=a.numero_control) order by a.id limit 1;
 if fol is null then raise exception 'TEST_NATIVE_SAVER_REQUIRED';end if;
 original_count:=(after_data#>>'{kpis,padron}')::int;original_altas:=(after_data#>>'{kpis,altas}')::int;
 req:=public.admin_save_savings_operation(jsonb_build_object('kind','SUBMIT','type','JOIN','folio',fol,'new_amount',500,'process','PROCESS_1','observation',''),extensions.gen_random_uuid());
 result:=public.admin_save_savings_operation(jsonb_build_object('kind','REVIEW','request_id',req->>'id','decision','APPROVE','observation',''),extensions.gen_random_uuid());
 p:=(result->>'participant_id')::uuid;en:=(result->>'enrollment_id')::uuid;first_date:=(result->>'effective_from')::date;
 after_data:=public.get_admin_savings_panel('padron','','todos',0,20);
 if (after_data#>>'{kpis,padron}')::int<>original_count+1 or (after_data#>>'{kpis,altas}')::int<>original_altas+1 or (after_data#>>'{kpis,native_count}')::int<>1 then raise exception 'NATIVE_COUNTS_MISSING';end if;
 if exists(select 1 from public.savings_review_records where source_sheet='Ahorro' and source_folio=fol) then raise exception 'NATIVE_FAKE_SOURCE_CREATED';end if;
 if (after_data#>>'{kpis,total}')::numeric<>(before_data#>>'{kpis,total}')::numeric+10 then raise exception 'FUTURE_COUNTED_AS_ACTUAL';end if;
 -- The clock is simulated only inside this transaction; no browser or database fixture persists.
 execute format('create or replace function public.savings_operation_today() returns date language sql stable set search_path='''' as %L','select '||quote_literal(first_date)||'::date');
 after_data:=public.get_admin_savings_panel('padron','','todos',0,20);
 if (after_data#>>'{kpis,pending_actual_count}')::int<1 then raise exception 'UNCONFIRMED_NATIVE_DATES_HIDDEN';end if;
 perform public.admin_confirm_savings_account_receipt(p,en,first_date,500,0,'',extensions.gen_random_uuid());
 perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',100,0,'',extensions.gen_random_uuid());
 after_data:=public.get_admin_savings_panel('padron','','todos',0,20);
 expected_total:=(before_data#>>'{kpis,total}')::numeric+610;
 if (after_data#>>'{kpis,total}')::numeric<>expected_total then raise exception 'ACTUAL_TOTAL_MISMATCH';end if;
 perform public.admin_confirm_savings_account_receipt(p,en,first_date,250,1,null,extensions.gen_random_uuid());
 perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',50,1,null,extensions.gen_random_uuid());
 after_data:=public.get_admin_savings_panel('padron',r.source_folio,'todos',0,20);
 if (after_data#>>'{kpis,total}')::numeric<>expected_total-300 then raise exception 'CORRECTED_ACTUAL_TOTAL_MISMATCH';end if;
 if not exists(select 1 from jsonb_array_elements(after_data->'rows')a where a->>'id'=r.id::text and (a->>'saldo')::numeric=opening+50 and (a->>'source_saldo')::numeric=q) then raise exception 'CANONICAL_ROW_STALE';end if;
 if (select source_data from public.savings_review_records where id=r.id)<>source_before then raise exception 'SOURCE_Q_CHANGED';end if;
 if (after_data#>>'{kpis,cobranza,recibido}')::numeric<>250 then raise exception 'LATEST_NATIVE_ACTUAL_WRONG';end if;
 if after_data->>'collection_status'<>'ACTUAL_CONFIRMATION_PENDING' then raise exception 'MISSING_DUE_ACTUAL_NOT_VISIBLE';end if;
 if (after_data#>>'{kpis,prox}')::date<=first_date then raise exception 'NEXT_DATE_STUCK_IN_PAST';end if;
 -- An accepted cessation in the future remains active until its economic date.
 before_data:=after_data;
 update public.savings_enrollments set status='TERMINATED',terminated_at=(first_date+10)::timestamp at time zone 'America/Hermosillo' where id=en;
 after_data:=public.get_admin_savings_panel('padron','','todos',0,20);
 if (after_data#>>'{kpis,activos}')::int<>(before_data#>>'{kpis,activos}')::int then raise exception 'FUTURE_CESSATION_COUNTED_EARLY';end if;
 -- The imported list, state capsule, detail and previous/next navigation use the same current state.
 prior_neighbor:=public.get_admin_savings_panel_neighbor(r.id,'padron','','ahorrando',-1);
 update public.savings_enrollments set status='TERMINATED',terminated_at=first_date::timestamp at time zone 'America/Hermosillo' where id=(select enrollment_id from public.savings_balance_certifications where record_id=r.id);
 if not found then raise exception 'TEST_CERTIFIED_ENROLLMENT_REQUIRED';end if;
 after_data:=public.get_admin_savings_panel('padron',r.source_folio,'ahorrando',0,20);
 if exists(select 1 from jsonb_array_elements(after_data->'rows')a where a->>'id'=r.id::text) then raise exception 'TERMINATED_SAVER_IN_ACTIVE_CAPSULE';end if;
 after_data:=public.get_admin_savings_panel('padron',r.source_folio,'baja',0,20);
 if not exists(select 1 from jsonb_array_elements(after_data->'rows')a where a->>'id'=r.id::text and a->>'estado'='baja' and (a->>'saldo')::numeric=opening+50) then raise exception 'TERMINATED_SAVER_MISSING_BAJA_CAPSULE';end if;
 after_data:=public.get_admin_savings_panel_detail(r.id);
 if after_data#>>'{person,estado}'<>'baja' or (after_data#>>'{person,saldo}')::numeric<>opening+50 or (after_data#>>'{source_person,saldo}')::numeric<>q then raise exception 'CURRENT_DETAIL_AND_SOURCE_CONFLICT';end if;
 if prior_neighbor is not null then
  next_neighbor:=public.get_admin_savings_panel_neighbor((prior_neighbor->>'id')::uuid,'padron','','ahorrando',1);
  if next_neighbor->>'id'=r.id::text then raise exception 'NEIGHBOUR_RETURNED_FILTERED_TERMINATED_SAVER';end if;
 end if;
 if has_function_privilege('anon','public.get_admin_savings_panel(text,text,text,integer,integer)','execute')
  or has_function_privilege('authenticated','public.savings_admin_current_summary()','execute')
  or has_function_privilege('authenticated','public.savings_panel_before_current_summary(text,text,text,integer,integer)','execute') then raise exception 'PRIVATE_HELPER_EXPOSED';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_panel();raise exception 'ANON_SUMMARY_ALLOWED';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',extensions.gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.get_admin_savings_panel();raise exception 'NONADMIN_SUMMARY_ALLOWED';exception when insufficient_privilege then null;end;
end $test$;
`;
async function main(){
 const chain=dependencies.concat(['20260913000300_savings_requests_runtime','20260913000400_savings_source_refresh','20260913000500_savings_account_receipts']).map(name=>body('supabase/migrations/'+name+'.sql')).join('\n');
 const fp=()=>query("select (select md5(string_agg(to_jsonb(r)::text,'' order by id)) from savings_review_records r) reviews,(select count(*) from savings_review_events) events,(select count(*) from savings_transactions) transactions,(select md5(string_agg(to_jsonb(p)::text,'' order by id)) from savings_participants p) participants");
 const before=await fp();
 const recoverCheck="create temporary table summary_reader_before as select oid::regprocedure::text signature,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname in ('get_admin_savings_panel','get_admin_savings_panel_detail','get_admin_savings_panel_neighbor');";
 const recoverVerify="do $$ begin if exists(select 1 from summary_reader_before b where b.definition<>pg_get_functiondef(b.signature::regprocedure)) then raise exception 'READER_RECOVERY_NOT_EXACT';end if;end $$;";
 await query('begin;\n'+chain+'\n'+recoverCheck+'\n'+body(forward)+'\n'+body(recovery)+'\n'+recoverVerify+'\nrollback;');
 console.log('PASS current summary forward + exact-reader recovery ROLLBACK');
 await query('begin;\n'+chain+'\n'+body(forward)+'\n'+checks+'\nrollback;');
 assert.deepEqual(await fp(),before);
 console.log('PASS current totals: reviewed Q, certified balance, native account count, no forecast credit, actual receipts/corrections, immutable source, pending dates, next dates, future cessation, effective state/list/detail/neighbours, admin scope, zero persistent changes');
}
module.exports={checks,forward,recovery};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
