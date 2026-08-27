'use strict';
const crypto=require('crypto');
const fs=require('fs');

const envPath=process.argv[2],sourcePath=process.argv[3],mode=process.argv[4]||'bundle';
if(!envPath||!sourcePath||!['bundle','deploy','status','backup','delete'].includes(mode))throw new Error('USAGE: env source [bundle|deploy|status|backup|delete] [backup-path]');
function parseEnv(file){return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const i=line.indexOf('=');let value=line.slice(i+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);return[line.slice(0,i).trim(),value];}));}
(async()=>{
  const env=parseEnv(envPath),source=fs.readFileSync(sourcePath,'utf8');
  if(!env.SUPABASE_ACCESS_TOKEN||!env.SUPABASE_URL)throw new Error('SUPABASE_MANAGEMENT_AUTH_UNAVAILABLE');
  const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0],slug=(mode==='backup'?process.argv[6]:process.argv[5])||'financial-criteria-admin';
  if(!['financial-criteria-admin','financial-legacy','financial-criteria-canary'].includes(slug))throw new Error('UNEXPECTED_FUNCTION_SLUG');
  if(mode==='backup'){
    const backupPath=process.argv[5]||'';if(!backupPath.startsWith('C:\\tmp\\'))throw new Error('BACKUP_PATH_MUST_BE_CTMP');
    const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/functions/'+slug+'/body',{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'User-Agent':'SutiApp-FinancialVisibilityDeploy/1.0'}});
    if(!response.ok)throw new Error('SUPABASE_BACKUP_'+response.status);const bytes=Buffer.from(await response.arrayBuffer());fs.writeFileSync(backupPath,bytes);
    console.log(JSON.stringify({status:'PASS',mode,slug,backupPath,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),secretLogged:false}));return;
  }
  if(mode==='status'){
    const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/functions/'+slug,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'User-Agent':'SutiApp-FinancialVisibilityDeploy/1.0'}});
    const body=await response.json();if(!response.ok)throw new Error('SUPABASE_STATUS_'+response.status);
    console.log(JSON.stringify({status:'PASS',mode,slug,version:body.version||null,cloudStatus:body.status||null,verifyJwt:body.verify_jwt,updatedAt:body.updated_at||null,secretLogged:false}));return;
  }
  if(mode==='delete'){
    const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/functions/'+slug,{method:'DELETE',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'User-Agent':'SutiApp-FinancialVisibilityDeploy/1.0'}});
    if(!response.ok&&response.status!==404)throw new Error('SUPABASE_DELETE_'+response.status);
    console.log(JSON.stringify({status:'PASS',mode,slug,httpStatus:response.status,secretLogged:false}));return;
  }
  const form=new FormData();
  form.append('metadata',JSON.stringify({name:slug,slug,entrypoint_path:'index.ts',verify_jwt:true}));
  form.append('file',new Blob([source],{type:'application/typescript'}),'index.ts');
  let hashSource=source;
  if(slug==='financial-legacy'||slug==='financial-criteria-canary'){
    const policyPath=require('path').join(require('path').dirname(sourcePath),'visibility-policy.js');
    const policy=fs.readFileSync(policyPath,'utf8');form.append('file',new Blob([policy],{type:'application/javascript'}),'visibility-policy.js');hashSource+='\n--visibility-policy--\n'+policy;
  }
  const suffix=mode==='bundle'?'&bundleOnly=true':'';
  const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/functions/deploy?slug='+slug+suffix,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'User-Agent':'SutiApp-FinancialVisibilityDeploy/1.0'},body:form});
  const text=await response.text();let body={};try{body=JSON.parse(text);}catch{}
  if(!response.ok){const message=String(body.message||body.error||'').replace(/[\r\n]+/g,' ').slice(0,300);throw new Error('SUPABASE_'+mode.toUpperCase()+'_'+response.status+(message?'_'+message:''));}
  console.log(JSON.stringify({status:'PASS',mode,slug,httpStatus:response.status,version:body.version||null,
    cloudStatus:body.status||null,sourceSha256:crypto.createHash('sha256').update(hashSource).digest('hex'),verifyJwt:true,secretLogged:false}));
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,secretLogged:false}));process.exit(1);});
