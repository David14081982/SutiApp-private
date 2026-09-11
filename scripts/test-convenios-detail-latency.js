'use strict';
// Three paired performance cases, then exactly six functional checks.
// Actual compiled Convenios/UI/App/Root/motion/catalog/context code; isolated
// HTTP authority and unrelated-domain hooks. No production network or writes.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..');
const beforeRoot=process.env.SUTIAPP_CONVENIOS_BEFORE||'C:/tmp/sutiapp-convenios-latency-20260910-before';
const out=path.join(root,'docs/qa/evidence/convenios-detail-latency-20260910');
const report={status:'FAIL',environment:'ISOLATED_HTTP_BROWSER',productionRequests:0,performance:[],functional:[],errors:[]};
const bundles={before:fs.readFileSync(path.join(beforeRoot,'app/bundle.js'),'utf8'),after:fs.readFileSync(path.join(root,'app/bundle.js'),'utf8')};
const html=fs.readFileSync(path.join(root,'SutiApp.html'),'utf8');
const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const image=fs.readFileSync(path.join(root,'assets/branding/home-header-collapsed.webp'));
const runs=new Map();let sequence=0;
function chunk(bundle,name){const start=bundle.indexOf('/* @@file '+name+' */');assert(start>=0,name);const end=bundle.indexOf('/* @@file ',start+10);return bundle.slice(start,end<0?undefined:end);}
function fixtureRows(){return Array.from({length:6},(_,i)=>({id:'company-'+i,source_kind:i===1?'education':'company',display_name:i===1?'Institución QA':'Convenio QA '+i,description:'Descripción verificada de la ficha '+i,category_raw:i===1?'Educación':'Salud y belleza',cover_asset_id:'cover-'+i,gallery_asset_ids:[],featured:false,benefits:[{id:'benefit-'+i,label:'Beneficio QA',description:'Condiciones del beneficio'}],phone_raw:'6620000000',whatsapp_raw:'526620000000',public_details:{history:'Historia de la institución',hours:'Horario de atención'},promotions:[]}));}
const copy=value=>JSON.parse(JSON.stringify(value));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost'),parts=u.pathname.split('/'),run=runs.get(parts[2]);
  if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><head><style>'+styles+'</style></head><body><div id="root"></div></body></html>');return;}
  if(!run){res.writeHead(404);res.end();return;}
  const name=parts[3];
  if(name==='image'){run.logs.push({name:'image',at:Date.now()});await delay(run.delays.image);res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'no-store'});res.end(image);return;}
  let raw='';for await(const bytes of req)raw+=bytes;
  const body=raw?JSON.parse(raw):{},actor=req.headers['x-qa-actor'];
  run.logs.push({name,method:req.method,actor,body,at:Date.now()});
  let data=null;const error=run.fail.has(name)?{message:'ISOLATED_FAILURE',code:'QA_FAILURE'}:null;
  if(name==='list_public_convenios')data=copy(run.rows);
  else if(name==='app_assets')data=run.rows.map((row,i)=>({id:row.cover_asset_id,storage_bucket:'public-fixture',storage_path:String(i)}));
  else if(name==='educational_resource_favorites'){
   const favorites=run.favorites[actor]||(run.favorites[actor]=[]);
   if(req.method==='POST'&&!error&&!favorites.includes(body.resource_id))favorites.push(body.resource_id);
   if(req.method==='DELETE'&&!error)run.favorites[actor]=favorites.filter(id=>id!==body.resource_id);
   data=(run.favorites[actor]||[]).map(resource_id=>({resource_id}));
  }else if(name==='company_favorites'){
   if(req.method==='POST'&&!error)run.companyFavorites=body.on?[...new Set([...run.companyFavorites,body.id])]:run.companyFavorites.filter(id=>id!==body.id);
   data=run.companyFavorites;
  }else if(name==='save_company_ficha'){
   if(!error){const row=run.rows.find(row=>row.id===body.p_company_id);Object.assign(row,body.p_fields);data=row.id;}
  }
  await delay(run.delays[name]||0);res.writeHead(error?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({data,error}));
 }catch(error){res.writeHead(500);res.end(JSON.stringify({error:{message:error.message}}));}
});
let origin;
async function setup(browser,variant){
 const id=String(++sequence),run={rows:fixtureRows(),favorites:{A:[],B:[]},companyFavorites:[],logs:[],fail:new Set(),delays:{list_public_convenios:60,app_assets:40,educational_resource_favorites:80,image:100}};runs.set(id,run);
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(12000);
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){report.productionRequests++;return route.abort();}return route.continue();});
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(origin);
 for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
 await page.evaluate(({id,origin})=>{
  const authListeners=new Set(),fixtureView={id:'A',name:'Afiliado QA',numeroControl:'QA'};
  window.__qaAuth={phase:'authenticated',session:{user:{id:'A'},access_token:'ISOLATED_A'},affiliate:{id:'A'},affiliateView:fixtureView};
  window.__switchActor=actor=>{window.__qaAuth=actor?{phase:'authenticated',session:{user:{id:actor},access_token:'ISOLATED_'+actor},affiliate:{id:actor},affiliateView:{...fixtureView,id:actor}}:{phase:'anonymous',session:null,affiliate:null,affiliateView:null};authListeners.forEach(fn=>fn());};
  window.AffiliateAuth={getState:()=>__qaAuth,subscribe:fn=>{authListeners.add(fn);return()=>authListeners.delete(fn);}};
  window.useAffiliateAuth=()=>React.useSyncExternalStore(AffiliateAuth.subscribe,AffiliateAuth.getState);
  window.__api=async(name,method='GET',body)=>{const response=await fetch(origin+'/run/'+id+'/'+name,{method,headers:{'Content-Type':'application/json','X-QA-Actor':__qaAuth.session?.user.id||'none'},body:body?JSON.stringify(body):undefined});return response.json();};
  window.SutiSupabase={getClient:()=>({rpc:(name,args)=>__api(name,'POST',args||{}),auth:{getUser:async()=>({data:{user:__qaAuth.session?.user},error:null})},from:table=>({select:()=>table==='app_assets'?{in:()=>__api(table)}:__api(table),insert:body=>__api(table,'POST',body),delete:()=>({eq:(_,value)=>__api(table,'DELETE',{resource_id:value})})})})};
  window.AssetRepository={publicUrl:asset=>origin+'/run/'+id+'/image/'+asset.storage_path};
  const admin={phase:'unauthorized'};window.AdminRepository={getState:()=>admin,subscribe:()=>()=>{},has:()=>false,refreshAccessContext:async()=>admin};
  window.useTextSizePreference=()=>({value:'normal',error:null}); // Unrelated published-shell dependency, isolated here.
  window.useAdminAuth=()=>admin;window.useTweaks=defaults=>{const[t,setT]=React.useState(defaults);return[t,(k,v)=>setT(old=>({...old,[k]:v}))];};
  const content={phase:'loaded',marketplaceBanners:[],popups:[],retry:()=>{}};
  window.useInstitutionalContent=window.useVisualContent=window.useEditorialContent=()=>content;
  window.useAsset=()=>({});window.useRequestNotifications=()=>({rows:[]});
  window.MarketplaceRepository={listCategories:async()=>[],listProducts:async()=>[],listFavorites:async()=>[],listCompanyFavorites:async()=>{const r=await __api('company_favorites');if(r.error)throw r.error;return r.data;},setCompanyFavorite:async(id,on)=>{const r=await __api('company_favorites','POST',{id,on});if(r.error)throw r.error;}};
  window.AffiliateLoginScreen=()=>React.createElement('div',{'data-qa-login':''},'Sesión cerrada');
  for(const name of ['TweaksPanel','TweakSection','TweakRow','TweakSlider','TweakToggle','TweakRadio','TweakSelect','TweakText','TweakNumber','TweakColor','TweakButton'])window[name]=()=>null;
  window.HomeScreen=()=>React.createElement('div',null,'Inicio QA');
  window.openSafeContentUrl=()=>{};
 },{id,origin});
 const bundle=bundles[variant];
 for(const name of ['icons.jsx','brand.jsx','motion.jsx','ui.jsx','private-resource-demand.js','convenios-repository.js','catalog-store.jsx','screens-convenios.jsx','image-viewer.jsx'])await page.addScriptTag({content:chunk(bundle,name)});
 await page.evaluate(()=>{window.Res=props=>React.createElement(Icon,{...props,name:props.resKey?.includes('fav')?'heart':props.resKey?.includes('pin')?'pin':'tag'});});
 // Unmodified production Root/App: actual stack, retained outgoing route,
 // scroll container, context-key reset, header and bottom navigation.
 await page.addScriptTag({content:chunk(bundle,'app.jsx')});
 await page.getByRole('button',{name:'Convenios',exact:true}).click();
 await page.waitForSelector('[data-convenios-state=loaded]');
 await page.waitForFunction(()=>!document.querySelector('[data-convenios-favorites-state]'));
 await page.evaluate(()=>{
  window.__timings={};
  document.addEventListener('click',event=>{
   const card=event.target.closest('[data-company-id]');if(!card||event.target.closest('button'))return;
   const begin=performance.now(),timing={begin,id:card.dataset.companyId};window.__timings=timing;
   function frame(){
    const detail=document.querySelector('[data-convenio-detail]'),back=detail?.querySelector('button[aria-label=Volver]'),image=detail?.querySelector('[data-convenio-cover-zoom] img');
    if(detail&&detail.querySelector('h1')&&back){
     const box=back.getBoundingClientRect(),hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);
     if(!timing.contentMs&&hit&&back.contains(hit))timing.contentMs=performance.now()-begin;
     if(!timing.imageMs&&image?.complete&&image.naturalWidth>0)timing.imageMs=performance.now()-begin;
    }
    if(!timing.contentMs||!timing.imageMs)requestAnimationFrame(frame);
   }
   requestAnimationFrame(frame);
  },true);
 });
 return {context,page,run,variant};
}
async function cardClick(page,index=0){const card=page.locator('[data-convenios-section=all] [data-company-id]').nth(index);await card.scrollIntoViewIfNeeded();await card.locator('div').last().click();}
async function back(page){await page.locator('[data-convenio-detail]').getByRole('button',{name:'Volver',exact:true}).click();await page.waitForSelector('[data-convenio-detail]',{state:'detached'});}
function counts(logs){return logs.reduce((result,log)=>{result[log.name]=(result[log.name]||0)+1;return result;},{});}
async function measure(ctx,scenario){
 const {page,run,variant}=ctx;
 if(scenario==='repeat'){await cardClick(page);await page.waitForSelector('[data-convenio-detail]');await back(page);}
 if(scenario==='slow')Object.assign(run.delays,{list_public_convenios:600,app_assets:300,educational_resource_favorites:1200,image:900});
 const start=run.logs.length;await cardClick(page,scenario==='repeat'?1:0);
 await page.waitForFunction(()=>__timings.contentMs&&__timings.imageMs);
 const timing=await page.evaluate(()=>__timings),requests=counts(run.logs.slice(start));
 await page.screenshot({path:path.join(out,scenario+'-'+variant+'.png')});
 if(variant==='after'){assert(timing.contentMs<200,scenario+': CONTENT_OVER_200_MS '+timing.contentMs);assert.equal(requests.list_public_convenios||0,0);assert.equal(requests.educational_resource_favorites||0,0);assert.equal(requests.app_assets||0,0);}
 return {contentMs:Math.round(timing.contentMs*10)/10,imageMs:Math.round(timing.imageMs*10)/10,requests};
}
async function functional(ctx){
 const {page,run}=ctx;
 // 1. Back retains the exact production scroll element and position.
 const scrollBefore=await page.evaluate(()=>{window.__scrollNode=document.querySelector('[data-app-tab-scroll=convenios]');return __scrollNode.scrollTop;});assert(scrollBefore>0);
 await back(page);const scrollAfter=await page.evaluate(()=>({same:__scrollNode===document.querySelector('[data-app-tab-scroll=convenios]'),top:__scrollNode.scrollTop}));assert(scrollAfter.same);assert.equal(scrollAfter.top,scrollBefore);
 report.functional.push({name:'back_preserves_scroll',status:'PASS',before:scrollBefore,after:scrollAfter.top});
 // 2. Education and company favorite buttons, persistence after refresh, and
 // failed writer rollback. All mutation routes terminate at the local fixture.
 await cardClick(page,1);await page.waitForSelector('[data-convenio-detail]');
 let favorite=page.locator('[data-convenio-detail] [aria-label=Favorito]');const start=run.logs.length;
 await favorite.click();await page.waitForFunction(()=>document.querySelector('[data-convenio-detail] [aria-label=Favorito]')?.getAttribute('aria-pressed')==='true');assert.deepEqual(run.favorites.A,['company-1']);
 assert.equal(counts(run.logs.slice(start)).list_public_convenios||0,0);
 await back(page);assert.equal(await page.locator('[data-company-id=company-1] [aria-label=Favorito]').getAttribute('aria-pressed'),'true');
 await cardClick(page);await page.waitForSelector('[data-convenio-detail]');favorite=page.locator('[data-convenio-detail] [aria-label=Favorito]');await favorite.click();await page.waitForFunction(()=>document.querySelector('[data-convenio-detail] [aria-label=Favorito]')?.getAttribute('aria-pressed')==='true');assert.deepEqual(run.companyFavorites,['company-0']);
 run.fail.add('company_favorites');await favorite.click();await page.getByText('No se pudo actualizar el favorito',{exact:true}).waitFor();assert.equal(await favorite.getAttribute('aria-pressed'),'true');run.fail.delete('company_favorites');
 report.functional.push({name:'favorites',status:'PASS',education:true,company:true,failedWriteRollback:true,directoryReloadsOnEducationFavorite:0});
 // 3. A focus event with both mounted readers issues one read per dependency.
 const focusStart=run.logs.length;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>!document.querySelector('[data-convenios-favorites-state]'));await delay(160);
 const focus=counts(run.logs.slice(focusStart));assert.equal(focus.list_public_convenios,1);assert.equal(focus.educational_resource_favorites,1);assert.equal(focus.app_assets,1);assert.equal(await page.locator('[data-convenio-detail]').count(),1);
 report.functional.push({name:'focus_no_duplicate_queries',status:'PASS',requests:focus});
 // 4. The existing save writer invalidates both mounted consumers, including
 // an older refresh in flight. Removing a row cannot revive params.company.
 run.delays.list_public_convenios=500;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('[data-convenios-favorites-state]'));
 await page.evaluate(()=>ConveniosRepository.saveCompany('company-0',{display_name:'Convenio actualizado QA'}));
 await page.locator('[data-convenio-detail] h1').filter({hasText:'Convenio actualizado QA'}).waitFor();await delay(600);
 assert.equal(await page.locator('[data-convenio-detail] h1').innerText(),'Convenio actualizado QA');assert((await page.locator('[data-company-id=company-0]').innerText()).includes('Convenio actualizado QA'));
 run.rows=run.rows.filter(row=>row.id!=='company-0');await page.evaluate(()=>ConveniosRepository.invalidate());await page.getByText('Este convenio ya no está disponible',{exact:true}).waitFor();assert.equal(await page.locator('[data-company-id=company-0]').count(),0);
 report.functional.push({name:'updates_reflected',status:'PASS',bothReaders:true,oldResponseIgnored:true,removedRowNotResurrected:true});
 // 5. Opaque detail loading/error, useful Back, content retry, favorites
 // failure/retry independent of the content and no hidden stale fallback.
 await page.locator('[data-convenio-state=empty]').getByRole('button',{name:'Volver',exact:true}).click();await page.waitForSelector('[data-convenio-state]',{state:'detached'});run.delays.list_public_convenios=60;
 await cardClick(page,0);await page.waitForSelector('[data-convenio-detail]');
 run.fail.add('list_public_convenios');await page.evaluate(()=>ConveniosRepository.invalidate());await page.locator('[data-convenio-state=error]').getByRole('button',{name:'Reintentar',exact:true}).waitFor();
 const opaque=await page.locator('[data-convenio-state=error]').evaluate(node=>getComputedStyle(node).backgroundColor);assert.notEqual(opaque,'rgba(0, 0, 0, 0)');assert.equal(await page.locator('[data-convenio-detail]').count(),0);
 run.fail.delete('list_public_convenios');run.delays.list_public_convenios=250;await page.locator('[data-convenio-state=error]').getByRole('button',{name:'Reintentar',exact:true}).click();await page.locator('[data-convenio-state=loading]').waitFor();assert.equal(await page.locator('[data-convenio-state=loading] .su-skeleton').count(),3);assert.equal(await page.locator('[data-convenio-state=loading]').getByRole('button',{name:'Volver',exact:true}).count(),1);await page.waitForSelector('[data-convenio-detail]');
 run.fail.add('educational_resource_favorites');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('[data-convenio-detail] [data-convenios-favorites-state=error]').waitFor();assert.equal(await page.locator('[data-convenio-detail] h1').count(),1);
 const retryStart=run.logs.length;run.fail.delete('educational_resource_favorites');await page.locator('[data-convenio-detail]').getByRole('button',{name:'Reintentar favoritos',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-convenios-favorites-state]'));assert.equal(counts(run.logs.slice(retryStart)).list_public_convenios||0,0);
 report.functional.push({name:'errors_and_retry',status:'PASS',opaqueBackground:opaque,contentRetry:true,favoritesRetryIndependent:true});
 // 6. Auth A -> logged out -> B, with old A reads still in flight. Actual
 // Root unmounts the stack; actual PrivateResourceDemand changes its epoch.
 run.delays.list_public_convenios=650;run.delays.educational_resource_favorites=600;
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('[data-convenios-favorites-state]'));
 await page.evaluate(()=>__switchActor(null));await page.locator('[data-qa-login]').waitFor();assert.equal(await page.locator('[data-convenio-detail],[data-company-id]').count(),0);
 run.rows=fixtureRows().map(row=>({...row,display_name:'Sesión B '+row.id}));run.delays.list_public_convenios=120;run.delays.educational_resource_favorites=100;
 await page.evaluate(()=>__switchActor('B'));await page.getByRole('button',{name:'Convenios',exact:true}).click();await page.waitForSelector('[data-convenios-state=loading]');assert.equal(await page.locator('[data-company-id]').count(),0);
 await page.waitForSelector('[data-convenios-state=loaded]');await delay(750);
 const texts=await page.locator('[data-convenios-section=all] [data-company-id]').allTextContents();assert(texts.every(text=>text.includes('Sesión B')));assert.equal(await page.locator('[data-company-id=company-1] [aria-label=Favorito]').getAttribute('aria-pressed'),'false');
 // Last subscriber unmount discards the settled projection, even in session B.
 await page.getByRole('button',{name:'Inicio',exact:true}).click();const remountStart=run.logs.length;await page.getByRole('button',{name:'Convenios',exact:true}).click();await page.waitForSelector('[data-convenios-state=loading]');await page.waitForSelector('[data-convenios-state=loaded]');assert.equal(counts(run.logs.slice(remountStart)).list_public_convenios,1);
 report.functional.push({name:'session_clears_previous_data',status:'PASS',logoutClears:true,oldRequestsIgnored:true,newFavoritesIsolated:true,lastUnmountClears:true});
 await page.screenshot({path:path.join(out,'functional-final.png')});
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 const executable='C:/Program Files/Google/Chrome/Application/chrome.exe';const browser=await chromium.launch({headless:true,...(fs.existsSync(executable)?{executablePath:executable}:{})});let retained;
 try{
  for(const scenario of ['normal','slow','repeat']){
   const pair={scenario};for(const variant of ['before','after']){const ctx=await setup(browser,variant);pair[variant]=await measure(ctx,scenario);if(scenario==='repeat'&&variant==='after')retained=ctx;else await ctx.context.close();}
   pair.status='PASS';report.performance.push(pair);console.log(JSON.stringify(pair));
  }
  await functional(retained);assert.equal(report.performance.length,3);assert.equal(report.functional.length,6);assert.deepEqual(report.errors,[]);assert.equal(report.productionRequests,0);report.status='PASS';
 }catch(error){report.error=error.stack;throw error;}
 finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(report));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
