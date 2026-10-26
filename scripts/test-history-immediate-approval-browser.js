/* Isolated own-approval transport and continuity regression; no live services. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {setup,flush,count}=require('./test-history-snapshot-browser');
const root=path.resolve(__dirname,'..');
async function prepare(browser,width,deferInitial=false){
 const result=await setup(browser,width),{page}=result;
 await page.evaluate(deferInitial=>{
  window.approvalRevision=null;window.approvalRows=[];window.approvalReadCalls=[];window.approvalDelayed=[];window.delayApprovals=false;window.failApprovals=false;window.invalidApprovals=false;window.approvalStatus=0;
  window.makeApproval=(sourceId,id)=>{const approved_at=new Date().toISOString();return {id,sourceId,approved_at,expires_at:new Date(Date.parse(approved_at)+86400000).toISOString(),fund:'Aprobación '+id,principal:9999,total:12000,term:24,date:approved_at.slice(0,10)};};
  const originalClient=SutiSupabase.getClient,originalPayload=makePayload;
  window.makePayload=()=>{const value=originalPayload();return {...value,approvals:identity==='A'&&control==='0007'?JSON.parse(JSON.stringify(approvalRows)):[],approval_revision:identity==='A'&&control==='0007'?approvalRevision:null};};
  SutiSupabase.getClient=()=>{const client=originalClient();return {...client,functions:{invoke:async(name,args)=>{
   if(name!=='loan-history'||args.body.action!=='APPROVALS')return client.functions.invoke(name,args);
   if(Object.keys(args.body).join(',')!=='action')throw Error('OWNER_SELECTOR_SENT');
   approvalReadCalls.push({identity,control,body:args.body});
   const value={version:1,server_now:new Date().toISOString(),approval_revision:approvalRevision,approvals:JSON.parse(JSON.stringify(identity==='A'&&control==='0007'?approvalRows:[]))};
   if(invalidApprovals)value.approvals=[{id:'INVALID'}];
   const response=failApprovals?{error:Object.assign(Error('SYNTHETIC_APPROVAL_FAILURE'),{context:{status:approvalStatus}})}:{data:value};
   if(delayApprovals)return new Promise(resolve=>approvalDelayed.push({resolve,response}));return response;
  }},from:table=>table==='loan_history_approval_publication'?{select:fields=>{if(fields!=='version')throw Error('APPROVAL_METADATA_FIELDS');return {eq:(column,id)=>{if(column!=='affiliate_id'||id!==identity)throw Error('APPROVAL_METADATA_OWNER');return {maybeSingle:async()=>{approvalMetadataCalls++;return {data:identity==='A'&&approvalRevision?{version:approvalRevision}:null};}};}};}}:client.from(table)};};
  window.publishApproval=(version,affiliate='A')=>{
   if(affiliate==='A')approvalRevision=version;
   channels.filter(channel=>!channel.closed).forEach(channel=>channel.handlers.filter(handler=>handler.filter.table==='loan_history_approval_publication').forEach(handler=>handler.fn({eventType:'UPDATE',new:{affiliate_id:affiliate,version}})));
  };
  window.resolveApproval=()=>{const next=approvalDelayed.shift();if(next)next.resolve(next.response);};
  if(!deferInitial){delayHistory=false;resolveHistory();}
 },deferInitial);await flush(page);
 if(deferInitial)return result;
 await page.evaluate(()=>{
  payload.source_updated_at=new Date(Date.now()-3600000).toISOString();
  payload.entries[1].sourceId='existing';payload.entries[1].status='';payload.entries[1].category='Estado por revisar';
  payload.entries[2].sourceId='settled';publishVersion('approval-fixture');
 });await flush(page);return result;
}
async function subscriptionGap(browser,width){
 const {page,errors,external}=await prepare(browser,width,true),base=page.locator('[data-base]');
 assert.equal((await count(page)).history,1);
 await page.evaluate(()=>{
  approvalRows=[makeApproval('gap','SR-GAP')];approvalRevision='gap-1';
  channels.filter(channel=>!channel.closed).forEach(channel=>channel.notifyStatus('SUBSCRIBED'));
 });await flush(page);
 assert.equal(await page.evaluate(()=>approvalReadCalls.length),0,'subscription reconciliation waits for first LOAD');
 assert.equal(await page.evaluate(()=>approvalMetadataCalls),0);
 await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);
 assert.equal(await page.evaluate(()=>approvalMetadataCalls),1,'first LOAD drains deferred connection metadata check');
 assert.equal(await page.evaluate(()=>approvalReadCalls.length),1);assert.equal((await count(page)).history,1,'connection-gap catchup does not reread schedules');
 assert.equal(await base.getByText('SR-GAP',{exact:true}).count(),1,'approval missed before subscription is visible immediately');
 await page.evaluate(()=>setRoute({loanKey:'loan:1'}));await flush(page);
 const detail=page.locator('[data-detail]'),scroll=detail.locator('[data-amortization-scroll]');
 await scroll.evaluate(el=>{el.scrollTop=300;window.gapScroll=el;window.gapTop=el.scrollTop;});
 const quotas=await detail.locator('[data-installment]').allTextContents();
 await page.evaluate(()=>{delayHistory=true;publishVersion('gap-publication');});await flush(page);
 await page.evaluate(()=>{
  approvalRows.push(makeApproval('gap-next','SR-GAP-NEXT'));approvalRevision='gap-2';
  channels.filter(channel=>!channel.closed).forEach(channel=>channel.notifyStatus('SUBSCRIBED'));
 });await flush(page);
 assert.equal(await page.evaluate(()=>approvalReadCalls.length),1,'reconnection during refresh remains deferred');
 assert.deepEqual(await detail.locator('[data-installment]').allTextContents(),quotas);
 await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);
 assert.equal(await page.evaluate(()=>approvalReadCalls.length),2);assert.equal(await page.evaluate(()=>approvalMetadataCalls),2);
 assert.equal((await count(page)).history,2,'one requested publication LOAD only, no catchup LOAD');
 assert.equal(await base.getByText('SR-GAP-NEXT',{exact:true}).count(),1);
 assert(await scroll.evaluate(el=>el===gapScroll&&el.scrollTop===gapTop),'deferred reconciliation preserves existing detail and scroll');
 assert.deepEqual(await detail.locator('[data-installment]').allTextContents(),quotas);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await page.close();
}
async function main(){
 const evidence=process.env.SUTI_HISTORY_EVIDENCE_DIR||path.join(root,'.tmp/history-immediate-approval-browser');fs.mkdirSync(evidence,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const width of [320,390,1440]){
  await subscriptionGap(browser,width);
  const {page,errors,external}=await prepare(browser,width),base=page.locator('[data-base]'),detail=page.locator('[data-detail]');
  await page.evaluate(()=>setRoute({loanKey:'loan:1'}));await flush(page);
  const scroll=detail.locator('[data-amortization-scroll]');await scroll.evaluate(el=>{el.scrollTop=350;window.approvalScroll=el;window.approvalScrollTop=el.scrollTop;});
  const initial=await count(page),raw=await page.evaluate(async()=>{const data=await LoanHistory.load('loan:1');return {entry:data.entries[0],updated:data.source_updated_at,version:data.sync_version};});
  await page.evaluate(()=>publishApproval('foreign','B'));await flush(page);assert.equal(await page.evaluate(()=>approvalReadCalls.length),0,'foreign signal causes no read');
  await page.evaluate(()=>{approvalRows=[makeApproval('pending','SR-PENDING'),makeApproval('existing','SR-EXISTING'),makeApproval('new','SR-NEW'),makeApproval('settled','SR-SETTLED')];publishApproval('a1');});await flush(page);
  assert.equal(await page.evaluate(()=>approvalReadCalls.length),1);assert.equal((await count(page)).history,initial.history,'own approval does not load schedules');
  assert(await scroll.evaluate(el=>el===approvalScroll&&el.scrollTop===approvalScrollTop),'own approval preserves detail DOM and scroll');
  const after=await page.evaluate(async()=>{const data=await LoanHistory.load('loan:1');return {entry:data.entries[0],updated:data.source_updated_at,version:data.sync_version};});assert.deepEqual(after,raw,'unrelated amortization and source stamp remain exact');
  await page.evaluate(()=>publishApproval('a1'));await flush(page);assert.equal(await page.evaluate(()=>approvalReadCalls.length),1,'duplicate revision does not read');
  const composition=await page.evaluate(async()=>LoanHistory.project(await LoanHistory.load(),0));
  const blank=composition.find(row=>row.sourceId==='existing'),settled=composition.find(row=>row.sourceId==='settled'),pending=composition.find(row=>row.sourceId==='pending');
  assert.equal(blank.category,'Aprobadas');assert.equal(blank.principal,700);assert.equal(blank.schedule.length,0,'summary intentionally excludes quotas');
  assert.equal(settled.category,'Liquidadas');assert.equal(pending.preparing,true);assert.equal(composition.filter(row=>row.sourceId==='pending').length,1);
  await detail.getByRole('button',{name:'Volver al historial',exact:true}).click();await flush(page);
  await base.getByRole('button',{name:'Aprobadas',exact:true}).click();await flush(page);assert.equal(await base.locator('.su-history-entry').count(),4);
  assert(!(await base.locator('[data-approval-countdown]').first().innerText()).includes('En pago en'));
  await page.evaluate(()=>setRoute({loanKey:'request:SR-PENDING'}));await flush(page);assert.equal(await detail.locator('[data-installment]').count(),0);
  const preparing=await page.evaluate(async()=>LoanHistory.project(await LoanHistory.load('request:SR-PENDING'),0)[0]);assert.equal(preparing.preparing,true);assert.equal(preparing.paid_to_date,undefined);
  await scroll.evaluate(el=>{window.pendingScroll=el;});
  await page.evaluate(()=>{
   const linked=loan('501','Aprobadas','AL CORRIENTE');linked.sourceId='pending';
   payload.entries=payload.entries.filter(row=>row.sourceId!=='pending').concat(linked);
   payload.source_updated_at=new Date(Date.now()+1000).toISOString();publishVersion('published-loan');
  });await flush(page);
  assert.equal(await detail.locator('[data-installment]').count(),12,'SR detail follows only confirmed sourceId to published loan');
  assert(await scroll.evaluate(el=>el===pendingScroll),'SR to loan keeps the same detail DOM');assert.equal(await detail.getByText('Ref: #501',{exact:true}).count(),1);
  const linked=await page.evaluate(async()=>LoanHistory.project(await LoanHistory.load('request:SR-PENDING'),0)[0]);assert.equal(linked.key,'request:SR-PENDING');assert.equal(linked.id,'501');
  assert.equal(await base.getByText('SR-PENDING',{exact:true}).count(),0);assert.equal(await base.getByText('501',{exact:true}).count(),1);
  const beforeRevocation=await page.evaluate(async()=>({calls:historyCalls.length,schedule:(await LoanHistory.load('request:SR-PENDING')).entries[0].schedule}));
  await page.evaluate(()=>{window.savedApprovals=approvalRows;approvalRows=approvalRows.filter(row=>!['pending','new'].includes(row.sourceId));publishApproval('revoked');});await flush(page);
  const revoked=await page.evaluate(async()=>LoanHistory.project(await LoanHistory.load('request:SR-PENDING'),0)[0]);
  assert.equal(revoked.approved_at,null);assert.equal(revoked.category,'En pago');assert.equal(await base.getByText('SR-NEW',{exact:true}).count(),0,'withdrawn approval cannot leave a standalone card');
  assert.deepEqual(await page.evaluate(async()=>(await LoanHistory.load('request:SR-PENDING')).entries[0].schedule),beforeRevocation.schedule,'withdrawing a clock preserves all installments');assert.equal((await count(page)).history,beforeRevocation.calls);
  await page.evaluate(()=>{approvalRows=savedApprovals;publishApproval('restored');});await flush(page);assert.equal(await base.getByText('501',{exact:true}).count(),1);
  const beforeError=await count(page),schedule=await detail.locator('[data-installment]').allTextContents();
  await page.evaluate(()=>{failApprovals=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  assert.equal(await detail.locator('[data-history-source=error]').count(),1);assert.deepEqual(await detail.locator('[data-installment]').allTextContents(),schedule);assert.equal((await count(page)).history,beforeError.history);
  await page.evaluate(()=>{failApprovals=false;});await detail.getByRole('button',{name:'Reintentar',exact:true}).click();await flush(page);
  assert.equal(await detail.locator('[data-history-source=loaded]').count(),1);assert.equal((await count(page)).history,beforeError.history,'approval retry remains lightweight');
  await page.evaluate(()=>{invalidApprovals=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);assert.equal(await detail.locator('[data-history-source=error]').count(),1);assert.equal(await detail.locator('[data-installment]').count(),12);
  await page.evaluate(()=>{invalidApprovals=false;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);
  const beforeRace=await page.evaluate(()=>approvalReadCalls.length);
  await page.evaluate(()=>{delayApprovals=true;approvalRows.push(makeApproval('race','SR-RACE'));publishApproval('a2');});await flush(page);
  await page.evaluate(()=>{approvalRows=approvalRows.filter(row=>row.sourceId!=='race');approvalRows.push(makeApproval('newer','SR-NEWER'));publishApproval('a3');});await flush(page);
  assert.equal(await page.evaluate(()=>approvalReadCalls.length),beforeRace+1,'concurrent signals share in-flight read');
  await page.evaluate(()=>resolveApproval());await flush(page);assert.equal(await base.getByText('SR-RACE',{exact:true}).count(),0,'stale approval response never renders');
  assert.equal(await page.evaluate(()=>approvalReadCalls.length),beforeRace+2);await page.evaluate(()=>{delayApprovals=false;resolveApproval();});await flush(page);
  assert.equal(await base.getByText('SR-NEWER',{exact:true}).count(),1);assert.equal((await count(page)).history,beforeError.history);
  const idle=await count(page),approvalIdle=await page.evaluate(()=>approvalReadCalls.length);
  await page.clock.fastForward(86400001);await flush(page);assert.deepEqual(await count(page),idle);assert.equal(await page.evaluate(()=>approvalReadCalls.length),approvalIdle,'24-hour expiry has no polling');
  // Use the hook's elapsed time, because load() returns the unchanged server anchor.
  const elapsedRows=await page.evaluate(async()=>{const value=await LoanHistory.load();return LoanHistory.project(value,Date.now()-Date.parse(value.server_now));});
  assert.equal(elapsedRows.find(row=>row.sourceId==='existing').category,'Estado por revisar');assert.equal(elapsedRows.find(row=>row.sourceId==='pending').category,'En pago');assert.equal(elapsedRows.find(row=>row.sourceId==='settled').category,'Liquidadas');
  assert.equal(await base.locator('.su-history-entry').count(),0,'expired approvals leave Aprobadas immediately');assert.equal(await detail.locator('[data-installment]').count(),12);
  assert(await scroll.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'no horizontal overflow');
  const ownCalls=await page.evaluate(()=>approvalReadCalls.length);
  await page.evaluate(()=>setTab('other'));await detail.getByRole('button',{name:'Volver al historial',exact:true}).click();await flush(page);
  assert.equal((await count(page)).active,0);
  await page.evaluate(()=>{approvalRows.push(makeApproval('missed','SR-MISSED'));approvalRevision='a4';setTab('history');});await flush(page);
  assert.equal(await page.evaluate(()=>approvalReadCalls.length),ownCalls+1,'mount metadata recovers a missed own revision');assert.equal((await count(page)).history,idle.history);
  await base.getByRole('button',{name:'Aprobadas',exact:true}).click();await flush(page);assert.equal(await base.getByText('SR-MISSED',{exact:true}).count(),1);
  await page.evaluate(()=>{delayApprovals=true;approvalRows.push(makeApproval('old-owner','SR-OLD-OWNER'));publishApproval('a5');});await flush(page);
  await page.evaluate(()=>{identity='B';control='0009';authChanged();});await flush(page);assert.equal(await base.getByText('SR-MISSED',{exact:true}).count(),0);
  await page.evaluate(()=>{delayApprovals=false;resolveApproval();});await flush(page);assert.equal(await base.getByText('SR-OLD-OWNER',{exact:true}).count(),0,'late response cannot cross identity');
  await page.evaluate(()=>{identity='A';control='0007';authChanged();});await flush(page);
  await page.evaluate(()=>{approvalStatus=403;failApprovals=true;window.dispatchEvent(new Event('suti:request-changed'));});await flush(page);assert.equal(await base.locator('.su-history-entry').count(),0,'authorization denial purges private history');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  checks.push({width,status:'PASS',subscriptionGap:true,refreshSubscriptionGap:true,ownSignalOnly:true,noScheduleReload:true,duplicateRevision:true,financialValuesUnchanged:true,blankApproval:true,settledWins:true,sourceIdAlias:true,scrollContinuity:true,revocation:true,lightweightRetry:true,malformedPayload:true,coalescedRaces:true,expiryWithoutPolling:true,missedRevisionRecovery:true,identityIsolation:true,denialPurge:true});await page.close();
 }}finally{await browser.close();}
 const result={status:'PASS',checks,hashes:Object.fromEntries(['app/history-loans-repository.js','app/history-loans.jsx','scripts/test-history-immediate-approval-browser.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))};
 fs.writeFileSync(path.join(evidence,'immediate-approval-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
