import {HistoryError} from '../loan-history/history.mjs';
import {readHistorySnapshotSource,groupHistorySnapshot} from '../loan-history/snapshot-source.mjs';
const fail=code=>{throw new HistoryError('HISTORY_SYNC_'+code);};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function authorizeSync(body,supplied,expected){
 // Fixed-size generated secrets; compare all bytes, never log either value.
 if(typeof supplied!=='string'||typeof expected!=='string'||expected.length<32||supplied.length!==expected.length)fail('DENIED');
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);
 if(diff)fail('DENIED');
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==2||body.action!=='SYNC'||!uuid(body.run_id))fail('REQUEST_INVALID');
 return body.run_id;
}
async function rpc(client,name,args){
 const result=await client.rpc(name,args);
 if(result.error)fail('DATABASE_UNAVAILABLE');
 return result.data;
}
export async function claimSync(client,runId){
 const claim=await rpc(client,'claim_loan_history_sync',{p_run_id:runId});
 if(!claim||typeof claim.claimed!=='boolean')fail('CLAIM_INVALID');
 if(claim.claimed&&(!uuid(claim.lease_token)||!Array.isArray(claim.manifest)))fail('CLAIM_INVALID');
 return claim;
}
export async function runClaimedSync(client,runId,claim,env,readSource=readHistorySnapshotSource){
 if(!claim.claimed)return {published:false,coalesced:true};
 const lease={p_run_id:runId,p_lease_token:claim.lease_token};
 try{
  const source=await readSource(env),groups=await groupHistorySnapshot(source);
  const prior=new Map(claim.manifest.map(row=>[row.folio,row.content_hash]));
  const changed=groups.filter(group=>prior.get(group.folio)!==group.content_hash);
  // Target 512 KiB batches and cap at 100 groups. A single larger owner group
  // remains whole (database validates its 16 MiB source limit); never truncate
  // installments to fit a batch. Unchanged bodies do not traverse PostgREST.
  let chunk=[],bytes=0;
  async function flush(){if(chunk.length){await rpc(client,'stage_loan_history_sync',{...lease,p_groups:chunk});chunk=[];bytes=0;}}
  for(const group of changed){
   if(new TextEncoder().encode(group.source_text).length>16777216)fail('GROUP_TOO_LARGE');
   const size=new TextEncoder().encode(JSON.stringify(group)).length;
   if(chunk.length&&(bytes+size>524288||chunk.length>=100))await flush();
   chunk.push(group);bytes+=size;
  }
  await flush();
  const manifest=groups.map(({folio,content_hash})=>({folio,content_hash}));
  const {folios,...counts}=source.counts;
  const published=await rpc(client,'publish_loan_history_sync',{...lease,p_manifest:manifest,p_source_updated_at:source.observed_at,
   p_source_metadata:{...counts,group_count:folios,source_fingerprint:source.fingerprints.content}});
  return {published:true,result:published};
 }catch(error){
  const code=error instanceof HistoryError&&/^HISTORY_[A-Z_]+$/.test(error.message)?error.message:'HISTORY_SYNC_UNAVAILABLE';
  try{await rpc(client,'fail_loan_history_sync',{...lease,p_error_code:code});}catch(_){/* Lease expiry exposes an interrupted run; no partial publication. */}
  return {published:false,error:code};
 }
}
