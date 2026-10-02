'use strict';
// Adapter isolation tests: no network, identities, financial fixtures or production writes.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..');
async function main(){
 let user='reader-a',calls=[],respond,implementation=async()=>({data:{rows:[]}});
 const window={AffiliateAuth:{getState:()=>({session:{user:{id:user}},affiliate:{id:'context-'+user}})},AdminRepository:{getState:()=>({assignment:{permissions:['savings.read']}})},SutiSupabase:{getClient:()=>({rpc:(name,args)=>{calls.push({name,args});const request={then:(yes,no)=>implementation(name,args).then(yes,no),abortSignal:signal=>{request.signal=signal;return request;}};return request;},functions:{invoke:async()=>({data:{data:{ok:true}}})}})}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'app/savings-panel-repository.js'),'utf8'),{window,Map,JSON,Error});
 const repo=window.SavingsPanelRepository;
 implementation=()=>new Promise(resolve=>{respond=resolve;});
 const first=repo.people({search:'00123',filter:'ahorrando',offset:20}),second=repo.people({search:'00123',filter:'ahorrando',offset:20});
 assert.equal(first,second,'same in-flight read must be shared');await Promise.resolve();
 assert.equal(calls.length,1);assert.equal(calls[0].name,'get_admin_savings_workspace_people');assert.equal(calls[0].args.p_search,'00123');assert.equal(calls[0].args.p_offset,20);
 respond({data:{rows:[],total:0}});await first;
 implementation=async()=>({error:{message:'SOURCE_UNAVAILABLE'}});
 await assert.rejects(repo.people({search:'00123',filter:'ahorrando',offset:20}),e=>e.message==='SOURCE_UNAVAILABLE');
 assert.equal(calls.length,2,'finished response must not become a fallback cache');
 implementation=()=>new Promise(resolve=>{respond=resolve;});const old=repo.person({participantId:'one'});await Promise.resolve();user='reader-b';respond({data:{secret:'old-context'}});await assert.rejects(old,/CONTEXT_CHANGED/);
 const during=repo.summary();await Promise.resolve();repo.invalidate();respond({data:{total:10}});await assert.rejects(during,/DATA_CHANGED/);
 implementation=async()=>({error:{message:'UNKNOWN_COMMIT_RESULT'}});const prior=repo.revision();
 await assert.rejects(repo.receipt({id:'one',date:'2026-09-30',actual:1,version:1,key:'synthetic'}),e=>e.message==='UNKNOWN_COMMIT_RESULT');
 assert(repo.revision()>prior,'an ambiguous mutation must invalidate reads');
 implementation=async()=>({data:{history:[],history_total:0}});await repo.person({participantId:'two',historyOffset:10,historyLimit:10});
 assert.equal(calls.at(-1).args.p_history_offset,10);assert.equal(calls.at(-1).args.p_participant_id,'two');
 const beforeSettlement=repo.revision();await repo.operation({command:{kind:'SETTLE',request_id:'synthetic'},key:'synthetic'});assert(repo.revision()>beforeSettlement);
 console.log(JSON.stringify({status:'PASS',checks:['in-flight deduplication','exact identity and pagination parameters','no error fallback','context isolation','mutation invalidation','ambiguous-result invalidation','settlement invalidation'],networkCalls:0,productionWrites:0}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
