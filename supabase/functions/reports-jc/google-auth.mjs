// Explicitly authorized reader for Reportes JC. Server only; no credential fallback.
export const READER_EMAIL='sutifinanzas-reader@sutifinanzas-reportes.iam.gserviceaccount.com';
export const READER_PROJECT='sutifinanzas-reportes';
export const READER_SECRET='SUTIFINANZAS_GOOGLE_SERVICE_ACCOUNT_JSON';
export const TOKEN_ENDPOINT='https://oauth2.googleapis.com/token';
export const READ_ONLY_SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';

export async function createReadOnlyAssertion(env,clock=()=>Date.now()){
  try{
    const account=JSON.parse(env(READER_SECRET)||'null');
    if(account?.type!=='service_account'||account.client_email!==READER_EMAIL||account.project_id!==READER_PROJECT||
      typeof account.private_key!=='string'||!account.private_key.startsWith('-----BEGIN PRIVATE KEY-----'))throw Error();
    const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const text=value=>encode(new TextEncoder().encode(JSON.stringify(value)));
    const now=Math.floor(clock()/1000);
    const unsigned=text({alg:'RS256',typ:'JWT'})+'.'+text({iss:READER_EMAIL,scope:READ_ONLY_SCOPE,aud:TOKEN_ENDPOINT,iat:now,exp:now+900});
    const der=Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'')),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
    return unsigned+'.'+encode(new Uint8Array(signature));
  }catch(_){throw Error('GOOGLE_NOT_CONFIGURED');}
}
