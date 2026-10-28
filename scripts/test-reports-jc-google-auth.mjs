// Isolated cryptographic fixtures only. No real credentials or network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,verify,webcrypto} from 'node:crypto';
import {createReadOnlyAssertion,READER_EMAIL,READER_PROJECT,READER_SECRET,TOKEN_ENDPOINT,READ_ONLY_SCOPE} from '../supabase/functions/reports-jc/google-auth.mjs';
import {readGoogle,WORKBOOK,GOOGLE_RANGES} from '../supabase/functions/reports-jc/report.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const receiptPath=path.join(root,'.tmp/reports-jc/google-auth-tests.json');
const passed=[];let phase='setup',networkCalls=0,mockedHttpCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{networkCalls++;throw Error('NETWORK_FORBIDDEN_IN_ISOLATED_TEST');};
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const record=async(name,run)=>{phase=name;await run();passed.push(name);};
const persist=value=>{fs.mkdirSync(path.dirname(receiptPath),{recursive:true});fs.writeFileSync(receiptPath,JSON.stringify(value,null,2)+'\n');};

try{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const account={type:'service_account',client_email:READER_EMAIL,project_id:READER_PROJECT,private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 const fixedMilliseconds=1793137200123,expectedSeconds=Math.floor(fixedMilliseconds/1000);
 const requested=[];
 const env=name=>{requested.push(name);assert.equal(name,READER_SECRET,'Only the explicitly authorized secret may be read');return JSON.stringify(account);};
 const assertion=await createReadOnlyAssertion(env,()=>fixedMilliseconds);
 const parts=assertion.split('.');
 let header,claims;
 await record('valid_compact_jwt_and_fixed_claims',async()=>{
  assert.equal(parts.length,3);
  assert(parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)),'JWT must use unpadded base64url');
  header=JSON.parse(Buffer.from(parts[0],'base64url'));
  claims=JSON.parse(Buffer.from(parts[1],'base64url'));
  assert.deepEqual(header,{alg:'RS256',typ:'JWT'});
  assert.deepEqual(claims,{iss:'sutifinanzas-reader@sutifinanzas-reportes.iam.gserviceaccount.com',scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:expectedSeconds,exp:expectedSeconds+900});
  assert.equal(READER_PROJECT,'sutifinanzas-reportes');
  assert.equal(READER_SECRET,'SUTIFINANZAS_GOOGLE_SERVICE_ACCOUNT_JSON');
  assert.equal(claims.exp-claims.iat,900);
  assert.deepEqual(claims.scope.split(/\s+/),[READ_ONLY_SCOPE]);
  assert(!('sub' in claims)&&!('prn' in claims),'No domain-wide user delegation');
  assert.deepEqual(requested,[READER_SECRET]);
 });
 await record('signature_verified_independently_and_tamper_rejected',async()=>{
  const signed=Buffer.from(parts[0]+'.'+parts[1]);
  const signature=Buffer.from(parts[2],'base64url');
  assert.equal(verify('RSA-SHA256',signed,publicKey,signature),true);
  const altered=Buffer.from(JSON.stringify({...claims,scope:'https://www.googleapis.com/auth/spreadsheets'})).toString('base64url');
  assert.equal(verify('RSA-SHA256',Buffer.from(parts[0]+'.'+altered),publicKey,signature),false);
  const broken=Buffer.from(signature);broken[0]^=1;
  assert.equal(verify('RSA-SHA256',signed,publicKey,broken),false);
 });
 await record('account_metadata_cannot_change_endpoint_scope_or_delegate',async()=>{
  const untrusted={...account,token_uri:'https://invalid.test/token',scope:'https://www.googleapis.com/auth/drive',sub:'synthetic-delegate',subject:'synthetic-delegate'};
  const result=await createReadOnlyAssertion(()=>JSON.stringify(untrusted),()=>fixedMilliseconds);
  const payload=JSON.parse(Buffer.from(result.split('.')[1],'base64url'));
  assert.deepEqual(payload,claims);
  assert.equal(payload.aud,TOKEN_ENDPOINT);
 });
 await record('mismatched_account_project_and_type_rejected',async()=>{
  for(const change of [
   {client_email:'unapproved-reader@synthetic-project.iam.gserviceaccount.com'},
   {client_email:READER_EMAIL.toUpperCase()},
   {project_id:'synthetic-other-project'},
   {type:'authorized_user'},
   {client_email:null},
   {project_id:null}
  ])await assert.rejects(createReadOnlyAssertion(()=>JSON.stringify({...account,...change}),()=>fixedMilliseconds),{message:'GOOGLE_NOT_CONFIGURED'});
 });
 await record('missing_malformed_or_unusable_private_key_rejected',async()=>{
  for(const key of [undefined,null,'',123,'not a key','-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----','-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----','-----BEGIN PRIVATE KEY-----\n!!!!\n-----END PRIVATE KEY-----']){
   await assert.rejects(createReadOnlyAssertion(()=>JSON.stringify({...account,private_key:key}),()=>fixedMilliseconds),{message:'GOOGLE_NOT_CONFIGURED'});
  }
 });
 await record('missing_or_malformed_configuration_fails_without_fallback',async()=>{
  for(const value of [undefined,'',' ','{','null','[]','{}']){
   const reads=[];
   await assert.rejects(createReadOnlyAssertion(name=>{reads.push(name);return value;},()=>fixedMilliseconds),{message:'GOOGLE_NOT_CONFIGURED'});
   assert.deepEqual(reads,[READER_SECRET]);
  }
  await assert.rejects(createReadOnlyAssertion(()=>{throw Error('synthetic_env_failure');},()=>fixedMilliseconds),{message:'GOOGLE_NOT_CONFIGURED'});
 });
 await record('secret_and_key_material_absent_from_frontend',async()=>{
  for(const file of ['app/reports-jc-admin.jsx','app/reports-jc-repository.js','app/reports-jc-export.js','app/bundle.js']){
   const code=fs.readFileSync(path.join(root,file),'utf8');
   assert(!code.includes(READER_SECRET),'Frontend must not access the server credential');
   assert(!code.includes(account.private_key),'Ephemeral fixture key must remain in memory');
  }
  const authSource=fs.readFileSync(path.join(root,'supabase/functions/reports-jc/google-auth.mjs'),'utf8');
  assert(!/GOOGLE_REQUEST_SYNC|refresh_token/.test(authSource),'No old OAuth credential fallback');
  const readerSource=fs.readFileSync(path.join(root,'supabase/functions/reports-jc/report.mjs'),'utf8');
  assert(!/GOOGLE_REQUEST_SYNC|refresh_token/.test(readerSource),'Reader cannot fall back to human OAuth credentials');
 });
 await record('reader_uses_signed_assertion_and_exact_readonly_source',async()=>{
  const reads=[],calls=[];
  const source=await readGoogle(name=>{reads.push(name);return JSON.stringify(account);},async(url,options)=>{
   mockedHttpCalls++;calls.push({url,options});
   if(calls.length===1){
    assert.equal(url,'https://oauth2.googleapis.com/token');
    assert.equal(options.method,'POST');
    assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded');
    const form=new URLSearchParams(options.body);
    assert.deepEqual([...form.keys()].sort(),['assertion','grant_type']);
    assert.equal(form.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');
    const tokenParts=form.get('assertion').split('.');
    const payload=JSON.parse(Buffer.from(tokenParts[1],'base64url'));
    assert.equal(payload.iss,READER_EMAIL);assert.equal(payload.aud,TOKEN_ENDPOINT);
    assert.equal(payload.scope,READ_ONLY_SCOPE);assert.equal(payload.exp-payload.iat,900);
    assert(!('sub' in payload)&&!('prn' in payload));
    assert.equal(verify('RSA-SHA256',Buffer.from(tokenParts[0]+'.'+tokenParts[1]),publicKey,Buffer.from(tokenParts[2],'base64url')),true);
    return {ok:true,json:async()=>({access_token:'isolated-access-token'})};
   }
   assert.equal(calls.length,2,'Only a token exchange and one source GET are allowed');
   const query=new URL(url);
   assert.equal(WORKBOOK,'1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80');
   assert.equal(query.origin,'https://sheets.googleapis.com');
   assert.equal(query.pathname,'/v4/spreadsheets/'+WORKBOOK+'/values:batchGet');
   assert.equal(options.method,'GET');assert.equal(options.body,undefined);
   assert.deepEqual(options.headers,{Authorization:'Bearer isolated-access-token'});
   const ranges=["'Historial de solicitudes'!A:B","'Historial de solicitudes'!E:E","'Historial de solicitudes'!J:J","'Historial de solicitudes'!Y:Z","'HISTORIAL P V2'!A:D","'HISTORIAL P V2'!F:G"];
   assert.deepEqual(GOOGLE_RANGES,ranges);assert.deepEqual(query.searchParams.getAll('ranges'),ranges);
   assert.deepEqual([...new Set(query.searchParams.keys())].sort(),['dateTimeRenderOption','ranges','valueRenderOption']);
   assert.equal(query.searchParams.get('valueRenderOption'),'UNFORMATTED_VALUE');
   assert.equal(query.searchParams.get('dateTimeRenderOption'),'SERIAL_NUMBER');
   return {ok:true,json:async()=>({spreadsheetId:WORKBOOK,valueRanges:ranges.map(()=>({values:[]}))})};
  });
  assert.deepEqual(source,{requests:[],loans:[]});
  assert.deepEqual(reads,[READER_SECRET]);assert.equal(calls.length,2);
 });
 await record('token_and_sheet_access_denials_never_try_fallback',async()=>{
  for(const rejectedStage of ['token','sheet']){
   const reads=[],calls=[];
   await assert.rejects(readGoogle(name=>{reads.push(name);return JSON.stringify(account);},async(url,options)=>{
    mockedHttpCalls++;calls.push({url,method:options.method});
    if(rejectedStage==='sheet'&&calls.length===1)return {ok:true,json:async()=>({access_token:'isolated-access-token'})};
    return {ok:false,status:403,json:async()=>({error:{status:'PERMISSION_DENIED'}})};
   }),{message:rejectedStage==='token'?'GOOGLE_AUTH_FAILED':'GOOGLE_ACCESS_DENIED'});
   assert.deepEqual(reads,[READER_SECRET]);
   assert.equal(calls.length,rejectedStage==='token'?1:2);
   assert.equal(calls[0].url,TOKEN_ENDPOINT);
  }
 });
 await record('wrong_identity_or_human_oauth_rejected_before_network',async()=>{
  for(const config of [{...account,client_email:'unapproved-reader@synthetic-project.iam.gserviceaccount.com'},{...account,project_id:'synthetic-other-project'},{type:'authorized_user',refresh_token:'synthetic-not-a-service-account'}]){
   let attempts=0;const reads=[];
   await assert.rejects(readGoogle(name=>{reads.push(name);return JSON.stringify(config);},async()=>{attempts++;throw Error('SHOULD_NOT_FETCH');}),{message:'GOOGLE_NOT_CONFIGURED'});
   assert.equal(attempts,0);assert.deepEqual(reads,[READER_SECRET]);
  }
  let attempts=0;const reads=[];
  const humanOnly={GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID:'synthetic-client',GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET:'synthetic-secret',GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN:'synthetic-refresh'};
  await assert.rejects(readGoogle(name=>{reads.push(name);return humanOnly[name];},async()=>{attempts++;throw Error('SHOULD_NOT_FETCH');}),{message:'GOOGLE_NOT_CONFIGURED'});
  assert.equal(attempts,0);assert.deepEqual(reads,[READER_SECRET]);
 });
 await record('no_network_or_real_credential_access',async()=>assert.equal(networkCalls,0));
 const result={status:'PASS',isolated:true,ephemeralRsaBits:2048,signatureAlgorithm:'RS256',readonlyScope:true,ttlSeconds:900,noDelegation:true,exactReaderAndProject:true,fixedWorkbookAndSixReadRanges:true,noCredentialFallback:true,mockedHttpCalls,networkCalls,realCredentialReads:0,tests:passed};
 persist(result);console.log(JSON.stringify(result));
}catch(error){
 const result={status:'FAIL',isolated:true,phase,errorType:error?.name||'Error',networkCalls,realCredentialReads:0,tests:passed};
 persist(result);console.error(JSON.stringify(result));process.exitCode=1;
}finally{
 globalThis.fetch=originalFetch;
}
