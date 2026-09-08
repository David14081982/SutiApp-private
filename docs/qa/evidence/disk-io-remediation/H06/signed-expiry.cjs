'use strict';
const a=require('./audit.cjs'),{env}=a;
async function main(){
 const e=env(),headers={apikey:e.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
 let token;
 try{
  const login=await fetch(e.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email:e.H005_TEST_EMAIL,password:e.H005_TEST_PASSWORD})});
  if(!login.ok)throw Error('LOGIN_HTTP_'+login.status);
  token=(await login.json()).access_token;
  const rows=await a.query(`select storage_path from public.affiliate_files where affiliate_id='${e.H005_TEST_AFFILIATE_ID.replace(/[^a-f0-9-]/gi,'')}'::uuid and file_key='profile_photo' and status='READY' and classification='PRIVATE' limit 1`);
  if(!rows.length)throw Error('LEGITIMATE_PHOTO_MISSING');
  const object=rows[0].storage_path.split('/').map(encodeURIComponent).join('/');
  const sign=await fetch(e.SUPABASE_URL+'/storage/v1/object/sign/private-assets/'+object,{method:'POST',headers:{...headers,Authorization:'Bearer '+token},body:JSON.stringify({expiresIn:2})});
  if(!sign.ok)throw Error('SIGN_HTTP_'+sign.status);
  const url=e.SUPABASE_URL+'/storage/v1'+(await sign.json()).signedURL;
  const first=await fetch(url,{headers:{'Cache-Control':'no-cache'}});await first.arrayBuffer();
  await new Promise(r=>setTimeout(r,4000));
  const expired=await fetch(url,{headers:{'Cache-Control':'no-cache'}});const body=await expired.json().catch(()=>({}));
  if(first.status!==200||expired.ok||!/(expir|invalidjwt|invalid.*token)/i.test(JSON.stringify(body)))throw Error('SIGNED_EXPIRY_CONTRACT_FAILED_'+first.status+'_'+expired.status+'_'+String(body.error||body.code||'UNKNOWN').replace(/[^a-z0-9_ -]/gi,'').slice(0,80));
  a.save('signed-expiry-'+(process.argv[2]||'h06'),{at:new Date().toISOString(),status:'PASS',initial_http:first.status,expired_http:expired.status,expired_token_rejected:true,error_code:String(body.error||body.code||'').replace(/[^a-z0-9_ -]/gi,'').slice(0,80),ttl_seconds:2,urls_logged:0});
  console.log('Signed URL initial/expired: PASS');
 }finally{if(token)await fetch(e.SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{...headers,Authorization:'Bearer '+token}});}
}
main().catch(e=>{console.error(e.message.replace(/https?:\/\/\S+/g,'[redacted-url]'));process.exitCode=1;});
