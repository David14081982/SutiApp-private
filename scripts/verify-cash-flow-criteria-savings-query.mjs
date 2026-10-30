// Read-only targeted verification of migration 006 after the authenticated RPC timeout.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {savingsCriteriaSourceSelect} from './verify-cash-flow-criteria-savings-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration='supabase/migrations/20261030000600_reports_jc_cash_flow_savings_query.sql';
const sha=v=>createHash('sha256').update(v).digest('hex');
const sql=savingsCriteriaSourceSelect('2026-01',migration);
async function main(){
 const require=createRequire(import.meta.url),{query}=require('./release-cash-flow.js'),started=Date.now();
 // Connection-local 6s cap proves the query fits beneath the existing 8s RPC cap.
 const rows=await query("select set_config('statement_timeout','6000',false);select current_setting('default_transaction_read_only') read_only;"+sql);
 const durationMs=Date.now()-started,report=rows.find(r=>r.report)?.report;
 assert(rows.some(r=>r.read_only==='on'),'READ_ONLY_REQUIRED');assert(report?.events&&report.balances?.length===12,'REPORT_REQUIRED');
 const prior=JSON.parse(fs.readFileSync(path.join(root,'.tmp/cash-flow-criteria/savings-source.json'),'utf8'));
 assert.deepEqual(report.events,prior.events,'REGISTERED_EVENTS_CHANGED');
 for(const b of prior.balances){const current=report.balances.find(r=>r.month===b.month);assert.equal(current.known_amount,b.known_amount,'KNOWN_BALANCE_CHANGED');}
 const evidence={status:'PASS',checkedAt:new Date().toISOString(),migrationSha256:sha(fs.readFileSync(path.join(root,migration))),sqlSha256:sha(sql),durationMs,
  statementTimeoutMs:6000,databaseReadOnly:true,unchangedRegisteredEvents:true,unchangedKnownAmounts:true,events:report.events.length,
  financialWrites:0,ddl:0,productionCalls:1};
 fs.writeFileSync(path.join(root,'.tmp/cash-flow-criteria/savings-source-optimized.json'),JSON.stringify(report));
 fs.writeFileSync(path.join(root,'docs/qa/evidence/cash-flow-criteria/savings-query-live.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'SAVINGS_QUERY_VERIFICATION_FAILED'}));process.exitCode=1;});
