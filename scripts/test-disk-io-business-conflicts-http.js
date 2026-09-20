'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const {connect,claims,ids,targets,out,state}=require('./test-disk-io-business-conflicts');
const tmp=path.resolve(process.env.H01_TEST_DIR||path.join(__dirname,'..','.tmp','disk-io-h01')),log=path.join(tmp,'postgres.log'),exe=process.env.H01_POSTGREST_EXE||'postgrest';
fs.mkdirSync(tmp,{recursive:true});fs.mkdirSync(out,{recursive:true});
const secret=crypto.randomBytes(40).toString('hex');let server;
const conf=path.join(tmp,'postgrest-h01.conf');
fs.writeFileSync(conf,`db-uri = "postgres://authenticator@127.0.0.1:55471/h01"\ndb-schemas = "public"\ndb-anon-role = "anon"\nserver-host = "127.0.0.1"\nserver-port = 55472\njwt-secret = "${secret}"\ndb-pool = 2\nlog-level = "error"\n`);
const token=(sub,role='authenticated')=>{const a=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify({sub,role,exp:Math.floor(Date.now()/1000)+3600,session_id:'h01-local'})).toString('base64url');return a+'.'+b+'.'+crypto.createHmac('sha256',secret).update(a+'.'+b).digest('base64url');};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){const fd=fs.openSync(path.join(tmp,'postgrest.log'),'a');server=cp.spawn(exe,[conf],{env:{...process.env,PATH:process.env.H01_PG_BIN?process.env.H01_PG_BIN+path.delimiter+process.env.PATH:process.env.PATH},windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);for(let i=0;i<40;i++){await pause(100);try{if((await fetch('http://127.0.0.1:55472/')).status===200)return;}catch{}}throw Error('PostgREST startup failed');}
async function stop(){if(server&&!server.killed){server.kill();await new Promise(r=>server.once('exit',r));}server=null;}
async function rpc(name,args,sub=ids.admin,role='authenticated',timeout=5000){const t=performance.now();const r=await fetch('http://127.0.0.1:55472/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',...(sub?{Authorization:'Bearer '+token(sub,role)}:{})},body:JSON.stringify(args),signal:AbortSignal.timeout(timeout)});return{status:r.status,body:await r.json(),ms:performance.now()-t};}
const newLog=offset=>fs.readFileSync(log,'utf8').slice(offset);
const countConflict=s=>(s.match(/ERROR:\s+AFFILIATE_VERSION_CONFLICT/g)||[]).length;
const migration=fs.readFileSync('supabase/migrations/20260907000200_disk_io_business_conflicts.sql','utf8');
const recovery=fs.readFileSync('supabase/recovery/20260907000200_disk_io_business_conflicts_recovery.sql','utf8');
async function main(){const c=await connect(),evidence={environment:'LOCAL_POSTGRESQL_18_POSTGREST_14_5',production_mutations:0,tests:[]};try{
await c.query('update public.affiliates set full_name=$1,affiliate_status_raw=$2,financial_profile_version=0 where id=$3',['H01 User','ACTIVO',ids.affiliate]);
// Verify exact guarded forward/recovery and idempotent repeat before any network scenario.
await c.query(migration);await c.query(migration);await c.query(recovery);await c.query(recovery);
for(const t of targets)assert.equal((await c.query('select md5(pg_get_functiondef($1::regprocedure)) hash',['public.'+t.signature])).rows[0].hash,t.before_md5);
evidence.tests.push({name:'forward/recovery exact and idempotent',status:'PASS'});
await start();const stale={p_affiliate_id:ids.affiliate,p_expected_updated_at:'2000-01-01T00:00:00Z',p_reason:'H01 controlled conflict'};
const beforeOffset=fs.readFileSync(log,'utf8').length;let completed=false;
const pending=rpc('archive_admin_affiliate',stale,ids.admin,'authenticated',1500).then(r=>{completed=true;return r;}).catch(()=>null);
// Independent process watchdog ends the unmodified server retry loop, not merely the HTTP client.
await pause(300);await stop();await pending;await pause(100);
const retries=countConflict(newLog(beforeOffset));assert(retries>1,'Original retry storm must be observable within local bounded window');
evidence.tests.push({name:'original 40001 one HTTP request, external 300ms watchdog',status:'PASS',sql_error_attempts:retries,completed_before_watchdog:completed});
await c.query(migration);await start();
const baseline=await state(c);const offset=fs.readFileSync(log,'utf8').length;
const repeated=[];for(let i=0;i<5;i++){const r=await rpc('archive_admin_affiliate',stale);assert.equal(r.status,409);assert.equal(r.body.code,'PT409');assert.equal(r.body.message,'AFFILIATE_VERSION_CONFLICT');repeated.push({status:r.status,code:r.body.code,ms:r.ms});}
await pause(100);assert.equal(countConflict(newLog(offset)),5,'Exactly one SQL error for each manual HTTP retry');assert.deepEqual(await state(c),baseline,'Stale HTTP changed data');
evidence.tests.push({name:'B/E five manual stale requests',status:'PASS',http_requests:5,sql_conflicts:5,unchanged_data:true,responses:repeated});
const denied=await rpc('archive_admin_affiliate',stale,ids.other);assert.equal(denied.status,403);assert.equal(denied.body.message,'AFFILIATE_WRITE_DENIED');const anon=await rpc('archive_admin_affiliate',stale,null);assert([401,403].includes(anon.status));evidence.tests.push({name:'C normal user and anonymous denied',status:'PASS',normal:denied.status,anon:anon.status});
const stamp=async()=>(await c.query('select updated_at::text stamp from public.affiliates where id=$1',[ids.affiliate])).rows[0].stamp;
let events=Number((await c.query('select count(*) n from public.affiliate_admin_events')).rows[0].n);const valid=await rpc('archive_admin_affiliate',{...stale,p_expected_updated_at:await stamp()});assert.equal(valid.status,200);assert.equal(Number((await c.query('select count(*) n from public.affiliate_admin_events')).rows[0].n),events+1);assert.equal((await c.query('select is_archived from public.affiliates where id=$1',[ids.affiliate])).rows[0].is_archived,true);evidence.tests.push({name:'A correct archive exactly once',status:'PASS',http_requests:1,events_added:1});
const restored=await rpc('restore_admin_affiliate',{...stale,p_expected_updated_at:await stamp()});assert.equal(restored.status,200);assert.equal((await c.query('select is_archived from public.affiliates where id=$1',[ids.affiliate])).rows[0].is_archived,false);evidence.tests.push({name:'F restore correct',status:'PASS'});
const staleRestore=await rpc('restore_admin_affiliate',stale);assert.equal(staleRestore.status,409);assert.equal(staleRestore.body.code,'PT409');
const version=await stamp();events=Number((await c.query('select count(*) n from public.affiliate_admin_events')).rows[0].n);
const concurrent=await Promise.all(['one','two'].map(x=>rpc('update_admin_affiliate',{p_affiliate_id:ids.affiliate,p_expected_updated_at:version,p_patch:{full_name:'H01 concurrent '+x},p_reason:'H01 concurrency test'})));
assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);assert.equal(Number((await c.query('select count(*) n from public.affiliate_admin_events')).rows[0].n),events+1);evidence.tests.push({name:'D concurrent update',status:'PASS',statuses:concurrent.map(r=>r.status),events_added:1});
const statusChange=await rpc('change_admin_affiliate_status',{p_affiliate_id:ids.affiliate,p_expected_updated_at:await stamp(),p_new_status:'BAJA',p_reason:'H01 status test'});assert.equal(statusChange.status,200);evidence.tests.push({name:'F status correct',status:'PASS'});
// Genuine serialization error is generated by PostgreSQL itself and must remain 40001.
const d=await connect();try{await c.query('begin isolation level serializable');await d.query('begin isolation level serializable');await c.query('select full_name from public.affiliates where id=$1',[ids.affiliate]);await d.query('select full_name from public.affiliates where id=$1',[ids.affiliate]);await c.query('update public.affiliates set full_name=$1 where id=$2',['H01 serialized',ids.affiliate]);await c.query('commit');let code;try{await d.query('update public.affiliates set full_name=$1 where id=$2',['H01 serialization competitor',ids.affiliate]);}catch(e){code=e.code;}assert.equal(code,'40001');await d.query('rollback');evidence.tests.push({name:'Genuine PostgreSQL serialization preserved',status:'PASS',sqlstate:code});}finally{await d.end();}
evidence.status='PASS';fs.writeFileSync(path.join(out,'http-concurrency-recovery.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{await stop();await c.query('rollback').catch(()=>{});await c.end();}}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
