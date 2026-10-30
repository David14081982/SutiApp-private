import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {savingsSourceSelect} from './verify-cash-flow-sources.mjs';
import {buildCashFlow} from '../supabase/functions/reports-jc/cash-flow.mjs';
import {consolidateCashFlow} from '../supabase/functions/reports-jc/cash-flow-consolidated.mjs';
import {resolveCashFlowContracts} from '../supabase/functions/reports-jc/cash-flow-contracts.mjs';
const require=createRequire(import.meta.url),{query}=require('./release-cash-flow.js');
if(!process.argv.includes('--live'))throw Error('EXPLICIT_READ_ONLY_REQUIRED');
try{
 const from='2026-10',source=JSON.parse(fs.readFileSync('.tmp/cash-flow-consolidated/contract-sources.json','utf8')),investorsSource=JSON.parse(fs.readFileSync('.tmp/cash-flow-consolidated/investors-source.json','utf8'));
 const savings=process.argv.includes('--cached')?JSON.parse(fs.readFileSync('.tmp/cash-flow-consolidated/savings-source.json','utf8')):(await query(savingsSourceSelect(from)))[0].report;
 fs.writeFileSync('.tmp/cash-flow-consolidated/savings-source.json',JSON.stringify(savings));
 const resolved=resolveCashFlowContracts(source),consultedAt=new Date().toISOString(),base=buildCashFlow({from,loans:[source.loans[0]],savings,consultedAt});
 const start=Date.now(),report=consolidateCashFlow({base,loans:source.loans,...resolved,contractCoverage:resolved.coverage,investorsSource});
 const ids=new Map(report.records.map(r=>[r.id,r]));assert.equal(ids.size,report.records.length,'DUPLICATE_REPORT_RECORD');
 for(const r of report.records)if(r.parentRecordId){const parent=ids.get(r.parentRecordId);assert(parent&&!parent.parentRecordId,'COMPONENT_PARENT_INVALID');}
 for(const row of base.rows.filter(r=>!r.id.startsWith('loan_')))assert.deepEqual(report.rows.find(r=>r.id===row.id).cells,row.cells);
 for(const row of report.rows){assert.equal(row.cells.length,12);for(const cell of row.cells){assert(cell.amount===null||Number.isFinite(cell.amount));if(row.emphasis&&cell.sourceIds.length){let sum=0;for(const id of cell.sourceIds){const r=ids.get(id);if(r?.amount!=null)sum+=Math.round(r.amount*100)*(cell.sourceSigns?.[id]??1);}assert.equal(sum,Math.round((cell.knownAmount||0)*100),'DETAIL_SUM:'+row.id);}}}
 const json=JSON.stringify(report),proof={status:'PASS',checkedAt:consultedAt,from,rows:report.rows.length,months:12,records:report.records.length,payloadBytes:Buffer.byteLength(json),assemblyMs:Date.now()-start,coverage:report.coverage,groups:[...new Set(report.rows.map(r=>r.group))],issues:[...new Set(report.issues.map(i=>i.code))],sourceRowsPersistedInPublicEvidence:0,financialWrites:0};
 fs.writeFileSync('docs/qa/evidence/cash-flow-consolidated/assembly-live.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;}
