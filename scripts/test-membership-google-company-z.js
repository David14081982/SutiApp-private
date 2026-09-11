'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/membership-google-company-z-20260910');
const {buildRequestRegisterRow,deliverRequestRegister}=require('../supabase/functions/financial-legacy/request-google-sync.js');
const {fixture,payload,sha}=require('./test-requests-workflow-google-sync-bridge');
const baseline=require('child_process').execFileSync('git',['show','9f880bf0fcea96ecfc57cd1f80ef43cbd254cc8a:supabase/functions/financial-legacy/request-google-sync.js'],{cwd:root,encoding:'utf8'});
const original={};vm.createContext(original);vm.runInContext(baseline.replace(/^export /gm,''),original);
const companies=['Bud Tv Ultra','RiveraGas','Sams Club','Costco','Casa Ley','Arco gasolinera'];
const request={id:'11111111-1111-4111-8111-111111111111',folio:'SR-2026-000001',program_id:'membership',numero_control:'QA-Z',created_at:'2026-09-10T12:00:00Z',notes:'Nota previa',terms_accepted:true,
 financial_submission_snapshot:{contract_version:'MEMBERSHIP_PAYMENT_V1',offering:{company:'Bud Tv Ultra'},financialResult:{fund:'Vales y membresias',rate:0,amount:200,total:200,paymentCount:2,interest:0,capital:170,administrativeFeeTotal:30}}};
for(const company of companies){
 const r=structuredClone(request);r.financial_submission_snapshot.offering.company=company;
 const before=Array.from(original.buildRequestRegisterRow(r,[],null)),after=buildRequestRegisterRow(r,[],null);
 assert.equal(after[25],company);assert.equal(after.length,33);
 for(let i=0;i<33;i++)if(i!==25)assert.deepEqual(after[i],before[i],'COLUMN_CHANGED_'+i);
 const p=payload('membership');p.row=after.map((v,i)=>i===0?p.program_request_id:i===1?p.numero_control:i===9?p.request_created_at:v);p.payload_sha256=sha(p.row);
 const f=fixture(),first=f.send(p);assert(first.ok);const saved=f.target.rows[first.google_row-1];assert.equal(saved[25],company);
 const approved={...p,revision:2,request_status:'approved',desired_status:'APROBADO'};assert(f.send(approved).ok);assert(f.send(approved).ok);
 assert.equal(saved[25],company);assert.equal(saved[24],'Aprobado');assert.equal(f.target.getLastRow(),2);
}
for(const program of ['prestamo','puertas','marketplace']){
 const r={...request,program_id:program};assert.deepEqual(buildRequestRegisterRow(r,[],null),Array.from(original.buildRequestRegisterRow(r,[],null)));
}
for(const snapshot of [null,{financialResult:request.financial_submission_snapshot.financialResult}]){
 const r={...request,financial_submission_snapshot:snapshot};assert.deepEqual(buildRequestRegisterRow(r,[],null),Array.from(original.buildRequestRegisterRow(r,[],null)));
}
for(const company of [null,'', '   ',123]){const r=structuredClone(request);r.financial_submission_snapshot.offering.company=company;assert.throws(()=>buildRequestRegisterRow(r,[],null),/MEMBERSHIP_COMPANY_SNAPSHOT_REQUIRED/);}
// Only the accepted snapshot is consumed, even if unrelated catalog data changes.
assert.equal(buildRequestRegisterRow({...request,membership_offering:{company_raw:'Nombre posterior'}},[],null)[25],'Bud Tv Ultra');
async function delivery(initialRow){
 let sent,finished;const r=structuredClone(request),job={request_id:r.id,initial_row:initialRow,revision:2,request_status:'approved',desired_status:'APROBADO'};
 const client={rpc:async(name,args)=>{if(name==='claim_program_request_google_sync')return {data:job};finished=args;return {data:{phase:'synced'}};},from:table=>({select:()=>({eq:()=>table==='program_requests'?{single:async()=>({data:r})}:Promise.resolve({data:[]})})})};
 const savedFetch=global.fetch;
 global.fetch=async(url,options)=>String(url).includes('oauth2')?{ok:true,json:async()=>({access_token:'isolated'})}:{ok:true,text:async()=>{sent=JSON.parse(options.body);return JSON.stringify({ok:true,action:'sync_request',program_request_id:r.id,google_row:2,revision:2,desired_status:'APROBADO'});}};
 try{await deliverRequestRegister(client,r.id,k=>k==='FINANCIAL_LEGACY_API_URL'?'https://isolated.invalid':'isolated',sha);}finally{global.fetch=savedFetch;}
 assert.equal(finished.p_error_code,null);assert.deepEqual(sent.row,initialRow||buildRequestRegisterRow(r,[],null));
 assert.deepEqual(finished.p_initial_row,sent.row);assert.equal(sent.payload_sha256,sha(sent.row));return sent.row;
}
(async()=>{
 assert.equal((await delivery(null))[25],'Bud Tv Ultra');
 const old=Array.from(original.buildRequestRegisterRow(request,[],null));assert.equal((await delivery(old))[25],'Nota previa');
 const result={status:'PASS',companies,onlyColumnChanged:'Z',other32ColumnsIdentical:true,otherProgramsIdentical:true,historicalRequestsAndInitialRowsPreserved:true,catalogRenameIgnored:true,invalidSnapshotDenied:true,bridgeCreateApprovalRetry:true,deliveryInitialRowAndHashPreserved:true,externalWrites:0};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'projection-tests.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
