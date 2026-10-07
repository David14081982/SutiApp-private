'use strict';
// Authenticated read-only publication check. No document saves, issuance, screenshots,
// identities, bearer tokens, signed URLs, PDF contents or signature images are logged.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/document-assignment-fix');
const target=process.argv[2]||'https://sutiapp.com/';
const expected=JSON.parse(fs.readFileSync(path.join(out,'build.json'),'utf8'));
const report={status:'FAIL',target,checkedAt:new Date().toISOString(),businessWritesAllowed:0,realDataScreenshots:false,privateContentLogged:false,viewports:[],blockedRequests:[],authenticatedReadCounts:{}};
let stage='initialization';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const readRpc=new Set(['get_current_affiliate_access_state','get_effective_affiliate_id','get_impersonation_context','get_admin_access_context','get_admin_refresh_context','get_current_company_access','get_affiliate_activation_status','get_self_request_push_config','get_self_request_push_status','list_self_request_event_notifications','get_self_savings_if_changed','list_admin_module_catalog','list_admin_assignments','get_admin_user_modules','list_admin_section_definitions','list_paid_company_ids']);
const countRead=key=>{report.authenticatedReadCounts[key]=(report.authenticatedReadCounts[key]||0)+1;};
const safeOperation=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value)?value:'UNKNOWN';
async function main(){
 let browser;
 try{
  stage='credentials';
  const envFile=[process.env.SUTIAPP_ENV_FILE,path.join(root,'supabase.env'),path.resolve(root,'../../..','supabase.env')].find(p=>p&&fs.existsSync(p));if(!envFile)throw Error('CONTROLLED_CREDENTIALS_UNAVAILABLE');
  const env={};for(const line of fs.readFileSync(envFile,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
  if(!env.H005_TEST_EMAIL||!env.H005_TEST_PASSWORD||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)throw Error('CONTROLLED_CREDENTIALS_UNAVAILABLE');
  assert.equal(new URL(target).origin,'https://sutiapp.com','UNRECOGNIZED_PUBLICATION_ORIGIN');
  const supabaseOrigin=new URL(env.SUPABASE_URL).origin;assert.equal(new URL(supabaseOrigin).protocol,'https:','INSECURE_AUTH_ORIGIN');
  stage='published_artifacts';
  const response=await fetch(target,{cache:'no-store'});assert(response.ok,'PUBLICATION_HTTP_FAILED');const html=await response.text(),bundlePath=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(bundlePath,'app/bundle.js?v='+expected.version,'PUBLISHED_VERSION_MISMATCH');
  const bundle=await fetch(new URL(bundlePath,target),{cache:'no-store'});assert(bundle.ok,'BUNDLE_HTTP_FAILED');const digest=sha(Buffer.from(await bundle.arrayBuffer()));assert.equal(digest,expected.bundleSha||expected.bundleSha256,'PUBLISHED_BUNDLE_MISMATCH');
  const sw=await fetch(new URL('sw.js?v='+expected.version,target),{cache:'no-store'});assert(sw.ok,'WORKER_HTTP_FAILED');assert((await sw.text()).includes('sutiapp-v'+expected.version),'PUBLISHED_WORKER_MISMATCH');report.version=expected.version;report.bundleSha256=digest;
  stage='trusted_project_mapping';const configResponse=await fetch(new URL('app/supabase-config.js',target),{cache:'no-store'});assert(configResponse.ok,'PUBLIC_CONFIG_UNAVAILABLE');const publicConfig=await configResponse.text(),urlLiteral=/\burl\s*:\s*("(?:[^"\\]|\\.)*")/.exec(publicConfig)?.[1],keyLiteral=/\bpublishableKey\s*:\s*("(?:[^"\\]|\\.)*")/.exec(publicConfig)?.[1];assert(urlLiteral&&keyLiteral,'PUBLIC_CONFIG_INVALID');assert.equal(JSON.parse(urlLiteral).replace(/\/$/,''),env.SUPABASE_URL.replace(/\/$/,''),'PUBLIC_PROJECT_ORIGIN_MISMATCH');assert.equal(JSON.parse(keyLiteral),env.SUPABASE_PUBLISHABLE_KEY,'PUBLIC_PROJECT_KEY_MISMATCH');report.configuredProjectMatchesPublished=true;
  // ADR-019 and SECURITY_RULES H-005/H-008 authorize the owner's controlled QA
  // identity. Password goes only to the exact configured Supabase origin, never
  // into the deployed page DOM. No service/admin key is used.
  stage='controlled_supabase_login';const authResponse=await fetch(supabaseOrigin+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});if(!authResponse.ok)throw Error('CONTROLLED_AUTH_FAILED');const session=await authResponse.json();assert(session.access_token&&session.refresh_token,'CONTROLLED_AUTH_SESSION_MISSING');report.authentication='controlled QA; configured Supabase origin; password never passed to webpage';
  stage='browser_launch';browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,timeout:30000,args:['--no-first-run','--disable-extensions']});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(30000);
   let pageErrorCount=0,documentMutationAttempts=0,dashboard=null;const viewport={width,status:'FAIL'};report.viewports.push(viewport);
   page.on('pageerror',()=>pageErrorCount++);
   page.on('response',async response=>{try{if(!response.url().includes('/rest/v1/rpc/document_generation_command'))return;const body=response.request().postDataJSON();if(body?.p_action!=='DASHBOARD'||!response.ok())return;const data=await response.json(),assignment=data.layout_assignments?.find(a=>a.program==='membership'&&a.document_type==='MEMBERSHIP_APPROVAL'&&!a.fund_key),config=data.configurations?.find(c=>c.program==='membership'&&c.document_type==='MEMBERSHIP_APPROVAL');dashboard={assignment,config,canConfigure:data.permissions?.['config.write']===true};}catch(_){}});
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();if((/^\/(?:auth|rest|functions|storage)\/v1\//.test(url.pathname)||request.headers().authorization)&&url.origin!==supabaseOrigin){report.blockedRequests.push({width,kind:'unexpected_credential_origin',operation:'ORIGIN_DENIED'});return route.abort();}if(['GET','HEAD','OPTIONS'].includes(method))return route.continue();
    let body={};try{body=request.postDataJSON()||{};}catch(_){}
    if(url.origin===supabaseOrigin&&url.pathname==='/auth/v1/token'&&method==='POST'&&url.searchParams.get('grant_type')==='refresh_token')return route.continue();
    let operation='UNKNOWN',kind='non_read_http';
    if(url.pathname.startsWith('/rest/v1/rpc/')){
     operation=safeOperation(url.pathname.split('/').pop());kind='rpc';
     if(operation==='document_generation_command'){
      operation=safeOperation(body.p_action);kind='document_command';
      if(['DASHBOARD','LIST'].includes(operation)){countRead('document:'+operation);return route.continue();}
      documentMutationAttempts++;
     }else if(readRpc.has(operation)){countRead('rpc:'+operation);return route.continue();}
    }else if(url.pathname==='/functions/v1/document-generation'){
     operation=safeOperation(body.action);kind='document_edge';
     if(['ASSET_ACCESS','LAYOUT_CONFIGURE_PREVIEW'].includes(operation)){countRead('edge:'+operation);return route.continue();}
     documentMutationAttempts++;
    }else if(url.pathname.startsWith('/storage/v1/object/sign/')){countRead('storage:sign_read');return route.continue();}
    else if(url.pathname.startsWith('/functions/v1/')){kind='other_edge';operation=safeOperation(url.pathname.split('/').pop())+':'+safeOperation(body.action);}
    else if(url.pathname.startsWith('/rest/v1/')){kind='table_write';operation=safeOperation(url.pathname.split('/')[3]);}
    report.blockedRequests.push({width,kind,operation});return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'READ_ONLY_VERIFICATION',message:'Blocked by read-only publication verification'})});
   });
   const enterDocuments=async()=>{
    const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
    const module=page.locator('[data-admin-module="document_generation"]'),screen=page.locator('[data-admin-view="document_generation"]');
    if(!await screen.isVisible().catch(()=>false)&&!await module.isVisible().catch(()=>false)){
     const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.isVisible().catch(()=>false))await admin.click();
     else{const shortcut=page.getByRole('button',{name:'Ir al Panel Administrativo',exact:true});if(await shortcut.isVisible().catch(()=>false))await shortcut.click();}
    }
    await page.waitForFunction(()=>['[data-admin-module="document_generation"]','[data-admin-view="document_generation"]'].some(selector=>[...document.querySelectorAll(selector)].some(node=>node.getClientRects().length)));
    if(!await screen.isVisible()){if(await module.getAttribute('aria-disabled')==='true')throw Error('DOCUMENT_ADMIN_CAPABILITY_UNAVAILABLE');await module.click();}await screen.locator('h1').waitFor();
    await page.waitForFunction(()=>{const name=document.querySelector('.df-active__t')?.textContent;return Boolean(name&&name!=='Sin plantilla activa');});
    await page.getByRole('navigation',{name:'Secciones'}).getByRole('button',{name:/^Firmas por programa/}).click();
   };
   const membership=()=>page.locator('.df-pr').filter({has:page.locator('.df-pr__n',{hasText:/^Membresías$/})});
   try{
    stage='session_'+width;await page.goto(target,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SutiSupabase?.isConfigured());const sessionReady=await page.evaluate(async tokens=>{const result=await window.SutiSupabase.getClient().auth.setSession(tokens);return !result.error;},{access_token:session.access_token,refresh_token:session.refresh_token});assert(sessionReady,'BROWSER_SESSION_UNAVAILABLE');await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
    stage='document_navigation_'+width;await enterDocuments();await page.waitForFunction(()=>[...document.querySelectorAll('.df-pr')].some(n=>n.querySelector('.df-pr__n')?.textContent==='Membresías'&&n.querySelector('.df-pr__tpl')?.textContent.includes('Solicitudes de préstamo')));
    assert(dashboard?.assignment,'ASSIGNMENT_METADATA_UNAVAILABLE');assert(dashboard.canConfigure,'DOCUMENT_ADMIN_CAPABILITY_UNAVAILABLE');assert.equal(dashboard.assignment.template_name.trim(),'Solicitudes de préstamo');assert.equal(dashboard.assignment.layout_version,2);viewport.effectiveCard='PASS';viewport.membershipLayoutVersion=dashboard.assignment.layout_version;
    stage='configuration_'+width;await membership().getByRole('button',{name:'Configurar',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Configurar · Membresías'}),select=dialog.locator('label').filter({has:page.locator('.df-field__l',{hasText:/^Plantilla$/})}).locator('select');assert.equal(await select.inputValue(),dashboard.assignment.template_id,'CONFIG_EFFECTIVE_TEMPLATE_MISMATCH');assert.match(await select.locator('option:checked').innerText(),/Solicitudes de préstamo/);viewport.configurationSameTemplate='PASS';
    viewport.actionsInsideViewport=await dialog.locator('.df-ov__f button').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight;}));assert(viewport.actionsInsideViewport,'CONFIG_ACTIONS_OUTSIDE_VIEWPORT');
    stage='synthetic_preview_'+width;const previewResponse=page.waitForResponse(response=>{if(response.request().method()!=='POST'||!response.url().endsWith('/functions/v1/document-generation'))return false;try{return response.request().postDataJSON().action==='LAYOUT_CONFIGURE_PREVIEW';}catch(_){return false;}});await dialog.getByRole('button',{name:'Vista previa',exact:true}).click();const pdfResponse=await previewResponse,request=pdfResponse.request().postDataJSON();viewport.previewRequestChecks={httpStatus:pdfResponse.status(),programMatches:request.program==='membership',typeMatches:request.document_type==='MEMBERSHIP_APPROVAL',generalScope:request.fund_key==='',templateMatches:request.template_id===dashboard.assignment.template_id,assignmentMatches:request.expected_assignment_id===dashboard.assignment.id,configurationMatches:request.expected_configuration_id===dashboard.config.id};assert(pdfResponse.ok(),'PREVIEW_HTTP_FAILED');assert.equal(request.program,'membership','PREVIEW_PROGRAM_MISMATCH');assert.equal(request.document_type,'MEMBERSHIP_APPROVAL','PREVIEW_TYPE_MISMATCH');assert.equal(request.fund_key,'','PREVIEW_FUND_MISMATCH');assert.equal(request.template_id,dashboard.assignment.template_id,'PREVIEW_TEMPLATE_MISMATCH');assert.equal(request.expected_assignment_id,dashboard.assignment.id,'PREVIEW_ASSIGNMENT_MISMATCH');assert.equal(request.expected_configuration_id,dashboard.config.id,'PREVIEW_CONFIGURATION_MISMATCH');const pdf=Buffer.from(await pdfResponse.body());viewport.previewTransport={bytes:pdf.length,headerIsPdf:pdf.subarray(0,5).toString()==='%PDF-',contentType:pdfResponse.headers()['content-type'],contentEncoding:pdfResponse.headers()['content-encoding']||null};
    const preview=page.getByRole('dialog',{name:'Vista previa del documento'});await preview.waitFor();const browserPdf=await preview.locator('iframe').evaluate(async iframe=>{const response=await fetch(iframe.src),bytes=new Uint8Array(await response.arrayBuffer());return {isPdf:String.fromCharCode(...bytes.subarray(0,5))==='%PDF-',bytes:bytes.length,contentType:response.headers.get('content-type')};});viewport.browserPreview=browserPdf;
    // Chrome may expose an empty CDP PDF response body. Always validate the actual
    // Blob consumed by the application's iframe; retain transport availability.
    viewport.previewTransport.cdpBodyAvailable=pdf.length>0;if(pdf.length)assert(viewport.previewTransport.headerIsPdf,'PREVIEW_PDF_INVALID');assert(browserPdf.isPdf,'BROWSER_PREVIEW_PDF_INVALID');assert(browserPdf.bytes>1000,'PREVIEW_PDF_EMPTY');assert.match(browserPdf.contentType,/application\/pdf/,'BROWSER_PREVIEW_MIME_INVALID');viewport.syntheticPreview={status:'PASS',bytes:browserPdf.bytes,contentType:browserPdf.contentType};await preview.getByRole('button',{name:'Cerrar',exact:true}).last().click();await dialog.waitFor();assert.equal(await select.inputValue(),dashboard.assignment.template_id);await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();viewport.previewClose='PASS';
    stage='refresh_'+width;await page.getByRole('region',{name:'Documentos recientes'}).getByRole('button',{name:'Actualizar',exact:true}).click();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});await enterDocuments();assert.match(await membership().locator('.df-pr__tpl').innerText(),/Solicitudes de préstamo/);assert.equal(await page.locator('script[src*="app/bundle.js?v="]').getAttribute('src'),'app/bundle.js?v='+expected.version);viewport.refresh='PASS';
    assert.equal(documentMutationAttempts,0,'UNEXPECTED_DOCUMENT_MUTATION');assert.equal(pageErrorCount,0,'BROWSER_ERRORS');viewport.pageErrorCount=pageErrorCount;viewport.documentMutationAttempts=documentMutationAttempts;viewport.status='PASS';
   }finally{await context.close();}
  }
  report.status='PASS';
 }catch(error){const firstLine=String(error.message||'').split('\n')[0];report.failure={stage,code:/^[A-Z][A-Z0-9_]+$/.test(firstLine)?firstLine:'LIVE_CHECK_FAILED',kind:error.name};process.exitCode=1;}
 finally{if(browser)await browser.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'live-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
}
main();
