'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
async function main(){
 const {projectHistory}=await import('../supabase/functions/loan-history/history.mjs');
 const {loadPublishedHistory}=await import('../supabase/functions/loan-history/snapshot.mjs');
 const now='2026-10-26T19:00:00.000Z';
 const native=(id,financial)=>({id,folio:'SR-2026-'+id,financial,status:'submitted',approved_at:null});
 const contexts=[native('missing-flag',false),native('financial',true),native('rejected',false),native('approved',false)];
 const context={actor:'actor-a',affiliate_id:'affiliate-a',folio:'0007',server_now:now,requests:contexts};
 const request=(id,status='Pendiente')=>({id:'SR-2026-'+id,owner:'0007',status,receipt:null,fund:'Solicitud de prueba',principal:500,total:600,term:6,date:'2026-10-25'});
 const source={folio:'0007',issues:[],requests:[request('missing-flag','  pendiente  '),request('financial'),request('sheet-only'),request('rejected','Rechazado'),request('approved','Aprobado'),{...request('legacy'),id:'1234'}],
  loans:[{source_row:2,id:'10',owner:'0007',date:'2026-10-15',amount:50,scheduled:50,number:1,fund:'Caja',term:2,principal:80,total:100,status:'AL CORRIENTE',paid_to_date:50,expected_to_date:50}]};
 const original=JSON.stringify({source,context}),projected=projectHistory(source,context,now),pending=projected.entries.filter(row=>row.category==='En proceso');
 assert(pending.some(row=>row.sourceId==='missing-flag'),'SR/Pendiente with no internal financial flag must appear');
 assert.deepEqual(pending.map(row=>row.id).sort(),['SR-2026-financial','SR-2026-missing-flag','SR-2026-sheet-only']);
 assert.equal(projected.entries.filter(row=>row.kind==='loan').length,1);assert.equal(projected.entries.find(row=>row.kind==='loan').category,'En pago');
 assert(!projected.entries.some(row=>['1234','SR-2026-approved','SR-2026-rejected'].includes(row.id)),'other legacy and nonfinancial status rules remain unchanged');
 assert.equal(pending.find(row=>row.id==='SR-2026-missing-flag').approved_at,null);
 assert.equal(pending.find(row=>row.id==='SR-2026-sheet-only').sourceId,null);
 assert.equal(JSON.stringify({source,context}),original,'inputs are immutable');
 for(const field of ['requests','loans']){const foreign=structuredClone(source);foreign[field][0].owner='7';assert.throws(()=>projectHistory(foreign,context,now),/SOURCE_IDENTITY_MISMATCH/);}
 const duplicate=structuredClone(source);duplicate.requests.push(duplicate.requests[0]);assert.throws(()=>projectHistory(duplicate,context,now),/REQUEST_IDENTITY_AMBIGUOUS/);
 const rejected=structuredClone(source);rejected.requests[1].status='Rechazado';assert.equal(projectHistory(rejected,context,now).entries.find(row=>row.sourceId==='financial').category,'No aprobadas');
 const numeric=structuredClone(source);numeric.requests[0].id='54321';assert(!projectHistory(numeric,context,now).entries.some(row=>row.sourceId==='missing-flag'));
 let calls=0;const reader={rpc:async(name,args)=>{calls++;assert.equal(name,'get_self_loan_history_snapshot');assert.equal(args,undefined);return {data:{context,source,source_updated_at:now,sync_version:'test-publication',sync_state:{status:'READY'}}};}};
 const payload=await loadPublishedHistory({action:'LOAD'},reader);assert.equal(calls,1);assert.deepEqual(payload.entries,projected.entries);
 await assert.rejects(loadPublishedHistory({action:'LOAD',folio:'7'},reader),/REQUEST_INVALID/);assert.equal(calls,1);
 const window={};vm.runInNewContext(read('app/history-loans-repository.js'),{window,Intl});
 const existing=contexts.map(r=>({id:r.folio,sourceId:r.id,kind:r.financial?'loan':'benefit',financial:r.financial,tipo:'Native',monto:500,estado:'revision',fecha:'25/10/2026',plazo:'6 pagos',steps:[],ts:1}));
 const merged=window.LoanHistory.merge(existing,payload,0),added=merged.filter(row=>row.sourceId==='missing-flag');
 assert.equal(added.length,1,'no duplicate native request card');assert.equal(added[0].estado,'revision');assert.equal(added[0].history.kind,'request');
 assert.equal(merged.find(row=>row.sourceId==='rejected').kind,'benefit','unrelated native history remains native');
 console.log('PASS projection, ownership, snapshot reads and native-card deduplication');
 const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{for(const width of [320,390,1440]){
  console.log('Checking browser width '+width);
  const page=await browser.newPage({viewport:{width,height:900}}),external=[],errors=[];page.setDefaultTimeout(10000);
  await page.route('**/*',r=>{external.push(r.request().url());return r.abort();});page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="root"></div>');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/history-loans-repository.js'])await page.addScriptTag({content:read(file)});
  await page.evaluate(({payload,existing})=>{
   const h=React.createElement,noop=()=>null;Object.assign(window,{money:v=>'$'+v,Icon:noop,IconTile:noop,TopBar:noop,FarmaHistory:noop,RequestAuthorizationNotice:noop,HistorySourceState:noop,ApprovalClock:noop,Badge:p=>h('span',null,p.label),HistoryPill:({entry})=>h('span',null,entry.category),EmptyState:p=>h('p',null,p.title),ChipBar:p=>h('nav',null,p.items.map(x=>h('button',{key:x,onClick:()=>p.onChange(x)},x)))});
   window.useOperationsStore=()=>({all:()=>existing,state:()=>({phase:'loaded'})});window.LoanHistory={...window.LoanHistory,useHistory:()=>({data:payload,elapsed:0,phase:'loaded'})};window.opened=[];window.testApp={push:(route,params)=>opened.push({route,params})};
  },{payload,existing});
  await page.addScriptTag({content:read('app/screens-historial.jsx')});
  await page.evaluate(()=>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(HistorialScreen,{app:testApp})));
  await page.getByRole('button',{name:'En proceso',exact:true}).click();
  const card=page.locator('.su-history-entry').filter({hasText:'SR-2026-missing-flag'});assert.equal(await card.count(),1);await card.click();
  const target=await page.evaluate(()=>opened.at(-1));assert.equal(target.route,'tracking');assert.equal(target.params.s.sourceId,'missing-flag');assert.equal(target.params.loanKey,undefined,'native tracking route preserved');
  await page.getByRole('button',{name:'En pago',exact:true}).click();assert.equal(await card.count(),0);assert.equal(await page.locator('.su-history-entry').count(),1);
  await page.getByRole('button',{name:'Todas',exact:true}).click();assert.equal(await card.count(),1);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);checks.push({width,status:'PASS',pendingVisible:true,nativeTrackingPreserved:true,otherFilterUnchanged:true,noExternalReads:true});await page.close();
 }}finally{await browser.close();}
 const result={status:'PASS',checks,sourceSha256:crypto.createHash('sha256').update(read('supabase/functions/loan-history/history.mjs').replace(/\r\n/g,'\n')).digest('hex'),pendingWithMissingFlag:true,sheetOnlyAndFinancialPending:true,exactOwnIdentity:true,duplicateDenial:true,sourceImmutable:true,oneSnapshotRead:true,zeroProductionWrites:true};
 const dir=process.env.SUTI_HISTORY_EVIDENCE_DIR||path.join(root,'.tmp/history-pending-tests');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'pending.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
