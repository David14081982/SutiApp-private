'use strict';
const crypto=require('crypto');
const fs=require('fs');
const http=require('http');

const claspPath=process.argv[2],oauthClientPath=process.argv[3],supabaseEnvPath=process.argv[4],publicStatusPath=process.argv[5]||'';
if(!claspPath||!oauthClientPath||!supabaseEnvPath)throw new Error('USAGE: clasprc oauth-client-json supabase-env [public-status]');
const PROJECT_ID='expanded-talon-506522-r7',PROJECT_NUMBER='842095692451';
const EXPECTED_EMAIL='soporte.sutiapp@gmail.com',WORKBOOK_ID='1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
const DRIVE_FILE_SCOPE='https://www.googleapis.com/auth/drive.file';
const base64url=value=>Buffer.from(value).toString('base64url');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function parseEnv(file){return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const i=line.indexOf('=');let value=line.slice(i+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);return[line.slice(0,i).trim(),value];}));}
function publish(value){if(publicStatusPath)fs.writeFileSync(publicStatusPath,JSON.stringify(value),'utf8');console.log(JSON.stringify(value));}
async function operation(headers,name){for(let i=0;i<30;i++){await sleep(1000);const response=await fetch('https://apikeys.googleapis.com/v2/'+name,{headers});const body=await response.json();if(!response.ok)throw new Error('API_KEY_OPERATION_'+response.status);if(body.error)throw new Error('API_KEY_OPERATION_FAILED');if(body.done)return body;}throw new Error('API_KEY_OPERATION_TIMEOUT');}

