'use strict';
// Owner-authorized equal-revision transport retry of an existing request. No approval/new request.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const env={},dir='C:/tmp/sutiapp-reference-reconcile-20260908',requestId='5cd836ad-3681-40c8-8cfc-803ac1af2e34';
for(const l of fs.readFileSync('C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=l.indexOf('=');if(i>0)env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const url=env.SUPABASE_URL,api='https://api.supabase.com/v1/projects/'+new URL(url).hostname.split('.')[0];
async function json(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(55000)}),d=await r.json().catch(()=>null);if(!r.ok)throw Error('HTTP_'+r.status+'_'+(d?.error||d?.message||''));return d;}
const sql=query=>json(api+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});
const select=`select r.id,r.folio,md5(to_jsonb(r)::text) as business_hash,s.revision,s.synced_revision,s.google_row,s.phase,s.attempts,s.error_code,s.lease_until,s.leased_revision,md5(s.initial_row::text) as initial_hash from public.program_requests r join public.program_request_google_sync s on s.request_id=r.id where r.id='${requestId}'::uuid`;
async function main(){
  assert.equal(process.argv[2],'--apply-existing-retry','Explicit live retry flag required');
  const before=(await sql(select))[0];assert.equal(before.folio,'SR-2026-000121');assert.equal(before.phase,'synced');assert.equal(before.error_code,null);assert.equal(before.lease_until,null);assert.equal(before.google_row,2318);assert.equal(before.revision,before.synced_revision);
  const session=await json(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});assert(session.access_token);
  fs.writeFileSync(path.join(dir,'retry-before.json'),JSON.stringify(before));
  // Requeue transport only, retaining the current immutable payload and exact same business revision.
  const queued=await sql(`update public.program_request_google_sync set phase='pending',next_attempt_at=now(),updated_at=now() where request_id='${requestId}'::uuid and phase='synced' and lease_until is null and revision=${before.revision} and synced_revision=${before.synced_revision} and google_row=${before.google_row} returning request_id`);assert.equal(queued.length,1);
  const response=await json(url+'/functions/v1/financial-legacy',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Origin:'https://sutiapp.com'},body:JSON.stringify({action:'syncRequest',request_id:requestId})});
  fs.writeFileSync(path.join(dir,'retry-response.json'),JSON.stringify(response));
  const after=(await sql(select))[0];assert.equal(after.phase,'synced');assert.equal(after.error_code,null);assert.equal(after.lease_until,null);assert.equal(after.leased_revision,null);assert(after.attempts>before.attempts);for(const f of ['business_hash','initial_hash','revision','synced_revision','google_row'])assert.equal(after[f],before[f],f);
  const proof={status:'PASS',requestFolio:before.folio,action:'syncRequest',sameRevision:after.revision,googleRow:after.google_row,attemptsBefore:before.attempts,attemptsAfter:after.attempts,phase:after.phase,leaseReleased:true,allRequestFieldsUnchanged:true,immutableInitialRowUnchanged:true,newRequests:0,approvalActions:0};
  fs.writeFileSync(path.join(__dirname,'../docs/qa/evidence/reference-reconciliation-20260908/live-retry.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
