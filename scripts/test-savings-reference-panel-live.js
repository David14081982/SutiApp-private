'use strict';
const fs=require('fs'),assert=require('assert/strict'),{query,body}=require('./savings-admin-review-db'),{fingerprint}=require('./test-savings-admin-review-live');
const forward='supabase/migrations/20260906001000_savings_reference_panel.sql',recovery='supabase/recovery/20260906001000_savings_reference_panel_recovery.sql';
async function reviewFingerprint(){return query(`select
 (select count(*) from public.savings_review_records) records,
 (select md5(string_agg(to_jsonb(r)::text,'' order by id)) from public.savings_review_records r) records_hash,
 (select count(*) from public.savings_review_events) events,
 (select md5(string_agg(to_jsonb(e)::text,'' order by id)) from public.savings_review_events e) events_hash,
 (select md5(string_agg(to_jsonb(p)::text,'' order by id)) from public.savings_participants p) participants_hash`);}
async function main(){
 const before=await fingerprint();
 const reviewBefore=await reviewFingerprint();
 const installed=(await query("select to_regprocedure('public.get_admin_savings_panel(text,text,text,integer,integer)') is not null installed"))[0].installed;
 const result=await query(`begin;${installed?'':body(forward)}
 do $$ declare actor uuid;rid uuid;rec public.savings_review_records;v jsonb;w jsonb;key uuid;candidate record;begin
 select auth_user_id into actor from public.admin_assignments where enabled and 'savings.read'=any(permissions) and 'savings.write'=any(permissions) limit 1;
 if actor is null then raise exception 'ADMIN_REQUIRED';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.get_admin_savings_panel();raise exception 'ANON_LEAK';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',extensions.gen_random_uuid(),'role','authenticated')::text,true);
 begin perform public.get_admin_savings_panel();raise exception 'USER_LEAK';exception when insufficient_privilege then null;end;
 begin perform public.admin_save_savings_panel(extensions.gen_random_uuid(),0,'{}','PENDING',null,extensions.gen_random_uuid());raise exception 'WRITE_LEAK';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 v:=public.get_admin_savings_panel('padron');
 if (v->>'total')::int<>(select count(*) from public.savings_review_records where source_sheet='Ahorro') then raise exception 'ROW_LOSS';end if;
 if jsonb_array_length(v->'rows')>20 or (v->'kpis'->>'total')::numeric<>(select sum((source_data->>'Q')::numeric) from public.savings_review_records where source_sheet='Ahorro') then raise exception 'PAGINATION_OR_SUM';end if;
 w:=public.get_admin_savings_panel('padron','','todos',20,20);
 if exists(select 1 from jsonb_array_elements(v->'rows') a join jsonb_array_elements(w->'rows') b on a->>'id'=b->>'id') then raise exception 'PAGINATION_OVERLAP';end if;
 if public.get_admin_savings_panel_neighbor((v->'rows'->19->>'id')::uuid,'padron','','todos',1)->>'id'<>w->'rows'->0->>'id' then raise exception 'NEXT_ACROSS_PAGE';end if;
 if public.get_admin_savings_panel_neighbor((w->'rows'->0->>'id')::uuid,'padron','','todos',-1)->>'id'<>v->'rows'->19->>'id' then raise exception 'PREVIOUS_ACROSS_PAGE';end if;
 v:=public.get_admin_savings_panel('padron','11402');
 if not exists(select 1 from jsonb_array_elements(v->'rows') a where a->>'folio'='11402') then raise exception 'OWNER_FOLIO_MISSING';end if;
 rid:=(v->'rows'->0->>'id')::uuid;
 w:=public.get_admin_savings_panel_detail(rid);
 if (w->>'withdrawn_total')::numeric<>6768.64 then raise exception 'OWNER_WITHDRAWAL_TOTAL';end if;
 if not exists(select 1 from jsonb_array_elements(w->'withdrawals'->'records') a where (a->'source_data'->>'G')::numeric=6768.64 and a->'source_data'->>'D'='1/7/2026') then raise exception 'OWNER_WITHDRAWAL_MISSING';end if;
 v:=public.get_admin_savings_panel('padron','__no_match_folio__');
 if (v->>'total')::int<>0 or jsonb_array_length(v->'rows')<>0 then raise exception 'EMPTY';end if;
 v:=public.get_admin_savings_panel('padron','','ahorrando');
 if exists(select 1 from jsonb_array_elements(v->'rows') a where a->>'estado'<>'ahorrando') then raise exception 'STATE_FILTER';end if;
 select * into rec from public.savings_review_records where source_sheet='Ahorro' and source_folio='4944';
 if rec.id is null then raise exception 'CASE_NOT_FOUND';end if;
 v:=public.get_admin_savings_panel('padron',split_part(public.savings_review_identity('4944')->>'name',' ',1));
 if not exists(select 1 from jsonb_array_elements(v->'rows') a where a->>'id'=rec.id::text) then raise exception 'NAME_SEARCH';end if;
 v:=public.get_admin_savings_panel_detail(rec.id);
 if jsonb_array_length(v->'dates')<>6 or exists(select 1 from jsonb_array_elements(v->'dates') a where a->>'label' like '%Proyección%') then raise exception 'DATE_HISTORY';end if;
 key:=extensions.gen_random_uuid();
 v:=public.admin_save_savings_panel(rec.id,rec.version,'{"AY":123.45}',rec.status,null,key);
 w:=public.admin_save_savings_panel(rec.id,rec.version,'{"AY":123.45}',rec.status,null,key);
 if v<>w or (select count(*) from public.savings_review_events where client_action_id=key)<>1 then raise exception 'IDEMPOTENCY';end if;
 if not exists(select 1 from public.savings_review_events where client_action_id=key and actor_real_auth_user_id=actor and observation is null and before_data->>'version'=rec.version::text) then raise exception 'ACTOR_OR_OPTIONAL_NOTE';end if;
 w:=public.get_admin_savings_panel_detail(rec.id);
 if (w->'person'->>'saldo')::numeric<>(rec.source_data->>'Q')::numeric or (w->'person'->>'correccion')::numeric<>123.45-coalesce((rec.source_data->>'AY')::numeric,0) then raise exception 'SOURCE_OR_PRIVATE_DELTA';end if;
 begin perform public.admin_save_savings_panel(rec.id,rec.version,'{"R":400}',rec.status,null,extensions.gen_random_uuid());raise exception 'STALE_ACCEPTED';exception when others then if sqlerrm<>'SAVINGS_REVIEW_CHANGED' then raise;end if;end;
 begin perform public.admin_save_savings_panel(rec.id,rec.version+1,'{"Q":1}',rec.status,null,extensions.gen_random_uuid());raise exception 'BALANCE_WRITABLE';exception when others then if sqlerrm<>'SAVINGS_PANEL_DERIVED_READONLY' then raise;end if;end;
 begin perform public.admin_save_savings_panel(rec.id,rec.version+1,'{"AY":-1}',rec.status,null,extensions.gen_random_uuid());raise exception 'NEGATIVE_ACCEPTED';exception when others then if sqlerrm<>'SAVINGS_PANEL_AMOUNT_INVALID' then raise;end if;end;
 key:=extensions.gen_random_uuid();
 v:=public.admin_reset_savings_panel_discount(rec.id,rec.version+1,'AY',null,key);
 w:=public.admin_reset_savings_panel_discount(rec.id,rec.version+1,'AY',null,key);
 if v<>w or v->'proposed_data' ? 'AY' then raise exception 'RESET_IDEMPOTENCY';end if;
 w:=public.get_admin_savings_panel_detail(rec.id);
 if (w->'person'->>'correccion')::numeric<>0 then raise exception 'REMOVE_CORRECTION';end if;
 v:=public.admin_save_savings_panel(rec.id,rec.version+2,'{}','RESOLVED',null,extensions.gen_random_uuid());
 v:=public.admin_save_savings_panel(rec.id,rec.version+3,'{}','IN_REVIEW',null,extensions.gen_random_uuid());
 if v->>'status'<>'IN_REVIEW' then raise exception 'REOPEN';end if;
 for candidate in select distinct on (jsonb_typeof(r.source_data->(f->>'key'))) r.id,r.version,r.status,f->>'key' field,r.source_data->(f->>'key') original
  from public.savings_review_records r cross join lateral jsonb_array_elements(r.field_defs) f
  where r.source_sheet='Ahorro' and f->>'label' like '%Descuento registrado%' and jsonb_typeof(r.source_data->(f->>'key')) in ('null','string')
 loop
  perform public.admin_save_savings_panel(candidate.id,candidate.version,jsonb_build_object(candidate.field,987.65),candidate.status,null,extensions.gen_random_uuid());
  perform public.admin_reset_savings_panel_discount(candidate.id,candidate.version+1,candidate.field,null,extensions.gen_random_uuid());
  if exists(select 1 from public.savings_review_records r where r.id=candidate.id and (r.proposed_data ? candidate.field or r.source_data->candidate.field is distinct from candidate.original)) then raise exception 'RESET_BLANK_OR_INVALID_SOURCE';end if;
 end loop;
 if has_function_privilege('anon','public.get_admin_savings_panel(text,text,text,integer,integer)','execute') or has_function_privilege('authenticated','public.savings_panel_people(uuid)','execute') then raise exception 'GRANTS';end if;
 perform set_config('test.panel_record',rec.id::text,true);
 end $$;
 set local role authenticated;
 select public.get_admin_savings_panel_detail(current_setting('test.panel_record')::uuid)->'person'->>'status' reviewed;
 reset role;
 ${body(recovery)}rollback;`);
 assert.deepEqual(await fingerprint(),before);
 assert.deepEqual(await reviewFingerprint(),reviewBefore);
 const report={status:'PASS',scope:'PRIVATE_REVIEW_ONLY',mode:'ROLLBACK',installed,checks:['real imported count and recognized Q aggregate','20-row pagination without overlap','name and exact-text Folio search','state filter','empty result','11402 withdrawal D and G preserved','latest six dated source values, future excluded','optional observation and authenticated actor','idempotent retry','stale version rejected','derived balance not writable','negative discount rejected','correction private delta only','remove correction restores original','mark reviewed and reopen','anonymous and ordinary user blocked','helper not exposed','recovery and financial fingerprint unchanged'],result};
 fs.mkdirSync('docs/qa/evidence/savings-reference-panel-20260906',{recursive:true});fs.writeFileSync('docs/qa/evidence/savings-reference-panel-20260906/sql-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={forward,recovery,reviewFingerprint};
