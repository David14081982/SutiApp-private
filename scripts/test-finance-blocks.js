'use strict';
// Real PostgreSQL engine, isolated synthetic identities. No network or production writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),{PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function main(){
 const db=new PGlite(),checks=[],q=async(s,p=[])=>(await db.query(s,p)).rows,one=async(s,p=[])=>(await q(s,p))[0];
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.has_admin_permission(p text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? p$$;
 create function public.admin_module_boundary(text[],text default 'read') returns boolean language sql stable as $$select current_setting('test.denied',true) is distinct from 'true'$$;
 create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
 create table public.affiliates(id uuid primary key,numero_control text,full_name text);
 create table public.program_requests(id uuid primary key,affiliate_id uuid references affiliates(id),program_id text,program_item_id uuid,membership_offering_id uuid,financial_processing_status text);
 insert into affiliates values('${id(1)}','00007','Persona sintética'),('${id(2)}','00008','Otra persona');
 insert into program_requests(id,affiliate_id,program_id) values('${id(10)}','${id(1)}','prestamo');`);
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261004000300_finance_blocks.sql'),'utf8'));
 const actor=async(permissions=[],affiliate=id(1),denied=false,uid=id(9))=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false),set_config('test.affiliate',$2,false),set_config('test.permissions',$3,false),set_config('test.denied',$4,false)",[uid,affiliate,JSON.stringify(permissions),String(denied)]);await db.exec('set role authenticated');};
 const self=async()=>(await one('select get_self_finance_block() v')).v;
 const today=(await one("select ((clock_timestamp() at time zone 'America/Hermosillo')::date)::text d")).d;
 const save=async(block=null,version=null,start=today,end=today,reason='Documentación pendiente')=>(await one('select save_admin_finance_block($1,$2,$3,$4,$5,$6) v',[id(10),block,version,start,end,reason])).v;
 await actor();assert.deepEqual(await self(),{blocked:false});await assert.rejects(()=>save(),/WRITE_DENIED/);await assert.rejects(()=>q('select list_admin_finance_blocks(null)'),/ACCESS_DENIED/);
 await actor(['program_requests.write'],id(1),true);await assert.rejects(()=>save(),/WRITE_DENIED/);
 await actor(['program_requests.write','program_requests.read']);
 await assert.rejects(()=>save(null,null,'2026-10-05','2026-10-04'),/DATES_OR_REASON_INVALID/);await assert.rejects(()=>save(null,null,today,today,'   '),/DATES_OR_REASON_INVALID/);
 const b=await save();assert.equal(b.numero_control,'00007');assert.equal(b.affiliate_id,id(1));assert.equal((await self()).blocked,true);
 await assert.rejects(()=>save(),/ALREADY_EXISTS/);await assert.rejects(()=>save(b.id,999),/VERSION_CHANGED/);
 const rows=(await one('select list_admin_finance_blocks(null) v')).v;assert.equal(rows[0].events.length,1);assert.equal(rows[0].events[0].actor_auth_user_id,id(9));
 checks.push('permissions/module boundary; blank reason/reversed dates/stale version; raw control and real actor; same-day inclusive');
 await actor([],id(2));assert.deepEqual(await self(),{blocked:false});await actor();assert.equal((await self()).block.reason,'Documentación pendiente');
 for(const table of ['finance_blocks','finance_block_events'])for(const sql of ['select * from '+table,'delete from '+table,'update '+table+' set id=id'])await assert.rejects(()=>q(sql),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(()=>self(),/permission denied/);
 await actor([], '',false,'');await assert.rejects(()=>self(),/ACCESS_DENIED/);
 checks.push('self only; anonymous/other affiliate/no identity; private RLS tables prohibit browser reads and writes');
 await db.exec('reset role');
 for(const [program,item,member,processing] of [['prestamo',null,null,null],['auto',id(31),null,null],['membership',null,id(32),null],['marketplace',null,null,'pending']]){
  await assert.rejects(()=>q('insert into program_requests values($1,$2,$3,$4,$5,$6)',[id(20),id(1),program,item,member,processing]),/FINANCE_REQUEST_BLOCKED/);
 }
 assert.equal(Number((await one('select count(*) n from program_requests')).n),1);
 await q("insert into program_requests(id,affiliate_id,program_id) values($1,$2,'marketplace')",[id(21),id(1)]);
 await q("insert into program_requests(id,affiliate_id,program_id) values($1,$2,'prestamo')",[id(22),id(2)]);
 await q("update affiliates set numero_control='00007A' where id=$1",[id(1)]);
 await assert.rejects(()=>q("insert into program_requests(id,affiliate_id,program_id) values($1,$2,'prestamo')",[id(23),id(1)]),/FINANCE_REQUEST_BLOCKED/);
 checks.push('all financial entry paths denied at canonical insertion; zero partial request; other affiliate/ordinary Marketplace unaffected; control edit cannot bypass FK');
 await actor(['program_requests.write','program_requests.read']);
 let revision=await save(b.id,1,'2099-01-01','2099-01-02');assert.equal((await self()).blocked,false);
 revision=await save(b.id,revision.version,'2000-01-01','2000-01-02');assert.equal((await self()).blocked,false);
 revision=await save(b.id,revision.version);assert.equal((await self()).blocked,true);
 await assert.rejects(()=>q('select revoke_admin_finance_block($1,$2,$3)',[b.id,revision.version,'']),/REASON_REQUIRED/);
 await q('select revoke_admin_finance_block($1,$2,$3)',[b.id,revision.version,'Revisión completada']);assert.equal((await self()).blocked,false);
 assert.equal((await one('select list_admin_finance_blocks(null) v')).v[0].events.length,5);
 checks.push('scheduled/expired/current dates; edits preserve events; lifting immediate and auditable');
 await db.exec('reset role');
 await q('delete from program_requests where id=$1',[id(10)]);
 assert.equal((await one('select source_request_id from finance_blocks where id=$1',[b.id])).source_request_id,null);
 assert.equal((await one("select after_state->>'source_request_id' value from finance_block_events where block_id=$1 and action='CREATE'",[b.id])).value,id(10));
 await actor(['program_requests.write','program_requests.read']);revision=await save(b.id,revision.version+1);assert.equal((await self()).blocked,true);
 await db.exec('reset role');await assert.rejects(()=>q("insert into program_requests(id,affiliate_id,program_id) values($1,$2,'prestamo')",[id(23),id(1)]),/FINANCE_REQUEST_BLOCKED/);
 checks.push('authorized source-request deletion preserves affiliate restriction and original request ID in immutable history');
 const before=(await one('select md5(jsonb_agg(to_jsonb(e))::text) v from finance_block_events e')).v;
 await db.exec(fs.readFileSync(path.join(root,'supabase/recovery/20261004000300_finance_blocks.sql'),'utf8'));
 assert.equal((await one('select md5(jsonb_agg(to_jsonb(e))::text) v from finance_block_events e')).v,before);
 await q("insert into program_requests(id,affiliate_id,program_id) values($1,$2,'prestamo')",[id(23),id(1)]);
 checks.push('recovery removes API/enforcement and retains full private history');
 const dir=path.join(root,'docs/qa/evidence/finance-blocks');fs.mkdirSync(dir,{recursive:true});const result={status:'PASS',checks,productionTouched:false};fs.writeFileSync(path.join(dir,'sql.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
