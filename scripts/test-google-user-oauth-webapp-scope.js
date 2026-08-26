'use strict';
const fs=require('fs');

const claspPath=process.argv[2];
const webAppUrl=process.argv[3];
if(!claspPath||!webAppUrl)throw new Error('USAGE: clasprc-path web-app-url');

(async()=>{
  const clasp=JSON.parse(fs.readFileSync(claspPath,'utf8')),credential=clasp.tokens&&clasp.tokens.default;
  if(!credential||!credential.refresh_token||!credential.client_id||!credential.client_secret)throw new Error('LOCAL_OAUTH_CREDENTIAL_UNAVAILABLE');
  const identity='openid email https://www.googleapis.com/auth/userinfo.email';
  const driveFile='https://www.googleapis.com/auth/drive.file';
  const candidates=[
    ['drive.file+userinfo.email',driveFile+' https://www.googleapis.com/auth/userinfo.email'],
    ['drive.file+identity',driveFile+' '+identity],
    ['drive.file+script.webapp.deploy',driveFile+' https://www.googleapis.com/auth/script.webapp.deploy'],
    ['drive.file+script.deployments',driveFile+' https://www.googleapis.com/auth/script.deployments'],
    ['drive.file+script.projects',driveFile+' https://www.googleapis.com/auth/script.projects'],
    ['drive.file+identity+script.webapp.deploy',driveFile+' '+identity+' https://www.googleapis.com/auth/script.webapp.deploy'],
  ],results=[];
  for(const [name,requestedScopes] of candidates){
    const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:credential.client_id,client_secret:credential.client_secret,refresh_token:credential.refresh_token,grant_type:'refresh_token',scope:requestedScopes})});
    const tokenBody=await tokenResponse.json();if(!tokenResponse.ok||!tokenBody.access_token){results.push({name,tokenStatus:tokenResponse.status,httpStatus:null});continue;}
    const infoResponse=await fetch('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(tokenBody.access_token)),tokenInfo=await infoResponse.json();
    const response=await fetch(webAppUrl,{headers:{Authorization:'Bearer '+tokenBody.access_token},redirect:'follow'});
    const grantedScopes=String(tokenInfo.scope||'').split(' ').filter(Boolean);
    const requestedScopeList=requestedScopes.split(' ').filter(Boolean);
    results.push({
      name,
      tokenStatus:tokenResponse.status,
      httpStatus:response.status,
      grantedScopeCount:grantedScopes.length,
      requestedScopesHonored:requestedScopeList.every(scope=>grantedScopes.includes(scope)),
    });
  }
  const passes=results.filter(item=>item.httpStatus===200);
  console.log(JSON.stringify({status:passes.length?'PASS':'FAIL',results,passingScopeSets:passes.map(item=>item.name),refreshTokenLogged:false,googleWrite:false}));
  if(!passes.length)process.exit(1);
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,refreshTokenLogged:false,googleWrite:false}));process.exit(1);});
