// Assemble already-captured official sources. No network, data writes, or historical audit.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCashFlow} from '../supabase/functions/reports-jc/cash-flow.mjs';
import {consolidateCashFlow} from '../supabase/functions/reports-jc/cash-flow-consolidated.mjs';
import {resolveCashFlowContracts} from '../supabase/functions/reports-jc/cash-flow-contracts.mjs';
import {sourceDate,fundGroup} from '../supabase/functions/reports-jc/report.mjs';
const read=name=>JSON.parse(fs.readFileSync('.tmp/cash-flow-criteria/'+name+'.json','utf8').replace(/^\uFEFF/,''));
const source=read('contract-sources'),savings=read('savings-source'),investorsSource=read('investors-source'),from='2026-01';
const consultedAt=new Date().toISOString(),base=buildCashFlow({from,loans:[source.loans[0]],savings,consultedAt}),resolved=resolveCashFlowContracts(source),started=Date.now();
const report=consolidateCashFlow({base,loans:source.loans,...resolved,contractCoverage:resolved.coverage,investorsSource});
const records=new Map(report.records.map(r=>[r.id,r]));assert.equal(records.size,report.records.length);let verifiedTotals=0,verifiedInstallments=0;
for(const row of report.rows)for(const c of row.cells){
 assert.equal(row.cells.length,12);assert(c.amount===null||Number.isFinite(c.amount));
 if(row.emphasis&&c.sourceIds.length){let sum=0;for(const id of c.sourceIds){const r=records.get(id);assert(r,'MISSING_DETAIL');if(r.amount!==null)sum+=Math.round(r.amount*100)*(c.sourceSigns?.[id]??1);}assert.equal(sum,Math.round((c.knownAmount||0)*100),'DETAIL_SUM:'+row.id);verifiedTotals++;}
}
for(const r of records.values()){
 if(r.parentRecordId)assert(records.has(r.parentRecordId)&&!records.get(r.parentRecordId).parentRecordId);
 if(/^pv2:\d+$/.test(r.id)){assert.equal(r.status,r.date<=report.asOf?'RECORDED':'SCHEDULED');if(r.principal!==null){assert.equal(Math.round(r.amount*100),Math.round(r.principal*100)+Math.round(r.interest*100)+Math.round(r.administration*100));verifiedInstallments++;}}
}
const monthlyGross=Array(12).fill(0);for(const row of source.loans.slice(1)){const d=sourceDate(row[0]);if(d&&d<=report.asOf&&d.startsWith('2026-')&&row[2]&&row[3]&&['loanSavings','pettyCash','sutiexpress','advance'].includes(fundGroup(row[6]))&&typeof row[1]==='number'&&row[1]>=0)monthlyGross[Number(d.slice(5,7))-1]+=Math.round(row[1]*100);}
const gross=report.rows.find(r=>r.id==='loans_recovered_total');for(let i=0;i<12;i++)if(report.months[i].key<=report.asOf.slice(0,7))assert.equal(Math.round((gross.cells[i].knownAmount||0)*100),monthlyGross[i],'REGISTERED_B_VISIBILITY');
assert(report.coverage.determinedLoans>196);assert.equal(report.coverage.financialWrites,0);assert.equal(report.coverage.amortizationEngineActive,false);
const generated=report.rows.find(r=>r.id==='investor_yield_generated');assert(generated.cells.some(c=>(c.knownAmount||0)>0));assert(report.records.some(r=>r.kind==='investor_contribution'&&r.basis==='REGISTERED_CONTRACT'));
const json=JSON.stringify(report),states={};for(const row of report.rows)for(const c of row.cells)states[c.status]=(states[c.status]||0)+1;
const result={status:'PASS',checkedAt:consultedAt,from,sourceMode:'EXISTING_PRIVATE_CAPTURE',networkCalls:0,rows:report.rows.length,months:12,records:report.records.length,payloadBytes:Buffer.byteLength(json),assemblyMs:Date.now()-started,coverage:report.coverage,stateCounts:states,verifiedTotals,verifiedInstallments,registeredBGrossMatchesAllDatedOfficialRows:true,importedInvestorContributionsVisible:true,calculatedInvestorYieldsVisible:true,financialWrites:0,sourceEngineSha256:createHash('sha256').update(fs.readFileSync('supabase/functions/reports-jc/cash-flow-pv2-engine.mjs')).digest('hex')};
fs.writeFileSync('docs/qa/evidence/cash-flow-criteria/assembly.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
