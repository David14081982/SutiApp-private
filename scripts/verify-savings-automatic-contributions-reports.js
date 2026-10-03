'use strict';
// Read-only proof across canonical self projection, SICOF and the actual downloaded workbook.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{pathToFileURL}=require('url');
const {query,rpc,login,env}=require('./release-sicof-backend.js');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/savings-auto-contributions'),out=path.join(root,'docs/qa/evidence/savings-automatic-contributions');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')),q=s=>"'"+String(s).replace(/'/g,"''")+"'",sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const ExcelJS=require(path.join(root,'.tmp/sicof/deps/node_modules/exceljs'));
async function main(){
 const before=read('.tmp/savings-auto-contributions/release-before.json'),priorContext=read('.tmp/savings-auto-contributions/report-before-context-private.json');
 const {buildContinuousSavingsReport}=await import(pathToFileURL(path.join(root,'supabase/functions/sicof/projection.mjs')));
 const auth=await login(),context=await rpc(auth.access_token,'get_admin_sicof_context',{p_from:'2026-07-01',p_to:'2026-10-03'}),previous=buildContinuousSavingsReport(priorContext),current=buildContinuousSavingsReport(context);
 assert.equal(context.today,'2026-10-03');const deltas=new Map();for(const x of before.pending)deltas.set(x.participant_id,(deltas.get(x.participant_id)||0)+x.expected);
 let checked=0;
 for(const [id,delta] of deltas){
  const a=previous.rows.find(r=>r.participant_id===id),b=current.rows.find(r=>r.participant_id===id);assert(a&&b,'SICOF_PARTICIPANT_MISSING');
  const av=a.period_values['2026-S2'],bv=b.period_values['2026-S2'];assert(av&&bv);assert.equal(Math.round((bv.confirmed_capital-av.confirmed_capital)*100),Math.round(delta*100),'SICOF_PERIOD_CONTRIBUTION_DELTA');
  assert.equal(bv.confirmed_yield_amount,av.confirmed_yield_amount);assert.deepEqual(b.withdrawals,a.withdrawals,'WITHDRAWALS_CHANGED');
  assert.equal(Math.round((b.balances.total-a.balances.total)*100),Math.round(delta*100),'SICOF_BALANCE_DELTA');checked++;
 }
 const ids=[...deltas.keys()].map(id=>q(id)+'::uuid').join(',');
 const self=await query(`begin read only;select p.id,savings_canonical_user_projection(p.id) projection,to_jsonb(b) balance from savings_participants p cross join lateral savings_participant_balance(p.id) b where p.id in (${ids});commit;`,true);
 assert.equal(self.length,checked);for(const row of self){assert.equal(row.projection.balances.total,row.balance.total);assert.equal(row.projection.balances.capital,row.balance.capital);assert.equal(row.projection.balances.yield_amount,row.balance.yield_amount);assert(row.projection.canonical_ledger_used);}
 const call=async filters=>{const response=await fetch(env.SUPABASE_URL+'/functions/v1/sicof',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'EXPORT',kind:'final_ahorro',filters}),signal:AbortSignal.timeout(180000)});const data=await response.json();assert(response.ok,'EXPORT_FAILED');return Buffer.from((data.data??data).base64,'base64');};
 const bytes=await call({year:'2026',semester:'2'}),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);const sheet=book.worksheets[0];assert.equal(sheet.name,'Informe acumulado');assert.equal(sheet.getCell('N2').value,'2026 2DO SEMESTRE AHORRO');assert.equal(sheet.getCell('O2').value,'2026 REND. 2DO SEMESTRE');assert.equal(sheet.getCell('P2').value,null);assert(book.getWorksheet('Retiros y saldo acumulado'));
 for(const row of current.rows.filter(r=>deltas.has(r.participant_id))){let found=null;sheet.eachRow((r,i)=>{if(i>2&&String(r.getCell(1).value)===row.folio)found=r;});assert(found,'EXCEL_PERSON_MISSING');const expected=row.period_values['2026-S2'].capital;assert.equal(found.getCell(14).value,expected==null?'POR CONCILIAR':expected,'EXCEL_CURRENT_CONTRIBUTIONS_MISMATCH');}
 const original=await call({historical:true});assert.equal(sha(original),'e9dc173869188990e23d71694a99af008d2b9190a301d1d71c90ff2764d18837');
 fs.writeFileSync(path.join(dir,'report-after-private.xlsx'),bytes);fs.writeFileSync(path.join(dir,'report-after-context-private.json'),JSON.stringify(context));
 const proof={status:'PASS',at:new Date().toISOString(),readOnly:true,financialWrites:0,affectedParticipantsChecked:checked,allCanonicalSelfBalancesMatch:true,selfCoverage:'Canonical projection evaluated read-only with database owner; does not claim affected-user login.',sicofPeriodContributionDeltasMatch:true,yieldsAndWithdrawalsUnchanged:true,actualExcelDownload:true,headers:[sheet.getCell('N2').value,sheet.getCell('O2').value],futureColumnsAbsent:true,rowsChecked:checked,originalHistoricalSha256:sha(original),downloadSha256:sha(bytes),downloadBytes:bytes.length};
 fs.writeFileSync(path.join(out,'reports-live.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(e=>{fs.writeFileSync(path.join(dir,'reports-error.txt'),e.stack||String(e));console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
