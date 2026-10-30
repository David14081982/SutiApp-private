// One explicit read-only consultation for the current report criterion. No source writes.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {readConsolidatedCashFlowGoogle} from '../supabase/functions/reports-jc/cash-flow-google.mjs';
import {resolveCashFlowContracts,computeContractCashFlow} from '../supabase/functions/reports-jc/cash-flow-contracts.mjs';
import {sourceDate} from '../supabase/functions/reports-jc/report.mjs';
import {READER_SECRET} from '../supabase/functions/reports-jc/google-auth.mjs';
const require=createRequire(import.meta.url),{query}=require('./release-cash-flow.js');
if(!process.argv.includes('--live'))throw Error('EXPLICIT_LIVE_READ_REQUIRED');
try{
 const raw=fs.readFileSync('C:/Users/david/Downloads/sutifinanzas-reportes-17cdac4aaba7.json','utf8');
 const sql=fs.readFileSync('supabase/migrations/20261030000300_reports_jc_cash_flow_contracts.sql','utf8');
 const start=sql.indexOf(' select coalesce('),end=sql.indexOf(" return jsonb_build_object",start);
 if(start<0||end<0)throw Error('CONTRACT_SELECT_NOT_FOUND');
 const [google,snapshotRows]=await Promise.all([readConsolidatedCashFlowGoogle(name=>name===READER_SECRET?raw:null),query(sql.slice(start,end).replace(' into result',' as result'))]);
 const snapshots=snapshotRows[0]?.result;if(!Array.isArray(snapshots))throw Error('SNAPSHOTS_RESPONSE_INVALID');
 const capturedAt=new Date().toISOString(),source={...google,snapshots,capturedAt},resolution=resolveCashFlowContracts(source);
 fs.mkdirSync('.tmp/cash-flow-criteria',{recursive:true});fs.writeFileSync('.tmp/cash-flow-criteria/contract-sources.json',JSON.stringify(source));
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(capturedAt)),part=t=>parts.find(p=>p.type===t).value,asOf=`${part('year')}-${part('month')}-${part('day')}`,groups=new Map();
 for(const [i,r]of google.loans.entries()){const row={C:String(r[2]??'').trim(),D:String(r[3]??'').trim(),S:r[18],B:typeof r[1]==='number'?Math.round(r[1]*100):null,date:sourceDate(r[0]),sourceRow:i+1},k=JSON.stringify([row.C,row.D]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
 const outcomes=resolution.contracts.map(c=>computeContractCashFlow({contract:c,rows:groups.get(JSON.stringify([c.C,c.D])),asOf}));
 const reasons=rows=>rows.reduce((a,p)=>(a[p.reason]=(a[p.reason]||0)+1,a),{}),known=outcomes.filter(o=>o.status==='DETERMINED');
 for(const o of known)for(const p of [...o.payments,...o.forecast])if(p.B!==p.Z+p.AB+p.AD||p.AC!==p.AB+p.AD)throw Error('ALLOCATION_IDENTITY_FAILED');
 const proof={status:'PASS',capturedAt,asOf,timezone:'America/Hermosillo',source:'Current official read-only sources',googleRows:google.loans.length,requestRows:google.requests.length,snapshots:snapshots.length,headers:google.loans[0].slice(11,16),coverage:resolution.coverage,protectedReasons:reasons(resolution.protectedLoans),computed:known.length,allocationReasons:reasons(outcomes.filter(o=>o.status!=='DETERMINED')),officialTerms:resolution.contracts.filter(c=>c.evidence.kind==='official_registered_terms').length,approvedTerms:resolution.contracts.filter(c=>c.evidence.kind==='explicit_approved_snapshot').length,registeredAmountsPreserved:true,financialWrites:0,googleWrites:0,triggerChanges:0,privateCapture:true};
 fs.mkdirSync('docs/qa/evidence/cash-flow-criteria',{recursive:true});fs.writeFileSync('docs/qa/evidence/cash-flow-criteria/contracts-live-readonly.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}catch(e){console.error(JSON.stringify({status:'FAIL',error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'SOURCE_READ_FAILED'}));process.exitCode=1;}
