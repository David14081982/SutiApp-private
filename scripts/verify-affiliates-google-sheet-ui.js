'use strict';
// H-AFFILIATES-GOOGLE-SHEET-001 UI contract on the local build. The Edge Function and Google are stubbed at the
// network layer, so this run never writes the spreadsheet; any Supabase write request fails the run.
const assert=require('assert').strict;
const fs=require('fs');
const http=require('http');
const path=require('path');
const root=path.resolve(__dirname,'..');
// Serve the output of scripts/build-pages-site.js (exact Pages bytes: LF vendor files + generated supabase-config.js).
const site=path.resolve(process.argv[2]||path.join(root,'_site'));
const evidenceDir=path.join(root,'docs','qa','evidence','affiliates-google-sheet-20261119');
const chromePath='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SHEET='https://docs.google.com/spreadsheets/d/1a9Qc8Zu2OZGNsCWCwOkWClCJfYvDem4Zlio3GNK1SLA/edit';
function loadPlaywright(){for(const candidate of [process.env.SUTIAPP_PLAYWRIGHT_PATH,'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core'].filter(Boolean)){try{return require(candidate);}catch(_){}}throw new Error('Playwright Core no disponible');}
function env(){const file=process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'),out={};for(const raw of fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#')||!line.includes('='))continue;const at=line.indexOf('=');out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
function serve(port){const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};const server=http.createServer((request,response)=>{const pathname=new URL(request.url,`http://127.0.0.1:${port}`).pathname,relative=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1)),file=path.resolve(site,relative);if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);});return new Promise((resolve)=>server.listen(port,'127.0.0.1',()=>resolve(server)));}

async function main(){
  const values=env();['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','H005_TEST_EMAIL','H005_TEST_PASSWORD'].forEach((key)=>assert(values[key],key+' missing'));fs.mkdirSync(evidenceDir,{recursive:true});
  const result={status:'FAIL',browser:'Chrome',toolbar:{},flows:{},layout:{},supabaseWrites:[],functionCalls:[],pageErrors:[]};let browser,server;
  let stub={status:200,body:{status:'OK',rows:719,sheet_gid:123456,refreshed_at:'2026-11-19T20:00:00.000Z'}};
  try{
    server=await serve(8080);const{chromium}=loadPlaywright();
    browser=await chromium.launch({headless:true,executablePath:chromePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check']});
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route(/supabase\.co\/functions\/v1\/affiliates-google-sheet/,async(route)=>{const request=route.request();result.functionCalls.push(request.method());if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});return route.fulfill({status:stub.status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(stub.body)});});
    await context.route(/docs\.google\.com/,(route)=>route.fulfill({status:200,contentType:'text/html',body:'<title>Google Sheets stub</title>stub'}));
    const page=await context.newPage();
    page.on('pageerror',(error)=>result.pageErrors.push(error.message));
    page.on('request',(request)=>{const url=request.url(),method=request.method();if(!/supabase\.co\/(rest|storage)\/v1/.test(url))return;if(method==='GET'||method==='HEAD'||method==='OPTIONS')return;if(method==='POST'&&/\/rest\/v1\/rpc\/(get_|list_|has_|admin_session|is_)/.test(url))return;if(method==='POST'&&/\/storage\/v1\/object\/sign\//.test(url))return;/* signed read URLs for profile photos */result.supabaseWrites.push(method+' '+url.replace(/\?.*$/,''));});
    await page.goto('http://localhost:8080/',{waitUntil:'domcontentloaded'});
    await page.locator('input[type="email"]').fill(values.H005_TEST_EMAIL);await page.locator('input[type="password"]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type="submit"]').click();
    await page.waitForFunction(()=>window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated',null,{timeout:30000});
    const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.evaluate((node)=>node.click());
    await page.waitForFunction(()=>window.AdminRepository&&window.AdminRepository.getState().phase==='authorized',null,{timeout:30000});
    await page.waitForSelector('[data-admin-view="menu"]',{timeout:30000});await page.locator('[data-admin-module="affiliates"]').evaluate((node)=>node.click());
    await page.waitForSelector('[data-admin-affiliates="ready"]',{timeout:30000});await page.waitForTimeout(600);

    const actions=page.locator('.aff-toolbar-actions button');
    result.toolbar.buttons=(await actions.allTextContents()).map((text)=>text.trim());
    assert.deepEqual(result.toolbar.buttons.filter((text)=>/Exportar Excel|Abrir en Google Sheets/.test(text)),['Exportar Excel','Abrir en Google Sheets']);
    assert.equal(result.toolbar.buttons.indexOf('Abrir en Google Sheets'),result.toolbar.buttons.indexOf('Exportar Excel')+1);
    await page.locator('.aff-toolbar').screenshot({path:path.join(evidenceDir,'toolbar-1440.png')});

    const sheetButton=page.getByRole('button',{name:/Abrir en Google Sheets/});
    const [popup]=await Promise.all([context.waitForEvent('page'),sheetButton.click()]);
    await popup.waitForURL(/docs\.google\.com/,{timeout:15000});
    result.flows.success={openedUrl:popup.url(),toast:await page.locator('text=Hoja actualizada').first().textContent({timeout:5000})};
    assert.equal(result.flows.success.openedUrl,SHEET+'#gid=123456');assert.match(result.flows.success.toast,/Hoja actualizada: 719 afiliados SUTISSSTESON/);
    assert.equal(await sheetButton.isEnabled(),true);await popup.close();

    stub={status:502,body:{error:'GOOGLE_ACCESS_DENIED'}};await page.waitForTimeout(3200);
    const [failedPopup]=await Promise.all([context.waitForEvent('page'),sheetButton.click()]);
    await failedPopup.waitForEvent('close',{timeout:15000});
    result.flows.accessDenied={popupClosed:failedPopup.isClosed(),toast:await page.locator('text=no está compartida como Editor').first().textContent({timeout:5000})};
    assert.equal(result.flows.accessDenied.popupClosed,true);

    await page.locator('.aff-view-switch button',{hasText:'Eliminados'}).click();await page.waitForTimeout(500);
    result.toolbar.archiveViewButtons=await page.getByRole('button',{name:/Abrir en Google Sheets/}).count();assert.equal(result.toolbar.archiveViewButtons,0);
    await page.locator('.aff-view-switch button',{hasText:'Afiliados'}).click();await page.waitForSelector('[data-admin-affiliates="ready"]');

    for(const [width,height] of [[390,844],[768,1024]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(400);
      const box=await page.locator('.aff-toolbar-actions').boundingBox();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      result.layout[width]={overflowPx:overflow,actionsWidth:Math.round(box.width)};assert(overflow<=0,'horizontal overflow at '+width);
      await page.locator('.aff-toolbar').screenshot({path:path.join(evidenceDir,`toolbar-${width}.png`)});
    }
    assert.deepEqual(result.supabaseWrites,[]);assert.deepEqual(result.pageErrors,[]);
    assert.deepEqual(result.functionCalls.filter((method)=>method==='POST'),['POST','POST']);
    result.status='PASS';
  }finally{if(browser)await browser.close().catch(()=>{});if(server){if(server.closeAllConnections)server.closeAllConnections();await new Promise((resolve)=>server.close(resolve));}fs.writeFileSync(path.join(evidenceDir,'ui-contract.json'),JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify(result,null,2));
}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.stack||error.message}));process.exitCode=1;});
