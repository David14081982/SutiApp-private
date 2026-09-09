'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {env,out,proof}=require('./prepare-companies-convenios-education');
const target=process.argv[2]||'http://127.0.0.1:8879/SutiApp.html';
async function login(page){await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();}
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),result={status:'FAIL',target:['localhost','127.0.0.1'].includes(new URL(target).hostname)?'LOCAL':'PRODUCTION',viewports:[],errors:[],businessWrites:0};
 fs.mkdirSync(out,{recursive:true});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>result.errors.push(e.message));
   page.on('request',r=>{if(/\/rest\/v1\/(companies|educational_resources|marketplace_products|company_portal_subscriptions)(?:\?|$)/.test(r.url())&&r.method()!=='GET')result.businessWrites++;});
   await page.goto(target,{waitUntil:'domcontentloaded'});await login(page);
   await page.getByRole('button',{name:'Convenios',exact:true}).click();await page.waitForSelector('[data-convenios-state=loaded]');
   const cards=await page.locator('[data-convenios-section=all] [data-company-id]').count();
   const expected=await page.evaluate(async()=>{const rows=await ConveniosRepository.list();return {total:rows.length,education:rows.filter(r=>r.source_kind==='education').length,unique:new Set(rows.map(r=>r.public_key)).size};});
   assert.equal(cards,expected.total);assert.equal(expected.unique,expected.total);assert(expected.education>0);
   assert.equal(await page.locator('[data-convenios-section=ads]').count(),1);assert.equal(await page.locator('[data-convenios-section=featured]').count(),1);assert.equal(await page.getByText('PATROCINADO',{exact:true}).count()>0,true);
   await page.screenshot({path:path.join(out,result.target.toLowerCase()+'-convenios-'+width+'.png')});
   await page.getByRole('button',{name:'Educación',exact:true}).click();assert.equal(await page.locator('[data-convenios-section=all] [data-company-id]').count(),expected.education);
   await page.locator('[data-convenios-section=all] [data-company-id]').first().click();await page.waitForSelector('[data-convenio-detail]');
   const text=await page.locator('[data-convenio-detail]').innerText();assert(!/Información pendiente de publicación|Pendiente de información estructurada|DESCUENTO PENDIENTE/.test(text));
   assert.equal(await page.locator('[data-convenio-detail] h1').count(),1);await page.screenshot({path:path.join(out,result.target.toLowerCase()+'-education-detail-'+width+'.png')});
   await page.getByRole('button',{name:'Volver',exact:true}).click();await page.getByRole('button',{name:'Admin',exact:true}).click();await page.locator('[data-admin-module=education]').click();await page.waitForSelector('[data-h009-state=loaded]');
   assert.equal(await page.locator('[data-education-admin-tabs]').count(),1);assert.equal(await page.getByRole('button',{name:'Tutoriales',exact:true}).count(),1);
   await page.locator('[data-h009-item=education]').first().getByRole('button',{name:'Editar',exact:true}).click();await page.waitForSelector('[data-h009-editor=education]');assert(await page.getByText('Oferta o beneficio',{exact:true}).isVisible());assert(await page.getByText('Condiciones y requisitos',{exact:true}).isVisible());await page.screenshot({path:path.join(out,result.target.toLowerCase()+'-education-admin-'+width+'.png')});
   const services=page.locator('[data-h009-editor=education] label').filter({hasText:'Servicios educativos (uno por línea:'}).locator('textarea');await services.fill('Curso uno | Detalle uno\nCurso dos | Detalle dos');assert.equal(await services.inputValue(),'Curso uno | Detalle uno\nCurso dos | Detalle dos');
   await page.locator('[data-h009-editor=education]').getByRole('button',{name:'Volver',exact:true}).click();
   // Navigation back through the existing administrative header.
   await page.getByRole('button',{name:'Volver al panel administrativo',exact:true}).first().click();await page.locator('[data-admin-module=planes]').click();await page.waitForFunction(()=>companyStore.state().phase==='loaded');
   const plans=await page.evaluate(()=>companyStore.plans().map(p=>({name:p.name,max:p.maxProductos,price:p.precioMensual,popups:p.popups,history:p.statsHistory})));
   for(const name of ['Esencial','Impulso','Destacado'])assert(plans.some(p=>p.name===name));
   await page.getByRole('button',{name:'Cambiar',exact:true}).first().click();assert(await page.getByText('Referencia del pago presencial',{exact:true}).isVisible());assert(await page.getByRole('button',{name:'Acreditar pago y activar',exact:true}).isDisabled());await page.getByRole('button',{name:'Cancelar',exact:true}).click();
   result.viewports.push({width,publicRecords:cards,education:expected.education,plans,structure:'PASS',tutorials:'PRESERVED',paymentConfirmation:'REQUIRED'});await context.close();
  }
  assert.deepEqual(result.errors,[]);assert.equal(result.businessWrites,0);result.status='PASS';
 }finally{await browser.close();proof(result.target.toLowerCase()+'-live',result);}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
