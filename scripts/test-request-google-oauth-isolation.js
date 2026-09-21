'use strict';
const assert=require('assert/strict'),fs=require('fs');
const {deliverRequestRegister}=require('../supabase/functions/financial-legacy/request-google-sync.js');
(async()=>{
  const oldFetch=global.fetch,reads=[],request={id:'11111111-1111-4111-8111-111111111111',folio:'SR-2026-000316',affiliate_id:'22222222-2222-4222-8222-222222222222',program_id:'membership'};
  let finished,tokenCalls=0;
  const client={rpc:async(name,args)=>name==='claim_program_request_google_sync'?{data:{request_id:request.id,initial_row:[],revision:1,request_status:'submitted',desired_status:'PENDIENTE'}}:(finished=args,{data:{phase:'error'}}),from:table=>({select:()=>({eq:()=>table==='program_requests'?{single:async()=>({data:request})}:Promise.resolve({data:[]})})})};
  const env=name=>{reads.push(name);return name.startsWith('GOOGLE_REQUEST_SYNC_OAUTH_')?'request-specific':name.startsWith('GOOGLE_VISIBILITY_OAUTH_')?'reader-must-not-be-used':'isolated';};
  global.fetch=async(url,options)=>{
    assert.equal(url,'https://oauth2.googleapis.com/token');tokenCalls++;
    for(const key of ['client_id','client_secret','refresh_token'])assert.equal(options.body.get(key),'request-specific');
    return {ok:false,json:async()=>({error:'invalid_grant'})};
  };
  try{await deliverRequestRegister(client,request.id,env,async()=> 'hash');}
  finally{global.fetch=oldFetch;}
  assert.equal(tokenCalls,1);assert.equal(finished.p_error_code,'REQUEST_SYNC_GOOGLE_AUTH_FAILED');
  assert(!reads.some(n=>n.startsWith('GOOGLE_VISIBILITY_OAUTH_')));
  const deletion=fs.readFileSync('supabase/functions/request-delete/index.ts','utf8');
  assert(!deletion.includes('GOOGLE_VISIBILITY_OAUTH_'));
  for(const key of ['CLIENT_ID','CLIENT_SECRET','REFRESH_TOKEN'])assert(deletion.includes('GOOGLE_REQUEST_SYNC_OAUTH_'+key));
  const reader=fs.readFileSync('supabase/functions/savings-settlement/loan-status.js','utf8');
  assert(!reader.includes('GOOGLE_VISIBILITY_OAUTH_'));assert(reader.includes('GOOGLE_REQUEST_SYNC_OAUTH_'));assert(reader.includes("action: 'read_loan_status'"));
  console.log(JSON.stringify({status:'PASS',checks:['receiver uses isolated credentials','OAuth failure never falls back to reader credentials','deletion uses same receiver credential namespace','Savings uses same authenticated receiver explicitly'],externalWrites:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
