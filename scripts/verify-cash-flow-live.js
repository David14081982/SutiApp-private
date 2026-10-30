'use strict';
// Read-only HTTP verification of the deployed report. The only stateful operation
// is signing in with an existing controlled account; no users, roles or finance writes.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {env,out}=require('./release-cash-flow.js');
const requireTrue=(condition,code)=>{if(!condition)throw Error(code);};
const group=(values,key)=>values.reduce((result,value)=>{const name=String(value[key]??'UNKNOWN');result[name]=(result[name]||0)+1;return result;},{});
function today(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v=type=>parts.find(p=>p.type===type).value;return `${v('year')}-${v('month')}-${v('day')}`;}

async function verify(){
 const asOf=today(),year=Number(asOf.slice(0,4)),froms=[...new Set([asOf.slice(0,4)+'-01',asOf.slice(0,7)])];
 const evidence={status:'RUNNING',checkedAt:new Date().toISOString(),scope:'PRODUCTION_AUTHENTICATED_READ_ONLY_HTTP',financialWrites:0,googleWrites:0,triggerChanges:0,persistedSourceRows:0,credentialsPersisted:false,checks:[],reports:[]};
 const key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY,base=env.SUPABASE_URL.replace(/\/$/,'');
 async function request(endpoint,body,token){
  const headers={apikey:key,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
  const started=Date.now(),response=await fetch(base+endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
  let data;try{data=await response.json();}catch(_){throw Error('HTTP_JSON_INVALID');}
  return {status:response.status,data,durationMs:Date.now()-started};
 }
 async function login(email,password){
  requireTrue(typeof email==='string'&&typeof password==='string'&&key,'CONTROLLED_LOGIN_UNAVAILABLE');
  const r=await request('/auth/v1/token?grant_type=password',{email,password});
  requireTrue(r.status===200&&typeof r.data.access_token==='string'&&r.data.user?.id,'CONTROLLED_LOGIN_FAILED');
  return {token:r.data.access_token,actor:r.data.user.id};
 }
 const endpoint='/functions/v1/reports-jc',rpc='/rest/v1/rpc/get_admin_reports_jc_cash_flow';
 try{
  const admin=await login(env.H005_TEST_EMAIL,env.H005_TEST_PASSWORD);
  evidence.checks.push({name:'existing_controlled_admin_login',status:'PASS'});
  const denied=await Promise.all([
   request(endpoint,{action:'CASH_FLOW',from:asOf.slice(0,7)}),
   request(rpc,{p_from:asOf.slice(0,7)+'-01'}),
   request(endpoint,{action:'CASH_FLOW',from:asOf.slice(0,7)},'not-a-valid-session')
  ]);
  for(const [i,result] of denied.entries()){
   requireTrue([401,403].includes(result.status),'ANONYMOUS_ACCESS_NOT_DENIED');
   evidence.checks.push({name:['edge_missing_authorization_denied','rpc_anonymous_denied','edge_invalid_session_denied'][i],status:'PASS',http:result.status});
  }
  const responses=await Promise.all(froms.map(from=>request(endpoint,{action:'CASH_FLOW',from},admin.token)));
  let currentReport;
  for(const [i,response] of responses.entries()){
   requireTrue(response.status===200,'CASH_FLOW_HTTP_'+response.status);
   const {context,data}=response.data;requireTrue(context?.actor===admin.actor&&data?.from===froms[i],'REPORT_ACTOR_OR_RANGE_MISMATCH');
   requireTrue(data.months?.length===12&&data.rows?.length===17&&data.rows.every(row=>row.cells?.length===12),'REPORT_MATRIX_INVALID');
   requireTrue(data.coverage?.financialWrites===0&&data.coverage.amortizationEngineActive===false,'REPORT_FINANCIAL_WRITE_CONTRACT');
   requireTrue(data.coverage.savingsAuthority==='SUPABASE'&&data.coverage.loanAuthority==='GOOGLE_HISTORIAL_P_V2','REPORT_AUTHORITY_MISMATCH');
   requireTrue(data.rows.every(row=>['Ahorro Voluntario','Caja de Ahorro'].includes(row.group)),'REPORT_PROGRAM_SCOPE_INVALID');
   const row=id=>data.rows.find(value=>value.id===id),current=data.months.findIndex(m=>m.key===asOf.slice(0,7));
   if(current>=0)requireTrue(Number.isFinite(row('savings_balance')?.cells[current].amount),'CURRENT_BALANCE_UNAVAILABLE');
   for(let column=0;column<12;column++)if((row('loan_recovered')?.cells[column].knownAmount??0)>0){
    for(const component of ['loan_principal','loan_interest','loan_admin'])requireTrue(row(component)?.cells[column].amount===null,'LOAN_BREAKDOWN_INVENTED');
   }
   if(data.coverage.loanCount>0)requireTrue(row('loan_pending').cells.every(cell=>cell.amount===null),'LOAN_PRINCIPAL_PENDING_INVENTED');
   evidence.reports.push({from:froms[i],status:'PASS',http:response.status,durationMs:response.durationMs,months:data.months.map(m=>m.key),rows:data.rows.length,
    loanCount:data.coverage.loanCount,sourceRecords:data.records?.length,unassigned:data.unassigned?.length,
    cellsByStatus:group(data.rows.flatMap(row=>row.cells),'status'),issueCodes:[...new Set(data.issues.map(issue=>issue.code))],
    currentBalanceKnown:current>=0,uncertifiedLoanBreakdownProtected:true,actorMatches:true});
   if(froms[i]===asOf.slice(0,7))currentReport=data;
  }
  const direct=await request(rpc,{p_from:asOf.slice(0,7)+'-01'},admin.token);
  requireTrue(direct.status===200&&direct.data.events&&direct.data.balances?.length===12,'ADMIN_RPC_READ_FAILED');
  const actual=direct.data.balances.find(row=>row.month.slice(0,7)===asOf.slice(0,7));
  requireTrue(actual&&Number.isFinite(actual.amount)&&actual.unknown_count===0,'ADMIN_RPC_CURRENT_BALANCE_UNAVAILABLE');
  const edgeCurrent=currentReport.rows.find(row=>row.id==='savings_balance').cells[0];
  requireTrue(edgeCurrent.amount===actual.amount,'RPC_EDGE_CURRENT_BALANCE_MISMATCH');
  evidence.checks.push({name:'authenticated_admin_rpc',status:'PASS',http:direct.status,durationMs:direct.durationMs,events:direct.data.events.length,months:direct.data.balances.length,currentBalanceMatchesEdge:true});
  const compatible=await Promise.all([
   request(endpoint,{action:'LOAD',year},admin.token),request(endpoint,{action:'TEMPLATE'},admin.token),
   request(endpoint,{action:'CASH_FLOW',from:asOf.slice(0,7),unexpected:true},admin.token),
   request(endpoint,{action:'LOAD',year,unexpected:true},admin.token)
  ]);
  const existing=compatible[0];requireTrue(existing.status===200&&existing.data.context?.actor===admin.actor&&existing.data.data?.year===year&&existing.data.data.sheets,'EXISTING_LOAD_COMPATIBILITY_FAILED');
  evidence.checks.push({name:'existing_reports_jc_LOAD',status:'PASS',http:existing.status,durationMs:existing.durationMs,sheets:Object.keys(existing.data.data.sheets).length,sourceRecords:existing.data.data.records?.length});
  const template=compatible[1];requireTrue(template.status===200&&template.data.context?.actor===admin.actor&&typeof template.data.data?.base64==='string','EXISTING_TEMPLATE_COMPATIBILITY_FAILED');
  const bytes=Buffer.from(template.data.data.base64,'base64');requireTrue(crypto.createHash('sha256').update(bytes).digest('hex')===template.data.data.sha256,'EXISTING_TEMPLATE_HASH_MISMATCH');
  evidence.checks.push({name:'existing_reports_jc_TEMPLATE',status:'PASS',http:template.status,templateBytes:bytes.length,sha256Matches:true});
  for(const [i,r] of compatible.slice(2).entries()){requireTrue(r.status===400&&r.data.error==='REQUEST_INVALID','STRICT_REQUEST_SCHEMA_FAILED');evidence.checks.push({name:i?'existing_LOAD_strict_schema':'CASH_FLOW_strict_schema',status:'PASS',http:r.status});}
  // Use only explicit existing credentials; never guess a password or create a test identity.
  const ordinaryPairs=[['H005_NONADMIN_EMAIL','H005_NONADMIN_PASSWORD'],['H005_USER_TEST_EMAIL','H005_USER_TEST_PASSWORD'],['H005_SECOND_EMAIL','H005_SECOND_PASSWORD']];
  const ordinary=ordinaryPairs.find(([email,password])=>env[email]&&env[password]);
  if(ordinary){
   const subject=await login(env[ordinary[0]],env[ordinary[1]]),r=await request(endpoint,{action:'CASH_FLOW',from:asOf.slice(0,7)},subject.token),db=await request(rpc,{p_from:asOf.slice(0,7)+'-01'},subject.token);
   requireTrue(r.status===403&&[401,403].includes(db.status),'ORDINARY_USER_ACCESS_NOT_DENIED');
   evidence.checks.push({name:'existing_ordinary_user_denied',status:'PASS',edgeHttp:r.status,rpcHttp:db.status});
  }else evidence.checks.push({name:'existing_ordinary_user_denial',status:'NOT TESTED',reason:'NO_EXPLICIT_EXISTING_ORDINARY_CREDENTIALS'});
  evidence.status='PASS';
 }catch(error){evidence.status='FAIL';evidence.error=/^[A-Z0-9_]+$/.test(error.message)?error.message:'HTTP_VERIFICATION_FAILED';}
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'production-http.json'),JSON.stringify(evidence,null,2)+'\n');
 return evidence;
}
if(require.main===module){
 if(!process.argv.includes('--live'))console.log(JSON.stringify({mode:'READ_ONLY_HTTP_PLAN',productionCalls:0,financialWrites:0}));
 else verify().then(evidence=>{console.log(JSON.stringify(evidence));if(evidence.status!=='PASS')process.exitCode=1;});
}
module.exports={verify};
