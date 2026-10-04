'use strict';
// Compare against the committed, frozen engine, not against another path in
// the edited module. Optional private captures never print their financial rows.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const baseline='c55ef8f237031dfa06c5149e063534414c1aa0f8';
const original=file=>execFileSync('git',['show',baseline+':'+file],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',maxBuffer:20*1024*1024});
const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;};
(async()=>{
 const old=await import('data:text/javascript;base64,'+Buffer.from(original('supabase/functions/sicof/engine.mjs')).toString('base64'));
 const current=await import(pathToFileURL(path.resolve(__dirname,'../supabase/functions/sicof/engine.mjs')));
 const settings={src:'caja',selFunds:[],pay:90,method:'end',periodIni:'2026-07-01',periodFin:'2026-12-31',minm:6,exterm:true,exmin:true,warn:20,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,anchorDate:'2026-07-01',capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const tx=(id,amount,effective_date,component='CAPITAL',direction='CREDIT',transaction_type='CONTRIBUTION',origins)=>({id,amount,effective_date,contribution_date:transaction_type==='CONTRIBUTION'?effective_date:null,component,direction,transaction_type,origins});
 const participants=Array.from({length:8},(_,i)=>({id:String(i),folio:String(i),name:'Synthetic '+i,identity_resolved:i!==5,certified:true,certified_as_of:'2025-12-31',
  enrollment:{enrollment_started_at:i===4?null:'2025-01-01',status:'ACTIVE',frequency:i===2?'MONTHLY':'TWICE_MONTHLY',terminated_at:i===3?'2026-11-15':null},
  eligibility:{complete:i!==6,reasons:i===6?['UNVERIFIED']:[],policy_reasons:i===7?['SHORT_CONTRIBUTION','EARLY_OR_EXTRAORDINARY_WITHDRAWAL']:[]},
  transactions:[tx(i+'a',100,'2025-01-01'),tx(i+'b',50,'2026-08-15'),tx(i+'c',10,'2026-09-30','CAPITAL','DEBIT','WITHDRAWAL',[{origin_key:'2025-S1',amount:5},{origin_key:'2026-S2',amount:5}]),tx(i+'y',5,'2026-06-30','YIELD','CREDIT','YIELD_CREDIT',[{origin_key:'2026-S1',amount:5}]),tx(i+'w',1,'2026-09-30','YIELD','DEBIT','WITHDRAWAL',[{origin_key:'2026-S1',amount:1}])],
  history:[{date:'2026-07-15',amount:0,expected:100},{date:'2026-07-30',amount:0,expected:100}],composition:{balances:{capital:140,yield_amount:4,available:144},movements:[],periods:[]}}));
 const context={today:'2026-10-03',from:settings.periodIni,to:settings.periodFin,as_of:'2026-10-03',fingerprint:'a'.repeat(32),participants};
 const analysis={source:'SYNTHETIC',source_fingerprint:'b'.repeat(64),payments:[
  {date:'2026-07-15',fund:'Caja de Ahorro',audit:'RECONCILED_SOURCE_PAYMENT',paid:100.02,interest:0.02,fee:0},
  {date:'2026-07-15',fund:'Other',audit:'RECONCILED_SOURCE_PAYMENT',paid:10.01,interest:5,fee:1},
  {date:'2026-12-31',fund:'Other',audit:'PROJECTED',projected_interest:1.11},
  {date:null,fund:'Other',audit:'REVIEW_REQUIRED',paid:null}],loans:[
  {folio:'1',fund:'Other',status:'SALDO ATRASADO',behavior:'OVERDUE',arrears:10,total:50,paid:20,schedule:[]},
  {folio:'6',fund:'Caja de Ahorro',status:null,behavior:'REVIEW_REQUIRED',arrears:0,total:null,paid:null,schedule:[]},
  {folio:'0',fund:'Caja de Ahorro',status:'AL CORRIENTE',behavior:'CURRENT',arrears:0,total:150,paid:100,schedule:[]}]};
 const costs=[{id:'r',concept:'  Reserve  ',amount:0.25,source:'reserve',status:'paid',date:'2026-09-01'},{id:'p',concept:'Pool',amount:0.01,source:'pool',status:'committed',date:null}];
 const variants=[];
 for(const method of ['end','avg'])for(const src of ['caja','sel','todos'])for(const pay of [0,1,50,98,100])variants.push({...settings,method,src,pay,selFunds:src==='sel'?['Other']:[]});
 for(const periodFin of ['2026-09-15','2026-10-03','2026-12-04','2026-12-31'])variants.push({...settings,periodFin,method:'avg'});
 variants.push({...settings,capitalBasis:'period'},{...settings,yieldMode:'previous'},{...settings,yieldMode:'selected',yieldPeriods:['2025','2026-S1']},
  {...settings,exmin:false,exterm:false,exConsec:true,consecN:2,retScope:'adeudo',loanEffect:'rendimiento',anchorOn:true,anchorDate:'2026-08-01'});
 deepFreeze(context);deepFreeze(analysis);
 const prepared=current.createPreparedCalculator(context,analysis);let compared=0,checks=0;
 async function compare(ctx,loans,input,calculator,label){
  let expected,oldError;try{expected=old.calculateSicof(ctx,loans,input);}catch(error){oldError=error.message;}
  for(const calculate of [()=>current.calculateSicof(ctx,loans,input),()=>calculator.calculate(input,loans)]){
   if(oldError){assert.throws(calculate,error=>error.message===oldError,label);continue;}
   const actual=calculate();assert.equal(JSON.stringify(actual)===JSON.stringify(expected),true,label+' exact serialized result');
   assert.equal(await current.fingerprint(actual),await old.fingerprint(expected),label+' exact financial fingerprint');
  }
  compared++;
 }
 for(const [i,variant] of variants.entries())await compare(context,analysis,{settings:variant,costs:i%2?costs:[],bank:i%3?{amount:null}:{amount:200,declaredBy:'Synthetic',date:'2026-10-03'}},prepared,'synthetic variant '+i);
 // Separate analyses must not reuse loan eligibility, amounts, references or charts.
 const revised={...analysis,loans:analysis.loans.map(loan=>({...loan,arrears:0,status:'AL CORRIENTE',behavior:'CURRENT',total:150,paid:100})),payments:analysis.payments.slice(0,1)};
 await compare(context,revised,{settings},prepared,'changed analysis');
 const output=prepared.calculate({settings});if(output.rows[0].calculation_steps.length)output.rows[0].calculation_steps[0].balance=999999;
 if(output.charts.recovery.length)output.charts.recovery[0].all=999999;
 await compare(context,analysis,{settings},prepared,'result mutation does not poison cache');
 for(const patch of [{pay:101},{capitalBasis:'period',periodFin:'2026-12-04'},{periodFin:'2026-02-30'},{yieldMode:'selected',yieldPeriods:['2026-S2']}])await compare(context,analysis,{settings:{...settings,...patch}},prepared,'invalid settings');
 for(const mode of ['regularization','unallocated','incomplete','negative','invalid-ledger','invalid-date','duplicate']){
  const ctx=JSON.parse(JSON.stringify(context)),p=ctx.participants[0];
  if(mode==='regularization'){p.certified_as_of='2026-09-01';p.transactions=[tx('opening',100,'2026-09-01','CAPITAL','CREDIT','REGULARIZATION')];}
  if(mode==='unallocated')p.transactions[4].origins=[{origin_key:'UNALLOCATED_REVIEW',amount:1}];
  if(mode==='incomplete')p.transactions[4].origins=[{origin_key:'2026-S1',amount:0.5}];
  if(mode==='negative')p.transactions=[tx('negative',10,'2026-01-01','CAPITAL','DEBIT','WITHDRAWAL')];
  if(mode==='invalid-ledger')p.transactions[0].direction='INVALID';
  if(mode==='invalid-date')p.transactions[0].effective_date='2026-02-30';
  if(mode==='duplicate')ctx.participants.push(ctx.participants[0]);
  const calc=current.createPreparedCalculator(ctx,analysis);
  for(const method of ['avg','end'])await compare(ctx,analysis,{settings:{...settings,method,yieldMode:'previous'}},calc,mode);
  checks++;
 }
 const report={status:'PASS',baseline,compared,edgeGroups:checks,externalQueries:0,financialWrites:0,private:null};
 const privateIndex=process.argv.indexOf('--private-root');
 if(privateIndex!==-1){
  const privateRoot=path.resolve(process.argv[privateIndex+1]),ui=original('app/sicof-admin.jsx');
  const expand=vm.runInNewContext('('+ui.slice(ui.indexOf('  function expandWorkspace('),ui.indexOf('  const h = React.createElement;')).trim()+')');
  const captured=JSON.parse(fs.readFileSync(path.join(privateRoot,'.tmp/sicof-latency/cached-workspace-private.json'),'utf8'));
  const workspace=expand(captured.data).workspace;
  const participants=JSON.parse(fs.readFileSync(path.join(privateRoot,'.tmp/finance-read-performance/legacy-workspace.json'),'utf8')).data.workspace.participants;
  const ctx={...context,participants},loans={...analysis,loans:workspace.loans,payments:workspace.payments},calculator=current.createPreparedCalculator(ctx,loans);
  const cases=[{...settings,method:'avg'},...Array.from({length:5},(_,i)=>({...settings,method:'avg',pay:[91,98,0,100,90][i]})),{...settings,method:'end'},
   {...settings,src:'todos',method:'avg'},{...settings,src:'sel',selFunds:['Caja Chica'],method:'avg'},{...settings,periodFin:'2026-12-04',method:'avg'},
   {...settings,periodFin:'2026-12-31',method:'avg'},{...settings,yieldMode:'previous',method:'avg'},{...settings,capitalBasis:'period',method:'end'}];
  const durations=[];
  for(const [i,s] of cases.entries()){
   const a=s.periodFin===settings.periodFin?loans:{...loans,payments:loans.payments.filter(p=>!p.date||p.date<=s.periodFin),loans:loans.loans.map(l=>({...l,schedule:l.schedule.map(p=>({...p,in_period:!p.date||p.date>=s.periodIni&&p.date<=s.periodFin}))}))};
   const input={settings:s,costs:i%3===0?costs:[],bank:{amount:null}},expected=old.calculateSicof(ctx,a,input);
   const began=performance.now(),actual=calculator.calculate(input,a),elapsed=performance.now()-began;
   assert.equal(JSON.stringify(actual)===JSON.stringify(expected),true,'private case '+i+' exact serialized equality');
   assert.equal(await current.fingerprint(actual),await old.fingerprint(expected),'private case '+i+' exact fingerprint');
   durations.push({case:i,elapsed_ms:Math.round(elapsed*100)/100});
  }
  report.private={participants:participants.length,loans:loans.loans.length,schedules:loans.loans.reduce((n,l)=>n+l.schedule.length,0),cases:cases.length,durations};
 }
 console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
