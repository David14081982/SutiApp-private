'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function config(){const out={SUPABASE_URL:process.env.SUTIAPP_SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUTIAPP_SUPABASE_PUBLISHABLE_KEY};const file=path.join(root,'supabase.env');if(fs.existsSync(file))for(const raw of fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#')&&!out[line.slice(0,at).trim()])out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function main(){const v=config(),key=v.SUPABASE_PUBLISHABLE_KEY||v.SUPABASE_ANON_KEY;assert(v.SUPABASE_URL&&key,'public Supabase configuration missing');
  const response=await fetch(v.SUPABASE_URL+'/rest/v1/rpc/get_request_submission_backend_contract',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}'}),data=await response.json().catch(()=>null);
  assert.equal(response.status,200,'REQUEST_BACKEND_CONTRACT_'+response.status);
  assert(data&&data.contract_version==='SUTI_REQUEST_SUBMISSION_V2','REQUEST_BACKEND_VERSION_MISMATCH');
  assert.equal(data.ready,true,'REQUEST_BACKEND_NOT_READY');
  assert.equal(data.writer,'create_validated_financial_program_request');assert.equal(data.edge_action,'loanSessionConfirm');
  assert.equal(data.deposit_contract,'BANK_AND_CARD_OR_CLABE');assert.equal(data.idempotency_scope,'affiliate_id+idempotency_key');
  for(const field of ['request_id','folio','status','confirmed_amount','correlation_id'])assert(data.response_fields.includes(field),'REQUEST_RESPONSE_FIELD_MISSING_'+field);
  console.log(JSON.stringify({status:'PASS',contractVersion:data.contract_version,backendReady:true,writer:data.writer,edgeAction:data.edge_action,depositContract:data.deposit_contract,idempotency:data.idempotency_scope,secretsUsed:false}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
