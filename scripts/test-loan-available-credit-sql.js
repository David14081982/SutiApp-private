'use strict';
// Actual PostgreSQL engine; synthetic identities, no network or production writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const {PGlite}=require(process.env.LOAN_CAPACITY_PGLITE_MODULE||path.join(root,'scripts/fixtures/loan-available-credit/node_modules/@electric-sql/pglite'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const quoteBefore=fs.readFileSync(path.join(root,'scripts/fixtures/loan-available-credit/quote-before.sql'),'utf8').replace(/\r\n/g,'\n');
async function main(){
 const db=new PGlite(),checks=[],q=async(s,p=[])=>(await db.query(s,p)).rows,one=async(s,p=[])=>(await q(s,p))[0];
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
 create function public.has_admin_permission(p text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? p$$;
 create function public.admin_module_boundary(text[],text default 'read') returns boolean language sql stable as $$select current_setting('test.denied',true) is distinct from 'true' and $1=array['finanzas'] and $2 in('read','update')$$;
 create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
 create function public.admin_actor_can_impersonate() returns boolean language sql stable as $$select false$$;
 create function extensions.digest(bytea,text) returns bytea language sql immutable as $$select decode(repeat('A',64),'hex')$$;
 create function public.assert_savings_loan_quote_access(uuid,text,jsonb) returns void language plpgsql as $$begin end$$;
 create function public.get_current_declared_payroll_impact(numeric) returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.normalize_suti_financial_key(text) returns text language sql immutable as $$select upper($1)$$;
 create function public.resolve_suti_loan_quote_contract(jsonb,text,text,text,numeric,integer,jsonb) returns jsonb language sql as $$
 select jsonb_build_object('amount',$5,'paymentCount',$6,'paymentPerPeriod',100,'maxAmount',40000,'interest',100,'total',$5+100)$$;
 create table public.affiliates(id uuid primary key,numero_control text,full_name text,display_name text,is_archived boolean default false,
 auth_user_id uuid,financial_union_code text,financial_employee_category_code text,financial_profile_version integer default 1,
 financial_affiliation_status text,financial_employee_type text,financial_employment_status text);
 create table public.financial_programs(id text primary key,enabled boolean,publication_status text);
 create table public.financial_funds(id uuid primary key,program_id text,name text,code text,enabled boolean,publication_status text,sort_order integer default 0);
 create table public.financial_rules(id uuid primary key,fund_id uuid,program_id text,legacy_criterion_identity text,version integer default 1,
 enabled boolean,lifecycle_status text,financial_union_code text,financial_employee_category_code text,max_amount numeric,imported_batch_id uuid);
 create table public.financial_criteria_authority(id text,authority text,active_import_batch_id uuid);
 create table public.loan_history_publication(id boolean primary key,version uuid,source_updated_at timestamptz);
 insert into loan_history_publication values(true,'${id(301)}','2026-10-01T22:00:00Z');
 create table public.program_requests(id uuid primary key,folio text,actor_real_auth_user_id uuid,affiliate_id uuid,program_id text,status text,
 requested_amount numeric,financial_submission_snapshot jsonb,financial_processing_status text,financial_approved_at timestamptz,rental_start date,
 created_at timestamptz default clock_timestamp(),impersonation_session_id uuid);
 create table public.financial_session_snapshots(id uuid primary key,affiliate_id uuid,actor_real_auth_user_id uuid,impersonation_session_id uuid,
 financial_profile_version integer,profile_fingerprint text,eligible_rules jsonb,criteria_source_fingerprint text,
 term_policy_fingerprint text,calculation_contract_version text,created_at timestamptz default clock_timestamp(),expires_at timestamptz,
 invalidated_at timestamptz,invalidation_reason text,session_purpose text);
 create table public.loan_term_policy(id text,enabled boolean,standard_terms integer[],custom_min_term integer,custom_step integer,decision_reference text);
 create table public.impersonation_sessions(id uuid,actor_real_auth_user_id uuid,ended_at timestamptz,expires_at timestamptz);
 create table public.segmentation_catalog_entries(catalog_type text,code text,label text,enabled boolean);
 insert into auth.users values('${id(9)}'),('${id(8)}');
 insert into affiliates(id,numero_control,full_name,auth_user_id,financial_union_code,financial_employee_category_code) values
 ('${id(1)}','00007','Persona sintética','${id(8)}','SUTI','BASE'),('${id(2)}','00008','Otra persona',null,'SUTI','BASE');
 insert into financial_programs values('prestamo',true,'PUBLISHED'),('caja',true,'PUBLISHED');
 insert into financial_funds(id,program_id,name,code,enabled,publication_status) values
 ('${id(11)}','caja','Caja Chica','caja-chica',true,'PUBLISHED'),('${id(12)}','prestamo','Aguinaldos','aguinaldos',true,'PUBLISHED');
 insert into financial_criteria_authority values('primary','SUPABASE','${id(99)}');
 insert into financial_rules(id,fund_id,program_id,enabled,lifecycle_status,financial_union_code,financial_employee_category_code,max_amount,imported_batch_id) values
 ('${id(21)}','${id(11)}','caja',true,'PUBLISHED','SUTI','BASE',40000,'${id(99)}'),('${id(22)}','${id(12)}','prestamo',true,'PUBLISHED','SUTI','BASE',25000,'${id(99)}');
 insert into loan_term_policy values('primary',true,array[1,6,12],1,1,'Existing policy');
 insert into segmentation_catalog_entries values('union','SUTI','SUTI',true),('employment_category','BASE','BASE',true);
 grant usage on schema auth to anon,authenticated,service_role;
 grant select,insert,update,delete on public.program_requests,public.financial_session_snapshots to service_role;`);
 await db.exec(quoteBefore);
 // Match the live ACL before installing the additive guard.
 await db.exec('revoke all on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) from public;grant execute on function public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) to authenticated,service_role;');
 const hash=(await one("select md5(pg_get_functiondef('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)'::regprocedure)) h")).h;
 assert.equal(hash,'caa656046218f8956bf40f93c6d8a688','Live quote must be reproduced verbatim');
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261027000100_loan_available_credit.sql'),'utf8'));
 const actor=async(role='authenticated',permissions=[],affiliate=id(1),denied=false,uid=id(9))=>{
  await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.affiliate',$2,false),set_config('test.permissions',$3,false),set_config('test.denied',$4,false),set_config('test.role',$5,false)",[uid,affiliate,JSON.stringify(permissions),String(denied),role]);await db.exec('set role '+role);
 };
 const now=(await one("select clock_timestamp()::text n,((clock_timestamp() at time zone 'America/Hermosillo')::date)::text d"));
 const source=(changes={})=>({version:1,affiliate_id:id(1),numero_control:'00007',observed_at:now.n,business_day:now.d,
  source_version:id(301),source_updated_at:'2026-10-01T22:00:00Z',
  funds:[{fund_id:id(11),pending_amount:10000,active_loans:2},{fund_id:id(12),pending_amount:6260,active_loans:1}],represented_request_ids:[],...changes});
 const resolve=async(s=source(),rules=null)=>(await one('select public.resolve_loan_available_capacity($1,$2,$3) v',[id(1),s,rules])).v;
 const work=async(control=null)=>(await one('select public.get_admin_loan_capacity($1) v',[control])).v;
 const global=async(value,version,action=71)=>(await one('select set_admin_loan_capacity_policy($1,$2,$3,$4) v',[value,version,'Autorización documentada',id(action)])).v;
 const individual=async(value,version,action=81)=>(await one('select set_admin_loan_capacity_override($1,$2,$3,$4,$5,$6) v',[id(1),id(11),value,version,'Autorización individual',id(action)])).v;
 await actor();await assert.rejects(()=>work(),/ACCESS_DENIED/);await assert.rejects(()=>global(true,0),/WRITE_DENIED/);
 await actor('authenticated',['program_requests.write']);await assert.rejects(()=>global(true,0),/WRITE_DENIED/);await assert.rejects(()=>individual(true,0),/WRITE_DENIED/);
 await actor('authenticated',['financial_rules.read']);assert.equal((await work()).policy.allow_full,false);await assert.rejects(()=>global(true,0),/WRITE_DENIED/);
 await actor('authenticated',['financial_rules.write'],id(1),true);await assert.rejects(()=>global(true,0),/WRITE_DENIED/);
 await actor('anon');await assert.rejects(()=>work(),/permission denied/);await assert.rejects(()=>resolve(),/permission denied/);
 await actor();for(const table of ['loan_capacity_policy','loan_capacity_overrides','loan_capacity_events'])for(const action of ['select * from ','delete from '])await assert.rejects(()=>q(action+table),/permission denied/);
 checks.push('default global off; financial_rules permission and Finance module boundary; no browser table access; anonymous and unrelated request writers denied');
 await actor('service_role');let result=await resolve();assert.deepEqual(result.funds.map(f=>Number(f.available_amount)),[30000,18740]);
 const runtime=(await one('select get_loan_capacity_runtime($1) v',[id(1)])).v;assert.equal(runtime.funds.length,2);assert.equal(runtime.rules.length,2);
 for(const s of [source({affiliate_id:id(2)}),source({numero_control:'7'}),source({business_day:'2000-01-01'}),source({observed_at:'2000-01-01T00:00:00Z'}),source({funds:[]}),source({represented_request_ids:[id(100)]}),source({funds:[{fund_id:id(11),pending_amount:-1,active_loans:1},{fund_id:id(12),pending_amount:0,active_loans:0}]}),source({funds:[{fund_id:id(11),pending_amount:0,active_loans:1},{fund_id:id(11),pending_amount:0,active_loans:1}]})])await assert.rejects(()=>resolve(s),/LOAN_CAPACITY_SOURCE/);
 await assert.rejects(()=>resolve(source(),[id(100)]),/RULE_CHANGED/);
 await assert.rejects(()=>resolve(source(),[null]),/RULE_CHANGED/);
 await assert.rejects(()=>resolve(source({source_version:null})),/SOURCE_VERSION_CHANGED/);
 await assert.rejects(()=>resolve(source({source_version:id(302)})),/SOURCE_VERSION_CHANGED/);
 await assert.rejects(()=>resolve(source({source_updated_at:'2026-10-01T22:01:00Z'})),/SOURCE_VERSION_CHANGED/);
 result=await resolve(source({funds:[{fund_id:id(11),pending_amount:50000,active_loans:2},{fund_id:id(12),pending_amount:0,active_loans:0}]}));assert.equal(Number(result.funds[0].available_amount),0);
 checks.push('40,000 minus 10,000 = 30,000; 25,000 minus 6,260 = 18,740; clamp zero; exact identity/day/TTL/source integrity and canonical rule checks; published History version required, age alone never expires daily source');
 const insert=async(request,amount=15000,s=source(),status='requires_financial_processing',program='prestamo')=>q(`insert into program_requests(id,folio,actor_real_auth_user_id,affiliate_id,program_id,status,requested_amount,financial_processing_status,financial_submission_snapshot)
 values($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,[id(request),'SR-'+request,id(9),id(1),program,status,amount,{criterion_identity:'SUPABASE_RULE:'+id(21),financialResult:{amount,total:amount+100},loan_capacity:s}]);
 await insert(101);result=await resolve();assert.equal(Number(result.funds[0].reserved_amount),15000);assert.equal(Number(result.funds[0].available_amount),15000);
 await assert.rejects(()=>insert(102,15001),/LOAN_CAPACITY_EXCEEDED/);assert.equal(Number((await one('select count(*) n from program_requests')).n),1);
 await insert(102,15000);await assert.rejects(()=>insert(103,1),/LOAN_CAPACITY_EXCEEDED/);
 let transitioned=source({funds:[{fund_id:id(11),pending_amount:15100,active_loans:1},{fund_id:id(12),pending_amount:6260,active_loans:1}],represented_request_ids:[id(101)]});
 result=await resolve(transitioned);assert.equal(Number(result.funds[0].pending_amount),15100);assert.equal(Number(result.funds[0].reserved_amount),15000);assert.equal(Number(result.funds[0].available_amount),9900);
 await q("update program_requests set status='cancelled' where id=$1",[id(102)]);result=await resolve(transitioned);assert.equal(Number(result.funds[0].available_amount),24900);
 await q("update program_requests set status='approved' where id=$1",[id(101)]);result=await resolve(transitioned);assert.equal(Number(result.funds[0].reserved_amount),0);
 await q("update program_requests set status='rejected' where id=$1",[id(101)]);result=await resolve();assert.equal(Number(result.funds[0].reserved_amount),0);
 checks.push('canonical requests reserve principal; second competing request sees consumed capacity; rollback leaves no request; exact amortization identity replaces reservation once; cancellation/rejection release');
 await actor('authenticated',['financial_rules.write']);let admin=await individual(true,0);assert.equal(admin.funds[0].allow_full,true);await assert.rejects(()=>individual(false,0,82),/STALE/);
 assert.equal((await individual(true,0)).funds[0].version,1);
 await actor('service_role');result=await resolve();assert.equal(Number(result.funds[0].available_amount),40000);assert.equal(result.funds[0].exemption,'INDIVIDUAL');assert.equal(Number(result.funds[1].available_amount),18740);
 await insert(104,40000);await assert.rejects(()=>insert(105,40001),/LOAN_CAPACITY_EXCEEDED/);
 await actor('authenticated',['financial_rules.write']);await global(true,0);await assert.rejects(()=>global(false,0,72),/STALE/);assert.equal((await global(true,0)).policy.version,1);
 await actor('service_role');result=await resolve();assert.equal(Number(result.funds[1].available_amount),25000);assert.equal(result.funds[0].exemption,'GLOBAL');
 await actor('authenticated',['financial_rules.write']);await global(false,1,72);await actor('service_role');result=await resolve();assert.equal(result.funds[0].exemption,'INDIVIDUAL');assert.equal(Number(result.funds[1].available_amount),18740);
 await actor('authenticated',['financial_rules.write']);await individual(false,1,82);await actor('service_role');result=await resolve();assert.equal(Number(result.funds[0].available_amount),0);assert.equal(result.funds[0].exemption,null);
 checks.push('per-person/per-fund waiver capped at original max; global supersedes all debts; disabling global preserves individual grant; revocation reapplies debt; stale/idempotent mutations');
 await db.exec('reset role');await assert.rejects(()=>q("update loan_capacity_events set reason='altered'"),/AUDIT_IMMUTABLE/);
 const events=await q("select action,actor_real_auth_user_id,after_state from loan_capacity_events where action='SUBMIT' order by created_at");assert.equal(events.length,3);assert.equal(events[2].after_state.exemption,'INDIVIDUAL');assert(events.every(e=>e.actor_real_auth_user_id===id(9)));
 // Exercise the actual authenticated RPC with an existing valid snapshot. Only
 // cryptographic identity hashing is stubbed; the live function body is intact.
 const rules=[{id:'caja--caja-chica--r1',rule_id:id(21),program_id:'caja',status:'AVAILABLE',category:'BASE',union:'SUTI',max_amount:40000}];
 await q(`insert into financial_session_snapshots(id,affiliate_id,actor_real_auth_user_id,financial_profile_version,profile_fingerprint,term_policy_fingerprint,
 calculation_contract_version,session_purpose,eligible_rules,expires_at,loan_capacity) values($1,$2,$3,1,repeat('A',64),repeat('A',64),'SUTI_LOAN_QUOTE_V3','LOAN',$4,clock_timestamp()+interval '15 minutes',$5)`,[id(201),id(1),id(9),rules,source()]);
 await actor('authenticated',[]);await assert.rejects(()=>q('select resolve_current_loan_snapshot_quote($1,$2,$3,$4)',[id(201),'caja--caja-chica--r1',1,6]),/LOAN_CAPACITY_EXCEEDED/);
 await actor('authenticated',['financial_rules.write']);await individual(true,2,83);
 await db.exec('reset role');await q('update financial_session_snapshots set invalidated_at=null,invalidation_reason=null where id=$1',[id(201)]);
 await actor('authenticated',[]);const quote=(await one('select resolve_current_loan_snapshot_quote($1,$2,$3,$4) v',[id(201),'caja--caja-chica--r1',40000,6])).v;assert.equal(quote.maxAmount,40000);assert.equal(quote.availableAmount,40000);assert.equal(quote.interest,100);assert.equal(quote.loanCapacity.exemption,'INDIVIDUAL');
 await actor('authenticated',[],id(2));await assert.rejects(()=>q('select resolve_current_loan_snapshot_quote($1,$2,$3,$4)',[id(201),'caja--caja-chica--r1',1,6]),/SNAPSHOT_INVALID/);
 checks.push('authenticated quote enforces current capacity and context; original max/pricing result unchanged; audit immutable and actor retained');
 await db.exec('reset role');const before=(await one('select md5(jsonb_agg(to_jsonb(e) order by id)::text) h from loan_capacity_events e')).h;
 await db.exec(fs.readFileSync(path.join(root,'supabase/recovery/20261027000100_loan_available_credit.sql'),'utf8'));
 assert.equal((await one('select md5(jsonb_agg(to_jsonb(e) order by id)::text) h from loan_capacity_events e')).h,before);
 assert.equal((await one("select md5(pg_get_functiondef('public.resolve_current_loan_snapshot_quote(uuid,text,numeric,integer)'::regprocedure)) h")).h,hash);
 await actor('authenticated',['financial_rules.write']);await assert.rejects(()=>work(),/permission denied/);await actor('service_role');await assert.rejects(()=>resolve(),/permission denied/);
 checks.push('recovery restores exact quote/OID/grants and removes new enforcement/API while preserving all requests, policy history, grants and observation evidence');
 const resultFile={status:'PASS',checks,productionTouched:false,engine:'PGlite PostgreSQL',migration:'20261027000100'};
 const output=path.join(root,'docs/qa/evidence/loan-available-credit');fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'sql.json'),JSON.stringify(resultFile,null,2)+'\n');console.log(JSON.stringify(resultFile));
 }finally{await db.close();}
}
main().catch(error=>{console.error(JSON.stringify({message:error.message,code:error.code,where:error.where,actual:error.actual,expected:error.expected,stack:error.code?undefined:error.stack}));process.exitCode=1;});
