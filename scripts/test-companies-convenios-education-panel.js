'use strict';
// Browser-only fixtures: validate paid-company controls without inventing a production contract/payment.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {env,out,proof}=require('./prepare-companies-convenios-education');
async function main(){const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),result={status:'FAIL',environment:'ISOLATED_BROWSER_FIXTURES',productionBusinessWrites:0,viewports:[]};
try{for(const width of [390,1440]){const ctx=await b.newContext({viewport:{width,height:950},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8080/SutiApp.html');await p.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await p.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await p.locator('button[type=submit]').click();await p.waitForFunction(()=>AffiliateAuth.getState().phase==='authenticated');await p.evaluate(()=>companyStore.bootstrap());
await p.evaluate(()=>{
 const actual=window.companyStore,plan=actual.plans().find(p=>p.name==='Impulso');if(!plan)throw Error('REAL_PLAN_MISSING');
 const co={id:'ca000000-0000-4000-8000-000000000099',name:'Empresa QA aislada',razon:'QA',giro:'Servicios',desc:'Perfil público',historia:'Historia QA',tel:'6620000000',whatsapp_raw:'526620000000',email:'qa@example.invalid',web:'https://example.invalid',redes:{},horario:'Lunes a viernes',sucursales:[{nombre:'Sucursal QA',dir:'Dirección QA'}],video:'',mapUrl:'',gallery:[],plan:plan.id,billing:'mensual',subStart:'2026-09-01',subEnd:'2099-10-01',products:[],promos:[],stats:{solicitudes:0,cotizaciones:0}};
 window.__panelWrites=[];window.__panelFail=false;window.__panelCo=co;
 const store={...actual,current:()=>co,get:()=>co,companies:()=>[co],portalCompanies:()=>[co],isAuth:()=>true,subStatus:()=> 'activo',subscribe:()=>()=>{},bootstrap:async()=>{},retry:async()=>{},solicitudes:()=>[],quotes:()=>[],notifs:()=>[],myPopups:()=>[],planAllows:(_,key)=>!!actual.plan(co.plan)[key],save:async d=>{if(window.__panelFail)throw Error('ISOLATED_SAVE_FAILURE');window.__panelWrites.push({kind:'profile',value:d});},savePromo:async(id,d)=>window.__panelWrites.push({kind:'promotion',company:id,value:d}),submitPopup:async(id,d)=>window.__panelWrites.push({kind:'popup',company:id,value:d})};window.companyStore=store;
 window.ConveniosRepository={...ConveniosRepository,activity:async()=>({history_allowed:false,logs:[]})};window.useCatalogStore=()=>window.catalogStore;
 const host=document.createElement('div');document.body.replaceChildren(host);window.__panelRoot=ReactDOM.createRoot(host);window.__panelApp={toast:()=>{}};
 window.__renderPanel=(module)=>__panelRoot.render(React.createElement(module?window[module]:window.CompanyScreen,{app:__panelApp,co,store,onBack:()=>__renderPanel(null)}));__renderPanel(null);
});
await ctx.route('**/rest/v1/**',route=>route.abort()); // Fixtures cannot reach production business APIs.
await p.getByRole('button',{name:'Mi Empresa',exact:true}).click();assert.equal(await p.locator('input[type=file]').count(),3);
await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();await p.waitForFunction(()=>__panelWrites.length===1);const saved=await p.evaluate(()=>__panelWrites[0]);assert.equal(saved.value.historia,'Historia QA');assert.equal(saved.value.sucursales[0].dir,'Dirección QA');
await p.evaluate(()=>{__panelFail=true;});await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();await p.getByRole('alert').waitFor();assert(await p.getByText('Nombre comercial',{exact:true}).isVisible());await p.screenshot({path:path.join(out,'isolated-company-profile-'+width+'.png')});
await p.evaluate(()=>__renderPanel('CoProductos'));await p.getByText('Productos y Servicios',{exact:true}).waitFor();
await p.evaluate(()=>__renderPanel('CoPromos'));await p.getByRole('button',{name:'Nueva promoción',exact:true}).click();assert.equal(await p.locator('input[type=file]').count(),1);
await p.evaluate(()=>__renderPanel('CoPopups'));await p.getByRole('button',{name:'Nuevo pop-up',exact:true}).click();assert.equal(await p.locator('input[type=file]').count(),1);await p.screenshot({path:path.join(out,'isolated-company-popup-'+width+'.png')});
await p.evaluate(()=>{__panelCo.plan=COMPANY.PLANS.find(p=>p.name==='Esencial').id;__renderPanel('CoPopups');});await p.getByText(/La administración de Pop-ups no está incluida/).waitFor();assert.equal(await p.getByRole('button',{name:'Nuevo pop-up',exact:true}).count(),0);
for(const module of ['CoSolicitudes','CoCotizaciones','CoStats','CoNotifs','CoBitacora']){await p.evaluate(m=>__renderPanel(m),module);await p.waitForTimeout(100);assert((await p.locator('body').innerText()).trim().length>0);}
assert.deepEqual(errors,[]);result.viewports.push({width,modules:9,profileSave:'PASS',failedSaveRetainsForm:'PASS',logoCoverGallery:'PASS',promotionImage:'PASS',popupImage:'PASS',planGate:'PASS'});await ctx.close();}
result.status='PASS';}finally{await b.close();proof('isolated-panel',result);}}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
