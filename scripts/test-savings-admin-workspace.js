'use strict';
// Synthetic, memory-only PostgreSQL. No credentials, network, files or production data.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const actor='10000000-0000-0000-0000-000000000001',affiliate='20000000-0000-0000-0000-000000000001';
const participant='30000000-0000-0000-0000-000000000001',enrollment='40000000-0000-0000-0000-000000000001',record='50000000-0000-0000-0000-000000000001';
function definition(file,name){const sql=read(file),match=new RegExp('create(?: or replace)? function public\\.'+name+'\\(' ,'i').exec(sql);assert(match,name+' definition');const start=match.index,body=sql.indexOf('$$',start),end=sql.indexOf('$$;',body+2);assert(end>body);return sql.slice(start,end+3);}
async function main(){
 const {PGlite}=require(process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
 const db=new PGlite();
 const value=async sql=>(await db.query(sql)).rows[0].value;
 const person=()=>value(`select get_admin_savings_workspace_person('${participant}') value`);
 const people=(filter='todos',offset=0,limit=20)=>value(`select get_admin_savings_workspace_people('','${filter}',${offset},${limit}) value`);
 const migration=read('supabase/migrations/20261001000200_savings_admin_workspace.sql'),recovery=read('supabase/recovery/20261001000200_savings_admin_workspace.sql');
 try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function public.has_admin_permission(p text) returns boolean language sql stable as $$select coalesce(p=any(string_to_array(current_setting('test.permissions',true),',')),false)$$;
 create function public.savings_operation_today() returns date language sql stable as $$select '2026-10-01'::date$$;
 create table affiliates(id uuid primary key,numero_control text,full_name text,is_archived boolean default false);
 create table savings_participants(id uuid primary key,affiliate_id uuid,legacy_folio text,display_name text,identity_status text,certification_status text,data_classification text,current_process text);
 create table savings_enrollments(id uuid primary key,participant_id uuid,sequence_number integer,status text,enrollment_started_at timestamptz,first_expected_contribution_date date,first_actual_contribution_date date,terminated_at timestamptz,data_classification text);
 create table savings_contribution_plans(id uuid primary key,enrollment_id uuid,amount numeric,process_snapshot text,effective_from date,effective_to date,data_classification text);
 create table savings_balance_certifications(id uuid primary key,participant_id uuid,record_id uuid,cutoff_on date,source_snapshot jsonb,command jsonb);
 create table savings_review_records(id uuid primary key,field_defs jsonb,source_data jsonb,proposed_data jsonb);
 create table savings_contribution_overrides(id uuid primary key default gen_random_uuid(),enrollment_id uuid,contribution_date date,actual_amount numeric,expected_amount numeric,version_number integer);
 create table savings_transactions(id uuid primary key default gen_random_uuid(),participant_id uuid,enrollment_id uuid,transaction_type text,component text,direction text,amount numeric,contribution_date date,data_classification text);
 create table savings_holds(participant_id uuid,component text,amount numeric,status text);
 create table savings_requests(id uuid primary key default gen_random_uuid(),participant_id uuid,status text,request_type text,data_classification text default 'CANONICAL',metadata jsonb default '{"origin":"SAVINGS_RUNTIME_V1"}');
 create function public.get_admin_savings_panel(text,text,text,integer,integer) returns jsonb language sql stable as $$select '{"kpis":{"padron":3,"afiliados":4,"total":1000},"collection_status":"ACTUAL_CONFIRMATION_PENDING","publication_mode":"PUBLISHED"}'::jsonb$$;
 insert into affiliates values('${affiliate}','001','Persona de prueba',false),('20000000-0000-0000-0000-000000000002','002','Alta pendiente',false),('20000000-0000-0000-0000-000000000003','003','Persona jubilada',false);
 insert into savings_participants values('${participant}','${affiliate}','001','Persona histórica','RESOLVED','CERTIFIED','CANONICAL','PROCESS_1'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','002','Alta pendiente','RESOLVED','PENDING_REVIEW','CANONICAL','PROCESS_1'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','003','Persona jubilada','RESOLVED','CERTIFIED','CANONICAL','JUB');
 insert into savings_enrollments values('${enrollment}','${participant}',1,'ACTIVE','2026-01-15 07:00Z','2026-09-30','2026-01-15',null,'CANONICAL'),
 ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003',1,'ACTIVE','2026-09-20 07:00Z','2026-10-05',null,null,'CANONICAL');
 insert into savings_contribution_plans values('60000000-0000-0000-0000-000000000001','${enrollment}',300,'PROCESS_1','2026-09-30',null,'CANONICAL'),
 ('60000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003',500,'JUB','2026-10-05',null,'CANONICAL');
 insert into savings_review_records values('${record}','[{"key":"AR","label":"2026-06-30 Descuento registrado"},{"key":"J","label":"2026-09-05 Descuento registrado"},{"key":"K","label":"2026-09-15 Descuento registrado"},{"key":"L","label":"2026-09-30 Descuento registrado"}]',
 '{"AR":350,"J":900,"K":300,"L":777,"D":"1"}','{"K":9999,"L":8888}');
 insert into savings_balance_certifications values('70000000-0000-0000-0000-000000000001','${participant}','${record}','2026-09-15',
 '{"source":{"AR":350,"J":900,"K":300,"L":777,"D":"1"},"proposal":{"K":310}}','{"first_date":"2026-01-15","process":"PROCESS_1"}');
 insert into savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,contribution_date,data_classification) values('${participant}','${enrollment}','REGULARIZATION','CAPITAL','CREDIT',1000,null,'CANONICAL');
 insert into savings_requests(participant_id,status,request_type) values('30000000-0000-0000-0000-000000000002','SUBMITTED','JOIN');
 select set_config('test.actor','${actor}',false);select set_config('test.permissions','savings.read',false);
 `);
 for(const [file,name] of [
 ['supabase/migrations/20260906001000_savings_reference_panel.sql','savings_panel_number'],
 ['supabase/migrations/20260906001000_savings_reference_panel.sql','savings_panel_date'],
 ['supabase/migrations/20260902000100_savings_shadow_foundation.sql','savings_participant_balance'],
 ['supabase/migrations/20260906000100_savings_operations.sql','savings_next_contribution_date'],
 ['supabase/migrations/20260906000100_savings_operations.sql','generate_savings_schedule'],
 ['supabase/migrations/20260913000500_savings_account_receipts.sql','savings_enrollment_effective_status']])await db.exec(definition(file,name));
 const dataHash=()=>value("select md5(string_agg(x::text,',' order by x::text)) value from (select to_jsonb(t) x from savings_transactions t union all select to_jsonb(r) from savings_review_records r union all select to_jsonb(c) from savings_balance_certifications c union all select to_jsonb(e) from savings_enrollments e union all select to_jsonb(p) from savings_participants p) q");
 const before=await dataHash();await db.exec(migration);assert.equal(await dataHash(),before,'migration preserves financial/history rows');
 let d=await person();
 assert.equal(d.last_received,'2026-09-15');assert.deepEqual(d.next_expected,{date:'2026-10-15',amount:300});
 assert.equal(d.balance.total,1000,'opening balance not reconstructed by summing timeline');assert.equal(d.pending.count,1);assert.equal(d.pending.first_date,'2026-09-30');assert.equal(d.pending.expected_amount,300);
 assert.equal(d.history.length,3);assert.equal(d.history[0].status,'PENDING');assert.equal(d.history[0].amount,null);assert.equal(d.history[1].amount,310,'certified snapshot, never current private proposal');assert.equal(d.history[1].status,'CORRECTED');assert.equal(d.history[2].includes_yield,true);
 let list=await people();assert.equal(list.total,3);assert.equal(list.rows.length,3);assert.equal(list.rows.find(r=>r.folio==='002').balance,null);assert.equal(list.rows.find(r=>r.folio==='002').estado,'revision');
 assert.equal(list.rows.find(r=>r.folio==='003').prox,'2026-10-05');assert.equal(list.rows.find(r=>r.folio==='003').ultimo,null,'planned date is not received');
 assert.equal(list.rows.find(r=>r.folio==='003').balance.total,0,'certified native enrollment may have a genuine zero ledger');assert.equal(list.rows.find(r=>r.folio==='003').certified,true);
 assert.equal((await people('incidencias')).total,2);assert.equal((await people('ahorrando')).total,2);assert.equal((await people('revision')).total,1);
 const page1=await people('todos',0,1),page2=await people('todos',1,1);assert.equal(page1.total,3);assert.notEqual(page1.rows[0].id,page2.rows[0].id);
 assert.equal((await value("select get_admin_savings_workspace_people('001') value")).rows[0].folio,'001','control preserves leading zero');
 let summary=await value('select get_admin_savings_workspace_summary() value');assert.equal(summary.attention.pending_receipts,1);assert.deepEqual(summary.attention.periods,[{date:'2026-09-30',count:1,expected_amount:300}]);assert.equal(summary.attention.request_count,1);
 assert.equal(await dataHash(),before,'all readers preserve data');
 await db.exec(`update savings_participants set certification_status='PENDING_REVIEW' where id='${participant}';`);
 d=await person();assert.equal(d.person.certification_pending,true);assert.equal(d.person.certified,false);assert.equal(d.balance,null,'enrollment and opening do not override missing certification');assert.equal(d.person.estado,'revision');
 await db.exec(`update savings_participants set certification_status='CERTIFIED' where id='${participant}';update savings_participants set certification_status='CERTIFIED' where legacy_folio='002';`);
 assert.equal((await people()).rows.find(r=>r.folio==='002').balance,null,'certified pending registration without an enrollment is not a confirmed zero account');
 await db.exec(`insert into savings_requests(participant_id,status,request_type) values('${participant}','APPROVED','TERMINATE'),('${participant}','APPROVED','JOIN'),('${participant}','APPROVED','CHANGE_AMOUNT'),('${participant}','SETTLED','WITHDRAW');`);
 summary=await value('select get_admin_savings_workspace_summary() value');assert.equal(summary.attention.request_count,1,'approved cessation/registration/change has no remaining decision or payout');assert.equal(summary.attention.pending_decisions,1);assert.equal(summary.attention.awaiting_delivery,0);
 await db.exec(`insert into savings_requests(participant_id,status,request_type) values('${participant}','APPROVED','WITHDRAW'),('${participant}','APPROVED','EXTRAORDINARY_WITHDRAWAL'),('${participant}','UNDER_REVIEW','TERMINATE');`);
 summary=await value('select get_admin_savings_workspace_summary() value');assert.equal(summary.attention.pending_decisions,2);assert.equal(summary.attention.awaiting_delivery,2);assert.equal(summary.attention.request_count,4);
 await db.exec(`insert into savings_requests(participant_id,status,request_type,data_classification,metadata) values('${participant}','SUBMITTED','JOIN','SHADOW','{"origin":"SAVINGS_RUNTIME_V1"}'),('${participant}','SUBMITTED','JOIN','CANONICAL','{"origin":"IMPORT"}');`);
 assert.equal((await value('select get_admin_savings_workspace_summary() value')).attention.request_count,4,'only canonical runtime requests visible in operations count as attention');
 await db.exec(`insert into savings_contribution_overrides(enrollment_id,contribution_date,actual_amount,expected_amount,version_number) values('${enrollment}','2026-09-30',300,300,1);
 insert into savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,contribution_date,data_classification) values('${participant}','${enrollment}','CONTRIBUTION','CAPITAL','CREDIT',300,'2026-09-30','CANONICAL');`);
 d=await person();assert.equal(d.last_received,'2026-09-30');assert.equal(d.balance.total,1300);assert.equal(d.history[0].status,'RECEIVED');assert.equal(d.pending.count,0);assert.equal((await people('incidencias')).total,0);
 await db.exec(`insert into savings_contribution_overrides(enrollment_id,contribution_date,actual_amount,expected_amount,version_number) values('${enrollment}','2026-09-30',0,300,2);
 insert into savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,contribution_date,data_classification) values('${participant}','${enrollment}','ADJUSTMENT','CAPITAL','DEBIT',300,'2026-09-30','CANONICAL');`);
 d=await person();assert.equal(d.history[0].status,'NO_DEDUCTION');assert.equal(d.last_received,'2026-09-15');assert.equal(d.pending.count,0,'confirmed zero is not missing confirmation');assert.equal(d.history_total,3,'versions deduplicated');assert.equal((await people('incidencias')).total,0);
 await db.exec(`insert into savings_contribution_overrides(enrollment_id,contribution_date,actual_amount,expected_amount,version_number) values('${enrollment}','2026-09-30',250,300,3),('${enrollment}','2026-10-15',300,300,1);
 insert into savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,contribution_date,data_classification) values('${participant}','${enrollment}','ADJUSTMENT','CAPITAL','CREDIT',250,'2026-09-30','CANONICAL');`);
 d=await person();assert.equal(d.history[0].status,'CORRECTED');assert.equal(d.history[0].amount,250);assert.equal(d.balance.total,1250);assert.equal(d.last_received,'2026-09-30','future receipt cannot become last received');assert.equal(d.history_total,3);
 const h=await value(`select get_admin_savings_workspace_person('${participant}',1,1) value`);assert.equal(h.history.length,1);assert.equal(h.history_total,3);assert.equal(h.history[0].date,'2026-09-15');
 // Ledger evidence without an override remains visible, with canonical dates and no fake pending task.
 await db.exec(`delete from savings_contribution_overrides where enrollment_id='${enrollment}';`);
 d=await person();assert.equal(d.history[0].source,'CANONICAL_LEDGER');assert.equal(d.history[0].amount,250);assert.equal(d.pending.count,0);
 // A disagreed receipt is visible as an actual conflict, never silently substituted.
 await db.exec(`insert into savings_contribution_overrides(enrollment_id,contribution_date,actual_amount,expected_amount,version_number) values('${enrollment}','2026-09-30',999,300,4);`);
 d=await person();assert.equal(d.history[0].data_conflict,true);assert.equal(d.pending.conflict_count,1);assert.equal((await people('incidencias')).total,1);assert.equal(d.balance.total,1250,'receipt conflict cannot rewrite canonical balance');
 await db.exec(`insert into affiliates values('20000000-0000-0000-0000-000000000004','001','Archived duplicate',true);`);
 assert.equal((await person()).person.folio,'001','archived duplicate cannot change exact active identity');
 await db.exec(`update affiliates set is_archived=false where id='20000000-0000-0000-0000-000000000004';`);
 await assert.rejects(person(),/SAVINGS_EXACT_IDENTITY_REQUIRED/);assert.equal((await people()).rows.find(r=>r.folio==='001').identity_conflict,true);
 await db.exec(`update affiliates set is_archived=true where id='20000000-0000-0000-0000-000000000004';`);
 // A future plan far beyond the global summary horizon retains its true next scheduled date.
 await db.exec(`update savings_contribution_plans set effective_from='2027-01-05' where process_snapshot='JUB';`);
 assert.equal((await people()).rows.find(r=>r.folio==='003').prox,'2027-01-05');
 await assert.rejects(value("select get_admin_savings_workspace_people('','invalid') value"),/SAVINGS_PAGE_INVALID/);
 await assert.rejects(value(`select get_admin_savings_workspace_person('${participant}',0,1000) value`),/SAVINGS_PAGE_INVALID/);
 await db.exec("select set_config('test.permissions','',false)");await assert.rejects(person(),/SAVINGS_READ_DENIED/);await assert.rejects(people(),/SAVINGS_READ_DENIED/);await assert.rejects(value('select get_admin_savings_workspace_summary() value'),/SAVINGS_READ_DENIED/);
 await db.exec("select set_config('test.permissions','savings.read',false);select set_config('test.actor','',false)");await assert.rejects(person(),/SAVINGS_READ_DENIED/);
 await db.exec(`select set_config('test.actor','${actor}',false)`);
 for(const name of ['get_admin_savings_workspace_summary()','get_admin_savings_workspace_people(text,text,integer,integer)','get_admin_savings_workspace_person(uuid,integer,integer)']){
  assert.equal(await value(`select has_function_privilege('authenticated','${name}','EXECUTE') value`),true);
  assert.equal(await value(`select has_function_privilege('anon','${name}','EXECUTE') value`),false);
 }
 for(const name of ['savings_workspace_receipts(uuid)','savings_workspace_history(uuid)','savings_workspace_person_row(uuid)'])for(const role of ['anon','authenticated','service_role'])assert.equal(await value(`select has_function_privilege('${role}','${name}','EXECUTE') value`),false);
 const beforeRecovery=await dataHash();await db.exec(recovery);assert.equal(await dataHash(),beforeRecovery,'recovery preserves every financial/history row');assert.equal(await value("select count(*)::integer value from pg_proc where proname like '%savings_workspace%' or proname like 'savings_workspace%'") ,0);
 await db.exec(migration);await person();
 console.log('PASS savings workspace: snapshot history, canonical ledger/receipts, 15SEP/30SEP/15OCT, no invented receipts, latest correction/zero, precise conflicts, pending enrollment, future plan, unified pages, history pages, permissions/grants, read-only/recovery and reinstall.');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.where||'',e.position||'');process.exitCode=1;});
