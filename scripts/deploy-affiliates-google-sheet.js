'use strict';
// H-AFFILIATES-GOOGLE-SHEET-001 — deploy/inspect the `affiliates-google-sheet` Edge Function (verify_jwt=true).
// Usage: node scripts/deploy-affiliates-google-sheet.js status|deploy|verify|delete
// Needs SUPABASE_ACCESS_TOKEN (Management API) in supabase.env (SUTIAPP_ENV_FILE overrides the path). Never prints secrets.
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');

const mode=process.argv[2]||'status';
if(!['status','deploy','verify','delete'].includes(mode))throw new Error('USAGE: status|deploy|verify|delete');
const root=path.resolve(__dirname,'..');
const slug='affiliates-google-sheet';
const files=['index.ts','affiliates-sheet.mjs'];
function env(){const file=process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env');return Object.fromEntries(fs.readFileSync(file,'utf8').replace(/^﻿/,'').split(/\r?\n/).map((line)=>line.trim()).filter((line)=>line&&!line.startsWith('#')&&line.includes('=')).map((line)=>{const index=line.indexOf('=');return[line.slice(0,index).trim(),line.slice(index+1).trim().replace(/^['"]|['"]$/g,'')];}));}
const sha=(value)=>crypto.createHash('sha256').update(value).digest('hex');
(async()=>{
  const values=env();if(!values.SUPABASE_ACCESS_TOKEN)throw new Error('SUPABASE_MANAGEMENT_AUTH_UNAVAILABLE');
  const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],base='https://api.supabase.com/v1/projects/'+ref+'/functions/';
  const headers={Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'User-Agent':'SutiApp-Affiliates-Sheet/1.0'};
  const sources=files.map((name)=>({name,source:fs.readFileSync(path.join(root,'supabase/functions',slug,name),'utf8').replace(/\r\n/g,'\n')}));
  const sourceSha256=sha(sources.map((file)=>file.name+'\n'+file.source).join('\n'));
  if(mode==='status'){
    const response=await fetch(base+slug,{headers});if(response.status===401)throw new Error('SUPABASE_MANAGEMENT_AUTH_INVALID');
    if(response.status===404){console.log(JSON.stringify({status:'PASS',mode,slug,deployed:false,sourceSha256}));return;}
    const body=await response.json();if(!response.ok)throw new Error('SUPABASE_STATUS_'+response.status);
    console.log(JSON.stringify({status:'PASS',mode,slug,deployed:true,version:body.version||null,cloudStatus:body.status||null,verifyJwt:body.verify_jwt,sourceSha256}));return;
  }
  if(mode==='verify'){
    const meta=await fetch(base+slug,{headers});const info=await meta.json().catch(()=>({}));if(!meta.ok)throw new Error('SUPABASE_STATUS_'+meta.status);
    if(info.verify_jwt!==true)throw new Error('VERIFY_JWT_DISABLED');
    const response=await fetch(base+slug+'/body',{headers});if(!response.ok)throw new Error('SUPABASE_VERIFY_'+response.status);
    const remote=Buffer.from(await response.arrayBuffer());
    for(const marker of ['affiliates-sheet.mjs','SUTISSSTESON','get_data_export_auth_emails','data_exports.read','1a9Qc8Zu2OZGNsCWCwOkWClCJfYvDem4Zlio3GNK1SLA'])if(!remote.includes(Buffer.from(marker)))throw new Error('DEPLOYED_MARKER_MISSING_'+marker);
    console.log(JSON.stringify({status:'PASS',mode,slug,version:info.version,verifyJwt:true,bytes:remote.length,sha256:sha(remote),markers:5,sourceSha256}));return;
  }
  if(mode==='delete'){
    const response=await fetch(base+slug,{method:'DELETE',headers});if(!response.ok&&response.status!==404)throw new Error('SUPABASE_DELETE_'+response.status);
    console.log(JSON.stringify({status:'PASS',mode,slug,httpStatus:response.status}));return;
  }
  const form=new FormData();
  form.append('metadata',JSON.stringify({name:slug,slug,entrypoint_path:'index.ts',verify_jwt:true}));
  for(const file of sources)form.append('file',new Blob([file.source],{type:file.name.endsWith('.ts')?'application/typescript':'application/javascript'}),file.name);
  const response=await fetch(base+'deploy?slug='+slug,{method:'POST',headers,body:form});
  const text=await response.text();let body={};try{body=JSON.parse(text);}catch(_){}
  if(!response.ok)throw new Error('SUPABASE_DEPLOY_'+response.status+'_'+String(body.message||body.error||'').replace(/[\r\n]+/g,' ').slice(0,300));
  console.log(JSON.stringify({status:'PASS',mode,slug,httpStatus:response.status,version:body.version||null,cloudStatus:body.status||null,verifyJwt:true,sourceSha256}));
})().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exit(1);});
