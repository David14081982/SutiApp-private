'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const checks=[],test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
async function main(){
 const {category,projectHistory,loadHistory,businessDay}=await import('../supabase/functions/loan-history/history.mjs');
 const now='2026-10-25T19:00:00Z',approved='2026-10-24T19:00:01Z';
 const ctx={actor:'actor-a',affiliate_id:'affiliate-a',folio:'0007',server_now:now,requests:[{id:'request-a',folio:'SR-2026-000001',financial:true,status:'approved',approved_at:approved}]};
 const source={folio:'0007',loans:[{source_row:2,id:'10',owner:'0007',date:'2026-10-25',amount:50,scheduled:50,number:1,fund:'Caja',term:2,principal:80,total:100,status:'AL CORRIENTE',paid_to_date:50,expected_to_date:50},
  {source_row:3,id:'10',owner:'0007',date:'2026-11-15',amount:50,scheduled:50,number:2,fund:'Caja',term:2,principal:80,total:100,status:'AL CORRIENTE',paid_to_date:50,expected_to_date:50}],
  requests:[{id:'10',owner:'0007',status:'Iniciado',receipt:{identity:'SR-2026-000001',id:10,sourceHash:'a'.repeat(64)}}]};
 await test('exact 24h boundary, no future/missing timestamp, liquidated precedence',()=>{
  assert.equal(category('AL CORRIENTE',approved,now),'Aprobadas');assert.equal(category('SALDO ATRASADO','2026-10-24T19:00:00Z',now),'En pago');
  assert.equal(category('AL CORRIENTE',null,now),'En pago');assert.equal(category('AL CORRIENTE','2026-10-26T19:00:00Z',now),'En pago');
  for(const s of ['LIQUIDADO','PAGÓ DE MÁS'])assert.equal(category(s,approved,now),'Liquidadas');
  assert.equal(category('UNKNOWN',approved,now),'Estado por revisar');
 });
 await test('one card per own loan, actual receipt clock, no multiplied principal/totals',()=>{
  const p=projectHistory(source,ctx,now);assert.equal(p.entries.length,1);assert.equal(p.entries[0].principal,80);assert.equal(p.entries[0].total,100);
  assert.equal(p.entries[0].approved_at,approved);assert.equal(p.entries[0].category,'Aprobadas');assert.deepEqual(p.entries[0].schedule.map(r=>r.state),['Pagada','Pendiente']);
  assert.deepEqual(p.covered_request_ids,['request-a']);
  const noLink=structuredClone(source);noLink.requests[0].receipt=null;assert.equal(projectHistory(noLink,ctx,now).entries[0].approved_at,null);
 });
 await test('Hermosillo midnight; unknown values are not zero or invented quota numbers',()=>{
  assert.equal(businessDay('2026-10-26T06:59:59Z'),'2026-10-25');assert.equal(businessDay('2026-10-26T07:00:00Z'),'2026-10-26');
  const s=structuredClone(source);s.loans[0].date='2026-99-99';s.loans[0].number=null;s.loans[0].amount=null;
  const row=projectHistory(s,ctx,now).entries[0].schedule.find(r=>r.source_row===2);assert.equal(row.state,'Fecha por revisar');assert.equal(row.amount,null);assert.equal(row.number,null);
 });
 await test('SR pending and rejected from Google Y; reject duplicate or forged owner/link',()=>{
  const s=structuredClone(source);s.requests.push({id:'SR-2026-000002',owner:'0007',status:'Pendiente'},{id:'SR-2026-000003',owner:'0007',status:'Rechazado'});
  assert.deepEqual(new Set(projectHistory(s,ctx,now).entries.map(r=>r.category)),new Set(['Aprobadas','En proceso','No aprobadas']));
  s.loans[1].owner='7';assert.throws(()=>projectHistory(s,ctx,now),/IDENTITY_MISMATCH/);s.loans[1].owner='0007';s.requests[0].receipt.id=11;assert.throws(()=>projectHistory(s,ctx,now),/TRANSFER_IDENTITY_INVALID/);
  s.requests[0].receipt.id=10;s.requests.push(s.requests[1]);assert.throws(()=>projectHistory(s,ctx,now),/REQUEST_IDENTITY_AMBIGUOUS/);
 });
 await test('backend anonymous/forged-target denial before Google; context revalidated afterward',async()=>{
  let reads=0,contexts=0,changed=false;
  const client={auth:{getUser:async()=>({data:{user:{id:'actor-a'}}})},rpc:async()=>({data:changed&&++contexts===2?{...ctx,affiliate_id:'other'}:ctx})};
  const read=async folio=>{reads++;assert.equal(folio,'0007');return source;};
  await assert.rejects(loadHistory({action:'LOAD',folio:'another'},client,read),/REQUEST_INVALID/);assert.equal(reads,0);
  await assert.rejects(loadHistory({action:'LOAD'},{...client,auth:{getUser:async()=>({error:true})}},read),/AUTH_REQUIRED/);assert.equal(reads,0);
  assert.equal((await loadHistory({action:'LOAD'},client,read)).entries.length,1);changed=true;contexts=0;
  await assert.rejects(loadHistory({action:'LOAD'},client,read),/CONTEXT_CHANGED/);
 });
 await test('frontend server-anchored expiry and source failure; no duplicate request card',()=>{
  const window={};vm.runInNewContext(fs.readFileSync('app/history-loans-repository.js','utf8'),{window,Intl});
  const p=projectHistory(source,ctx,now),original=[{sourceId:'request-a',id:'SR-2026-000001',kind:'loan',ts:1},{sourceId:'other-benefit',id:'other',kind:'benefit',ts:2}];
  assert.equal(window.LoanHistory.project(p,999)[0].category,'Aprobadas');assert.equal(window.LoanHistory.project(p,1000)[0].category,'En pago');
  assert.equal(window.LoanHistory.merge(original,p,0).length,2);assert.equal(window.LoanHistory.merge(original,null,0).length,1,'native nonfinancial requests do not wait for Google');
 });
 await test('PostgreSQL own context, exact controls, grants, archival and recovery',async()=>{
  const {PGlite}=require(path.resolve('.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
  const db=new PGlite();try{
   const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
   await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function public.get_effective_affiliate_id() returns uuid language sql as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
    create table public.affiliates(id uuid,numero_control text,is_archived boolean default false);
    create table public.program_requests(id uuid,affiliate_id uuid,folio text,status text,financial_approved_at timestamptz,financial_processing_status text,created_at timestamptz,rental_start date);
    insert into affiliates values('${a}','0007',false),('${b}','7',false);
    insert into program_requests values('${a}','${a}','SR-A','approved','2026-10-24T19:00:01Z','completed',now(),null),('${b}','${b}','SR-B','approved',now(),'completed',now(),null);`);
   await db.exec(fs.readFileSync('supabase/migrations/20261025000100_self_loan_history.sql','utf8'));
   const call=async()=>(await db.query('select public.get_self_loan_history_context() as value')).rows[0].value;
   await db.exec('set role anon');await assert.rejects(call(),/permission denied/);await db.exec('reset role;set role authenticated');await assert.rejects(call(),/AUTH_REQUIRED/);
   await db.query("select set_config('test.actor',$1,false),set_config('test.affiliate',$1,false)",[a]);
   const own=await call();assert.equal(own.folio,'0007');assert.equal(own.requests.length,1);assert.equal(own.requests[0].folio,'SR-A');assert.equal(Date.parse(own.requests[0].approved_at),Date.parse(approved));
   await db.exec('reset role');await db.query('update program_requests set rental_start=current_date where id=$1',[a]);await db.exec('set role authenticated');assert.equal((await call()).requests[0].financial,false);
   await db.exec('reset role');await db.query('update affiliates set numero_control=$1 where id=$2',['0007',b]);await db.exec('set role authenticated');await assert.rejects(call(),/IDENTITY_AMBIGUOUS/);
   await db.exec('reset role');await db.query('update affiliates set is_archived=true where id=$1',[b]);await db.exec('set role authenticated');assert.equal((await call()).folio,'0007');
   await db.exec('reset role');await db.query('update affiliates set is_archived=true where id=$1',[a]);await db.exec('set role authenticated');await assert.rejects(call(),/IDENTITY_DENIED/);
   await db.exec('reset role');const before=(await db.query('select * from program_requests order by id')).rows;
   await db.exec(fs.readFileSync('supabase/recovery/20261025000100_self_loan_history.sql','utf8'));assert.deepEqual((await db.query('select * from program_requests order by id')).rows,before);
  }finally{await db.close();}
 });
 const out=process.env.SUTI_HISTORY_EVIDENCE_DIR||'docs/qa/evidence/history-loan-payments';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/core.json',JSON.stringify({status:'PASS',checks,productionWrites:0},null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
