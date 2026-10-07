'use strict';
// Controlled authenticated READ-ONLY verification. Only synthetic-preview canvas
// pixels may be captured. No issued-document access, business writes or secrets logged.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/document-preview-render');
const target=process.argv[2]==='--target'?process.argv[3]:process.argv[2]||'https://sutiapp.com/';
const report={status:'FAIL',checkedAt:new Date().toISOString(),businessWritesAllowed:0,issuedDocumentAccessAllowed:0,realDataScreenshots:false,screenshotScope:'synthetic preview canvas only',privateContentLogged:false,viewports:[],blockedRequests:[],authenticatedReadCounts:{}};
const readRpc=new Set(['get_current_affiliate_access_state','get_effective_affiliate_id','get_impersonation_context','get_admin_access_context','get_admin_refresh_context','get_current_company_access','get_affiliate_activation_status','get_self_request_push_config','get_self_request_push_status','list_self_request_event_notifications','get_self_savings_if_changed','list_admin_module_catalog','list_admin_assignments','get_admin_user_modules','list_admin_section_definitions','list_paid_company_ids']);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const safeOperation=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value)?value:'UNKNOWN';
const countRead=key=>{report.authenticatedReadCounts[key]=(report.authenticatedReadCounts[key]||0)+1;};
const get=async url=>fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});
let stage='initialization',mode='live';

