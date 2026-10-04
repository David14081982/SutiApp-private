'use strict';
// Isolated real ExcelJS roundtrips and the authenticated handler. No network,
// production row data or financial writer is used by this fixture.
const assert=require('assert/strict');
(async()=>{
 const {dispatchSicof}=await import('../supabase/functions/sicof/handler.mjs');
 const {importSicofFile,revalidateFileBasis,scopeFileAnalysis,readSicofRequestBody,MAX_FILE_BASE64,validateFileInput}=await import('../supabase/functions/sicof/file-workspace.mjs');
 const {analyzeSicofLoans}=await import('../supabase/functions/sicof/loan-calculation.mjs');
 const {decorateLoans}=await import('../supabase/functions/sicof/projection.mjs');
 const {calculateSicof,fingerprint}=await import('../supabase/functions/sicof/engine.mjs');
 const {requireCurrentSicofSource}=await import('../supabase/functions/sicof/source-cache.mjs');
 const {SICOF_FIELDS,SICOF_COLUMNS}=await import('../supabase/functions/sicof/loan-source.mjs');
 const ExcelJS=require('../.tmp/sicof/deps/node_modules/exceljs');
 const actor='00000000-0000-4000-8000-000000000001',affiliate='00000000-0000-4000-8000-000000000002',session='00000000-0000-4000-8000-000000000003',key='00000000-0000-4000-8000-000000000004';
 const today='2026-10-03',start='2026-07-01',end='2026-12-31',observed='2026-10-03T12:00:00.000Z';
 const settings={src:'caja',selFunds:[],pay:98,method:'avg',periodIni:start,periodFin:end,minm:6,exterm:true,exmin:true,warn:1000,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 const raw=(i,date,fund,extra={})=>({...Object.fromEntries(SICOF_FIELDS.map(k=>[k,null])),source_row:i+2,date,paid:date>today?0:110,loan_id:'L'+i,folio:'00123',name:'Synthetic',process:'001',rate:.1,discount_start:date,discount_end:date,fund,term:1,principal:100,total_due:110,loan_charges:10,scheduled_charges:10,expected:110,status:'AL CORRIENTE',paid_to_date:0,expected_to_date:0,scheduled_admin_fee:0,admin_fee_total:0,interest_total:10,principal_interest_total:110,scheduled_capital:100,...extra});
 const source={source:'isolated-source',headers:Array.from({length:30},(_,i)=>'Synthetic '+i),columns:SICOF_COLUMNS,observed_at:observed,source_fingerprint:'a'.repeat(64),date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE',cache_meta:{state:'READY',observed_at:observed,expires_at:'2026-10-03T12:05:00.000Z'},rows:[
  raw(0,'2026-06-30','Caja de Ahorro'),raw(1,start,'Caja de Ahorro',{scheduled_admin_fee:2,admin_fee_total:2,interest_total:8,principal_interest_total:108}),raw(2,'2026-10-01','Caja de Ahorro'),raw(3,'2026-12-04','Caja de Ahorro'),raw(4,'2026-12-05','Caja de Ahorro'),raw(5,'2027-01-01','Caja de Ahorro'),
  raw(6,'2026-12-04','Extra'),raw(7,'2026-12-04','Other'),raw(8,'2026-10-01','Caja de Ahorro',{loan_id:'duplicate'}),raw(9,'2026-10-01','Caja de Ahorro',{loan_id:'duplicate'}),
  raw(10,'2026-09-15','Other',{status:'SALDO ATRASADO',expected_to_date:110}),raw(11,end,'Caja de Ahorro',{process:null,name:'=plain text',rate:.00123456789}),raw(12,'2026-08-15','',{process:false}),raw(13,'bad-date','Caja de Ahorro')
 ]};
 const person={id:affiliate,affiliate_id:affiliate,folio:'00123',name:'Synthetic',identity_resolved:true,certified:true,certified_as_of:'2025-12-31',enrollment:{id:key,status:'ACTIVE',enrollment_started_at:'2025-01-01',first_actual_contribution_date:'2025-01-15',frequency:'TWICE_MONTHLY'},eligibility:{complete:true,reasons:[],policy_reasons:[]},history:[],transactions:[{id:'opening',enrollment_id:key,component:'CAPITAL',amount:1000,direction:'CREDIT',transaction_type:'REGULARIZATION',effective_date:'2025-12-31',origins:[{origin_key:'2025',amount:1000}]}],composition:{as_of:today,as_of_complete:true,as_of_supported_from:'2025-12-31',balances:{capital:1000,yield_amount:0,total:1000,available:1000},as_of_balance:{capital:1000,yield_amount:0,total:1000},movements:[],periods:[]}};
 const context={context:{actor,session,effective_affiliate:affiliate},today,as_of:today,from:start,to:end,fingerprint:'b'.repeat(32),can_configure:true,can_export:true,participants:[person],periods:[],existing_period_previews:[],scenarios:[],preferences:{},report:null};
 let authDenied=false,rpcDenied=false,clock=Date.parse(observed),reads=0,excelLoads=0,noParticipants=false,mutateFresh=null;
 const calls=[],writes=[],checks=[];
 const contextFor=args=>{const c=structuredClone(context);c.from=args.p_from;c.to=args.p_to;c.as_of=c.to<c.today?c.to:c.today;if(c.from!==context.from||c.to!==context.to){c.fingerprint='d'.repeat(32);if(mutateFresh)mutateFresh(c);}if(noParticipants)Object.defineProperty(c,'participants',{get(){throw Error('FULL_WORKSPACE_CALCULATION_FORBIDDEN');}});return c;};
 const deps={env:()=>'',today:()=>today,now:()=>clock,sourceReader:async()=>{reads++;requireCurrentSicofSource(source,deps);return structuredClone(source);},loadExcelJS:async()=>{excelLoads++;return ExcelJS;},
  createUserClient:()=>({auth:{getUser:async()=>authDenied?{error:{message:'denied'}}:{data:{user:{id:actor}}}},rpc:async(name,args)=>{calls.push({name,args});if(rpcDenied)return{error:{message:'SICOF_ADMIN_DENIED'}};assert.equal(name,'get_admin_sicof_context');return{data:contextFor(args)};}}),
  createServiceClient:()=>({rpc:async(name,args)=>{assert.equal(name,'service_save_sicof_scenario');writes.push({name,args});return{data:{saved:true}};}})};
 const run=body=>dispatchSicof(body,'Bearer isolated',deps),input={settings,costs:[{id:'cost',concept:'Synthetic cost',amount:1,source:'pool',status:'estimated'}],bank:{amount:null}};
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const decode=async(base64)=>{const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(base64,'base64'));return book;};
 const altered=async(file,modify)=>{const book=await decode(file.base64);modify(book);return{...file,base64:Buffer.from(await book.xlsx.writeBuffer()).toString('base64')};};
 const upload=(settings,file)=>run({action:'FILE_WORKSPACE',...input,settings,file});
 let file,prepared,allFile,allPrepared;
 await test('download and fund discovery authenticate once without calculating a workspace',async()=>{
  noParticipants=true;const before={reads,calls:calls.length};const result=await run({action:'DOWNLOAD_SOURCE',settings});
  assert.equal(reads-before.reads,1);assert.equal(calls.length-before.calls,1);assert.deepEqual(result.data.funds,['Caja de Ahorro','Extra','Other']);
  file={name:'Base.xlsx',base64:result.data.base64};const wb=await decode(file.base64),sheet=wb.worksheets[0];assert.equal(wb.worksheets.length,1);assert.equal(sheet.name,'HISTORIAL P V2');assert.equal(sheet.columnCount,15);assert.equal(sheet.rowCount,8);
  assert.deepEqual(sheet.getColumn(1).values.slice(2),[start,'2026-10-01','2026-12-04','2026-12-05','2026-10-01','2026-10-01',end]);
  const funds=await run({action:'SOURCE_FUNDS',from:start,to:end});assert.deepEqual(funds.data,{funds:result.data.funds,observed_at:observed});noParticipants=false;
  assert.equal(writes.length,0);
 });
 await test('file import validates original types and duplicates then enriches from one authorized observation',async()=>{
  const before={reads,calls:calls.length,loads:excelLoads};prepared=await upload(settings,file);
  assert.equal(reads-before.reads,1);assert.equal(calls.length-before.calls,1);assert.equal(excelLoads-before.loads,1);
  const d=prepared.data;assert.equal(d.simulation.mode,'FILE');assert.deepEqual(d.simulation.file_basis,d.file.basis);assert.match(d.file.sha256,/^[a-f0-9]{64}$/);assert.match(d.file.upload_sha256,/^[a-f0-9]{64}$/);assert.notEqual(d.file.sha256,d.file.upload_sha256);
  assert.equal(d.file.rows.length,7);assert.equal(d.file.rows[0][3],'00123');assert.equal(d.file.rows.at(-1)[4],'=plain text');assert.equal(d.file.rows.at(-1)[5],null);assert.equal(d.file.rows.at(-1)[7],.00123456789);
  assert.equal(d.workspace.payments.length,7);assert.equal(d.workspace.paymentMetrics[0].value,7);assert.equal(d.workspace.funds.length,1);assert.equal(d.workspace.funds[0].id,'Caja de Ahorro');assert.equal(d.workspace.payment_scope,'UPLOADED_FILE_BASE');assert.equal(d.workspace.loan_history_scope,'CANONICAL_RETENTION_CONTEXT');
  assert(d.workspace.loans.some(l=>l.fund==='Other'&&l.status==='SALDO ATRASADO'));assert(d.workspace.loans.some(l=>l.schedule.some(p=>p.date==='2026-06-30')));assert.equal(d.workspace.payments.filter(p=>p.issues.includes('AMBIGUOUS_LOAN_DATE_ROWS')).length,2);
  assert.equal(d.workspace.payments[0].fee,2);assert.equal(d.workspace.payments[0].interest,8);assert.equal(d.workspace.paymentMetrics[4].value,2);
  assert.equal(d.workspace.source.fingerprint,d.simulation.analysisMetadata.source_fingerprint);assert.notEqual(d.workspace.source.fingerprint,source.source_fingerprint);assert.equal(d.workspace.source.canonical_fingerprint,source.source_fingerprint);
  assert.equal(d.file.imported_at,observed);assert.equal(d.file.savings_observed_at,observed);assert.equal(d.file.source_observed_at,observed);
  const selected=await revalidateFileBasis(d.file.basis,source,settings),analysis=scopeFileAnalysis(decorateLoans(analyzeSicofLoans(source,{from:start,to:end,as_of:today})),selected,settings),expected=calculateSicof(context,analysis,input);expected.fingerprint=await fingerprint({engine:expected.engine_version,settings:expected.settings,costs:expected.costs,bank:expected.bank,context:context.fingerprint,loans:analysis.source_fingerprint});assert.deepEqual(d.result,expected);
  assert.equal(writes.length,0);
 });
 await test('uppercase Google fingerprint remains exact through import and revalidation',async()=>{
  const original=source.source_fingerprint;source.source_fingerprint=original.toUpperCase();
  try{const upper=await upload(settings,file);assert.equal(upper.data.file.basis.source_fingerprint,source.source_fingerprint);assert.equal(upper.data.file.sha256,prepared.data.file.sha256);await revalidateFileBasis(upper.data.file.basis,source,settings);}finally{source.source_fingerprint=original;}
 });
 await test('selected funds and all funds preserve blank-fund source rows without mixing absent payments',async()=>{
  for(const [src,selFunds,count]of [['sel',['Extra'],8],['todos',[],11]]){
    const s={...settings,src,selFunds},download=await run({action:'DOWNLOAD_SOURCE',settings:s}),f={name:'All.xlsx',base64:download.data.base64},p=await upload(s,f);
    assert.equal(p.data.file.rows.length,count);assert.equal(p.data.workspace.payments.length,count);assert.equal(p.data.workspace.paymentMetrics[0].value,count);
    if(src==='todos'){allFile=f;allPrepared=p;assert.equal(p.data.file.rows.at(-1)[6],'');assert.equal(p.data.file.rows.at(-1)[5],false);assert.equal(p.data.file.basis.funds,null);}
    else assert.deepEqual(p.data.file.basis.funds,['Caja de Ahorro','Extra']);
  }
  const compact=await run({action:'FILE_WORKSPACE',...input,file,compact:true});assert.equal(compact.data.wire_version,'SICOF_WORKSPACE_COMPACT_V1');assert.deepEqual(compact.data.file,prepared.data.file);assert.equal(compact.data.simulation.mode,'FILE');assert(!Object.hasOwn(compact.data.workspace,'participants'));
 });
 await test('tampered rows order headers types missing rows and extra rows all reject',async()=>{
  const variants=[b=>b.worksheets[0].getCell('B2').value=109,b=>{const s=b.worksheets[0],a=s.getRow(2).values;s.getRow(2).values=s.getRow(3).values;s.getRow(3).values=a;},b=>b.worksheets[0].getCell('D2').value=123,b=>b.worksheets[0].getCell('B2').value='$110.00',b=>b.worksheets[0].getCell('A1').value='Fecha distinta',b=>b.worksheets[0].spliceRows(2,1),b=>b.worksheets[0].addRow(b.worksheets[0].getRow(2).values),b=>b.worksheets[0].getCell('F8').value=0];
  for(const modify of variants)await assert.rejects(()=>altered(file,modify).then(f=>upload(settings,f)),/SICOF_FILE_(SOURCE_MISMATCH|HEADERS_INVALID)/);
  await assert.rejects(()=>upload({...settings,src:'todos'},file),/SOURCE_MISMATCH/);
  await assert.rejects(()=>upload({...settings,periodFin:'2026-12-04'},file),/SOURCE_MISMATCH/);
  const dated=await altered(file,b=>{b.worksheets[0].getCell('A2').value=new Date(start+'T00:00:00.000Z');b.worksheets[0].getCell('B2').numFmt='"$"#,##0.00';});const valid=await upload(settings,dated);assert.equal(valid.data.file.sha256,prepared.data.file.sha256);assert.notEqual(valid.data.file.upload_sha256,prepared.data.file.upload_sha256);
 });
 await test('formula hyperlinks additional sheets columns hidden data and malformed ZIP reject safely',async()=>{
  const variants=[b=>b.worksheets[0].getCell('B2').value={formula:'100+10',result:110},b=>b.worksheets[0].getCell('E2').value={text:'Synthetic',hyperlink:'https://invalid.example/'},b=>b.addWorksheet('Hidden',{state:'veryHidden'}),b=>b.worksheets[0].getCell('P2').value=1,b=>b.worksheets[0].state='hidden',b=>b.worksheets[0].mergeCells('E2:F2'),b=>b.worksheets[0].name='Different'];
  for(const modify of variants)await assert.rejects(()=>altered(file,modify).then(f=>upload(settings,f)),/SICOF_FILE_(INVALID|SOURCE_MISMATCH)/);
  await assert.rejects(()=>upload(settings,{...file,base64:Buffer.from('invalid').toString('base64')}),/FILE_INVALID/);
  const bytes=Buffer.from(file.base64,'base64'),central=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));bytes.writeUInt32LE(70*1024*1024,central+24);await assert.rejects(()=>upload(settings,{...file,base64:bytes.toString('base64')}),/FILE_TOO_LARGE/);
  for(const target of ['xl/sharedStrings.xml','xl/styles.xml','xl/theme/theme1.xml','docProps/core.xml']){
    const altered=Buffer.from(file.base64,'base64');let cursor=altered.indexOf(Buffer.from([0x50,0x4b,0x01,0x02])),found=false;
    while(cursor>=0&&altered.readUInt32LE(cursor)===0x02014b50){
      const len=altered.readUInt16LE(cursor+28),name=altered.subarray(cursor+46,cursor+46+len).toString();
      if(name===target){assert(altered.readUInt32LE(cursor+24)>0);altered.writeUInt32LE(0,cursor+24);found=true;break;}
      cursor+=46+len+altered.readUInt16LE(cursor+30)+altered.readUInt16LE(cursor+32);
    }
    assert(found,target);let entered=false;const parser={Workbook:class{constructor(){entered=true;throw Error('PARSER_MUST_NOT_RUN');}}};
    await assert.rejects(()=>importSicofFile({...file,base64:altered.toString('base64')},source,settings,parser),/SICOF_FILE_INVALID/);assert.equal(entered,false,target);
  }
  for(const value of [{...file,name:'../base.xlsx'},{...file,name:'base.xls'},{...file,extra:1},{...file,base64:'%%%%'}])assert.throws(()=>validateFileInput(value),/FILE_INVALID/);
  assert.throws(()=>validateFileInput({...file,base64:'A'.repeat(MAX_FILE_BASE64+4)}),/FILE_TOO_LARGE/);
 });
 await test('export revalidates file digest source scope and original canonical context',async()=>{
  const initial=prepared.data,s={...settings,periodFin:'2026-12-04'},selection=await revalidateFileBasis(initial.file.basis,source,s),analysis=scopeFileAnalysis(decorateLoans(analyzeSicofLoans(source,{from:start,to:s.periodFin,as_of:today})),selection,s),result=calculateSicof(context,analysis,{...input,settings:s});
  result.fingerprint=await fingerprint({engine:result.engine_version,settings:result.settings,costs:result.costs,bank:result.bank,context:context.fingerprint,loans:analysis.source_fingerprint});
  const command={action:'EXPORT',kind:'base_calculo',...input,settings:s,simulation_basis:initial.simulation.basis,file_basis:initial.file.basis,fingerprint:result.fingerprint};
  noParticipants=true;const before={reads,loads:excelLoads},exported=await run(command);noParticipants=false;assert.equal(reads-before.reads,1);assert.equal(excelLoads-before.loads,1);assert.deepEqual(calls.at(-1).args,{p_from:start,p_to:end});const wb=await decode(exported.data.base64);assert.equal(wb.worksheets[0].rowCount,6);assert(wb.worksheets[0].getColumn(1).values.slice(2).every(d=>d>=start&&d<=s.periodFin));
  for(const changed of [{...command,file_basis:{...command.file_basis,sha256:'0'.repeat(64)}},{...command,file_basis:{...command.file_basis,source_fingerprint:'0'.repeat(64)}},{...command,file_basis:{...command.file_basis,extra:1}},{...command,settings:{...s,src:'todos'}},{...command,simulation_basis:undefined},{...command,fingerprint:'forged'}])await assert.rejects(()=>run(changed),/FILE_SOURCE_CHANGED|FILE_BASIS_INVALID|FILE_SCOPE_REQUIRED|SIMULATION_RANGE_REQUIRED|SOURCE_CHANGED/);
  const sourceHash=source.source_fingerprint;source.source_fingerprint='e'.repeat(64);await assert.rejects(()=>run(command),/FILE_SOURCE_CHANGED/);source.source_fingerprint=sourceHash;
  context.fingerprint='e'.repeat(32);await assert.rejects(()=>run(command),/SOURCE_CHANGED/);context.fingerprint='b'.repeat(32);
  const previousWrites=writes.length;await run({...command,action:'SAVE_SCENARIO',kind:undefined,key}).then(()=>assert.fail('unexpected kind accepted'),error=>assert.match(error.message,/COMMAND_INVALID/));assert.equal(writes.length,previousWrites);
  const {kind,...save}=command;await run({...save,action:'SAVE_SCENARIO',key});assert.equal(writes.length,previousWrites+1);assert.equal(writes.at(-1).args.p_parameters.to,s.periodFin);assert.equal(writes.at(-1).args.p_context_fingerprint,'d'.repeat(32));assert.equal(writes.at(-1).args.p_source_fingerprint,selection.source_fingerprint);
  mutateFresh=c=>c.participants[0].transactions[0].amount=999;await assert.rejects(()=>run({...save,action:'SAVE_SCENARIO',key:crypto.randomUUID()}),/CONTEXT_CHANGED/);mutateFresh=null;assert.equal(writes.length,previousWrites+1);
 });
 await test('all-file subset simulation scope cannot silently expand a finite file',async()=>{
  const d=allPrepared.data,selected=await revalidateFileBasis(d.file.basis,source,settings),a=scopeFileAnalysis(decorateLoans(analyzeSicofLoans(source,{from:start,to:end,as_of:today})),selected,settings);assert.equal(a.payments.length,7);assert.equal(a.totals.rows,7);assert.equal(a.funds.length,1);
  const command={action:'EXPORT',kind:'base_calculo',...input,simulation_basis:d.simulation.basis,file_basis:d.file.basis};const result=calculateSicof(context,a,input);command.fingerprint=await fingerprint({engine:result.engine_version,settings:result.settings,costs:result.costs,bank:result.bank,context:context.fingerprint,loans:a.source_fingerprint});const output=await run(command);assert.equal((await decode(output.data.base64)).worksheets[0].rowCount,8);
 });
 await test('permissions session changes source expiry and oversized requests fail closed',async()=>{
  const before=reads;authDenied=true;await assert.rejects(()=>run({action:'DOWNLOAD_SOURCE',settings}),/AUTH_REQUIRED/);await assert.rejects(()=>upload(settings,file),/AUTH_REQUIRED/);authDenied=false;rpcDenied=true;await assert.rejects(()=>run({action:'SOURCE_FUNDS',from:start,to:end}),/ADMIN_DENIED/);rpcDenied=false;context.can_export=false;await assert.rejects(()=>run({action:'DOWNLOAD_SOURCE',settings}),/EXPORT_DENIED/);context.can_export=true;assert.equal(reads,before);
  const command={action:'EXPORT',kind:'base_calculo',...input,simulation_basis:prepared.data.simulation.basis,file_basis:prepared.data.file.basis,fingerprint:prepared.data.result.fingerprint};context.context.actor='different';await assert.rejects(()=>run(command),/CONTEXT_CHANGED/);context.context.actor=actor;
  clock=Date.parse(source.cache_meta.expires_at);await assert.rejects(()=>upload(settings,file),/SOURCE_CACHE_STALE/);await assert.rejects(()=>run(command),/SOURCE_CACHE_STALE/);clock=Date.parse(observed);
  const small={action:'SOURCE_FUNDS',from:start,to:end};assert.deepEqual(await readSicofRequestBody(new Request('https://isolated.invalid',{method:'POST',body:JSON.stringify(small)})),small);
  const body={action:'FILE_WORKSPACE',file:{name:'file.xlsx',base64:'A'.repeat(220000)}};assert.deepEqual(await readSicofRequestBody(new Request('https://isolated.invalid',{method:'POST',body:JSON.stringify(body)})),body);
  await assert.rejects(()=>readSicofRequestBody(new Request('https://isolated.invalid',{method:'POST',body:JSON.stringify({action:'LOAD',extra:'A'.repeat(220000)})})),/COMMAND_INVALID/);
  await assert.rejects(()=>readSicofRequestBody(new Request('https://isolated.invalid',{method:'POST',body:'A'.repeat(MAX_FILE_BASE64+200001)})),/FILE_TOO_LARGE/);
 });
 await test('complete import exceeds 600 rows with original source order and no mutation',async()=>{
  const large={...structuredClone(source),rows:Array.from({length:1201},(_,i)=>raw(i,'2026-10-01','Caja de Ahorro',{folio:String(i).padStart(5,'0')}))},before=JSON.stringify(large);
  const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('HISTORIAL P V2');sheet.addRow(large.headers.slice(0,15));for(const row of large.rows)sheet.addRow(SICOF_FIELDS.slice(0,15).map(k=>row[k]));
  const imported=await importSicofFile({name:'large.xlsx',base64:Buffer.from(await wb.xlsx.writeBuffer()).toString('base64')},large,settings,ExcelJS,{importedAt:observed,savingsObservedAt:observed});assert.equal(imported.rows.length,1201);assert.equal(imported.rows[1200][3],'01200');assert.equal(JSON.stringify(large),before);
 });
 console.log(JSON.stringify({status:'PASS',checks,externalRequests:0,financialWrites:0,capturedScenarioCommands:writes.length,largeRows:1201}));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
