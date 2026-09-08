'use strict';
// One-time owner-only configuration reconciliation. Never prints or writes secret values to disk.
const fs=require('fs'),assert=require('assert').strict,crypto=require('crypto'),path=require('path');
const env={};for(const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)env[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const sid='1cw2bLuwFWfJkALd-cSgz-KYmQdX2q9I6a5hABo6nwQIXsZ2mDMzy3h5o',api='https://script.googleapis.com/v1/projects/'+sid;
const auth=JSON.parse(fs.readFileSync('C:/Users/david/.clasprc.json','utf8')).tokens.default;
async function json(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(45000)});const d=await r.json().catch(()=>null);assert(r.ok&&d,'ADMIN_HTTP_'+r.status);return d;}
async function token(scope){return (await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:auth.client_id,client_secret:auth.client_secret,refresh_token:auth.refresh_token,grant_type:'refresh_token',scope})})).access_token;}
async function main(){
 const headers={Authorization:'Bearer '+await token('https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/script.deployments'),'Content-Type':'application/json'};
 const original=await json(api+'/content',{headers}),files=original.files.map(({name,type,source})=>({name,type,source}));
 const source=files.find(f=>f.name==='Code').source;assert.equal(source.replace(/\r/g,'').trim(),fs.readFileSync(path.join(__dirname,'../google-apps-script/financial-handoff/Code.gs'),'utf8').replace(/\r/g,'').trim(),'SOURCE_DRIFT');
 const manifest=JSON.parse(files.find(f=>f.name==='appsscript').source);assert.equal(manifest.webapp.access,'ANYONE');
 const nonce=crypto.randomBytes(32).toString('hex'),digest=crypto.createHash('sha256').update(nonce).digest('hex');
 const adminSource=`function doGet(){return ContentService.createTextOutput('Owner configuration only');}\nfunction doPost(e){var p=JSON.parse(e.postData.contents);var h=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,p.nonce).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2)}).join('');if(h!=='${digest}')throw Error('UNAUTHORIZED');var props=PropertiesService.getScriptProperties();var value=props.getProperty('FINANCIAL_HANDOFF_SECRET');var initialized=!value;if(initialized){if(!/^[a-f0-9]{64}$/.test(p.initialSecret))throw Error('INVALID_SECRET');props.setProperty('FINANCIAL_HANDOFF_SECRET',p.initialSecret);value=props.getProperty('FINANCIAL_HANDOFF_SECRET');}return ContentService.createTextOutput(JSON.stringify({value:value,initialized:initialized})).setMimeType(ContentService.MimeType.JSON);}`;
 const temporary=[{name:'Code',type:'SERVER_JS',source:adminSource},{name:'appsscript',type:'JSON',source:JSON.stringify({...manifest,webapp:{access:'MYSELF',executeAs:'USER_DEPLOYING'}})}];
 let deployment,restored=false,removed=false;const proof={status:'FAIL',temporaryAccess:'MYSELF',productionReceiverChanged:false,secretsLogged:false};
 try{
   await json(api+'/content',{method:'PUT',headers,body:JSON.stringify({files:temporary})});
   const version=await json(api+'/versions',{method:'POST',headers,body:JSON.stringify({description:'Temporary owner-only configuration reconciliation'})});
   deployment=await json(api+'/deployments',{method:'POST',headers,body:JSON.stringify({versionNumber:version.versionNumber,manifestFileName:'appsscript',description:'Temporary MYSELF configuration reconciliation'})});
   await json(api+'/content',{method:'PUT',headers,body:JSON.stringify({files})});restored=true;
   const web=deployment.entryPoints.find(e=>e.entryPointType==='WEB_APP');assert.equal(web.webApp.entryPointConfig.access,'MYSELF','OWNER_ONLY_REQUIRED');
   const result=await json(web.webApp.url,{method:'POST',headers:{Authorization:'Bearer '+await token('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy'),'Content-Type':'application/json'},body:JSON.stringify({nonce,initialSecret:crypto.randomBytes(32).toString('hex')})});
   assert(typeof result.value==='string'&&result.value.length>0,'EXISTING_PROPERTY_MISSING');
   const endpoint='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/secrets',supabaseHeaders={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'};
   const before=await json(endpoint,{headers:supabaseHeaders});proof.propertyInitialized=result.initialized===true;proof.sharedSecretMismatch=before.find(x=>x.name==='FINANCIAL_LEGACY_API_TOKEN')?.value!==crypto.createHash('sha256').update(result.value).digest('hex');
   const response=await fetch(endpoint,{method:'POST',headers:supabaseHeaders,body:JSON.stringify([{name:'FINANCIAL_LEGACY_API_TOKEN',value:result.value}]),signal:AbortSignal.timeout(45000)});assert(response.ok,'SECRET_UPDATE_FAILED');
   const after=await json(endpoint,{headers:supabaseHeaders});assert.equal(after.find(x=>x.name==='FINANCIAL_LEGACY_API_TOKEN').value,crypto.createHash('sha256').update(result.value).digest('hex'));proof.status='PASS';
 }finally{
   if(!restored){await json(api+'/content',{method:'PUT',headers,body:JSON.stringify({files})});restored=true;}
   if(deployment){await json(api+'/deployments/'+deployment.deploymentId,{method:'DELETE',headers});removed=true;}
   const head=await json(api+'/content',{headers});assert.deepEqual(head.files.map(({name,type,source})=>({name,type,source})).sort((a,b)=>a.name.localeCompare(b.name)),files.sort((a,b)=>a.name.localeCompare(b.name)),'HEAD_NOT_RESTORED');
   proof.headRestored=restored;proof.temporaryDeploymentRemoved=removed;
   fs.writeFileSync(path.join(__dirname,'../docs/qa/evidence/requests-workflow-google-sync-20260908/configuration-reconcile.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:/^[A-Z_0-9]+$/.test(e.message)?e.message:'CONFIGURATION_RECONCILIATION_FAILED'}));process.exitCode=1;});
