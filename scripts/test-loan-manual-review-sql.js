'use strict';
// Focused actual PostgreSQL tests; no remote access or real personal data.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const {PGlite}=require(process.env.LOAN_REVIEW_PGLITE_MODULE||'C:/tmp/balam-sql-probe/node_modules/@electric-sql/pglite');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function main(){
 const db=new PGlite(),checks=[];const q=async(s,p=[])=>(await db.query(s,p)).rows;
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${id(99)}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
 create function public.has_admin_permission(text) returns boolean language sql stable as $$select $1='program_requests.read' and current_setting('test.admin',true)='true'$$;
 create function public.admin_module_boundary(text[],text) returns boolean language sql stable as $$select $1=array['finanzas'] and $2='read' and current_setting('test.boundary',true)='true'$$;
 create table public.affiliates(id uuid primary key,numero_control text,full_name text);
 create table public.program_requests(id uuid primary key,affiliate_id uuid,program_id text,status text);
 grant usage on schema auth to authenticated;grant select,insert,update on public.program_requests to authenticated;
 create schema loan_capacity_private;
 create function loan_capacity_private.resolve(p_affiliate_id uuid,p_source jsonb,p_rule_ids uuid[],p_exclude_request uuid default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return p_source;
end $$;
 create function public.test_quote(uuid,jsonb) returns jsonb language sql security definer set search_path='' as $$select loan_capacity_private.resolve($1,$2,null,null)$$;
 grant execute on function public.test_quote(uuid,jsonb) to authenticated;`);
 const original=(await q("select pg_get_functiondef('loan_capacity_private.resolve(uuid,jsonb,uuid[],uuid)'::regprocedure) d"))[0].d;
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261028000100_loan_historical_review_guard.sql'),'utf8'));
 const patched=(await q("select pg_get_functiondef('loan_capacity_private.resolve(uuid,jsonb,uuid[],uuid)'::regprocedure) d"))[0].d;
 assert.equal(patched.replace(' perform loan_review_private.assert_clear(p_affiliate_id);\n',''),original);
 for(let n=1;n<=14;n++)await q('insert into affiliates values($1,$2,$3)',[id(n),n<=5?null:String(n),'Synthetic '+n]);
 const cases=[];
 for(let n=1;n<=12;n++){
  const c=(await q("insert into loan_historical_review_cases(affiliate_id,obligation_key,cause_code,cause,evidence,previous_value) values($1,$2,$3,'Documented ambiguous historical record','[\"Original source coordinate\"]','{\"value\":null}') returning id",[id(n),'loan:'+n,n<=5?'CONTROL_MISSING':'FUND_UNRESOLVED']))[0].id;cases.push(c);
  await q("insert into loan_historical_review_events(case_id,action,actor_auth_user_id,reason,evidence,before_state,resolution) values($1,'REGISTER',$2,'Owner authorized review registration','[\"Documented investigation\"]','{\"value\":null}','{\"status\":\"PENDING\"}')",[c,id(99)]);
 }
 const actor=async(n=1,admin=false,boundary=true)=>{await db.exec('reset role');await q("select set_config('test.actor',$1,false),set_config('test.affiliate',$2,false),set_config('test.admin',$3,false),set_config('test.boundary',$4,false)",[id(99),id(n),String(admin),String(boundary)]);await db.exec('set role authenticated');};
 for(let n=1;n<=12;n++){await actor(n);assert.equal((await q('select get_self_loan_historical_review() r'))[0].r.status,'HISTORICAL_LOAN_MAPPING_REQUIRED');await assert.rejects(q('select test_quote($1,$2)',[id(n),{available_amount:50000}]),/HISTORICAL_LOAN_MAPPING_REQUIRED/);await assert.rejects(q("insert into program_requests values($1,$2,'prestamo','submitted')",[id(100+n),id(n)]),/HISTORICAL_LOAN_MAPPING_REQUIRED/);}
 checks.push('12 pending UUIDs protected including five missing controls; old/fast quote and direct loan creation denied');
 for(const n of [13,14]){await actor(n);assert.equal((await q('select get_self_loan_historical_review() r'))[0].r.status,'CLEAR');const expected={available_amount:12345.67,pending_amount:456.78,reserved_amount:90};assert.deepEqual((await q('select test_quote($1,$2) r',[id(n),expected]))[0].r,expected);}
 checks.push('normal and previously fixed synthetic profiles retain exact original capacity payload');
 await actor(1);await assert.rejects(q('select list_admin_loan_historical_reviews()'),/READ_DENIED/);await actor(1,true,false);await assert.rejects(q('select list_admin_loan_historical_reviews()'),/READ_DENIED/);
 await actor(1,true);const rows=(await q('select list_admin_loan_historical_reviews() r'))[0].r;assert.equal(rows.length,12);assert(rows.every(r=>r.status==='PENDING'&&r.events.length===1&&r.evidence.length));assert.equal((await q('select list_admin_loan_historical_reviews($1) r',[id(2)]))[0].r.length,1);
 for(const table of ['loan_historical_review_cases','loan_historical_review_events']){await assert.rejects(q('select * from '+table),/permission denied/);await assert.rejects(q('delete from '+table),/permission denied/);}
 await db.exec('reset role;set role anon');await assert.rejects(q('select get_self_loan_historical_review()'),/permission denied/);await assert.rejects(q('select list_admin_loan_historical_reviews()'),/permission denied/);
 checks.push('Admin permission plus Finance boundary enforced; self state contains no case or foreign identity details; browser tables and anonymous RPC denied');
 await db.exec('reset role');await assert.rejects(q("update loan_historical_review_cases set cause='Untraced change'"),/IMMUTABLE/);await assert.rejects(q('delete from loan_historical_review_events'),/IMMUTABLE/);
 await assert.rejects(q("insert into loan_historical_review_events(case_id,action,actor_auth_user_id,reason,evidence,before_state,resolution) values($1,'RESOLVE',$2,'Unproven arbitrary fund','[\"test\"]','{}','{}')",[cases[0],id(99)]),/check constraint/);
 assert.equal(Number((await q('select count(*) n from program_requests'))[0].n),0);
 await q("insert into program_requests values($1,$2,'prestamo','submitted')",[id(200),id(13)]);await q('update program_requests set affiliate_id=$1 where id=$2',[id(1),id(200)]);await actor(1,true);await assert.rejects(q("update program_requests set status='approved' where id=$1",[id(200)]),/HISTORICAL_LOAN_MAPPING_REQUIRED/);
 checks.push('immutable prior values and audit; incomplete manual resolution rejected; approval guard prevents granting doubtful credit');
 await db.exec('reset role');await db.exec(fs.readFileSync(path.join(root,'supabase/recovery/20261028000100_loan_historical_review_guard.sql'),'utf8'));await actor(1);await assert.rejects(q('select get_self_loan_historical_review()'),/permission denied/);await assert.rejects(q('select test_quote($1,$2)',[id(1),{}]),/HISTORICAL_LOAN_MAPPING_REQUIRED/);await db.exec('reset role');assert.equal(Number((await q('select count(*) n from loan_historical_review_events'))[0].n),12);
 checks.push('recovery retires reader access while retaining all evidence and safety guards');
 const out=path.join(root,'docs/qa/evidence/loan-manual-review');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sql.json'),JSON.stringify({status:'PASS',engine:'PGlite PostgreSQL',checks,syntheticCases:12,productionTouched:false},null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
