'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function main(){
 const {loadPublishedHistory}=await import('../supabase/functions/loan-history/snapshot.mjs');
 const {authorizeSync,claimSync,runClaimedSync}=await import('../supabase/functions/loan-history-sync/worker.mjs');
 const {groupHistorySnapshot}=await import('../supabase/functions/loan-history/snapshot-source.mjs');
 const now='2026-10-26T19:00:00.000Z',run='10000000-0000-4000-8000-000000000001',lease='20000000-0000-4000-8000-000000000001';
 const row=(owner,index)=>({source_row:index+2,id:'10',owner,date:index?'2026-11-15':'2026-10-15',amount:index?0:25,fund:'Caja',term:2,principal:40,total:50,scheduled:25,number:index+1,paid_to_date:25,expected_to_date:25,status:'AL CORRIENTE',authorized:'2026-10-01'});
 const ctx={actor:'actor-a',affiliate_id:'affiliate-a',folio:'0007',server_now:now,requests:[]};
 const source={loans:[row('0007',0),row('0007',1)],requests:[],issues:[]};
 const snapshot={context:ctx,source,source_updated_at:now,sync_version:run,sync_state:{status:'READY',last_attempt_at:now,last_error_code:null}};
 let calls=[];
 const reader={rpc:async(name,args)=>{calls.push({name,args});return {data:structuredClone(snapshot)};}};
 const actual=await loadPublishedHistory({action:'LOAD'},reader);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'get_self_loan_history_snapshot');assert.equal(calls[0].args,undefined);
 assert.equal(actual.entries.length,1);assert.equal(actual.entries[0].schedule[1].state,'Pendiente');assert.equal(actual.source_updated_at,now);
 assert.ok(!JSON.stringify(actual).includes('actor-a'));assert.ok(!JSON.stringify(actual).includes('affiliate-a'));
 for(const body of [{action:'LOAD',folio:'7'},{action:'DETAIL',key:'loan:10',owner:'7'},{action:'DETAIL',key:'../other'},{action:'GLOBAL'},null])await assert.rejects(loadPublishedHistory(body,reader),/REQUEST_INVALID/);
 assert.equal(calls.length,1,'invalid selectors never call backend');
 const detail=await loadPublishedHistory({action:'DETAIL',key:'loan:11'},reader);assert.equal(detail.entries.length,0);
 const summary=await loadPublishedHistory({action:'SUMMARY'},reader);assert.equal(summary.entries[0].schedule,undefined);
 const read=value=>({rpc:async()=>({data:value})});
 await assert.rejects(loadPublishedHistory({action:'LOAD'},read({...snapshot,source:null,sync_version:null})),/SNAPSHOT_NOT_READY/);
 await assert.rejects(loadPublishedHistory({action:'LOAD'},read({...snapshot,source:{...source,issues:[{owner:'0007',source_row:2,code:'HISTORY_TRANSFER_IDENTITY_INVALID'}]}})),/TRANSFER_IDENTITY_INVALID/);
 await assert.rejects(loadPublishedHistory({action:'LOAD'},read({...snapshot,source:{...source,loans:[row('7',0)]}})),/SOURCE_IDENTITY_MISMATCH/);
 const noRows=await loadPublishedHistory({action:'LOAD'},read({...snapshot,source:{loans:[],requests:[],issues:[]}}));assert.equal(noRows.entries.length,0);
 const stale=await loadPublishedHistory({action:'LOAD'},read({...snapshot,sync_state:{status:'FAILED',last_attempt_at:now,last_error_code:'HISTORY_SNAPSHOT_SOURCE_CHANGED'}}));assert.equal(stale.entries.length,1);assert.equal(stale.sync_state.status,'FAILED');
 for(const code of ['42501','PGRST301'])await assert.rejects(loadPublishedHistory({action:'LOAD'},{rpc:async()=>({error:{code}})}),code==='42501'?/IDENTITY_DENIED/:/AUTH_REQUIRED/);
 const zero=await loadPublishedHistory({action:'LOAD'},read({...snapshot,source:{...source,loans:[{...row('0007',0),amount:0},row('0007',1)]}}));assert.deepEqual(zero.entries[0].schedule.map(x=>x.state),['No se descontó','Pendiente']);
 for(const identity of ['1234','001234']){
  const receipt={id:10,identity,sourceHash:'a'.repeat(64)},request={id:'10',owner:'0007',status:'Iniciado',receipt};
  const numeric={...snapshot,context:{...ctx,requests:[{id:'must-not-link',folio:identity,financial:true,approved_at:now}]},source:{...source,requests:[request]}};
  const projected=await loadPublishedHistory({action:'LOAD'},read(numeric));
  assert.equal(projected.entries.length,1);assert.equal(projected.entries[0].id,'10');assert.equal(projected.entries[0].schedule.length,2);
  assert.equal(projected.entries[0].approved_at,null);assert.equal(projected.entries[0].sourceId,null);assert.equal(projected.entries[0].category,'En pago');assert.deepEqual(projected.covered_request_ids,[]);
  for(const bad of [{identity:' 1234'},{identity:'legacy-1234'},{identity:1234},{id:11},{sourceHash:'invalid'}]){
   const rejected=structuredClone(numeric);Object.assign(rejected.source.requests[0].receipt,bad);
   await assert.rejects(loadPublishedHistory({action:'LOAD'},read(rejected)),/TRANSFER_IDENTITY_INVALID/);
  }
 }
 const sr={...snapshot,context:{...ctx,requests:[{id:'real-sr',folio:'SR-2026-000001',financial:true,approved_at:now}]},source:{...source,requests:[{id:'10',owner:'0007',status:'Iniciado',receipt:{id:10,identity:'SR-2026-000001',sourceHash:'a'.repeat(64)}}]}};
 const linked=await loadPublishedHistory({action:'LOAD'},read(sr));assert.equal(linked.entries[0].approved_at,now);assert.equal(linked.entries[0].category,'Aprobadas');assert.deepEqual(linked.covered_request_ids,['real-sr']);
 const irrelevant={...snapshot,source:{...source,requests:[
  {id:'',owner:'0007',status:'Rechazado',receipt:null},{id:'',owner:'0007',status:'Pendiente',receipt:null},
  {id:'10',owner:'0007',status:'Liquidado',receipt:null},{id:'10',owner:'0007',status:'Liquidado',receipt:null}
 ]}};
 const retained=await loadPublishedHistory({action:'LOAD'},read(irrelevant));assert.equal(retained.entries.length,1);assert.equal(retained.entries[0].schedule.length,2);
 const foreignIrrelevant=structuredClone(irrelevant);foreignIrrelevant.source.requests[0].owner='7';await assert.rejects(loadPublishedHistory({action:'LOAD'},read(foreignIrrelevant)),/SOURCE_IDENTITY_MISMATCH/);
 for(const order of [false,true]){
  const collision=structuredClone(sr),unlinked={id:'10',owner:'0007',status:'Liquidado',receipt:null};
  if(order)collision.source.requests.unshift(unlinked);else collision.source.requests.push(unlinked);
  await assert.rejects(loadPublishedHistory({action:'LOAD'},read(collision)),/REQUEST_IDENTITY_AMBIGUOUS/);
 }
 const duplicateSr={...snapshot,source:{...source,requests:[{id:'SR-2026-X',owner:'0007',status:'Pendiente',receipt:null},{id:'SR-2026-X',owner:'0007',status:'Rechazado',receipt:null}]}};
 await assert.rejects(loadPublishedHistory({action:'LOAD'},read(duplicateSr)),/REQUEST_IDENTITY_AMBIGUOUS/);
 const emptyLinked=structuredClone(sr);emptyLinked.source.requests[0].id='';await assert.rejects(loadPublishedHistory({action:'LOAD'},read(emptyLinked)),/REQUEST_IDENTITY_AMBIGUOUS/);
 console.log('PASS irrelevant blank/numeric request rows retain PV2 loans; foreign owners and all relevant ID collisions still rejected');
 console.log('PASS historical numeric transfer IDs preserved without SR/approval inference; invalid receipts rejected; actual SR clock preserved');
 console.log('PASS one own RPC, strict selector denial, empty/failed snapshot, source ownership, malformed transfer, quota states');
 const secret='a'.repeat(64),body={action:'SYNC',run_id:run};assert.equal(authorizeSync(body,secret,secret),run);
 for(const supplied of ['',secret.slice(1),'b'.repeat(64)])assert.throws(()=>authorizeSync(body,supplied,secret),/DENIED/);
 assert.throws(()=>authorizeSync({...body,folio:'7'},secret,secret),/REQUEST_INVALID/);
 async function envelope(owners){
  const loans=owners.map((owner,index)=>row(owner,index)),requests=[],issues=[];
  const counts={loan_rows:loans.length,request_rows:0,folios:new Set(owners).size,issues:0,loan_source_rows:loans.length,request_source_rows:0,ignored_blank_loan_rows:0,ignored_blank_request_rows:0,unaddressable_owner_rows:0,unaddressable_owner_groups:0};
  const fingerprints={loans:hash(JSON.stringify(loans)),requests:hash('[]'),issues:hash('[]'),content:hash(JSON.stringify({loans,requests,issues}))};
  return {ok:true,action:'read_history_snapshot',contract_version:'HISTORY_SNAPSHOT_READ_V1',workbook_id:'1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80',loan_sheet_id:1245291756,request_sheet_id:10616270,observed_at:now,loans,requests,issues,counts,fingerprints};
 }
 const input=await envelope(['0007','7']),groups=await groupHistorySnapshot(input);
 let reads=0,failStage=false;calls=[];
 const worker={rpc:async(name,args)=>{calls.push({name,args});if(failStage&&name==='stage_loan_history_sync')return {error:{code:'P0001'}};return {data:name==='claim_loan_history_sync'?{claimed:true,lease_token:lease,manifest:[]}:{published:true}};}};
 const claim=await claimSync(worker,run);assert.equal(claim.lease_token,lease);
 calls=[];const noOp=await runClaimedSync(worker,run,{claimed:false},()=>'',async()=>{reads++;return input;});assert.equal(noOp.coalesced,true);assert.equal(reads,0);assert.equal(calls.length,0);
 const known=groups.find(x=>x.folio==='0007');
 const result=await runClaimedSync(worker,run,{...claim,manifest:[{folio:known.folio,content_hash:known.content_hash}]},()=>'',async()=>{reads++;return input;});
 assert.equal(result.published,true);assert.equal(reads,1);
 assert.equal(calls.filter(x=>x.name==='stage_loan_history_sync').length,1);
 assert.deepEqual(calls.find(x=>x.name==='stage_loan_history_sync').args.p_groups.map(x=>x.folio),['7']);
 const pub=calls.find(x=>x.name==='publish_loan_history_sync');assert.equal(pub.args.p_manifest.length,2);assert.equal(pub.args.p_source_metadata.group_count,2);assert.equal(pub.args.p_source_metadata.source_fingerprint,input.fingerprints.content);
 calls=[];failStage=true;
 assert.equal((await runClaimedSync(worker,run,claim,()=>'',async()=>input)).published,false);
 assert.equal(calls.some(x=>x.name==='publish_loan_history_sync'),false);assert.equal(calls.at(-1).name,'fail_loan_history_sync');
 failStage=false;calls=[];
 const bad=structuredClone(input);bad.loans.pop();assert.equal((await runClaimedSync(worker,run,claim,()=>'',async()=>bad)).published,false);assert.equal(calls.length,1);assert.equal(calls[0].name,'fail_loan_history_sync');
 calls=[];const bulk=await envelope(Array.from({length:205},(_,i)=>String(i+1)));
 assert.equal((await runClaimedSync(worker,run,claim,()=>'',async()=>bulk)).published,true);
 assert.deepEqual(calls.filter(x=>x.name==='stage_loan_history_sync').map(x=>x.args.p_groups.length),[100,100,5]);
 calls=[];const large=await envelope(Array.from({length:2500},()=> '0007'));
 assert.equal((await runClaimedSync(worker,run,claim,()=>'',async()=>large)).published,true);
 const staged=calls.find(x=>x.name==='stage_loan_history_sync').args.p_groups;
 assert.equal(staged.length,1);assert.equal(JSON.parse(staged[0].source_text).loans.length,2500);assert(Buffer.byteLength(JSON.stringify(staged))>524288,'large singleton preserved intact');
 console.log('PASS worker secret/shape, coalescing, unchanged bodies skipped, complete manifest, failure before publish, bounded batches');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
