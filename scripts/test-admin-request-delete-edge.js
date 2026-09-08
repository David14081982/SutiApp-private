'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert').strict;
const babel=require('C:/tmp/babel-standalone-7.28.4.min.js');
const source=babel.transform(fs.readFileSync(path.join(__dirname,'../supabase/functions/request-delete/index.ts'),'utf8').replace(/^import .*;\s*/,''),{filename:'index.ts',plugins:['transform-typescript']}).code;
const id='00000000-0000-4000-8000-000000000001',jobId='00000000-0000-4000-8000-000000000002';
function fixture(options={}){
 const trace=[],job={id:jobId,request_id:id,folio:'SR-2026-900001',phase:options.phase||'prepared',snapshot:{request:{id,folio:'SR-2026-900001',numero_control:'QA',created_at:'2026-09-08T00:00:00Z'},sync:{initial_row:['immutable']}},google_backup:options.backup||null};
 let handler;
 const client={auth:{getUser:async()=>({data:{user:options.unauthorized?null:{id:'admin'}}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:job})})})}),rpc:async(name,args)=>{
  if(name==='prepare_admin_request_delete'){trace.push('prepare');return options.denied?{error:{code:'42501',message:'REQUEST_DELETE_DENIED'}}:{data:{...job,snapshot:undefined,google_backup:undefined}};}
  if(name==='record_request_delete_google'){trace.push('record:'+args.p_deleted);if(args.p_backup)job.google_backup=args.p_backup;return{};}
  assert.equal(name,'finish_admin_request_delete');assert(job.google_backup);trace.push('finish');return{data:{deleted:true,request_id:id}};
 }};
 const fetch=async(url,init)=>{
  if(url.includes('oauth2'))return Response.json({access_token:'isolated'});
  const p=JSON.parse(init.body);trace.push(p.mode);
  if(options.googleFailure)return Response.json({ok:false,error:'REQUEST_DELETE_GOOGLE_UNAVAILABLE'});
  if(p.mode==='apply')assert(job.google_backup,'Google clear before durable backup');
  return Response.json({ok:true,action:'delete_request',program_request_id:id,operation_id:jobId,deleted:p.mode==='apply'||options.alreadyDeleted,backup:{program_request_id:id,operation_id:jobId,fingerprint:'same'},fingerprint:options.changed?'changed':'same',recovering:false});
 };
 const env={SUPABASE_URL:'https://isolated.supabase.co',FINANCIAL_LEGACY_API_URL:'https://isolated.invalid/receiver'};
 vm.runInNewContext(source,{createClient:()=>client,Deno:{env:{get:k=>env[k]||'isolated'},serve:f=>handler=f},fetch,Response,Request,URLSearchParams,AbortSignal,TextEncoder,crypto:require('crypto').webcrypto});
 return{trace,run:()=>handler(new Request('https://isolated.invalid',{method:'POST',headers:{authorization:'Bearer isolated',origin:'https://sutiapp.com'},body:JSON.stringify({request_id:id,folio:job.folio,updated_at:'2026-09-08',reason:'Isolated test'})}))};
}
async function main(){
 const cases=[];
 for(const [name,options,status,sequence] of [
  ['ordered durable backup then Google then finalization',{},200,['prepare','inspect','record:false','apply','record:true','finish']],
  ['unauthorized identity',{unauthorized:true},401,[]],
  ['permission denied',{denied:true},403,['prepare']],
  ['Google failure retains request',{googleFailure:true},503,['prepare','inspect']],
  ['retry after lost acknowledgement',{alreadyDeleted:true,backup:{fingerprint:'same'}},200,['prepare','inspect','record:true','finish']],
  ['Google changed after original backup',{changed:true,backup:{fingerprint:'same'}},503,['prepare','inspect']],
  ['retry after confirmed Google removal',{phase:'google_deleted',backup:{fingerprint:'same'}},200,['prepare','finish']],
  ['completed retry',{phase:'completed'},200,['prepare']]
 ]){const f=fixture(options),r=await f.run();assert.equal(r.status,status,name);assert.deepEqual(f.trace,sequence,name);cases.push({name,status:'PASS'});}
 const proof={status:'PASS',cases,externalWrites:0};fs.writeFileSync(path.join(__dirname,'../docs/qa/evidence/admin-request-delete-20260908/edge-tests.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
