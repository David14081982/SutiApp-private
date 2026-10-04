'use strict';
const assert = require('assert/strict');
(async()=>{
  const {analyzeSicofLoans} = await import('../supabase/functions/sicof/loan-calculation.mjs');
  const {readSicofLoanSource,decodeSicofLoanSource,SICOF_LOAN_CONTRACT,SICOF_WORKBOOK,SICOF_SHEET_ID,SICOF_COLUMNS,SICOF_FIELDS} = await import('../supabase/functions/sicof/loan-source.mjs');
  const row = (patch={}) => ({source_row:2,date:'2026-01-15',paid:697.50,loan_id:'008',folio:'00123',name:'Isolated fixture',process:1,fund:'Caja de Ahorro',rate:.05,term:12,principal:5000,total_due:8370,loan_charges:3370,scheduled_charges:280.83,expected:697.50,status:'AL CORRIENTE',paid_to_date:697.50,expected_to_date:697.50,scheduled_admin_fee:370/12,admin_fee_total:370,interest_total:3000,principal_interest_total:8000,scheduled_capital:416.67,...patch});
  const source = rows => ({source:SICOF_WORKBOOK+':'+SICOF_SHEET_ID,observed_at:'2026-06-30T12:00:00.000Z',source_fingerprint:'A'.repeat(64),date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE',rows});
  const options = {from:'2026-01-01',to:'2026-12-31',as_of:'2026-06-30'};
  let result = analyzeSicofLoans(source([row()]),options);
  assert.equal(result.totals.reconciled_interest,250);assert.equal(result.totals.reconciled_admin_fee,30.83);assert.equal(result.totals.reconciled_capital,416.67);
  assert.equal(result.totals.reconciled_paid,697.50);assert.equal(result.totals.complete,true);
  assert.equal(result.loans[0].folio,'00123');assert.equal(result.loans[0].id,'008');assert.equal(result.loans[0].punctuality_score,null);
  assert.equal(result.loans[0].rate_percent,5);assert.equal(result.loans[0].process,1);assert.equal(result.loans[0].term,12);
  assert.equal(result.loans[0].loan_charges,3370);assert.equal(result.loans[0].principal_interest_total,8000);
  assert.equal(result.certification.can_certify_cash_income,false);assert.equal(result.certification.receipt_date_verified,false);
  result = analyzeSicofLoans(source([row({paid:0})]),options);
  assert.equal(result.totals.reconciled_interest,0);assert.equal(result.payments[0].interest,0);assert.equal(result.payments[0].audit,'NO_RECORDED_PAYMENT');
  result = analyzeSicofLoans(source([row({date:'2026-07-15',paid:0})]),options);
  assert.equal(result.totals.reconciled_interest,0);assert.equal(result.totals.projected_interest,250);assert.equal(result.payments[0].audit,'PROJECTED');
  for(const [paid,code] of [[300,'PARTIAL_PAYMENT_ALLOCATION_REQUIRED'],[900,'OVERPAYMENT_ALLOCATION_REQUIRED']]){
    result=analyzeSicofLoans(source([row({paid})]),options);
    assert.equal(result.totals.unallocated_paid,paid);assert.equal(result.payments[0].interest,null);assert.equal(result.totals.complete,false);assert(result.certification.blocked_reasons.includes(code));
  }
  result=analyzeSicofLoans(source([row({date:'2026-07-15'})]),options);
  assert.equal(result.totals.reconciled_paid,0);assert(result.certification.blocked_reasons.includes('PAYMENT_ON_FUTURE_AMORTIZATION_DATE'));
  result=analyzeSicofLoans(source([row(),row({source_row:3})]),options);
  assert.equal(result.totals.recorded_paid,0);assert.equal(result.totals.unresolved_rows,2);assert(result.certification.blocked_reasons.includes('AMBIGUOUS_LOAN_DATE_ROWS'));
  result=analyzeSicofLoans(source([row(),row({source_row:3,date:'2026-01-30',status:'SALDO ATRASADO'})]),options);
  assert.equal(result.loans[0].status,null);assert.equal(result.loans[0].behavior,'REVIEW_REQUIRED');assert.equal(result.totals.reconciled_paid,0);
  result=analyzeSicofLoans(source([row(),row({source_row:3,date:'2026-01-30',rate:.03})]),options);
  assert.equal(result.loans[0].rate,null);assert.equal(result.loans[0].rate_percent,null);assert(result.loans[0].metadata_issues.some(x=>x.field==='rate'));
  for(const patch of [{loan_charges:3371},{scheduled_charges:281.83},{scheduled_admin_fee:31.83},{scheduled_capital:null},{paid:'697.50'},{folio:123},{date:'2026-02-30'},{paid:-1},{paid_to_date:-1},{expected_to_date:null}]){
    result=analyzeSicofLoans(source([row(patch)]),options);assert.equal(result.totals.complete,false,JSON.stringify(patch));assert.equal(result.totals.reconciled_interest,0);
  }
  // Non-period rows remain in loan history, but cannot inflate selected totals.
  result=analyzeSicofLoans(source([row(),row({source_row:3,date:'2025-12-15'}),row({source_row:4,loan_id:'009',fund:'Raw other fund'})]),{...options,funds:['Caja de Ahorro']});
  assert.equal(result.payments.length,1);assert.equal(result.loans[0].schedule.length,2);assert.equal(result.totals.reconciled_paid,697.50);
  result=analyzeSicofLoans(source([row({status:'SALDO ATRASADO',paid_to_date:300,expected_to_date:697.5,paid:300})]),options);
  assert.equal(result.loans[0].behavior,'OVERDUE');assert.equal(result.loans[0].arrears,397.5);
  assert.throws(()=>analyzeSicofLoans(source([]),{...options,from:'2026-12-31',to:'2026-01-01'}),/SICOF_LOAN_FILTER_INVALID/);
  const headers=['Fecha','Cuotas','ID','Folio','Nombre','Proceso','Fondo','tasa Qnal %','Plazo','Cantidad Prestamo','Total a pagar','Inicio de Descuento Quincenal','Monto Total Interes','Interes x #Plazo','Descuento Quincenal','Fecha final de pago','# de pagos','Finaliza el pago','Ha pagado HOY','Debería tener pagado HOY','Estatus del prestamo','MONTO PAGADO','Gasto Admon','TGA','Total Intereses a Pagar','Monto capital + Interes','Capital','Fecha Transferencia','Fecha descuento','Fecha de solicitud'];
  const body={ok:true,action:'read_sicof_financial',contract_version:SICOF_LOAN_CONTRACT,workbook_id:SICOF_WORKBOOK,sheet_id:SICOF_SHEET_ID,sheet_name:'HISTORIAL P V2',columns:SICOF_COLUMNS,headers,source_fingerprint:'A'.repeat(64),observed_at:'2026-06-30T12:00:00Z',rows:[{source_row:2,values:SICOF_FIELDS.map(field=>row()[field]??null)}]};
  const decoded=decodeSicofLoanSource(body);
  assert.equal(decoded.rows[0].folio,'00123');
  assert.deepEqual(decoded.headers,headers);assert.deepEqual(decoded.columns,SICOF_COLUMNS);
  assert.notEqual(decoded.headers,body.headers);assert.notEqual(decoded.columns,body.columns);
  assert.equal(decodeSicofLoanSource({...body,headers:headers.map((h,i)=>i===12?'Monto Total Interés':h)}).headers[12],'Monto Total Interés','preserve validated source labels exactly');
  assert.deepEqual(analyzeSicofLoans(decoded,{from:'2026-01-01',to:'2026-06-30',as_of:'2026-06-30'}),analyzeSicofLoans({...decoded,headers:undefined,columns:undefined},{from:'2026-01-01',to:'2026-06-30',as_of:'2026-06-30'}),'retained headers do not alter calculations');
  for(const patch of [{sheet_id:1},{headers:[]},{columns:[]},{source_fingerprint:''},{rows:[body.rows[0],body.rows[0]]},{observed_at:'invalid'}])assert.throws(()=>decodeSicofLoanSource({...body,...patch}),/SICOF_LOAN_SOURCE_UNAVAILABLE/);
  let calls=0,names=[];
  const env=name=>{names.push(name);return name==='FINANCIAL_LEGACY_API_URL'?'https://receiver.invalid':'isolated';};
  const fetcher=async(url,req)=>{calls++;if(url.includes('oauth2')){assert(req.body.get('scope').includes('script.webapp.deploy'));return{ok:true,json:async()=>({access_token:'isolated'})};}assert.deepEqual(JSON.parse(req.body),{action:'read_sicof_financial',secret:'isolated',contract_version:SICOF_LOAN_CONTRACT});return{ok:true,json:async()=>body};};
  assert.equal((await readSicofLoanSource(env,fetcher)).rows.length,1);assert.equal(calls,2);assert(names.every(n=>!n.includes('GOOGLE_VISIBILITY')));
  calls=0;await assert.rejects(()=>readSicofLoanSource(env,async()=>{calls++;return{ok:false,json:async()=>({error:'invalid_grant'})};}),/SICOF_LOAN_SOURCE_UNAVAILABLE/);assert.equal(calls,1);
  assert.throws(()=>decodeSicofLoanSource({...body,headers:[]}),/UNAVAILABLE_HEADERS$/);
  assert.throws(()=>decodeSicofLoanSource({...body,sheet_id:1}),/UNAVAILABLE_CONTRACT$/);
  assert.throws(()=>decodeSicofLoanSource({...body,rows:[body.rows[0],body.rows[0]]}),/UNAVAILABLE_ROWS$/);
  for(const [result,expected] of [[{ok:false,json:async()=>({})},'RECEIVER_HTTP'],[{ok:true,json:async()=>({ok:false,error:'UNAUTHORIZED'})},'RECEIVER_UNAUTHORIZED'],[{ok:true,json:async()=>({ok:false,error:'SICOF_SOURCE_CHANGED_DURING_READ'})},'SOURCE_CHANGED'],[{ok:true,json:async()=>{throw Error('PRIVATE_RESPONSE_MUST_NOT_LEAK');}},'RECEIVER_JSON_FAILED']]){
    await assert.rejects(()=>readSicofLoanSource(env,async url=>url.includes('oauth2')?{ok:true,json:async()=>({access_token:'isolated'})}:result),error=>error.message==='SICOF_LOAN_SOURCE_UNAVAILABLE_'+expected);
  }
  await assert.rejects(()=>readSicofLoanSource(env,async url=>{if(url.includes('oauth2'))return{ok:true,json:async()=>({access_token:'isolated'})};throw Object.assign(Error('PRIVATE_URL_MUST_NOT_LEAK'),{name:'TimeoutError'});}),/UNAVAILABLE_RECEIVER_REQUEST_TIMEOUT$/);
  console.log(JSON.stringify({status:'PASS',checks:['exact source/identity','typed values and dates','N minus Z only with reconciled identities','cent conservation','zero is not collected','future projected separately','partial/overpayment unresolved','duplicate excluded and flagged','period/fund limits','uniform status without punctuality','OAuth isolation/no fallback'],externalWrites:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
