'use strict';
const crypto=require('crypto');
const fs=require('fs');
const http=require('http');

const claspPath=process.argv[2];
const supabaseEnvPath=process.argv[3];
const webAppUrl=process.argv[4];
const publicStatusPath=process.argv[5]||'';
if(!claspPath||!supabaseEnvPath||!webAppUrl)throw new Error('USAGE: clasprc-path supabase-env-path web-app-url');

const REQUIRED_SCOPES=[
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/script.webapp.deploy',
];
const EXPECTED_EMAIL='soporte.sutiapp@gmail.com';
const WORKBOOK_ID='1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';

function parseEnv(file){
  return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).map(line=>line.trim())
    .filter(line=>line&&!line.startsWith('#')&&line.includes('='))
    .map(line=>{const i=line.indexOf('=');let value=line.slice(i+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);return[line.slice(0,i).trim(),value];}));
}
function base64url(value){return Buffer.from(value).toString('base64url');}
function html(message){return '<!doctype html><meta charset="utf-8"><title>SutiApp OAuth</title><p style="font:16px system-ui;padding:32px">'+message+'</p>';}

(async()=>{
  const clasp=JSON.parse(fs.readFileSync(claspPath,'utf8'));
  const source=clasp.tokens&&clasp.tokens.default;
  if(!source||!source.client_id||!source.client_secret)throw new Error('LOCAL_OAUTH_CLIENT_UNAVAILABLE');
  const env=parseEnv(supabaseEnvPath);
  if(!env.SUPABASE_ACCESS_TOKEN||!env.SUPABASE_URL)throw new Error('SUPABASE_MANAGEMENT_AUTH_UNAVAILABLE');
  const projectRef=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  if(!/^[a-z]{20}$/.test(projectRef))throw new Error('INVALID_SUPABASE_PROJECT_REF');

  const state=base64url(crypto.randomBytes(32));
  const verifier=base64url(crypto.randomBytes(64));
  const challenge=base64url(crypto.createHash('sha256').update(verifier).digest());
  let settle;
  const callback=new Promise((resolve,reject)=>{settle={resolve,reject};});
  const server=http.createServer((req,res)=>{
    const requestUrl=new URL(req.url,'http://127.0.0.1');
    if(requestUrl.pathname!=='/oauth2callback'){res.writeHead(404).end();return;}
    const error=requestUrl.searchParams.get('error');
    const returnedState=requestUrl.searchParams.get('state');
    const code=requestUrl.searchParams.get('code');
    if(error||returnedState!==state||!code){res.writeHead(400,{'Content-Type':'text/html; charset=utf-8'}).end(html('Consentimiento rechazado o inválido. Puedes cerrar esta ventana.'));settle.reject(new Error(error||'INVALID_OAUTH_CALLBACK'));return;}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html('Consentimiento recibido de forma segura. Puedes cerrar esta ventana y volver a Codex.'));
    settle.resolve(code);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;
  const redirectUri='http://127.0.0.1:'+port+'/oauth2callback';
  const authUrl=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.search=new URLSearchParams({client_id:source.client_id,redirect_uri:redirectUri,response_type:'code',
    scope:REQUIRED_SCOPES.join(' '),access_type:'offline',prompt:'consent select_account',include_granted_scopes:'false',
    login_hint:EXPECTED_EMAIL,state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
  const publicStatus={status:'OAUTH_CONSENT_REQUIRED',account:EXPECTED_EMAIL,scopes:REQUIRED_SCOPES,authorizationUrl:authUrl.toString(),secretsStored:false};
  if(publicStatusPath)fs.writeFileSync(publicStatusPath,JSON.stringify(publicStatus),'utf8');
  console.log(JSON.stringify(publicStatus));
  const timeout=setTimeout(()=>settle.reject(new Error('OAUTH_CONSENT_TIMEOUT')),600000);
  let code;
  try{code=await callback;}finally{clearTimeout(timeout);server.close();}

  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:source.client_id,client_secret:source.client_secret,code,code_verifier:verifier,
      grant_type:'authorization_code',redirect_uri:redirectUri})});
  const token=await tokenResponse.json();
  if(!tokenResponse.ok||typeof token.access_token!=='string'||typeof token.refresh_token!=='string')throw new Error('OAUTH_TOKEN_EXCHANGE_FAILED');
  const granted=new Set(String(token.scope||'').split(' ').filter(Boolean));
  if(granted.size!==REQUIRED_SCOPES.length||REQUIRED_SCOPES.some(scope=>!granted.has(scope)))throw new Error('OAUTH_SCOPE_MISMATCH');

  const readResponse=await fetch(webAppUrl,{headers:{Authorization:'Bearer '+token.access_token},redirect:'follow'});
  const sheetsReadUrl='https://sheets.googleapis.com/v4/spreadsheets/'+WORKBOOK_ID+'/values/'+
    encodeURIComponent('Criterios de fondos!A1:P1')+'?majorDimension=ROWS';
  const sheetsReadResponse=await fetch(sheetsReadUrl,{headers:{Authorization:'Bearer '+token.access_token}});
  const authenticationPath=readResponse.status===200?'AUTHENTICATED_WEB_APP':
    sheetsReadResponse.status===200?'SHEETS_API_DRIVE_FILE':'';
  if(!authenticationPath)throw new Error('GOOGLE_READ_DENIED_WEBAPP_'+readResponse.status+'_SHEETS_'+sheetsReadResponse.status);

  const secrets=[
    {name:'GOOGLE_VISIBILITY_OAUTH_CLIENT_ID',value:source.client_id},
    {name:'GOOGLE_VISIBILITY_OAUTH_CLIENT_SECRET',value:source.client_secret},
    {name:'GOOGLE_VISIBILITY_OAUTH_REFRESH_TOKEN',value:token.refresh_token},
  ];
  const secretResponse=await fetch('https://api.supabase.com/v1/projects/'+projectRef+'/secrets',{method:'POST',
    headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-FinancialVisibilityOAuth/1.0'},
    body:JSON.stringify(secrets)});
  if(secretResponse.status!==201)throw new Error('SUPABASE_SECRET_WRITE_'+secretResponse.status);
  const success={status:'PASS',account:EXPECTED_EMAIL,scopeCount:granted.size,authenticationPath,
    webAppGet:readResponse.status,sheetsApiGet:sheetsReadResponse.status,
    secretsConfigured:secrets.map(item=>item.name),tokenLogged:false,tokenStoredLocally:false,googleWrite:false};
  if(publicStatusPath)fs.writeFileSync(publicStatusPath,JSON.stringify(success),'utf8');
  console.log(JSON.stringify(success));
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,tokenLogged:false,tokenStoredLocally:false,googleWrite:false}));process.exit(1);});
