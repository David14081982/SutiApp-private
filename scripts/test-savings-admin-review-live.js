'use strict';
const fs=require('fs'),{query,body}=require('./savings-admin-review-db');
const forward='supabase/migrations/20260906000500_savings_admin_review.sql',recovery='supabase/recovery/20260906000500_savings_admin_review_recovery.sql';
const checks=`do $test$ declare a uuid; b uuid; r uuid; f text; k uuid:=extensions.gen_random_uuid(); out jsonb; t text; begin
 select auth_user_id into a from public.admin_assignments where enabled and 'savings.write'=any(permissions) and 'savings.read'=any(permissions) limit 1;
 if a is null then raise exception 'NO_ADMIN'; end if;
 select numero_control into f from public.affiliates where not coalesce(is_archived,false) and numero_control is not null group by numero_control having count(*)=1 limit 1;
 foreach t in array array['savings_review_batches','savings_review_records','savings_review_events'] loop
  if not exists(select 1 from pg_class where oid=('public.'||t)::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'RLS_REQUIRED';end if;
  if has_table_privilege('authenticated','public.'||t,'select') or has_table_privilege('service_role','public.'||t,'update') then raise exception 'TABLE_EXPOSED';end if;
 end loop;
 if has_function_privilege('anon','public.get_admin_savings_review(uuid)','execute') or has_function_privilege('authenticated','public.savings_review_identity(text)','execute') then raise exception 'INTERNAL_EXPOSURE';end if;
 insert into public.savings_review_batches(source_sha256,source_name,observed_at,expected_records) values(repeat('a',64),'Isolated fixture',now(),1) returning id into b;
 insert into public.savings_review_records(batch_id,source_sheet,source_row,source_folio,source_data,field_defs,raw_source)
 values(b,'Ahorro',2,f,jsonb_build_object('A',f,'Q',1000,'AA',null),'[{"key":"A","kind":"text"},{"key":"Q","kind":"money"},{"key":"AA","kind":"money"}]','{}') returning id into r;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_review(null);raise exception 'ANON_ALLOWED';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',extensions.gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.get_admin_savings_review(r);raise exception 'USER_ALLOWED';exception when insufficient_privilege then null;end;
 begin perform public.admin_save_savings_review(r,0,'{}','RESOLVED',null,k);raise exception 'USER_WRITE_ALLOWED';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 out:=public.get_admin_savings_review(r);if out->>'publication'<>'PRIVATE_REVIEW_ONLY' then raise exception 'PUBLICATION';end if;
 out:=public.admin_save_savings_review(r,0,'{"AA":0,"Q":600}','IN_REVIEW',null,k);
 if out->>'version'<>'1' or out->'proposed_data'->>'AA'<>'0' then raise exception 'ZERO_OR_OPTIONAL_NOTE';end if;
 if public.admin_save_savings_review(r,0,'{"AA":0,"Q":600}','IN_REVIEW','',k)<>out then raise exception 'RETRY';end if;
 if (select count(*) from public.savings_review_events where record_id=r)<>1 then raise exception 'DUPLICATE_RETRY';end if;
 begin perform public.admin_save_savings_review(r,0,'{"Q":999}','IN_REVIEW',null,k);raise exception 'CONFLICT_ACCEPTED';exception when raise_exception then if sqlerrm<>'SAVINGS_REVIEW_RETRY_CONFLICT' then raise;end if;end;
 begin perform public.admin_save_savings_review(r,0,'{}','RESOLVED',null,extensions.gen_random_uuid());raise exception 'STALE_ACCEPTED';exception when raise_exception then if sqlerrm<>'SAVINGS_REVIEW_CHANGED' then raise;end if;end;
 begin perform public.admin_save_savings_review(r,1,'{"bogus":1}','IN_REVIEW',null,extensions.gen_random_uuid());raise exception 'UNKNOWN_FIELD';exception when raise_exception then if sqlerrm<>'SAVINGS_REVIEW_FIELD_INVALID' then raise;end if;end;
 begin perform public.admin_save_savings_review(r,1,'{"Q":1.001}','IN_REVIEW',null,extensions.gen_random_uuid());raise exception 'FRACTION_ACCEPTED';exception when raise_exception then if sqlerrm<>'SAVINGS_REVIEW_MONEY_INVALID' then raise;end if;end;
 perform public.admin_save_savings_review(r,1,'{}','RESOLVED',null,extensions.gen_random_uuid());
 perform public.admin_save_savings_review(r,2,'{"A":"__NO_SUCH_EXACT_FOLIO__"}','IN_REVIEW',null,extensions.gen_random_uuid());
 begin perform public.admin_save_savings_review(r,3,'{}','RESOLVED',null,extensions.gen_random_uuid());raise exception 'MISSING_ID_RESOLVED';exception when raise_exception then if sqlerrm<>'SAVINGS_REVIEW_IDENTITY_PENDING' then raise;end if;end;
 begin update public.savings_review_records set source_data='{}' where id=r;raise exception 'SOURCE_CHANGED';exception when raise_exception then if sqlerrm<>'SAVINGS_REVIEW_SOURCE_IMMUTABLE' then raise;end if;end;
 begin delete from public.savings_review_events where record_id=r;raise exception 'HISTORY_DELETED';exception when raise_exception then if sqlerrm<>'SAVINGS_REVIEW_HISTORY_IMMUTABLE' then raise;end if;end;
 out:=public.get_admin_savings_review(r);if jsonb_array_length(out->'history')<>3 or out->'source_data'->>'Q'<>'1000' then raise exception 'HISTORY';end if;
 if (select count(*) from public.savings_review_records where batch_id=b and source_folio=f)<>1 then raise exception 'FOLIO_SOURCE_CHANGED';end if;
end $test$;`;
async function fingerprint(){return query(`select (select count(*) from public.savings_transactions) transactions,(select count(*) from public.savings_participants) participants,(select count(*) from public.savings_legacy_evidence) evidence,
 md5(pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure)) self_reader`);}
async function main(){
 const exists=await query("select to_regclass('public.savings_review_records') is not null installed");
 const before=await fingerprint();
 await query(`begin; ${exists[0].installed?'':body(forward)} savepoint fixtures; ${checks} rollback to fixtures; ${exists[0].installed?'':body(recovery)} rollback;`);
 const after=await fingerprint();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('PUBLIC_FINANCIAL_STATE_CHANGED');
 const result={status:'PASS',mode:'ROLLBACK',installed:exists[0].installed,checks:['optional observations','source immutable','history immutable','exact Folio','null versus zero','idempotency','stale version','missing identity blocked','private permissions','self reader unchanged'],before,after};
 fs.mkdirSync('docs/qa/evidence/savings-admin-review-20260906',{recursive:true});fs.writeFileSync('docs/qa/evidence/savings-admin-review-20260906/sql-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
module.exports={forward,recovery,checks,fingerprint};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
