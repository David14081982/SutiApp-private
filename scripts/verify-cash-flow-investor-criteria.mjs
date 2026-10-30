// Targeted live SELECT only. Official source amounts remain private; published evidence contains counts.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildInvestorCashFlow} from '../supabase/functions/reports-jc/cash-flow-investors.mjs';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv[2]!=='--live')throw Error('EXPLICIT_LIVE_READ_ONLY_FLAG_REQUIRED');
const {query}=require('./release-cash-flow.js'),from='2026-01',file='supabase/migrations/20261030000400_reports_jc_cash_flow_investor_criteria.sql';
const source=fs.readFileSync(path.join(root,file),'utf8'),start=source.indexOf('  with contracts as ('),end=source.indexOf(' into v_result;',start);
assert(start>=0&&end>start);
const sql=source.slice(start,end).replaceAll('v_today',"((transaction_timestamp() at time zone 'America/Hermosillo')::date)").replaceAll('p_from',"date '"+from+"-01'")+' as data;';
assert(!/\b(insert|update|delete|truncate|alter|create|drop|revoke|grant)\s/i.test(sql));
const started=Date.now(),rows=await query(sql),data=rows[0].data,elapsedMs=Date.now()-started;
const privateDir=path.join(root,'.tmp/cash-flow-criteria');fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'investors-source.json'),JSON.stringify(data));
const result=buildInvestorCashFlow({from,source:data,asOf:data.as_of}),cents=n=>Math.round(Number(n)*100),currentMonth=data.as_of.slice(0,7);
for(const b of data.balances){const actual=result.balances.find(x=>x.kind==='investor_capital_balance'&&x.month===b.month.slice(0,7));assert.equal(actual.amount,b.amount);assert.equal(actual.known_amount,b.known_amount);}
const detailById=new Map(result.records.filter(r=>r.kind==='investor_capital_balance'&&r.period===currentMonth).map(r=>[r.contractId,r]));
let officialBalancesCompared=0;
for(const c of data.contracts){
 if(c.closed_on&&c.closed_on<=data.as_of||c.renewed_on&&c.renewed_on<=data.as_of||c.starts_on>data.as_of)continue;
 let base=null,on=null;
 if(c.opening_balance!==null&&c.balance_on<=data.as_of){base=c.opening_balance;on=c.balance_on;}
 else if(c.registered_current_capital!==null&&c.registered_balance_on&&c.registered_balance_on<=data.as_of){base=c.registered_current_capital;on=c.registered_balance_on;}
 if(base===null)continue;
 const expected=cents(base)+data.movements.filter(m=>m.contract_id===c.id&&['contribution','withdrawal','adjustment'].includes(m.concept)&&m.effective_on>=on&&m.effective_on<=data.as_of).reduce((sum,m)=>sum+(m.direction==='in'?1:-1)*cents(m.amount),0);
 assert.equal(cents(detailById.get(c.id)?.amount??0),expected);officialBalancesCompared++;
}
const proof={status:'PASS',readOnly:true,financialWrites:0,ddlStatements:0,elapsedMs,contracts:data.contracts.length,officialBalancesCompared,monthlySqlAndReaderEquivalent:true,movements:data.movements.length,storedObligations:data.obligations.length,registeredInitialContributions:result.events.filter(e=>e.kind==='investor_contribution'&&e.basis==='REGISTERED_CONTRACT').length,events:result.events.length,unassigned:result.unassigned.length,coverage:result.coverage,issues:result.issues.map(i=>({code:i.code,sourceCount:i.sourceIds.length,months:i.months,affectedKinds:i.affectedKinds})),storedAmountsLogged:false};
const out=path.join(root,'docs/qa/evidence/cash-flow-criteria');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'investors-live-readonly.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({...proof,issues:undefined,issueCodes:[...new Set(proof.issues.map(i=>i.code))]}));
