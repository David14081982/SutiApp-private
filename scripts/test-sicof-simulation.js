'use strict';
// Independent server-path comparison; only synthetic, in-memory observations.
const assert=require('assert/strict');
(async()=>{
 const {createSimulationSeed,executeSimulation,validateSimulationBasis,SIMULATION_VERSION}=await import('../supabase/functions/sicof/simulation.mjs');
 const {calculateSicof,fingerprint}=await import('../supabase/functions/sicof/engine.mjs');
 const {analyzeSicofLoans}=await import('../supabase/functions/sicof/loan-calculation.mjs');
 const {decorateLoans,workspaceView,compactWorkspace}=await import('../supabase/functions/sicof/projection.mjs');
 const now=Date.parse('2026-10-03T12:00:00.000Z'),today='2026-10-03',iso=ms=>new Date(ms).toISOString();
 const settings={src:'caja',selFunds:[],pay:90,method:'end',periodIni:'2026-07-01',periodFin:'2026-12-31',minm:6,exterm:true,exmin:true,warn:1000,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const participants=Array.from({length:4},(_,index)=>{
  const id='person-'+index,folio=String(index+1).padStart(5,'0');
  const transactions=[{id:id+'-1',component:'CAPITAL',direction:'CREDIT',amount:1000,effective_date:'2026-07-01',contribution_date:'2026-07-01',transaction_type:'CONTRIBUTION'},
   {id:id+'-2',component:'CAPITAL',direction:'CREDIT',amount:500,effective_date:'2026-09-15',contribution_date:'2026-09-15',transaction_type:'CONTRIBUTION'},
   {id:id+'-3',component:'CAPITAL',direction:'DEBIT',amount:100,effective_date:'2026-09-30',transaction_type:'WITHDRAWAL'},
   {id:id+'-4',component:'YIELD',direction:'CREDIT',amount:10,effective_date:'2026-06-30',transaction_type:'YIELD_CREDIT'}].map(t=>({...t,origins:[{origin_key:t.component==='CAPITAL'?'2026-S2':'2026-S1',amount:t.amount}]}));
  const movements=transactions.map(t=>({...t,transaction_id:t.id,type:t.transaction_type}));
  return{id,affiliate_id:id,folio,name:'Synthetic '+folio,identity_resolved:index!==3,certified:true,certified_as_of:'2025-12-31',enrollment:{id:id+'-e',status:'ACTIVE',frequency:'TWICE_MONTHLY',enrollment_started_at:'2025-01-01'},
   eligibility:{complete:index!==2,reasons:index===2?['CONTRIBUTION_CONFLICT']:[],policy_reasons:index===1?['SHORT_CONTRIBUTION']:[]},transactions,history:[{date:'2026-07-15',amount:index===1?0:100,expected:100}],
   composition:{complete:true,as_of:today,as_of_balance:{capital:1400,yield_amount:10,total:1410},balances:{capital:1400,yield_amount:10,total:1410,available:1300,held:110},movements,
    periods:[{origin_key:'2026-S2',period_year:2026,semester:2,component:'CAPITAL',recognized:1500,withdrawn:100,adjustments:0,remaining:1400,origin_state:'CLASSIFIED'},{origin_key:'2026-S1',period_year:2026,semester:1,component:'YIELD',recognized:10,withdrawn:0,adjustments:0,remaining:10,origin_state:'CLASSIFIED'}]}};
 });
 const rows=[],add=(date,loan,folio,fund,overrides={})=>rows.push({source_row:rows.length+2,date,loan_id:loan,folio,name:'Synthetic loan',fund,paid:date&&date>today?0:110,expected:110,term:5,principal:500,total_due:550,loan_charges:50,scheduled_charges:10,scheduled_admin_fee:1,admin_fee_total:5,interest_total:45,principal_interest_total:545,scheduled_capital:100,paid_to_date:110,expected_to_date:110,status:'AL CORRIENTE',...overrides});
 for(const [index,p] of participants.entries())for(const d of ['2026-07-15','2026-10-15','2026-12-04','2026-12-05','2026-12-31'])add(d,'loan-'+index,p.folio,index===0?'Caja de Ahorro':index===1?'Extra':'Other');
 add('2026-12-04','duplicate','extra-folio','Extra');add('2026-12-04','duplicate','extra-folio','Extra');
 add(null,'unknown-date','unknown-folio','',{paid:12.345});
 add('2026-08-15','negative','negative-folio','Extra',{paid:-1});
 add('2026-08-15','unknown-paid','unknown-paid-folio','Extra',{paid:null});
 add('2026-08-15','large-review','large-folio','Extra',{paid:100000000001,expected:null});
 add('2027-01-15','next-year','other-folio','Other');
 const source={source:'ISOLATED_AUTHORIZED_SOURCE',source_fingerprint:'a'.repeat(64),observed_at:iso(now-1000),date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE',rows,cache_meta:{state:'READY',expires_at:iso(now+299000)}};
 const ctx={today,as_of:today,from:settings.periodIni,to:settings.periodFin,participants,periods:[],scenarios:[],preferences:{},can_export:true,can_configure:true,report:null,fingerprint:'b'.repeat(32)};
 const analysis=decorateLoans(analyzeSicofLoans(source,{from:ctx.from,to:ctx.to,as_of:today})),initial=workspaceView(ctx,analysis);
 initial.source={...initial.source,expires_at:source.cache_meta.expires_at,state:'READY',version:1};
 delete initial.participants; // Actual compact responses send participants in seed only.
 const seed=createSimulationSeed(ctx,analysis,source,now);
 assert.equal(seed.version,SIMULATION_VERSION);assert.equal(seed.expires_at,source.cache_meta.expires_at);
 assert.deepEqual(Object.keys(seed.context).sort(),['participants','today','as_of','from','to','fingerprint'].sort());
 assert.deepEqual(Object.keys(seed.basis).sort(),['from','to','today','as_of'].sort());
 assert.equal(seed.rows,undefined);assert.equal(seed.source,undefined);assert.equal(seed.analysisMetadata.rows,undefined);
 const original=JSON.stringify({seed,initial,ctx,source}),before=performance.now();
 const cases=[];
 for(const src of ['caja','sel','todos'])for(const method of ['end','avg'])for(const cutoff of ['2026-12-04','2026-12-31'])cases.push({...settings,src,selFunds:src==='sel'?['Extra']:[],method,periodFin:cutoff});
 cases.push({...settings,periodFin:today},{...settings,yieldMode:'previous'},{...settings,yieldMode:'selected',yieldPeriods:['2026-S1']},{...settings,capitalBasis:'period'},
  {...settings,exterm:false,exmin:false,exConsec:true,consecN:1,loanEffect:'rendimiento',retScope:'adeudo',pay:98});
 for(const variant of cases){
  const input={settings:variant,costs:[{id:'cost',concept:'  Isolated cost  ',amount:1.25,source:'pool',status:'estimated',date:null}],bank:{amount:1000,declaredBy:'Isolated admin',date:today}};
  const currentAnalysis=decorateLoans(analyzeSicofLoans(source,{from:variant.periodIni,to:variant.periodFin,as_of:today}));
  const currentContext={...ctx,from:variant.periodIni,to:variant.periodFin};
  const expected=calculateSicof(currentContext,currentAnalysis,input);
  expected.fingerprint=await fingerprint({engine:expected.engine_version,settings:expected.settings,costs:expected.costs,bank:expected.bank,context:ctx.fingerprint,loans:analysis.source_fingerprint});
  const expectedWorkspace=workspaceView(currentContext,currentAnalysis);delete expectedWorkspace.participants;expectedWorkspace.source={...expectedWorkspace.source,expires_at:source.cache_meta.expires_at,state:'READY',version:1};
  const actual=await executeSimulation(seed,initial,input,{now,today});
  assert.deepEqual(actual.result,expected,'identical engine result and fingerprint for '+JSON.stringify(variant));
  assert.deepEqual(actual.workspace,expectedWorkspace,'identical workspace analysis for '+JSON.stringify(variant));
  assert.equal(actual.workspace.report,initial.report,'same savings interval evidence and report reused');
  assert.deepEqual(actual.basis,seed.basis);
  assert.equal(actual.workspace.loans.length,initial.loans.length,'all-fund loan evidence retained');
  assert.equal(actual.workspace.loans.find(l=>l.id==='loan-0').schedule.find(p=>p.date==='2026-12-04').in_period,variant.periodFin>='2026-12-04');
 }
 assert.equal(JSON.stringify({seed,initial,ctx,source}),original,'simulation leaves authorized inputs unchanged');
 const compact=compactWorkspace({workspace:initial,result:null,simulation:seed});assert.equal(compact.simulation,seed,'existing compact envelope preserves seed');
 for(const variant of [{...settings,periodIni:'2026-08-01'},{...settings,periodFin:'2026-09-30'},{...settings,periodFin:'2027-01-01'}])
  await assert.rejects(()=>executeSimulation(seed,initial,{settings:variant},{now,today}),/SICOF_SIMULATION_RANGE_REQUIRED/);
 for(const basis of [{...seed.basis,extra:true},{...seed.basis,from:'bad'},{...seed.basis,as_of:'2026-10-02'},{...seed.basis,today:'2026-10-02'},{from:ctx.from,to:ctx.to,today}])
  assert.throws(()=>validateSimulationBasis(basis,settings,today),/SICOF_SIMULATION_RANGE_REQUIRED/);
 const historical={from:'2026-07-01',to:'2026-09-30',as_of:'2026-09-30',today};
 assert.deepEqual(validateSimulationBasis(historical,{...settings,periodFin:'2026-09-30'},today),historical);
 assert.throws(()=>validateSimulationBasis(historical,{...settings,periodFin:'2026-09-15'},today),/SICOF_SIMULATION_RANGE_REQUIRED/);
 const historicalContext={...ctx,...historical,fingerprint:'d'.repeat(32)},historicalSettings={...settings,periodFin:historical.to,pay:98};
 const historicalAnalysis=decorateLoans(analyzeSicofLoans(source,{from:historical.from,to:historical.to,as_of:today}));
 const historicalWorkspace=workspaceView(historicalContext,historicalAnalysis),historicalSeed=createSimulationSeed(historicalContext,historicalAnalysis,source,now);
 const historicalResult=await executeSimulation(historicalSeed,historicalWorkspace,{settings:historicalSettings},{now,today});
 const historicalExpected=calculateSicof(historicalContext,historicalAnalysis,{settings:historicalSettings});
 historicalExpected.fingerprint=await fingerprint({engine:historicalExpected.engine_version,settings:historicalExpected.settings,costs:historicalExpected.costs,bank:historicalExpected.bank,context:historicalContext.fingerprint,loans:source.source_fingerprint});
 assert.deepEqual(historicalResult.result,historicalExpected);assert.deepEqual(historicalResult.workspace,historicalWorkspace);
 await assert.rejects(()=>executeSimulation(seed,initial,{settings:{...settings,pay:101}},{now,today}),/SICOF_SETTING_INVALID/);
 await assert.rejects(()=>executeSimulation(seed,initial,{settings:{...settings,capitalBasis:'period',periodFin:'2026-12-04'}},{now,today}),/SICOF_FULL_SEMESTER_REQUIRED/);
 await assert.rejects(()=>executeSimulation(seed,initial,{settings},{now:now+299000,today}),/SICOF_SIMULATION_EXPIRED/);
 await assert.rejects(()=>executeSimulation(seed,initial,{settings},{now,today:'2026-10-04'}),/SICOF_SIMULATION_DAY_CHANGED/);
 let ticks=0;await assert.rejects(()=>executeSimulation(seed,initial,{settings},{now:()=>++ticks===1?now:now+299000,today}),/SICOF_SIMULATION_EXPIRED/);assert.equal(ticks,2);
 for(const patch of [{version:'other'},{context:{...seed.context,fingerprint:'bad'}},{context:{...seed.context,to:'2027-01-01'}},{expires_at:'bad'},{analysisMetadata:{...seed.analysisMetadata,observed_at:'bad'}}])
  await assert.rejects(()=>executeSimulation({...seed,...patch},initial,{settings},{now,today}),/SICOF_SIMULATION_INVALID/);
 await assert.rejects(()=>executeSimulation(seed,{...initial,source:{...initial.source,fingerprint:'c'.repeat(64)}},{settings},{now,today}),/SICOF_SIMULATION_INVALID/);
 assert.throws(()=>createSimulationSeed(ctx,analysis,source,NaN),/SICOF_SIMULATION_INVALID/);
 assert.throws(()=>createSimulationSeed(ctx,analysis,{...source,observed_at:'invalid'},now),/SICOF_SIMULATION_INVALID/);
 assert.throws(()=>createSimulationSeed(ctx,analysis,{...source,source_fingerprint:'c'.repeat(64)},now),/SICOF_SIMULATION_INVALID/);
 assert.throws(()=>createSimulationSeed(ctx,analysis,{...source,cache_meta:{state:'READY',expires_at:iso(now)}},now),/SICOF_SIMULATION_EXPIRED/);
 assert.throws(()=>createSimulationSeed(ctx,{...analysis,period:{...analysis.period,to:'2027-01-01'}},source,now),/SICOF_SIMULATION_INVALID/);
 console.log(JSON.stringify({status:'PASS',cases:cases.length,sourceRows:rows.length,elapsed_ms:Math.round((performance.now()-before)*100)/100,checks:['same engine result and fingerprint as independent server analysis','same workspace fields and source order','inclusive December 4 versus December 5 and original December 31','fund selection changes retain all loan evidence','source duplicate/null/negative/huge-review amount semantics preserved','unchanged savings reports and exclusions','future same-start range only and historical same-range settings allowed','invalid policy remains invalid','expiry and day changes reject including expiry during calculation','invalid or mixed seed/source rejected','no authorized input mutation','compact envelope retains seed'],externalQueries:0,financialWrites:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
