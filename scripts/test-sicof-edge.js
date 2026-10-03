'use strict';
const assert=require('assert/strict');
(async()=>{
 const {dispatchSicof}=await import('../supabase/functions/sicof/handler.mjs');
 const {makeReports}=await import('../supabase/functions/sicof/projection.mjs');
 const actor='00000000-0000-4000-8000-000000000001',affiliate='00000000-0000-4000-8000-000000000002',session='00000000-0000-4000-8000-000000000003',key='00000000-0000-4000-8000-000000000004';
 const settings={src:'caja',selFunds:[],pay:90,method:'end',periodIni:'2026-01-01',periodFin:'2026-06-30',minm:6,exterm:true,exmin:true,warn:20,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const row={source_row:2,date:'2026-01-15',paid:110,loan_id:'001',folio:'00123',name:'Isolated',fund:'Caja de Ahorro',term:1,principal:100,total_due:110,loan_charges:10,scheduled_charges:10,expected:110,status:'AL CORRIENTE',paid_to_date:110,expected_to_date:110,scheduled_admin_fee:0,admin_fee_total:0,interest_total:10,principal_interest_total:110,scheduled_capital:100};
 const source={source:'isolated',observed_at:'2026-06-30T00:00:00Z',source_fingerprint:'a'.repeat(64),date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE',rows:[row]};
 const composition={as_of:'2026-06-30',version:'v1',complete:true,balances:{capital:80,yield_amount:10,total:90,available:85},as_of_balance:{capital:80,yield_amount:10,total:90},periods:[{origin_key:'2025',component:'CAPITAL',period_year:2025,semester:null,recognized:100,withdrawn:20,adjustments:0,remaining:80,origin_state:'CLASSIFIED'}],movements:[]};
 const p={id:affiliate,affiliate_id:affiliate,folio:'00123',name:'Synthetic',identity_resolved:true,certified:true,certified_as_of:'2025-12-31',enrollment:{status:'ACTIVE',enrollment_started_at:'2025-01-01'},eligibility:{complete:true},history:[],composition,
 transactions:[{id:'a',component:'CAPITAL',amount:100,direction:'CREDIT',transaction_type:'REGULARIZATION',effective_date:'2025-12-31'},{id:'w',component:'CAPITAL',amount:20,direction:'DEBIT',transaction_type:'WITHDRAWAL',effective_date:'2026-05-01'}]};
 const ctx={context:{actor,session,effective_affiliate:affiliate},today:'2026-06-30',as_of:'2026-06-30',from:settings.periodIni,to:settings.periodFin,can_configure:true,can_export:true,participants:[p],periods:[],scenarios:[],preferences:{},report:{id:key,rows:[{folio:'00123',cells:{A:'00123',C:100,D:10,E:110,J:0}}]},fingerprint:'b'.repeat(32)};
 let sourceReads=0,serviceWrites=0,denyAuth=false,denyRpc=false,failSource=false,canConfigure=true,seen=[];
 const deps={env:()=>'',today:()=>ctx.today,createUserClient:()=>({auth:{getUser:async()=>denyAuth?{error:'no'}:{data:{user:{id:actor}}}},rpc:async(name,args)=>{
  seen.push(name);if(denyRpc)return{error:{message:'SICOF_ADMIN_DENIED'}};
  if(name==='get_admin_sicof_context')return{data:{...ctx,can_configure:canConfigure}};
  if(name==='get_admin_sicof_behavior_context')return{data:{context:ctx.context,today:ctx.today,subjects:[{affiliate_id:affiliate,folio:'00123'}]}};
  if(name==='admin_archive_sicof_scenario')return{data:{archived:true,id:args.p_scenario_id}};
  if(name==='admin_save_sicof_preferences')return{data:args.p_value};
  if(name==='get_admin_sicof_report_template')return{data:{template_base64:btoa('isolated'),sha256:'wrong'}};
  throw Error('Unexpected RPC '+name);
 }}),createServiceClient:()=>({rpc:async(name,args)=>{assert.equal(name,'service_save_sicof_scenario');assert.equal(args.p_actor,actor);assert.equal(args.p_effective_affiliate,affiliate);assert.equal(args.p_result.status,'SIMULATION');serviceWrites++;return{data:{id:key,saved:true}};}}),
 sourceReader:async()=>{sourceReads++;if(failSource)throw Error('SICOF_LOAN_SOURCE_UNAVAILABLE');return source;}};
 const run=body=>dispatchSicof(body,'Bearer isolated',deps);
 denyAuth=true;await assert.rejects(()=>run({action:'LOAD'}),/AUTH_REQUIRED/);assert.equal(sourceReads,0);assert.equal(seen.length,0);denyAuth=false;
 denyRpc=true;await assert.rejects(()=>run({action:'LOAD'}),/ADMIN_DENIED/);assert.equal(sourceReads,0);denyRpc=false;
 await assert.rejects(()=>run({action:'CALCULATE',settings,snapshot:{evil:true}}),/COMMAND_INVALID/);assert.equal(sourceReads,0);
 let result=await run({action:'LOAD',from:settings.periodIni,to:settings.periodFin});assert.equal(result.data.loans[0].folio,'00123');assert.equal(result.data.report.rows[0].remaining,80);assert.equal(result.context.actor,actor);
 failSource=true;result=await run({action:'LOAD'});assert.equal(result.data.source.status,'UNAVAILABLE');assert.equal(result.data.loans,null);assert.equal(result.data.report.rows[0].remaining,80);
 await assert.rejects(()=>run({action:'CALCULATE',settings}),/LOAN_SOURCE_UNAVAILABLE/);failSource=false;
 result=await run({action:'CALCULATE',settings,costs:[],bank:{amount:null}});assert.equal(result.data.pool,9);assert.equal(result.data.rows[0].capital,80);assert.match(result.data.fingerprint,/^[0-9a-f]{64}$/);
 await assert.rejects(()=>run({action:'SAVE_SCENARIO',settings,key,fingerprint:'wrong'}),/SOURCE_CHANGED/);assert.equal(serviceWrites,0);
 canConfigure=false;await assert.rejects(()=>run({action:'SAVE_SCENARIO',settings,costs:[],bank:{amount:null},key,fingerprint:result.data.fingerprint}),/ADMIN_DENIED/);assert.equal(serviceWrites,0);canConfigure=true;
 await run({action:'SAVE_SCENARIO',settings,costs:[],bank:{amount:null},key,fingerprint:result.data.fingerprint});assert.equal(serviceWrites,1);
 const before=sourceReads;await run({action:'SAVE_PREFERENCES',texts:{title:'Private'},tabOrder:['resumen']});assert.equal(sourceReads,before);
 await run({action:'ARCHIVE_SCENARIO',id:key});assert.equal(sourceReads,before);
 const behavior=await run({action:'BEHAVIOR',affiliate_ids:[affiliate]});assert.equal(behavior.data[affiliate].status,'CURRENT');assert.equal(behavior.data[affiliate].score,null);assert.equal(behavior.data[affiliate].loans.length,1);
 const readCount=sourceReads;failSource=true;await assert.rejects(()=>run({action:'EXPORT',kind:'final_ahorro',filters:{historical:true}}),/TEMPLATE_CHANGED/);assert.equal(sourceReads,readCount);failSource=false;
 const report=makeReports(ctx);assert.equal(report.finalReport.rows[0].C,100);assert.equal(report.finalReport.rows[0].D,10);assert.equal(report.finalReport.rows[0].I,100);assert.equal(report.finalReport.rows[0].J,10);assert.equal(report.finalReport.rows[0].K,110);assert.equal(report.finalReport.rows[0].L,20);assert.equal(report.finalReport.rows[0].M,90);assert.equal(report.finalReport.rows[0].available,85);
 assert.equal(ctx.report.rows[0].cells.J,0);assert.equal(report.report.rows[0].semester,null);assert.equal(report.report.rows[0].available,null);
 assert.equal(report.report.balances[affiliate].available,85);assert.equal(report.report.balances[affiliate].as_of,ctx.today);
 await assert.rejects(()=>run({action:'EXPORT',kind:'final_ahorro',filters:{semester:'1'}}),/REPORT_FILTER_INVALID/);
 console.log('PASS SICOF Edge isolated: auth before source, capability gates, no fallback, no financial writes, source fingerprint, historical export independent of Google, canonical period/withdrawal report, exact Folio and preserved historic exclusion.');
})().catch(error=>{console.error(error);process.exitCode=1;});
