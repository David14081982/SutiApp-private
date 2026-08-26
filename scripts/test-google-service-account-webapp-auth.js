'use strict';
const fs=require('fs');
const crypto=require('crypto');

const credentialPath=process.argv[2];
const webAppUrl=process.argv[3];
if(!credentialPath||!webAppUrl)throw new Error('USAGE: credential-path web-app-url');

function base64url(value){return Buffer.from(value).toString('base64url');}
async function accessToken(credentials,scope){
  const now=Math.floor(Date.now()/1000),audience=credentials.token_uri||'https://oauth2.googleapis.com/token';
  const header=base64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims=base64url(JSON.stringify({iss:credentials.client_email,scope,aud:audience,iat:now,exp:now+900}));
  const signer=crypto.createSign('RSA-SHA256');signer.update(header+'.'+claims);signer.end();
  const assertion=header+'.'+claims+'.'+signer.sign(credentials.private_key,'base64url');
  const response=await fetch(audience,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const body=await response.json();if(!response.ok||!body.access_token)throw new Error('TOKEN_EXCHANGE_'+response.status);
  return body.access_token;
}

(async()=>{
  const credentials=JSON.parse(fs.readFileSync(credentialPath,'utf8'));
  if(credentials.type!=='service_account'||credentials.client_email!=='bot-sheets@whatsapp-bot-sutiapp.iam.gserviceaccount.com'||!credentials.private_key)throw new Error('AUTHORIZED_SERVICE_ACCOUNT_MISMATCH');
  const scope='https://www.googleapis.com/auth/userinfo.email';
  const token=await accessToken(credentials,scope);
  const response=await fetch(webAppUrl,{headers:{Authorization:'Bearer '+token},redirect:'follow'});
  const text=await response.text();
  console.log(JSON.stringify({status:response.status===200?'PASS':'FAIL',httpStatus:response.status,scope,identityType:'service_account',responseJson:text.trim().startsWith('{'),credentialLogged:false,googleWrite:false}));
  if(response.status!==200)process.exit(1);
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,credentialLogged:false,googleWrite:false}));process.exit(1);});
