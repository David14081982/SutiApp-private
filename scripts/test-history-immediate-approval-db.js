'use strict';
// Real local PostgreSQL; isolated synthetic rows, unchanged baseline context/snapshot SQL.
const fs=require('fs'),path=require('path'),net=require('net'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),tmp=path.join(root,'.tmp/history-immediate-approval/db-'+Date.now());
const bin=process.env.HISTORY_PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
const original=read('supabase/migrations/20261025000100_self_loan_history.sql');
const snapshot=read('supabase/migrations/20261026000100_loan_history_snapshot.sql');
const migration=read('supabase/migrations/20261026000200_loan_history_approvals.sql');
const recovery=read('supabase/recovery/20261026000200_loan_history_approvals.sql');
const lit=v=>v==null?'null':"'"+String(v).replaceAll("'","''")+"'",uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const checks=[];let port,started=false;
const exe=n=>path.join(bin,n+(process.platform==='win32'?'.exe':''));
function command(n,args,input){const r=cp.spawnSync(exe(n),args,{input,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw Error(n+' failed '+r.status+': '+(r.stderr||r.stdout||r.error));return r.stdout;}
const args=()=>['-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'];
const pre=(o={})=>`set timezone='UTC';set test.actor=${lit(o.actor||'')};set test.affiliate=${lit(o.affiliate||'')};set role ${o.role||'postgres'};`;
const sql=(s,o)=>command('psql',args(),pre(o)+s);
function value(s,o){return JSON.parse(sql("select coalesce(to_jsonb("+s+"),'null'::jsonb);",o).trim().split(/\r?\n/).at(-1));}
const denied=(s,o,pattern=/permission denied/)=>assert.throws(()=>sql(s,o),pattern);
const self=(n=1)=>({role:'authenticated',actor:uid(n),affiliate:uid(n)});
const approvals=(n=1)=>value('public.get_self_loan_history_approvals()',self(n));
const revision=(n=1)=>value(`(select version from public.loan_history_approval_publication where affiliate_id=${lit(uid(n))})`);
const approval={financialResult:{fund:'Synthetic fund',amount:1234.56,total:1480.75,paymentCount:12},private_unrelated:'not exported'};
const approvalSQL=lit(JSON.stringify(approval))+'::jsonb';
const approve=(n=11)=>`update public.program_requests set status='approved',financial_approved_at='2026-10-26T21:21:00Z',financial_processing_status='ready_for_handoff',financial_approval_snapshot=${approvalSQL} where id=${lit(uid(n))};`;
const business=()=>value("jsonb_build_object('affiliates',(select jsonb_agg(a order by id) from public.affiliates a),'requests',(select jsonb_agg(r order by id) from public.program_requests r))");
const globalState=()=>value(`jsonb_build_object('state',(select jsonb_agg(s) from loan_history_private.state s),
 'observations',(select jsonb_agg(o order by folio) from loan_history_private.observations o),
 'runs',(select jsonb_agg(r order by id) from loan_history_private.runs r),
 'staged',(select jsonb_agg(s order by run_id,folio) from loan_history_private.staged s),
 'publication',(select jsonb_agg(p) from public.loan_history_publication p),
 'cron',(select jsonb_agg(j order by jobid) from cron.job j),'http',(select count(*) from net.requests))`);
const contextMeta=()=>value("(select jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl,'config',proconfig,'security',prosecdef,'volatility',provolatile,'definition',pg_get_functiondef(oid)) from pg_proc where oid='public.get_self_loan_history_context()'::regprocedure)");
const untouchedFunctions=()=>value("(select jsonb_agg(jsonb_build_object('oid',p.oid,'definition',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','loan_history_private') and p.prokind='f' and p.proname not in ('get_self_loan_history_context','get_self_loan_history_approvals','publish_approval_revision'))");
async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
function held(statement){const child=cp.spawn(exe('psql'),args(),{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';const ready=new Promise((resolve,reject)=>{child.stdout.on('data',b=>{out+=b.toString();if(out.includes('HELD'))resolve();});child.stderr.on('data',b=>err+=b);child.once('error',reject);child.once('exit',c=>{if(c!==0||!out.includes('HELD'))reject(Error(err||'lock failed'));});});const done=new Promise((resolve,reject)=>child.once('exit',c=>c===0?resolve():reject(Error(err))));child.stdin.write('begin;'+statement+"select 'HELD';\n");return {ready,done,commit:()=>child.stdin.end('commit;\n')};}
async function main(){
 fs.mkdirSync(tmp,{recursive:true});const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));port=socket.address().port;await new Promise(r=>socket.close(r));
 command('initdb',['-D',path.join(tmp,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8','--wal-segsize=1']);
 const log=fs.openSync(path.join(tmp,'control.log'),'a');
 try{
  const start=cp.spawnSync(exe('pg_ctl'),['-D',path.join(tmp,'data'),'-l',path.join(tmp,'server.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start'],{windowsHide:true,stdio:['ignore',log,log]});assert.equal(start.status,0);started=true;
  sql(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema vault;create schema net;create schema cron;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
   create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
   create function public.has_admin_permission(p text) returns boolean language sql stable as $$select false$$;
   create function public.admin_module_boundary(p text[],a text default 'read') returns boolean language sql stable as $$select false$$;
   create table public.affiliates(id uuid primary key,numero_control text,is_archived boolean not null default false);
   create table public.program_requests(id uuid primary key,affiliate_id uuid not null references affiliates(id) on delete cascade,folio text,status text,financial_approved_at timestamptz,financial_processing_status text,created_at timestamptz,rental_start date,financial_approval_snapshot jsonb,notes text);
   create index program_requests_affiliate_created_idx on public.program_requests(affiliate_id,created_at desc);
   insert into affiliates values(${lit(uid(1))},'0007',false),(${lit(uid(2))},'7',false),(${lit(uid(3))},'EMPTY',false),(${lit(uid(4))},'NO-AUTH',false);
   insert into program_requests(id,affiliate_id,folio,status,created_at) values
    (${lit(uid(11))},${lit(uid(1))},'SR-SYNTHETIC-1','in_review','2026-10-26T20:00:00Z'),
    (${lit(uid(12))},${lit(uid(2))},'SR-SYNTHETIC-2','in_review','2026-10-26T20:00:00Z'),
    (${lit(uid(13))},${lit(uid(3))},'SR-SYNTHETIC-3','in_review','2026-10-26T20:00:00Z');
   ${approve(12)}
   create table vault.decrypted_secrets(name text,decrypted_secret text);
   create table net.requests(id bigint generated always as identity,url text,headers jsonb,body jsonb);
   create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 1000) returns bigint language plpgsql as $$declare i bigint;begin insert into net.requests(url,headers,body) values(url,headers,body) returning id into i;return i;end$$;
   create table cron.job(jobid bigint generated always as identity,jobname text unique,schedule text,command text);
   create function cron.schedule(n text,s text,c text) returns bigint language plpgsql as $$declare i bigint;begin insert into cron.job(jobname,schedule,command) values(n,s,c) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid into i;return i;end$$;
   create function cron.unschedule(i bigint) returns boolean language plpgsql as $$begin delete from cron.job where jobid=i;return found;end$$;
   create publication supabase_realtime;grant usage on schema public,auth to authenticated,anon,service_role;`);
  sql(original);sql(snapshot);
  sql(`insert into loan_history_private.runs(id,kind,requested_at,status) values(${lit(uid(90))},'SCHEDULE','2026-10-26T17:23:00Z','SUCCEEDED');
   insert into loan_history_private.observations(folio,source,content_hash,changed_at,published_run_id)
    values('0007','{"loans":[{"id":"SYNTHETIC-OLD","owner":"0007","amount":91.25,"date":"2026-11-15","status":"AL CORRIENTE"}],"requests":[],"issues":[]}',repeat('a',64),'2026-10-26T17:23:00Z',${lit(uid(90))});`);
  const beforeBusiness=business(),beforeGlobal=globalState(),beforeContext=contextMeta(),beforeFunctions=untouchedFunctions();
  await test('additive install preserves all business rows, global state, cron and previous function OIDs/grants',()=>{
   sql(migration);assert.deepEqual(business(),beforeBusiness);assert.deepEqual(globalState(),beforeGlobal);assert.deepEqual(untouchedFunctions(),beforeFunctions);
   const after=contextMeta();assert.deepEqual({...after,definition:null},{...beforeContext,definition:null});
   assert.equal(value('(select count(*) from public.loan_history_approval_publication)'),0);
   assert.deepEqual(value("(select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='loan_history_approval_publication')"),['affiliate_id','version']);
   denied(migration,{},/HISTORY_APPROVAL_ALREADY_INSTALLED/);assert.deepEqual(business(),beforeBusiness);
  });
  await test('prior confirmed approvals readable immediately without quota snapshot or metadata seeding',()=>{
   const first=approvals(2);assert.equal(first.approval_revision,null);assert.deepEqual(first.requests[0].approval_display,{fund:'Synthetic fund',principal:1234.56,total:1480.75,term:12});
   assert.equal(first.requests[0].approved_at,'2026-10-26T21:21:00+00:00');assert.equal(approvals().requests[0].approval_display,null);
   denied('select public.get_self_loan_history_snapshot()',self(),/HISTORY_SNAPSHOT_DISABLED/);
   assert(!JSON.stringify(first).includes('private_unrelated'));assert.equal(value('(select count(*) from net.requests)'),0);
  });
  await test('only authenticated own RPC/select grants; no browser/service writes or trigger invocation',()=>{
   for(const role of ['anon','service_role'])denied('select public.get_self_loan_history_approvals()',{role});
   for(const role of ['anon','authenticated','service_role']){
    denied('insert into public.loan_history_approval_publication values(gen_random_uuid(),gen_random_uuid())',{role});
    denied('update public.loan_history_approval_publication set version=gen_random_uuid()',{role});
    denied('delete from public.loan_history_approval_publication',{role});
    denied('select * from loan_history_private.approval_context_backup',{role});
    denied('select loan_history_private.publish_approval_revision()',{role});
   }
   denied('select * from public.loan_history_approval_publication',{role:'anon'});
   denied("select public.get_self_loan_history_approvals('7')",self(),/does not exist/);
   denied('select public.get_self_loan_history_approvals()',{role:'authenticated'},/HISTORY_AUTH_REQUIRED/);
   assert.equal(value("(select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in ('public.loan_history_approval_publication'::regclass,'loan_history_private.approval_context_backup'::regclass))"),true);
  });
  await test('approval creates one own opaque revision and leaves exact financial contract untouched',()=>{
   sql(approve());assert(revision());assert.equal(revision(2),null);assert.equal(approvals().approval_revision,revision());
   const row=value(`(select to_jsonb(r) from program_requests r where id=${lit(uid(11))})`);
   assert.deepEqual(row,{...beforeBusiness.requests.find(r=>r.id===uid(11)),status:'approved',financial_approved_at:'2026-10-26T21:21:00+00:00',financial_processing_status:'ready_for_handoff',financial_approval_snapshot:approval});
   assert.deepEqual(row.financial_approval_snapshot,approval);assert.equal(row.financial_processing_status,'ready_for_handoff');assert.equal(row.status,'approved');
   assert.equal(row.financial_approved_at,'2026-10-26T21:21:00+00:00');assert.equal(row.notes,null);
   assert.equal(value('(select count(*) from public.loan_history_approval_publication)',self()),1);
   assert.equal(value('(select count(*) from public.loan_history_approval_publication)',self(2)),0);
  });
  await test('no-op, unrelated edits and handoff transitions do not publish approval changes',()=>{
   const before=revision();sql(`update program_requests set notes='synthetic note',financial_processing_status='handed_off' where id=${lit(uid(11))};${approve()}`);
   assert.equal(revision(),before);
   sql(`update program_requests set financial_approval_snapshot=financial_approval_snapshot||'{"new_unrelated":"ignored"}'::jsonb where id=${lit(uid(11))}`);assert.equal(revision(),before);
  });
  await test('other affiliate approval invalidates only its own metadata row, with exact Folio separation',()=>{
   const first=revision();sql(`update program_requests set financial_approved_at=financial_approved_at+interval '1 second' where id=${lit(uid(12))}`);
   assert.equal(revision(),first);assert(revision(2));
   assert.equal(value(`(select count(*) from public.loan_history_approval_publication where affiliate_id=${lit(uid(2))})`,self()),0);
   assert.equal(approvals().folio,'0007');assert.equal(approvals(2).folio,'7');assert.equal(approvals().requests.length,1);
  });
  await test('approval transaction publishes only after commit and never partially changes another reader',async()=>{
   const first=revision(),hold=held(`update program_requests set financial_approved_at=financial_approved_at+interval '2 seconds' where id=${lit(uid(11))};`);
   await hold.ready;try{assert.equal(revision(),first);}finally{hold.commit();await hold.done;}assert.notEqual(revision(),first);
  });
  await test('pending/rejected/nonfinancial/rental and incomplete approvals do not create signals',()=>{
   sql(`update program_requests set status='rejected' where id=${lit(uid(13))};
    update program_requests set status='approved',financial_approved_at=now(),financial_approval_snapshot=${approvalSQL} where id=${lit(uid(13))};`);
   assert.equal(revision(3),null);assert.equal(approvals(3).requests[0].approval_display,null);
   sql(`update program_requests set rental_start='2026-10-01',financial_processing_status='ready_for_handoff' where id=${lit(uid(13))}`);
   assert.equal(revision(3),null);sql(`update program_requests set rental_start=null,financial_approved_at=null where id=${lit(uid(13))}`);assert.equal(revision(3),null);
   sql(`update program_requests set financial_approved_at=now(),financial_approval_snapshot=null where id=${lit(uid(13))}`);assert.equal(revision(3),null);
   sql(`update program_requests set financial_approval_snapshot=${approvalSQL},status='completed' where id=${lit(uid(13))}`);assert.equal(revision(3),null);
  });
  await test('approval removal publishes once and clears the own display without fallback',()=>{
   const first=revision();sql(`update program_requests set status='cancelled' where id=${lit(uid(11))}`);assert.notEqual(revision(),first);assert.equal(approvals().requests[0].approval_display,null);
   const second=revision();sql(`update program_requests set status='rejected' where id=${lit(uid(11))}`);assert.equal(revision(),second);sql(approve());assert.notEqual(revision(),second);
  });
  await test('INSERT/DELETE approvals signal; owner movement invalidates both exact affiliates',()=>{
   sql(`insert into program_requests(id,affiliate_id,folio,status,financial_approved_at,financial_processing_status,financial_approval_snapshot,created_at)
    values(${lit(uid(14))},${lit(uid(4))},'SR-INSERT','approved',now(),'ready_for_handoff',${approvalSQL},now())`);
   const inserted=revision(4);assert(inserted);sql(`delete from program_requests where id=${lit(uid(14))}`);assert.notEqual(revision(4),inserted);
   const a=revision(),b=revision(2);sql(`update program_requests set affiliate_id=${lit(uid(2))} where id=${lit(uid(11))}`);assert.notEqual(revision(),a);assert.notEqual(revision(2),b);assert.equal(approvals().requests.length,0);
   sql(`update program_requests set affiliate_id=${lit(uid(1))} where id=${lit(uid(11))}`);
  });
  await test('missing, archived, ambiguous and malformed effective identities fail closed',()=>{
   denied('select get_self_loan_history_approvals()',{role:'authenticated',actor:uid(1),affiliate:uid(99)},/IDENTITY_DENIED/);
   sql(`update affiliates set numero_control='0007' where id=${lit(uid(4))}`);denied('select get_self_loan_history_approvals()',self(),/IDENTITY_AMBIGUOUS/);assert.equal(value('(select count(*) from loan_history_approval_publication)',self()),0);
   sql(`update affiliates set is_archived=true where id=${lit(uid(4))}`);assert.equal(approvals().folio,'0007');
   sql(`update affiliates set is_archived=true where id=${lit(uid(1))}`);denied('select get_self_loan_history_approvals()',self(),/IDENTITY_DENIED/);assert.equal(value('(select count(*) from loan_history_approval_publication)',self()),0);
   sql(`update affiliates set is_archived=false where id=${lit(uid(1))}`);
   for(const control of [' 7','7\n','\u00a07','x'.repeat(101),'0','']){sql(`update affiliates set is_archived=false,numero_control=${lit(control)} where id=${lit(uid(4))}`);denied('select get_self_loan_history_approvals()',self(4),/IDENTITY_AMBIGUOUS/);assert.equal(value('(select count(*) from loan_history_approval_publication)',self(4)),0);}
   sql(`update affiliates set numero_control='NO-AUTH' where id=${lit(uid(4))}`);
   const assisted=value('get_self_loan_history_approvals()',{role:'authenticated',actor:uid(99),affiliate:uid(2)});assert.equal(assisted.actor,uid(99));assert.equal(assisted.affiliate_id,uid(2));assert.equal(assisted.requests.length,1);
  });
  await test('single metadata publication only; independent daily/manual source and writers remain byte-equivalent',()=>{
   assert.deepEqual(globalState(),beforeGlobal);assert.deepEqual(untouchedFunctions(),beforeFunctions);
   assert.deepEqual(value("(select jsonb_agg(tablename order by tablename) from pg_publication_tables where pubname='supabase_realtime')"),['loan_history_approval_publication','loan_history_publication']);
   assert(!/\b(?:http_post|request_admin_loan_history_sync|run_daily|pg_notify)\s*\(/i.test(value("(select prosrc from pg_proc where oid='loan_history_private.publish_approval_revision()'::regprocedure)")));
  });
  await test('legitimate synthetic affiliate cascade is preserved without recreating metadata for a missing owner',()=>{
   sql(`insert into program_requests(id,affiliate_id,folio,status,financial_approved_at,financial_processing_status,financial_approval_snapshot,created_at)
    values(${lit(uid(15))},${lit(uid(4))},'SR-CASCADE','approved',now(),'ready_for_handoff',${approvalSQL},now())`);
   assert(revision(4));sql(`delete from affiliates where id=${lit(uid(4))}`);
   assert.equal(revision(4),null);assert.equal(value(`(select count(*) from program_requests where affiliate_id=${lit(uid(4))})`),0);assert.deepEqual(globalState(),beforeGlobal);
  });
  await test('recovery detects changed context and leaves installed infrastructure intact',()=>{
   const installed=contextMeta().definition;sql(installed.replace('actor uuid:=auth.uid();','actor uuid:=auth.uid(); -- isolated drift'));
   denied(recovery,{},/HISTORY_APPROVAL_RECOVERY_DRIFT/);assert.equal(value("to_regclass('public.loan_history_approval_publication') is not null"),true);sql(installed);
  });
  await test('recovery restores exact baseline definition/OID/grants and preserves all business/global records',()=>{
   const before=business();sql(recovery);assert.deepEqual(business(),before);assert.deepEqual(globalState(),beforeGlobal);assert.deepEqual(contextMeta(),beforeContext);assert.deepEqual(untouchedFunctions(),beforeFunctions);
   assert.equal(value("to_regclass('public.loan_history_approval_publication') is null"),true);assert.equal(value("to_regprocedure('public.get_self_loan_history_approvals()') is null"),true);
   assert.deepEqual(value("(select jsonb_agg(tablename) from pg_publication_tables where pubname='supabase_realtime')"),['loan_history_publication']);
  });
  const evidence={status:'PASS',environment:'Native local PostgreSQL / isolated loopback / synthetic rows',productionWrites:0,checks,
   migrationSha256:hash(migration),recoverySha256:hash(recovery),
   limitations:['Auth signature and existing effective-identity resolver are fixture boundaries; the original resolver is never changed.','Realtime publication/RLS/atomic commit are verified; websocket transport requires browser/live verification.','Cron, Vault and pg_net are local transport stubs; no Google calls or production business mutations occur.']};
  const output=process.env.SUTI_HISTORY_APPROVAL_DB_EVIDENCE||path.join(root,'docs/qa/evidence/history-immediate-approval/db.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length,evidence:output}));
 }finally{if(started)cp.spawnSync(exe('pg_ctl'),['-D',path.join(tmp,'data'),'-m','fast','-w','stop'],{windowsHide:true,stdio:['ignore',log,log]});fs.closeSync(log);}
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
