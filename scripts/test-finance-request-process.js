'use strict';
// PostgreSQL isolated in memory. Schema/identities below are synthetic fixtures.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const forward=read('supabase/migrations/20261002000100_finance_request_process.sql'),recovery=read('supabase/recovery/20261002000100_finance_request_process.sql');
const baseline=recovery.slice(recovery.indexOf('CREATE OR REPLACE FUNCTION'),recovery.lastIndexOf(';\ncommit;'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function main(){
 const db=new PGlite(),checks=[];const q=async(s,p=[])=>(await db.query(s,p)).rows,one=async(s,p=[])=>(await q(s,p))[0];
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function has_admin_permission(p text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? p$$;
 create function admin_module_boundary(text[]) returns boolean language sql stable as $$select current_setting('test.module_denied',true) is distinct from 'true'$$;
 create function resolve_program_request_workflow_state(uuid) returns jsonb language sql stable as $$select '{"available":true}'::jsonb$$;`);
 const aliases={r:'program_requests',a:'affiliates',pi:'program_catalog_items',p:'marketplace_products',m:'membership_offerings',c:'companies',ex:'financial_request_export_audit',d:'loan_request_deposit_snapshots'};
 for(const [alias,table] of Object.entries(aliases)){
   const columns=[...new Set([...forward.matchAll(new RegExp('\\b'+alias+'\\.(\\w+)','g'))].map(m=>m[1]))];
   const type=c=>c==='id'||c.endsWith('_id')?'uuid':c.includes('snapshot')?'jsonb':c==='terms_accepted'?'boolean':'text';
   await db.exec(`create table public.${table}(${columns.map(c=>c+' '+type(c)).join(',')});alter table public.${table} enable row level security;`);
 }
 await db.exec(baseline+';revoke all on function get_admin_finance_request_flow_detail(uuid) from public;grant execute on function get_admin_finance_request_flow_detail(uuid) to authenticated;');
 await q("insert into affiliates(id,full_name,numero_control,financial_employee_category_code) values($1,'Solicitante sintético','00007','BASE'),($2,'Administrador sintético','00008','CONFIANZA')",[id(1),id(2)]);
 await q("insert into program_requests(id,affiliate_id,numero_control,folio,created_at,impersonation_session_id) values($1,$2,'00007','SYNTHETIC-1','2026-10-02',$3),($4,$5,'00008','SYNTHETIC-2','2026-10-02',null)",[id(3),id(1),id(4),id(5),id(2)]);
 const actor=async(uid,permissions=['program_requests.read'],denied=false)=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false),set_config('test.module_denied',$3,false)",[uid,JSON.stringify(permissions),String(denied)]);await db.exec('set role authenticated');};
 const detail=async n=>(await one('select get_admin_finance_request_flow_detail($1) value',[id(n)])).value;
 const metadata=()=>one("select oid,proowner,proacl,prosecdef,provolatile,proconfig from pg_proc where oid='get_admin_finance_request_flow_detail(uuid)'::regprocedure");
 const hash=()=>one("select (select md5(jsonb_agg(to_jsonb(t))::text) from affiliates t) affiliates,(select md5(jsonb_agg(to_jsonb(t))::text) from program_requests t) requests");
 const beforeMetadata=await metadata(),beforeHash=await hash();await actor(id(2));const original=await detail(3);
 await db.exec('reset role');await db.exec(forward);assert.deepEqual(await metadata(),beforeMetadata);assert.deepEqual(await hash(),beforeHash);
 await actor(id(2));const updated=await detail(3);assert.equal(updated.affiliate.financial_employee_category_code,'BASE');delete updated.affiliate.financial_employee_category_code;assert.deepEqual(updated,original);
 checks.push('only category added; existing fields, OID, ACL, owner, volatility, search_path and data unchanged');
 for(const category of ['BASE','CONFIANZA','SUPLENTES_FIJOS','SUPLENTES_VARIABLES','EVENTUALES','JUBILADOS_PENSIONADOS',null]){
   await db.exec('reset role');await q('update affiliates set financial_employee_category_code=$1 where id=$2',[category,id(1)]);await actor(id(2));
   assert.equal((await detail(3)).affiliate.financial_employee_category_code,category??undefined);
   assert.equal((await detail(5)).affiliate.financial_employee_category_code,'CONFIANZA');
 }
 checks.push('all six codes and null; current applicant FK, assisted request and other applicant isolated');
 for(const [uid,permissions,denied] of [['',[],false],[id(2),[],false],[id(2),['program_requests.read'],true]]){
   await actor(uid,permissions,denied);await assert.rejects(()=>detail(3),/PROGRAM_REQUEST_READ_DENIED/);
 }
 await db.exec('reset role;set role anon');await assert.rejects(()=>detail(3),/permission denied/);
 checks.push('anonymous, missing permission and wrong admin module denied');
 await actor(id(2));assert.equal((await detail(3)).deposit_reference.status,'forbidden');await assert.rejects(()=>detail(99),/PROGRAM_REQUEST_NOT_FOUND/);
 await assert.rejects(()=>q('select get_admin_finance_request_flow_detail(null)'),/PROGRAM_REQUEST_REQUIRED/);
 checks.push('bank gate and missing request checks preserved');
 await db.exec('reset role');await db.exec(recovery);assert.equal((await one("select pg_get_functiondef('get_admin_finance_request_flow_detail(uuid)'::regprocedure) definition")).definition,baseline);
 assert.deepEqual(await metadata(),beforeMetadata);await db.exec(forward);
 await assert.rejects(()=>db.exec(forward),/FINANCE_REQUEST_PROCESS_DEFINITION_DRIFT/);await db.exec('rollback');
 checks.push('exact recovery and forward reapply verified; definition drift fails closed');
 const out=path.join(root,'docs/qa/evidence/finance-request-process-20261002');fs.mkdirSync(out,{recursive:true});
 const result={status:'PASS',checks,productionTouched:false};fs.writeFileSync(path.join(out,'sql.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
