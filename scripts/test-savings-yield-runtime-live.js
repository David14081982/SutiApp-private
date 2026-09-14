'use strict';
// Real Savings functions; fixtures and schema changes always end in ROLLBACK.
const {query,body}=require('./savings-admin-review-db');
const {dependencies}=require('./test-savings-requests-runtime-live');
const {checks:originalYieldChecks}=require('./test-savings-yield-live');
const {checks:originalCertificationChecks}=require('./test-savings-certification-live');
const extension=String.raw`
 begin
  update public.savings_yield_periods set status='DISABLED' where id=period_id;
  result:=public.preview_savings_period_yield(period_id);
  if result->>'state'<>'DISABLED' then raise exception 'DISABLED_PERIOD_REVIEWABLE';end if;
  begin perform public.admin_confirm_savings_period_yield(period_id,result->>'fingerprint','Disabled period rollback test',extensions.gen_random_uuid());raise exception 'DISABLED_PERIOD_REACTIVATED';exception when raise_exception then if sqlerrm<>'SAVINGS_YIELD_PERIOD_DISABLED' then raise;end if;end;
  if (select status from public.savings_yield_periods where id=period_id)<>'DISABLED' or exists(select 1 from public.savings_yield_allocations where yield_period_id=period_id) then raise exception 'DISABLED_PERIOD_MUTATED';end if;
  raise exception 'RESET_DISABLED_TEST';
 exception when raise_exception then if sqlerrm<>'RESET_DISABLED_TEST' then raise;end if;end;
 begin
  update public.savings_enrollments set status='TERMINATED',terminated_at='2026-09-06T00:00:00-07',continue_saving=false where id=target_en;
  result:=public.preview_savings_period_yield(period_id);
  select x into item from jsonb_array_elements(result->'rows')x where x->>'participant_id'=ids[1]::text;
  if item->>'status'<>'ELIGIBLE' or item->>'enrollment_id'<>target_en::text then raise exception 'LATER_CESSATION_REMOVED_CUTOFF_YIELD %',item;end if;
  insert into public.savings_enrollments(participant_id,sequence_number,status,enrollment_started_at,approved_at,first_expected_contribution_date,process_snapshot,data_classification)
   values(ids[1],2,'ACTIVE','2026-09-07T00:00:00-07',clock_timestamp(),'2026-10-05','JUB','CANONICAL') returning id into en;
  insert into public.savings_contribution_plans(enrollment_id,amount,process_snapshot,effective_from,data_classification) values(en,900,'JUB','2026-10-05','CANONICAL');
  result:=public.preview_savings_period_yield(period_id);
  select x into item from jsonb_array_elements(result->'rows')x where x->>'participant_id'=ids[1]::text;
  if item->>'status'<>'ELIGIBLE' or item->>'enrollment_id'<>target_en::text or (item->>'yield_amount')::numeric<>1250 then raise exception 'LATER_RENEWAL_REPLACED_CUTOFF_ENROLLMENT %',item;end if;
  raise exception 'RESET_LIFECYCLE_TEST';
 exception when raise_exception then if sqlerrm<>'RESET_LIFECYCLE_TEST' then raise;end if;end;
`;
const marker=" fingerprint:=preview->>'fingerprint';";
if(!originalYieldChecks.includes(marker))throw Error('Yield test anchor changed');
const yieldChecks=originalYieldChecks.replace(marker,()=>extension+marker);
const sourceMarker=" begin perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',500";
if(!originalCertificationChecks.includes(sourceMarker))throw Error('Certification test anchor changed');
const sourceChecks=originalCertificationChecks.slice(0,originalCertificationChecks.indexOf(sourceMarker)).replace('receipt_key uuid; begin','receipt_key uuid; period_id uuid;avail uuid;person_id uuid;row_result jsonb;other_actor uuid; begin')+String.raw`
 person_id:=(result->>'participant_id')::uuid;
 begin
  update public.savings_publication_state set mode='PUBLISHED',published_at=clock_timestamp(),actor_real_auth_user_id=actor where id;
  if public.get_admin_savings_financial_account(r.id)->>'publication'<>'PUBLISHED' then raise exception 'CERTIFIED_READER_FALSE_PRIVATE_PUBLICATION';end if;
  raise exception 'RESET_PUBLICATION_DTO_TEST';
 exception when raise_exception then if sqlerrm<>'RESET_PUBLICATION_DTO_TEST' then raise;end if;end;
 execute $clock$create or replace function public.savings_operation_today() returns date language sql stable set search_path='' as 'select date ''2026-09-15'''$clock$;
 perform public.admin_confirm_savings_receipt(r.id,'2026-09-15',(cmd->>'amount')::numeric,0,null,extensions.gen_random_uuid());
 insert into public.savings_yield_periods(period_year,semester,starts_on,ends_on)values(2026,2,'2026-07-01','2026-12-31')returning id into period_id;
 insert into public.savings_action_availability(action_code,scope_type,enabled,reason,effective_from,effective_to,configured_by_auth_user_id)
  values('WITHDRAW','GLOBAL',true,'Rollback source review audit','2026-09-15T00:00:00-07','2026-09-17T00:00:00-07',actor) returning id into avail;
 insert into public.savings_withdrawal_openings(availability_id,yield_period_id,cutoff_on,percentage,opening_kind,reason,actor_real_auth_user_id,client_action_id)
  values(avail,period_id,'2026-09-15',12.5,'EARLY','Rollback source review audit',actor,extensions.gen_random_uuid());
 pre:=public.preview_savings_period_yield(period_id);
 select x into row_result from jsonb_array_elements(pre->'rows')x where x->>'participant_id'=person_id::text;
 if row_result->>'status'<>'ELIGIBLE' then raise exception 'CERTIFIED_CUTOFF_FIXTURE_NOT_ELIGIBLE %',row_result;end if;
 -- Another existing operator, when available, uses the same public review writer.
 select auth_user_id into other_actor from public.admin_assignments where enabled and auth_user_id<>actor and ('*'=any(permissions) or 'savings.read'=any(permissions))limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',coalesce(other_actor,actor),'role','authenticated')::text,true);
 select * into r from public.savings_review_records where id=r.id;
 perform public.admin_save_savings_panel(r.id,r.version,jsonb_build_object('AC',coalesce(public.savings_panel_number(r.source_data->'AC'),0)+50),'RESOLVED',null,extensions.gen_random_uuid());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 pre:=public.preview_savings_period_yield(period_id);
 select x into row_result from jsonb_array_elements(pre->'rows')x where x->>'participant_id'=person_id::text;
 if row_result->>'status'<>'REVIEW_REQUIRED' or row_result->>'reason'<>'Correcciones del saldo pendientes de confirmar' then raise exception 'CHANGED_SOURCE_EARNED_YIELD %',row_result;end if;
 perform public.admin_confirm_savings_period_yield(period_id,pre->>'fingerprint','Rollback changed source audit',extensions.gen_random_uuid());
 if exists(select 1 from public.savings_yield_allocations where participant_id=person_id and yield_period_id=period_id) then raise exception 'UNCONFIRMED_SOURCE_ALLOCATED';end if;
 pre:=public.get_admin_savings_financial_account(r.id);
 perform public.admin_adjust_savings_balance(r.id,(pre#>>'{balance,capital}')::numeric,0,pre->>'balance_version',null,extensions.gen_random_uuid());
 pre:=public.preview_savings_period_yield(period_id);
 select x into row_result from jsonb_array_elements(pre->'rows')x where x->>'participant_id'=person_id::text;
 if row_result->>'status'<>'ELIGIBLE' then raise exception 'EXPLICIT_SOURCE_CONFIRMATION_NOT_RECOGNIZED %',row_result;end if;
 begin
  insert into public.savings_source_observations(record_id,source_sha,observed_at,source_total,changes)values(r.id,repeat('f',64),clock_timestamp(),(cmd->>'capital')::numeric,'[]');
  pre:=public.preview_savings_period_yield(period_id);
  select x into row_result from jsonb_array_elements(pre->'rows')x where x->>'participant_id'=person_id::text;
  if row_result->>'status'<>'REVIEW_REQUIRED' or row_result->>'reason'<>'Correcciones del saldo pendientes de confirmar' then raise exception 'PENDING_SOURCE_CAPTURE_EARNED_YIELD %',row_result;end if;
  raise exception 'RESET_SOURCE_CAPTURE_TEST';
 exception when raise_exception then if sqlerrm<>'RESET_SOURCE_CAPTURE_TEST' then raise;end if;end;
 pre:=public.preview_savings_period_yield(period_id);
 perform public.admin_confirm_savings_period_yield(period_id,pre->>'fingerprint','Rollback confirmed source audit',extensions.gen_random_uuid());
 if not exists(select 1 from public.savings_yield_allocations where participant_id=person_id and yield_period_id=period_id and status='CREDITED') then raise exception 'CONFIRMED_SOURCE_NOT_CREDITED';end if;
end $t$;
`;
async function main(){
 const names=dependencies.concat(['20260913000300_savings_requests_runtime','20260913000400_savings_source_refresh','20260913000500_savings_account_receipts']);
 const chain=names.map(n=>body('supabase/migrations/'+n+'.sql')).join('\n');
 await query('begin;\n'+chain+'\n'+names.slice().reverse().map(n=>body('supabase/recovery/'+n+'_recovery.sql')).join('\n')+'\nrollback;');
 console.log('PASS complete Savings chain and recovery ROLLBACK');
 await query('begin;\n'+chain+'\n'+yieldChecks+'\nrollback;');
 console.log('PASS absent/zero/manual rate, six months, no future capital, historical Q boundary, cutoff lifecycle/renewal, disabled period, duplicate protection; ROLLBACK');
 await query('begin;\n'+chain+'\n'+sourceChecks+'\nrollback;');
 console.log('PASS certified source correction blocks yield until explicit balance review; pending source observation blocks yield; ROLLBACK');
}
module.exports={yieldChecks,sourceChecks};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
