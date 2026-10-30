'use strict';
// Focused synthetic verification of the additive approved-terms reader; no network.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function main(){const db=new PGlite(),checks=[],q=async(s,p=[])=>(await db.query(s,p)).rows,val=async(s,p=[])=>(await q(s,p))[0].v;
 const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const reject=async(fn,pattern)=>{let error;try{await fn();}catch(e){error=e;}assert(error);assert.match(error.message,pattern);};
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema admin_support_private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
   create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select auth.uid()$$;
   create function public.has_admin_permission(text) returns boolean language sql stable as $$select $1=any(string_to_array(coalesce(current_setting('test.permissions',true),''),','))$$;
   create function public.admin_module_boundary(text[],text) returns boolean language sql stable as $$select current_setting('test.module',true)=any($1)$$;
   create function admin_support_private.module_visible(uuid,text) returns boolean language sql stable as $$select current_setting('test.module',true)=$2$$;
   create function admin_support_private.context() returns table(id text) language sql stable as $$select 'active' where current_setting('test.impersonation',true)='yes'$$;
   grant usage on schema auth,public to authenticated,anon,service_role;
   create table public.program_requests(id uuid primary key,folio text,numero_control text,status text,program_id text,created_at timestamptz,financial_approved_at timestamptz,financial_approval_snapshot jsonb);
   alter table public.program_requests enable row level security;alter table public.program_requests force row level security;revoke all on public.program_requests from public,anon,authenticated,service_role;`);
  const source=read('supabase/migrations/20261027000300_reports_jc_screen.sql'),a=source.indexOf('create function public.get_admin_reports_jc_context()'),e=source.indexOf('end $jc$;',a);await db.exec(source.slice(a,e+10));
  const contextBefore=await val("select md5(pg_get_functiondef('public.get_admin_reports_jc_context()'::regprocedure)) v");
  const financial={financialResult:{principal:10000,interest:1000,total:11030,installments:2},financial_employee_category:'GENERAL'};
  for(const [n,status,program,snapshot]of [[1,'approved','prestamo',financial],[2,'rejected','prestamo',financial],[3,'approved','prestamo',null],[4,'approved','ahorro',financial]])await q("insert into public.program_requests values($1,$2,'synthetic',$3,$4,'2026-10-15 08:00Z','2026-10-16 08:00Z',$5)",[uid(n),'synthetic-'+n,status,program,snapshot]);
  const snapshot=()=>val("select md5(jsonb_agg(to_jsonb(r) order by r.id)::text) v from public.program_requests r"),before=await snapshot();
  await db.exec(read('supabase/migrations/20261030000300_reports_jc_cash_flow_contracts.sql'));
  const actor=async(perms='program_requests.read,savings.read,savings.reports',module='reportes_jc',imp='')=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false),set_config('test.module',$3,false),set_config('test.impersonation',$4,false)",[uid(1),perms,module,imp]);await db.exec('set role authenticated');};
  const report=()=>val('select public.get_admin_reports_jc_cash_flow_contracts() v');
  await check('Only approved loan snapshots, exact financial content and no fabricated control',async()=>{
   await actor();const r=await report();assert.equal(r.authority,'program_requests.financial_approval_snapshot');assert.equal(r.snapshots.length,1);assert.deepEqual(r.snapshots[0].financial,financial.financialResult);assert.equal(r.snapshots[0].id,uid(1));assert.equal(r.snapshots[0].createdOn,'2026-10-15');assert.equal(r.snapshots[0].category,'GENERAL');assert.equal(r.snapshots[0].fingerprint.length,32);assert(!('amortizationEngineActive'in r));assert(!('paid'in r.snapshots[0]));await reject(()=>q('select * from public.program_requests'),/permission denied/);
  });
  await check('Existing authorization guard denies wrong module, missing permissions, impersonation and anon',async()=>{
   await actor('program_requests.read');await reject(()=>report(),/ADMIN_DENIED/);await actor(undefined,'finanzas');await reject(()=>report(),/ADMIN_DENIED/);await actor(undefined,undefined,'yes');await reject(()=>report(),/ADMIN_DENIED/);
   await db.exec('reset role;set role anon');await reject(()=>report(),/permission denied/);await db.exec('reset role;set role service_role');await reject(()=>report(),/permission denied/);await db.exec('reset role');
   assert.equal(await val("select provolatile v from pg_proc where oid='public.get_admin_reports_jc_cash_flow_contracts()'::regprocedure"),'s');assert.equal(await snapshot(),before);assert.equal(await val("select md5(pg_get_functiondef('public.get_admin_reports_jc_context()'::regprocedure)) v"),contextBefore);
  });
  await check('Recovery removes only the additive reader and preserves contracts and authorization',async()=>{
   await db.exec(read('supabase/recovery/20261030000300_reports_jc_cash_flow_contracts.sql'));assert.equal(await val("select to_regprocedure('public.get_admin_reports_jc_cash_flow_contracts()')::text v"),null);assert.equal(await snapshot(),before);assert.equal(await val("select md5(pg_get_functiondef('public.get_admin_reports_jc_context()'::regprocedure)) v"),contextBefore);
  });
  const out=path.join(root,'docs/qa/evidence/cash-flow-consolidated');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'contracts-sql.json'),JSON.stringify({status:'PASS',checks,financialWrites:0,originalDefinitionsPreserved:true},null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
