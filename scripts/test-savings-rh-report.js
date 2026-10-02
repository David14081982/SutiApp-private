'use strict';
// Isolated financial/authorization regression. No network or production credentials.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {PGlite}=require(process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20261001000400_savings_rh_report.sql');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function helper(file,name){const sql=read(file),start=sql.search(new RegExp('create (?:or replace )?function public\\.'+name+'\\(','i')),end=sql.indexOf('$$;',start);assert(start>=0&&end>start);return sql.slice(start,end+3);}
async function main(){
 const db=new PGlite();let groups=0;
 const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const report=async(type='mensual',year=2026,month=9,day=15)=>(await q('select public.get_admin_savings_rh_report($1,$2,$3,$4) r',[type,year,month,day]))[0].r;
 const test=async(name,body)=>{await body();groups++;console.log('PASS '+name);};
 const denied=async(action,code)=>assert.rejects(action,e=>e.code===code);
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   grant usage on schema public,auth to anon,authenticated,service_role;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function public.has_admin_permission(text) returns boolean language sql stable as $$select $1='savings.reports' and current_setting('test.allowed',true)='yes'$$;
   create table affiliates(id uuid primary key,numero_control text,full_name text,is_archived boolean default false);
   create table savings_participants(id uuid primary key,affiliate_id uuid,legacy_folio text,identity_status text,data_classification text);
   create table savings_enrollments(id uuid primary key,participant_id uuid,status text,data_classification text,first_expected_contribution_date date,terminated_at timestamptz);
   create table savings_contribution_plans(id uuid primary key,enrollment_id uuid,amount numeric,process_snapshot text,effective_from date,effective_to date,data_classification text);
   create table savings_review_records(id uuid primary key,field_defs jsonb);
   create table savings_balance_certifications(id uuid primary key,record_id uuid,participant_id uuid,enrollment_id uuid,cutoff_on date,source_snapshot jsonb,command jsonb);
   alter table affiliates enable row level security;alter table savings_participants enable row level security;
  `);
  await db.exec(helper('supabase/migrations/20260906000100_savings_operations.sql','savings_next_contribution_date'));
  await db.exec(helper('supabase/migrations/20260906001000_savings_reference_panel.sql','savings_panel_number'));
  await db.exec(helper('supabase/migrations/20260906001000_savings_reference_panel.sql','savings_panel_date'));
  await db.exec(migration);
  for(const [n,folio,name,process,amount] of [[1,'0002','Álvarez O’Neill María','PROCESS_1',300],[2,'2','=Nombre literal','PROCESS_3',500],[3,'J-3','Jubilado anterior','JUB',800],[4,'CERO','Sin descuento','PROCESS_1',0]]){
   await q('insert into affiliates values($1,$2,$3,false)',[id(n),folio,name]);
   await q('insert into savings_participants values($1,$2,$3,$4,$5)',[id(n),id(n),folio,'RESOLVED','CANONICAL']);
   await q('insert into savings_enrollments values($1,$2,$3,$4,$5,null)',[id(n),id(n),'ACTIVE','CANONICAL','2026-01-05']);
   await q('insert into savings_contribution_plans values($1,$2,$3,$4,$5,null,$6)',[id(n),id(n),amount,process,'2026-01-05','CANONICAL']);
  }
  await db.exec(`set test.uid='${id(99)}';set test.allowed='yes';`);
  await test('monthly seven-column contract, positive-only amounts and exact text Folios',async()=>{
   const r=await report();assert.equal(r.rows.length,2);assert.deepEqual(r.rows.map(x=>x.Folio).sort(),['0002','2']);
   assert.deepEqual(Object.keys(r.rows[0]).sort(),['Clave','Proceso','Folio','Nombre','Monto','Inicio','Final'].sort());
   const p1=r.rows.find(x=>x.Folio==='0002'),p3=r.rows.find(x=>x.Folio==='2');
   assert.equal(p1.Monto,300);assert.equal(p1.Inicio,'2026017');assert.equal(p1.Final,'2999999');assert.equal(p3.Final,p3.Inicio);assert.equal(p3.Nombre,'=Nombre literal');
  });
  await test('February calendar and invalid dates',async()=>{
   assert.equal((await report('mensual',2028,2,28)).rows.length,2);
   assert.equal((await report('mensual',2026,3,28)).rows.length,0);
   await denied(()=>report('mensual',2026,2,30),'22023');await denied(()=>report('bad'),'22023');
   await denied(()=>report('mensual',2026,9,null),'22023');
  });
  await test('JUB monthly start date and annual continuing retirees',async()=>{
   const r=await report('mensual',2027,9,5);assert.equal(r.rows.length,1);assert.equal(r.rows[0].Clave,'580');assert.equal(r.rows[0].Inicio,'05/01/2026');assert.equal(r.rows[0].Final,'');
   const a=await report('anual',2027);assert.equal(a.rows.filter(x=>x.Proceso==='JUB').length,1);assert.equal(a.rows.find(x=>x.Proceso==='JUB').Inicio,'2026001');
  });
  await test('annual last amount for process 1, one instruction per process 3 quincena',async()=>{
   await q('update savings_contribution_plans set effective_to=$1 where id=$2',['2026-09-30',id(1)]);
   await q('insert into savings_contribution_plans values($1,$2,700,$3,$4,null,$5)',[id(11),id(1),'PROCESS_1','2026-10-01','CANONICAL']);
   const r=await report('anual');const one=r.rows.filter(x=>x.Proceso==='proceso 1');assert.equal(one.length,1);assert.equal(one[0].Monto,700);assert.equal(one[0].Inicio,'2026024');assert.equal(r.rows.filter(x=>x.Proceso==='proceso 3').length,24);
  });
  await test('termination excludes future deductions and never generates zero cancellation',async()=>{
   await q('update savings_enrollments set status=$1,terminated_at=$2 where id=$3',['TERMINATED','2026-09-15T07:00:00Z',id(2)]);
   assert.equal((await report()).rows.length,1);
   await q('update savings_enrollments set status=$1,terminated_at=null where id=$2',['ACTIVE',id(2)]);
  });
  await test('overlapping plans fail closed',async()=>{
   await q('insert into savings_contribution_plans select $1,enrollment_id,amount,process_snapshot,effective_from,effective_to,data_classification from savings_contribution_plans where id=$2',[id(12),id(1)]);
   await assert.rejects(()=>report(),/SAVINGS_RH_PLAN_CONFLICT/);await q('delete from savings_contribution_plans where id=$1',[id(12)]);
  });
  await test('exact affiliate link, duplicate active and missing name block; archived duplicate allowed',async()=>{
   await q('insert into affiliates values($1,$2,$3,false)',[id(21),'0002','Duplicate']);await assert.rejects(()=>report(),/SAVINGS_RH_IDENTITY_INVALID/);
   await q('update affiliates set is_archived=true where id=$1',[id(21)]);assert.equal((await report()).rows.length,2);
   await q('update affiliates set full_name=$1 where id=$2',[' ',id(1)]);await assert.rejects(()=>report(),/SAVINGS_RH_IDENTITY_INVALID/);
   await q('update affiliates set full_name=$1 where id=$2',['Restored name',id(1)]);
   await q('update savings_participants set affiliate_id=$1 where id=$2',[id(2),id(1)]);await assert.rejects(()=>report(),/SAVINGS_RH_IDENTITY_INVALID/);
   await q('update savings_participants set affiliate_id=id where id=$1',[id(1)]);
  });
  const fields=[{key:'AB',label:'2026-01-15 · Descuento registrado'},{key:'AC',label:'2026-01-30 · Descuento registrado'},{key:'AR',label:'2026-06-30 · Descuento registrado (incluye rendimiento DT)'},{key:'AZ',label:'2026-09-15 · Proyección futura'}];
  await q('insert into savings_review_records values($1,$2)',[id(1),JSON.stringify(fields)]);
  await q('insert into savings_balance_certifications values($1,$1,$1,$1,$2,$3,$4)',[id(1),'2026-09-06',JSON.stringify({source:{D:'1',AB:25000,AC:250,AR:1300,DT:1000,AZ:99999},proposal:{}}),JSON.stringify({process:'PROCESS_1'})]);
  await test('certified history overrides current plan, strips known yield and ignores future snapshot',async()=>{
   const opening=await report('mensual',2026,1,15);assert(!opening.rows.some(x=>x.Folio==='0002'));
   const jan=await report('mensual',2026,1,30);assert.equal(jan.rows.find(x=>x.Folio==='0002').Monto,250);
   const jun=await report('mensual',2026,6,30);assert.equal(jun.rows.find(x=>x.Folio==='0002').Monto,300);
   assert.equal((await report()).rows.find(x=>x.Folio==='0002').Monto,300);
   await assert.rejects(()=>report('mensual',2025,1,15),/SAVINGS_RH_HISTORY_UNAVAILABLE/);
  });
  await test('invalid historical text and impossible embedded yield never become zero or deductions',async()=>{
   await db.exec(`update savings_balance_certifications set source_snapshot=jsonb_set(source_snapshot,'{source,AC}','"No hay datos"')`);
   await assert.rejects(()=>report('mensual',2026,1,30),/SAVINGS_RH_AMOUNT_INVALID/);
   await db.exec(`update savings_balance_certifications set source_snapshot=jsonb_set(source_snapshot,'{source,DT}','2000')`);
   await assert.rejects(()=>report('mensual',2026,6,30),/SAVINGS_RH_AMOUNT_INVALID/);
  });
  await test('real RPC grants deny anonymous/service role and authenticated without reports',async()=>{
   await db.exec('set role anon');await denied(()=>report(),'42501');await db.exec('reset role;set role service_role');await denied(()=>report(),'42501');
   await db.exec("reset role;set role authenticated;set test.allowed='no'");await denied(()=>report(),'42501');
   await db.exec("set test.allowed='yes';set test.uid=''");await denied(()=>report(),'42501');
   await db.exec(`set test.uid='${id(99)}'`);assert.equal((await report()).rows.length,2);await db.exec('reset role');
  });
  await test('browser date validation and no export on invalid selection',async()=>{
   const sandbox={window:{},Date,Number,Object,Error};vm.runInNewContext(read('app/savings-rh-repository.js'),sandbox);
   const api=sandbox.window.SavingsRhRepository;
   assert.throws(()=>api.validate({type:'mensual',year:2026,month:2,day:30}),/DATE_INVALID/);
   assert.equal(api.validate({type:'anual',year:2026}).month,null);
  });
  await test('recovery removes only the new RPC',async()=>{
   const before=(await q('select count(*) n from savings_participants'))[0].n;
   await db.exec(read('supabase/recovery/20261001000400_savings_rh_report.sql'));
   assert.equal((await q('select count(*) n from savings_participants'))[0].n,before);
   assert.equal((await q("select to_regprocedure('public.get_admin_savings_rh_report(text,integer,integer,integer)') value"))[0].value,null);
  });
  console.log('PASS '+groups+' RH regression groups');
 }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
