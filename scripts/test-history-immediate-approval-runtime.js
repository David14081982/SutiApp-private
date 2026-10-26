'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){
 const {category,projectApprovals,projectHistory}=await import('../supabase/functions/loan-history/history.mjs');
 const {loadPublishedHistory}=await import('../supabase/functions/loan-history/snapshot.mjs');
 const at='2026-10-26T21:21:24.650Z',last='2026-10-27T21:21:24.649Z',end='2026-10-27T21:21:24.650Z';
 for(const state of ['',null,'AL CORRIENTE','SALDO ATRASADO','UNKNOWN']){
  assert.equal(category(state,at,at),'Aprobadas');assert.equal(category(state,at,last),'Aprobadas');
  assert.equal(category(state,at,end),['AL CORRIENTE','SALDO ATRASADO'].includes(state)?'En pago':'Estado por revisar');
 }
 for(const state of ['LIQUIDADO','PAGÓ DE MÁS'])for(const now of [at,last,end])assert.equal(category(state,at,now),'Liquidadas');
 assert.equal(category('',null,last),'Estado por revisar');assert.equal(category('',end,last),'Estado por revisar');
 const r={id:'native-a',folio:'SR-2026-000001',status:'approved',financial:true,approved_at:at,created_at:'2026-10-26T20:00:00Z',approval_display:{fund:'Fund A',principal:500.13,total:600.79,term:12,secret:'never-transfer'}};
 const context={actor:'actor-a',affiliate_id:'affiliate-a',folio:'0007',server_now:last,requests:[r],approval_revision:'revision-a'};
 const input=JSON.stringify(context),approvals=projectApprovals(context);assert.equal(approvals.length,1);assert.equal(approvals[0].principal,500.13);assert.equal(approvals[0].total,600.79);assert.equal(approvals[0].expires_at,end);assert.equal(JSON.stringify(context),input);
 const serialized=JSON.stringify(approvals);for(const forbidden of ['actor-a','affiliate-a','0007','secret','never-transfer','schedule'])assert(!serialized.includes(forbidden));
 for(const patch of [{financial:false},{status:'rejected'},{approved_at:null},{approved_at:'2026-10-28T00:00:00Z'},{approval_display:null}])assert.equal(projectApprovals({...context,requests:[{...r,...patch}]}).length,0);
 assert.throws(()=>projectApprovals({...context,requests:[r,r]}),/REQUEST_IDENTITY_AMBIGUOUS/);
 const malformed=projectApprovals({...context,requests:[{...r,approval_display:{fund:'A',principal:'500',total:-1,term:null}}]})[0];assert.equal(malformed.principal,null);assert.equal(malformed.total,null);assert.equal(malformed.term,null);
 let calls=0;const client={rpc:async(name,args)=>{calls++;assert.equal(name,'get_self_loan_history_approvals');assert.equal(args,undefined);return {data:context};}};
 const update=await loadPublishedHistory({action:'APPROVALS'},client);assert.equal(calls,1);assert.deepEqual(update,{version:1,server_now:last,approval_revision:'revision-a',approvals});
 for(const extra of [{folio:'7'},{affiliate_id:'foreign'},{key:'loan:10'},{source:{loans:[]}}])await assert.rejects(loadPublishedHistory({action:'APPROVALS',...extra},client),/REQUEST_INVALID/);assert.equal(calls,1);
 for(const [error,code] of [[{code:'42501'},'IDENTITY_DENIED'],[{code:'PGRST301'},'AUTH_REQUIRED']])await assert.rejects(loadPublishedHistory({action:'APPROVALS'},{rpc:async()=>({error})}),new RegExp(code));
 const source={folio:'0007',issues:[],requests:[{id:'10',owner:'0007',status:'Iniciado',receipt:{id:10,identity:r.folio,sourceHash:'a'.repeat(64)}}],loans:[{source_row:2,id:'10',owner:'0007',date:'2026-10-15',amount:50,scheduled:50,number:1,fund:'Published fund',term:1,principal:400,total:450,status:'',paid_to_date:50,expected_to_date:50}]};
 const baseline=JSON.stringify(source),before=projectHistory(source,context,last).entries[0],after=projectHistory(source,{...context,server_now:end},end).entries[0];assert.equal(before.category,'Aprobadas');assert.equal(after.category,'Estado por revisar');assert.deepEqual(before.schedule,after.schedule);for(const field of ['principal','total','paid_to_date','expected_to_date','term','status','fund'])assert.deepEqual(before[field],after[field]);assert.equal(JSON.stringify(source),baseline);
 const loaded=await loadPublishedHistory({action:'LOAD'},{rpc:async(name)=>{assert.equal(name,'get_self_loan_history_snapshot');return {data:{context,source,source_updated_at:'2026-10-26T17:23:00Z',sync_version:'publication-a',sync_state:{status:'READY'}}};}});assert.deepEqual(loaded.approvals,approvals);assert.deepEqual(loaded.entries[0],before);
 const result={status:'PASS',exact24h:true,blankAndUnknownExpiry:true,settledPrecedence:true,noAmountsOrQuotasChanged:true,noOwnerSelectors:true,lightweightOwnRpc:true,noScheduleInApprovalPayload:true,immutableApprovalAllowlist:true,noGoogleReads:true};
 const dir=process.env.SUTI_HISTORY_EVIDENCE_DIR||path.resolve('.tmp/history-immediate-approval');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'runtime.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
