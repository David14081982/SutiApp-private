'use strict';
// Transport parity with the actual engine and UI decoder; synthetic data only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..');
(async()=>{
 const {calculateSicof}=await import('../supabase/functions/sicof/engine.mjs');
 const {analyzeSicofLoans}=await import('../supabase/functions/sicof/loan-calculation.mjs');
 const {decorateLoans,workspaceView,compactWorkspace}=await import('../supabase/functions/sicof/projection.mjs');
 const ui=fs.readFileSync(path.join(root,'app/sicof-admin.jsx'),'utf8');
 const decoder=ui.slice(ui.indexOf('  function expandWorkspace('),ui.indexOf('  const h = React.createElement;'));
 assert(decoder.includes('SICOF_WORKSPACE_COMPACT_V1'));
 const expand=vm.runInNewContext('('+decoder.trim()+')');
 const settings={src:'todos',selFunds:[],pay:98,method:'avg',periodIni:'2026-07-01',periodFin:'2026-12-31',minm:6,exterm:true,exmin:true,warn:1000,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'adeudo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const participants=Array.from({length:30},(_,i)=>{
  const id='person-'+i,folio=String(i).padStart(5,'0');
  const transactions=Array.from({length:30},(_,j)=>({id:id+'-tx-'+j,transaction_type:'CONTRIBUTION',component:'CAPITAL',direction:'CREDIT',amount:100,effective_date:'2026-07-15',contribution_date:'2026-07-15'}));
  const movements=transactions.map(t=>({...t,transaction_id:t.id,type:t.transaction_type,origins:[{origin_key:'2026-S2',amount:100}]}));
  const periods=Array.from({length:6},(_,j)=>({origin_key:(2024+Math.floor(j/2))+'-S'+(j%2+1),period_year:2024+Math.floor(j/2),semester:j%2+1,component:'CAPITAL',recognized:500,withdrawn:0,remaining:500,origin_state:'CLASSIFIED'}));
  return{id,affiliate_id:id,folio,name:'Synthetic '+folio,identity_resolved:true,certified:true,certified_as_of:'2025-12-31',enrollment:{status:'ACTIVE',frequency:'BIWEEKLY',enrollment_started_at:'2025-01-01'},eligibility:{complete:true,policy_reasons:[]},history:[],transactions,composition:{complete:true,periods,movements,balances:{capital:3000,yield_amount:0,total:3000,available:3000},as_of_balance:{capital:3000,yield_amount:0,total:3000}}};
 });
 const source={source:'ISOLATED',observed_at:'2026-10-03T12:00:00Z',source_fingerprint:'a'.repeat(64),rows:participants.flatMap((p,i)=>[0,1,2].map(j=>({source_row:2+i*3+j,date:'2026-0'+(7+j)+'-15',paid:111,loan_id:'loan-'+i,folio:p.folio,name:p.name,fund:i%2?'Extra':'Caja de Ahorro',term:3,principal:300,total_due:333,loan_charges:30,scheduled_charges:10,expected:111,status:'AL CORRIENTE',paid_to_date:333,expected_to_date:333,scheduled_admin_fee:1,admin_fee_total:3,interest_total:30,principal_interest_total:330,scheduled_capital:100})))};
 const context={today:'2026-10-03',as_of:'2026-10-03',from:settings.periodIni,to:settings.periodFin,participants,periods:[],scenarios:[],preferences:{},can_export:true,report:null};
 source.date_semantics='AMORTIZATION_DATE_NOT_RECEIPT_DATE';
 const analysis=decorateLoans(analyzeSicofLoans(source,{from:context.from,to:context.to,as_of:context.today}));
 const result=calculateSicof(context,analysis,{settings,costs:[],bank:{amount:null}});result.fingerprint='synthetic-fingerprint';
 const original={workspace:workspaceView(context,analysis),result};
 const before=JSON.stringify(original),started=performance.now(),packed=compactWorkspace(original),packMs=performance.now()-started;
 assert.equal(JSON.stringify(original),before,'packing must not mutate source/results');
 const wire=JSON.parse(JSON.stringify(packed)),decoded=JSON.parse(JSON.stringify(expand(wire)));
 const expected=JSON.parse(before);delete expected.workspace.participants;
 assert.deepEqual(decoded,expected,'all existing UI fields, amounts and details survive actual JSON transport');
 assert.equal(wire.report_details.length,participants.length);
 assert.equal(wire.workspace.loans[0].schedule.encoding,'SICOF_ROWS_V1');
 assert.equal(wire.workspace.payments.encoding,'SICOF_ROWS_V1');
 assert(wire.row_schemas.length>=2);
 assert.equal(wire.result.rows[0].loans,undefined);assert.equal(wire.workspace.participants,undefined);
 assert.deepEqual(wire.result.rows[0].loan_indexes,[0]);
 const bytesBefore=Buffer.byteLength(before),bytesAfter=Buffer.byteLength(JSON.stringify(wire));assert(bytesAfter<bytesBefore*.5,'repeat-heavy source must shrink by at least half');
 for(const mutate of [w=>{w.wire_version='UNSUPPORTED';},w=>{w.report_details=[];},w=>{w.workspace.report.rows[0].detail_index=-1;},w=>{w.report_details[0].forged='bad';},w=>{w.result.rows[0].loan_indexes=[999999];},w=>{w.result.rows[0].loan_indexes=[1];}]){const invalid=structuredClone(wire);mutate(invalid);assert.throws(()=>expand(invalid),/SICOF_RESPONSE_INVALID/);}
 for(const mutate of [
  w=>{w.row_schemas=null;},w=>{w.row_schemas[0].push(w.row_schemas[0][0]);},w=>{w.row_schemas[0][0]='__proto__';},
  w=>{w.row_schemas[0][0]='constructor';},w=>{w.row_schemas[0][0]='prototype';},w=>{w.row_schemas[0][0]=1;},
  w=>{w.row_schemas[0][0]='invalid.key';},w=>{w.row_schemas.push(w.row_schemas[0]);},
  w=>{w.workspace.payments.encoding='OTHER';},w=>{w.workspace.payments.extra=true;},
  w=>{w.workspace.payments.rows[0][0]=-1;},w=>{w.workspace.payments.rows[0][0]=1.5;},
  w=>{w.workspace.payments.rows[0][0]=w.row_schemas.length;},w=>{w.workspace.payments.rows[0].pop();},
  w=>{w.workspace.payments.rows[0].push(null);},w=>{w.workspace.payments.rows[0]=null;},
  w=>{w.workspace.loans[0].schedule.rows[0][0]=999999;},w=>{w.workspace.loans[0].schedule={rows:[]};},
  w=>{w.workspace.payments=[JSON.parse('{"__proto__":null}')];}
 ]){const invalid=structuredClone(wire);mutate(invalid);assert.throws(()=>expand(invalid),/SICOF_RESPONSE_INVALID/);}
 assert.equal(expand(original),original,'older uncompressed responses remain supported');
 const oldCompact=structuredClone(wire);delete oldCompact.row_schemas;
 oldCompact.workspace.loans=JSON.parse(before).workspace.loans;oldCompact.workspace.payments=JSON.parse(before).workspace.payments;
 assert.deepEqual(JSON.parse(JSON.stringify(expand(oldCompact))),expected,'older compact object rows remain supported');
 // Different key orders/presence use distinct schemas; missing is never null.
 const mixedLoan={id:'synthetic',folio:'00001',schedule:[{date:null,paid:0,future:false,label:''},{paid:2,date:'2026-01-01',issues:[]},{}]};
 const mixed={workspace:{participants:[],loans:[mixedLoan],payments:[{paid:0},{paid:null},{future:false}],report:{rows:[]}},result:{rows:[{f:'00001',loans:[mixedLoan]}]}};
 const mixedBefore=JSON.stringify(mixed),mixedPacked=compactWorkspace(mixed);
 assert.equal(JSON.stringify(mixed),mixedBefore);
 const mixedExpanded=JSON.parse(JSON.stringify(expand(JSON.parse(JSON.stringify(mixedPacked))))),mixedExpected=JSON.parse(mixedBefore);delete mixedExpected.workspace.participants;
 assert.deepEqual(mixedExpanded,mixedExpected);assert(mixedPacked.row_schemas.length>=5);
 assert.equal(Object.prototype.hasOwnProperty.call(mixedExpanded.workspace.payments[2],'paid'),false);
 assert.equal(mixedExpanded.workspace.payments[1].paid,null);
 assert.equal(mixedExpanded.workspace.loans[0].schedule[0].paid,0);assert.equal(mixedExpanded.workspace.loans[0].schedule[0].future,false);
 assert.equal(mixedExpanded.workspace.loans[0].schedule[0].label,'');
 mixedLoan.schedule[0].optional=undefined;mixed.workspace.payments[0].optional=undefined;
 const sparsePacked=compactWorkspace(mixed);assert(Array.isArray(sparsePacked.workspace.loans[0].schedule));assert(Array.isArray(sparsePacked.workspace.payments));
 const sparseExpanded=expand(sparsePacked);
 assert(Object.prototype.hasOwnProperty.call(sparseExpanded.workspace.loans[0].schedule[0],'optional'));
 assert.equal(sparseExpanded.workspace.loans[0].schedule[0].optional,undefined);
 const sparseExpected=JSON.parse(JSON.stringify(mixed));delete sparseExpected.workspace.participants;
 assert.deepEqual(JSON.parse(JSON.stringify(expand(JSON.parse(JSON.stringify(sparsePacked))))),sparseExpected,'undefined fields retain original JSON omission');
 const attack={...mixed,workspace:{...mixed.workspace,payments:[JSON.parse('{"__proto__":null}')]}};
 assert.throws(()=>compactWorkspace(attack),/SICOF_WORKSPACE_INVALID/);
 const expandedReferences=expand(wire);
 assert.equal(expandedReferences.result.rows[0].loans[0],expandedReferences.workspace.loans[0],'result uses the rebuilt loan and schedule objects');
 const unavailable={workspace:workspaceView(context,null),result:null,calculation_error:'SICOF_LOAN_SOURCE_UNAVAILABLE'};
 const outageExpected=JSON.parse(JSON.stringify(unavailable));delete outageExpected.workspace.participants;
 assert.deepEqual(JSON.parse(JSON.stringify(expand(JSON.parse(JSON.stringify(compactWorkspace(unavailable)))))),outageExpected);
 const variant=structuredClone(original);variant.workspace.loans=analysis.loans;variant.result=result;
 variant.workspace.report.rows[1].movements=[{type:'WITHDRAWAL',amount:1}];
 const altered=JSON.parse(JSON.stringify(expand(JSON.parse(JSON.stringify(compactWorkspace(variant))))));
 assert.deepEqual(altered.workspace.report,variant.workspace.report,'different details for a participant are never merged');
 const proof={status:'PASS',checks:['actual engine and UI decoder parity','all details and fingerprints preserved','no input mutations','no extra source calls','unavailable source remains explicit','different details never merge','invalid references fail','old response compatibility','columnar schedule/payments preserve types and heterogeneous keys','undefined fields use exact object rows','malformed schemas/lengths and prototype keys rejected','result references rebuilt schedule objects'],participants:participants.length,reportRows:original.workspace.report.rows.length,bytesBefore,bytesAfter,reduction_percent:Math.round((1-bytesAfter/bytesBefore)*10000)/100,pack_ms:Math.round(packMs*100)/100,externalQueries:0,financialWrites:0};
 const dir=path.join(root,'.tmp/finance-read-performance');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'payload.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
})().catch(e=>{console.error(e);process.exitCode=1;});
