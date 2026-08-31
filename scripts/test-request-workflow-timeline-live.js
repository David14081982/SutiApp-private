'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function json(url,options){const response=await fetch(url,options),data=await response.json().catch(()=>null);return{ok:response.ok,status:response.status,data};}
const publicKey=(values)=>values.SUPABASE_PUBLISHABLE_KEY||values.SUPABASE_ANON_KEY;
async function login(values,alias){const result=await json(values.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:publicKey(values),'Content-Type':'application/json'},body:JSON.stringify({email:values[alias+'_EMAIL'],password:values[alias+'_PASSWORD']})});assert(result.ok,alias+'_AUTH_'+result.status);return result.data.access_token;}
async function rest(values,token,path,options={}){return json(values.SUPABASE_URL+'/rest/v1/'+path,Object.assign({},options,{headers:Object.assign({apikey:publicKey(values),Authorization:'Bearer '+token,'Content-Type':'application/json'},options.headers||{})}));}
async function management(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],result=await json(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-Request-Workflow-Live/1.0'},body:JSON.stringify({query})});assert(result.ok,'MANAGEMENT_'+result.status+':'+(result.data&&result.data.message||''));return result.data;}

async function main(){
  const values=env(),aliases=['H005_TEST','H005_TEST2','H005_TEST3'],tokens={};
  for(const alias of aliases)tokens[alias]=await login(values,alias);
  const anon=await json(values.SUPABASE_URL+'/rest/v1/rpc/get_self_request_workflow_state',{method:'POST',headers:{apikey:publicKey(values),'Content-Type':'application/json'},body:JSON.stringify({p_request_id:'00000000-0000-0000-0000-000000000000'})});
  assert([401,403].includes(anon.status),'anonymous workflow RPC was not denied');
  const adminFlows=await rest(values,tokens.H005_TEST,'operational_workflows?select=id,version,enabled&order=sort_order');assert(adminFlows.ok&&adminFlows.data.length===4,'admin workflow read failed');
  const adminTracking=await rest(values,tokens.H005_TEST,'rpc/list_admin_request_workflow_tracking',{method:'POST',body:'{}'});assert(adminTracking.ok&&adminTracking.data.length===6,'admin tracking projection failed');
  for(const alias of ['H005_TEST2','H005_TEST3']){
    const direct=await rest(values,tokens[alias],'operational_workflows?select=id');assert(direct.ok&&Array.isArray(direct.data)&&direct.data.length===0,alias+'_WORKFLOW_RLS');
    const history=await rest(values,tokens[alias],'rpc/list_self_program_request_history',{method:'POST',body:'{}'});assert(history.ok&&Array.isArray(history.data),alias+'_HISTORY');for(const row of history.data){assert(row.workflow_state&&row.workflow_state.available===true,alias+'_WORKFLOW_STATE');assert(Array.isArray(row.workflow_state.stages)&&row.workflow_state.stages.length>=3,alias+'_STAGES');}
  }
  const controlled=[values.H005_TEST_AFFILIATE_ID,values.H005_TEST2_AFFILIATE_ID,values.H005_TEST3_AFFILIATE_ID].map((id)=>`'${id}'::uuid`).join(',');
  const proof=await management(values,`
    select jsonb_build_object(
      'workflows',(select count(*) from public.operational_workflows),
      'stages',(select count(*) from public.operational_workflow_stages),
      'requests',(select count(*) from public.program_requests),
      'snapshots',(select count(*) from public.program_requests where workflow_snapshot is not null and workflow_version is not null),
      'tracking',(select count(*) from public.operational_request_tracking),
      'outside_controlled',(select count(*) from public.program_requests where affiliate_id not in(${controlled})),
      'documents',(select count(*) from public.request_documents),
      'loan_live_version',(select version from public.operational_workflows where id='10000000-0000-4000-8000-000000000001'),
      'loan_snapshot_version_max',(select max(workflow_version) from public.program_requests where workflow_id='10000000-0000-4000-8000-000000000001'),
      'browser_ui_audit_rows',(select count(*) from public.operational_workflow_change_audit where actor_real_auth_user_id is not null and target_id='20000000-0000-4000-8000-000000000002' and (coalesce(before_data->>'description','') like 'H-WORKFLOW-E2E-%' or coalesce(after_data->>'description','') like 'H-WORKFLOW-E2E-%')),
      'unrestored_markers',(select count(*) from public.operational_workflow_stages where description like 'H-WORKFLOW-E2E-%')
    ) proof;
  `);
  const p=proof[0].proof;assert.equal(Number(p.workflows),4);assert.equal(Number(p.stages),20);assert.equal(Number(p.requests),6);assert.equal(Number(p.snapshots),6);assert.equal(Number(p.tracking),6);assert.equal(Number(p.outside_controlled),0);assert.equal(Number(p.documents),8);assert(Number(p.loan_live_version)>Number(p.loan_snapshot_version_max),'old snapshots were rewritten');assert(Number(p.browser_ui_audit_rows)>=2,'browser Admin edit/restore audit missing '+JSON.stringify(p));assert.equal(Number(p.unrestored_markers),0);
  await management(values,`begin;do $test$ begin
    begin
      update public.program_requests set workflow_snapshot=workflow_snapshot||jsonb_build_object('tampered',true) where id=(select id from public.program_requests limit 1);
      raise exception 'IMMUTABILITY_NOT_ENFORCED';
    exception when sqlstate '42501' then if sqlerrm<>'REQUEST_WORKFLOW_SNAPSHOT_IMMUTABLE' then raise; end if; end;
  end $test$;rollback;`);
  console.log(JSON.stringify({status:'PASS',workflows:4,stages:20,requests:6,snapshots:6,tracking:6,outsideControlled:0,requestDocumentsUnchanged:8,anonymousDenied:true,regularWorkflowRls:true,adminProjection:true,browserAdminAudit:true,immutableSnapshots:true,oldRequestsPreserved:true,piiPrinted:false,googleReads:0,googleWrites:0}));
}

main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
