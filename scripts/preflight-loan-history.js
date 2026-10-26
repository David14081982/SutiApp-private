'use strict';
// Read-only production preflight plus Edge bundle validation. Never deploys/applies.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {environment,query}=require('./inspect-loan-history');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-loan-payments'),out=path.join(root,'docs/qa/evidence/history-loan-payments');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),norm=s=>s.replace(/\r/g,'').trim(),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const script='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o',deployment='AKfycbwvQ_HZ1-lb5RVv9En4XgTRh1f3EjcIXSZel3zkWhC9gCI4vW_vRLd64RjxvOSQqdIz0g';
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error('PREFLIGHT_HTTP_'+r.status);return r.json();}
async function main(){
 const env=environment(),auth=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;
 const token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:auth.client_id,client_secret:auth.client_secret,refresh_token:auth.refresh_token,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'})});
 const api='https://script.googleapis.com/v1/projects/'+script,h={Authorization:'Bearer '+token.access_token};
 const dep=await json(api+'/deployments/'+deployment,{headers:h});
 const [content,head]=await Promise.all([json(api+'/content?versionNumber='+dep.deploymentConfig.versionNumber,{headers:h}),json(api+'/content',{headers:h})]);
 const canonical=c=>JSON.stringify(c.files.map(f=>({name:f.name,type:f.type,source:norm(f.source)})).sort((a,b)=>a.name.localeCompare(b.name)));
 assert.equal(canonical(content),canonical(head),'UNPUBLISHED_GOOGLE_HEAD');
 const old=content.files.find(f=>f.name==='Code');assert(old,'CODE_MISSING');
 assert.equal(norm(old.source),norm(read('.tmp/history-loan-payments/before/google-apps-script__financial-handoff__Code.gs')),'GOOGLE_BASELINE_DRIFT');
 const save=path.join(dir,'google-before.json');if(fs.existsSync(save))assert.equal(canonical(JSON.parse(fs.readFileSync(save)).content),canonical(content),'SAVED_BASELINE_DRIFT');
 else fs.writeFileSync(save,JSON.stringify({deployment:dep,content,head},null,2));
 const presence=(await query("select exists(select 1 from supabase_migrations.schema_migrations where version='20261025000100') version_exists,to_regprocedure('public.get_self_loan_history_context()') is not null function_exists"))[0];
 assert.equal(presence.version_exists,false);assert.equal(presence.function_exists,false);
 const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0],form=new FormData();
 form.append('metadata',JSON.stringify({name:'loan-history',slug:'loan-history',entrypoint_path:'index.ts',verify_jwt:true}));
 for(const name of ['index.ts','history.mjs','source.mjs'])form.append('file',new Blob([read('supabase/functions/loan-history/'+name)],{type:name.endsWith('.ts')?'application/typescript':'application/javascript'}),name);
 const existing=await json(base+'/functions',{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}});assert(!existing.some(f=>f.slug==='loan-history'||f.name==='loan-history'),'EDGE_ALREADY_EXISTS');
 const compiled=await fetch(base+'/functions/deploy?slug=loan-history&bundleOnly=true',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN},body:form,signal:AbortSignal.timeout(55000)});
 if(!compiled.ok){fs.writeFileSync(path.join(dir,'edge-bundle-error.txt'),await compiled.text());throw Error('EDGE_BUNDLE_HTTP_'+compiled.status);}
 const bytes=Buffer.from(await compiled.arrayBuffer());fs.writeFileSync(path.join(dir,'edge-bundle-response.bin'),bytes);
 const after=await json(base+'/functions',{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}});assert(!after.some(f=>f.slug==='loan-history'||f.name==='loan-history'),'BUNDLE_UNEXPECTEDLY_INSTALLED');
 const proof={status:'PASS',mode:'READ_ONLY_PREFLIGHT',googleActiveVersion:dep.deploymentConfig.versionNumber,googleBaselineMatches:true,googleBackupSha256:sha(canonical(content)),migrationAvailable:true,edgeBundled:true,edgeInstalled:false,productionWrites:0};
 fs.writeFileSync(path.join(out,'preflight.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
