'use strict';
// Metadata-only receipts. Dry run and recovery roll back; --apply installs only the reader.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'), privateDir=process.env.SUTIAPP_BANK_AUDIT_DIR||'C:/tmp/sutiapp-request-banking-20260908';
const env={};for(const l of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20260908000500_admin_request_bank_reference.sql'),'utf8').replace(/\r\n/g,'\n');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/20260908000500_admin_request_bank_reference_recovery.sql'),'utf8').replace(/\r\n/g,'\n');
const body=s=>s.trim().replace(/^begin;\s*/i,'').replace(/\s*commit;$/i,'');
const before=JSON.parse(fs.readFileSync(path.join(privateDir,'before.json'),'utf8'))[0];
const actor=JSON.parse(fs.readFileSync('C:/tmp/sutiapp-request-delete-20260908/admin-actor.json','utf8')).id;
assert(/^[0-9a-f-]{36}$/i.test(actor));
const meta="select oid,proacl::text acl,pg_get_functiondef(oid) definition from pg_proc where oid='public.get_admin_finance_request_flow_detail(uuid)'::regprocedure";
async function query(query,write=false){const r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:!write}),signal:AbortSignal.timeout(120000)});const data=await r.json();if(!r.ok){fs.writeFileSync(path.join(privateDir,'sql-error.json'),JSON.stringify(data));throw Error('SQL failed; private diagnostic saved, HTTP '+r.status);}return data;}
const assertSql=(expression,message)=>`do $check$ begin if not (${expression}) then raise exception '${message}'; end if; end $check$;`;
const evidence=path.join(root,'docs/qa/evidence/admin-request-bank-reference-20260908');
async function main(){
 const live=(await query(meta))[0];
 if(!process.argv.includes('--verify-installed'))assert.equal(live.definition,before.definition,'reader drift since backup');
 assert.equal(live.oid,before.oid);assert.equal(live.acl,before.acl);
 if(process.argv.includes('--verify-installed')){
  assert.equal(live.definition.trim().replace(/;$/,'').trim(),body(sql).trim().replace(/;$/,'').trim());
  fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'migration.json'),JSON.stringify({status:'PASS',version:'20260908000500',oidAndGrantsPreserved:true,readerExact:true,businessWrites:0},null,2)+'\n');console.log(JSON.stringify({status:'PASS',installed:true,oidAndGrantsPreserved:true}));return;
 }
 const transaction=`begin;
 select set_config('request.jwt.claim.sub','${actor}',true);
 ${assertSql("public.has_admin_permission('program_requests.read') and public.has_admin_permission('bank_accounts.read')",'test actor lacks existing permissions')}
 create temporary table before_detail on commit drop as select id,public.get_admin_finance_request_flow_detail(id) detail from public.program_requests;
 create temporary table before_data on commit drop as select
 (select md5(jsonb_agg(to_jsonb(t) order by request_id)::text) from public.loan_request_deposit_snapshots t) snapshots,
 (select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.affiliate_bank_accounts t) accounts,
 (select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.program_requests t) requests;
 ${body(sql)}
 ${assertSql("not exists(select 1 from before_detail where detail is distinct from (public.get_admin_finance_request_flow_detail(id)-'deposit_reference'))",'existing detail changed')}
 ${assertSql(`not exists(select 1 from public.program_requests r left join public.loan_request_deposit_snapshots d on d.request_id=r.id and d.affiliate_id=r.affiliate_id where public.get_admin_finance_request_flow_detail(r.id)->'deposit_reference' is distinct from case when d.request_id is null then jsonb_build_object('status','not_recorded') when d.source_bank_account_id is null then jsonb_build_object('status','not_selected') else jsonb_strip_nulls(jsonb_build_object('status','available','bank_name',d.bank_name,'account_holder',d.account_holder,'card_number',d.card_number,'clabe',d.clabe)) end)`,'projection differs from captured snapshot')}
 ${assertSql("exists(select 1 from public.program_requests where folio='SR-2026-000195' and public.get_admin_finance_request_flow_detail(id)#>>'{deposit_reference,status}'='available')",'target snapshot missing')}
 ${assertSql("not has_table_privilege('authenticated','public.loan_request_deposit_snapshots','SELECT') and not has_table_privilege('anon','public.loan_request_deposit_snapshots','SELECT')",'private table exposed')}
 savepoint bank_permission;
 delete from public.admin_role_permissions where permission='bank_accounts.read' and role_id in(select role_id from public.admin_assignments where auth_user_id='${actor}');
 ${assertSql("public.has_admin_permission('program_requests.read') and not public.has_admin_permission('bank_accounts.read')",'permission denial not exercised')}
 ${assertSql("not exists(select 1 from before_detail where public.get_admin_finance_request_flow_detail(id)->'deposit_reference' <> '{\"status\":\"forbidden\"}'::jsonb or detail is distinct from(public.get_admin_finance_request_flow_detail(id)-'deposit_reference'))",'bank permission leak')}
 rollback to bank_permission;
 select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 do $check$ begin perform public.get_admin_finance_request_flow_detail((select id from public.program_requests limit 1)); raise exception 'unassigned allowed'; exception when insufficient_privilege then null; end $check$;
 select set_config('request.jwt.claim.sub','',true);
 do $check$ begin perform public.get_admin_finance_request_flow_detail((select id from public.program_requests limit 1)); raise exception 'anonymous allowed'; exception when insufficient_privilege then null; end $check$;
 select set_config('request.jwt.claim.sub','${actor}',true);
 ${assertSql(`(select snapshots is not distinct from(select md5(jsonb_agg(to_jsonb(t) order by request_id)::text) from public.loan_request_deposit_snapshots t) and accounts is not distinct from(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.affiliate_bank_accounts t) and requests is not distinct from(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.program_requests t) from before_data)`,'business data changed')}
 create temporary table receipt on commit drop as select 'PASS' status,count(*) requests_compared,count(*) filter(where public.get_admin_finance_request_flow_detail(id)#>>'{deposit_reference,status}'='available') available,count(*) filter(where public.get_admin_finance_request_flow_detail(id)#>>'{deposit_reference,status}'='not_recorded') not_recorded,count(*) filter(where public.get_admin_finance_request_flow_detail(id)#>>'{deposit_reference,status}'='not_selected') not_selected from before_detail;
 ${body(recovery)}
 ${assertSql("not exists(select 1 from before_detail where detail is distinct from public.get_admin_finance_request_flow_detail(id))",'recovery mismatch')}
 select * from receipt; rollback;`;
 const receipt=await query(transaction,true);
 assert.equal((await query(meta))[0].definition,before.definition,'rollback altered reader');
 fs.mkdirSync(evidence,{recursive:true});
 fs.writeFileSync(path.join(evidence,'sql.json'),JSON.stringify({status:'PASS',receipt,existingFieldsIdentical:true,bankPermissionDenial:true,anonymousAndUnassignedDenied:true,privateTableNoSelect:true,dataHashesIdentical:true,recoveryAndRollbackVerified:true,migrationSha256:crypto.createHash('sha256').update(sql).digest('hex')},null,2)+'\n');
 if(process.argv.includes('--apply')){
  assert.equal((await query(meta))[0].definition,before.definition);
  await query('begin;\n'+body(sql)+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('20260908000500','admin_request_bank_reference',array['Read-only captured bank projection; full definition in repository migration']);\ncommit;",true);
  const after=(await query(meta))[0];assert.equal(after.oid,before.oid);assert.equal(after.acl,before.acl);
  assert.equal(after.definition.trim().replace(/;$/,'').trim(),body(sql).trim().replace(/;$/,'').trim());
  fs.writeFileSync(path.join(evidence,'migration.json'),JSON.stringify({status:'PASS',version:'20260908000500',oidAndGrantsPreserved:true,readerExact:true,businessWrites:0},null,2)+'\n');
 }
 console.log(JSON.stringify({status:'PASS',receipt,applied:process.argv.includes('--apply')}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
