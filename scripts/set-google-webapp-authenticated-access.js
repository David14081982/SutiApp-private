'use strict';
const crypto=require('crypto');
const fs=require('fs');

const claspPath=process.argv[2],scriptId=process.argv[3],deploymentId=process.argv[4],localCodePath=process.argv[5];
if(!claspPath||!scriptId||!deploymentId||!localCodePath)throw new Error('USAGE: clasprc script-id deployment-id local-code');
const hash=value=>crypto.createHash('sha256').update(String(value).replace(/\r\n/g,'\n')).digest('hex');

(async()=>{
  const clasp=JSON.parse(fs.readFileSync(claspPath,'utf8')),credential=clasp.tokens&&clasp.tokens.default;
  if(!credential||!credential.refresh_token||!credential.client_id||!credential.client_secret)throw new Error('LOCAL_ADMIN_OAUTH_UNAVAILABLE');
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:credential.client_id,client_secret:credential.client_secret,refresh_token:credential.refresh_token,grant_type:'refresh_token'})});
  const token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw new Error('ADMIN_TOKEN_REFRESH_FAILED');
  const headers={Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'};
  const base='https://script.googleapis.com/v1/projects/'+encodeURIComponent(scriptId);
  const contentResponse=await fetch(base+'/content',{headers});
  const content=await contentResponse.json();if(!contentResponse.ok||!Array.isArray(content.files))throw new Error('PROJECT_CONTENT_READ_'+contentResponse.status);
  const manifest=content.files.find(file=>file.name==='appsscript'&&file.type==='JSON');
  const code=content.files.find(file=>file.name==='Code'&&file.type==='SERVER_JS');
  if(!manifest||!code)throw new Error('EXPECTED_PROJECT_FILES_MISSING');
  const localCode=fs.readFileSync(localCodePath,'utf8');
  if(hash(code.source)!==hash(localCode))throw new Error('CLOUD_CODE_MISMATCH');
  const before=JSON.parse(manifest.source);
  if(before.webapp?.access!=='ANYONE_ANONYMOUS'||before.webapp?.executeAs!=='USER_DEPLOYING')throw new Error('UNEXPECTED_WEBAPP_CONFIG');
  const updated=JSON.parse(JSON.stringify(before));updated.webapp.access='ANYONE';
  const updatedFiles=content.files.map(file=>file===manifest?{...file,source:JSON.stringify(updated,null,2)}:file);
  const updateResponse=await fetch(base+'/content',{method:'PUT',headers,body:JSON.stringify({files:updatedFiles})});
  if(!updateResponse.ok)throw new Error('PROJECT_CONTENT_UPDATE_'+updateResponse.status);
  let deployed=false;
  try{
    const versionResponse=await fetch(base+'/versions',{method:'POST',headers,body:JSON.stringify({description:'Financial Visibility authenticated OAuth access'})});
    const version=await versionResponse.json();if(!versionResponse.ok||!version.versionNumber)throw new Error('VERSION_CREATE_'+versionResponse.status);
    const deploymentResponse=await fetch(base+'/deployments/'+encodeURIComponent(deploymentId),{method:'PUT',headers,
      body:JSON.stringify({deploymentConfig:{versionNumber:version.versionNumber,manifestFileName:'appsscript',description:'Financial Visibility authenticated OAuth access'}})});
    const deployment=await deploymentResponse.json();if(!deploymentResponse.ok)throw new Error('DEPLOYMENT_UPDATE_'+deploymentResponse.status);
    deployed=true;
    console.log(JSON.stringify({status:'PASS',scriptId,deploymentId,versionNumber:version.versionNumber,
      previousAccess:'ANYONE_ANONYMOUS',access:'ANYONE',executeAs:'USER_DEPLOYING',codeHash:hash(code.source),googleSheetWrite:false,credentialLogged:false}));
  }finally{
    if(!deployed)await fetch(base+'/content',{method:'PUT',headers,body:JSON.stringify({files:content.files})});
  }
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,googleSheetWrite:false,credentialLogged:false}));process.exit(1);});