// Return counts/fingerprints only. Never export a PDF, text extraction or surrounding UI.
async function canvasEvidence(canvas){
 return canvas.evaluate(node=>{
  const {width,height}=node,rgba=node.getContext('2d').getImageData(0,0,width,height).data,colors=new Set();
  let opaque=0,ink=0,chromatic=0,fingerprint=2166136261;
  for(let i=0;i<rgba.length;i+=4){const r=rgba[i],g=rgba[i+1],b=rgba[i+2],a=rgba[i+3];if(a>240){opaque++;if(Math.min(r,g,b)<235)ink++;if(Math.max(r,g,b)-Math.min(r,g,b)>25)chromatic++;colors.add(((r>>5)<<6)|((g>>5)<<3)|(b>>5));}fingerprint=Math.imul(fingerprint^r,16777619);fingerprint=Math.imul(fingerprint^g,16777619);fingerprint=Math.imul(fingerprint^b,16777619);}
  const rect=node.getBoundingClientRect(),pixels=width*height;
  return {width,height,pixels,opaquePixels:opaque,inkPixels:ink,chromaticPixels:chromatic,quantizedColors:colors.size,opaqueRatio:opaque/pixels,inkRatio:ink/pixels,pixelFingerprint:(fingerprint>>>0).toString(16),rendered:node.dataset.rendered==='true',cssWidth:rect.width,cssHeight:rect.height};
 });
}
function assertPainted(value){
 assert(value.rendered&&value.width>=200&&value.height>=200,'CANVAS_NOT_RENDERED');
 assert(value.opaqueRatio>0.95,'CANVAS_TRANSPARENT');assert(value.inkPixels>100&&value.inkRatio>0.001&&value.inkRatio<0.8,'CANVAS_BLANK_OR_SOLID');assert(value.quantizedColors>=4,'CANVAS_COLOR_VARIATION_MISSING');
}
async function saveRasterBaseline(canvas){return canvas.evaluate(node=>{node.__sutiPreviewRasterBaseline={width:node.width,height:node.height,rgba:new Uint8Array(node.getContext('2d').getImageData(0,0,node.width,node.height).data)};});}
async function compareRasterBaseline(canvas){return canvas.evaluate(node=>{
 const baseline=node.__sutiPreviewRasterBaseline,current=node.getContext('2d').getImageData(0,0,node.width,node.height).data;if(!baseline||baseline.width!==node.width||baseline.height!==node.height)return {sameDimensions:false};
 let differentPixels=0,over8Pixels=0,over16Pixels=0,over32Pixels=0,over64Pixels=0,maxChannelDelta=0,absoluteRgbDelta=0,inkMaskDifference=0,alphaDifferences=0,minX=node.width,minY=node.height,maxX=-1,maxY=-1;
 for(let i=0;i<current.length;i+=4){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(current[i+c]-baseline.rgba[i+c]);delta=Math.max(delta,d);absoluteRgbDelta+=d;}if(current[i+3]!==baseline.rgba[i+3])alphaDifferences++;maxChannelDelta=Math.max(maxChannelDelta,delta);if(delta){differentPixels++;const p=i/4,x=p%node.width,y=Math.floor(p/node.width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}if(delta>8)over8Pixels++;if(delta>16)over16Pixels++;if(delta>32)over32Pixels++;if(delta>64)over64Pixels++;if((Math.min(current[i],current[i+1],current[i+2])<235)!==(Math.min(baseline.rgba[i],baseline.rgba[i+1],baseline.rgba[i+2])<235))inkMaskDifference++;}
 const pixels=node.width*node.height;return {sameDimensions:true,pixels,differentPixels,differentRatio:differentPixels/pixels,over8Pixels,over16Pixels,over32Pixels,over64Pixels,maxChannelDelta,meanAbsoluteRgbDelta:absoluteRgbDelta/(pixels*3),inkMaskDifference,alphaDifferences,differenceBounds:differentPixels?{minX,minY,maxX,maxY}:null};
});}
function assertReturnedRaster(first,returned,difference){
 // Measured live rerender: only 2/1,090,584 footer pixels changed by 1/255;
 // visible crop was byte-identical. Preserve content/alpha/ink exactly and allow
 // at most eight such rounding pixels. A different page cannot pass this gate.
 const limits={maxDifferentPixels:8,maxChannelDelta:1,inkMaskDifference:0,alphaDifferences:0};
 assertPainted(returned);assert(difference.sameDimensions,'PREVIOUS_PAGE_DIMENSIONS_MISMATCH');
 assert(difference.differentPixels<=limits.maxDifferentPixels&&difference.maxChannelDelta<=limits.maxChannelDelta&&difference.inkMaskDifference===0&&difference.alphaDifferences===0,'PREVIOUS_PAGE_PIXELS_MISMATCH');
 assert.equal(returned.inkPixels,first.inkPixels,'PREVIOUS_PAGE_INK_MISMATCH');assert.equal(returned.chromaticPixels,first.chromaticPixels,'PREVIOUS_PAGE_COLOR_MISMATCH');assert.equal(returned.quantizedColors,first.quantizedColors,'PREVIOUS_PAGE_PALETTE_MISMATCH');return limits;
}
async function captureCanvasOnly(page,canvas,width,number){
 // The visible intersection is strictly inside the canvas, its scroll container
 // and the viewport. Hit testing ensures no header, signer UI or overlay is captured.
 const clip=await canvas.evaluate(node=>{
  const rect=node.getBoundingClientRect(),scroll=node.closest('.dl-preview-scroll');if(!scroll)return null;const bounds=scroll.getBoundingClientRect();
  const x=Math.ceil(Math.max(0,rect.left,bounds.left))+2,y=Math.ceil(Math.max(0,rect.top,bounds.top))+2,right=Math.floor(Math.min(innerWidth,rect.right,bounds.right))-2,bottom=Math.floor(Math.min(innerHeight,rect.bottom,bounds.bottom))-2;
  if(right-x<80||bottom-y<80)return null;
  for(const [px,py] of [[x+1,y+1],[right-1,y+1],[x+1,bottom-1],[right-1,bottom-1],[(x+right)/2,(y+bottom)/2]])if(document.elementFromPoint(px,py)!==node)return null;
  return {x,y,width:right-x,height:bottom-y};
 });
 assert(clip,'CANVAS_SAFE_CROP_UNAVAILABLE');fs.mkdirSync(out,{recursive:true});
 const filename=`synthetic-${mode}-${width}-page-${number}.png`,bytes=await page.screenshot({path:path.join(out,filename),clip,animations:'disabled'});
 return {file:filename,sha256:sha(bytes),width:clip.width,height:clip.height,syntheticOnly:true,canvasOnly:true};
}
async function main(){
 let context=null,profile=null,profilesRoot=null;
 try{
  stage='target';const base=new URL(target);assert(!base.username&&!base.password&&!base.search&&!base.hash,'UNRECOGNIZED_TARGET');
  const local=base.protocol==='http:'&&base.hostname==='127.0.0.1'&&Boolean(base.port);assert(base.origin==='https://sutiapp.com'||local,'UNRECOGNIZED_PUBLICATION_ORIGIN');mode=local?'local':'live';report.target=base.origin+base.pathname;report.mode=mode;
  const expected=JSON.parse(fs.readFileSync(path.join(out,'build.json'),'utf8'));
  stage='credentials';const envFile=[process.env.SUTIAPP_ENV_FILE,path.join(root,'supabase.env'),path.resolve(root,'../../..','supabase.env')].find(p=>p&&fs.existsSync(p));if(!envFile)throw Error('CONTROLLED_CREDENTIALS_UNAVAILABLE');
  const env={};for(const line of fs.readFileSync(envFile,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
  if(!env.H005_TEST_EMAIL||!env.H005_TEST_PASSWORD||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)throw Error('CONTROLLED_CREDENTIALS_UNAVAILABLE');
  const supabaseOrigin=new URL(env.SUPABASE_URL).origin;assert.equal(new URL(supabaseOrigin).protocol,'https:','INSECURE_AUTH_ORIGIN');
  stage='candidate_artifacts';const response=await get(target);assert(response.ok,'PUBLICATION_HTTP_FAILED');const html=await response.text(),bundlePath=/src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];assert.equal(bundlePath,'app/bundle.js?v='+expected.version,'PUBLISHED_VERSION_MISMATCH');
  const bundle=await get(new URL(bundlePath,target));assert(bundle.ok,'BUNDLE_HTTP_FAILED');const digest=sha(Buffer.from(await bundle.arrayBuffer()));assert.equal(digest,expected.bundleSha||expected.bundleSha256,'PUBLISHED_BUNDLE_MISMATCH');
  const sw=await get(new URL('sw.js?v='+expected.version,target));assert(sw.ok,'WORKER_HTTP_FAILED');assert((await sw.text()).includes('sutiapp-v'+expected.version),'PUBLISHED_WORKER_MISMATCH');report.version=expected.version;report.bundleSha256=digest;
  stage='trusted_project_mapping';const configResponse=await get(new URL('app/supabase-config.js',target));assert(configResponse.ok,'PUBLIC_CONFIG_UNAVAILABLE');const publicConfig=await configResponse.text(),urlLiteral=/\burl\s*:\s*("(?:[^"\\]|\\.)*")/.exec(publicConfig)?.[1],keyLiteral=/\bpublishableKey\s*:\s*("(?:[^"\\]|\\.)*")/.exec(publicConfig)?.[1];assert(urlLiteral&&keyLiteral,'PUBLIC_CONFIG_INVALID');assert.equal(JSON.parse(urlLiteral).replace(/\/$/,''),env.SUPABASE_URL.replace(/\/$/,''),'PUBLIC_PROJECT_ORIGIN_MISMATCH');assert.equal(JSON.parse(keyLiteral),env.SUPABASE_PUBLISHABLE_KEY,'PUBLIC_PROJECT_KEY_MISMATCH');report.configuredProjectMatchesTarget=true;
  // Approved controlled QA identity: password goes only to exact configured
  // Supabase origin, never to the webpage DOM or loopback candidate server.
  stage='controlled_supabase_login';const authResponse=await fetch(supabaseOrigin+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD}),signal:AbortSignal.timeout(30000)});if(!authResponse.ok)throw Error('CONTROLLED_AUTH_FAILED');const session=await authResponse.json();assert(session.access_token&&session.refresh_token,'CONTROLLED_AUTH_SESSION_MISSING');report.authentication='controlled QA; exact configured Supabase origin; password never passed to webpage';
  profilesRoot=path.resolve(root,'.tmp/document-preview-render/native-off-profiles');fs.mkdirSync(profilesRoot,{recursive:true});profilesRoot=fs.realpathSync(profilesRoot);
  for(const width of [1440,390]){
   stage='native_pdf_disabled_'+width;profile=fs.mkdtempSync(path.join(profilesRoot,'chrome-'));fs.mkdirSync(path.join(profile,'Default'));fs.writeFileSync(path.join(profile,'Default/Preferences'),JSON.stringify({plugins:{always_open_pdf_externally:true}}));
   context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,timeout:30000,viewport:{width,height:950},serviceWorkers:'block',args:['--no-first-run','--disable-extensions']});
   const page=context.pages()[0]||await context.newPage();page.setDefaultTimeout(30000);
   let pageErrorCount=0,documentMutationAttempts=0,dashboard=null;const pdfModules=new Set(),viewport={width,status:'FAIL'};report.viewports.push(viewport);
   page.on('pageerror',()=>pageErrorCount++);
   page.on('response',async response=>{try{
    const url=new URL(response.url());if(url.origin===base.origin&&/\/app\/vendor\/pdfjs-[^/]+\/pdf(?:\.worker)?\.min\.mjs$/.test(url.pathname)&&response.ok())pdfModules.add(url.pathname.split('/').pop());
    if(!url.pathname.endsWith('/rest/v1/rpc/document_generation_command'))return;const body=response.request().postDataJSON();if(body?.p_action!=='DASHBOARD'||!response.ok())return;const data=await response.json(),assignment=data.layout_assignments?.find(a=>a.program==='membership'&&a.document_type==='MEMBERSHIP_APPROVAL'&&!a.fund_key),config=data.configurations?.find(c=>c.program==='membership'&&c.document_type==='MEMBERSHIP_APPROVAL');dashboard={assignment,config,canConfigure:data.permissions?.['config.write']===true};
   }catch(_){}});
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();if((/^\/(?:auth|rest|functions|storage)\/v1\//.test(url.pathname)||request.headers().authorization)&&url.origin!==supabaseOrigin){report.blockedRequests.push({width,kind:'unexpected_credential_origin',operation:'ORIGIN_DENIED'});return route.abort();}if(['GET','HEAD','OPTIONS'].includes(method))return route.continue();
    let body={};try{body=request.postDataJSON()||{};}catch(_){}
    if(url.origin===supabaseOrigin&&url.pathname==='/auth/v1/token'&&method==='POST'&&url.searchParams.get('grant_type')==='refresh_token')return route.continue();
    let operation='UNKNOWN',kind='non_read_http';
    if(url.pathname.startsWith('/rest/v1/rpc/')){operation=safeOperation(url.pathname.split('/').pop());kind='rpc';if(operation==='document_generation_command'){operation=safeOperation(body.p_action);kind='document_command';if(['DASHBOARD','LIST'].includes(operation)){countRead('document:'+operation);return route.continue();}documentMutationAttempts++;}else if(readRpc.has(operation)){countRead('rpc:'+operation);return route.continue();}}
    else if(url.pathname==='/functions/v1/document-generation'){operation=safeOperation(body.action);kind='document_edge';if(['ASSET_ACCESS','LAYOUT_CONFIGURE_PREVIEW'].includes(operation)){countRead('edge:'+operation);return route.continue();}documentMutationAttempts++;}
    else if(url.pathname.startsWith('/storage/v1/object/sign/')){countRead('storage:sign_read');return route.continue();}
    else if(url.pathname.startsWith('/functions/v1/')){kind='other_edge';operation=safeOperation(url.pathname.split('/').pop())+':'+safeOperation(body.action);}
    else if(url.pathname.startsWith('/rest/v1/')){kind='table_write';operation=safeOperation(url.pathname.split('/')[3]);}
    report.blockedRequests.push({width,kind,operation});return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'READ_ONLY_VERIFICATION',message:'Blocked by read-only preview verification'})});
   });
   const enterDocuments=async()=>{
    const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();const module=page.locator('[data-admin-module="document_generation"]'),screen=page.locator('[data-admin-view="document_generation"]');
    if(!await screen.isVisible().catch(()=>false)&&!await module.isVisible().catch(()=>false)){const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.isVisible().catch(()=>false))await admin.click();else{const shortcut=page.getByRole('button',{name:'Ir al Panel Administrativo',exact:true});if(await shortcut.isVisible().catch(()=>false))await shortcut.click();}}
    await page.waitForFunction(()=>['[data-admin-module="document_generation"]','[data-admin-view="document_generation"]'].some(selector=>[...document.querySelectorAll(selector)].some(node=>node.getClientRects().length)));if(!await screen.isVisible()){if(await module.getAttribute('aria-disabled')==='true')throw Error('DOCUMENT_ADMIN_CAPABILITY_UNAVAILABLE');await module.click();}await screen.locator('h1').waitFor();
    await page.waitForFunction(()=>{const name=document.querySelector('.df-active__t')?.textContent;return Boolean(name&&name!=='Sin plantilla activa');});await page.getByRole('navigation',{name:'Secciones'}).getByRole('button',{name:/^Firmas por programa/}).click();
   };
   const membership=()=>page.locator('.df-pr').filter({has:page.locator('.df-pr__n',{hasText:/^Membresías$/})});
   try{
    stage='session_'+width;await page.goto(target,{waitUntil:'domcontentloaded'});viewport.nativePdfViewerEnabled=await page.evaluate(()=>navigator.pdfViewerEnabled);assert.equal(viewport.nativePdfViewerEnabled,false,'NATIVE_PDF_VIEWER_NOT_DISABLED');await page.waitForFunction(()=>window.SutiSupabase?.isConfigured());
    const sessionReady=await page.evaluate(async tokens=>{const result=await window.SutiSupabase.getClient().auth.setSession(tokens);return !result.error;},{access_token:session.access_token,refresh_token:session.refresh_token});assert(sessionReady,'BROWSER_SESSION_UNAVAILABLE');await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
    stage='document_navigation_'+width;await enterDocuments();await page.waitForFunction(()=>[...document.querySelectorAll('.df-pr')].some(n=>n.querySelector('.df-pr__n')?.textContent==='Membresías'&&n.querySelector('.df-pr__tpl')?.textContent.includes('Solicitudes de préstamo')));
    assert(dashboard?.assignment&&dashboard.canConfigure,'ASSIGNMENT_METADATA_UNAVAILABLE');assert.equal(dashboard.assignment.template_name.trim(),'Solicitudes de préstamo','UNEXPECTED_MEMBERSHIP_TEMPLATE');assert.equal(dashboard.assignment.layout_version,2,'UNEXPECTED_MEMBERSHIP_LAYOUT');viewport.effectiveCard='PASS';
    stage='configuration_'+width;await membership().getByRole('button',{name:'Configurar',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Configurar · Membresías'}),select=dialog.locator('label').filter({has:page.locator('.df-field__l',{hasText:/^Plantilla$/})}).locator('select');assert.equal(await select.inputValue(),dashboard.assignment.template_id,'CONFIG_EFFECTIVE_TEMPLATE_MISMATCH');
    stage='synthetic_preview_'+width;const previewResponse=page.waitForResponse(response=>{if(response.request().method()!=='POST'||!response.url().endsWith('/functions/v1/document-generation'))return false;try{return response.request().postDataJSON().action==='LAYOUT_CONFIGURE_PREVIEW';}catch(_){return false;}});await dialog.getByRole('button',{name:'Vista previa',exact:true}).click();const pdfResponse=await previewResponse,request=pdfResponse.request().postDataJSON();assert(pdfResponse.ok(),'PREVIEW_HTTP_FAILED');assert.equal(request.program,'membership','PREVIEW_PROGRAM_MISMATCH');assert.equal(request.document_type,'MEMBERSHIP_APPROVAL','PREVIEW_TYPE_MISMATCH');assert.equal(request.fund_key,'','PREVIEW_FUND_MISMATCH');assert.equal(request.template_id,dashboard.assignment.template_id,'PREVIEW_TEMPLATE_MISMATCH');assert.equal(request.expected_assignment_id,dashboard.assignment.id,'PREVIEW_ASSIGNMENT_MISMATCH');assert.equal(request.expected_configuration_id,dashboard.config.id,'PREVIEW_CONFIGURATION_MISMATCH');viewport.syntheticPreviewRequest='PASS';
    const preview=page.getByRole('dialog',{name:'Vista previa del documento'});await preview.waitFor();assert.equal(await preview.locator('iframe,embed,object').count(),0,'NATIVE_PDF_ELEMENT_PRESENT');
    const canvas=preview.locator('.dl-pdf-preview canvas');await canvas.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('[role="dialog"][aria-label="Vista previa del documento"] .dl-pdf-preview canvas')?.dataset.rendered==='true');
    stage='source_and_pixels_'+width;const source=await preview.locator('a[download]').evaluate(async link=>{
     if(!link.href.startsWith('blob:'))return {blob:false};const response=await fetch(link.href),data=new Uint8Array(await response.arrayBuffer());const headerPdf=String.fromCharCode(...data.subarray(0,5))==='%PDF-';if(!headerPdf)return {blob:true,headerPdf:false};
     const byteLength=data.length,lib=await import(new URL('app/vendor/pdfjs-5.4.149/pdf.min.mjs',document.baseURI).href);lib.GlobalWorkerOptions.workerSrc=new URL('app/vendor/pdfjs-5.4.149/pdf.worker.min.mjs',document.baseURI).href;const task=lib.getDocument({data,isEvalSupported:false,enableXfa:false,useSystemFonts:true});try{const pdf=await task.promise;return {blob:true,headerPdf:true,bytes:byteLength,pageCount:pdf.numPages,contentType:response.headers.get('content-type')};}finally{await task.destroy();}
    });assert(source.blob&&source.headerPdf&&source.bytes>1000&&source.pageCount>=1,'PREVIEW_SOURCE_PDF_INVALID');assert.match(source.contentType,/application\/pdf/,'PREVIEW_SOURCE_MIME_INVALID');viewport.source=source;
    const counter=preview.locator('.dl-pdf-preview .dl-toolbar [role="status"]');assert.equal((await counter.innerText()).trim(),'Página 1 de '+source.pageCount,'PREVIEW_PAGE_COUNT_MISMATCH');const first=await canvasEvidence(canvas);assertPainted(first);await saveRasterBaseline(canvas);viewport.firstPage=first;viewport.screenshots=[await captureCanvasOnly(page,canvas,width,1)];
    const previous=preview.getByRole('button',{name:'Página anterior',exact:true}),next=preview.getByRole('button',{name:'Página siguiente',exact:true});assert(await previous.isDisabled(),'PREVIOUS_PAGE_BOUNDARY_INVALID');
    if(source.pageCount>1){stage='pagination_'+width;await next.click();await page.waitForFunction(()=>{const p=document.querySelector('[role="dialog"][aria-label="Vista previa del documento"] .dl-pdf-preview');return p?.querySelector('[role="status"]')?.textContent.trim().startsWith('Página 2 de ')&&p.querySelector('canvas')?.dataset.rendered==='true';});const second=await canvasEvidence(canvas);assertPainted(second);assert.notEqual(second.pixelFingerprint,first.pixelFingerprint,'NEXT_PAGE_PIXELS_UNCHANGED');viewport.secondPage=second;viewport.screenshots.push(await captureCanvasOnly(page,canvas,width,2));assert(!await previous.isDisabled(),'PREVIOUS_PAGE_UNAVAILABLE');await previous.click();await page.waitForFunction(()=>{const p=document.querySelector('[role="dialog"][aria-label="Vista previa del documento"] .dl-pdf-preview');return p?.querySelector('[role="status"]')?.textContent.trim().startsWith('Página 1 de ')&&p.querySelector('canvas')?.dataset.rendered==='true';});const returned=await canvasEvidence(canvas);viewport.returnedPage=returned;viewport.returnedRasterDifference=await compareRasterBaseline(canvas);viewport.screenshots.push(await captureCanvasOnly(page,canvas,width,'1-returned'));viewport.returnedRasterLimits=assertReturnedRaster(first,returned,viewport.returnedRasterDifference);viewport.pagination='PASS';}else{assert(await next.isDisabled(),'NEXT_PAGE_BOUNDARY_INVALID');viewport.pagination='NOT APPLICABLE — single-page source; both boundaries checked';}
    viewport.pdfModules=[...pdfModules].sort();assert(pdfModules.has('pdf.min.mjs')&&pdfModules.has('pdf.worker.min.mjs'),'LOCAL_PDFJS_MODULES_NOT_LOADED');
    stage='close_'+width;await preview.getByRole('button',{name:'Cerrar',exact:true}).last().click();await dialog.waitFor();assert.equal(await select.inputValue(),dashboard.assignment.template_id,'CLOSE_LOST_CONFIGURATION');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();viewport.previewClose='PASS';
    stage='refresh_'+width;await page.getByRole('region',{name:'Documentos recientes'}).getByRole('button',{name:'Actualizar',exact:true}).click();await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>navigator.pdfViewerEnabled),false,'NATIVE_PDF_VIEWER_CHANGED');await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});await enterDocuments();assert.match(await membership().locator('.df-pr__tpl').innerText(),/Solicitudes de préstamo/);assert.equal(await page.locator('script[src*="app/bundle.js?v="]').getAttribute('src'),'app/bundle.js?v='+expected.version);viewport.refresh='PASS';
    assert.equal(documentMutationAttempts,0,'UNEXPECTED_DOCUMENT_MUTATION');assert.equal(pageErrorCount,0,'BROWSER_ERRORS');viewport.pageErrorCount=pageErrorCount;viewport.documentMutationAttempts=documentMutationAttempts;viewport.status='PASS';
   }finally{await context.close();context=null;removeProfile();}
  }
  report.status='PASS';
 }catch(error){const firstLine=String(error.message||'').split('\n')[0],networkCode=String(error.cause?.code||'');report.failure={stage,code:/^[A-Z][A-Z0-9_]+$/.test(firstLine)?firstLine:'PREVIEW_RENDER_CHECK_FAILED',kind:error.name,...(/^[A-Z0-9_]{1,60}$/.test(networkCode)?{networkCode}:{})};process.exitCode=1;}
 finally{if(context)await context.close().catch(()=>{});if(profile)removeProfile();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,mode+'-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
 function removeProfile(){
  // Delete only this run's generated profile. It may contain the short QA session.
  const resolved=path.resolve(profile);assert(profilesRoot&&resolved.startsWith(profilesRoot+path.sep)&&path.basename(resolved).startsWith('chrome-'),'UNSAFE_PROFILE_CLEANUP');assert(!fs.lstatSync(resolved).isSymbolicLink(),'PROFILE_LINK_DENIED');fs.rmSync(resolved,{recursive:true,force:true,maxRetries:3,retryDelay:100});profile=null;
 }
}
main();
