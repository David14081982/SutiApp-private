'use strict';
// Strip TypeScript locally and exercise the actual Edge orchestration offline.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{pathToFileURL}=require('url'),{stripTypeScriptTypes}=require('module');
const repository=path.resolve(__dirname,'..'),candidate=path.join(repository,'.tmp/loan-available-credit/release');
const root=path.resolve(process.env.SUTI_CAPACITY_ROOT||(fs.existsSync(candidate)?candidate:repository));
async function main(){
 const capacity=await import(pathToFileURL(path.join(root,'supabase/functions/financial-legacy/loan-capacity.mjs')));
 const source=fs.readFileSync(path.join(root,'supabase/functions/financial-legacy/index.ts'),'utf8');
 const compiled=stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,''));
 let served=false;const sandbox={...capacity,Deno:{env:{get:()=>''},serve:()=>{served=true;}},console,crypto:require('crypto').webcrypto,TextEncoder,Intl,Date,URL,Response,Request,AbortSignal,Set,Map,JSON};
 vm.createContext(sandbox);new vm.Script(compiled).runInContext(sandbox);assert(served);
 const checks=['financial Edge TypeScript transpiles/parses locally; focal handlers run with isolated dependencies (not a Deno typecheck or cloud bundle)'],now=new Date().toISOString();
 const context={actorId:'actor',affiliateId:'affiliate',impersonationSessionId:null,profile:{affiliate_id:'affiliate',numero_control:'0007',financial_union:'Union',financial_employee_category:'Base',financial_profile_version:1}};
 const rule={id:'caja--caja-chica--r1',rule_id:'rule',program_id:'caja',fund:'Caja Chica',status:'AVAILABLE'};
 const runtime={funds:[{id:'fund',name:'Caja Chica'}],rules:[{id:'rule',fund_id:'fund',criterion_identity:'criterion'}],requests:[]};
 const pub={context:{actor:'actor',affiliate_id:'affiliate',folio:'0007'},sync_version:'version',source_updated_at:'2026-10-01T22:00:00Z',source:{issues:[],loans:[],requests:[]}};
 let changed=false,readCount=0,passedSource;
 const user={rpc:async name=>{
  if(name==='get_self_loan_history_snapshot'){readCount++;return {data:structuredClone(pub)};}
  if(name==='get_current_affiliate_financial_context')return {data:changed?{...context.profile,numero_control:'0008'}:context.profile};
  if(name==='get_impersonation_context')return {data:null};throw Error('unexpected user RPC '+name);
 }};
 const service={rpc:async(name,args)=>{
  if(name==='get_loan_capacity_runtime'){assert.equal(args.p_affiliate_id,'affiliate');return {data:runtime};}
  if(name==='resolve_loan_available_capacity'){passedSource=args.p_source;return {data:{policy_version:0,global_allow_full:false,funds:[{rule_id:'rule',fund_id:'fund',max_amount:40000,available_amount:30000,pending_amount:10000,reserved_amount:0,active_loans:2,exemption:null,override_version:0}]}};}
  throw Error('unexpected service RPC '+name);
 }};
 const result=await sandbox.freshLoanCapacity(user,service,context,[rule]);
 assert.equal(readCount,1);assert.equal(result.source.source_version,'version');assert.equal(result.source.source_updated_at,pub.source_updated_at);
 assert.equal(passedSource.numero_control,'0007');assert(Date.parse(passedSource.observed_at)>=Date.parse(now));
 checks.push('one existing own published snapshot; original source version/time retained; no Google read');
 for(const field of ['actor','affiliate_id','folio']){
  const old=pub.context[field];pub.context[field]='other';await assert.rejects(sandbox.freshLoanCapacity(user,service,context,[rule]),/UNAVAILABLE/);pub.context[field]=old;
 }
 changed=true;await assert.rejects(sandbox.freshLoanCapacity(user,service,context,[rule]),/CONTEXT_DENIED/);changed=false;
 pub.source.issues.push('INVALID_RECEIPT');await assert.rejects(sandbox.freshLoanCapacity(user,service,context,[rule]),/UNAVAILABLE/);pub.source.issues=[];
 await assert.rejects(sandbox.freshLoanCapacity({...user,rpc:async name=>name==='get_self_loan_history_snapshot'?{error:{message:'unavailable'}}:user.rpc(name)},service,context,[rule]),/UNAVAILABLE/);
 checks.push('wrong actor/affiliate/control, changed context, malformed source and unavailable publication fail closed');
 assert.equal(sandbox.assertLoanCapacity(result.resolved,[rule],{program_id:rule.id,amount:30000},{fund:rule.fund}).available_amount,30000);
 assert.throws(()=>sandbox.assertLoanCapacity(result.resolved,[rule],{program_id:rule.id,amount:30000.01},{fund:rule.fund}),/EXCEEDED/);
 assert.throws(()=>sandbox.assertLoanCapacity(result.resolved,[rule],{program_id:'another',amount:1},{fund:rule.fund}),/NOT_ELIGIBLE/);
 checks.push('Edge quote/confirmation check exact selected rule and reject one cent above available');
 const ordered={policy_version:0,global_allow_full:false,funds:[{rule_id:'b',available_amount:10},{rule_id:'a',available_amount:20}]};
 assert.equal(sandbox.capacitySignature(ordered),sandbox.capacitySignature({...ordered,funds:ordered.funds.slice().reverse()}));
 assert.notEqual(sandbox.capacitySignature(ordered),sandbox.capacitySignature({...ordered,policy_version:1}));
 assert.notEqual(sandbox.capacitySignature(ordered),sandbox.capacitySignature({...ordered,funds:[{rule_id:'a',available_amount:19},{rule_id:'b',available_amount:10}]}));
 checks.push('session signature invalidates policy and reservation changes without order noise');
 const dir=path.join(root,'docs/qa/evidence/loan-available-credit');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'edge-local.json'),JSON.stringify({status:'PASS',checks,networkCalls:0,productionWrites:0},null,2)+'\n');
 checks.forEach(check=>console.log('PASS '+check));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
