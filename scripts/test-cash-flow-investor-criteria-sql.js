'use strict';
// Isolated PostgreSQL/WASM contract check. No network or production writes.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const name='20261030000400_reports_jc_cash_flow_investor_criteria.sql',uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function definition(file,name,tag){const s=read(file),a=s.indexOf('create function '+name+'('),b=s.indexOf(tag,a),e=s.indexOf(tag+';',b+tag.length);assert(a>=0&&e>b);return s.slice(a,e+tag.length+1);}
async function main(){
 const db=new PGlite(),checks=[],q=async(s,p=[])=>(await db.query(s,p)).rows,val=async(s,p=[])=>(await q(s,p))[0].v;
 const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);},reject=async(fn,pattern)=>{let e;try{await fn();}catch(x){e=x;}assert(e);assert.match(e.message,pattern);};
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
  const hashes=()=>val("select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,''),'|' order by p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('investors_private','public','auth','admin_support_private') and p.proname<>'get_admin_reports_jc_cash_flow_investors'");
  const reportDefinition=()=>val("select pg_get_functiondef(oid)||coalesce(proacl::text,'')||coalesce(obj_description(oid,'pg_proc'),'') v from pg_proc where oid='public.get_admin_reports_jc_cash_flow_investors(date)'::regprocedure");
  const originals=await hashes(),oldReport=await reportDefinition();
  const today=await val("select ((transaction_timestamp() at time zone 'America/Hermosillo')::date)::text v"),from=today.slice(0,7)+'-01',past=await val("select ($1::date-interval '1 month')::date::text v",[from]),later=await val("select ($1::date+interval '4 months')::date::text v",[from]),sha='0'.repeat(64);
  await q("insert into investors_private.imports(sha256,filename,workbook,manifest) values($1,'Synthetic',decode('00','hex'),jsonb_build_object('snapshot_observed_on',$2::text))",[sha,today]);
  await q("insert into investors_private.investors(id,name,source) values($1,'Private synthetic name',jsonb_build_object('sha256',$2::text))",[uid(1),sha]);
  const imported=async(id,status,current,principal=1000)=>q("insert into investors_private.contracts(id,investor_id,code,starts_on,ends_on,principal,status,source,history_complete) values($1,$2,$3,$4,$5,$6,$7,jsonb_build_object('contributed',$6::numeric,'current_capital',$8::numeric),false)",[uid(id),uid(1),'Synthetic'+id,past,later,principal,status,current]);
  await imported(2,'review',700);await imported(3,'historical',0,500);
  await q("insert into investors_private.contracts(id,investor_id,code,starts_on,ends_on,principal,status,opening_balance,balance_on,history_complete) values($1,$2,'Manual',$3,$4,600,'active',0,$3,true)",[uid(4),uid(1),from,later]);
  await q("insert into investors_private.movements(id,contract_id,effective_on,concept,direction,amount,payment_method,actor) values($1,$2,$3,'contribution','in',600,'Synthetic',$4)",[uid(5),uid(4),from,uid(1)]);
  const snapshot=()=>val("select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,'[]')) v from (select 'contracts' kind,to_jsonb(c) data from investors_private.contracts c union all select 'movements',to_jsonb(m) from investors_private.movements m union all select 'obligations',to_jsonb(o) from investors_private.obligations o union all select 'audit',to_jsonb(a) from investors_private.audit a) x"),dataBefore=await snapshot();
  await db.exec(read('supabase/migrations/'+name));
  const actor=async(perms='program_requests.read,savings.read,savings.reports',module='reportes_jc',imp='')=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false),set_config('test.module',$3,false),set_config('test.impersonation',$4,false)",[uid(1),perms,module,imp]);await db.exec('set role authenticated');};
  const report=f=>val('select public.get_admin_reports_jc_cash_flow_investors($1) v',[f||past]);
  await check('Official contribution and observed stock exposed without review or history gate',async()=>{
   await actor();const r=await report(),c=r.contracts.find(c=>c.id===uid(2));assert.equal(c.registered_contribution,1000);assert.equal(c.registered_current_capital,700);assert.equal(c.registered_balance_on,today);assert.equal(r.balances[0].amount,1500);assert.equal(r.balances[1].amount,1300);assert.equal(r.balances[1].unknown_count,0);assert(!JSON.stringify(r).includes('Private synthetic name'));assert(!r.contracts.some(c=>'source' in c));
  });
  await check('SQL balances match derived report for prior and current cuts with unchanged financial data',async()=>{
   const {buildInvestorCashFlow}=await import('../supabase/functions/reports-jc/cash-flow-investors.mjs'),s=await report(),r=buildInvestorCashFlow({from:past.slice(0,7),asOf:today,source:s});for(const b of s.balances){const actual=r.balances.find(x=>x.kind==='investor_capital_balance'&&x.month===b.month.slice(0,7));assert.equal(actual.amount,b.amount);assert.equal(actual.known_amount,b.known_amount);}await db.exec('reset role');assert.equal(await snapshot(),dataBefore);assert.equal(await hashes(),originals);
  });
  await check('Existing Reports JC permission guard and private table isolation remain enforced',async()=>{
   await actor();await reject(()=>q('select * from investors_private.contracts'),/permission denied/);await actor('program_requests.read');await reject(()=>report(),/ADMIN_DENIED/);await actor(undefined,'finanzas');await reject(()=>report(),/ADMIN_DENIED/);await actor(undefined,undefined,'yes');await reject(()=>report(),/ADMIN_DENIED/);await db.exec('reset role;set role anon');await reject(()=>report(),/permission denied/);await db.exec('reset role;set role service_role');await reject(()=>report(),/permission denied/);await actor();await reject(()=>report('2101-01-01'),/RANGE_INVALID/);await reject(()=>report(from.slice(0,8)+'02'),/RANGE_INVALID/);assert.equal((await report('2100-12-01')).balances.length,12);
  });
  await check('Recovery restores previous report definition and ACL without touching source or original functions',async()=>{
   await db.exec('reset role');assert.equal(await val("select provolatile v from pg_proc where oid='public.get_admin_reports_jc_cash_flow_investors(date)'::regprocedure"),'s');await db.exec(read('supabase/recovery/'+name));assert.equal(await reportDefinition(),oldReport);assert.equal(await hashes(),originals);assert.equal(await snapshot(),dataBefore);
  });
  const out=path.join(root,'docs/qa/evidence/cash-flow-criteria');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'investors-sql.json'),JSON.stringify({status:'PASS',checks,financialWrites:0,originalDefinitionsAndAclPreserved:true,recoveryExact:true},null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