(async()=>{
  const admin=JSON.parse(fs.readFileSync(claspPath,'utf8')).tokens?.default;
  const oauthFile=JSON.parse(fs.readFileSync(oauthClientPath,'utf8')),oauth=oauthFile.installed;
  const env=parseEnv(supabaseEnvPath);
  if(!admin?.refresh_token||!admin.client_id||!admin.client_secret)throw new Error('ADMIN_OAUTH_UNAVAILABLE');
  if(!oauth?.client_id||!oauth.client_secret||oauth.project_id!==PROJECT_ID)throw new Error('DEDICATED_OAUTH_CLIENT_INVALID');
  if(!env.SUPABASE_ACCESS_TOKEN||!env.SUPABASE_URL)throw new Error('SUPABASE_MANAGEMENT_AUTH_UNAVAILABLE');
  const projectRef=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const adminTokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:admin.client_id,client_secret:admin.client_secret,refresh_token:admin.refresh_token,grant_type:'refresh_token'})});
  const adminToken=await adminTokenResponse.json();if(!adminTokenResponse.ok||!adminToken.access_token)throw new Error('ADMIN_TOKEN_REFRESH_FAILED');
  const adminHeaders={Authorization:'Bearer '+adminToken.access_token,'Content-Type':'application/json','x-goog-user-project':PROJECT_ID};
  let keyName='';
  try{
    const keyId='sutiapp-finvis-picker-'+crypto.randomBytes(8).toString('hex');
    const createResponse=await fetch('https://apikeys.googleapis.com/v2/projects/'+PROJECT_NUMBER+'/locations/global/keys?keyId='+keyId,{method:'POST',headers:adminHeaders,body:JSON.stringify({displayName:'SutiApp Financial Visibility Picker Temporary',restrictions:{browserKeyRestrictions:{allowedReferrers:['http://127.0.0.1','http://127.0.0.1/*']},apiTargets:[{service:'picker.googleapis.com'}]}})});
    const create=await createResponse.json();
    if(!createResponse.ok||!create.name){
      const status=String(create?.error?.status||'UNKNOWN').replace(/[^A-Z_]/g,'');
      const message=String(create?.error?.message||'').replace(/[\r\n]+/g,' ').slice(0,240);
      throw new Error('API_KEY_CREATE_'+createResponse.status+'_'+status+(message?'_'+message:''));
    }
    const created=await operation(adminHeaders,create.name);keyName=created.response?.name||'';if(!keyName)throw new Error('API_KEY_RESOURCE_MISSING');
    const stringResponse=await fetch('https://apikeys.googleapis.com/v2/'+keyName+'/keyString',{headers:adminHeaders});
    const stringBody=await stringResponse.json();if(!stringResponse.ok||!stringBody.keyString)throw new Error('API_KEY_STRING_'+stringResponse.status);
    const developerKey=stringBody.keyString;

    const state=base64url(crypto.randomBytes(32)),verifier=base64url(crypto.randomBytes(64));
    const challenge=base64url(crypto.createHash('sha256').update(verifier).digest()),pickerNonce=base64url(crypto.randomBytes(24));
    let callbackResolve,callbackReject,supportToken=null;
    const selected=new Promise((resolve,reject)=>{callbackResolve=resolve;callbackReject=reject;});
    const server=http.createServer(async(req,res)=>{
      try{
        const requestUrl=new URL(req.url,'http://127.0.0.1');
        if(requestUrl.pathname==='/oauth2callback'){
          const code=requestUrl.searchParams.get('code');
          if(requestUrl.searchParams.get('state')!==state||!code)throw new Error('INVALID_OAUTH_CALLBACK');
          const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:oauth.client_id,client_secret:oauth.client_secret,code,code_verifier:verifier,grant_type:'authorization_code',redirect_uri:'http://127.0.0.1:'+server.address().port+'/oauth2callback'})});
          supportToken=await response.json();
          if(!response.ok||!supportToken.access_token||!supportToken.refresh_token||String(supportToken.scope||'')!==DRIVE_FILE_SCOPE)throw new Error('DEDICATED_OAUTH_EXCHANGE_FAILED');
          const pickerHtml=`<!doctype html><meta charset="utf-8"><title>SutiApp File Picker</title><p id="status" style="font:16px system-ui;padding:24px">Abriendo selector seguro de Google Drive…</p><script src="https://apis.google.com/js/api.js"></script><script>
          const token=${JSON.stringify(supportToken.access_token)},key=${JSON.stringify(developerKey)},nonce=${JSON.stringify(pickerNonce)},expected=${JSON.stringify(WORKBOOK_ID)};
          gapi.load('picker',()=>{const view=new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setIncludeFolders(false).setSelectFolderEnabled(false);new google.picker.PickerBuilder().setAppId(${JSON.stringify(PROJECT_NUMBER)}).setOAuthToken(token).setDeveloperKey(key).addView(view).setSelectableMimeTypes('application/vnd.google-apps.spreadsheet').setCallback(async data=>{if(data.action===google.picker.Action.PICKED){const id=data.docs&&data.docs[0]&&data.docs[0].id;if(id!==expected){document.getElementById('status').textContent='Archivo incorrecto. Selecciona únicamente SutiApp Final.';return;}const response=await fetch('/picker-selection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce,id})});document.getElementById('status').textContent=response.ok?'Archivo autorizado. Puedes cerrar esta ventana y volver a Codex.':'No se pudo validar la selección.';}}).build().setVisible(true);});</script>`;
          res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(pickerHtml);return;
        }
        if(requestUrl.pathname==='/picker-selection'&&req.method==='POST'){
          let raw='';for await(const chunk of req)raw+=chunk;if(raw.length>2048)throw new Error('PICKER_PAYLOAD_TOO_LARGE');
          const body=JSON.parse(raw);if(body.nonce!==pickerNonce||body.id!==WORKBOOK_ID||!supportToken)throw new Error('INVALID_PICKER_SELECTION');
          res.writeHead(204,{'Cache-Control':'no-store'}).end();callbackResolve(supportToken);return;
        }
        res.writeHead(404).end();
      }catch(error){res.writeHead(400,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Solicitud inválida');callbackReject(error);}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const port=server.address().port,redirectUri='http://127.0.0.1:'+port+'/oauth2callback';
    const authUrl=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.search=new URLSearchParams({client_id:oauth.client_id,redirect_uri:redirectUri,response_type:'code',scope:DRIVE_FILE_SCOPE,access_type:'offline',prompt:'consent select_account',include_granted_scopes:'false',login_hint:EXPECTED_EMAIL,state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
    publish({status:'OAUTH_PICKER_REQUIRED',account:EXPECTED_EMAIL,scope:DRIVE_FILE_SCOPE,authorizationUrl:authUrl.toString(),apiKeyTemporary:true,secretsStored:false});
    const timeout=setTimeout(()=>callbackReject(new Error('OAUTH_PICKER_TIMEOUT')),600000);
    let token;try{token=await selected;}finally{clearTimeout(timeout);server.close();}
    const sheetResponse=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+WORKBOOK_ID+'/values/'+encodeURIComponent('Criterios de fondos!A1:P1'),{headers:{Authorization:'Bearer '+token.access_token}});
    if(sheetResponse.status!==200)throw new Error('PICKER_SHEETS_READ_'+sheetResponse.status);
    const secrets=[{name:'GOOGLE_VISIBILITY_OAUTH_CLIENT_ID',value:oauth.client_id},{name:'GOOGLE_VISIBILITY_OAUTH_CLIENT_SECRET',value:oauth.client_secret},{name:'GOOGLE_VISIBILITY_OAUTH_REFRESH_TOKEN',value:token.refresh_token}];
    const secretResponse=await fetch('https://api.supabase.com/v1/projects/'+projectRef+'/secrets',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-FinancialVisibilityPicker/1.0'},body:JSON.stringify(secrets)});
    if(secretResponse.status!==201)throw new Error('SUPABASE_SECRET_WRITE_'+secretResponse.status);
    fs.unlinkSync(oauthClientPath);
    publish({status:'PASS',account:EXPECTED_EMAIL,scope:DRIVE_FILE_SCOPE,selectedWorkbook:WORKBOOK_ID,sheetsRead:200,secretsConfigured:secrets.map(item=>item.name),oauthClientFileRemoved:true,tokenLogged:false,googleDataWrite:false});
  }finally{
    if(keyName){const response=await fetch('https://apikeys.googleapis.com/v2/'+keyName,{method:'DELETE',headers:adminHeaders});if(response.ok){const body=await response.json();if(body.name)await operation(adminHeaders,body.name);}}
  }
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message,tokenLogged:false,googleDataWrite:false}));process.exit(1);});
