'use strict';
// Isolated handler + real engine/simulation/XLSX. Synthetic observations only;
// service writes are captured commands, never network/database operations.
const assert=require('assert/strict');
(async()=>{
 const {dispatchSicof}=await import('../supabase/functions/sicof/handler.mjs');
 const {executeSimulation,SIMULATION_VERSION}=await import('../supabase/functions/sicof/simulation.mjs');
 const {calculateSicof,fingerprint}=await import('../supabase/functions/sicof/engine.mjs');
 const {analyzeSicofLoans}=await import('../supabase/functions/sicof/loan-calculation.mjs');
 const {decorateLoans}=await import('../supabase/functions/sicof/projection.mjs');
 const {requireCurrentSicofSource}=await import('../supabase/functions/sicof/source-cache.mjs');
 const {SICOF_FIELDS,SICOF_COLUMNS}=await import('../supabase/functions/sicof/loan-source.mjs');
 const ExcelJS=require('../.tmp/sicof/deps/node_modules/exceljs');
 const actor='00000000-0000-4000-8000-000000000001',affiliate='00000000-0000-4000-8000-000000000002',session='00000000-0000-4000-8000-000000000003',key='00000000-0000-4000-8000-000000000004';
 const today='2026-10-03',start='2026-07-01',end='2026-12-31',observed='2026-10-03T12:00:00.000Z';
 const settings={src:'caja',selFunds:[],pay:90,method:'avg',periodIni:start,periodFin:end,minm:6,exterm:true,exmin:true,warn:1000,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const raw=(i,date,fund)=>({...Object.fromEntries(SICOF_FIELDS.map(k=>[k,null])),source_row:i+2,date,paid:date>today?0:110,loan_id:'L'+i,folio:'00123',name:'Synthetic',process:'1',rate:.1,discount_start:date,discount_end:date,fund,term:1,principal:100,total_due:110,loan_charges:10,scheduled_charges:10,expected:110,status:'AL CORRIENTE',paid_to_date:0,expected_to_date:0,scheduled_admin_fee:0,admin_fee_total:0,interest_total:10,principal_interest_total:110,scheduled_capital:100});
 const source={source:'isolated-source',headers:Array.from({length:30},(_,i)=>'Synthetic '+i),columns:SICOF_COLUMNS,observed_at:observed,source_fingerprint:'a'.repeat(64),date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE',cache_meta:{state:'READY',observed_at:observed,expires_at:'2026-10-03T12:05:00.000Z'},rows:[raw(0,'2026-06-30','Caja de Ahorro'),raw(1,'2026-07-01','Caja de Ahorro'),raw(2,'2026-10-01','Caja de Ahorro'),raw(3,'2026-12-04','Caja de Ahorro'),raw(4,'2026-12-05','Caja de Ahorro'),raw(5,'2027-01-01','Caja de Ahorro'),raw(6,'2026-12-04','Extra'),raw(7,'2026-12-04','Other')]};
 const person={id:affiliate,affiliate_id:affiliate,folio:'00123',name:'Synthetic',identity_resolved:true,certified:true,certified_as_of:'2025-12-31',enrollment:{id:key,status:'ACTIVE',enrollment_started_at:'2025-01-01',first_actual_contribution_date:'2025-01-15',frequency:'TWICE_MONTHLY'},eligibility:{complete:true,reasons:[],policy_reasons:[]},history:[],transactions:[{id:'opening',enrollment_id:key,component:'CAPITAL',amount:1000,direction:'CREDIT',transaction_type:'REGULARIZATION',effective_date:'2025-12-31',origins:[{origin_key:'2025',amount:1000}]}],composition:{as_of:today,as_of_complete:true,as_of_supported_from:'2025-12-31',balances:{capital:1000,yield_amount:0,total:1000,available:1000},as_of_balance:{capital:1000,yield_amount:0,total:1000},movements:[],periods:[]}};
 const context={context:{actor,session,effective_affiliate:affiliate},today,as_of:today,from:start,to:end,fingerprint:'b'.repeat(32),can_configure:true,can_export:true,participants:[person],periods:[],existing_period_previews:[],scenarios:[],preferences:{},report:null};
 let authDenied=false,rpcDenied=false,sourceDenied=false,clock=Date.parse(observed),day=today,reads=0,excelLoads=0,newContextMutation=null;
 const calls=[],writes=[],checks=[];
 const contextFor=args=>{const c=structuredClone(context);c.from=args.p_from;c.to=args.p_to;c.as_of=c.to<c.today?c.to:c.today;if(c.from!==context.from||c.to!==context.to){c.fingerprint='d'.repeat(32);if(newContextMutation)newContextMutation(c);}return c;};
 const deps={env:()=>'',today:()=>day,now:()=>clock,sourceReader:async()=>{reads++;if(sourceDenied)throw Error('SICOF_LOAN_SOURCE_UNAVAILABLE');requireCurrentSicofSource(source,deps);return structuredClone(source);},
  loadExcelJS:async()=>{excelLoads++;return ExcelJS;},createUserClient:()=>({auth:{getUser:async()=>authDenied?{error:{message:'denied'}}:{data:{user:{id:actor}}}},rpc:async(name,args)=>{calls.push({name,args});if(rpcDenied)return{error:{message:'SICOF_ADMIN_DENIED'}};assert.equal(name,'get_admin_sicof_context');return{data:contextFor(args)};}}),
  createServiceClient:()=>({rpc:async(name,args)=>{assert.equal(name,'service_save_sicof_scenario');writes.push({name,args});return{data:{saved:true}};}})};
 const run=body=>dispatchSicof(body,'Bearer isolated',deps);
 const input={settings,costs:[],bank:{amount:null}};
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 let initial,preview,simulationInput,command;
 await test('opt-in seed shares exactly one authorized source/context and survives compact transport',async()=>{
  const before={calls:calls.length,reads};initial=await run({action:'WORKSPACE',...input,simulation:true});
  assert.equal(calls.length-before.calls,1);assert.equal(reads-before.reads,1);assert.equal(initial.data.simulation.version,SIMULATION_VERSION);assert.deepEqual(initial.data.simulation.context.participants,context.participants);
  assert.equal(initial.data.simulation.expires_at,source.cache_meta.expires_at);assert(!Object.hasOwn(initial.data.simulation,'rows'));
  const compact=await run({action:'WORKSPACE',...input,simulation:true,compact:true});assert(compact.data.simulation);assert.equal(compact.data.workspace.participants,undefined);assert.deepEqual(compact.data.simulation,initial.data.simulation);
  const prior=await run({action:'WORKSPACE',...input});assert(!Object.hasOwn(prior.data,'simulation'));assert.deepEqual(prior.data.result,initial.data.result);
 });
 await test('December 4 local result is accepted by server export with original context fingerprint',async()=>{
  simulationInput={...input,settings:{...settings,periodFin:'2026-12-04',pay:98}};
  const before={calls:calls.length,reads};preview=await executeSimulation(initial.data.simulation,initial.data.workspace,simulationInput,{now:clock,today});assert.equal(calls.length,before.calls);assert.equal(reads,before.reads);
  command={action:'EXPORT',kind:'base_calculo',...simulationInput,simulation_basis:preview.basis,fingerprint:preview.result.fingerprint};
  const exported=await run(command);assert.deepEqual(calls.at(-1).args,{p_from:start,p_to:end});assert.equal(reads,before.reads+1);
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(exported.data.base64,'base64'));const sheet=book.worksheets[0];assert.equal(book.worksheets.length,1);assert.equal(sheet.columnCount,15);
  assert.deepEqual(sheet.getColumn(1).values.slice(2),['2026-07-01','2026-10-01','2026-12-04']);
  assert.equal(sheet.getCell('D2').value,'00123');assert.equal(writes.length,0);
  for(const [src,selFunds,count]of [['sel',['Extra'],4],['todos',[],5]]){const local=await executeSimulation(initial.data.simulation,initial.data.workspace,{...simulationInput,settings:{...simulationInput.settings,src,selFunds}},{now:clock,today});const file=await run({...command,settings:local.result.settings,fingerprint:local.result.fingerprint});const wb=new ExcelJS.Workbook();await wb.xlsx.load(Buffer.from(file.data.base64,'base64'));assert.equal(wb.worksheets[0].rowCount,count+1);}
 });
 await test('malformed range basis fails before a context/source lookup',async()=>{
  const before={calls:calls.length,reads};for(const basis of [null,{}, {...preview.basis,extra:true},{...preview.basis,from:'2026-08-01'},{...preview.basis,as_of:'2026-10-02'},{...preview.basis,today:'2026-10-02'},{...preview.basis,to:'2026-12-03'}])await assert.rejects(()=>run({...command,simulation_basis:basis}),/SIMULATION_RANGE_REQUIRED/);
  await assert.rejects(()=>run({...command,settings:{...command.settings,periodFin:'2026-09-30'}}),/SIMULATION_RANGE_REQUIRED/);
  await assert.rejects(()=>run({action:'WORKSPACE',...input,simulation:'yes'}),/COMMAND_INVALID/);assert.equal(calls.length,before.calls);assert.equal(reads,before.reads);
 });
 await test('auth capabilities source/context/parameter tampering reject without export or write',async()=>{
  const before={reads,loads:excelLoads,writes:writes.length};authDenied=true;await assert.rejects(()=>run(command),/AUTH_REQUIRED/);authDenied=false;
  rpcDenied=true;await assert.rejects(()=>run(command),/ADMIN_DENIED/);rpcDenied=false;context.can_export=false;await assert.rejects(()=>run(command),/EXPORT_DENIED/);context.can_export=true;assert.equal(reads,before.reads);
  context.fingerprint='e'.repeat(32);await assert.rejects(()=>run(command),/SOURCE_CHANGED/);context.fingerprint='b'.repeat(32);
  source.source_fingerprint='f'.repeat(64);await assert.rejects(()=>run(command),/SOURCE_CHANGED/);source.source_fingerprint='a'.repeat(64);
  await assert.rejects(()=>run({...command,settings:{...command.settings,pay:97}}),/SOURCE_CHANGED/);await assert.rejects(()=>run({...command,fingerprint:'forged'}),/SOURCE_CHANGED/);
  await assert.rejects(()=>run({...command,result:preview.result}),/COMMAND_INVALID/);assert.equal(excelLoads,before.loads);assert.equal(writes.length,before.writes);
 });
 await test('saving changed cutoff uses exact canonical new-period fingerprint and writer dates',async()=>{
  const {kind,...save}=command;const beforeCalls=calls.length,beforeReads=reads;await run({...save,action:'SAVE_SCENARIO',key});
  assert.equal(calls.length-beforeCalls,2);assert.equal(reads-beforeReads,1);
  assert.deepEqual(calls.slice(-2).map(c=>c.args),[{p_from:start,p_to:end},{p_from:start,p_to:'2026-12-04'}]);
  const saved=writes.at(-1).args;assert.equal(saved.p_parameters.from,start);assert.equal(saved.p_parameters.to,'2026-12-04');assert.equal(saved.p_parameters.settings.periodFin,'2026-12-04');assert.equal(saved.p_context_fingerprint,'d'.repeat(32));
  assert.notEqual(saved.p_result.fingerprint,preview.result.fingerprint);
  const canonical=contextFor({p_from:start,p_to:'2026-12-04'}),analysis=decorateLoans(analyzeSicofLoans(source,{from:start,to:'2026-12-04',as_of:today}));
  const expected=calculateSicof(canonical,analysis,simulationInput);expected.fingerprint=await fingerprint({engine:expected.engine_version,settings:expected.settings,costs:expected.costs,bank:expected.bank,context:canonical.fingerprint,loans:source.source_fingerprint});
  assert.deepEqual(saved.p_result,expected);assert.equal(saved.p_actor,actor);assert.equal(saved.p_session,session);assert.equal(saved.p_effective_affiliate,affiliate);
 });
 await test('unchanged saved period retains one context read',async()=>{
  const beforeCalls=calls.length,beforeReads=reads;await run({action:'SAVE_SCENARIO',...input,simulation_basis:initial.data.simulation.basis,fingerprint:initial.data.result.fingerprint,key:crypto.randomUUID()});
  assert.equal(calls.length-beforeCalls,1);assert.equal(reads-beforeReads,1);assert.equal(writes.at(-1).args.p_parameters.to,end);assert.equal(writes.at(-1).args.p_context_fingerprint,context.fingerprint);
 });
 await test('new-period context conflict or revoked permission prevents scenario persistence',async()=>{
  const {kind,...save}=command;const beforeWrites=writes.length;
  const changes=[c=>{c.participants[0].transactions[0].amount=999;},c=>{c.periods=[{period_year:2026,semester:2,rate:.9}];},c=>{c.as_of='2026-10-02';},c=>{c.today='2026-10-04';},c=>{c.context.session='changed-session';},c=>{c.can_configure=false;}];
  for(const mutate of changes){newContextMutation=mutate;await assert.rejects(()=>run({...save,action:'SAVE_SCENARIO',key:crypto.randomUUID()}),/CONTEXT_CHANGED|ADMIN_DENIED/);assert.equal(writes.length,beforeWrites);}
  newContextMutation=null;context.can_configure=false;const beforeReads=reads;await assert.rejects(()=>run({...save,action:'SAVE_SCENARIO',key}),/ADMIN_DENIED/);assert.equal(reads,beforeReads);context.can_configure=true;
 });
 await test('source outage omits seed; expiry day change and invalid policy remain explicit',async()=>{
  sourceDenied=true;const missing=await run({action:'WORKSPACE',...input,simulation:true});sourceDenied=false;assert.equal(missing.data.result,null);assert(!Object.hasOwn(missing.data,'simulation'));assert.equal(missing.data.workspace.source.status,'UNAVAILABLE');
  const before={calls:calls.length,reads,loads:excelLoads};day='2026-10-04';await assert.rejects(()=>run(command),/SIMULATION_RANGE_REQUIRED/);day=today;
  await assert.rejects(()=>run({...command,settings:{...command.settings,capitalBasis:'period'}}),/FULL_SEMESTER_REQUIRED/);assert.equal(calls.length,before.calls);assert.equal(reads,before.reads);
  clock=Date.parse(source.cache_meta.expires_at);await assert.rejects(()=>run(command),/SOURCE_CACHE_STALE/);assert.equal(excelLoads,before.loads);clock=Date.parse(observed);
 });
 console.log(JSON.stringify({status:'PASS',checks,externalRequests:0,financialWrites:0,capturedScenarioCommands:writes.length,originalPeriod:end,selectedInclusiveCutoff:'2026-12-04'}));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
