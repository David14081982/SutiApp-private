'use strict';
// Real deployed UI + intercepted save failure. Never persists a test company or uploads assets.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/company-create-save'),expected=JSON.parse(fs.readFileSync(path.join(out,'release-package.json'),'utf8'));
const target=process.argv[2]||'https://sutiapp.com/',local=['localhost','127.0.0.1'].includes(new URL(target).hostname),label=process.argv[3]||(local?'release-local':'published');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const env={};for(const line of fs.readFileSync(process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 const report={status:'FAIL',target,checkedAt:new Date().toISOString(),businessWrites:0,checks:[],realDataScreenshots:false};
 const r=await fetch(target,{cache:'no-store'});assert(r.ok);const html=await r.text(),bundlePath=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(bundlePath,'app/bundle.js?v='+expected.version);
 const b=await fetch(new URL(bundlePath,target),{cache:'no-store'});assert(b.ok);const bytes=Buffer.from(await b.arrayBuffer());assert.equal(sha(bytes),expected.bundleSha256,'PUBLISHED_BUNDLE_MISMATCH');
 const worker=await fetch(new URL('sw.js?v='+expected.version,target),{cache:'no-store'});assert(worker.ok);assert((await worker.text()).includes('sutiapp-v'+expected.version));report.checks.push('HTML, bundle SHA256 and service worker version match release');report.version=expected.version;report.bundleSha256=sha(bytes);
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[],requests=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/rest/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname.endsWith('/rpc/save_company_ficha')){
     const data=request.postDataJSON();requests.push({newCompany:data.p_company_id===null,fields:Object.keys(data.p_fields).sort(),contactMatches:data.p_fields.email_raw==='company-release-check@example.invalid'&&data.p_fields.phone_raw==='0000000000',nameMatches:data.p_fields.display_name==='Verificación aislada de publicación'});
     return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'COMPANY_DENIED'})});
    }
    if((/\/rest\/v1\/(companies|company_assets|app_assets)(?:$|\/)/.test(url.pathname)&&!['GET','HEAD','OPTIONS'].includes(request.method()))||url.pathname.endsWith('/rpc/attach_company_ficha_image')||url.pathname.endsWith('/rpc/replace_company_asset')){blocked.push(url.pathname);return route.abort();}
    return route.continue();
   });
   await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
   const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
   const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.evaluate(e=>e.click());await page.locator('[data-admin-module=companies_admin]').click();await page.locator('[data-h009-create=companies]').click();
   assert.equal(await page.locator('[data-h009-editor=companies] input[type=file]').count(),2);
   const required=['display_name','description','address_raw','phone_raw','whatsapp_raw','email_raw','website_url'];for(const field of required)assert.equal(await page.locator(`[data-h009-field=${field}]`).count(),1);
   await page.locator('[data-h009-field=display_name]').fill('Verificación aislada de publicación');await page.locator('[data-h009-field=phone_raw]').fill('0000000000');await page.locator('[data-h009-field=email_raw]').fill('company-release-check@example.invalid');
   await page.locator('[data-h009-save=companies]').click();await page.getByRole('alert').filter({hasText:'Tu cuenta no tiene permiso'}).waitFor();assert.equal(requests.length,1);assert(requests[0].newCompany&&requests[0].contactMatches&&requests[0].nameMatches);assert.equal(await page.locator('[data-h009-field=display_name]').inputValue(),'Verificación aislada de publicación');
   await page.locator('[data-h009-editor=companies]').getByRole('button',{name:'Volver',exact:true}).click();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});assert.equal(await page.locator('script[src*="app/bundle.js?v="]').getAttribute('src'),'app/bundle.js?v='+expected.version);
   assert.deepEqual(errors,[],'BROWSER_ERRORS');assert.deepEqual(blocked,[],'UNEXPECTED_WRITER');report.checks.push({width,formControls:'PASS',saveRpcIntercepted:requests[0],failureRetainsDraft:'PASS',refresh:'PASS',businessWrites:0});await context.close();
  }
  report.status='PASS';
 }finally{await browser.close();fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
