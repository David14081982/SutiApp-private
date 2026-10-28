'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{stripTypeScriptTypes}=require('module');
const root=path.resolve(__dirname,'..');
async function main(){
 const source=fs.readFileSync(path.join(root,'supabase/functions/financial-legacy/index.ts'),'utf8');
 let handler,state='HISTORICAL_LOAN_MAPPING_REQUIRED',calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},rpc:async(name)=>{calls.push(name);if(name==='get_self_loan_historical_review')return state==='unavailable'?{error:{message:'offline'}}:{data:{status:state}};throw Error('UNEXPECTED_DOWNSTREAM_'+name);}};
 const sandbox={Deno:{serve:f=>{handler=f;},env:{get:()=>''}},createClient:()=>client,Response,Request,URL,TextEncoder,crypto:require('crypto').webcrypto,console};
 vm.createContext(sandbox);new vm.Script(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,''))).runInContext(sandbox);
 const request=action=>new Request('https://local.invalid/functions/v1/financial-legacy',{method:'POST',headers:{authorization:'Bearer isolated', 'content-type':'application/json'},body:JSON.stringify({action,...(action==='loanSessionValidate'?{snapshot_id:'00000000-0000-4000-8000-000000000001'}:{})})});
 for(const action of ['loanSessionOpen','loanSessionValidate','overview','resolveEligibility','resolveAvailableFunds']){calls=[];const r=await handler(request(action));assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:'HISTORICAL_LOAN_MAPPING_REQUIRED',status:'PENDING_REVIEW'});assert.deepEqual(calls,['get_self_loan_historical_review']);}
 state='unavailable';const unavailable=await handler(request('loanSessionOpen'));assert.equal(unavailable.status,503);
 const folder=path.join(root,'docs/qa/evidence/loan-manual-review');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'edge.json'),JSON.stringify({status:'PASS',controlledPending:true,missingControlGuardBeforeProfile:true,oldSessionGuard:true,reviewAuthorityFailureClosed:true,networkCalls:0},null,2)+'\n');
 console.log('PASS controlled pending before profile/control, session renewal and fail closed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
