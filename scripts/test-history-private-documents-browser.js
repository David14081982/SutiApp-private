'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-document-private'),release=path.join(dir,'release');
const read=f=>fs.readFileSync(f,'utf8'),box={};vm.createContext(box);vm.runInContext(read('C:/tmp/babel-standalone-7.29.0.min.js'),box);
const chunk=read(path.join(release,'app/bundle.js')).match(/\/\* @@file screens-historial.jsx \*\/[\s\S]*?(?=\/\* @@file )/)[0];
async function main(){const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const checks=[];
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());await page.setContent('<main id="root"></main>');
  for(const f of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(path.join(release,'app/vendor',f))});
  await page.evaluate(()=>{const h=React.createElement;window.Icon=()=>null;window.Badge=({children})=>h('span',null,children);window.IconTile=()=>h('span',null,'icon');window.SectionHead=({title})=>h('h3',null,title);window.Timeline=({steps})=>h('ol',null,steps.map((s,i)=>h('li',{key:i},s.label)));window.Btn=({children,onClick})=>h('button',{onClick},children);window.money=n=>'$'+n;window.calls=[];window.GeneratedDocuments=()=>{calls.push('documents');return h('section',{'data-private-doc':''},'Documento de autorización');};window.fixture={phase:'loaded',row:{sourceId:'synthetic',id:'SR-SYNTHETIC',tipo:'Suti Préstamo',estado:'aprobado',requestStatus:'approved',monto:5000,plazo:'12 quincenal',fecha:'29/9/2026',workflowAvailable:true,steps:[{label:'Solicitud enviada'},{label:'Revisión de documentos'},{label:'Autorización'}]}};window.useOperationsStore=()=>({all:()=>fixture.row?[fixture.row]:[],state:()=>({phase:fixture.phase}),retry:()=>calls.push('retry')});window.app={back:()=>calls.push('back'),toast:()=>calls.push('support'),setTab:()=>calls.push('explore')};window.render=()=>ReactDOM.flushSync(()=>ReactDOM.createRoot(document.getElementById('root')).render(h(TrackingScreen,{app,params:{s:{sourceId:'synthetic'}}})));window.draw=()=>{document.getElementById('root').replaceChildren();render();};});
  for(const state of ['approved','rejected','unavailable','loading','error','missing']){
   await page.evaluate(state=>{fixture.row={sourceId:'synthetic',id:'SR-SYNTHETIC',tipo:'Suti Préstamo',estado:state==='rejected'?'rechazado':'aprobado',requestStatus:state==='rejected'?'rejected':'approved',monto:5000,plazo:'12 quincenal',fecha:'29/9/2026',workflowAvailable:state!=='unavailable',steps:[{label:'Solicitud enviada'},{label:'Revisión de documentos'},{label:'Autorización'}],motivo:state==='rejected'?'Motivo de ejemplo':null};fixture.phase=state==='loading'?'loading':state==='error'?'error':'loaded';if(['loading','error','missing'].includes(state))fixture.row=null;},state);
   await page.addScriptTag({content:read(path.join(dir,'before/app/screens-historial.jsx'))});await page.evaluate(()=>draw());const before=await page.locator('#root').evaluate(el=>{const copy=el.cloneNode(true);copy.querySelector('[data-private-doc]')?.remove();return copy.innerHTML;});
   await page.addScriptTag({content:chunk});await page.evaluate(()=>{calls=[];draw();});assert.equal(await page.locator('#root').innerHTML(),before);assert.deepEqual(await page.evaluate(()=>calls),[]);assert.equal(await page.getByText('Documento de autorización').count(),0);
   if(state==='approved'){await page.evaluate(()=>{window.open=(...args)=>calls.push(args);});await page.getByRole('button',{name:'Contactar a un asesor'}).click();assert.deepEqual(await page.evaluate(()=>calls),[['https://wa.me/526626727130','_blank','noopener,noreferrer']]);}
   if(state==='rejected'){await page.getByRole('button',{name:'Volver a explorar beneficios'}).click();assert.deepEqual(await page.evaluate(()=>calls),['back','explore']);}
   if(state==='error'){await page.getByRole('button',{name:'Reintentar'}).click();assert.deepEqual(await page.evaluate(()=>calls),['retry']);}
   checks.push({width,state,remainingDomIdentical:true,noDocumentMount:true});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 const proof={status:'PASS',checks,productionRequests:0};const out=process.env.SUTIAPP_HISTORY_BROWSER_EVIDENCE||path.join(root,'docs/qa/evidence/history-private-documents/browser.json');fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }finally{await browser.close();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
