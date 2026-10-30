'use strict';
// Existing controlled login and read-only financial HTTP calls. No data mutation.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {env,root}=require('./release-cash-flow.js');
const out=path.join(root,'docs/qa/evidence/cash-flow-consolidated');
async function verify(){
 const proof={status:'RUNNING',checkedAt:new Date().toISOString(),financialWrites:0,googleWrites:0,triggerChanges:0,persistedSourceRows:0,checks:[],reports:[]};
 const key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY,base=env.SUPABASE_URL.replace(/\/$/,''),endpoint='/functions/v1/reports-jc';
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),get=t=>p.find(x=>x.type===t).value,asOf=get('year')+'-'+get('month')+'-'+get('day');
 async function request(route,body,token){const started=Date.now(),headers={apikey:key,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
  const response=await fetch(base+route,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(120000)}),raw=await response.text();let data;try{data=JSON.parse(raw);}catch{throw Error('HTTP_NON_JSON_'+response.status);}return {status:response.status,data,bytes:Buffer.byteLength(raw),durationMs:Date.now()-started};}
 try{
  const auth=await request('/auth/v1/token?grant_type=password',{email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD});assert.equal(auth.status,200,'CONTROLLED_LOGIN');const token=auth.data.access_token,actor=auth.data.user.id;
  const rpcs=[['get_admin_reports_jc_cash_flow_investors',{p_from:asOf.slice(0,7)+'-01'}],['get_admin_reports_jc_cash_flow_contracts',{}]];
  for(const [name,params] of rpcs){const denied=await request('/rest/v1/rpc/'+name,params);assert([401,403].includes(denied.status),'ANON_RPC_DENIED');proof.checks.push({name:name+'_anonymous_denied',status:'PASS'});}
  const invalid=await request(endpoint,{action:'CASH_FLOW',from:asOf.slice(0,7)},'invalid');assert([401,403].includes(invalid.status));
  for(const from of [...new Set([asOf.slice(0,4)+'-01',asOf.slice(0,7)])]){
   const r=await request(endpoint,{action:'CASH_FLOW',from},token);assert.equal(r.status,200,'CASH_FLOW_HTTP_'+r.status);const {context,data}=r.data;assert.equal(context.actor,actor);assert.equal(data.from,from);assert.equal(data.asOf,asOf);assert.equal(data.months.length,12);
   assert(data.rows.length>=100);assert(data.rows.every(r=>r.cells.length===12));assert.equal(data.coverage.financialWrites,0);assert.equal(data.coverage.amortizationEngineActive,false);assert.equal(data.coverage.loanCount,1668);assert.equal(data.coverage.determinedLoans+data.coverage.protectedLoans,1668);
   const records=new Map(data.records.map(r=>[r.id,r]));assert.equal(records.size,data.records.length);for(const record of records.values())if(record.parentRecordId){const parent=records.get(record.parentRecordId);assert(parent&&!parent.parentRecordId);}
   let verifiedTotals=0,verifiedCuotas=0;
   for(const row of data.rows)for(const cell of row.cells){assert(cell.amount===null||Number.isFinite(cell.amount));if(row.emphasis&&cell.sourceIds.length){let sum=0;for(const id of cell.sourceIds){const record=records.get(id);if(record?.amount!=null)sum+=Math.round(record.amount*100)*(cell.sourceSigns?.[id]??1);}assert.equal(sum,Math.round((cell.knownAmount||0)*100),'TOTAL_DETAIL_'+row.id);verifiedTotals++;}}
   for(const record of records.values())if(/^pv2:\d+$/.test(record.id)){assert.equal(record.status,record.date<=asOf?'RECORDED':'SCHEDULED');if(record.principal!==null){assert.equal(Math.round(record.amount*100),Math.round(record.principal*100)+Math.round(record.interest*100)+Math.round(record.administration*100));verifiedCuotas++;}}
   const ids=data.rows.map(r=>r.id);for(const id of ['contribution','contribution_mixed','withdrawal_partial','withdrawal_total','withdrawal_unspecified','yield_credited','adjustment','savings_balance','contribution_scheduled','withdrawal_pending','loan_placed','loan_recovered','loan_principal','loan_interest','loan_admin','loan_pending','loan_scheduled'])assert(ids.includes(id));
   assert(data.rows.find(r=>r.id==='cash_available').cells.every(c=>c.amount===null));
   proof.reports.push({status:'PASS',from,http:r.status,durationMs:r.durationMs,payloadBytes:r.bytes,rows:data.rows.length,records:data.records.length,coverage:data.coverage,verifiedTotals,verifiedCuotas,groups:[...new Set(data.rows.map(r=>r.group))]});
  }
  for(const [name,params]of rpcs){const r=await request('/rest/v1/rpc/'+name,params,token);assert.equal(r.status,200);proof.checks.push({name:name+'_admin_read',status:'PASS',durationMs:r.durationMs});}
  const load=await request(endpoint,{action:'LOAD',year:Number(asOf.slice(0,4))},token);assert.equal(load.status,200);assert.equal(load.data.context.actor,actor);assert(load.data.data.sheets);proof.checks.push({name:'existing_LOAD_preserved',status:'PASS'});
  const template=await request(endpoint,{action:'TEMPLATE'},token);assert.equal(template.status,200);assert.equal(crypto.createHash('sha256').update(Buffer.from(template.data.data.base64,'base64')).digest('hex'),template.data.data.sha256);proof.checks.push({name:'existing_TEMPLATE_preserved',status:'PASS'});
  const strict=await request(endpoint,{action:'CASH_FLOW',from:asOf.slice(0,7),unexpected:true},token);assert.equal(strict.status,400);assert.equal(strict.data.error,'REQUEST_INVALID');proof.checks.push({name:'strict_payload',status:'PASS'});
  proof.checks.push({name:'ordinary_user_live',status:'NOT TESTED',reason:'No explicit existing ordinary user credentials; SQL isolated denial covered.'});proof.status='PASS';
 }catch(e){proof.status='FAIL';proof.error=e.code==='ERR_ASSERTION'?e.message.split('\n')[0]:/^[A-Z0-9_]+$/.test(e.message)?e.message:'HTTP_VERIFICATION_FAILED';}
 fs.writeFileSync(path.join(out,'production-http.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));return proof;
}
if(require.main===module){if(process.argv.includes('--live'))verify().then(p=>{if(p.status!=='PASS')process.exitCode=1;});else console.log(JSON.stringify({mode:'READ_ONLY_PLAN',financialWrites:0}));}
module.exports={verify};
