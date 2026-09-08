'use strict';
// Bounded concurrent no-op updates, always ROLLBACK. Never runs a live request deletion.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir='C:/tmp/sutiapp-request-delete-20260908',out=root+'/docs/qa/evidence/admin-request-delete-20260908',env={},mode=process.argv[2];
for(const l of fs.readFileSync('C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const quote=s=>"'"+s.replace(/'/g,"''")+"'",rpc='public.guard_request_deletion_child()',name='20260908000401_request_delete_sync_lock_order',sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function sql(query){const r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(55000)});const d=await r.json();if(!r.ok){const error=Error(d.message||'SQL_FAILED');error.deadlock=/40P01|deadlock detected/i.test(error.message);throw error;}return d;}
const definition=()=>sql("select oid,proacl::text as acl,pg_get_functiondef(oid) as definition from pg_proc where oid='"+rpc+"'::regprocedure");
const strip=s=>s.replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
function proof(n,v){fs.writeFileSync(out+'/lock-'+n+'.json',JSON.stringify(v,null,2)+'\n');console.log(JSON.stringify(v));}
async function main(){
 if(mode==='before'||mode==='after'){
  const r=(await sql("select r.id from public.program_requests r join public.program_request_google_sync s on s.request_id=r.id where r.folio='SR-2026-000175' and s.lease_until is null and not exists(select 1 from public.program_request_deletions d where d.request_id=r.id)"))[0];assert(r,'Unmodified QA request unavailable; do not recreate');
  if(mode==='before'){const f=(await definition())[0];fs.writeFileSync(dir+'/guard-before.json',JSON.stringify(f));fs.writeFileSync(root+'/supabase/recovery/'+name+'_recovery.sql','begin;\n'+f.definition+';\ncommit;\n');}
  const snapshot="select md5(to_jsonb(r)::text) as request_hash,md5(to_jsonb(s)::text) as sync_hash from public.program_requests r join public.program_request_google_sync s on s.request_id=r.id where r.id="+quote(r.id);
  const before=await sql(snapshot);
  const first=sql("begin;set local application_name='H_DELETE_LOCK_A';set local statement_timeout='15s';select id from public.program_requests where id="+quote(r.id)+" for update;select pg_sleep(5);update public.program_request_google_sync set attempts=attempts where request_id="+quote(r.id)+";rollback;").then(()=>({ok:true}),e=>({ok:false,deadlock:e.deadlock,error:e.deadlock?'DEADLOCK':e.message.slice(0,160)}));
  // Wait only until A holds the parent (pg_sleep follows FOR UPDATE).
  let ready=false;for(let i=0;i<8;i++){const a=await sql("select exists(select 1 from pg_stat_activity where application_name='H_DELETE_LOCK_A' and wait_event='PgSleep') as ready");if(a[0].ready){ready=true;break;}await new Promise(r=>setTimeout(r,200));}assert(ready,'Parent lock rendezvous unavailable');
  const second=sql("begin;set local statement_timeout='15s';update public.program_request_google_sync set attempts=attempts where request_id="+quote(r.id)+";rollback;").then(()=>({ok:true}),e=>({ok:false,deadlock:e.deadlock,error:e.deadlock?'DEADLOCK':e.message.slice(0,160)}));
  const results=await Promise.all([first,second]);assert.deepEqual(await sql(snapshot),before,'Persistent row changed');
  if(mode==='before')assert(results.some(r=>r.deadlock),'Expected baseline conflict not reproduced');else assert(results.every(r=>r.ok),'Refined lock order still conflicts');
  proof(mode,{status:'PASS',expectedBaselineConflict:mode==='before',results,persistentWrites:0});return;
 }
 const previous=JSON.parse(fs.readFileSync(dir+'/guard-before.json')),source=fs.readFileSync(root+'/supabase/migrations/'+name+'.sql','utf8'),guard="do $$ begin if pg_get_functiondef('"+rpc+"'::regprocedure)<>"+quote(previous.definition)+" then raise exception 'GUARD_BASELINE_DRIFT';end if;end $$;";
 if(mode==='dry-run'){
  const actor=JSON.parse(fs.readFileSync(dir+'/admin-actor.json')).id;
  await sql('begin;'+guard+strip(source)+"select set_config('request.jwt.claim.sub',"+quote(actor)+",true);savepoint matrix;"+fs.readFileSync(root+'/scripts/test-admin-request-delete.sql','utf8')+'rollback to matrix;'+strip(fs.readFileSync(root+'/supabase/recovery/'+name+'_recovery.sql','utf8'))+guard+'rollback;');proof(mode,{status:'PASS',migrationSha256:sha(source),deletionMatrixAndExactRecovery:true,persistentWrites:0});return;
 }
 if(mode==='apply'){
  assert.equal(JSON.parse(fs.readFileSync(out+'/lock-dry-run.json')).migrationSha256,sha(source));
  await sql('begin;'+guard+strip(source)+"insert into supabase_migrations.schema_migrations(version,name,statements)values('20260908000401','request_delete_sync_lock_order',array["+quote(source)+']);commit;');
  const current=(await definition())[0];assert.equal(current.oid,previous.oid);assert.equal(current.acl,previous.acl);proof(mode,{status:'PASS',version:'20260908000401',sameOidAndGrants:true,businessWrites:0});return;
 }
 throw Error('INVALID_MODE');
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',mode,error:e.message.slice(0,300)}));process.exitCode=1;});
