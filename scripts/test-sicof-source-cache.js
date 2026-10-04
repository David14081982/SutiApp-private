'use strict';
// Real additive SQL in isolated PostgreSQL/WASM. Vault, pg_net and pg_cron are
// explicit local test boundaries; no credentials, Google calls or business writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const migration=read('supabase/migrations/20261003000600_sicof_source_cache.sql');
const recovery=read('supabase/recovery/20261003000600_sicof_source_cache.sql');
const cadence=read('supabase/migrations/20261003000700_sicof_source_refresh_cadence.sql');
const cadenceRecovery=read('supabase/recovery/20261003000700_sicof_source_refresh_cadence.sql');
async function main(){
 const db=new PGlite(),checks=[];
 const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const value=async(sql,args=[])=>(await query(sql,args))[0]?.value;
 const owner=()=>db.exec('reset role');
 const role=async name=>{await owner();await db.exec('set role '+name);};
 const test=async(name,fn)=>{await owner();await fn();checks.push(name);console.log('PASS '+name);};
 const rpc=async(name,args=[])=>{await role('service_role');return value('select public.service_sicof_source_'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') value',args);};
 const reset=async()=>{await owner();await db.exec('delete from sicof_source_private.observation;insert into sicof_source_private.observation(singleton) values(true)');};
 const ageAttempt=async seconds=>{await owner();await db.query("update sicof_source_private.observation set last_attempt_at=clock_timestamp()-($1||' seconds')::interval",[seconds]);};
 const timestamp=async(offset=0)=>value("select to_char((clock_timestamp()+($1||' seconds')::interval) at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') value",[offset]);
 const {SICOF_FIELDS,SICOF_COLUMNS,SICOF_WORKBOOK,SICOF_LOAN_CONTRACT}=await import('../supabase/functions/sicof/loan-source.mjs');
 const source=async({hash='a',size=2,offset=0}={})=>({contract_version:SICOF_LOAN_CONTRACT,source:SICOF_WORKBOOK+':1245291756',headers:Array.from({length:30},(_,i)=>'Synthetic header '+i),columns:[...SICOF_COLUMNS],observed_at:await timestamp(offset),source_fingerprint:hash.repeat(64),scanned_rows:size,date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE',rows:Array.from({length:size},(_,i)=>({source_row:i+2,...Object.fromEntries(SICOF_FIELDS.map(field=>[field,null])),folio:i?'123':'00123',paid:i?0:123.456789,process:false,name:'=SYNTHETIC()',fund:i?'OTHER':'Caja de Ahorro'}))});
 const install=async()=>{await owner();await db.exec(migration);};
 const financialState=async()=>{await owner();return {rows:await query('select * from public.savings_transactions'),func:await query("select oid::text,proacl::text,proowner::text,pg_get_functiondef(oid) from pg_proc where oid='public.protected_financial_reader()'::regprocedure")};};
 const failed=async(fn,pattern)=>assert.rejects(fn,pattern);
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema vault;create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
   create schema net;create table net.calls(id bigint generated always as identity,url text,body jsonb,headers jsonb,timeout integer);
   create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 1000) returns bigint language plpgsql as $$declare result bigint;begin insert into net.calls(url,body,headers,timeout) values(url,body,headers,timeout_milliseconds) returning id into result;return result;end$$;
   create schema cron;create table cron.job(jobid bigint primary key,jobname text,command text);
   create function cron.unschedule(bigint) returns boolean language plpgsql as $$begin delete from cron.job where jobid=$1;return found;end$$;
   insert into cron.job values(1,'unrelated-job','select 1');
   create table public.savings_transactions(id integer primary key,amount numeric not null);insert into public.savings_transactions values(1,123.45);
   create function public.protected_financial_reader() returns numeric language sql stable as $$select sum(amount) from public.savings_transactions$$;
   revoke all on function public.protected_financial_reader() from public;
   grant execute on function public.protected_financial_reader() to authenticated;
  `);
  const protectedBefore=await financialState();
  await test('additive installation preserves financial rows/functions and schedules nothing',async()=>{
   await install();assert.deepEqual(await financialState(),protectedBefore);
   assert.equal(await value('select count(*)::integer value from cron.job'),1);assert.equal(await value('select count(*)::integer value from net.calls'),0);
   assert.equal(await value("select count(*)::integer value from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='sicof_source_private' and c.relkind='r'"),1);
   assert.match(migration,/for update/);assert(!/create or replace|cron\.schedule\s*\(/i.test(migration));
  });
  await test('FORCE RLS and ACL deny browser roles and direct service table access',async()=>{
   const table=(await query("select relrowsecurity,relforcerowsecurity from pg_class where oid='sicof_source_private.observation'::regclass"))[0];assert(table.relrowsecurity&&table.relforcerowsecurity);
   for(const name of ['anon','authenticated','service_role']){
    await role(name);for(const sql of ['select * from sicof_source_private.observation','delete from sicof_source_private.observation','select sicof_source_private.run_refresh()'])await failed(()=>db.query(sql),/permission denied/);
    if(name!=='service_role')for(const call of ['read()','claim(true)',"finish('00000000-0000-4000-8000-000000000001'::uuid,null,'ERROR')"])await failed(()=>db.query('select public.service_sicof_source_'+call),/permission denied/);
   }
   await owner();assert.equal(await value("select count(*)::integer value from pg_policies where schemaname='sicof_source_private'"),0);
   const publicFunctions=await query("select p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) owner,p.proacl::text acl from pg_proc p where p.proname in ('service_sicof_source_read','service_sicof_source_claim','service_sicof_source_finish')");
   assert.equal(publicFunctions.length,3);for(const f of publicFunctions){assert(f.prosecdef);assert.equal(f.owner,'postgres');assert(f.proconfig.includes('search_path=pg_catalog'));assert(!f.acl.includes('=X/postgres,')||f.acl.includes('postgres='));assert(!/[{,]=X\//.test(f.acl));}
  });
  await test('empty read, single flight, hidden lease and exact successful source replacement',async()=>{
   await reset();assert.deepEqual((await rpc('read')).source,null);assert.equal((await rpc('read')).meta.state,'EMPTY');
   const attempts=await Promise.all([rpc('claim',[false]),rpc('claim',[false])]);assert.equal(attempts.filter(x=>x.claimed).length,1);
   const lease=attempts.find(x=>x.claimed).lease;assert.match(lease,/^[a-f0-9-]{36}$/);assert.equal((await rpc('read')).meta.refreshing,true);assert(!Object.hasOwn((await rpc('read')).meta,'lease'));
   const input=await source();const done=await rpc('finish',[lease,input,null]);assert.equal(done.meta.version,1);assert.equal(done.meta.state,'READY');assert.equal(done.meta.refreshing,false);
   const current=await rpc('read');assert.deepEqual(current.source,input);assert.equal(Date.parse(current.meta.expires_at)-Date.parse(current.meta.observed_at),300000);assert(current.meta.last_success_at);assert.equal(current.meta.last_error,null);
  });
  await test('TTL boundary is exactly 300 seconds and stale reads omit source',async()=>{
   await owner();for(const [seconds,expected]of [[299.999,'READY'],[300,'STALE'],[300.001,'STALE']])assert.equal(await value("select sicof_source_private.metadata(o,observed_at+($1||' seconds')::interval)->>'state' value from sicof_source_private.observation o",[seconds]),expected);
   await db.exec("update sicof_source_private.observation set observed_at=clock_timestamp()-interval '300 seconds'");
   const expired=await rpc('read');assert.equal(expired.meta.state,'STALE');assert.equal(expired.source,null);assert(expired.meta.observed_at);
  });
  await test('normal and forced refresh obey separate cooldowns',async()=>{
   await reset();const c=await rpc('claim',[false]);await rpc('finish',[c.lease,null,'SICOF_SYNTHETIC_FAILURE']);
   assert.equal((await rpc('claim',[true])).claimed,false);await ageAttempt(61);assert.equal((await rpc('claim',[false])).claimed,false);
   const forced=await rpc('claim',[true]);assert(forced.claimed);await rpc('finish',[forced.lease,null,'SICOF_SYNTHETIC_FAILURE']);
   await ageAttempt(181);assert.equal((await rpc('claim',[false])).claimed,true);
  });
  await test('same fingerprint renews observation only; changed source removes deleted rows',async()=>{
   await reset();let c=await rpc('claim',[false]);const input=await source();await rpc('finish',[c.lease,input,null]);
   await ageAttempt(61);c=await rpc('claim',[true]);const renewed={...input,observed_at:await timestamp()};const done=await rpc('finish',[c.lease,renewed,null]);assert.equal(done.meta.version,1);assert.deepEqual((await rpc('read')).source,renewed);
   await ageAttempt(61);c=await rpc('claim',[true]);const fewer=await source({hash:'b',size:1});const changed=await rpc('finish',[c.lease,fewer,null]);assert.equal(changed.meta.version,2);assert.deepEqual((await rpc('read')).source,fewer);
   await ageAttempt(61);c=await rpc('claim',[true]);const forged=structuredClone(fewer);forged.observed_at=await timestamp();forged.rows[0].paid=999;await failed(()=>rpc('finish',[c.lease,forged,null]),/SICOF_SOURCE_CACHE_CONTENT_MISMATCH/);
   assert.equal((await rpc('read')).source.rows[0].paid,fewer.rows[0].paid);
  });
  await test('failed refresh never extends expiry and sanitizes diagnostics',async()=>{
   await reset();const initial=await rpc('claim',[false]);await rpc('finish',[initial.lease,await source(),null]);const before=await rpc('read');await ageAttempt(61);
   const c=await rpc('claim',[true]);const failedRefresh=await rpc('finish',[c.lease,null,'Synthetic private detail must not appear']);
   const after=await rpc('read');assert.deepEqual(after.source,before.source);assert.equal(after.meta.expires_at,before.meta.expires_at);assert.equal(after.meta.last_success_at,before.meta.last_success_at);assert.equal(after.meta.version,before.meta.version);
   assert.equal(failedRefresh.meta.last_error,'SICOF_SOURCE_REFRESH_FAILED');assert.equal(after.meta.refreshing,false);
  });
  await test('expired or replaced tokens cannot publish or clear a newer lease',async()=>{
   await reset();const first=await rpc('claim',[true]);await owner();await db.exec("update sicof_source_private.observation set lease_until=clock_timestamp()-interval '1 second',last_attempt_at=clock_timestamp()-interval '181 seconds'");
   await failed(async()=>rpc('finish',[first.lease,await source(),null]),/SICOF_SOURCE_CACHE_LEASE_EXPIRED/);
   const second=await rpc('claim',[false]);assert(second.claimed);assert.notEqual(second.lease,first.lease);
   await failed(()=>rpc('finish',[first.lease,null,'SICOF_SYNTHETIC_FAILURE']),/SICOF_SOURCE_CACHE_LEASE_EXPIRED/);
   assert((await rpc('read')).meta.refreshing);await rpc('finish',[second.lease,await source(),null]);
   await failed(()=>rpc('finish',[second.lease,null,'SICOF_SYNTHETIC_FAILURE']),/SICOF_SOURCE_CACHE_LEASE_EXPIRED/);
  });
  await test('invalid source contract shape and values cannot be published',async()=>{
   const invalid=[s=>{s.source='another-workbook';},s=>{s.contract_version='OTHER';},s=>{s.columns.reverse();},s=>{s.headers.pop();},s=>{s.headers[0]=7;},s=>{s.source_fingerprint='invalid';},s=>{s.rows=[];s.scanned_rows=0;},s=>{s.scanned_rows=999;},s=>{s.rows[0]=[];},s=>{delete s.rows[0].folio;},s=>{s.rows[0].paid={unexpected:true};},s=>{s.rows[1].source_row=2;},s=>{s.rows[0].source_row=1.5;},s=>{s.rows[0].source_row='2';},s=>{s.observed_at='not-a-date';},s=>{s.observed_at='2026-99-99T00:00:00Z';}];
   for(const mutate of invalid){await reset();const c=await rpc('claim',[true]);const bad=await source();mutate(bad);await failed(()=>rpc('finish',[c.lease,bad,null]),/SICOF_SOURCE_CACHE_SOURCE_INVALID/);assert.equal((await rpc('read')).source,null);}
  });
  await test('expired future and regressing observations fail without overwriting',async()=>{
   for(const offset of [-301,6]){await reset();const c=await rpc('claim',[true]);await failed(async()=>rpc('finish',[c.lease,await source({offset}),null]),/SICOF_SOURCE_CACHE_OBSERVATION_EXPIRED/);}
   await reset();let c=await rpc('claim',[true]);const accepted=await source({offset:4});await rpc('finish',[c.lease,accepted,null]);assert.equal((await rpc('read')).meta.state,'READY');
   await ageAttempt(61);c=await rpc('claim',[true]);await failed(async()=>rpc('finish',[c.lease,await source({hash:'b'}),null]),/SICOF_SOURCE_CACHE_OBSERVATION_OLDER/);assert.equal((await rpc('read')).source.source_fingerprint,accepted.source_fingerprint);
  });
  await test('read does not renew timestamps and source remains unavailable after failed expiry',async()=>{
   await reset();let c=await rpc('claim',[true]);await rpc('finish',[c.lease,await source(),null]);const before=await rpc('read');assert.deepEqual((await rpc('read')).meta,before.meta);
   await owner();await db.exec("update sicof_source_private.observation set observed_at=clock_timestamp()-interval '301 seconds',last_attempt_at=clock_timestamp()-interval '181 seconds'");c=await rpc('claim',[false]);assert(c.claimed);await rpc('finish',[c.lease,null,'SICOF_SYNTHETIC_FAILURE']);const after=await rpc('read');assert.equal(after.meta.state,'STALE');assert.equal(after.source,null);
  });
  await test('scheduled wrapper uses only scoped Vault secrets and fixed worker action',async()=>{
   await owner();await failed(()=>db.query('select sicof_source_private.run_refresh()'),/SICOF_SOURCE_REFRESH_CONFIG_REQUIRED/);
   await db.exec("insert into vault.decrypted_secrets values ('sicof_source_refresh_url','https://synthetic.supabase.co/functions/v1/sicof'),('sicof_source_refresh_anon_key','SYNTHETIC_ANON'),('sicof_source_refresh_secret','SYNTHETIC_WORKER')");
   assert.equal(await value('select sicof_source_private.run_refresh() value'),1);const call=(await query('select * from net.calls'))[0];assert.deepEqual(call.body,{action:'REFRESH_SOURCE_JOB'});assert.equal(call.timeout,60000);assert.equal(call.headers.Authorization,'Bearer SYNTHETIC_ANON');assert.equal(call.headers['x-sicof-source-refresh-secret'],'SYNTHETIC_WORKER');
  });
  await test('large normalized observation round trips without hidden row limits',async()=>{
   await reset();const c=await rpc('claim',[true]),large=await source({size:18000,hash:'c'});await rpc('finish',[c.lease,large,null]);const actual=await rpc('read');assert.deepEqual(actual.source,large);assert.equal(actual.source.rows.length,18000);
  });
  const functionState=()=>query("select p.oid::text,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,pg_get_userbyid(p.proowner) owner,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','sicof_source_private') order by p.oid");
  await owner();const functions006=await functionState(),claim006=functions006.find(f=>f.signature==='service_sicof_source_claim(boolean)');assert(claim006);
  await test('007 preserves installed OIDs ACLs observations and all other function definitions',async()=>{
   const observations=await query('select * from sicof_source_private.observation');await db.exec(cadence);
   assert.deepEqual(await query('select * from sicof_source_private.observation'),observations);
   const after=await functionState();assert.equal(after.length,functions006.length);
   for(const before of functions006){const current=after.find(f=>f.oid===before.oid);assert(current);assert.equal(current.owner,before.owner);assert.equal(current.acl,before.acl);assert.equal(current.signature,before.signature);if(before.oid!==claim006.oid)assert.deepEqual(current,before);else assert.notEqual(current.definition,before.definition);}
   assert.deepEqual(await financialState(),protectedBefore);
  });
  await test('007 periodic claim cannot skip an out-of-phase refresh before five-minute expiry',async()=>{
   await reset();let c=await rpc('claim',[false]);await rpc('finish',[c.lease,await source({offset:-179}),null]);await ageAttempt(181);
   assert.equal((await rpc('read')).meta.state,'READY');c=await rpc('claim',[false]);assert.equal(c.claimed,true,'periodic tick at observed age 179s must run');
   await rpc('finish',[c.lease,await source(),null]);
   assert.equal((await rpc('claim',[true])).claimed,false,'manual remains cooled down');
   const normal=await rpc('claim',[false]);assert.equal(normal.claimed,true,'only the scheduled job controls normal cadence');
   await rpc('finish',[normal.lease,null,'SICOF_SYNTHETIC_FAILURE']);
  });
  await test('007 normal and manual contenders share lease while manual cooldown remains 60s',async()=>{
   await reset();const candidates=await Promise.all([rpc('claim',[false]),rpc('claim',[true])]);assert.equal(candidates.filter(c=>c.claimed).length,1);
   assert.equal((await rpc('claim',[false])).claimed,false);assert.equal((await rpc('claim',[true])).claimed,false);
   await rpc('finish',[candidates.find(c=>c.claimed).lease,null,'SICOF_SYNTHETIC_FAILURE']);
   assert.equal((await rpc('claim',[true])).claimed,false);await ageAttempt(61);const allowed=await rpc('claim',[true]);assert(allowed.claimed);await rpc('finish',[allowed.lease,await source(),null]);
  });
  await test('007 expired worker cannot overwrite or clear a later scheduled lease',async()=>{
   await reset();const first=await rpc('claim',[false]);await owner();await db.exec("update sicof_source_private.observation set lease_until=clock_timestamp()-interval '1 second'");
   const next=await rpc('claim',[false]);assert(next.claimed);assert.notEqual(next.lease,first.lease);
   await failed(()=>rpc('finish',[first.lease,null,'SICOF_SYNTHETIC_FAILURE']),/SICOF_SOURCE_CACHE_LEASE_EXPIRED/);assert((await rpc('read')).meta.refreshing);
   await rpc('finish',[next.lease,await source(),null]);assert.equal((await rpc('read')).meta.state,'READY');
  });
  await test('007 recovery restores the exact 006 claim without changing observations',async()=>{
   const observations=await query('select * from sicof_source_private.observation');await db.exec(cadenceRecovery);
   assert.deepEqual(await functionState(),functions006);assert.deepEqual(await query('select * from sicof_source_private.observation'),observations);
   await reset();const first=await rpc('claim',[false]);await rpc('finish',[first.lease,await source({offset:-179}),null]);await ageAttempt(181);
   assert.equal((await rpc('claim',[false])).claimed,false,'exact 006 age check restored');assert.deepEqual(await financialState(),protectedBefore);
  });
  await test('recovery removes only additive cache and its named job',async()=>{
   await owner();assert.deepEqual(await financialState(),protectedBefore);
   await db.exec("insert into cron.job values(2,'sicof-source-refresh','select sicof_source_private.run_refresh()')");
   await db.exec(recovery);assert.equal(await value("select to_regnamespace('sicof_source_private') value"),null);assert.deepEqual(await query('select jobid,jobname from cron.job'),[{jobid:1,jobname:'unrelated-job'}]);
   assert.equal(await value("select to_regprocedure('public.service_sicof_source_read()') value"),null);assert.deepEqual(await financialState(),protectedBefore);
  });
  const proof={status:'PASS',checks,sourceRows:18000,externalRequests:0,financialWrites:0,concurrency:'atomic row-lock SQL; competing calls serialized by isolated PGlite',clock:'exact TTL tested through immutable private metadata helper; RPC freshness uses clock_timestamp'};
  console.log(JSON.stringify(proof));
 }finally{await db.close();}
}
main().catch(error=>{console.error(JSON.stringify({message:error.message,position:error.position,internalPosition:error.internalPosition,where:error.where}));console.error(error.stack||error);process.exitCode=1;});
