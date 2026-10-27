/* Own canonical pending requests, real repositories/UI, isolated transport only. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {setup,flush,count}=require('./test-history-snapshot-browser');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const card=(base,id)=>base.locator('.su-history-entry').filter({hasText:id});
async function nativeTransport(page){
 await page.evaluate(()=>{
  window.rpcCalls=[];window.nativeDelayed=[];window.delayNative=false;window.failNative=false;window.testApprovals=[];
  const originalClient=SutiSupabase.getClient,clone=value=>JSON.parse(JSON.stringify(value));
  SutiSupabase.getClient=()=>{const client=originalClient();return {...client,rpc:async(name,args)=>{
   if(name!=='list_self_program_request_history'||args!==undefined)throw Error('UNEXPECTED_NATIVE_RPC');
   const call={name,identity,control};rpcCalls.push(call);nativeCalls.push(call);
   const result=failNative?{error:Error('SYNTHETIC_NATIVE_FAILURE')}:{data:clone(identity==='A'&&control==='0007'?nativeRows:[])};
   if(delayNative)return new Promise(resolve=>nativeDelayed.push({resolve,result,identity}));return result;
  },functions:{invoke:async(name,args)=>{
   if(name!=='loan-history'||args.body.action!=='APPROVALS')return client.functions.invoke(name,args);
   if(Object.keys(args.body).join(',')!=='action')throw Error('APPROVAL_OWNER_SELECTOR');
   approvalCalls.push({identity,control});return {data:{version:1,server_now:new Date().toISOString(),approval_revision:null,approvals:clone(identity==='A'&&control==='0007'?testApprovals:[])}};
  }}};};
  const originalPush=app.push;window.routes=[];app.push=(name,params)=>{routes.push({name,params});originalPush(name,params);};
  window.resolveNative=()=>nativeDelayed.splice(0).forEach(item=>item.resolve(item.result));
 });
 await page.addScriptTag({content:read('app/program-request-repository.js')});
 await page.evaluate(()=>window.dispatchEvent(new Event('suti:request-changed')));await flush(page);
}
async function main(){
 const evidence=process.env.SUTI_HISTORY_EVIDENCE_DIR||path.join(root,'.tmp/history-native-pending-browser');fs.mkdirSync(evidence,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const width of [320,390,1440]){
  const {page,errors,external}=await setup(browser,width),base=page.locator('[data-base]'),detail=page.locator('[data-detail]');
  await nativeTransport(page);
  assert.equal(await card(base,'SR-PENDING').count(),1,'own pending is visible before the independent LOAD finishes');
  assert.equal(await base.locator('[data-history-source=loading]').count(),1);
  assert.equal((await count(page)).history,1,'native refresh does not duplicate pending LOAD');
  await base.getByRole('button',{name:'En proceso',exact:true}).click();await flush(page);
  assert.equal(await card(base,'SR-PENDING').count(),1);
  await card(base,'SR-PENDING').click();await flush(page);
  assert.equal(await detail.getByText('Seguimiento',{exact:true}).count(),1);assert.equal(await detail.locator('[data-installment]').count(),0);
  const tracking=await page.evaluate(()=>routes.at(-1));assert.equal(tracking.name,'tracking');assert.equal(tracking.params.s.sourceId,'pending');assert(!('loanKey'in tracking.params));assert(!tracking.params.s.history);
  await page.evaluate(()=>setRoute(null));await flush(page);
  await page.evaluate(()=>{delayed[0].response={error:Error('SYNTHETIC_SOURCE_FAILURE')};delayHistory=false;resolveHistory();});await flush(page);
  assert.equal(await base.locator('[data-history-source=error]').count(),1,'source error is explicit beside canonical pending');assert.equal(await card(base,'SR-PENDING').count(),1);
  await page.screenshot({path:path.join(evidence,'pending-source-error-'+width+'.png')});
  await base.locator('[data-history-source=error]').getByRole('button',{name:'Reintentar',exact:true}).click();await flush(page);
  assert.equal(await card(base,'SR-PENDING').count(),1,'published and native pending are one card');
  await page.evaluate(()=>{
   payload.entries=payload.entries.filter(entry=>entry.sourceId!=='pending');payload.covered_request_ids=[];payload.financial_request_ids=[];
   payload.source_updated_at=new Date(Date.now()+3600000).toISOString();publishVersion('pending-export-delayed');
  });await flush(page);
  assert.equal(await card(base,'SR-PENDING').count(),1,'canonical pending survives a later publication without an exported row');
  await base.getByRole('button',{name:'Todas',exact:true}).click();await flush(page);
  await page.evaluate(()=>setRoute({loanKey:'loan:1'}));await flush(page);
  const scroll=detail.locator('[data-amortization-scroll]');await scroll.evaluate(el=>{el.scrollTop=350;window.pendingTestScroll=el;window.pendingTestTop=el.scrollTop;});
  const before=await count(page),beforeApprovals=await page.evaluate(()=>approvalCalls.length),raw=await page.evaluate(async()=>JSON.stringify((await LoanHistory.load('loan:1')).entries)),quotas=await detail.locator('[data-installment]').allTextContents();
  await page.evaluate(()=>{
   nativeRows.push({...nativeRows[0],id:'warm-new',folio:'SR-WARM',status:'requires_financial_processing',created_at:new Date().toISOString()});
   window.dispatchEvent(new Event('suti:request-changed'));
  });await flush(page);
  const after=await count(page);assert.equal(after.history,before.history,'warm request creation does not reload amortizations');assert.equal(after.native,before.native+1,'only the existing own native event read');assert.equal(await page.evaluate(()=>approvalCalls.length),beforeApprovals+1,'existing lightweight event refresh remains unchanged');
  assert.equal(await card(base,'SR-WARM').count(),1,'new request appears despite stale financial_request_ids');
  assert(await scroll.evaluate(el=>el===pendingTestScroll&&el.scrollTop===pendingTestTop),'native update preserves open amortization DOM and scroll');assert.deepEqual(await detail.locator('[data-installment]').allTextContents(),quotas);
  assert.equal(await page.evaluate(async()=>JSON.stringify((await LoanHistory.load('loan:1')).entries)),raw,'native update never alters loan financial fields');
  const downloadPromise=page.waitForEvent('download');await detail.getByRole('button',{name:'Descargar estado de cuenta',exact:true}).click();const download=await downloadPromise,pdfPath=path.join(evidence,'unchanged-statement-'+width+'.pdf');await download.saveAs(pdfPath);
  const parsed=await page.evaluate(bytes=>readStatementPdf(bytes),Array.from(fs.readFileSync(pdfPath))),expected=await page.evaluate(async()=>expectedStatementRows(LoanHistory.project(await LoanHistory.load('loan:1'),0)[0]));
  assert.deepEqual(parsed.rows,expected);assert(parsed.text.includes('Total pagado'));assert.equal((await count(page)).history,before.history);
  await page.evaluate(()=>setRoute(null));await flush(page);
  await page.evaluate(()=>{
   const make=(id,sourceId)=>({key:'request:'+id,id,sourceId,kind:'request',category:'En proceso',status:'Pendiente',fund:'Solicitud pendiente',principal:3000,total:3600,term:6,date:'2026-10-26',approved_at:null,expires_at:null,schedule:[]});
   payload.entries.push(make('SR-WARM','warm-new'),make('SR-SOURCE-ONLY',null));payload.covered_request_ids=['warm-new'];publishVersion('pending-published');
  });await flush(page);
  assert.equal(await card(base,'SR-WARM').count(),1);assert.equal(await card(base,'SR-SOURCE-ONLY').count(),1);
  await page.evaluate(()=>{payload.entries=payload.entries.filter(entry=>entry.id!=='SR-SOURCE-ONLY');publishVersion('pending-source-deleted');});await flush(page);assert.equal(await card(base,'SR-SOURCE-ONLY').count(),0,'source-only deletion never resurrects');
  await page.evaluate(()=>{nativeRows=nativeRows.filter(row=>row.id!=='pending');window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);assert.equal(await card(base,'SR-PENDING').count(),0,'canonical deletion removes native pending');
  await page.evaluate(()=>{
   payload.entries=payload.entries.filter(entry=>entry.sourceId!=='warm-new');payload.covered_request_ids=[];
   nativeRows.find(row=>row.id==='warm-new').status='cancelled';publishVersion('pending-terminal');window.dispatchEvent(new Event('suti:request-changed'));
  });await flush(page);assert.equal(await card(base,'SR-WARM').count(),0,'cancelled request is not pending');
  const eligibility=await page.evaluate(()=>{
   const base={id:'SR-ELIGIBLE',sourceId:'eligible',kind:'loan',financial:true,estado:'revision',requestStatus:'submitted',ts:1,steps:[]};
   const cases=[undefined,null,'','unknown','approved','completed','rejected','cancelled'];
   return {denied:cases.map(requestStatus=>LoanHistory.merge([{...base,requestStatus}],null,0).length),allowed:['submitted','in_review','requires_financial_processing'].map(requestStatus=>LoanHistory.merge([{...base,requestStatus}],null,0).length),badIdentity:[{sourceId:null},{sourceId:' '},{id:'OTHER'},{estado:'aprobado'}].map(fields=>LoanHistory.merge([{...base,...fields}],null,0).length)};
  });assert(eligibility.denied.every(n=>n===0));assert(eligibility.allowed.every(n=>n===1));assert(eligibility.badIdentity.every(n=>n===0));
  await page.evaluate(()=>{
   nativeRows.find(row=>row.id==='warm-new').status='in_review';
   const approved_at=new Date(Date.now()-2*86400000).toISOString();
   testApprovals=[{id:'SR-WARM',sourceId:'warm-new',approved_at,expires_at:new Date(Date.parse(approved_at)+86400000).toISOString(),fund:'Solicitud aprobada',principal:3000,total:3600,term:6,date:'2026-10-24'}];
   window.dispatchEvent(new Event('suti:request-changed'));
  });await flush(page);assert.equal(await card(base,'SR-WARM').count(),0,'old confirmed approval suppresses stale native pending even if its card is omitted');
  await page.evaluate(()=>{const approved_at=new Date().toISOString();testApprovals[0]={...testApprovals[0],approved_at,expires_at:new Date(Date.parse(approved_at)+86400000).toISOString()};window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  assert.equal(await card(base,'SR-WARM').count(),1);await base.getByRole('button',{name:'Aprobadas',exact:true}).click();await flush(page);assert.equal(await card(base,'SR-WARM').count(),1);
  const beforeExpiry=await count(page);await page.clock.fastForward(86400001);await flush(page);assert.equal(await card(base,'SR-WARM').count(),0);assert.deepEqual(await count(page),beforeExpiry,'expiry adds no calls');
  await base.getByRole('button',{name:'En proceso',exact:true}).click();await flush(page);assert.equal(await card(base,'SR-WARM').count(),0,'expired approval never becomes pending again');
  await base.getByRole('button',{name:'Todas',exact:true}).click();await flush(page);
  await page.evaluate(()=>{testApprovals=[];delayNative=true;nativeRows.push({...nativeRows.find(row=>row.id==='warm-new'),id:'late-A',folio:'SR-LATE-A'});window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  assert.equal(await page.evaluate(()=>nativeDelayed.length),1);
  await page.evaluate(()=>{delayNative=false;identity='B';control='0009';authChanged();});await flush(page);
  await page.evaluate(()=>resolveNative());await flush(page);
  assert.equal(await card(base,'SR-LATE-A').count(),0);assert.equal(await card(base,'SR-WARM').count(),0);assert.equal(await page.evaluate(()=>operationsStore.all().length),0,'late native response cannot cross own context');
  await page.evaluate(()=>{identity='A';control='0007';authChanged();});await flush(page);assert.equal(await card(base,'SR-LATE-A').count(),1);
  await page.evaluate(()=>{identity='';authChanged();});await flush(page);assert.equal(await base.locator('.su-history-entry').count(),0);assert.equal((await count(page)).active,0);
  assert(await page.evaluate(()=>rpcCalls.every(call=>call.name==='list_self_program_request_history')));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  checks.push({width,status:'PASS',realNativeRepositoryAndStore:true,coldLoading:true,sourceErrorVisible:true,canonicalPendingIndependent:true,warmCreateWithOldIds:true,noAddedCalls:true,noNewTimerOrChannel:true,publishedDedup:true,sourceOnlyDeletion:true,nativeDeletionAndTerminal:true,explicitStatusAllowlist:true,allApprovalIdsSuppress:true,expiryUnchanged:true,nativeTracking:true,lateNativeIdentityGuard:true,logout:true,openDetailScroll:true,loanAndPdfUnchanged:true});await page.close();
 }}finally{await browser.close();}
 const result={status:'PASS',checks,sourceHashes:Object.fromEntries(['app/history-loans-repository.js','app/program-request-repository.js','app/operations-store.jsx','app/screens-historial.jsx','scripts/test-history-native-pending-browser.js'].map(file=>[file,crypto.createHash('sha256').update(read(file)).digest('hex')]))};fs.writeFileSync(path.join(evidence,'native-pending-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
