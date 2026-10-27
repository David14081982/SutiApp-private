'use strict';
// Native PostgreSQL, independent loopback connections, synthetic rows only.
// Reuse the isolated SQL fixture and execute the new migration verbatim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/loan-available-credit/concurrency-'+Date.now());
const bin=process.env.LOAN_CAPACITY_PG_BIN||'C:/Program Files/PostgreSQL/18/bin',id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const lit=v=>"'"+String(v).replaceAll("'","''")+"'",hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let port,started=false;const checks=[];
const exe=name=>path.join(bin,name+'.exe');
function command(name,args,input){const r=cp.spawnSync(exe(name),args,{input,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});if(r.status!==0)throw Error(name+': '+(r.stderr||r.error||r.stdout));return r.stdout;}
const args=()=>['-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'];
function pre(role='service_role'){
 return `set test.uid=${lit(id(9))};set test.affiliate=${lit(id(1))};set test.permissions='["financial_rules.write"]';set test.denied='false';set test.role=${lit(role)};set role ${role};`;
}
const sql=(s,role='postgres')=>command('psql',args(),pre(role)+s);
const val=s=>JSON.parse(sql('select to_jsonb('+s+');').trim().split(/\r?\n/).at(-1));
function processSql(s,role,name,keepOpen=false){
 const child=cp.spawn(exe('psql'),args(),{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='',resolveReady,rejectReady;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 child.stdout.on('data',b=>{out+=b.toString();if(out.includes('LOCK_HELD'))resolveReady();});child.stderr.on('data',b=>err+=b.toString());
 const done=new Promise((resolve,reject)=>{child.once('error',e=>{rejectReady(e);reject(e);});child.once('close',code=>{if(!out.includes('LOCK_HELD'))rejectReady(Error(err||'LOCK_NOT_HELD'));resolve({code,out,err});});});
 // Non-holding commands never consume their ready promise.
 ready.catch(()=>{});
 child.stdin.write(`set application_name=${lit(name)};set statement_timeout='12s';`+pre(role)+s+'\n');
 if(!keepOpen)child.stdin.end();
 return {child,ready,done,finish(){child.stdin.end('commit;');}};
}
async function locked(name){
 const deadline=Date.now()+5000;
 while(Date.now()<deadline){
  if(val(`exists(select 1 from pg_stat_activity where application_name=${lit(name)} and wait_event_type='Lock')`))return;
  await new Promise(r=>setTimeout(r,35));
 }
 throw Error('SECOND_CONNECTION_DID_NOT_WAIT_FOR_LOCK_'+name);
}
async function race(name,first,second,expected,firstRole='service_role',secondRole='service_role'){
 const key='capacity-'+hash(name).slice(0,12);
 const a=processSql('begin;'+first+"select 'LOCK_HELD';",firstRole,key+'-first',true);
 await a.ready;const b=processSql('begin;'+second+'commit;',secondRole,key+'-second');
 try{await locked(key+'-second');}finally{a.finish();}
 const [ar,br]=await Promise.all([a.done,b.done]);assert.equal(ar.code,0,ar.err);
 if(expected){assert.notEqual(br.code,0);assert(br.err.includes(expected),br.err);}else assert.equal(br.code,0,br.err);
 checks.push({name,status:'PASS',independentConnections:true,actualLockWaitObserved:true,secondOutcome:expected||'COMMITTED'});
 console.log('PASS '+name);return br;
}
async function main(){
 fs.mkdirSync(dir,{recursive:true});const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));port=socket.address().port;await new Promise(r=>socket.close(r));
 command('initdb',['-D',path.join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8','--wal-segsize=1']);
 const log=fs.openSync(path.join(dir,'control.log'),'a');
 try{
  const launch=cp.spawnSync(exe('pg_ctl'),['-D',path.join(dir,'data'),'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start'],{windowsHide:true,stdio:['ignore',log,log]});assert.equal(launch.status,0,'POSTGRES_START');started=true;
  const fixture=fs.readFileSync(path.join(root,'scripts/test-loan-available-credit-sql.js'),'utf8');
  const template=/await db\.exec\(`([\s\S]*?)`\);/.exec(fixture);assert(template,'ISOLATED_FIXTURE_MISSING');
  const setup=vm.runInNewContext('`'+template[1]+'`',{id});
  sql(setup);
  sql(fs.readFileSync(path.join(root,'scripts/fixtures/loan-available-credit/quote-before.sql'),'utf8').replace(/\r\n/g,'\n'));
  sql('revoke all on function resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) from public;grant execute on function resolve_current_loan_snapshot_quote(uuid,text,numeric,integer) to authenticated,service_role;');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261027000100_loan_available_credit.sql'),'utf8');sql(migration);
  const source=()=>({version:1,affiliate_id:id(1),numero_control:'00007',observed_at:new Date().toISOString(),business_day:val("(clock_timestamp() at time zone 'America/Hermosillo')::date"),
   source_version:val('(select version from loan_history_publication where id)'),source_updated_at:val('(select source_updated_at from loan_history_publication where id)'),
   funds:[{fund_id:id(11),pending_amount:10000,active_loans:2},{fund_id:id(12),pending_amount:6260,active_loans:1}],represented_request_ids:[]});
  const insert=(n,amount,s=source())=>`insert into program_requests(id,folio,actor_real_auth_user_id,affiliate_id,program_id,status,requested_amount,financial_processing_status,financial_submission_snapshot) values(${lit(id(n))},${lit('SR-RACE-'+n)},${lit(id(9))},${lit(id(1))},'prestamo','requires_financial_processing',${amount},'pending',${lit(JSON.stringify({criterion_identity:'SUPABASE_RULE:'+id(21),financialResult:{amount,total:amount+100},loan_capacity:s}))}::jsonb);`;
  // Read-only policy version helpers are evaluated by postgres, then supplied to
  // the actual authenticated writer; browser roles retain no direct table access.
  const policy=(enabled,n)=>`select set_admin_loan_capacity_policy(${enabled},${val('(select version from loan_capacity_policy where id)')},'Synthetic concurrency verification',${lit(id(n))});`;
  const override=(enabled,n)=>`select set_admin_loan_capacity_override(${lit(id(1))},${lit(id(11))},${enabled},${val(`coalesce((select version from loan_capacity_overrides where affiliate_id=${lit(id(1))} and fund_id=${lit(id(11))}),0)`)},'Synthetic concurrency verification',${lit(id(n))});`;
  const clear=()=>sql("update program_requests set status='cancelled' where status<>'cancelled';");
  await race('two requests cannot spend the same remaining capacity',insert(501,15000),insert(502,15001),'LOAN_CAPACITY_EXCEEDED');
  assert.equal(val('(select count(*) from program_requests)'),1);assert.equal(val("(select count(*) from loan_capacity_events where action='SUBMIT')"),1);clear();
  await race('two fitting requests commit without losing either reservation',insert(503,15000),insert(504,15000),null);
  assert.equal(val("(select sum(requested_amount) from program_requests where status='requires_financial_processing')"),30000);clear();
  sql(override(true,601),'authenticated');
  await race('individual revocation wins over a concurrent maximum request',override(false,602),insert(505,40000),'LOAN_CAPACITY_EXCEEDED','authenticated');
  sql(policy(true,603),'authenticated');
  await race('global revocation wins over a concurrent maximum request',policy(false,604),insert(506,40000),'LOAN_CAPACITY_EXCEEDED','authenticated');
  const stale=source();
  await race('new publication invalidates concurrent use of previous observation',`update loan_history_publication set version=${lit(id(302))},source_updated_at=clock_timestamp() where id;`,insert(507,1,stale),'LOAN_CAPACITY_SOURCE_VERSION_CHANGED','postgres');
  const current=source();
  await race('publication waits for an already validated request transaction',insert(508,1,current),`update loan_history_publication set version=${lit(id(303))},source_updated_at=clock_timestamp() where id;`,null,'service_role','postgres');
  assert.equal(val(`exists(select 1 from program_requests where id=${lit(id(508))})`),true);
  const result={status:'PASS',environment:'Native PostgreSQL 18; loopback-only isolated synthetic fixtures',checks,productionWrites:0,migrationSha256:hash(migration),fixtureSha256:hash(fixture),limitations:['Existing Auth, permission and quote helpers are fixture boundaries; no remote services or real identities used.','The actual new migration/trigger/resolver/admin RPC SQL is unmodified.']};
  fs.writeFileSync(path.join(root,'.tmp/loan-available-credit/concurrency.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{
  if(started){const stop=cp.spawnSync(exe('pg_ctl'),['-D',path.join(dir,'data'),'-m','fast','-w','stop'],{windowsHide:true,stdio:['ignore',log,log]});assert.equal(stop.status,0,'POSTGRES_STOP');started=false;}
  fs.closeSync(log);
 }
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
