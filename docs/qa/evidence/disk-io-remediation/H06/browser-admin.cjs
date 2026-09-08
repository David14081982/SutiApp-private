'use strict';
const crypto=require('crypto'),assert=require('assert').strict,{chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'),a=require('./audit.cjs');
const target=process.env.H06_TARGET||'http://localhost:8080/',label=process.env.H06_LABEL||'local';
let stage='initial';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});stage='login';
 try{const page=await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'}),env=a.env(),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=r.url();if(/\/rest\/v1\/program_catalog_(items|item_assets)\?/.test(u))requests.push({stage,kind:u.match(/program_catalog_\w+/)[0]});if(u.includes('/storage/v1/object/sign/')){try{const v=r.postDataJSON();if(v.paths)requests.push({stage,kind:'sign',objects:v.paths.length});}catch(_){}}});
  await page.goto(target);await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>AffiliateAuth.getState().phase==='authenticated',null,{timeout:45000});await page.waitForLoadState('networkidle');
  if(await page.getByRole('button',{name:'Ahora no',exact:true}).isVisible())await page.getByRole('button',{name:'Ahora no',exact:true}).click();
  await page.getByRole('button',{name:'Admin',exact:true}).click();await page.locator('[data-admin-module="program_products"]').click();stage='summary';await page.waitForFunction(()=>programCatalogAdminStore.state().phase==='loaded');await page.waitForLoadState('networkidle');
  const summary=await page.evaluate(()=>({count:programCatalogAdminStore.all().length,programs:programCatalogAdminStore.programs()}));assert.equal(summary.count,135);
  stage='selected';await page.locator('[data-program-key="auto"]').click();await page.locator('[data-program-product]').first().waitFor();await page.waitForLoadState('networkidle');
  const selected=await page.locator('[data-program-product]').evaluateAll(nodes=>nodes.map(n=>n.innerText));assert.equal(selected.length,3);
  stage='editor';await page.locator('[data-program-product]').first().locator('button').first().click();await page.locator('[data-program-product-editor]').waitFor();await page.waitForLoadState('networkidle');
  const editor=await page.locator('[data-program-product-editor]').evaluate(node=>({text:node.innerText,fields:[...node.querySelectorAll('[data-program-product-field]')].map(n=>({field:n.dataset.programProductField,value:n.value})),controls:[...node.querySelectorAll('button')].map(n=>({text:n.textContent,label:n.getAttribute('aria-label'),disabled:n.disabled})),images:node.querySelectorAll('img').length}));assert.equal(editor.images,9);
  await page.locator('[data-program-product-editor] button[aria-label="Cerrar"]').click();assert.equal(await page.locator('[data-program-product-editor]').count(),0);
  assert.equal(errors.length,0,errors.join(';'));a.save('admin-'+label,{at:new Date().toISOString(),status:'PASS',summary_sha256:hash(summary),selected_sha256:hash(selected),editor_sha256:hash(editor),items:summary.count,selectedItems:selected.length,editorImages:editor.images,requests,errors,writes:0});console.log(JSON.stringify({status:'PASS',items:summary.count,selectedItems:selected.length,editorImages:editor.images,requests}));
 }finally{await browser.close();}
})().catch(e=>{console.error(stage+': '+e.message.replace(/https?:\/\/\S+/g,'[url]'));process.exitCode=1;});
