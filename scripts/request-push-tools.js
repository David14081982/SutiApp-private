'use strict';
// Private CLI tooling; never included in the public Pages artifact.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/request-push-20260908');
const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const n=line.indexOf('=');if(n>0&&!line.startsWith('#'))env[line.slice(0,n).trim()]=line.slice(n+1).trim().replace(/^['"]|['"]$/g,'');}
const api='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0];
async function management(route,init={}){const r=await fetch(api+route,{...init,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...init.headers}});const text=await r.text();if(!r.ok){fs.mkdirSync('C:/tmp/sutiapp-request-push-private',{recursive:true});fs.writeFileSync('C:/tmp/sutiapp-request-push-private/last-error.txt',text);throw Error('MANAGEMENT_'+r.status+' (private diagnostic saved)');}return text?JSON.parse(text):null;}
const sql=query=>management('/database/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
const quote=s=>"'"+s.replace(/'/g,"''")+"'",sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const body=s=>s.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
function proof(name,data){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2));console.log(JSON.stringify(data));}
const business="select count(*) requests,md5(string_agg(to_jsonb(r)::text,',' order by r.id)) request_hash,(select md5(string_agg(to_jsonb(e)::text,',' order by e.id)) from public.program_request_admin_events e) event_hash,(select md5(string_agg(to_jsonb(t)::text,',' order by t.request_id)) from public.operational_request_tracking t) tracking_hash from public.program_requests r";
module.exports={root,out,env,management,sql,quote,sha,body,proof,business};
