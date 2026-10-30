'use strict';
// Read-only diagnosis/verification of the existing controlled administrative session.
const fs=require('fs'),{env}=require('./release-cash-flow.js');
async function main(){
 const base=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY;
 const login=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});
 if(!login.ok)throw Error('CONTROLLED_LOGIN_FAILED');const token=(await login.json()).access_token;
 const route=process.argv.includes('--savings')?'/rest/v1/rpc/get_admin_reports_jc_cash_flow':'/functions/v1/reports-jc',body=process.argv.includes('--savings')?{p_from:'2026-01-01'}:{action:'CASH_FLOW',from:'2026-01'},started=Date.now();
 const response=await fetch(base+route,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)}),data=await response.json();
 if(!response.ok){fs.writeFileSync('.tmp/cash-flow-criteria/http-error.json',JSON.stringify(data,null,2));console.log(JSON.stringify({status:'FAIL',http:response.status,error:data.error||data.code,durationMs:Date.now()-started,privateErrorSaved:true}));process.exitCode=1;return;}
 console.log(JSON.stringify({status:'PASS',http:response.status,durationMs:Date.now()-started,rows:data.data?.rows?.length,records:data.data?.records?.length,events:data.events?.length,coverage:data.data?.coverage,financialWrites:0}));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.name}));process.exitCode=1;});
