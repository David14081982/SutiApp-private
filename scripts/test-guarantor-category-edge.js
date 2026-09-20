'use strict';
// Execute the actual approval document gate with isolated transport fixtures.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const edge=read('supabase/functions/financial-legacy/index.ts');
const start=edge.indexOf('  let documentRefs: string[], guarantorRefs: string[];');
const end=edge.indexOf('  const signatureHash =',start);
assert(start>0&&end>start);
const block=edge.slice(start,end).replace('let documentRefs: string[], guarantorRefs: string[];','let documentRefs, guarantorRefs;').replace('(code: string)','(code)');
const bridge=read('supabase/functions/financial-legacy/request-google-sync.js').replace(/^export /gm,'');
const context={};vm.createContext(context);vm.runInContext(bridge+'\nthis.references=capturedDocumentReferences;',context);
const run=vm.runInNewContext('(async function(privileged,request,submittedDocuments,capturedDocumentReferences){'+block+'return {status:200,documentRefs,guarantorRefs};})');
const own=['profile_photo','ine_front','ine_back','payroll_previous','payroll_latest'];
const guarantor=['guarantor_ine_front','guarantor_ine_back','guarantor_photo'];
const docs=codes=>codes.map((code,i)=>({document_type:{code},private_asset_id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),asset_sha256:'A'.repeat(64)}));
let checks=0;
async function gate(required,codes,error=null){
  return run({rpc:async(name,args)=>{assert.equal(name,'required_guarantor_document_codes');assert.equal(args.p_affiliate_id,'request-affiliate');return {data:required,error};}},
    {affiliate_id:'request-affiliate'},docs(codes),context.references);
}
(async()=>{
  for(const required of [[],guarantor]){
    let result=await gate(required,own);
    assert.equal(result.status,required.length?409:200);checks++;
    result=await gate(required,own.concat(guarantor));assert.equal(result.status,200);checks++;
    assert.equal(result.guarantorRefs.length,4);assert.equal(result.guarantorRefs[3],'');checks++;
    for(const missing of guarantor){result=await gate(required,own.concat(guarantor.filter(c=>c!==missing)));assert.equal(result.status,required.length?409:200);checks++;}
    for(const missing of own){result=await gate(required,own.filter(c=>c!==missing).concat(guarantor));assert.equal(result.status,409);assert.equal(result.body.error,'REQUIRED_PRIVATE_DOCUMENT_MISSING');checks++;}
  }
  for(const [required,error] of [[null,null],[null,{message:'UNAVAILABLE'}]]){
    const result=await gate(required,own,error);assert.equal(result.status,409);assert.equal(result.body.error,'GUARANTOR_REQUIREMENTS_UNAVAILABLE');checks++;
  }
  const proof={status:'PASS',checks,approvalUsesRequestAffiliate:true,onlyThreeGuarantorDocuments:true,legacyFourExportPositionsPreserved:true,otherDocumentGuardsPreserved:true,failClosed:true};
  const out=path.join(root,'docs/qa/evidence/guarantor-category-20260909');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'edge-tests.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
