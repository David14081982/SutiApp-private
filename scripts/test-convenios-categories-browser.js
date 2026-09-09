'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {env}=require('./prepare-companies-convenios-education');
const target=process.argv[2]||'http://localhost:8080/SutiApp.html',readonly=process.argv.includes('--readonly');
const out=path.resolve(__dirname,'../docs/qa/evidence/categories-20260909');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const result={status:'FAIL',target,mode:readonly?'REAL_BACKEND_READ_ONLY':'ISOLATED_BROWSER_WRITES',viewports:[],productionBusinessWrites:0};fs.mkdirSync(out,{recursive:true});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(30000);const errors=[],writes=[],categories=[];let failCategory=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/rest/v1/**',async route=>{
   const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').pop(),method=req.method();
   if(!readonly&&name==='marketplace_categories'){
    if(method==='GET'){const response=await route.fetch(),rows=await response.json();return route.fulfill({response,json:[...rows,...categories]});}
    if(failCategory)return route.fulfill({status:403,json:{code:'42501',message:'ISOLATED_PERMISSION_FAILURE'}});
    const body=req.postDataJSON(),row={...body,id:'cd000000-0000-4000-8000-'+String(categories.length+100).padStart(12,'0'),image_asset:null};categories.push(row);writes.push({kind:'category',row});return route.fulfill({status:201,json:{id:row.id}});
   }
   if(!readonly&&name==='save_agreement_ficha'){writes.push({kind:'agreement',body:req.postDataJSON()});return route.fulfill({json:'cd000000-0000-4000-8000-000000000200'});}
   if(!readonly&&name==='educational_resources'&&method==='PATCH'){const body=req.postDataJSON();writes.push({kind:'education',body});return route.fulfill({json:{...body,id:u.searchParams.get('id').replace('eq.','')}});}
   if(!readonly&&name==='list_public_convenios'){
    const response=await route.fetch(),rows=await response.json();return route.fulfill({response,json:[...rows,{id:'cd000000-0000-4000-8000-000000000300',source_kind:'education',display_name:'Institución QA aislada',category_raw:'Educación',public_details:{category_label:'Idiomas QA'},benefits:[],promotions:[],gallery_asset_ids:[]}]});
   }
   if(method!=='GET'&&!u.pathname.includes('/rpc/')){result.productionBusinessWrites++;return route.abort();}
   return route.continue();
  });
  await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>AffiliateAuth.getState().phase==='authenticated');const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
  await page.getByRole('button',{name:'Admin',exact:true}).click();await page.locator('[data-admin-module=convenios]').click();await page.getByRole('button',{name:'Catálogos',exact:true}).click();await page.waitForSelector('[data-commercial-categories]');await page.getByRole('button',{name:'Nueva categoría',exact:true}).waitFor();
  await page.screenshot({path:path.join(out,(readonly?'production':'isolated')+'-categories-'+width+'.png')});
  await page.getByRole('button',{name:'Convenios',exact:true}).first().click();await page.getByRole('button',{name:'Nuevo',exact:true}).click();const select=page.getByRole('combobox',{name:'Categoría',exact:true});await select.waitFor();await page.waitForFunction(()=>catalogStore.state().phase==='loaded');
  assert.equal(await select.inputValue(),'');assert(await select.locator('option').count()>=5);await page.getByPlaceholder('Ej. Farmacias del Ahorro').fill('Ficha conservada QA');
  await page.getByRole('button',{name:'+ Nueva categoría',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Nueva categoría'});await dialog.getByRole('textbox',{name:'Nombre de categoría',exact:true}).fill('Idiomas QA');
  if(readonly){await dialog.getByRole('button',{name:'Cerrar categoría'}).click();}
  else{
   failCategory=true;await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByRole('textbox',{name:'Nombre de categoría',exact:true}).inputValue(),'Idiomas QA');failCategory=false;
   await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await select.inputValue(),'Idiomas QA');assert.equal(await page.getByPlaceholder('Ej. Farmacias del Ahorro').inputValue(),'Ficha conservada QA');assert.equal(writes.filter(w=>w.kind==='category').length,1);
   await page.getByRole('button',{name:'+ Nueva categoría',exact:true}).click();await dialog.getByRole('textbox',{name:'Nombre de categoría',exact:true}).fill('idiomas qa');await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.getByText('Ya existe una categoría con ese nombre.').waitFor();await dialog.getByRole('button',{name:'Cerrar categoría'}).click();
   await page.getByRole('button',{name:'Guardar convenio',exact:true}).click();await page.waitForTimeout(500);assert.equal(writes.find(w=>w.kind==='agreement').body.p_fields.profile.category_label,'Idiomas QA');
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>AffiliateAuth.getState().phase==='authenticated');await page.getByRole('button',{name:'Admin',exact:true}).click();await page.locator('[data-admin-module=education]').click();await page.waitForSelector('[data-h009-item=education]');await page.locator('[data-h009-item=education]').first().getByRole('button',{name:'Editar',exact:true}).click();const edu=page.getByRole('combobox',{name:'Categoría de la institución',exact:true});await edu.waitFor();await page.waitForFunction(()=>catalogStore.state().phase==='loaded');
  if(!readonly){await edu.selectOption({label:'Idiomas QA'});await page.locator('[data-h009-save=education]').click();await page.waitForTimeout(500);assert.equal(writes.find(w=>w.kind==='education').body.public_details.category_label,'Idiomas QA');}
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>AffiliateAuth.getState().phase==='authenticated');await page.getByRole('button',{name:'Convenios',exact:true}).click();await page.waitForSelector('[data-convenios-state=loaded]');await page.getByRole('button',{name:'Educación',exact:true}).click();const count=await page.locator('[data-convenios-section=all] [data-company-id]').count();assert(count>=9);
  if(!readonly){await page.getByRole('button',{name:'Idiomas QA',exact:true}).click();assert.equal(await page.locator('[data-convenios-section=all] [data-company-id]').count(),1);await page.getByText('Institución QA aislada',{exact:true}).click();await page.locator('[data-convenio-detail]').getByText('Educación / Idiomas QA',{exact:true}).waitFor();}
  await page.screenshot({path:path.join(out,(readonly?'production':'isolated')+'-education-'+width+'.png')});assert.deepEqual(errors,[]);result.viewports.push({width,categoryManager:true,inlineCreate:readonly?'FORM_VERIFIED':'CREATE_ERROR_RETRY_DUPLICATE_PASS',parentFormPreserved:true,education:readonly?'SELECTOR_VERIFIED':'SAVE_AND_FILTER_PASS'});await context.close();
 }assert.equal(result.productionBusinessWrites,0);result.status='PASS';fs.writeFileSync(path.join(out,readonly?'production-browser.json':'browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
