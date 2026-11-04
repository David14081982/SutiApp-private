'use strict';
// Reuses the existing isolated PostgreSQL fixtures; no network or production writes.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('node:assert/strict');
const harnessPath=path.join(__dirname,'test-cash-flow-savings-sources-sql.js');
let source=fs.readFileSync(harnessPath,'utf8');
const anchor='const harness=new Module(sourcePath,module);';
assert(source.includes(anchor),'TIMEOUT_FIXTURE_HARNESS_CHANGED');
const insertion=`
 const timeoutFile='20261104000300_reports_jc_cash_flow_timeout.sql';
 const timeoutState=()=>val("select jsonb_build_object('definition',pg_get_functiondef(oid),'metadata',to_jsonb(p)) v from pg_proc p where oid='public.get_admin_reports_jc_cash_flow(date)'::regprocedure");
 const timeoutBefore=await timeoutState(),timeoutData=await snapshot();
 const timeoutOther=()=>val("select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,''),'|' order by p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','auth','admin_support_private','savings_automatic_private') and p.proname<>'get_admin_reports_jc_cash_flow'");
 const timeoutOthers=await timeoutOther(),timeoutReports={};
 await actor();for(const from of ['2026-01-01','2028-01-01'])timeoutReports[from]=await report(from);
 await db.exec('reset role');await db.exec(read('supabase/migrations/'+timeoutFile));
 const timeoutAfter=await timeoutState(),timeoutAfterMd5=await val("select md5(pg_get_functiondef('public.get_admin_reports_jc_cash_flow(date)'::regprocedure)) v");
 await check('timeout changes only reader proconfig and preserves its exact body identity ACL and source rows',async()=>{
  const clean=({proconfig,...rest})=>rest;
  assert.deepEqual(clean(timeoutAfter.metadata),clean(timeoutBefore.metadata));
  assert.deepEqual(timeoutAfter.metadata.proconfig,['search_path=""','statement_timeout=30s']);
  assert.deepEqual(await snapshot(),timeoutData);assert.equal(await timeoutOther(),timeoutOthers);
 });
 await check('timeout retains exact reports for current and future years',async()=>{
  await actor();for(const [from,expected] of Object.entries(timeoutReports))assert.deepEqual(await report(from),expected);
 });
 await check('timeout preserves authorization and private-table denials',async()=>{
  await actor('savings.read');await reject(()=>report(),/DENIED/);
  await actor(undefined,undefined,1,true);await reject(()=>report(),/DENIED/);
  await actor(undefined,undefined,null);await reject(()=>report(),/AUTH_REQUIRED/);
  await actor();await reject(()=>q('select * from savings_transactions'),/permission denied/);
  await db.exec('reset role;set role anon');await reject(()=>report(),/permission denied/);
  await db.exec('reset role;set role service_role');await reject(()=>report(),/permission denied/);
  await db.exec('reset role');
 });
 await check('timeout migration rejects repeated application and recovery refuses unexpected configuration',async()=>{
  await reject(()=>db.exec(read('supabase/migrations/'+timeoutFile)),/TIMEOUT_DRIFT/);await db.exec('rollback');
  assert.deepEqual(await timeoutState(),timeoutAfter);
  await db.exec("alter function public.get_admin_reports_jc_cash_flow(date) set statement_timeout to '15s'");
  await reject(()=>db.exec(read('supabase/recovery/'+timeoutFile)),/RECOVERY_DRIFT/);await db.exec('rollback');
  await db.exec("alter function public.get_admin_reports_jc_cash_flow(date) set statement_timeout to '30s'");
 });
 await check('timeout recovery restores exact full definition OID ACL config and financial fingerprints',async()=>{
  await db.exec(read('supabase/recovery/'+timeoutFile));assert.deepEqual(await timeoutState(),timeoutBefore);
  assert.deepEqual(await snapshot(),timeoutData);assert.equal(await timeoutOther(),timeoutOthers);
 });
 fs.writeFileSync(path.join(root,'.tmp/cash-flow-source-20261104/timeout-sql-verification.json'),JSON.stringify({status:'PASS',checks:5,isolated:true,productionCalls:0,financialWrites:0,bodyAndOidAndAclUnchanged:true,exactRecovery:true,beforeDefinitionMd5:await val("select md5(pg_get_functiondef('public.get_admin_reports_jc_cash_flow(date)'::regprocedure)) v"),afterDefinitionMd5:timeoutAfterMd5},null,2)+'\\n');
`;
const target=" const afterFunction=await metadata();console.log('NEW_READER_MD5 '";
source=source.replace(anchor,()=>`replace(${JSON.stringify(target)},${JSON.stringify(insertion+target)});\n`+anchor);
// Keep the reused suites' evidence separate from their original run.
source=source.replace(anchor,()=>`replace("'savings-sql.json'","'timeout-savings-sql.json'");\n`+anchor);
const harness=new Module(harnessPath,module);harness.filename=harnessPath;harness.paths=module.paths;harness._compile(source,harnessPath);
