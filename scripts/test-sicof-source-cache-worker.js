'use strict';
// Offline service contracts only: no Google, database or financial writes.
const assert=require('assert/strict');
(async()=>{
 const {readCachedSicofSource,refreshCachedSicofSource,dispatchSicofSourceRefreshJob,sourceCacheState}=await import('../supabase/functions/sicof/source-cache.mjs');
 const {dispatchSicof}=await import('../supabase/functions/sicof/handler.mjs');
 const {SICOF_LOAN_CONTRACT,SICOF_WORKBOOK,SICOF_SHEET_ID,SICOF_COLUMNS,SICOF_FIELDS}=await import('../supabase/functions/sicof/loan-source.mjs');
 const ExcelJS=require('../.tmp/sicof/deps/node_modules/exceljs');
 const observed='2026-10-03T12:00:00.000Z',start=Date.parse(observed),hash='a'.repeat(64),secret='isolated-refresh-secret-'.repeat(3);
 const meta={state:'READY',version:1,observed_at:observed,expires_at:new Date(start+300000).toISOString(),last_attempt_at:observed,last_success_at:observed,last_error:null,refreshing:false};
 const row={...Object.fromEntries(SICOF_FIELDS.map(key=>[key,null])),source_row:2,date:'2026-07-15',paid:110,loan_id:'001',folio:'00123',name:'Isolated',process:0,rate:.05,discount_start:'2026-07-15',fund:'Caja de Ahorro',term:1,principal:100,total_due:110,loan_charges:10,scheduled_charges:10,expected:110,status:'AL CORRIENTE',paid_to_date:110,expected_to_date:110,scheduled_admin_fee:0,admin_fee_total:0,interest_total:10,principal_interest_total:110,scheduled_capital:100};
 const source={contract_version:SICOF_LOAN_CONTRACT,source:SICOF_WORKBOOK+':'+SICOF_SHEET_ID,headers:SICOF_FIELDS.slice(),columns:SICOF_COLUMNS.slice(),observed_at:observed,source_fingerprint:hash,scanned_rows:1,date_semantics:'AMORTIZATION_DATE_NOT_RECEIPT_DATE',rows:[row]};
 let stored={source,meta},now=start+60000,serviceReads=0,upstreamReads=0,financialWrites=0;
 const cacheDeps={now:()=>now,env:key=>key==='SICOF_SOURCE_REFRESH_SECRET'?secret:'',createServiceClient:()=>({rpc:async(name,args)=>{assert.equal(name,'service_sicof_source_read');assert.deepEqual(args,{});serviceReads++;return{data:stored};}}),upstreamSourceReader:async()=>{upstreamReads++;throw Error('NO_GOOGLE_ON_READ');}};
 assert.equal((await readCachedSicofSource(cacheDeps)).source_fingerprint,hash);
 now=start+299999;await readCachedSicofSource(cacheDeps);
 now=start+300000;await assert.rejects(()=>readCachedSicofSource(cacheDeps),error=>error.message==='SICOF_SOURCE_CACHE_STALE'&&error.sourceState.state==='STALE');now=start+60000;
 for(const state of ['EMPTY','STALE']){stored={source:null,meta:{...meta,state}};await assert.rejects(()=>readCachedSicofSource(cacheDeps),new RegExp('SICOF_SOURCE_CACHE_'+state));}
 stored={source:null,meta:{...meta,state:'EMPTY',refreshing:true}};await assert.rejects(()=>readCachedSicofSource(cacheDeps),/SICOF_SOURCE_CACHE_REFRESHING/);
 stored={source,meta:{...meta,expires_at:new Date(start+600000).toISOString()}};await assert.rejects(()=>readCachedSicofSource(cacheDeps),/SICOF_SOURCE_CACHE_STALE/);
 stored={source:{...source,source:'unrelated-sheet'},meta};await assert.rejects(()=>readCachedSicofSource(cacheDeps),/SICOF_SOURCE_CACHE_INVALID/);
 stored={source:{...source,observed_at:'2026-10-03T12:00:01Z'},meta};await assert.rejects(()=>readCachedSicofSource(cacheDeps),/SICOF_SOURCE_CACHE_INVALID/);
 stored={source,meta};now=start-5000;await readCachedSicofSource(cacheDeps);now=start-5001;await assert.rejects(()=>readCachedSicofSource(cacheDeps),/SICOF_SOURCE_CACHE_STALE/);now=start+60000;
 assert.equal(upstreamReads,0);
 assert.deepEqual(Object.keys(sourceCacheState({...meta,rows:['private'],lease:'private',last_error:'financial row and secret'})).sort(),Object.keys(meta).sort());
 assert.equal(sourceCacheState({...meta,last_error:'financial row and secret'}).last_error,'SICOF_SOURCE_REFRESH_FAILED');

 const actor='00000000-0000-4000-8000-000000000001',session='00000000-0000-4000-8000-000000000003',key='00000000-0000-4000-8000-000000000004';
 const settings={src:'caja',selFunds:[],pay:90,method:'end',periodIni:'2026-07-01',periodFin:'2026-12-31',minm:6,exterm:true,exmin:true,warn:20,exConsec:false,consecN:4,loanEffect:'retiro',retScope:'todo',anchorOn:false,capitalBasis:'all',yieldMode:'none',yieldPeriods:[]};
 let denyAuth=false,denyContext=false,canExport=true,canConfigure=true,actorContext=actor,ctxHash='b'.repeat(32),contextReads=0,excelLoads=0;
 const ctx={context:{actor,session,effective_affiliate:null},today:'2026-10-03',as_of:'2026-10-03',from:settings.periodIni,to:settings.periodFin,can_export:true,can_configure:true,participants:[],periods:[],scenarios:[],preferences:{},report:null,fingerprint:ctxHash};
 const deps={...cacheDeps,today:()=>ctx.today,loadExcelJS:async()=>{excelLoads++;return ExcelJS;},createUserClient:()=>({auth:{getUser:async()=>denyAuth?{error:{message:'denied'}}:{data:{user:{id:actor}}}},rpc:async(name)=>{assert.equal(name,'get_admin_sicof_context');contextReads++;if(denyContext)return{error:{message:'SICOF_ADMIN_DENIED'}};return{data:{...ctx,context:{...ctx.context,actor:actorContext},can_export:canExport,can_configure:canConfigure,fingerprint:ctxHash}};}})};
 const run=body=>dispatchSicof(body,'Bearer isolated',deps),request={action:'WORKSPACE',settings,costs:[],bank:{amount:null}};
 let before=serviceReads;
 denyAuth=true;await assert.rejects(()=>run(request),/SICOF_AUTH_REQUIRED/);denyAuth=false;
 denyContext=true;await assert.rejects(()=>run(request),/SICOF_ADMIN_DENIED/);denyContext=false;
 actorContext='other';await assert.rejects(()=>run(request),/SICOF_CONTEXT_CHANGED/);actorContext=actor;
 canExport=false;await assert.rejects(()=>run({...request,action:'EXPORT',kind:'base_calculo'}),/SICOF_EXPORT_DENIED/);canExport=true;
 canConfigure=false;await assert.rejects(()=>run({...request,action:'SAVE_SCENARIO',key}),/SICOF_ADMIN_DENIED/);canConfigure=true;
 await assert.rejects(()=>run({...request,refresh_source:'true'}),/SICOF_COMMAND_INVALID/);
 assert.equal(serviceReads,before,'authorization and capabilities precede private reads');
 const first=await run(request),second=await run(request);
 assert.equal(first.data.workspace.source.state,'READY');assert.equal(first.data.workspace.source.version,1);assert.equal(first.data.workspace.source.expires_at,meta.expires_at);
 assert.equal(first.data.workspace.source.rows,undefined);assert.equal(first.data.workspace.source.cache_meta,undefined);
 assert.equal(first.data.result.fingerprint,second.data.result.fingerprint);assert.equal(serviceReads-before,2);assert.equal(upstreamReads,0);
 const calculated=await run({...request,action:'CALCULATE'});assert.equal(calculated.data.fingerprint,first.data.result.fingerprint);
 const exported=await run({...request,action:'EXPORT',kind:'base_calculo',fingerprint:first.data.result.fingerprint});assert.equal(excelLoads,1);assert.equal(upstreamReads,0);
 const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(exported.data.base64,'base64'));assert.equal(book.worksheets[0].getCell('D2').value,'00123');
 // A source valid when read must still be valid after CPU work. Two injected
 // clock observations straddle expiry without any additional RPC or Google read.
 for(const command of [request,{...request,compact:true},{...request,action:'CALCULATE'},
  {action:'LOAD',from:settings.periodIni,to:settings.periodFin},
  {...request,action:'SAVE_SCENARIO',key,fingerprint:first.data.result.fingerprint}]){
  let clockReads=0;const readsBefore=serviceReads;
  await assert.rejects(()=>dispatchSicof(command,'Bearer isolated',{...deps,now:()=>++clockReads===1?start+299999:start+300000}),error=>error.message==='SICOF_SOURCE_CACHE_STALE'&&error.sourceState.state==='STALE');
  assert.equal(clockReads,2);assert.equal(serviceReads,readsBefore+1);assert.equal(upstreamReads,0);
 }
 let workbookFinished=false;
 class ExpiringWorkbook extends ExcelJS.Workbook {
  constructor(){super();const write=this.xlsx.writeBuffer.bind(this.xlsx);this.xlsx.writeBuffer=async(...args)=>{const bytes=await write(...args);workbookFinished=true;now=start+300000;return bytes;};}
 }
 now=start+299999;const exportReadsBefore=serviceReads;
 await assert.rejects(()=>dispatchSicof({...request,action:'EXPORT',kind:'base_calculo',fingerprint:first.data.result.fingerprint},'Bearer isolated',{...deps,loadExcelJS:async()=>({Workbook:ExpiringWorkbook})}),error=>error.message==='SICOF_SOURCE_CACHE_STALE'&&error.sourceState.state==='STALE');
 assert.equal(workbookFinished,true);assert.equal(serviceReads,exportReadsBefore+1);assert.equal(upstreamReads,0);now=start+60000;
 stored={source:{...source,source_fingerprint:'c'.repeat(64)},meta};await assert.rejects(()=>run({...request,action:'EXPORT',kind:'base_calculo',fingerprint:first.data.result.fingerprint}),/SICOF_SOURCE_CHANGED/);stored={source,meta};
 ctxHash='d'.repeat(32);await assert.rejects(()=>run({...request,action:'EXPORT',kind:'base_calculo',fingerprint:first.data.result.fingerprint}),/SICOF_SOURCE_CHANGED/);ctxHash=ctx.fingerprint;
 stored={source:null,meta:{...meta,state:'STALE',last_error:'SICOF_LOAN_SOURCE_UNAVAILABLE_RECEIVER_HTTP'}};
 const stale=await run(request);assert.equal(stale.data.result,null);assert.equal(stale.data.workspace.source.status,'UNAVAILABLE');assert.equal(stale.data.workspace.source.state,'STALE');assert.equal(stale.data.workspace.source.last_success_at,observed);assert.equal(stale.data.calculation_error,'SICOF_SOURCE_CACHE_STALE');
 await assert.rejects(()=>run({...request,action:'CALCULATE'}),/SICOF_SOURCE_CACHE_STALE/);await assert.rejects(()=>run({...request,action:'EXPORT',kind:'base_calculo',fingerprint:first.data.result.fingerprint}),/SICOF_SOURCE_CACHE_STALE/);assert.equal(upstreamReads,0);
 stored={source,meta};

 // Shared lease outcomes are decided by SQL. The worker performs exactly one
 // upstream read for an awarded claim and never reads on a concurrent skip.
 let claims=0,finishes=[],workerReads=0,rejectPublish=false,failUpstream=false,forceSeen=[];
 const workerDeps={...cacheDeps,upstreamSourceReader:async()=>{workerReads++;if(failUpstream)throw Error('private token or row');return source;},createServiceClient:()=>({rpc:async(name,args)=>{
  if(name==='service_sicof_source_claim'){forceSeen.push(args.p_force);return{data:{claimed:++claims===1,lease:claims===1?key:null,meta:{...meta,refreshing:true}}};}
  if(name==='service_sicof_source_finish'){finishes.push(args);if(rejectPublish)return{error:{message:'private database detail'}};return{data:{meta:{...meta,last_error:args.p_error}}};}
  if(name==='service_sicof_source_read')return{data:stored};
  financialWrites++;throw Error('UNEXPECTED_FINANCIAL_WRITER');
 }})};
 const pair=await Promise.all([refreshCachedSicofSource(workerDeps),refreshCachedSicofSource(workerDeps)]);
 assert.equal(workerReads,1);assert.equal(finishes.length,1);assert.equal(pair.filter(x=>x.refreshed).length,1);assert.equal(finishes[0].p_source,source);assert.equal(finishes[0].p_error,null);
 claims=0;failUpstream=true;const failed=await refreshCachedSicofSource(workerDeps,true);assert.equal(failed.refreshed,false);assert.equal(failed.error,'SICOF_SOURCE_REFRESH_FAILED');assert.equal(failed.meta.observed_at,observed);assert.equal(failed.meta.last_success_at,observed);assert.equal(finishes.at(-1).p_source,null);assert.equal(forceSeen.at(-1),true);failUpstream=false;
 claims=0;rejectPublish=true;await assert.rejects(()=>refreshCachedSicofSource(workerDeps),/SICOF_SOURCE_CACHE_UNAVAILABLE/);rejectPublish=false;
 const jobRequest=(overrides={})=>new Request('https://isolated.invalid/sicof',{method:'POST',headers:{authorization:'Bearer gateway-validated-fixture','x-sicof-source-refresh-secret':secret,...overrides}});
 const job={action:'REFRESH_SOURCE_JOB'},claimedBefore=claims,workerBefore=workerReads;
 for(const headers of [{'x-sicof-source-refresh-secret':''},{'x-sicof-source-refresh-secret':'wrong'},{origin:'https://allowed-app.invalid'},{authorization:''}])await assert.rejects(()=>dispatchSicofSourceRefreshJob(job,jobRequest(headers),workerDeps),/SICOF_SOURCE_REFRESH_DENIED/);
 await assert.rejects(()=>dispatchSicofSourceRefreshJob({...job,force:true},jobRequest(),workerDeps),/SICOF_COMMAND_INVALID/);
 assert.equal(claims,claimedBefore);assert.equal(workerReads,workerBefore);
 claims=0;await dispatchSicofSourceRefreshJob(job,jobRequest(),workerDeps);assert.equal(workerReads,workerBefore+1);assert.equal(forceSeen.at(-1),false);
 // Manual refresh remains behind the same live user context, then returns the
 // shared copy. Concurrent/cooldown skips do not initiate another Google read.
 const manualDeps={...deps,createServiceClient:workerDeps.createServiceClient,upstreamSourceReader:workerDeps.upstreamSourceReader};
 claims=0;const manual=await dispatchSicof({...request,refresh_source:true},'Bearer isolated',manualDeps);assert.equal(manual.data.workspace.source.state,'READY');assert.equal(forceSeen.at(-1),true);
 const manualBefore=workerReads;await dispatchSicof({...request,refresh_source:true},'Bearer isolated',manualDeps);assert.equal(workerReads,manualBefore);
 denyContext=true;await assert.rejects(()=>dispatchSicof({...request,refresh_source:true},'Bearer isolated',manualDeps),/SICOF_ADMIN_DENIED/);denyContext=false;assert.equal(workerReads,manualBefore);
 assert.equal(financialWrites,0);
 console.log(JSON.stringify({status:'PASS',checks:['private reads after live auth/context/capabilities','repeated workspace calculation and A:O export never query Google','fresh source metadata only in workspace','same source and context fingerprints still enforced','300-second strict expiry and bounded clock skew','expiry during calculation compaction and XLSX creation rejects result without requery','expiry before scenario write rejected','stale empty refreshing states fail closed without fallback','shared lease permits one upstream read','worker failure preserves prior observation metadata','late publication fails without retry','job secret and no-Origin gate precede RPC','manual refresh authorized and concurrent skip shared','safe metadata and errors exclude private values','no financial writes'],externalQueries:0,financialWrites}));
})().catch(error=>{console.error(error);process.exitCode=1;});
