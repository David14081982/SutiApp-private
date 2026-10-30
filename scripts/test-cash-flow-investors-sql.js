'use strict';
// Focused synthetic PostgreSQL/WASM verification. No network or productive writes.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const migration='supabase/migrations/20261030000200_reports_jc_cash_flow_investors.sql';
function definition(file,name,tag){const s=read(file),a=s.indexOf('create function '+name+'('),b=s.indexOf(tag,a),e=s.indexOf(tag+';',b+tag.length);assert(a>=0&&e>b);return s.slice(a,e+tag.length+1);}
async function main(){
 const db=new PGlite(),checks=[];const q=async(s,p=[])=>(await db.query(s,p)).rows,val=async(s,p=[])=>(await q(s,p))[0].v;
 const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const reject=async(fn,pattern)=>{let e;try{await fn();}catch(x){e=x;}assert(e);assert.match(e.message,pattern);};
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
  const hashes=()=>val("select md5(string_agg(pg_get_functiondef(p.oid),'|' order by p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('investors_private','public','auth','admin_support_private') and p.proname<>'get_admin_reports_jc_cash_flow_investors'");
  const before=await hashes();await db.exec(read(migration));
  const today=await val("select ((transaction_timestamp() at time zone 'America/Hermosillo')::date)::text v"),from=today.slice(0,7)+'-01',later=await val('select ($1::date+interval \'6 months\')::date::text v',[from]);
  await q("insert into investors_private.investors(id,name) values($1,'Synthetic investor')",[uid(1)]);
  await q("insert into investors_private.contracts(id,investor_id,code,starts_on,ends_on,principal,status,opening_balance,balance_on,history_complete) values($1,$2,'Synthetic',$3,$4,1000,'active',0,$3,true)",[uid(2),uid(1),from,later]);
  const movement=async(id,amount,replaces=null,voided=false)=>q("insert into investors_private.movements(id,contract_id,replaces_id,effective_on,concept,direction,amount,payment_method,actor,voided) values($1,$2,$3,$4,'contribution','in',$5,'Synthetic',$6,$7)",[uid(id),uid(2),replaces&&uid(replaces),today,amount,uid(1),voided]);
  await movement(3,1000);await movement(4,900,3);await movement(5,50);await movement(6,50,5,true);
  const firstEnd=await val("select ($1::date+interval '1 month')::date::text v",[from]);
  await q("insert into investors_private.obligations(id,contract_id,period_start,period_end,due_on,concept,amount,principal_basis,rate_snapshot,origin) values($1,$2,$3,$4,$4,'yield',27,900,.03,'monthly_simple')",[uid(7),uid(2),from,firstEnd]);
  const snapshot=()=>val("select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,'[]')) v from (select 'contracts' kind,to_jsonb(c) data from investors_private.contracts c union all select 'movements',to_jsonb(m) from investors_private.movements m union all select 'obligations',to_jsonb(o) from investors_private.obligations o union all select 'audit',to_jsonb(a) from investors_private.audit a) x");
  const dataBefore=await snapshot();
  const actor=async(perms='program_requests.read,savings.read,savings.reports',module='reportes_jc',imp='')=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false),set_config('test.module',$3,false),set_config('test.impersonation',$4,false)",[uid(1),perms,module,imp]);await db.exec('set role authenticated');};
  const report=f=>val('select public.get_admin_reports_jc_cash_flow_investors($1) v',[f||from]);
  await check('Reports JC authorization, impersonation and direct table isolation',async()=>{
   await actor();assert.equal((await report()).contracts.length,1);await reject(()=>q('select * from investors_private.contracts'),/permission denied/);
   await actor('program_requests.read');await reject(()=>report(),/ADMIN_DENIED/);await actor(undefined,'finanzas');await reject(()=>report(),/ADMIN_DENIED/);await actor(undefined,undefined,'yes');await reject(()=>report(),/ADMIN_DENIED/);
   await db.exec('reset role;set role anon');await reject(()=>report(),/permission denied/);await db.exec('reset role;set role service_role');await reject(()=>report(),/permission denied/);await actor();
  });
  await check('Current movement version, voids, stored rates and twelve-month balance',async()=>{
   const r=await report();assert.equal(r.movements.length,1);assert.equal(r.movements[0].id,uid(4));assert.equal(r.contracts[0].balance,900);assert.equal(r.balances.length,12);assert.equal(r.balances[0].amount,900);assert.equal(r.obligations[0].rate_snapshot,.03);assert.equal(r.obligations[0].amount,27);assert.equal(r.obligations[0].paid,0);assert(r.balances.slice(1).every(b=>b.amount===null&&b.known_amount===null));assert(!('investors' in r));assert(!JSON.stringify(r).includes('Synthetic investor'));
  });
  await check('Input bounds, stable reader and no original definition or financial changes',async()=>{
   await reject(()=>report(from.slice(0,8)+'02'),/RANGE_INVALID/);await reject(()=>report('2101-01-01'),/RANGE_INVALID/);assert.equal((await report('2100-12-01')).balances[0].month,'2100-12-01');
   await db.exec('reset role');assert.equal(await hashes(),before);assert.equal(await snapshot(),dataBefore);assert.equal(await val("select provolatile v from pg_proc where oid='public.get_admin_reports_jc_cash_flow_investors(date)'::regprocedure"),'s');
  });
  await check('Recovery revokes only the additive report and preserves source rows',async()=>{
   await db.exec(read('supabase/recovery/20261030000200_reports_jc_cash_flow_investors.sql'));await actor();await reject(()=>report(),/permission denied/);await db.exec('reset role');assert.equal(await hashes(),before);assert.equal(await snapshot(),dataBefore);
  });
  const result={status:'PASS',checks,financialWrites:0,originalDefinitionsPreserved:true};const out=path.join(root,'docs/qa/evidence/cash-flow-consolidated');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'investors-sql.json'),JSON.stringify(result,null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
