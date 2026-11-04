'use strict';
// Isolated PostgreSQL only: no production connection or financial writes.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const migration='20261104000200_reports_jc_investor_sources.sql',uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function definition(file,name,tag){const s=read(file),a=s.indexOf('create function '+name+'('),b=s.indexOf(tag,a),e=s.indexOf(tag+';',b+tag.length);assert(a>=0&&e>b);return s.slice(a,e+tag.length+1);}
async function main(){
 const db=new PGlite(),checks=[],q=async(s,p=[])=>(await db.query(s,p)).rows,val=async(s,p=[])=>(await q(s,p))[0].v;
 const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const denied=async(fn,pattern)=>{let error;try{await fn();}catch(e){error=e;}assert(error);assert.match(error.message,pattern);};
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema admin_support_private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
   create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select auth.uid()$$;
   create function public.has_admin_permission(text) returns boolean language sql stable as $$select $1=any(string_to_array(coalesce(current_setting('test.permissions',true),''),','))$$;
   create function public.admin_module_boundary(text[],text) returns boolean language sql stable as $$select current_setting('test.module',true)=any($1)$$;
   create function admin_support_private.module_visible(uuid,text) returns boolean language sql stable as $$select current_setting('test.module',true)=$2$$;
   create function admin_support_private.context() returns table(id text) language sql stable as $$select 'active' where current_setting('test.impersonation',true)='yes'$$;
   grant usage on schema auth,public to authenticated,anon,service_role;`);
  await db.exec(read('supabase/migrations/20261029000100_investors.sql'));
  await db.exec(definition('supabase/migrations/20261027000300_reports_jc_screen.sql','public.get_admin_reports_jc_context','$jc$'));
  await db.exec(read('supabase/migrations/20261030000200_reports_jc_cash_flow_investors.sql'));
  await db.exec(read('supabase/migrations/20261030000400_reports_jc_cash_flow_investor_criteria.sql'));
  const currentDefinition=()=>val("select pg_get_functiondef(oid)||proacl::text||proowner::text||oid::text v from pg_proc where oid='public.get_admin_reports_jc_cash_flow_investors(date)'::regprocedure");
  const otherDefinitions=()=>val("select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,''),'|' order by p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('investors_private','public','auth','admin_support_private') and p.proname<>'get_admin_reports_jc_cash_flow_investors'");
  const original=await currentDefinition(),others=await otherDefinitions(),sha='0'.repeat(64);
  await q("insert into investors_private.imports(sha256,filename,workbook,manifest) values($1,'Synthetic',decode('00','hex'),jsonb_build_object('snapshot_observed_on','2026-10-29'))",[sha]);
  await q("insert into investors_private.investors(id,name,email,phone,source) values($1,'Nombre permitido para el reporte','private@example.test','PRIVATE_PHONE',jsonb_build_object('sha256',$2::text))",[uid(1),sha]);
  await q(`insert into investors_private.contracts(id,investor_id,code,starts_on,ends_on,principal,status,source)
   values($1,$2,'Contrato 2 C2 RC1','2026-02-05','2026-08-05',270000,'historical',
    jsonb_build_object('status','Renovado','sheet','Cartera Inicial','row',57,'document','Contrato 2 C2 RC1','contributed',0,'withdrawal',35000,'day',30,'monthly',6750))`,[uid(2),uid(1)]);
  const snapshot=()=>val("select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,'[]')) v from (select 'contracts' kind,to_jsonb(c) data from investors_private.contracts c union all select 'movements',to_jsonb(m) from investors_private.movements m union all select 'obligations',to_jsonb(o) from investors_private.obligations o union all select 'audit',to_jsonb(a) from investors_private.audit a) x"),beforeData=await snapshot();
  await db.exec(read('supabase/migrations/'+migration));
  const actor=async(perms='program_requests.read,savings.read,savings.reports',module='reportes_jc',imp='')=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false),set_config('test.module',$3,false),set_config('test.impersonation',$4,false)",[uid(1),perms,module,imp]);await db.exec('set role authenticated');};
  const report=()=>val("select public.get_admin_reports_jc_cash_flow_investors('2026-01-01') v");
  await check('Original contractual source and permitted investor identity are returned without unrelated PII',async()=>{
   await actor();const r=await report(),c=r.contracts[0];assert.equal(c.investor_name,'Nombre permitido para el reporte');assert.equal(c.source_sheet,'Cartera Inicial');assert.equal(c.source_row,57);
   assert.equal(c.source_observed_on,'2026-10-29');assert.equal(c.registered_withdrawal,35000);assert.equal(c.registered_payment_day,30);assert.equal(c.registered_monthly_yield,6750);assert.equal(c.registered_contribution,0);
   assert(!JSON.stringify(r).includes('PRIVATE_PHONE'));assert(!JSON.stringify(r).includes('private@example.test'));assert(!('source' in c));assert.deepEqual(r.balances,[]);assert.equal(r.balance_projection,'REPORT_DERIVED_WITH_CONTINUITY');
  });
  await check('Reader authorization and private data isolation remain unchanged',async()=>{
   await denied(()=>q('select * from investors_private.contracts'),/permission denied/);await actor('program_requests.read');await denied(report,/ADMIN_DENIED/);await actor(undefined,'finanzas');await denied(report,/ADMIN_DENIED/);
   await actor(undefined,undefined,'yes');await denied(report,/ADMIN_DENIED/);await db.exec('reset role;set role anon');await denied(report,/permission denied/);await db.exec('reset role;set role service_role');await denied(report,/permission denied/);
  });
  await check('Financial rows and other functions unchanged; exact recovery restores reader identity',async()=>{
   await db.exec('reset role');assert.equal(await snapshot(),beforeData);assert.equal(await otherDefinitions(),others);
   await db.exec(read('supabase/recovery/'+migration));assert.equal(await currentDefinition(),original);assert.equal(await snapshot(),beforeData);assert.equal(await otherDefinitions(),others);
  });
  await check('Definition guard refuses a different reader without replacing it',async()=>{
   await db.exec("comment on function public.get_admin_reports_jc_cash_flow_investors(date) is 'Comment does not alter body';");
   await db.exec(read('supabase/migrations/'+migration));await denied(()=>db.exec(read('supabase/migrations/'+migration)),/SOURCE_DRIFT/);await db.exec('rollback;');
  });
  const out=path.join(root,'docs/qa/evidence/cash-flow-source-20261104');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'investor-sources-sql.json'),JSON.stringify({status:'PASS',checks,financialWrites:0,isolated:true,sourceAndPermissionsPreserved:true,recoveryExact:true},null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
