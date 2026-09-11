'use strict';
// Three paired scenarios, then six functional checks. Actual compiled screens,
// App/Root, motion, presentation/catalog stores and product repository. HTTP
// fixtures terminate locally; financial/Auth/branding adapters are isolated.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),baseline=process.env.SUTIAPP_PROGRAM_BEFORE||'C:/tmp/sutiapp-program-opening-before-20260911';
const out=path.join(root,'docs/qa/evidence/program-opening-latency-20260911');
const report={status:'FAIL',environment:'ISOLATED_HTTP_CHROME_390x844',performance:[],functional:[],pageErrors:[],externalRequests:0};
const bundles={before:fs.readFileSync(path.join(baseline,'app/bundle.js'),'utf8'),after:fs.readFileSync(path.join(root,'app/bundle.js'),'utf8')};
const styles=[...fs.readFileSync(path.join(root,'SutiApp.html'),'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const image=fs.readFileSync(path.join(root,'assets/branding/home-header-collapsed.webp'));
const keys=['auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','cirugias','tours','market','rifas','donativos'];
function rows(){return keys.map((key,i)=>({item_key:key,group_key:i<8?'bienes':'bienestar',label_override:'Programa QA '+key,description_override:'Descripción de tarjeta '+key,enabled:true,sort_order:i,updated_at:'2026-09-11T00:00:00Z',program_cover_asset_id:'cover-'+key,program_info:{icon:'car',detail:'Detalle '+key,popular:false,breadcrumb:key,description:'Información general de '+key,phone:'6620000000',whatsapp:'526620000000',favorite_enabled:true,benefits_title:'Beneficios',benefits:[{icon:'checkCircle',t:'Ventaja QA',s:'Condiciones QA'}],catalog_title:'Productos disponibles'}}));}
const copy=x=>JSON.parse(JSON.stringify(x)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const runs=new Map();let seq=0,origin;
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost'),parts=u.pathname.split('/'),run=runs.get(parts[2]);
 if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<html><head><style>'+styles+'</style></head><body><div id="root"></div></body></html>');return;}
 if(!run){res.writeHead(404);res.end();return;}
 const endpoint=parts[3];if(endpoint==='image'){run.logs.push({name:'image'});await sleep(run.delay.image);res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'no-store'});res.end(image);return;}
 let raw='';for await(const data of req)raw+=data;const q=raw?JSON.parse(raw):{},filters=q.filters||{},table=q.table;
 const name=table==='finance_catalog_presentation'?(q.single?'presentation-single':'presentation-list'):table==='app_assets'?'cover':table||q.rpc;
 run.logs.push({name,query:q,actor:req.headers['x-qa-actor']});
 let data=null,error=run.fail.has(name)?{code:'ISOLATED_FAILURE',message:'QA authority failure'}:null;
 if(table==='finance_catalog_presentation'){
  const source=copy(run.rows);data=q.single?source.find(r=>r.item_key===filters.item_key):source;
  if(q.single&&data)data.cover={id:data.program_cover_asset_id,status:'READY',storage_bucket:'fixture',storage_path:data.program_cover_asset_id,mime_type:'image/webp'};
  if(!data)error={message:'ROW_NOT_FOUND'};
 }else if(table==='app_assets')data={id:filters.id,status:'READY',storage_bucket:'fixture',storage_path:filters.id,mime_type:'image/webp'};
 else if(table==='program_catalog_items')data=[{id:'product-'+filters.program_key,program_key:filters.program_key,name:'Producto QA '+filters.program_key,description:'Ficha del artículo',price_cash:1000,enabled:true,sort_order:0,commercial_mode:'DIRECT_CONTACT',requires_quote:false}];
 else if(table==='program_catalog_item_assets'||table==='program_catalog_favorites')data=[];
 else if(q.rpc==='save_program_general_info'){
  const row=run.rows.find(r=>r.item_key===q.args.p_program_key);if(!error){Object.assign(row,copy(q.args.p_payload),{updated_at:new Date().toISOString()});data=row.item_key;}
 }
 await sleep(run.delay[name]||0);res.writeHead(error?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({data,error}));
}catch(e){res.writeHead(500);res.end(JSON.stringify({error:{message:e.message}}));}});
function chunk(bundle,name){const start=bundle.indexOf('/* @@file '+name+' */'),end=bundle.indexOf('/* @@file ',start+10);assert(start>=0,name);return bundle.slice(start,end<0?undefined:end);}
function counts(logs){return logs.reduce((r,x)=>(r[x.name]=(r[x.name]||0)+1,r),{});}
async function setup(browser,variant){
 const id=String(++seq),run={rows:rows(),logs:[],fail:new Set(),delay:{'presentation-list':100,'presentation-single':350,cover:100,program_catalog_items:220,program_catalog_item_assets:40,program_catalog_favorites:70,image:250}};runs.set(id,run);
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){report.externalRequests++;return route.abort();}return route.continue();});
 page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(origin);
 for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
 await page.evaluate(({origin,id})=>{
  const listeners=new Set();window.__auth={phase:'authenticated',session:{user:{id:'A'},access_token:'ISOLATED_A'},affiliate:{id:'A'},affiliateView:{id:'A',name:'QA',numeroControl:'QA'}};
  window.__switchActor=actor=>{window.__auth=actor?{phase:'authenticated',session:{user:{id:actor},access_token:'ISOLATED_'+actor},affiliate:{id:actor},affiliateView:{id:actor,name:'QA',numeroControl:'QA'}}:{phase:'anonymous',session:null,affiliate:null,affiliateView:null};listeners.forEach(fn=>fn());};
  window.AffiliateAuth={getState:()=>__auth,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};window.useAffiliateAuth=()=>React.useSyncExternalStore(AffiliateAuth.subscribe,AffiliateAuth.getState);
  window.__request=async(query)=>{const response=await fetch(origin+'/run/'+id+'/api',{method:'POST',headers:{'Content-Type':'application/json','X-QA-Actor':__auth.session?.user.id||'none'},body:JSON.stringify(query)});return response.json();};
  const query=table=>{const q={table,filters:{}};const b={select:fields=>(q.fields=fields,b),eq:(key,value)=>(q.filters[key]=value,b),in:(key,value)=>(q.filters[key]=value,b),order:()=>b,single:()=>(q.single=true,__request(q)),then:(resolve,reject)=>__request(q).then(resolve,reject)};return b;};
  window.SutiSupabase={getClient:()=>({from:query,rpc:(rpc,args)=>__request({rpc,args}),storage:{from:()=>({getPublicUrl:key=>({data:{publicUrl:origin+'/run/'+id+'/image/'+key}})})}})};
  window.AdminCutoverRepository={listFinancePresentation:async()=>{const r=await __request({table:'finance_catalog_presentation'});if(r.error)throw r.error;return r.data;}};
  const admin={phase:'unauthorized'};window.AdminRepository={getState:()=>admin,subscribe:()=>()=>{},has:()=>false,refreshAccessContext:async()=>admin};window.useAdminAuth=()=>admin;
  window.useTweaks=defaults=>{const [t,set]=React.useState(defaults);return[t,(k,v)=>set(old=>({...old,[k]:v}))];};window.useTextSizePreference=()=>({value:'normal',error:null});
  const content={phase:'loaded',marketplaceBanners:[],popups:[],retry:()=>{}};window.useInstitutionalContent=window.useVisualContent=window.useEditorialContent=()=>content;
  window.useAsset=()=>({});window.useRequestNotifications=()=>({rows:[]});window.useFinancialLegacy=()=>({status:'error',overview:null});
  window.AffiliateLoginScreen=()=>React.createElement('div',{'data-qa-login':''},'Sesión cerrada');window.HomeScreen=()=>React.createElement('div',null,'Inicio QA');
  for(const name of ['TweaksPanel','TweakSection','TweakToggle','TweakRadio','TweakButton'])window[name]=()=>null;
 },{origin,id});
 const bundle=bundles[variant];for(const name of ['icons.jsx','brand.jsx','motion.jsx','ui.jsx','private-resource-demand.js','program-catalog-repository.js','catalog-store.jsx','fincat-store.jsx','program-general-info.jsx','screens-financiera.jsx','screens-marketplace.jsx','screens-catalogo.jsx'])await page.addScriptTag({content:chunk(bundle,name)});
 await page.evaluate(()=>{window.Res=props=>React.createElement(Icon,{...props,name:'tag'});window.ResTile=props=>React.createElement(Icon,{name:'car',size:props.size});window.ResSlot=()=>null;});
 await page.addScriptTag({content:chunk(bundle,'app.jsx')});await page.getByRole('button',{name:'Finanzas',exact:true}).click();await page.waitForSelector('[data-finance-catalog-phase=loaded]');
 await page.evaluate(()=>{
  window.__metric={};document.addEventListener('click',event=>{const card=event.target.closest('[data-finance-item]');if(!card)return;const start=performance.now(),m={key:card.dataset.financeItem};window.__metric=m;
   function frame(){const cover=document.querySelector('[data-program-cover]'),desc=document.querySelector('[data-program-description]'),back=cover?.querySelector('button'),img=cover?.querySelector('img');
    if(desc&&back&&!m.infoMs){const r=back.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(target&&back.contains(target))m.infoMs=performance.now()-start;}
    if(img?.complete&&img.naturalWidth>0&&!m.imageMs)m.imageMs=performance.now()-start;
    if(document.body.textContent.includes('Producto QA '+m.key)&&!m.productsMs)m.productsMs=performance.now()-start;
    if(!m.infoMs||!m.imageMs||!m.productsMs)requestAnimationFrame(frame);
   }requestAnimationFrame(frame);
  },true);
 });return {context,page,run,variant};
}
async function open(page,key){const button=page.locator('[data-finance-item='+key+']');await button.scrollIntoViewIfNeeded();await button.click();await page.waitForSelector('[data-program-description]');}
async function back(page){await page.locator('[data-program-cover]').locator('button').first().click();await page.waitForSelector('[data-program-description]',{state:'detached'});}
async function measure(ctx,scenario,key){
 const {page,run,variant}=ctx;if(scenario==='repeat'){await open(page,key);await page.waitForFunction(()=>__metric.productsMs&&__metric.imageMs);await back(page);}
 if(scenario==='slow')Object.assign(run.delay,{'presentation-list':900,'presentation-single':900,cover:550,program_catalog_items:1100,program_catalog_favorites:300,image:800});
 const n=run.logs.length;await open(page,key);await page.waitForFunction(()=>__metric.infoMs&&__metric.imageMs&&__metric.productsMs);const metric=await page.evaluate(()=>__metric);const result={key,infoMs:+metric.infoMs.toFixed(1),imageMs:+metric.imageMs.toFixed(1),productsMs:+metric.productsMs.toFixed(1),requests:counts(run.logs.slice(n))};
 if(variant==='after'){assert(result.infoMs<200,scenario+': '+result.infoMs);assert.equal(result.requests['presentation-single']||0,0);assert.equal(result.requests['presentation-list']||0,0);assert.equal(await page.locator('[data-program-info-state]').count(),0);}
 await page.screenshot({path:path.join(out,scenario+'-'+variant+'.png')});return result;
}
async function functional(ctx,resume=false){
 const {page,run}=ctx;let key='puertas';
 if(!resume){
 // 1: actual App retained scroll node.
 const y=await page.evaluate(()=>{window.__scroll=document.querySelector('[data-app-tab-scroll=financiera]');return __scroll.scrollTop;});assert(y>0);await back(page);assert.equal(await page.evaluate(()=>document.querySelector('[data-app-tab-scroll=financiera]')===__scroll&&__scroll.scrollTop),y);report.functional.push({name:'back_preserves_scroll',status:'PASS',before:y,after:y});
 // 2: preserve the existing component-local header favorite, both controls.
 await open(page,key);const heart=page.getByRole('button',{name:'Guardar programa',exact:true}),save=page.getByRole('button',{name:'Guardar',exact:true});await heart.click();assert.equal(await save.getAttribute('aria-pressed'),'true');await save.click();assert.equal(await heart.getAttribute('aria-pressed'),'false');report.functional.push({name:'favorites_preserved',status:'PASS',headerHeart:true,headerSave:true,persistence:'unchanged component-local behavior'});
 // 3: repeated focus/visibility while the single authoritative read is pending.
 run.delay['presentation-list']=350;const focusStart=run.logs.length;await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await page.waitForSelector('[data-finance-catalog-phase=refreshing]');await page.waitForSelector('[data-finance-catalog-phase=loaded]');await page.waitForFunction(()=>document.querySelector('[data-program-cover] img')?.complete);const focus=counts(run.logs.slice(focusStart));assert.equal(focus['presentation-list'],1);assert.equal(focus['presentation-single']||0,0);assert((focus.cover||0)<=1);report.functional.push({name:'focus_no_duplicate_pending_reads',status:'PASS',requests:focus});
 // 4: real Admin Editor/save/readback with an older refresh already in flight.
 await page.evaluate(key=>{const host=document.createElement('div');host.id='qa-editor';Object.assign(host.style,{position:'fixed',inset:0,zIndex:1000,overflow:'auto',background:'#fff'});document.body.appendChild(host);window.__editor=ReactDOM.createRoot(host);__editor.render(React.createElement(ProgramGeneralInfo.Editor,{programKey:key}));},key);
 const editor=page.locator('#qa-editor');await editor.locator('[data-program-info-field=name]').waitFor();await editor.locator('[data-program-info-field=name]').fill('Programa actualizado QA');
 run.delay['presentation-list']=550;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForSelector('[data-finance-catalog-phase=refreshing]');assert.equal(await editor.locator('[data-program-info-field=name]').inputValue(),'Programa actualizado QA');
 await editor.locator('[data-program-info-save]').click();await editor.getByText('Información guardada.',{exact:true}).waitFor();await page.evaluate(()=>{__editor.unmount();document.querySelector('#qa-editor').remove();});await page.waitForFunction(()=>document.querySelector('[data-program-description]')?.parentElement.textContent.includes('Programa actualizado QA'));assert((await page.locator('[data-finance-item=puertas]').innerText()).includes('Programa actualizado QA'));
 run.rows=run.rows.filter(r=>r.item_key!==key);await page.evaluate(()=>finCatStore.refresh(true));await page.waitForSelector('[data-program-info-state=error]');assert.equal(await page.locator('[data-program-description]').count(),0);report.functional.push({name:'admin_update_reflected',status:'PASS',realEditor:true,draftPreservedOnFocus:true,bothReadersUpdated:true,removedRowNotResurrected:true});
 }
 // 5: authoritative text error, opaque retry, independent cover and catalog errors.
 run.delay['presentation-list']=550;run.rows=rows();run.fail.add('presentation-list');await page.locator('[data-program-info-state=error]').getByRole('button',{name:'Reintentar',exact:true}).click();await page.waitForSelector('[data-finance-catalog-phase=error]');await page.waitForSelector('[data-program-info-state=error]');assert.notEqual(await page.locator('[data-program-info-state]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 run.fail.delete('presentation-list');run.fail.add('cover');await page.locator('[data-program-info-state=error]').getByRole('button',{name:'Reintentar',exact:true}).click();await page.waitForSelector('[data-program-info-state=loading]');await page.waitForSelector('[data-program-description]');await page.getByRole('button',{name:'Reintentar portada',exact:true}).waitFor();const coverStart=run.logs.length;run.fail.delete('cover');await page.getByRole('button',{name:'Reintentar portada',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-program-cover] img')?.complete&&document.querySelector('[data-program-cover] img')?.naturalWidth>0);assert.equal(counts(run.logs.slice(coverStart))['presentation-list']||0,0);
 run.fail.add('program_catalog_items');await page.evaluate(()=>catalogStore.retry());await page.getByText('No pudimos cargar el catálogo',{exact:true}).waitFor();assert.equal(await page.locator('[data-program-description]').count(),1);run.fail.delete('program_catalog_items');await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.getByText('Producto QA puertas',{exact:true}).waitFor();report.functional.push({name:'errors_visible_and_retry',status:'PASS',opaqueTextState:true,textRetry:true,coverRetryIndependent:true,catalogErrorDoesNotBlockHeader:true});
 // 6: logout + new actor while old header/cover reads remain in flight.
 run.delay['presentation-list']=700;run.delay.cover=800;await page.evaluate(()=>{finCatStore.refresh(true);});await page.waitForSelector('[data-finance-catalog-phase=refreshing]');await page.evaluate(()=>__switchActor(null));await page.locator('[data-qa-login]').waitFor();assert.equal(await page.locator('[data-program-description],[data-finance-item]').count(),0);
 run.rows=rows().map(r=>({...r,label_override:'Sesión B '+r.item_key,program_info:{...r.program_info,description:'Contenido sesión B '+r.item_key}}));run.delay['presentation-list']=160;run.delay.cover=100;
 await page.evaluate(()=>__switchActor('B'));await page.getByRole('button',{name:'Finanzas',exact:true}).click();await page.waitForSelector('[data-finance-catalog-phase=loading]');assert.equal(await page.locator('[data-finance-item]').count(),0);await page.waitForSelector('[data-finance-catalog-phase=loaded]');await open(page,'auto');await sleep(850);assert.equal(await page.locator('[data-program-description]').innerText(),'Contenido sesión B auto');assert((await page.locator('[data-finance-item=auto]').innerText()).includes('Sesión B auto'));report.functional.push({name:'session_clears_previous_data',status:'PASS',logoutClears:true,newActorRows:true,oldResponsesIgnored:true});
 await page.screenshot({path:path.join(out,'functional-final.png')});
}
(async()=>{fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let retained;
 try{const resume=process.argv.includes('--resume-pending');if(resume){const previous=JSON.parse(fs.readFileSync(path.join(out,'browser-initial.json'),'utf8'));assert.equal(previous.performance.length,3);assert.equal(previous.functional.length,4);report.performance=previous.performance;report.functional=previous.functional;retained=await setup(browser,'after');await open(retained.page,'puertas');retained.run.rows=retained.run.rows.filter(r=>r.item_key!=='puertas');await retained.page.evaluate(()=>finCatStore.refresh(true));await retained.page.waitForSelector('[data-program-info-state=error]');}else for(const [scenario,key]of [['normal','auto'],['slow','aires'],['repeat','puertas']]){const pair={scenario};for(const variant of ['before','after']){const ctx=await setup(browser,variant);pair[variant]=await measure(ctx,scenario,key);if(scenario==='repeat'&&variant==='after')retained=ctx;else await ctx.context.close();}pair.status='PASS';report.performance.push(pair);console.log(JSON.stringify(pair));}
 await functional(retained,resume);assert.equal(report.performance.length,3);assert.equal(report.functional.length,6);assert.equal(report.externalRequests,0);assert.deepEqual(report.pageErrors,[]);report.status='PASS';
 }catch(e){report.error=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
