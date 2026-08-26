'use strict';
const fs=require('fs');

const claspPath=process.argv[2];
const scriptId=process.argv[3];
if(!claspPath||!scriptId)throw new Error('USAGE: clasprc-path script-id');

(async()=>{
  const clasp=JSON.parse(fs.readFileSync(claspPath,'utf8'));
  const credential=clasp.tokens&&clasp.tokens.default;
  if(!credential||!credential.refresh_token||!credential.client_id||!credential.client_secret)throw new Error('LOCAL_OAUTH_CREDENTIAL_UNAVAILABLE');
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:credential.client_id,client_secret:credential.client_secret,refresh_token:credential.refresh_token,grant_type:'refresh_token'}),
  });
  const tokenBody=await tokenResponse.json();
  if(!tokenResponse.ok||!tokenBody.access_token)throw new Error('TOKEN_REFRESH_FAILED_'+tokenResponse.status);
  const response=await fetch('https://script.googleapis.com/v1/projects/'+encodeURIComponent(scriptId)+'/deployments',{
    headers:{Authorization:'Bearer '+tokenBody.access_token},
  });
  const body=await response.json();
  if(!response.ok)throw new Error('DEPLOYMENTS_READ_FAILED_'+response.status);
  const deployments=(body.deployments||[]).map(item=>({
    deploymentId:item.deploymentId,
    versionNumber:item.deploymentConfig&&item.deploymentConfig.versionNumber,
    description:item.deploymentConfig&&item.deploymentConfig.description,
    entryPointTypes:(item.entryPoints||[]).map(entry=>entry.entryPointType),
    webAppUrls:(item.entryPoints||[]).map(entry=>entry.webApp&&entry.webApp.url).filter(Boolean),
  }));
  console.log(JSON.stringify({status:'PASS',scriptId,deployments,credentialLogged:false,googleWrite:false}));
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,credentialLogged:false,googleWrite:false}));process.exit(1);});
