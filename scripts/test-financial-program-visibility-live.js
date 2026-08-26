'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function request(url,options={}){const response=await fetch(url,options),text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{ok:response.ok,status:response.status,data};}
async function login(v,email,password){return request(v.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});}
function headers(v,token){return{apikey:v.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'};}
async function edge(v,token,name,body){return request(v.SUPABASE_URL+'/functions/v1/'+name,{method:'POST',headers:headers(v,token),body:JSON.stringify(body)});}

(async()=>{
  const v=env();
  const admin=await login(v,v.H005_TEST_EMAIL,v.H005_TEST_PASSWORD);
  const user=await login(v,v.H005_TEST2_EMAIL,v.H005_TEST2_PASSWORD);
  assert(admin.ok&&user.ok,'test login failed');
  const catalog=await edge(v,admin.data.access_token,'financial-legacy',{action:'catalog'});
  assert.equal(catalog.status,200,JSON.stringify(catalog.data));
  const rules=catalog.data.data.rules;
  assert(Array.isArray(rules)&&rules.length>0,'empty criteria catalog');
  assert(rules.every(rule=>Number.isInteger(rule.sheet_row)&&rule.sheet_row>=2),'missing sheet identity');
  assert(rules.every(rule=>new RegExp('^CRITERIA_V1:'+rule.sheet_row+':[a-f0-9]{64}$','i').test(rule.criterion_identity)),JSON.stringify({error:'missing criterion identity/fingerprint',keys:Object.keys(rules[0]||{}),identityType:typeof(rules[0]||{}).criterion_identity,identityPrefix:String((rules[0]||{}).criterion_identity||'').slice(0,24)}));
  assert(rules.every(rule=>['AUTO','MOSTRAR','OCULTAR'].includes(rule.visibility_mode)),'invalid visibility mode');
  assert(rules.every(rule=>['VISIBLE','HIDDEN'].includes(rule.automatic_visibility)&&['VISIBLE','HIDDEN'].includes(rule.effective_visibility)),'invalid visibility evaluation');
  assert(rules.every(rule=>rule.status!=='AVAILABLE'||rule.effective_visibility==='VISIBLE'),'available rule hidden');
  assert(rules.every(rule=>rule.status!=='SCHEDULED'||rule.effective_visibility==='HIDDEN'),'scheduled rule visible');
  const overview=await edge(v,admin.data.access_token,'financial-legacy',{action:'overview'});
  assert.equal(overview.status,200,JSON.stringify(overview.data));
  assert(overview.data.data.programs.every(rule=>rule.status==='AVAILABLE'),'overview leaked hidden/scheduled program');
  assert((overview.data.data.scheduled_funds||[]).every(rule=>rule.status==='SCHEDULED'),'scheduled diagnostics invalid');
  const denied=await edge(v,user.data.access_token,'financial-criteria-admin',{action:'initialize'});
  assert.equal(denied.status,403,'ordinary user reached criteria writer');
  const anonymous=await request(v.SUPABASE_URL+'/functions/v1/financial-criteria-admin',{method:'POST',headers:{apikey:v.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:'initialize'})});
  assert([401,403].includes(anonymous.status),'anonymous caller reached criteria writer');
  const dry=await edge(v,admin.data.access_token,'financial-criteria-admin',{action:'setVisibility',criterion_identity:'CRITERIA_V1:2:'+'F'.repeat(64),visibility_mode:'MOSTRAR',reason:'Prueba seca de autenticación y fingerprint'});
  assert.equal(dry.status,409,JSON.stringify(dry.data));
  assert.equal(dry.data.error,'CRITERION_FINGERPRINT_MISMATCH',JSON.stringify(dry.data));
  console.log(JSON.stringify({status:'PASS',rules:rules.length,available:rules.filter(rule=>rule.status==='AVAILABLE').length,scheduled:rules.filter(rule=>rule.status==='SCHEDULED').length,hidden:rules.filter(rule=>rule.status==='UNAVAILABLE').length,overviewPrograms:overview.data.data.programs.length,ordinaryUserDenied:true,anonymousDenied:true,dryFingerprintDenied:true,googleWrites:0}));
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exit(1);});
