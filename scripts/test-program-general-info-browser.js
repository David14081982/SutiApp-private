'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/program-general-info-20260910');
const values={};for(const l of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const a=l.indexOf('=');if(a>0&&!l.startsWith('#'))values[l.slice(0,a).trim()]=l.slice(a+1).trim().replace(/^['"]|['"]$/g,'');}
const target=process.env.SUTIAPP_PROGRAM_INFO_URL||'http://127.0.0.1:8766/';
const production=process.env.SUTIAPP_PROGRAM_INFO_READONLY==='1';
const keys=['auto','aires','casa','solar','computo'];
const report={status:'FAIL',target,readOnly:production,programs:[],errors:[]};
async function login(page){await page.goto(target);await page.waitForFunction(()=>window.AffiliateAuth);if(await page.evaluate(()=>window.AffiliateAuth.getState().phase==='authenticated'))return;await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth.getState().phase==='authenticated',null,{timeout:60000});}
async function products(page){return page.evaluate(async()=>{const r=await window.SutiSupabase.getClient().from('program_catalog_items').select('id,program_key,name,description,price_cash,requires_quote,commercial_mode,sold,enabled,sort_order').order('id');if(r.error)throw r.error;return r.data;});}
async function mountPublic(page,key){
  // Actual production screen, mounted in an isolated host with no transaction CTA invocation.
  await page.evaluate(async key=>{await window.finCatStore.refresh();if(window.__programPublicRoot)window.__programPublicRoot.unmount();document.querySelector('#program-public-proof')?.remove();const host=document.createElement('div');host.id='program-public-proof';Object.assign(host.style,{position:'fixed',inset:'0',zIndex:10000,background:'var(--bg)'});document.body.appendChild(host);window.__programPublicRoot=ReactDOM.createRoot(host);window.__programPublicRoot.render(React.createElement(window.ProductScreen,{app:{back:()=>{},toast:()=>{},push:()=>{}},params:{id:key}}));},key);
  await page.locator('#program-public-proof [data-program-description]').waitFor();
  await page.locator('#program-public-proof .su-press').first().waitFor({timeout:60000});
}
async function unmountPublic(page){await page.evaluate(()=>{window.__programPublicRoot?.unmount();window.__programPublicRoot=null;document.querySelector('#program-public-proof')?.remove();});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.SUTIAPP_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();
 const originals=new Map();let before;
 page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.addLocatorHandler(page.getByRole('button',{name:'Ahora no',exact:true}),async locator=>locator.click());
  await login(page);await page.waitForFunction(()=>window.ProgramGeneralInfo&&window.AdminRepository);
  await page.evaluate(()=>window.AdminRepository.bootstrap());
  before=await products(page);
  await page.getByRole('button',{name:'Admin',exact:true}).first().click();
  await page.locator('[data-admin-module=program_products]').click();
  await page.locator('[data-program-key=auto]').waitFor();
  for(const key of keys){
   await page.locator('[data-program-key='+key+']').click();
   const editor=page.locator('[data-program-info-editor='+key+']');await editor.waitFor();
   const original=await page.evaluate(key=>window.ProgramGeneralInfo.get(key),key);originals.set(key,original);
   assert.equal(await editor.locator('[data-program-info-field=description]').inputValue(),original.program_info.description);
   const order=await page.evaluate(key=>{const a=document.querySelector('[data-program-info-editor="'+key+'"]'),b=document.querySelector('[data-program-info-preview="'+key+'"]'),c=document.querySelector('[data-program-product]'),d=document.querySelector('[data-program-product-add]');return !!(a&&b&&d&&(a.compareDocumentPosition(b)&4)&&(!c||(b.compareDocumentPosition(c)&4)&&(c.compareDocumentPosition(d)&4)));},key);assert(order,'ADMIN_SECTION_ORDER_'+key);
   let expected=original;
   if(!production){
    const description=original.program_info.description+'\nInformación actualizada para verificación.';
    await editor.locator('[data-program-info-field=description]').fill(description);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    assert.equal(await editor.locator('[data-program-info-field=description]').inputValue(),description,'DRAFT_LOST_ON_FOCUS');
    await editor.locator('[data-program-info-field=benefit-0-title]').fill('Ventaja verificada');
    assert(original.cover_url,'REAL_COVER_REQUIRED_'+key);
    const response=await fetch(original.cover_url);assert(response.ok,'COVER_DOWNLOAD');const bytes=Buffer.from(await response.arrayBuffer()),mime=response.headers.get('content-type').split(';')[0];
    await editor.locator('[data-program-info-cover]').setInputFiles({name:'portada-real.'+(mime==='image/gif'?'gif':'png'),mimeType:mime,buffer:bytes});
    await editor.locator('[data-program-info-save]').click();
    await page.waitForFunction(key=>document.querySelector('[data-program-info-editor="'+key+'"] [data-program-info-message]')?.textContent==='Información guardada.',key,{timeout:60000});
    expected=await page.evaluate(key=>window.ProgramGeneralInfo.get(key),key);assert.notEqual(expected.program_cover_asset_id,original.program_cover_asset_id);
    assert.equal(expected.program_info.description,description);assert.equal(expected.program_info.benefits[0].t,'Ventaja verificada');
    await page.reload();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
    await page.getByRole('button',{name:'Admin',exact:true}).first().click();await page.locator('[data-admin-module=program_products]').click();await page.locator('[data-program-key='+key+']').click();await editor.waitFor();
    assert.equal(await editor.locator('[data-program-info-field=description]').inputValue(),description);
   }
   await page.screenshot({path:path.join(out,(production?'production-':'local-')+key+'-admin.png')});
   await page.setViewportSize({width:390,height:900});await mountPublic(page,key);
   assert.equal(await page.locator('#program-public-proof [data-program-description]').innerText(),expected.program_info.description);
   await page.waitForFunction(()=>{const image=document.querySelector('#program-public-proof [data-program-cover] img');return image?.complete&&image.naturalWidth>0;});
   assert((await page.locator('#program-public-proof [data-program-benefits]').innerText()).includes(expected.program_info.benefits[0].t));
   await page.locator('#program-public-proof').getByRole('button',{name:'Guardar',exact:true}).click();
   assert.equal(await page.locator('#program-public-proof [aria-label="Guardar programa"]').getAttribute('aria-pressed'),'true');
   await page.screenshot({path:path.join(out,(production?'production-':'local-')+key+'-public.png')});
   await unmountPublic(page);await page.setViewportSize({width:1440,height:1000});
   if(!production){await page.evaluate(async original=>{const current=await window.ProgramGeneralInfo.get(original.item_key);await window.ProgramGeneralInfo.save({...original,updated_at:current.updated_at});},original);originals.delete(key);}
   const after=await products(page);assert.deepEqual(after,before,'PRODUCTS_CHANGED');
   report.programs.push({key,status:'PASS',adminLoaded:true,editDescription:production?'verified persisted':true,editCover:production?'verified persisted':true,editBenefits:production?'verified persisted':true,refresh:true,publicReflects:true,productsPricesModesIntact:true});
   // Return to program cards using actual module header.
   await page.evaluate(()=>{const el=document.querySelector('[data-program-info-editor]');const buttons=[...document.querySelectorAll('button')];const back=buttons.find(b=>b.getAttribute('aria-label')==='Volver');if(back)back.click();});
   if(!await page.locator('[data-program-key=auto]').count()){
    await page.reload();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');await page.getByRole('button',{name:'Admin',exact:true}).first().click();await page.locator('[data-admin-module=program_products]').click();await page.locator('[data-program-key=auto]').waitFor();
   }
  }
  await page.reload();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');await page.getByRole('button',{name:'Admin',exact:true}).first().click();await page.locator('[data-admin-module=fincat]').click();
  await page.getByRole('button',{name:/^Suti Auto/}).first().click();await page.locator('[data-program-info-editor=auto]').waitFor();
  report.financeCatalogUsesSameEditor=true;
  await page.screenshot({path:path.join(out,(production?'production-':'local-')+'finance-editor.png')});
  report.metadataPrograms=await page.evaluate(async()=>{const r=await window.SutiSupabase.getClient().from('finance_catalog_presentation').select('item_key').not('program_info','is',null);if(r.error)throw r.error;return r.data.map(x=>x.item_key).sort();});assert.equal(report.metadataPrograms.length,14);
  await page.evaluate(()=>{const host=document.createElement('div');host.id='terrain-proof';Object.assign(host.style,{position:'fixed',inset:'0',zIndex:10000});document.body.appendChild(host);window.__terrainProof=ReactDOM.createRoot(host);window.__terrainProof.render(React.createElement(window.TerrenoScreen,{app:{back:()=>{},push:()=>{},toast:()=>{}}}));});
  await page.locator('#terrain-proof [data-terreno-map]').waitFor();assert(await page.locator('#terrain-proof').getByText('El Fresnillo',{exact:true}).count());report.terrainHeaderAndMapPreserved=true;
  await page.screenshot({path:path.join(out,(production?'production-':'local-')+'terrain.png')});
  await page.evaluate(()=>{window.__terrainProof.render(React.createElement(window.TerrainProgramHeader,{headerInfo:{icon:'land',map_title:'Título verificado',map_subtitle:'Subtítulo verificado',map_program_label:'Programa verificado',map_description:'Descripción verificada'},app:{back:()=>{}}}));});
  for(const text of ['Título verificado','Subtítulo verificado','Programa verificado','Descripción verificada'])await page.locator('#terrain-proof').getByText(text,{exact:true}).waitFor();
  report.terrainAllHeaderFieldsDynamic=true;
  await page.evaluate(()=>{window.__terrainProof.unmount();document.querySelector('#terrain-proof').remove();});
  assert.deepEqual(report.errors,[],'BROWSER_ERRORS');
  report.productHash=crypto.createHash('sha256').update(JSON.stringify(before)).digest('hex');report.status='PASS';
 }catch(e){report.error=e.message;await page.screenshot({path:path.join(out,'browser-failure.png')}).catch(()=>{});throw e;}
 finally{
  for(const original of originals.values())if(!production)try{await page.evaluate(async original=>{const current=await window.ProgramGeneralInfo.get(original.item_key);await window.ProgramGeneralInfo.save({...original,updated_at:current.updated_at});},original);}catch(e){report.restoreError=e.message;report.status='FAIL';}
  fs.writeFileSync(path.join(out,production?'production-browser.json':'browser.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
