'use strict';
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const read=f=>fs.readFileSync(f,'utf8');
const chunk=(name)=>{const matches=[...read('app/bundle.js').matchAll(/\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=\/\* @@file |$)/g)];return matches.find(m=>m[1]===name)[0];};
async function setup(browser,width,source){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();
 await context.route('**/*',route=>route.abort()); // All test data is isolated; no business API requests are possible.
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="root"></div>');
 for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
 await page.evaluate(()=>{
  window.fixture={rows:[{id:'existing',display_name:'Existing',sort_order:7,enabled:true}],calls:[],denied:false,coverFail:false,refreshFail:false,uploads:0,toasts:[],discarded:[],created:0};
  const state=window.fixture;
  window.Icon=()=>null;window.SectionResponsibilityPanel=()=>null;
  window.EmptyState=({title})=>React.createElement('p',null,title);
  window.CommercialCategoryField=({label,value,onChange})=>React.createElement('label',null,label,React.createElement('input',{'data-category':'',value,onChange:e=>onChange(e.target.value)}));
  window.PrivateResourceDemand={context:()=>1};
  window.AdminRepository={
   has:()=>true,listManaged:async()=>state.rows.map(x=>({...x})),
   saveManaged:async(kind,fields)=>{state.calls.push({name:'saveManaged',kind,fields});if(kind==='companies')throw {code:'42501',message:'permission denied for table companies'};return {id:'other'};},
   uploadManagedAsset:async()=>{const id='asset-'+(++state.uploads);return {id,url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='};},
   discardAsset:async a=>state.discarded.push(a.id),replaceCompanyAsset:async()=>{throw Error('obsolete asset route used');}
  };
  window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
   state.calls.push({name,args});
   if(state.denied)return {error:{code:'P0001',message:'COMPANY_CREATE_DENIED'}};
   if(name==='save_company_ficha'){
    const id=args.p_company_id||'new-'+(++state.created);const at=state.rows.findIndex(x=>x.id===id);
    const next={...(at>=0?state.rows[at]:{}),...args.p_fields,id};if(at<0)state.rows.push(next);else state.rows[at]=next;return {data:id};
   }
   if(name==='attach_company_ficha_image')return state.coverFail?{error:{code:'P0001',message:'COMPANY_ASSET_DENIED'}}:{data:null};
   throw Error('UNEXPECTED_RPC:'+name);
  }})};
  window.app={toast:m=>state.toasts.push(m),visual:{retry:async()=>{if(state.refreshFail)throw Error('refresh failed');}}};
  window.root=ReactDOM.createRoot(document.getElementById('root'));
 });
 await page.addScriptTag({content:read('app/convenios-repository.js')});await page.addScriptTag({content:source});
 await page.evaluate(()=>window.render=(kind='companies')=>root.render(React.createElement(VisualCrudModule,{key:kind,kind,app,header:({title})=>React.createElement('h1',null,title),onBack:()=>{}})));
 await page.evaluate(()=>render());await page.locator('[data-h009-create=companies]').click();
 return {page,context,errors};
}
async function controls(page){return page.locator('[data-h009-editor]').evaluate(el=>({labels:[...el.querySelectorAll('label')].map(x=>x.textContent),buttons:[...el.querySelectorAll('button')].map(x=>x.textContent),files:el.querySelectorAll('input[type=file]').length,fields:[...el.querySelectorAll('[data-h009-field]')].map(x=>x.dataset.h009Field)}));}
async function main(){const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const results=[];
 try{
  for(const width of [390,1440]){
   const baseline=await setup(browser,width,read('.tmp/company-create-save/before/app/screens-admin-visual-crud.jsx'));const original=await controls(baseline.page);
   await baseline.page.locator('[data-h009-field=display_name]').fill('QA isolated');await baseline.page.locator('[data-category]').fill('Servicios');await baseline.page.locator('[data-h009-save=companies]').click();
   await baseline.page.waitForFunction(()=>fixture.toasts.includes('No fue posible guardar los cambios'));assert.equal(await baseline.page.locator('[data-h009-editor=companies]').count(),1);await baseline.context.close();
   for(const build of ['source','bundle']){
    const {page,context,errors}=await setup(browser,width,build==='source'?read('app/screens-admin-visual-crud.jsx'):chunk('screens-admin-visual-crud.jsx'));
    assert.deepEqual(await controls(page),original);
    const values={display_name:'QA isolated',description:'Full profile',address_raw:'Address',phone_raw:'000000',whatsapp_raw:'111111',email_raw:'qa@example.invalid',website_url:'https://example.invalid'};
    for(const[k,v]of Object.entries(values))await page.locator(`[data-h009-field=${k}]`).fill(v);await page.locator('[data-category]').fill('Servicios');
    const file={name:'qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')};
    for(let i=0;i<2;i++){await page.locator('input[type=file]').nth(i).setInputFiles(file);await page.waitForFunction(()=>!document.querySelector('[data-h009-save]').disabled);}
    await page.evaluate(()=>fixture.denied=true);await page.locator('[data-h009-save=companies]').click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/no tiene permiso/);assert.equal(await page.locator('[data-h009-field=email_raw]').inputValue(),values.email_raw);
    await page.evaluate(()=>{fixture.denied=false;fixture.coverFail=true;});await page.locator('[data-h009-save=companies]').click();await page.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent.includes('La ficha se guardó'));
    const saved=await page.evaluate(()=>fixture.calls.filter(c=>c.name==='save_company_ficha').at(-1));
    assert.equal(saved.args.p_company_id,null);for(const[k,v]of Object.entries(values))assert.equal(saved.args.p_fields[k],v);assert.equal(saved.args.p_fields.sort_order,8);assert.equal(saved.args.p_fields.category_raw,'Servicios');assert.equal(saved.args.p_fields.logo_asset_id,'asset-1');assert.equal(saved.args.p_fields.enabled,true);assert(!('cover_asset_id' in saved.args.p_fields));assert(!('logo_url' in saved.args.p_fields));
    await page.evaluate(()=>fixture.coverFail=false);await page.locator('[data-h009-save=companies]').click();await page.waitForFunction(()=>!document.querySelector('[data-h009-editor]'));
    let state=await page.evaluate(()=>fixture);assert.equal(state.created,1);assert.equal(state.calls.filter(c=>c.name==='save_company_ficha').at(-1).args.p_company_id,'new-1');assert(!state.calls.some(c=>c.name==='saveManaged'));assert.deepEqual(state.discarded,[]);
    await page.locator('[data-h009-id="new-1"]').getByRole('button',{name:'Editar',exact:true}).click();await page.locator('[data-h009-field=email_raw]').fill('edited@example.invalid');await page.evaluate(()=>fixture.refreshFail=true);await page.locator('[data-h009-save=companies]').click();await page.waitForFunction(()=>document.querySelector('[role=alert]')?.textContent.includes('no se pudo actualizar la pantalla'));
    state=await page.evaluate(()=>fixture);assert.equal(state.created,1);assert.equal(state.rows.find(r=>r.id==='new-1').email_raw,'edited@example.invalid');
    await page.screenshot({path:`docs/qa/evidence/company-create-save/${build}-${width}.png`});
    await page.evaluate(()=>{fixture.refreshFail=false;render('popups');});await page.locator('[data-h009-create=popups]').click();await page.locator('[data-h009-field=title]').fill('Isolated popup');await page.locator('[data-h009-save=popups]').click();await page.waitForFunction(()=>fixture.calls.some(c=>c.name==='saveManaged'&&c.kind==='popups'));assert.deepEqual(errors,[]);
    results.push({width,build,originalFailureReproduced:true,controlsPreserved:true,fullProfile:true,logoAndCover:true,deniedRetainsDraft:true,partialSaveRetryWithoutDuplicate:true,edit:true,refreshErrorDistinct:true,otherResourceUnchanged:true});await context.close();
   }
  }
  const result={status:'PASS',environment:'ISOLATED_BROWSER',productionWrites:0,network:'ALL_ROUTES_ABORTED',results};fs.writeFileSync('docs/qa/evidence/company-create-save/browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
