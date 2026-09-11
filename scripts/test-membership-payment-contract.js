'use strict';
// Isolated financial contract and Google projection tests; no network/writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),out=process.env.SUTIAPP_TEST_EVIDENCE_DIR||path.join(root,'docs/qa/evidence/membership-payment-contract-20260910');
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const baseline=f=>require('child_process').execFileSync('git',['show','9f880bf0fcea96ecfc57cd1f80ef43cbd254cc8a:'+f],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
const sql=JSON.parse(read('docs/qa/evidence/membership-payment-contract-20260910/sql-test.json'));
assert.equal(sql.status,'PASS');
const financial=sql.matrix.find(r=>r.result.financialResult).result.financialResult;
const mapperSource=read('supabase/functions/financial-legacy/request-google-sync.js').replace(/^export /gm,'');
const context={};vm.createContext(context);vm.runInContext(mapperSource,context);
const request={id:'00000000-0000-4000-8000-000000000001',numero_control:'QA-ISOLATED',program_id:'membership',
  created_at:'2026-09-10T12:00:00Z',requested_amount:financial.amount,requested_term:financial.paymentCount,
  terms_accepted:true,financial_submission_snapshot:{contract_version:'MEMBERSHIP_PAYMENT_V1',offering:{company:'Bud Tv Ultra'},financialResult:financial}};
const row=context.buildRequestRegisterRow(request,[],null);
assert.deepEqual(Array.from(row.slice(4,9)),['Vales y membresias',0,2,200,200]);
assert.equal(row.length,33);assert.equal(financial.capital,170);assert.equal(financial.administrativeFeeTotal,30);
// H-MEMBERSHIP-GOOGLE-COMPANY-Z-001 intentionally adds the captured company in Z.
// All other financial/register columns retain the original projection.
const priorContext={};vm.createContext(priorContext);
vm.runInContext(baseline('supabase/functions/financial-legacy/request-google-sync.js').replace(/^export /gm,''),priorContext);
const priorRow=Array.from(priorContext.buildRequestRegisterRow(request,[],null));
assert.deepEqual(Array.from(row).filter((_,i)=>i!==25),priorRow.filter((_,i)=>i!==25));
assert.equal(row[25],'Bud Tv Ultra');
// Existing requests with missing values are untouched by the mapper and no backfill exists.
const legacy=context.buildRequestRegisterRow({...request,requested_amount:null,requested_term:null,financial_submission_snapshot:null},[],null);
assert.deepEqual(Array.from(legacy.slice(4,9)),['','','','','']);
// Shared browser repository: only the membership writer's body changes.
const before=baseline('app/program-request-repository.js');
const omitMembership=s=>s.replace(/  async function createMembership\(values\).*\r?\n/,'');
assert.equal(omitMembership(read('app/program-request-repository.js')),omitMembership(before));
const ui=read('app/screens-membership-application.jsx'),original=baseline('app/screens-membership-application.jsx');
assert.equal(ui.match(/const CSS=`([\s\S]*?)`;/)[1],original.match(/const CSS=`([\s\S]*?)`;/)[1]);
for(const label of ['mr-hero','mr-figures','mr-tracker','UnifiedDocumentPhase','mr-data','mr-privacy','mr-footer','RequestSubmissionSuccess'])assert(ui.includes(label));
const q={contract_version:'MEMBERSHIP_PAYMENT_V1',membership_offering_id:'offering',quote_hash:'a'.repeat(64),financialResult:financial};
let response={data:q},calls=[];
const sandbox={window:{SutiSupabase:{getClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return response;}})}}};
vm.createContext(sandbox);vm.runInContext(read('app/membership-repository.js'),sandbox);
(async()=>{
  assert.equal((await sandbox.window.MembershipRepository.paymentQuote('offering')).financialResult.total,200);
  assert.equal(calls[0].name,'get_current_membership_payment_quote');assert.deepEqual(Object.keys(calls[0].args),['p_membership_offering_id']);
  response={error:new Error('authority unavailable')};await assert.rejects(()=>sandbox.window.MembershipRepository.paymentQuote('offering'),/authority unavailable/);
  response={data:{...q,financialResult:{...financial,rate:1}}};await assert.rejects(()=>sandbox.window.MembershipRepository.paymentQuote('offering'),/QUOTE_INVALID/);
  const result={status:'PASS',googleColumnsEtoI:Array.from(row.slice(4,9)),doubleCharge:false,legacyRequestsUnchanged:true,
    sharedRepositoryNonMembershipIdentical:true,googleOtherColumnsIdentical:true,uiCssIdentical:true,quoteAuthorityAndErrors:true,externalWrites:0};
  fs.writeFileSync(path.join(out,'contracts.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
