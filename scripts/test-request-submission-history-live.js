'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
function env(){const out={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).map((value)=>value.trim())){const at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function json(url,options){const response=await fetch(url,options);const data=await response.json().catch(()=>null);return{status:response.status,ok:response.ok,data};}
const publicKey=(v)=>v.SUPABASE_PUBLISHABLE_KEY||v.SUPABASE_ANON_KEY;
async function login(v,alias){const result=await json(v.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:publicKey(v),'Content-Type':'application/json'},body:JSON.stringify({email:v[alias+'_EMAIL'],password:v[alias+'_PASSWORD']})});assert(result.ok,alias+'_AUTH_'+result.status);return result.data.access_token;}
async function rpc(v,token,body={}){return json(v.SUPABASE_URL+'/rest/v1/rpc/list_self_program_request_history',{method:'POST',headers:{apikey:publicKey(v),Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});}
async function direct(v,token,query){return json(v.SUPABASE_URL+'/rest/v1/program_requests?select=id,folio&'+query,{headers:{apikey:publicKey(v),Authorization:'Bearer '+token}});}
async function management(v,query){const ref=new URL(v.SUPABASE_URL).hostname.split('.')[0];const result=await json(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+v.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-Request-History-Live/1.0'},body:JSON.stringify({query})});assert(result.ok,'MANAGEMENT_'+result.status);return result.data;}
const uuid=(value)=>{assert(/^[0-9a-f-]{36}$/i.test(String(value)),'controlled UUID missing');return String(value);};
async function main(){
  const v=env(),aliases=['H005_TEST','H005_TEST2','H005_TEST3'];
  const anon=await json(v.SUPABASE_URL+'/rest/v1/rpc/list_self_program_request_history',{method:'POST',headers:{apikey:publicKey(v),'Content-Type':'application/json'},body:'{}'});
  assert([401,403].includes(anon.status),'anonymous history was not denied');
  const tokens={},rows={};
  for(const alias of aliases){tokens[alias]=await login(v,alias);const result=await rpc(v,tokens[alias]);assert(result.ok,alias+'_HISTORY_'+result.status);assert(Array.isArray(result.data));rows[alias]=result.data;for(const row of result.data){for(const forbidden of ['affiliate_id','numero_control','actor_real_auth_user_id','signature_data','terms_accepted','financial_submission_snapshot','applicant_profile_snapshot','idempotency_key'])assert(!Object.prototype.hasOwnProperty.call(row,forbidden),alias+'_EXPOSED_'+forbidden);}}
  assert(rows.H005_TEST.length>=1,'controlled admin self history missing');
  const otherId=rows.H005_TEST[0].id;
  const cross=await direct(v,tokens.H005_TEST3,'id=eq.'+encodeURIComponent(otherId));
  assert(cross.ok&&Array.isArray(cross.data)&&cross.data.length===0,'cross-affiliate table read');
  const selector=await rpc(v,tokens.H005_TEST3,{p_affiliate_id:uuid(v.H005_TEST_AFFILIATE_ID)});
  assert(!selector.ok,'client affiliate selector unexpectedly accepted');
  const adminId=uuid(v.H005_TEST_AFFILIATE_ID),targetId=uuid(v.H005_TEST3_AFFILIATE_ID);
  await management(v,`begin;
do $test$
declare v_actor uuid;v_self integer;v_target integer;v_expected integer;
begin
  select auth_user_id into v_actor from public.affiliates where id='${adminId}'::uuid;
  if v_actor is null or not exists(select 1 from public.admin_assignments where auth_user_id=v_actor and enabled) then raise exception 'CONTROLLED_ADMIN_REQUIRED'; end if;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  select count(*) into v_self from public.list_self_program_request_history();
  if v_self<1 then raise exception 'ADMIN_SELF_HISTORY_MISSING'; end if;
  update public.impersonation_sessions set ended_at=now(),ended_by_auth_user_id=v_actor where actor_real_auth_user_id=v_actor and ended_at is null;
  perform public.start_affiliate_impersonation('${targetId}'::uuid,'H-REQUEST E2E reversible test');
  select count(*) into v_target from public.list_self_program_request_history();
  select count(*) into v_expected from public.program_requests where affiliate_id='${targetId}'::uuid;
  if v_target<>v_expected then raise exception 'IMPERSONATED_HISTORY_MISMATCH'; end if;
end $test$;
rollback;`);
  console.log(JSON.stringify({status:'PASS',anonymousDenied:true,crossAffiliateDenied:true,clientSelectorDenied:true,adminSelf:true,impersonationTransactional:true,controlledHistoryCounts:Object.fromEntries(aliases.map((alias)=>[alias,rows[alias].length])),piiPrinted:false,googleWrites:0}));
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
