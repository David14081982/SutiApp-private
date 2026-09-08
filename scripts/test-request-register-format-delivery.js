'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const {deliverRequestRegister,buildRequestRegisterRow}=require('../supabase/functions/financial-legacy/request-google-sync.js');
const {sha}=require('./test-requests-workflow-google-sync-bridge');
async function main(){
  const request={id:'11111111-1111-4111-8111-111111111111',folio:'SR-2026-000121',affiliate_id:'22222222-2222-4222-8222-222222222222',numero_control:'00123',program_id:'membership',request_type:'benefit',created_at:'2026-09-07T04:35:41.511697+00:00',status:'approved'};
  const initial=buildRequestRegisterRow(request,[],null),job={request_id:request.id,initial_row:initial,revision:3,request_status:'approved',desired_status:'APROBADO'};
  let sent,finished,selection,network=0;
  const client={rpc:async(name,args)=>{if(name==='claim_program_request_google_sync')return {data:job};assert.equal(name,'finish_program_request_google_sync');finished=args;return {data:{phase:'synced'}};},from:table=>({select:columns=>{if(table==='program_requests')selection=columns;return {eq:()=>table==='program_requests'?{single:async()=>({data:request})}:Promise.resolve({data:[]})};}})};
  const originalFetch=global.fetch;
  global.fetch=async(url,options)=>{network++;if(String(url).includes('oauth2'))return {ok:true,json:async()=>({access_token:'isolated-token'})};sent=JSON.parse(options.body);return {ok:true,text:async()=>JSON.stringify({ok:true,action:'sync_request',program_request_id:request.id,google_row:2,revision:3,desired_status:'APROBADO'})};};
  try{
    const result=await deliverRequestRegister(client,request.id,name=>name==='FINANCIAL_LEGACY_API_URL'?'https://isolated.invalid':'isolated-secret',sha);
    assert.equal(result.phase,'synced');assert(selection.split(',').includes('folio'));assert.equal(sent.request_folio,request.folio);assert.equal(sent.contract_version,'REQUEST_REGISTER_V2');
    assert.deepEqual(sent.row,initial);assert.equal(sent.row[0],request.id);assert.equal(sent.row[9],request.created_at);assert.equal(sent.payload_sha256,sha(initial));assert.equal(sent.desired_status,'APROBADO');assert.deepEqual(finished.p_initial_row,initial);assert.equal(finished.p_error_code,null);
    const before=network;request.folio='';await deliverRequestRegister(client,request.id,()=>'',sha);assert.equal(network,before);assert.equal(finished.p_error_code,'REQUEST_SYNC_FOLIO_INVALID');assert.deepEqual(finished.p_initial_row,initial);
  }finally{global.fetch=originalFetch;}
  const proof={status:'PASS',tests:['canonical folio selected and V2 envelope sent','immutable UUID/ISO/hash/initial_row preserved through finish RPC','internal APROBADO unchanged','missing folio fails visibly without delivery'],externalWrites:0};
  fs.writeFileSync(path.resolve(__dirname,'../docs/qa/evidence/register-format-20260908/delivery-tests.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
