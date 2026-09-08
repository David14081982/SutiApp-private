'use strict';
const assert=require('assert').strict,{chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'),a=require('./audit.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),e=a.env();
  const login=async()=>{await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>AffiliateAuth.getState().phase==='authenticated',null,{timeout:45000});await page.waitForLoadState('networkidle');if(await page.getByRole('button',{name:'Ahora no',exact:true}).isVisible())await page.getByRole('button',{name:'Ahora no',exact:true}).click();};
  await page.goto(process.env.H06_TARGET||'http://localhost:8080/');await login();await page.locator('[data-app-tab="financiera"]').click();await page.getByRole('button',{name:/Suti Auto/}).click();await page.waitForFunction(()=>catalogStore.count('fin','auto')===3);
  const epoch=await page.evaluate(()=>PrivateResourceDemand.context());await page.evaluate(()=>AffiliateAuth.signOut());await page.locator('input[type=email]').waitFor();
  const cleared=await page.evaluate(()=>({context:PrivateResourceDemand.context(),catalog:catalogStore.count('fin','auto'),admin:programCatalogAdminStore.all().length}));assert.deepEqual(cleared,{context:null,catalog:0,admin:0});assert.equal(await page.locator('img[src*="/object/sign/"]').count(),0);
  await login();const next=await page.evaluate(()=>({context:PrivateResourceDemand.context(),catalog:catalogStore.count('fin','auto')}));assert.notEqual(next.context,epoch);assert.equal(next.catalog,0);
  a.save('context-'+(process.env.H06_LABEL||'local'),{at:new Date().toISOString(),status:'PASS',logoutClearsCatalog:true,logoutRemovesPrivateImages:true,loginCreatesNewContext:true,noProgramPrefetchAfterLogin:true});console.log('Context logout/login: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message.replace(/https?:\/\/\S+/g,'[url]'));process.exitCode=1;});
