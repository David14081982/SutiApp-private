'use strict';
// Read-only source comparison. Private payload never appears in evidence.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{
 const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/sicof-savings-authority');
 let observation;
 if(process.argv.includes('--live')){
  const {query}=require('./savings-admin-review-db');
  [observation]=await query("begin read only;set local statement_timeout='60s';select sicof_private.context('2026-07-01','2026-10-30') ctx,public.service_sicof_source_read() cache;commit;");
  fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'context.json'),JSON.stringify(observation));
 }else observation=JSON.parse(fs.readFileSync(path.join(privateDir,'context.json'),'utf8'));
 const {ctx,cache}=observation;assert(cache.source);
 const current=await import('../supabase/functions/sicof/engine.mjs');
 const previous=await import(pathToFileURL(path.join(privateDir,'before/supabase/functions/sicof/engine.mjs')));
 const {analyzeSicofLoans}=await import('../supabase/functions/sicof/loan-calculation.mjs');
 const analysis=analyzeSicofLoans(cache.source,{from:ctx.from,to:ctx.to,as_of:ctx.today});
 const settings={src:'caja',selFunds:[],pay:81,method:'avg',periodIni:ctx.from,periodFin:ctx.to,minm:6,exterm:true,exmin:true,warn:20,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const snapshot=JSON.stringify(ctx),results={};
 const summarize=r=>({rate:r.rate,base:r.base,eligible:r.nqual,excluded:r.nexcl,review:r.reviewCount,distributed:r.distributed,reasons:r.reviewReasons});
 for(const method of ['avg','end']){
  const input={settings:{...settings,method}},old=previous.calculateSicof(ctx,analysis,input),result=current.calculateSicof(ctx,analysis,input);
  assert.deepEqual(current.createPreparedCalculator(ctx,analysis).calculate(input),result);
  for(const key of ['collected','projected','pool','reserve','projectedNetPool','costsTotal'])assert.equal(result[key],old[key]);
  assert(!result.reviewReasons.some(x=>x.reason==='HISTORICAL_EXPECTATION_UNVERIFIED'||x.reason==='SOURCE_REVIEW_REQUIRED'));
  for(let i=0;i<result.rows.length;i++)for(const key of ['capital','previous_yield','available','endbal','avgbal','months','debt','ov','maxMissQ'])assert.equal(result.rows[i][key],old.rows[i][key],key+' must preserve the accepted value');
  assert.equal(Math.round(result.rows.reduce((n,r)=>n+(r.rend||0),0)*100),Math.round(result.distributed*100));
  results[method]={before:summarize(old),after:summarize(result),money:Object.fromEntries(['collected','projected','pool','reserve','projectedNetPool'].map(k=>[k,result[k]]))};
 }
 assert.equal(JSON.stringify(ctx),snapshot,'No correction of owner values');
 const proof={status:'PASS',scope:'READ_ONLY_LOCAL_CANDIDATE',at:new Date().toISOString(),sourceObservedAt:cache.meta.observed_at,period:{from:ctx.from,to:ctx.to,today:ctx.today},engine:current.ENGINE_VERSION,participants:ctx.participants.length,results,financialWrites:0,productionDeployment:false};
 const out=path.join(root,'docs/qa/evidence/sicof-savings-authority');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'live-comparison.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
