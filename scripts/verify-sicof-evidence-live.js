'use strict';
// Authenticated READ ONLY context and source. Output aggregates, never people/credentials.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{query}=require('./savings-admin-review-db');
(async()=>{
 const mode=process.argv[2]||'candidate',root=path.resolve(__dirname,'..');
 const [{ctx,cache}]=await query("begin read only;set local statement_timeout='60s';select sicof_private.context('2026-07-01','2026-10-30') ctx,public.service_sicof_source_read() cache;commit;");
 assert.equal(cache.meta.state,'READY');assert(cache.source);
 const {calculateSicof}=await import('../supabase/functions/sicof/engine.mjs');
 const {analyzeSicofLoans}=await import('../supabase/functions/sicof/loan-calculation.mjs');
 const analysis=analyzeSicofLoans(cache.source,{from:ctx.from,to:ctx.to,as_of:ctx.today});
 const settings={src:'caja',selFunds:[],pay:81,method:'avg',periodIni:ctx.from,periodFin:ctx.to,minm:6,exterm:true,exmin:true,warn:20,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const strict={...analysis,loans:analysis.loans.map(({savings_evidence,...loan})=>loan)};
 const old=calculateSicof(ctx,strict,{settings}),result=calculateSicof(ctx,analysis,{settings});
 for(const key of ['collected','projected','pool','reserve','projectedNetPool','costsTotal'])assert.equal(result[key],old[key]);
 const overview=r=>({rate:r.rate,base:r.base,eligible:r.nqual,excluded:r.nexcl,review:r.reviewCount,reasons:r.reviewReasons});
 const proof={status:'PASS',mode,at:new Date().toISOString(),period:{from:ctx.from,to:ctx.to,today:ctx.today},sourceObservedAt:cache.meta.observed_at,sourceState:cache.meta.state,participants:ctx.participants.length,
  strict:overview(old),candidate:overview(result),money:Object.fromEntries(['collected','projected','pool','reserve','projectedNetPool'].map(k=>[k,result[k]])),
  historyExpectedSources:ctx.participants.flatMap(p=>p.history).reduce((a,h)=>{const k=h.expected_source||'PRE_ADAPTER';a[k]=(a[k]||0)+1;return a;},{}),financialWrites:0};
 const out=path.join(root,'docs/qa/evidence/sicof-evidence-integration');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'live-'+mode+'.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
