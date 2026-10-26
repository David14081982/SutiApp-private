'use strict';
// Isolated contracts only: no credentials, production reads, writes or evidence overwrite.
const assert=require('node:assert/strict');

async function main(){
 const {projectHistory,loadHistory}=await import('../supabase/functions/loan-history/history.mjs');
 const checks=[],test=async(name,fn)=>{await fn();checks.push(name);};
 const now='2026-10-25T19:00:00Z',approved='2026-10-24T19:00:01Z';
 const context={actor:'fixture-actor',affiliate_id:'fixture-affiliate',folio:'0007',server_now:now,requests:[
  {id:'request-a',folio:'SR-2026-000001',financial:true,approved_at:approved},
  {id:'request-b',folio:'SR-2026-000002',financial:true,approved_at:null},
  {id:'request-c',folio:'SR-2026-000003',financial:true,approved_at:null}
 ]};
 const source={folio:'0007',loans:Array.from({length:120},(_,i)=>({source_row:i+2,id:'10',owner:'0007',
  date:new Date(Date.UTC(2026,0,15+i*15)).toISOString().slice(0,10),number:i+1,amount:50,scheduled:50,
  fund:'Fixture fund',principal:5000,total:6000,term:120,paid_to_date:500,expected_to_date:500,status:'AL CORRIENTE'})),requests:[
  {id:'10',owner:'0007',status:'Iniciado',receipt:{id:10,identity:'SR-2026-000001',sourceHash:'a'.repeat(64)}},
  {id:'SR-2026-000002',owner:'0007',status:'Pendiente',fund:'Fixture fund',principal:50,total:60,term:2,date:'2026-10-25'},
  {id:'SR-2026-000003',owner:'0007',status:'Rechazado',fund:'Fixture fund',principal:50,total:60,term:2,date:'2026-10-24'}
 ]};
 function reader(data=source,ctx=context){
  let reads=0,contextReads=0;
  const client={auth:{getUser:async()=>({data:{user:{id:ctx.actor}}})},rpc:async name=>{
   assert.equal(name,'get_self_loan_history_context');contextReads++;return {data:ctx};
  }};
  return {client,read:async folio=>{reads++;assert.equal(folio,ctx.folio);return data;},get reads(){return reads;},get contexts(){return contextReads;}};
 }
 const invoke=async(body,data=source,ctx=context)=>{const r=reader(data,ctx);return loadHistory(body,r.client,r.read);};
 let full,summary;
 await test('legacy LOAD stays byte-equivalent to the full own projection',async()=>{
  full=await invoke({action:'LOAD'});assert.deepEqual(full,projectHistory(source,context,now));
  assert.equal(full.entries.find(e=>e.key==='loan:10').schedule.length,120);
 });
 await test('SUMMARY contains only card fields, with unchanged filters and approval clock',async()=>{
  summary=await invoke({action:'SUMMARY'});
  const fields=['key','id','sourceId','kind','category','fund','principal','term','date','status','approved_at','expires_at'].sort();
  assert.equal(summary.version,1);assert.equal(summary.server_now,now);assert.equal(summary.business_day,full.business_day);
  assert.deepEqual(summary.covered_request_ids,full.covered_request_ids);assert.deepEqual(summary.financial_request_ids,full.financial_request_ids);
  assert.deepEqual(summary.entries.map(e=>e.key),full.entries.map(e=>e.key));
  for(const entry of summary.entries){
   assert.deepEqual(Object.keys(entry).sort(),fields);
   const original=full.entries.find(e=>e.key===entry.key);
   for(const field of fields)assert.deepEqual(entry[field],original[field]);
  }
  assert.deepEqual(new Set(summary.entries.map(e=>e.category)),new Set(['Aprobadas','En proceso','No aprobadas']));
  assert(!JSON.stringify(summary).includes('source_row'));
 });
 await test('SUMMARY preserves preparing approved entries without copying schedule or totals',async()=>{
  const data=structuredClone(source);data.loans=[];
  const result=await invoke({action:'SUMMARY'},data),entry=result.entries.find(e=>e.key==='request:10');
  assert.equal(entry.preparing,true);assert.equal(entry.category,'Aprobadas');assert.equal(entry.expires_at,'2026-10-25T19:00:01.000Z');
  for(const field of ['schedule','total','paid_to_date','expected_to_date'])assert(!Object.hasOwn(entry,field));
 });
 await test('DETAIL returns exactly one owned entry; missing or foreign key returns no entries or IDs',async()=>{
  for(const key of ['loan:10','request:SR-2026-000002','request:SR-2026-000003']){
   const result=await invoke({action:'DETAIL',key}),entry=full.entries.find(e=>e.key===key);
   assert.deepEqual(result.entries,[entry]);assert.deepEqual(result.covered_request_ids,[entry.sourceId]);
   assert.deepEqual(result.financial_request_ids,[entry.sourceId]);assert.equal(result.server_now,now);
  }
  for(const key of ['loan:999','request:SR-FOREIGN']){
   const result=await invoke({action:'DETAIL',key});assert.deepEqual(result.entries,[]);
   assert.deepEqual(result.covered_request_ids,[]);assert.deepEqual(result.financial_request_ids,[]);
  }
 });
 await test('incomplete blank A/Y rows do not hide valid entries or mutate the source',async()=>{
  const data=structuredClone(source);data.requests.push({id:'',owner:'0007',status:'',receipt:null,fund:'Incomplete source row'});
  const before=JSON.stringify(data);assert.deepEqual(await invoke({action:'LOAD'},data),full);assert.equal(JSON.stringify(data),before);
  data.requests.push({id:'',owner:'0007',status:' \t ',receipt:null});assert.deepEqual(await invoke({action:'SUMMARY'},data),summary);
 });
 await test('blank IDs with status/receipt, duplicate IDs and forged ownership still fail closed',async()=>{
  for(const invalid of [{id:'',owner:'0007',status:'Pendiente',receipt:null},
    {id:'',owner:'0007',status:'',receipt:{id:10}},
    {...source.requests[1]},
    {id:'',owner:'7',status:'',receipt:null}]){
   const data=structuredClone(source);data.requests.push(invalid);
   await assert.rejects(invoke({action:'SUMMARY'},data),/HISTORY_(REQUEST_IDENTITY_AMBIGUOUS|SOURCE_IDENTITY_MISMATCH)/);
  }
  const data=structuredClone(source);data.loans[0].owner='7';
  await assert.rejects(invoke({action:'DETAIL',key:'loan:10'},data),/HISTORY_SOURCE_IDENTITY_MISMATCH/);
  const forged=structuredClone(source);forged.requests[0].receipt.id=11;
  await assert.rejects(invoke({action:'SUMMARY'},forged),/HISTORY_TRANSFER_IDENTITY_INVALID/);
 });
 await test('malformed keys and client identity selectors are rejected before any source/context read',async()=>{
  const r=reader();
  for(const body of [null,[],{}, {action:'OTHER'},{action:'SUMMARY',folio:'7'},{action:'LOAD',key:'loan:10'},
    {action:'SUMMARY',key:'loan:10'},{action:'DETAIL'},{action:'DETAIL',key:10},{action:'DETAIL',key:'loan:10',folio:'0007'},
    ...['','10','loan:','loan:../10','loan:10:20',' loan:10','loan:10\n','loan:á','loan:'+('1'.repeat(129))].map(key=>({action:'DETAIL',key}))])
   await assert.rejects(loadHistory(body,r.client,r.read),/HISTORY_REQUEST_INVALID/);
  assert.equal(r.reads,0);assert.equal(r.contexts,0);
 });
 await test('anonymous, wrong actor and context changes cannot read or expose source records',async()=>{
  const anonymous=reader();anonymous.client.auth.getUser=async()=>({error:true});
  await assert.rejects(loadHistory({action:'SUMMARY'},anonymous.client,anonymous.read),/HISTORY_AUTH_REQUIRED/);assert.equal(anonymous.reads,0);
  const denied=reader();denied.client.rpc=async()=>({data:{...context,actor:'other'}});
  await assert.rejects(loadHistory({action:'DETAIL',key:'loan:10'},denied.client,denied.read),/HISTORY_IDENTITY_DENIED/);assert.equal(denied.reads,0);
  for(const changed of [{folio:'7'},{affiliate_id:'other'}]){
   const r=reader();let calls=0;r.client.rpc=async()=>({data:++calls===1?context:{...context,...changed}});
   await assert.rejects(loadHistory({action:'SUMMARY'},r.client,r.read),/HISTORY_CONTEXT_CHANGED/);assert.equal(r.reads,1);assert.equal(calls,2);
  }
  const valid=reader();await loadHistory({action:'SUMMARY'},valid.client,valid.read);assert.equal(valid.reads,1);assert.equal(valid.contexts,2);
 });
 await test('source failures have no fallback and own source identity is checked',async()=>{
  const r=reader();await assert.rejects(loadHistory({action:'SUMMARY'},r.client,async()=>{throw Error('SOURCE_TEST_FAILURE');}),/SOURCE_TEST_FAILURE/);
  await assert.rejects(invoke({action:'SUMMARY'},{...source,folio:'7'}),/HISTORY_SOURCE_INVALID/);
 });
 const fullBytes=Buffer.byteLength(JSON.stringify(full)),summaryBytes=Buffer.byteLength(JSON.stringify(summary));
 await test('summary fixture transfers less than 15 percent of full JSON with 120 installments',async()=>{
  assert(summaryBytes<fullBytes*0.15,{fullBytes,summaryBytes});
 });
 console.log(JSON.stringify({status:'PASS',checks,fixtureJsonBytes:{full:fullBytes,summary:summaryBytes},productionReads:0,productionWrites:0},null,2));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
