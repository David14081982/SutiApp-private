'use strict';
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');

const mode=process.argv[2]||'status';
const allowed=new Set(['status','bundle','deploy','verify','backup','delete']);
if(!allowed.has(mode))throw new Error('USAGE: status|bundle|deploy|verify|backup|delete');
const root=path.resolve(__dirname,'..');
const sourcePath=path.join(root,'supabase','functions','document-access','index.ts');
function env(){return Object.fromEntries(fs.readFileSync(path.join(root,'supabase.env'),'utf8').split(/\r?\n/).map((line)=>line.trim()).filter((line)=>line&&!line.startsWith('#')&&line.includes('=')).map((line)=>{const index=line.indexOf('=');let value=line.slice(index+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);return[line.slice(0,index).trim(),value];}));}
const sha=(value)=>crypto.createHash('sha256').update(value).digest('hex');
(async()=>{
  const values=env(),source=fs.readFileSync(sourcePath,'utf8'),ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],slug='document-access';
  if(!values.SUPABASE_ACCESS_TOKEN)throw new Error('SUPABASE_MANAGEMENT_AUTH_UNAVAILABLE');
  const base='https://api.supabase.com/v1/projects/'+ref+'/functions/';
  const headers={Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'User-Agent':'SutiApp-Document-Access/1.0'};
  if(mode==='status'){
    const response=await fetch(base+slug,{headers});if(response.status===404){console.log(JSON.stringify({status:'PASS',mode,slug,deployed:false,secretLogged:false}));return;}
    const body=await response.json();if(!response.ok)throw new Error('SUPABASE_STATUS_'+response.status);
    console.log(JSON.stringify({status:'PASS',mode,slug,deployed:true,version:body.version||null,cloudStatus:body.status||null,verifyJwt:body.verify_jwt,secretLogged:false}));return;
  }
  if(mode==='verify'||mode==='backup'){
    const response=await fetch(base+slug+'/body',{headers});if(!response.ok)throw new Error('SUPABASE_VERIFY_'+response.status);
    const remote=Buffer.from(await response.arrayBuffer());const local=Buffer.from(source);
    if(mode==='backup'){const target='C:\\tmp\\document-access-deployed.bin';fs.writeFileSync(target,remote);console.log(JSON.stringify({status:'PASS',mode,slug,target,bytes:remote.length,sha256:sha(remote),secretLogged:false}));return;}
    const compiled=remote.subarray(0,5).toString()==='ESZIP';
    if(compiled){for(const marker of ['source/index.ts','authorize_self_document_preview','document_access_audit_log','SIGN_PREVIEW'])if(!remote.includes(Buffer.from(marker)))throw new Error('DEPLOYED_BUNDLE_MARKER_MISSING_'+marker);}
    else if(sha(remote)!==sha(local))throw new Error('DEPLOYED_SOURCE_MISMATCH');
    console.log(JSON.stringify({status:'PASS',mode,slug,bytes:remote.length,sha256:sha(remote),compiledBundle:compiled,requiredMarkers:compiled?4:null,secretLogged:false}));return;
  }
  if(mode==='delete'){
    const response=await fetch(base+slug,{method:'DELETE',headers});if(!response.ok&&response.status!==404)throw new Error('SUPABASE_DELETE_'+response.status);
    console.log(JSON.stringify({status:'PASS',mode,slug,httpStatus:response.status,secretLogged:false}));return;
  }
  const form=new FormData();
  form.append('metadata',JSON.stringify({name:slug,slug,entrypoint_path:'index.ts',verify_jwt:true}));
  form.append('file',new Blob([source],{type:'application/typescript'}),'index.ts');
  const suffix=mode==='bundle'?'&bundleOnly=true':'';
  const response=await fetch(base+'deploy?slug='+slug+suffix,{method:'POST',headers,body:form});
  const text=await response.text();let body={};try{body=JSON.parse(text);}catch{}
  if(!response.ok)throw new Error('SUPABASE_'+mode.toUpperCase()+'_'+response.status+'_'+String(body.message||body.error||'').replace(/[\r\n]+/g,' ').slice(0,300));
  console.log(JSON.stringify({status:'PASS',mode,slug,httpStatus:response.status,version:body.version||null,cloudStatus:body.status||null,sourceSha256:sha(source),verifyJwt:true,secretLogged:false}));
})().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message,secretLogged:false}));process.exit(1);});
