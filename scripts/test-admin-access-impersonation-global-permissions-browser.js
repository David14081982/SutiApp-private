'use strict';
const assert=require('assert').strict,fs=require('fs'),http=require('http'),net=require('net'),path=require('path');
const root=path.resolve(__dirname,'..'),chromePath='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
function playwright(){for(const p of [process.env.SUTIAPP_PLAYWRIGHT_PATH,'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core'].filter(Boolean)){try{return require(p);}catch(_){}}throw new Error('Playwright Core unavailable');}
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});});}
function serve(port){const server=http.createServer((request,response)=>{const pathname=new URL(request.url,`http://127.0.0.1:${port}`).pathname,relative=pathname==='/'?'SutiApp.html':decodeURIComponent(pathname.slice(1)),file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':path.extname(file)==='.html'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);});return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));}
async function token(values,prefix){const response=await fetch(values.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:values.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:values[prefix+'_EMAIL'],password:values[prefix+'_PASSWORD']})});assert.equal(response.status,200,prefix+' login');return (await response.json()).access_token;}
async function rpc(values,name,accessToken,body={}){return fetch(values.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:values.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(body)});}
async function main(){
  const values=env();['H005_TEST_EMAIL','H005_TEST_PASSWORD','H005_TEST3_EMAIL','H005_TEST3_PASSWORD'].forEach(k=>assert(values[k],k));
  const port=await freePort(),server=await serve(port),{chromium}=playwright();let browser;
  const result={status:'FAIL',realBrowser:true,modules:{},security:{},pageErrors:[]};
  try{
    browser=await chromium.launch({headless:true,executablePath:chromePath,args:['--no-sandbox','--disable-gpu','--no-first-run']});
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    page.on('pageerror',error=>result.pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/SutiApp.html`,{waitUntil:'domcontentloaded'});
    await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
    await page.waitForFunction(()=>window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated',null,{timeout:30000});
    const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.click();
    await page.waitForFunction(()=>window.AdminRepository&&window.AdminRepository.getState().phase==='authorized',null,{timeout:30000});await page.waitForSelector('[data-admin-view=menu]');
    for(const id of ['administrators','screen_permissions','impersonation'])assert.equal(await page.locator(`[data-admin-module=${id}]`).count(),1,id+' card');
    await page.locator('[data-admin-module=administrators]').click();await page.waitForSelector('[data-admin-assignment-form=total]');result.modules.administrators=true;
    await page.getByRole('button',{name:'Volver al panel administrativo'}).click();
    await page.locator('[data-admin-module=screen_permissions]').click();await page.waitForSelector('[data-admin-screen-permissions=backend-registry]');await page.waitForFunction(()=>document.querySelectorAll('[data-admin-screen-permissions=backend-registry] option').length===11,null,{timeout:15000});assert.equal(await page.locator('[data-admin-screen-permissions=backend-registry] option').count(),11);result.modules.screenPermissions=11;
    await page.getByRole('button',{name:'Volver al panel administrativo'}).click();
    await page.locator('[data-admin-module=impersonation]').click();await page.waitForSelector('[data-admin-impersonation=explicit-permission]');result.modules.impersonation=true;
    await page.setViewportSize({width:430,height:932});assert.equal(await page.locator('[data-admin-impersonation=explicit-permission]').count(),1);result.modules.mobile=true;
    await page.evaluate(()=>window.AdminRepository.primeAccessContext({technical_permissions:[],section_actions:[{section_key:'agreements',action:'update'}]}));
    await page.waitForSelector('[data-admin-view=menu]');
    assert.equal(await page.locator('[data-admin-module=convenios]').count(),1,'section-only assigned module');
    assert.equal(await page.locator('[data-admin-module=impersonation]').count(),0,'retained unauthorized view');
    assert.equal(await page.locator('[data-admin-module=roles]').count(),0,'unassigned module hidden');
    result.modules.sectionOnlyMenu=true;result.modules.directViewDenied=true;
    await page.evaluate(()=>window.AdminRepository.retry());
    await page.waitForFunction(()=>window.AdminRepository.getState().phase==='authorized'&&window.AdminRepository.getState().assignment.fullAccess===true,null,{timeout:15000});
    const normal=await token(values,'H005_TEST3'),assignments=await rpc(values,'list_admin_assignments',normal),search=await rpc(values,'search_affiliates_for_impersonation',normal,{p_query:'00'});
    assert(assignments.status>=400,'normal user listed admins');assert(search.status>=400,'normal user searched impersonation');result.security={normalAssignmentDenied:true,normalImpersonationDenied:true};
    assert.deepEqual(result.pageErrors,[]);result.status='PASS';console.log(JSON.stringify(result));
  }finally{if(browser)await browser.close().catch(()=>{});if(server){if(server.closeAllConnections)server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
main().catch(error=>{console.error(JSON.stringify({status:'FAIL',error:error.stack||error.message}));process.exitCode=1;});
