'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const source=fs.readFileSync('app/savings-repository.js','utf8');
function fixture(){
 let actor='actor-a',affiliate='affiliate-a',failUpload=false,changeAt='',committed=false;
 const calls=[],context=()=>({actor_auth_user_id:actor,affiliate_id:affiliate});
 const db={rpc:async(name,args)=>{calls.push({name,args});const data=context();
  if(name==='get_self_savings_beneficiaries'){if(changeAt==='read')affiliate='affiliate-b';if(changeAt==='bad-read')return {data:{...data}};if(changeAt==='foreign-read')return {data:{...data,affiliate_id:'foreign'}};return {data:{...data,beneficiaries:[],signatures:[],version_id:null}};}
  if(name==='prepare_self_savings_beneficiaries'){if(changeAt==='prepare')affiliate='affiliate-b';return {data:{...data,authorization_id:'authorization',bucket:'savings-beneficiary-signatures',path:'private/path.png',committed}};}
  if(name==='commit_self_savings_beneficiaries'){if(changeAt==='empty-commit')return {data:null};if(changeAt==='stale')return {error:new Error('SAVINGS_BENEFICIARIES_STALE')};committed=true;return {data:{...data,version_id:'version'}};}
  throw Error('Unexpected RPC');
 },storage:{from:bucket=>({upload:async(path,blob,options)=>{calls.push({upload:true,bucket,path,size:blob.size,options});if(changeAt==='upload')affiliate='affiliate-b';return changeAt==='duplicate'?{error:{statusCode:'409'}}:failUpload?{error:{message:'network'}}:{data:{path}};},
  createSignedUrl:async(path,ttl)=>{calls.push({signed:true,bucket,path,ttl});if(changeAt==='sign')affiliate='affiliate-b';return {data:{signedUrl:'https://example.invalid/authorized'}};}})}};
 const window={SutiSupabase:{getClient:()=>db},AffiliateAuth:{getState:()=>({phase:'authenticated',session:{user:{id:actor}},affiliate:{id:affiliate}}),subscribe:()=>()=>{}}};
 const sandbox={window,crypto:crypto.webcrypto,Blob,atob,Uint8Array,Set,JSON,Object,Promise,Error};vm.runInNewContext(source,sandbox);
 return {api:window.SavingsRepository,calls,setFail:v=>failUpload=v,setChange:v=>changeAt=v};
}
async function main(){
 const bytes=Buffer.alloc(200);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
 const auth={signature:'data:image/png;base64,'+bytes.toString('base64'),accepted:true,versionId:'old-version'};
 const rows=[{full_name:'Persona ficticia',relationship:null,percentage:75}];
 const f=fixture();assert.equal((await f.api.getBeneficiaries()).affiliate_id,'affiliate-a');
 f.setFail(true);await assert.rejects(f.api.replaceBeneficiaries(rows,'same-key',auth));f.setFail(false);
 await f.api.replaceBeneficiaries(rows,'same-key',auth);
 assert.equal(f.calls.filter(x=>x.name==='commit_self_savings_beneficiaries').length,1);
 const prepares=f.calls.filter(x=>x.name==='prepare_self_savings_beneficiaries');assert.equal(prepares.length,2);
 assert.deepEqual(prepares[0].args,prepares[1].args);assert.equal(prepares[0].args.p_signature_sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
 assert.equal(prepares[0].args.p_expected_affiliate_id,'affiliate-a');assert.equal(prepares[0].args.p_expected_version_id,'old-version');
 await f.api.replaceBeneficiaries(rows,'same-key',auth);assert.equal(f.calls.filter(x=>x.upload).length,2,'committed retry does not upload');
 assert(f.calls.filter(x=>x.upload).every(x=>x.options.upsert===false));
 for(const step of ['prepare','upload']){const other=fixture();other.setChange(step);await assert.rejects(other.api.replaceBeneficiaries(rows,'key',auth),/CONTEXT_CHANGED/);assert.equal(other.calls.filter(x=>x.name==='commit_self_savings_beneficiaries').length,0);}
 const signed=fixture();await signed.api.getBeneficiarySignature('private/path.png');assert.equal(signed.calls[0].ttl,300);
 signed.setChange('sign');await assert.rejects(signed.api.getBeneficiarySignature('private/path.png'),/CONTEXT_CHANGED/);
 const invalid=fixture();await assert.rejects(invalid.api.replaceBeneficiaries(rows,'key',{...auth,accepted:false}),/SIGNATURE_REQUIRED/);assert.equal(invalid.calls.length,0);
 for(const mode of ['read','foreign-read','bad-read']){const other=fixture();other.setChange(mode);await assert.rejects(other.api.getBeneficiaries(),/CONTEXT_CHANGED|RESPONSE_INVALID/);}
 for(const mode of ['empty-commit','stale']){const other=fixture();other.setChange(mode);await assert.rejects(other.api.replaceBeneficiaries(rows,'key',auth),/RESPONSE_INVALID|STALE/);}
 const duplicate=fixture();duplicate.setChange('duplicate');await duplicate.api.replaceBeneficiaries(rows,'key',auth);assert.equal(duplicate.calls.filter(x=>x.name==='commit_self_savings_beneficiaries').length,1);
 for(const signature of ['', 'data:image/png;base64,AAAA', 'data:image/jpeg;base64,'+bytes.toString('base64')]){const f=fixture();await assert.rejects(f.api.replaceBeneficiaries(rows,'key',{...auth,signature}),/SIGNATURE_REQUIRED/);assert.equal(f.calls.length,0);}
 const proof={status:'PASS',checks:['signature required','SHA256','expected owner/version','same-key retry','no overwrite','committed retry','context switch before commit','signed URL TTL/context','cross-user read response denied','malformed responses denied','stale version propagated','duplicate upload retry','invalid signatures denied'],realWrites:0};
 fs.writeFileSync('docs/qa/evidence/savings-beneficiaries-frontend-20260920/repository.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
