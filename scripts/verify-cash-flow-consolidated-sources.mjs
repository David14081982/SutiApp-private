// Explicit read-only evidence capture. Private inputs are never deployed as a financial authority.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readConsolidatedCashFlowGoogle} from '../supabase/functions/reports-jc/cash-flow-google.mjs';
import {READER_SECRET} from '../supabase/functions/reports-jc/google-auth.mjs';
import {resolveCashFlowContracts} from '../supabase/functions/reports-jc/cash-flow-contracts.mjs';
const require=createRequire(import.meta.url),{query}=require('./release-cash-flow.js');
const root=path.resolve('.'),dir=path.join(root,'.tmp/cash-flow-consolidated');
fs.mkdirSync(dir,{recursive:true});
if(!process.argv.includes('--live'))throw Error('EXPLICIT_LIVE_READ_REQUIRED');
try{
 const raw=fs.readFileSync('C:/Users/david/Downloads/sutifinanzas-reportes-17cdac4aaba7.json','utf8');
 const sql=fs.readFileSync('supabase/migrations/20261030000300_reports_jc_cash_flow_contracts.sql','utf8');
 const start=sql.indexOf(' select coalesce('),end=sql.indexOf(" return jsonb_build_object",start);
 if(start<0||end<0)throw Error('CONTRACT_SELECT_NOT_FOUND');
 const select=sql.slice(start,end).replace(' into result',' as result');
 const [google,snapshotRows]=await Promise.all([readConsolidatedCashFlowGoogle(name=>name===READER_SECRET?raw:null),query(select)]);
 const snapshots=snapshotRows[0]?.result;if(!Array.isArray(snapshots))throw Error('SNAPSHOTS_RESPONSE_INVALID');
 const source={...google,snapshots,capturedAt:new Date().toISOString()};
 fs.writeFileSync(path.join(dir,'contract-sources.json'),JSON.stringify(source));
 const resolution=resolveCashFlowContracts({...google,snapshots});
 const proof={status:'PASS',checkedAt:source.capturedAt,googleRows:google.loans.length,requestRows:google.requests.length,notesAvailable:google.notesAvailable,snapshots:snapshots.length,coverage:resolution.coverage,determined:resolution.contracts.length,protectedReasons:resolution.protectedLoans.reduce((a,p)=>(a[p.reason]=(a[p.reason]||0)+1,a),{}),financialWrites:0,googleWrites:0,amortizationEngineActivated:false,privateCapture:true};
 fs.mkdirSync('docs/qa/evidence/cash-flow-consolidated',{recursive:true});fs.writeFileSync('docs/qa/evidence/cash-flow-consolidated/contract-sources.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){console.error(JSON.stringify({status:'FAIL',error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'SOURCE_READ_FAILED'}));process.exitCode=1;}
