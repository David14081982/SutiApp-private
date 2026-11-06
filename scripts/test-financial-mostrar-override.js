/* Real policy and Edge overview, synthetic profiles only; no network. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {stripTypeScriptTypes}=require('module');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
async function main(){
 const {evaluateVisibility}=await import('../supabase/functions/financial-legacy/visibility-policy.js');
 let checks=0;const check=(a,b,l)=>{assert.deepEqual(a,b,l);checks++;};
 const edge=read('supabase/functions/financial-legacy/index.ts'),ctx=vm.createContext({window:{},normalize:v=>String(v||'').toUpperCase(),Date,Intl});
 vm.runInContext(read('app/financial-legacy-repository.js'),ctx);
 vm.runInContext(stripTypeScriptTypes(edge.slice(edge.indexOf('function rulesForProfile('),edge.indexOf('async function resolveQuote(')))+';this.overview=resolveOverview;',ctx);
 const now=new Date('2026-11-06T12:00:00-07:00'),policy={standardTerms:[1,6,12,24],customMinTerm:1,customStep:1};
 const categories=['Eventuales','Suplentes variables','Suplentes fijos'];
 const base={program_id:'prestamo',fund:'Isolated November fund',union:'SUTISSSTESON',max_amount:10000,payment_count:1,available_on:'2026-11-30',visibility_mode:'AUTO'};
 const rules=categories.map((category,i)=>({...base,id:'isolated-'+i,category}));
 const evaluate=(mode,category=categories[0],union='SUTISSSTESON')=>ctx.overview(rules.map(r=>({...r,visibility_mode:mode,status:evaluateVisibility(r.available_on,mode,now).status})),{financial_union:union,financial_employee_category:category},policy);
 for(const category of categories){
  check(evaluate('AUTO',category).programs.length,0,'automatic November cutoff');
  const shown=evaluate('MOSTRAR',category);check(shown.programs.length,1,'only matching category shown');check(ctx.window.FinancialLegacyRepository.availableCreditTotal(shown),10000,'available credit includes only eligible shown fund');
  check(evaluate('OCULTAR',category).programs.length,0,'explicit hide preserved');
 }
 check(evaluate('MOSTRAR','Base').programs.length,0,'wrong category denied');check(evaluate('MOSTRAR',categories[0],'OTHER').programs.length,0,'wrong union denied');check(evaluate('MOSTRAR','').programs.length,0,'incomplete profile denied');
 const selected=rules.map((r,i)=>({...r,visibility_mode:i===1?'MOSTRAR':'AUTO',status:evaluateVisibility(r.available_on,i===1?'MOSTRAR':'AUTO',now).status}));
 for(const [i,category] of categories.entries())check(ctx.overview(selected,{financial_union:base.union,financial_employee_category:category},policy).programs.length,i===1?1:0,'only selected rule enabled');
 const invalidTerm={...rules[0],payment_count:0,status:'AVAILABLE',visibility_mode:'MOSTRAR'};check(ctx.overview([invalidTerm],{financial_union:base.union,financial_employee_category:categories[0]},policy).programs.length,0,'MOSTRAR never bypasses minimum term');
 const v=evaluateVisibility(base.available_on,'MOSTRAR',now);check(v.automaticVisibility,'HIDDEN','automatic status remains visible for admin explanation');check(v.effectiveVisibility,'VISIBLE','explicit mode overrides automatic result');
 for(const mode of ['AUTO','MOSTRAR','OCULTAR'])check(evaluateVisibility(null,mode,now).status,mode==='OCULTAR'?'UNAVAILABLE':'AVAILABLE','permanent funds unchanged');
 assert.throws(()=>evaluateVisibility(base.available_on,'INVALID',now),/VISIBILITY_INVALID/);checks++;
 const writer=read('supabase/migrations/20261020000100_native_financial_rules.sql');for(const marker of ["has_admin_permission('financial_criteria.visibility.write')","invalidation_reason='FINANCIAL_VISIBILITY_CHANGED'","'VISIBILITY_CHANGE'","lifecycle_status in('PUBLISHED','SCHEDULED')"])assert(writer.includes(marker));
 const result={status:'PASS',checks,threeRequestedCategories:true,profileEligibilityPreserved:true,automaticPolicyPreserved:true,productionWrites:0};const out=path.join(root,'docs/qa/evidence/financial-mostrar-override');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'policy.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
