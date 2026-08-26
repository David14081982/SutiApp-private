'use strict';
const fs=require('fs');

const claspPath=process.argv[2],projectId=process.argv[3];
if(!claspPath||!projectId)throw new Error('USAGE: clasprc-path project-id');
if(projectId!=='expanded-talon-506522-r7')throw new Error('UNEXPECTED_PROJECT_ID');
const SERVICES=['picker.googleapis.com','drive.googleapis.com','sheets.googleapis.com','apikeys.googleapis.com'];
let adminEmail='';

(async()=>{
  const clasp=JSON.parse(fs.readFileSync(claspPath,'utf8')),credential=clasp.tokens&&clasp.tokens.default;
  if(!credential||!credential.refresh_token||!credential.client_id||!credential.client_secret)throw new Error('LOCAL_ADMIN_OAUTH_UNAVAILABLE');
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:credential.client_id,client_secret:credential.client_secret,refresh_token:credential.refresh_token,grant_type:'refresh_token'})});
  const token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw new Error('ADMIN_TOKEN_REFRESH_FAILED');
  const headers={Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'};
  const identityResponse=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers});
  const identity=await identityResponse.json();
  if(identityResponse.ok&&typeof identity.email==='string')adminEmail=identity.email;
  const projectResponse=await fetch('https://cloudresourcemanager.googleapis.com/v3/projects/'+projectId,{headers});
  const project=await projectResponse.json();
  let projectNumber='',projectState='';
  if(projectResponse.ok){
    if(project.state!=='ACTIVE'||project.projectId!==projectId||!project.name?.startsWith('projects/'))throw new Error('PROJECT_NOT_ACTIVE');
    projectNumber=project.name.split('/')[1];projectState=project.state;
  }else{
    const serviceResponse=await fetch('https://serviceusage.googleapis.com/v1/projects/'+projectId+'/services/serviceusage.googleapis.com',{headers});
    const service=await serviceResponse.json();
    if(!serviceResponse.ok||!service.name?.startsWith('projects/'))throw new Error('SERVICE_USAGE_PROJECT_READ_'+serviceResponse.status);
    projectNumber=service.name.split('/')[1];projectState='SERVICE_USAGE_ACCESS';
  }
  const enableResponse=await fetch('https://serviceusage.googleapis.com/v1/projects/'+projectNumber+'/services:batchEnable',{
    method:'POST',headers,body:JSON.stringify({serviceIds:SERVICES})});
  const operation=await enableResponse.json();if(!enableResponse.ok||!operation.name)throw new Error('SERVICE_ENABLE_'+enableResponse.status);
  let done=false;
  for(let attempt=0;attempt<30&&!done;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1000));
    const checkResponse=await fetch('https://serviceusage.googleapis.com/v1/'+operation.name,{headers});
    const check=await checkResponse.json();if(!checkResponse.ok)throw new Error('SERVICE_OPERATION_'+checkResponse.status);
    if(check.error)throw new Error('SERVICE_OPERATION_FAILED');
    done=check.done===true;
  }
  if(!done)throw new Error('SERVICE_ENABLE_TIMEOUT');
  const states=[];
  for(const service of SERVICES){
    const response=await fetch('https://serviceusage.googleapis.com/v1/projects/'+projectNumber+'/services/'+service,{headers});
    const body=await response.json();if(!response.ok)throw new Error('SERVICE_VERIFY_'+service+'_'+response.status);
    states.push({service,state:body.state});
  }
  if(states.some(item=>item.state!=='ENABLED'))throw new Error('SERVICE_NOT_ENABLED');
  console.log(JSON.stringify({status:'PASS',projectId,projectNumber,projectState,services:states,
    credentialLogged:false,oauthClientCreated:false,apiKeyCreated:false,googleDataWrite:false}));
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,adminEmail:adminEmail||'UNKNOWN',credentialLogged:false,googleDataWrite:false}));process.exit(1);});
