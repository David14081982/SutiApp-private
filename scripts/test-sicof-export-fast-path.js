'use strict';
// Offline equivalence and fail-on-access proof for the raw A:O export path.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
(async()=>{
 const engine=await import('../supabase/functions/sicof/engine.mjs');
 const {dispatchSicof}=await import('../supabase/functions/sicof/handler.mjs');
 const {analyzeSicofLoans}=await import('../supabase/functions/sicof/loan-calculation.mjs');
 const {decorateLoans}=await import('../supabase/functions/sicof/projection.mjs');
 const {SICOF_FIELDS}=await import('../supabase/functions/sicof/loan-source.mjs');
 const ExcelJS=require('../.tmp/sicof/deps/node_modules/exceljs');
 const sourceText=fs.readFileSync(path.join(root,'supabase/functions/sicof/engine.mjs'),'utf8').replace(/\r/g,'');
 // Restore the former inline validation exactly; the financial body stays the
 // same. This reference exercises the pre-extraction order/default/trim rules.
 const helperStart=sourceText.indexOf('// Shared input validation for simulations'),helperEnd=sourceText.indexOf('export function calculateSicof(',helperStart);
 assert(helperStart>=0&&helperEnd>helperStart);
 const inline="  const s=validateSettings(input.settings), costs=validateCosts(input.costs||[]), bank=input.bank||{amount:null};";
 const bankCheck="  const declared=bank.amount==null||bank.amount===''?null:cents(bank.amount);";
 const bankRules="\n  if (declared!=null&&(declared<0||!bank.declaredBy?.trim()||!bank.date)) throw Error('SICOF_BANK_DECLARATION_REQUIRED');\n  if (bank.date) date(bank.date);";
 const referenceText=(sourceText.slice(0,helperStart)+sourceText.slice(helperEnd)).replace('  const {settings:s,costs,bank}=validateCalculationInputs(input);',inline).replace(bankCheck,bankCheck+bankRules);
 assert(!referenceText.includes('validateCalculationInputs'));
 const reference=await import('data:text/javascript;base64,'+Buffer.from(referenceText).toString('base64'));
 const actor='00000000-0000-4000-8000-000000000001',session='00000000-0000-4000-8000-000000000003';
 const settings={src:'caja',selFunds:[],pay:90,method:'end',periodIni:'2026-07-01',periodFin:'2026-12-31',minm:6,exterm:true,exmin:true,warn:1000,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const raw={source_row:2,date:'2026-07-15',paid:110,loan_id:'001',folio:'00123',name:'Isolated',process:0,rate:.05,discount_start:'2026-07-15',fund:'Caja de Ahorro',term:1,principal:100,total_due:110,loan_charges:10,scheduled_charges:10,expected:110,status:'AL CORRIENTE',paid_to_date:110,expected_to_date:110,scheduled_admin_fee:0,admin_fee_total:0,interest_total:10,principal_interest_total:110,scheduled_capital:100};
 const source={source:'isolated',headers:['Fecha','Cuotas','ID','Folio','Nombre','Proceso','Fondo','tasa Qnal %','Plazo','Cantidad Prestamo','Total a pagar','Inicio de Descuento Quincenal','Monto Total Interes','Interes x #Plazo','Descuento Quincenal'],columns:'ABCDEFGHIJKLMNO'.split(''),observed_at:'2026-10-03T12:00:00Z',source_fingerprint:'a'.repeat(64),date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE',rows:[raw]};
 const person={id:'person',folio:'00123',name:'Synthetic',identity_resolved:true,certified:true,enrollment:{status:'ACTIVE',enrollment_started_at:'2025-01-01'},eligibility:{complete:true},history:[],
  transactions:[{id:'tx',component:'CAPITAL',amount:100,direction:'CREDIT',transaction_type:'CONTRIBUTION',effective_date:'2025-12-01',contribution_date:'2025-12-01'}],composition:{balances:{capital:100,yield_amount:0,total:100,available:100},movements:[],periods:[]}};
 const context={context:{actor,session,effective_affiliate:null},today:'2026-10-03',as_of:'2026-10-03',from:settings.periodIni,to:settings.periodFin,can_export:true,participants:[person],fingerprint:'b'.repeat(32)};
 const analysis=decorateLoans(analyzeSicofLoans(source,{from:context.from,to:context.to,as_of:context.today}));
 const cost={id:'cost',concept:'  Synthetic cost  ',amount:1.125,source:'reserve',status:'committed',date:'2026-10-02',ignored:'not canonical'};
 const inputCases=[
  {settings}, {settings,costs:null,bank:null}, {settings,costs:[],bank:{amount:''}},
  {settings:{...settings,pay:'90',ignored:'not canonical'},costs:[cost],bank:{amount:123.456,declaredBy:'  Synthetic admin  ',date:'2026-10-03',retained:'bank fields stay unchanged'}},
  {settings:{...settings,src:'sel',selFunds:['Extra','Extra'],method:'avg'},costs:[{...cost,concept:'Already trimmed',date:null}],bank:{amount:0,declaredBy:'Admin',date:'2026-10-03'}},
  {settings:{...settings,src:'todos',capitalBasis:'period'},costs:false,bank:false}
 ];
 const inputFingerprint=(inputs,ctxHash=context.fingerprint,sourceHash=source.source_fingerprint)=>engine.fingerprint({engine:engine.ENGINE_VERSION,...inputs,context:ctxHash,loans:sourceHash});
 for(const input of inputCases){
  const before=JSON.stringify(input),prior=reference.calculateSicof(context,analysis,input),current=engine.calculateSicof(context,analysis,input),normalized=engine.validateCalculationInputs(input);
  assert.equal(JSON.stringify(current),JSON.stringify(prior),'complete calculation remains byte-equivalent');
  assert.deepEqual(normalized,{settings:prior.settings,costs:prior.costs,bank:prior.bank});
  assert.equal(await inputFingerprint(normalized),await engine.fingerprint({engine:prior.engine_version,settings:prior.settings,costs:prior.costs,bank:prior.bank,context:context.fingerprint,loans:source.source_fingerprint}));
  assert.equal(JSON.stringify(input),before);
 }
 const invalidCases=[
  {settings:{...settings,pay:101}}, {settings,costs:[{...cost,amount:-1}]}, {settings,costs:[cost,cost]},
  {settings,costs:[{...cost,concept:'   '}]}, {settings,costs:[{...cost,date:'2026-02-30'}]},
  {settings,bank:{amount:-1,declaredBy:'Admin',date:'2026-10-03'}}, {settings,bank:{amount:1,declaredBy:' ',date:'2026-10-03'}},
  {settings,bank:{amount:1,declaredBy:'Admin'}}, {settings,bank:{amount:null,date:'2026-02-30'}}, {settings,bank:{amount:'1',declaredBy:'Admin',date:'2026-10-03'}}
 ];
 for(const input of invalidCases){let prior;try{reference.calculateSicof(context,analysis,input);}catch(error){prior=error.message;}assert(prior);assert.throws(()=>engine.validateCalculationInputs(input),error=>error.message===prior);}
 let authAllowed=true,exportAllowed=true,ctxFingerprint=context.fingerprint,sourceFingerprint=source.source_fingerprint,sourceReads=0,rpcReads=0,excelLoads=0,forbiddenAccesses=0,serviceCalls=0;
 let expectedRange={p_from:settings.periodIni,p_to:settings.periodFin};
 const forbidden=label=>{forbiddenAccesses++;throw Error('UNEXPECTED_DERIVED_ACCESS_'+label);};
 const permittedContext=new Set(['context','today','fingerprint','can_export','then']);
 const guardedContext=new Proxy(context,{get(target,key){if(!permittedContext.has(key))return forbidden('context');return key==='fingerprint'?ctxFingerprint:key==='can_export'?exportAllowed:target[key];},ownKeys(){return forbidden('context_enumeration');}});
 const permittedRaw=new Set(['source_row',...SICOF_FIELDS.slice(0,15)]);
 const guardedRow=new Proxy(raw,{get(target,key){if(!permittedRaw.has(key))return forbidden('loan_analysis');return target[key];}});
 const guardedSource={...source,rows:[guardedRow]};
 const deps={env:()=>'',today:()=>context.today,loadExcelJS:async()=>{excelLoads++;return ExcelJS;},createServiceClient:()=>{serviceCalls++;throw Error('NO_FINANCIAL_WRITER');},
  createUserClient:()=>({auth:{getUser:async()=>authAllowed?{data:{user:{id:actor}}}:{error:{message:'denied'}}},rpc:async(name,args)=>{rpcReads++;assert.equal(name,'get_admin_sicof_context');assert.deepEqual(args,expectedRange);return{data:guardedContext};}}),
  sourceReader:async()=>{sourceReads++;return{...guardedSource,source_fingerprint:sourceFingerprint};}};
 const run=body=>dispatchSicof(body,'Bearer isolated',deps);
 const inputs={settings,costs:[cost],bank:{amount:200,declaredBy:'Synthetic admin',date:'2026-10-03'}};
 const command={action:'EXPORT',kind:'base_calculo',...inputs,fingerprint:await inputFingerprint(engine.validateCalculationInputs(inputs))};
 const exported=await run(command);assert.equal(sourceReads,1);assert.equal(rpcReads,1);assert.equal(excelLoads,1);assert.equal(forbiddenAccesses,0);assert.equal(serviceCalls,0);
 const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(exported.data.base64,'base64'));
 assert.equal(book.worksheets.length,1);assert.equal(book.worksheets[0].name,'HISTORIAL P V2');assert.equal(book.worksheets[0].getCell('D2').value,'00123');assert.equal(book.worksheets[0].getCell('N2').value,10);
 // The canonical concept is trimmed, while the bank object remains verbatim.
 await run({...command,costs:[{...cost,concept:'Synthetic cost',ignored:'different'}]});assert.equal(forbiddenAccesses,0);
 const loadsBeforeDrift=excelLoads;
 sourceFingerprint='c'.repeat(64);await assert.rejects(()=>run(command),/SICOF_SOURCE_CHANGED/);sourceFingerprint=source.source_fingerprint;
 ctxFingerprint='d'.repeat(32);await assert.rejects(()=>run(command),/SICOF_SOURCE_CHANGED/);ctxFingerprint=context.fingerprint;
 for(const patch of [
  {fingerprint:undefined}, {settings:{...settings,pay:89}}, {costs:[{...cost,amount:2}]}, {costs:[{...cost,concept:'Different'}]},
  {bank:{...inputs.bank,amount:201}}, {bank:{...inputs.bank,declaredBy:' Synthetic admin '}}, {bank:{...inputs.bank,date:'2026-10-02'}}
 ])await assert.rejects(()=>run({...command,...patch}),/SICOF_SOURCE_CHANGED/);
 assert.equal(excelLoads,loadsBeforeDrift);
 let readsBefore=sourceReads;
 exportAllowed=false;await assert.rejects(()=>run(command),/SICOF_EXPORT_DENIED/);exportAllowed=true;
 authAllowed=false;await assert.rejects(()=>run(command),/SICOF_AUTH_REQUIRED/);authAllowed=true;assert.equal(sourceReads,readsBefore);
 for(const patch of [{costs:[{...cost,amount:-1}]},{bank:{amount:1}}])await assert.rejects(()=>run({...command,...patch}),/SICOF_(?:AMOUNT|COST|BANK_DECLARATION)_/);
 expectedRange={p_from:'2026-01-01',p_to:context.today};
 await assert.rejects(()=>run({...command,settings:undefined}),/SICOF_SETTINGS_REQUIRED/);
 assert.equal(sourceReads,readsBefore,'invalid inputs are rejected without another source query');assert.equal(forbiddenAccesses,0);assert.equal(serviceCalls,0);
 console.log(JSON.stringify({status:'PASS',checks:['complete engine result byte-equivalent to pre-extraction validation','input defaults cost trimming bank representation preserved','identical canonical input fingerprint','raw export never accesses participant/report data or loan analysis fields','one authorized context and one fresh source read','source context parameters costs bank drift rejected','authorization before source and lazy ExcelJS','invalid input before source','one A:O workbook with typed original values','no financial writer calls'],normalizationCases:inputCases.length,invalidCases:invalidCases.length,referenceEngineSha256:crypto.createHash('sha256').update(referenceText).digest('hex'),externalQueries:0,financialWrites:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
