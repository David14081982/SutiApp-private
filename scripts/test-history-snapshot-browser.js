'use strict';
// Snapshot contract supersedes the prior five-minute memory contract. Real
// focal modules and native store; synthetic own transport; all network blocked.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const css=[...read('SutiApp.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const flush=async page=>{await page.clock.runFor(40);await page.evaluate(()=>Promise.resolve());};
const count=page=>page.evaluate(()=>({history:historyCalls.length,native:nativeCalls.length,metadata:metadataCalls,active:channels.filter(x=>!x.closed).length}));
async function installStatementReader(page){
 const urls=['pdf.min.mjs','pdf.worker.min.mjs'].map(name=>'data:text/javascript;base64,'+Buffer.from(read('app/vendor/pdfjs-5.4.149/'+name)).toString('base64'));
 await page.evaluate(async urls=>{
  globalThis.pdfjsWorker=await import(urls[1]);const pdfjs=await import(urls[0]);
  window.expectedStatementRows=entry=>{
   const date=new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Hermosillo'});
   return entry.schedule.map((row,index)=>({number:String(index+1),date:row.date?date.format(new Date(row.date.length===10?row.date+'T12:00:00-07:00':row.date)):LoanHistory.formatDate(row.date),amount:typeof row.amount==='number'&&Number.isFinite(row.amount)?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(row.amount):'No registrado',state:row.state}));
  };
  window.readStatementPdf=async(raw,render=false)=>{
   const document=await pdfjs.getDocument({data:new Uint8Array(raw),useSystemFonts:true}).promise,rows=[];let text='',maxRight=0;
   for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){
    const pdfPage=await document.getPage(pageNumber),items=(await pdfPage.getTextContent()).items.filter(item=>item.str.trim()),lines=[];
    text+=items.map(item=>item.str).join(' ')+' ';
    for(const item of items){maxRight=Math.max(maxRight,item.transform[4]+item.width);let line=lines.find(line=>Math.abs(line.y-item.transform[5])<1);if(!line){line={y:item.transform[5],items:[]};lines.push(line);}line.items.push(item);}
    lines.sort((a,b)=>b.y-a.y);lines.forEach(line=>line.items.sort((a,b)=>a.transform[4]-b.transform[4]));
    // Infer the columns from the rendered table headings, not PDF operators,
    // source-specific coordinates or the old pipe-delimited line format.
    const heading=lines.findIndex(line=>['Cuota','Fecha','Importe','Estado'].every(label=>line.items.some(item=>item.str===label)));
    if(heading<0)continue;
    const labels=['Cuota','Fecha','Importe','Estado'],anchors=labels.map(label=>lines[heading].items.find(item=>item.str===label).transform[4]);
    const boundaries=anchors.slice(1).map((x,index)=>(x+anchors[index])/2);let active=null;
    for(const line of lines.slice(heading+1)){
     if(line.items[0].transform[4]<anchors[0]-1)break;
     const cells=['','','',''];for(const item of line.items){const column=boundaries.findIndex(boundary=>item.transform[4]<boundary),index=column<0?3:column;cells[index]+=(cells[index]?' ':'')+item.str;}
     if(/^\d+$/.test(cells[0])){active={number:cells[0],date:cells[1],amount:cells[2],state:cells[3]};rows.push(active);}
     else if(active&&cells[0]==='')for(const [index,key]of ['number','date','amount','state'].entries())if(cells[index])active[key]+=(active[key]?' ':'')+cells[index];
    }
   }
   let rendered=0;
   if(render){const canvas=window.document.createElement('canvas'),pdfPage=await document.getPage(1),viewport=pdfPage.getViewport({scale:1});canvas.width=viewport.width;canvas.height=viewport.height;await pdfPage.render({canvasContext:canvas.getContext('2d'),viewport}).promise;rendered=canvas.toDataURL('image/png').length;}
   return {pages:document.numPages,text,maxRight,rendered,rows};
  };
 },urls);
}
async function setup(browser,width){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>{external.push(route.request().url());return route.abort();});
 await page.clock.install({time:new Date('2026-10-26T19:00:00.000Z')});
 await page.setContent('<style>'+css+'body{margin:0;display:block}#root{position:relative;height:900px;max-width:480px;margin:auto;overflow:auto;background:var(--bg)}</style><div id="root"></div>');
 for(const name of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read('app/vendor/'+name)});
 for(const name of ['icons.jsx','ui.jsx'])await page.addScriptTag({content:read('app/'+name)});
 await page.evaluate(width=>{
  const h=React.createElement,clone=value=>JSON.parse(JSON.stringify(value));
  window.money=value=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value);
  window.TopBar=()=>h('header',null,h('h1',null,'Mi Historial'));window.RequestAuthorizationNotice=()=>null;window.FarmaHistory=()=>null;
  window.metadataCalls=0;window.channels=[];window.publication='v1';window.failureStatus=0;window.imp=null;window.opened=[];window.open=(...args)=>opened.push(args);window.identity='A';window.control='0007';window.token=1;window.authListeners=[];window.historyCalls=[];window.nativeCalls=[];window.delayed=[];window.delayHistory=true;window.failHistory=false;
  window.AffiliateAuth={getState:()=>identity?{phase:'authenticated',impersonation:imp,session:{session_id:'session-'+identity,user:{id:identity},access_token:'synthetic-'+identity+'-'+token},affiliate:{id:identity,numero_control:control}}:{phase:'unauthenticated'},subscribe:fn=>{authListeners.push(fn);fn();return()=>{authListeners=authListeners.filter(item=>item!==fn);};}};
  const now=new Date().toISOString(),date=now.slice(0,10);
  window.loan=(id,category,status)=>({key:'loan:'+id,id,sourceId:null,kind:'loan',category,status,fund:'Préstamo '+id,principal:700,total:1000,term:12,date,
   approved_at:category==='Aprobadas'?now:null,expires_at:category==='Aprobadas'?new Date(Date.parse(now)+86400000).toISOString():null,paid_to_date:250,expected_to_date:500,
   // Legacy S values repeat/reset or are absent. They are not display ordinals.
   schedule:Array.from({length:12},(_,i)=>({source_row:100+i,number:width===390?1:width===320?i%3+1:[null,1,1,2,null,1,4,null,3,1,null,1][i],date:id==='2'&&i===11?null:i<3?date:'2099-11-15',amount:i===0||i===1||i===11?0:500,scheduled:500,state:i===0?'Pagada':'Pendiente'}))});
  window.payload={version:1,sync_version:'v1',source_updated_at:now,sync_state:{status:'READY'},server_now:now,business_day:date,covered_request_ids:['pending'],financial_request_ids:['pending'],entries:[loan('1','Aprobadas','AL CORRIENTE'),loan('2','En pago','SALDO ATRASADO'),loan('3','Liquidadas','PAGÓ DE MÁS'),
   {key:'request:SR-PENDING',id:'SR-PENDING',sourceId:'pending',kind:'request',category:'En proceso',status:'Pendiente',fund:'Solicitud pendiente',principal:3000,total:3600,term:6,date,approved_at:null,expires_at:null,schedule:[]},
   {key:'request:SR-REJECTED',id:'SR-REJECTED',sourceId:null,kind:'request',category:'No aprobadas',status:'Rechazado',fund:'Solicitud rechazada',principal:3000,total:3600,term:6,date,approved_at:null,expires_at:null,schedule:[]}]};
  window.nativeRows=[{id:'pending',folio:'SR-PENDING',program_id:'prestamo',status:'submitted',financial_processing_status:'pending',created_at:now,requested_amount:3000,requested_term:6,workflow_state:{available:true,stages:[{id:'one',label:'Solicitud enviada',state:'done'},{id:'two',label:'Revisión',state:'current'}]}},
   {id:'quote',folio:'COT-TEST',program_id:'convenio',request_type:'quote',status:'submitted',productoNombre:'Cotización nativa',created_at:now,workflow_state:{available:true,stages:[]}}];
  window.makePayload=()=>({...clone(payload),server_now:new Date().toISOString(),...(identity==='A'&&control==='0007'?{}:{entries:[loan(identity==='B'?'B':'CONTROL','En pago','AL CORRIENTE')],covered_request_ids:[],financial_request_ids:[]})});
  window.approvalCalls=[];window.approvalMetadataCalls=0;window.refreshSerial=0;
  window.SutiSupabase={getClient:()=>({functions:{invoke:async(name,args)=>{
   if(name==='loan-history'&&args.body.action==='APPROVALS'){approvalCalls.push({identity,control});return {data:{version:1,server_now:new Date().toISOString(),approval_revision:null,approvals:[]}};}
   if(name!=='loan-history'||JSON.stringify(args.body)!==JSON.stringify({action:'LOAD'}))throw Error('UNEXPECTED_HISTORY_REQUEST');
   const response=failHistory?{error:Object.assign(Error('SYNTHETIC_SOURCE_FAILURE'),{context:{status:failureStatus}})}:{data:makePayload()};historyCalls.push({action:args.body.action,identity,control});
   if(delayHistory)return new Promise(resolve=>delayed.push({resolve,response}));return response;
  }},channel:()=>{const item={closed:false,handlers:[],on:(type,filter,fn)=>{item.handlers.push({filter,fn});return item;},subscribe:fn=>{item.notifyStatus=fn;return item;}};channels.push(item);return item;},removeChannel:async item=>{item.closed=true;},from:table=>{
   if(table==='loan_history_approval_publication')return {select:fields=>{if(fields!=='version')throw Error('BAD_APPROVAL_FIELDS');return {eq:(column,id)=>{if(column!=='affiliate_id'||id!==identity)throw Error('BAD_APPROVAL_OWNER');return {maybeSingle:async()=>{approvalMetadataCalls++;return {data:null};}};}};}};
   if(table!=='loan_history_publication')throw Error('BAD_META_TABLE');return {select:fields=>{if(fields!=='version,source_updated_at')throw Error('BAD_META_FIELDS');return {eq:(column,id)=>{if(column!=='id'||id!==true)throw Error('BAD_META_ID');return {maybeSingle:async()=>{metadataCalls++;return {data:{version:publication,source_updated_at:payload.source_updated_at}};}};}};}};}})};
  window.ProgramRequestRepository={listHistory:async()=>{nativeCalls.push({identity,control});return clone(identity==='A'&&control==='0007'?nativeRows:[]);}};
  window.publishVersion=version=>{publication=version;payload.sync_version=version;channels.filter(x=>!x.closed).forEach(x=>x.handlers.filter(h=>h.filter.table==='loan_history_publication').forEach(h=>h.fn({new:{version}})));};window.resolveHistory=()=>delayed.splice(0).forEach(item=>item.resolve(item.response));
  window.authChanged=()=>authListeners.slice().forEach(fn=>fn());
 },width);
 for(const name of ['admin-repository.js','private-resource-demand.js','operations-store.jsx','history-loans-repository.js','history-statement.js','history-loans.jsx','screens-historial.jsx'])await page.addScriptTag({content:read('app/'+name)});
 await installStatementReader(page);
 await page.evaluate(()=>{
  AdminRepository.primeAccessContext({full_access:true,role_code:'admin',technical_permissions:[],section_actions:[]});
  const h=React.createElement;
  window.app={back:()=>setRoute(null),push:(name,params)=>setRoute(params),setTab:()=>setTab('other')};
  function Harness(){const[tab,tabSetter]=React.useState('history'),[route,routeSetter]=React.useState(null);window.setTab=tabSetter;window.setRoute=routeSetter;
   return h(React.Fragment,null,tab==='history'&&h('div',{'data-base':''},h(HistorialScreen,{app})),route&&h('div',{'data-detail':'',style:{position:'absolute',inset:0,zIndex:40}},h(TrackingScreen,{app,params:route})));}
  window.root=ReactDOM.createRoot(document.getElementById('root'));root.render(h(Harness));
 });
 await flush(page);return {page,errors,external};
}
async function main(){
 const evidence=process.env.SUTI_HISTORY_EVIDENCE_DIR||path.join(root,'.tmp','history-snapshot-browser');fs.mkdirSync(evidence,{recursive:true});
 assert(!/localStorage|sessionStorage|indexedDB|caches\./.test(read('app/history-loans-repository.js')));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const width of [390,320,1440]){
  const {page,errors,external}=await setup(browser,width),base=page.locator('[data-base]');
  assert.deepEqual(await count(page),{history:1,native:1,metadata:0,active:1});
  assert.equal(await base.locator('.su-history-entry').count(),1,'native nonfinancial rows survive initial pending');
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);
  const initial=await count(page),expected={'Todas':6,'En proceso':2,'Aprobadas':1,'En pago':1,'Liquidadas':1,'No aprobadas':1};
  for(const [name,size]of Object.entries(expected)){await base.getByRole('button',{name,exact:true}).click();await flush(page);assert.equal(await base.locator('.su-history-entry').count(),size,name);}
  assert.deepEqual(await count(page),initial,'filters do not transfer data');
  await base.getByRole('button',{name:'Liquidadas',exact:true}).click();await flush(page);assert.equal(await base.getByText('Liquidada',{exact:true}).evaluate(el=>getComputedStyle(el).color),'rgb(19, 121, 74)');
  await base.getByRole('button',{name:'Aprobadas',exact:true}).click();await flush(page);
  const clock=await base.locator('[data-approval-countdown]').innerText();await page.clock.fastForward(60000);await flush(page);assert.notEqual(await base.locator('[data-approval-countdown]').innerText(),clock);assert.deepEqual(await count(page),initial);
  await base.locator('.su-history-entry').click();await flush(page);const detail=page.locator('[data-detail]'),scroll=detail.locator('[data-amortization-scroll]');
  assert.deepEqual(await count(page),initial,'opening detail reuses own schedule without API, metadata or native read');
  assert.equal(await detail.locator('[data-installment]').count(),12);
  const ordinals=Array.from({length:12},(_,i)=>String(i+1));
  const visibleOrdinals=()=>detail.locator('[data-installment]').evaluateAll(rows=>rows.map(row=>({badge:row.children[0].textContent.trim(),title:row.children[1].firstElementChild.textContent.trim()})));
  assert.deepEqual(await visibleOrdinals(),ordinals.map(n=>({badge:n,title:'Cuota '+n})),'every actual row has consecutive badge/title, including zero amounts');
  assert.equal((await detail.locator('[data-purpose=schedule-filters]').innerText()).trim(),'Historial');
  const rawBefore=await page.evaluate(async()=>({payload:JSON.stringify(payload),observation:JSON.stringify(await LoanHistory.load('loan:1'))}));
  assert.equal(await detail.locator('[data-installment="No se descontó"]').count(),2);
  assert.equal(await detail.locator('[data-installment=Pagada]').count(),1);
  assert.equal(await detail.locator('[data-installment=Pendiente]').count(),9);
  assert.equal(await detail.getByText('Próxima a vencer',{exact:true}).count(),9);
  assert.equal(await detail.getByText('Cierre de contrato',{exact:true}).count(),1);
  assert.equal(await detail.locator('[data-installment]').last().getAttribute('data-installment'),'Pendiente','last future zero is not liquidation');
  assert.equal(await detail.locator('[data-monetary-progress]').innerText(),'50%','progress uses dated A/B payments divided by K, ignoring conflicting V');
  assert((await detail.locator('[data-loan-principal]').innerText()).includes('700'));
  assert((await detail.locator('[data-loan-total]').innerText()).includes('1,000'));
  assert((await detail.locator('[data-loan-balance]').innerText()).includes('500'));
  assert.equal(await detail.locator('[data-history-updated]').count(),1);
  assert(await scroll.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'no horizontal overflow');
  await page.screenshot({path:path.join(evidence,'detail-'+width+'.png')});
  await detail.getByRole('button',{name:'Soporte',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>opened[0]),['https://api.whatsapp.com/send/?phone=526626727130&text&type=phone_number&app_absent=0','_blank','noopener,noreferrer']);
  const downloadPromise=page.waitForEvent('download');await detail.getByRole('button',{name:'Descargar estado de cuenta',exact:true}).click();const download=await downloadPromise;
  const pdfPath=path.join(evidence,'statement-'+width+'.pdf');await download.saveAs(pdfPath);const pdfBytes=fs.readFileSync(pdfPath);assert.equal(pdfBytes.subarray(0,8).toString(),'%PDF-1.4');
  const downloaded=await page.evaluate(bytes=>readStatementPdf(bytes),Array.from(pdfBytes));
  const expectedPdfRows=await page.evaluate(async()=>expectedStatementRows(LoanHistory.project(await LoanHistory.load('loan:1'),0)[0]));
  assert.deepEqual(downloaded.rows.map(row=>row.number),ordinals,'actual downloaded PDF matches all visible quota ordinals');
  assert.deepEqual(downloaded.rows,expectedPdfRows,'downloaded table preserves every date, amount and state in order');
  // Parse every page of a long, escaped statement with the real local PDF.js.
  if(width===390){
   const parsed=await page.evaluate(async()=>{
    const own=await LoanHistory.load('loan:1'),entry=LoanHistory.project(own,0)[0];
    entry.fund='Nómina (prueba) \\ línea '+('W'.repeat(280))+' '+('@'.repeat(180));entry.schedule=Array.from({length:210},(_,i)=>({...entry.schedule[i%12],number:1,closure:i===209}));
    const rawEntryBefore=JSON.stringify(entry);
    const parsed=await readStatementPdf(await LoanHistoryStatement.create(entry,own).arrayBuffer(),true);
    return {...parsed,expectedRows:expectedStatementRows(entry),rawUnchanged:JSON.stringify(entry)===rawEntryBefore};
   });
   assert(parsed.pages>5);assert(parsed.text.includes('Nómina (prueba) \\ línea'));assert(parsed.text.includes('50%'));assert(parsed.text.includes('500'));assert(parsed.rendered>1000);
   assert.equal((parsed.text.match(/W/g)||[]).length,280);assert.equal((parsed.text.match(/@/g)||[]).length,180);assert(parsed.maxRight<=576.01,'every rendered PDF line stays inside the Letter page right margin');
   assert.deepEqual(parsed.rows.map(row=>Number(row.number)),Array.from({length:210},(_,i)=>i+1),'PDF ordinal continues across pages although all source numbers are one');
   assert.deepEqual(parsed.rows,parsed.expectedRows,'all 210 rows retain their date, amount and state');assert(parsed.rawUnchanged,'standalone PDF generation preserves every source value and row');
  }
  assert.deepEqual(await page.evaluate(async()=>({payload:JSON.stringify(payload),observation:JSON.stringify(await LoanHistory.load('loan:1'))})),rawBefore,'UI/project/export preserve raw numbers, row order, dates, amounts and source-row identities');
  assert.deepEqual(await count(page),initial,'PDF export does not add reads');
  // A second loan starts at one independently. Equal dates and a final absent
  // date keep their existing order and each retain a place in the sequence.
  await page.evaluate(()=>setRoute({loanKey:'loan:2'}));await flush(page);
  assert.deepEqual(await visibleOrdinals(),ordinals.map(n=>({badge:n,title:'Cuota '+n})),'each loan independently restarts its full row sequence');
  assert.equal(await detail.locator('[data-installment]').last().getAttribute('data-installment'),'Fecha por revisar');
  assert.equal(await detail.getByText('Fecha no registrada',{exact:true}).count(),1);assert.equal(await detail.getByText('Cierre de contrato',{exact:true}).count(),1);
  const second=await page.evaluate(async()=>{const own=await LoanHistory.load('loan:2'),before=JSON.stringify(own),entry=LoanHistory.project(own,0)[0],parsed=await readStatementPdf(await LoanHistoryStatement.create(entry,own).arrayBuffer());return {pdfRows:parsed.rows,expectedRows:expectedStatementRows(entry),rawUnchanged:before===JSON.stringify(own),rows:entry.schedule.map(row=>({source_row:row.source_row,date:row.date,amount:row.amount,number:row.number}))};});
  assert.deepEqual(second.pdfRows.map(row=>row.number),ordinals);assert.deepEqual(second.pdfRows,second.expectedRows,'second loan retains all values, including its missing date');assert(second.rawUnchanged);
  assert.deepEqual(second.rows,await page.evaluate(()=>payload.entries[1].schedule.map(({source_row,date,amount,number})=>({source_row,date,amount,number}))),'ties/missing dates do not reorder or remove source rows');
  await page.evaluate(()=>setRoute({loanKey:'loan:1'}));await flush(page);assert.deepEqual(await count(page),initial,'switching owned details only uses existing memory');
  // Same identity refresh/token rotation keeps the same scroll element and rows.
  await scroll.evaluate(el=>{el.scrollTop=450;window.savedScroll=el;});const scrollBefore=await scroll.evaluate(el=>el.scrollTop);
  const beforeToken=await count(page);await page.evaluate(()=>{delayHistory=true;token++;authChanged();});await flush(page);
  assert.equal((await count(page)).history,beforeToken.history+1);assert.equal(await detail.locator('[data-installment]').count(),12);
  assert(await scroll.evaluate(el=>el===savedScroll&&Math.abs(el.scrollTop-450)<2),'token renewal preserves the scroll DOM and position');
  await page.evaluate(()=>{token++;authChanged();});await flush(page);assert.equal((await count(page)).history,beforeToken.history+2,'token renewal invalidates an already pending transport');
  await page.evaluate(()=>{const old=delayed.shift();old.resolve(old.response);});await flush(page);assert.equal(await detail.locator('[data-history-source=refreshing]').count(),1);assert.equal(await detail.locator('[data-installment]').count(),12);
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);assert.equal(await scroll.evaluate(el=>el.scrollTop),scrollBefore);
  const beforeTime=await count(page);await page.clock.fastForward(30*60*1000);await flush(page);assert.deepEqual(await count(page),beforeTime,'no five-minute polling or expiry');
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await flush(page);const visible=await count(page);
  assert.equal(visible.metadata,beforeTime.metadata+1);assert.equal(visible.history,beforeTime.history,'same publication transfers metadata only');
  // One signal publishes both mounted consumers atomically; no intermediate blank.
  const beforeSignal=await count(page);await page.evaluate(()=>{delayHistory=true;payload.entries[0].paid_to_date=999;payload.entries[0].schedule[2].amount=750;publishVersion('v2');});await flush(page);
  assert.equal((await count(page)).history,beforeSignal.history+1);assert.equal(await detail.locator('[data-installment]').count(),12);assert.equal(await detail.locator('[data-monetary-progress]').innerText(),'50%');
  await page.evaluate(()=>publishVersion('v2'));await flush(page);assert.equal((await count(page)).history,beforeSignal.history+1,'duplicate in-flight publication is coalesced');
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);assert.equal(await detail.locator('[data-monetary-progress]').innerText(),'75%');assert.equal(await scroll.evaluate(el=>el.scrollTop),scrollBefore);
  const afterSignal=await count(page);await page.evaluate(()=>publishVersion('v2'));await flush(page);assert.deepEqual(await count(page),afterSignal,'duplicate signal performs no fetch');
  // Transient failure is visible beside retained, timestamped publication.
  await page.evaluate(()=>{failHistory=true;publishVersion('refresh-'+(++refreshSerial));});await flush(page);
  assert.equal(await detail.locator('[data-history-source=error]').count(),1);assert.equal(await detail.locator('[data-installment]').count(),12);
  assert((await detail.locator('[data-history-source]').innerText()).includes('última publicación completa'));
  await page.evaluate(()=>{failHistory=false;});await detail.getByRole('button',{name:'Reintentar',exact:true}).click();await flush(page);
  // Backend synchronization failure preserves source timestamp and explicit state.
  await page.evaluate(()=>{payload.sync_state.status='FAILED';publishVersion('refresh-'+(++refreshSerial));});await flush(page);
  assert((await detail.locator('[data-history-source]').innerText()).includes('última actualización no se completó'));assert.equal(await detail.locator('[data-installment]').count(),12);
  await page.evaluate(()=>{payload.sync_state.status='READY';});await detail.getByRole('button',{name:'Reintentar',exact:true}).click();await flush(page);
  // Request mutation burst rejects an older response without clearing content.
  const beforeBurst=await count(page);await page.evaluate(()=>{delayHistory=true;payload.entries[0].fund='Obsoleto';publishVersion('refresh-'+(++refreshSerial));});await flush(page);
  await page.evaluate(()=>{payload.entries[0].fund='Actualizado';for(let i=0;i<3;i++)publishVersion('refresh-'+(++refreshSerial));});await flush(page);assert.equal((await count(page)).history,beforeBurst.history+1);
  await page.evaluate(()=>resolveHistory());await flush(page);assert.equal((await count(page)).history,beforeBurst.history+2);assert.equal(await detail.getByText('Obsoleto',{exact:true}).count(),0);assert.equal(await detail.locator('[data-installment]').count(),12);
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);assert.equal(await detail.getByText('Actualizado',{exact:true}).count(),1);
  // Auth denial is different: immediately remove every authorized financial row.
  await page.evaluate(()=>{failureStatus=403;failHistory=true;publishVersion('refresh-'+(++refreshSerial));});await flush(page);
  assert.equal(await detail.locator('[data-installment]').count(),0);assert.equal(await base.locator('.su-history-entry').count(),0,'active Aprobadas filter contains no native quote');assert.equal((await count(page)).active,0);
  await page.evaluate(()=>{failureStatus=0;failHistory=false;});await detail.getByRole('button',{name:'Reintentar',exact:true}).click();await flush(page);assert.equal(await detail.locator('[data-installment]').count(),12);
  // Switching exact control A-B-A while transports are pending never accepts old A.
  const beforeCycle=await count(page);await page.evaluate(()=>{delayHistory=true;payload.entries[0].fund='Old A';publishVersion('refresh-'+(++refreshSerial));});await flush(page);
  await page.evaluate(()=>{control='0008';authChanged();});await flush(page);assert.equal(await detail.locator('[data-installment]').count(),0);
  await page.evaluate(()=>{payload.entries[0].fund='New A';control='0007';authChanged();});await flush(page);assert.equal((await count(page)).history,beforeCycle.history+3);
  await page.evaluate(()=>{const old=delayed.shift();old.resolve(old.response);});await flush(page);assert.equal(await detail.getByText('Old A',{exact:true}).count(),0);assert.equal(await detail.locator('[data-installment]').count(),0);
  await page.evaluate(()=>{const old=delayed.shift();old.resolve(old.response);});await flush(page);assert.equal(await detail.locator('[data-installment]').count(),0);
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);assert.equal(await detail.getByText('New A',{exact:true}).count(),1);
  // Assisted-context entry and termination purge even for the same control.
  await page.evaluate(()=>{delayHistory=true;imp={id:'assist-test'};authChanged();});await flush(page);assert.equal(await detail.locator('[data-installment]').count(),0);
  await page.evaluate(()=>{delayHistory=false;resolveHistory();});await flush(page);assert.equal(await detail.locator('[data-installment]').count(),12);
  await page.evaluate(()=>{delayHistory=true;imp=null;authChanged();});await flush(page);assert.equal(await detail.locator('[data-installment]').count(),0);
  await page.evaluate(()=>{identity='B';control='0009';delayHistory=false;authChanged();resolveHistory();});await flush(page);
  assert.equal(await detail.locator('[data-installment]').count(),0);await detail.getByRole('button',{name:'Volver al historial',exact:true}).click();await flush(page);
  await base.getByRole('button',{name:'Todas',exact:true}).click();await flush(page);assert.equal(await base.getByText('Préstamo B',{exact:true}).count(),1);
  await page.evaluate(()=>{identity='';authChanged();});await flush(page);assert.equal(await base.locator('.su-history-entry').count(),0);assert.equal((await count(page)).active,0);
  await page.evaluate(()=>{identity='A';control='0007';authChanged();});await flush(page);
  // Pending/rejected SR entries have no loan statement or payroll assertions.
  const beforeRequest=await count(page);await page.evaluate(()=>setRoute({loanKey:'request:SR-REJECTED'}));await flush(page);
  assert.equal(await detail.getByRole('button',{name:'Estado de cuenta disponible únicamente para préstamos',exact:true}).isDisabled(),true);
  assert.equal(await detail.getByText('Descuento Vía Nómina',{exact:true}).count(),0);assert.equal(await detail.getByText('Pagos asegurados por nómina',{exact:true}).count(),0);
  assert.equal(await detail.getByText('Soporte de solicitudes',{exact:true}).count(),1);assert.deepEqual(await count(page),beforeRequest);
  assert.equal(await page.evaluate(()=>{try{LoanHistoryStatement.create({kind:'request'},{})}catch(error){return error.message;}return null;}),'HISTORY_STATEMENT_REQUIRES_LOAN');
  await detail.getByRole('button',{name:'Volver al historial',exact:true}).click();await flush(page);const beforeAway=await count(page);
  await page.evaluate(()=>setTab('other'));await flush(page);assert.equal((await count(page)).active,0);
  await page.evaluate(()=>{payload.entries[0].fund='Nueva publicación';publication='v3';payload.sync_version='v3';});
  await page.evaluate(()=>setTab('history'));await flush(page);const returned=await count(page);assert.equal(returned.active,1);assert.equal(returned.metadata,beforeAway.metadata+1);assert.equal(returned.history,beforeAway.history+1);assert.equal(await base.getByText('Nueva publicación',{exact:true}).count(),1);
  // Successful deletions replace the observation; the previous loan cannot return.
  await page.evaluate(()=>{payload.entries=[];publishVersion('v4');});await flush(page);assert.equal(await base.locator('.su-history-entry').count(),1);
  const numerical=await page.evaluate(()=>({missing:LoanHistory.metrics({total:null,paid_to_date:0}),negative:LoanHistory.metrics({total:100,paid_to_date:-1}),excess:LoanHistory.metrics({total:100,paid_to_date:110})}));
  assert.equal(numerical.missing.progress,null);assert.equal(numerical.negative.balance,null);assert.deepEqual(numerical.excess,{progress:110.00000000000001,balance:0,overpaid:10});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  checks.push({width,status:'PASS',numberingFixture:width===390?'ALL_ONE':width===320?'RESET':'MIXED_MISSING',consecutiveBadgeAndTitle:true,consecutiveDownloadedPdf:true,all210PdfRows:width===390,sourceRowsUnchanged:true,independentLoanSequence:true,equalAndMissingDates:true,historyHeading:true,filters:true,monetaryProgress:true,zeroRules:true,pdfDownload:true,tokenScroll:true,signalRefresh:true,noPolling:true,metadataResume:true,explicitErrors:true,authDenial:true,controlCycleABA:true,impersonation:true,sourceDeletion:true});await page.close();
 }}finally{await browser.close();}
 const result={status:'PASS',checks,sourceHashes:Object.fromEntries(['app/history-loans-repository.js','app/history-loans.jsx','app/history-statement.js','scripts/test-history-snapshot-browser.js'].map(file=>[file,crypto.createHash('sha256').update(read(file)).digest('hex')]))};fs.writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={setup,flush,count};
