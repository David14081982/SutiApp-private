'use strict';
// Authorized live UI uploads of the controlled affiliate's existing document.
// Every created version/object is retained. No DELETE, cleanup, service role or fixtures.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {environment}=require('./investors-db');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/document-upload-diagnosis');
const proofPath=path.join(root,'docs/qa/evidence/document-upload-regression/live-production.json');
const checkpointPath=path.join(privateDir,'live-upload-checkpoint-private.json');
const reason='H-AFFILIATE-DOCUMENT-UPLOAD-REGRESSION-001: verificacion autorizada sin borrar archivos';
const base='https://sutiapp.com/',hash=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const save=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const readRpc=new Set(['get_current_affiliate_access_state','get_effective_affiliate_id','get_impersonation_context','get_admin_access_context','get_admin_refresh_context','get_current_company_access','get_affiliate_activation_status','get_self_request_push_config','get_self_request_push_status','list_self_request_event_notifications','get_self_savings_if_changed','list_admin_module_catalog','list_admin_assignments','get_admin_user_modules','list_admin_section_definitions','list_paid_company_ids','list_admin_affiliates','get_admin_affiliate_workbench','list_admin_affiliate_documents','list_effective_affiliate_documents','resolve_effective_document_requirements','get_admin_affiliate_access_diagnosis','get_app_editorial','list_app_editorial_screens','list_app_editorial_segments','can_access_app_screen','list_company_commercial_requests','list_public_banners','list_self_marketplace_quote_notifications','list_voting_consultations']);
async function main(){
 assert(process.argv.includes('--execute-authorized-live'),'EXPLICIT_LIVE_EXECUTION_FLAG_REQUIRED');
 const env=environment(),controlled=readJson(path.join(privateDir,'controlled-account-private.json'));
 const source=controlled.documents.find(d=>d.code==='payroll_previous'&&d.mime_type==='image/jpeg');
 assert(source&&source.affiliate_id===controlled.affiliate,'CONTROLLED_SOURCE_DOCUMENT_REQUIRED');
 assert.equal(controlled.affiliate,controlled.configuredAffiliate,'CONTROLLED_ACCOUNT_MAPPING_MISMATCH');
 assert.equal(controlled.affiliate,env.H005_TEST_AFFILIATE_ID,'CONFIGURED_AFFILIATE_MISMATCH');
 const api=new URL(env.SUPABASE_URL).origin,affiliate=controlled.affiliate,typeId=source.document_type_id;
 assert.equal(new URL(api).protocol,'https:','SECURE_API_ORIGIN_REQUIRED');
 let checkpoint=fs.existsSync(checkpointPath)?readJson(checkpointPath):{createdAt:new Date().toISOString(),affiliate,typeId,sourceDocumentId:source.id,sourceSha256:source.content_sha256,steps:{}};
 if(fs.existsSync(checkpointPath))assert(process.argv.includes('--resume'),'CHECKPOINT_EXISTS_USE_EXPLICIT_RESUME');
 assert.equal(checkpoint.affiliate,affiliate);assert.equal(checkpoint.typeId,typeId);assert.equal(checkpoint.sourceDocumentId,source.id);
 for(const step of Object.values(checkpoint.steps))assert(['COMPLETE','REGISTERED'].includes(step.status)&&step.documentId&&step.assetId,'INCOMPLETE_UPLOAD_REQUIRES_RECONCILIATION');
 const proof={status:'FAIL',checkedAt:new Date().toISOString(),scope:'Actual published Admin general upload, per-document replacement and self-service replacement; controlled own JPEG retained',serviceWorkers:'blocked for complete request interception',authentication:'Controlled account; password sent only to configured Supabase Auth origin',productionDocumentDeletions:0,storageDeletesSent:0,privateContentLogged:false,screenshots:0,pdfLiveCoverage:'NOT_TESTED: no legitimate current PDF exists in controlled account; PDF coverage is the isolated database matrix; no production PDF upload claimed',crossAffiliateSnapshotVerification:'Recorded separately by parent verification',steps:[],blockedRequests:[],excludedBackgroundRequests:[],financialInitialization:'Excluded from this document test; loanSessionOpen is blocked before network, never mocked as successful',ownerVerification:'Server-side read-only verification is recorded separately; no frontend column grants added',pageErrors:0};
 let browser,stage='publication',activeStep=null,sourceBytes;
 const persist=()=>save(checkpointPath,checkpoint);
 try{
  const configResponse=await fetch(new URL('app/supabase-config.js',base),{cache:'no-store'});assert(configResponse.ok,'PUBLIC_CONFIG_UNAVAILABLE');
  const config=await configResponse.text(),urlLiteral=/\burl\s*:\s*("(?:[^"\\]|\\.)*")/.exec(config)?.[1],keyLiteral=/\bpublishableKey\s*:\s*("(?:[^"\\]|\\.)*")/.exec(config)?.[1];
  assert(urlLiteral&&keyLiteral,'PUBLIC_CONFIG_INVALID');assert.equal(new URL(JSON.parse(urlLiteral)).origin,api,'PUBLISHED_API_ORIGIN_MISMATCH');assert.equal(JSON.parse(keyLiteral),env.SUPABASE_PUBLISHABLE_KEY,'PUBLISHED_API_KEY_MISMATCH');
  stage='authentication';
  const auth=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});
  assert(auth.ok,'CONTROLLED_LOGIN_FAILED');const session=await auth.json();assert.equal(session.user.id,controlled.actor,'CONTROLLED_ACTOR_MISMATCH');
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-first-run','--disable-extensions']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',()=>proof.pageErrors++);
  page.on('dialog',async dialog=>{if(activeStep&&dialog.type()==='confirm'&&/^(¿Crear una nueva versión\?|¿Cargar este documento al expediente privado del afiliado\?)/.test(dialog.message()))await dialog.accept();else await dialog.dismiss();});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url()),method=request.method();
   const deny=code=>{
    proof.blockedRequests.push({stage,method,operation:code});
    let blockedBody={};try{blockedBody=request.postDataJSON()||{};}catch(_){}
    const action=typeof blockedBody.action==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(blockedBody.action)?blockedBody.action:null;
    checkpoint.blockedRequests=checkpoint.blockedRequests||[];checkpoint.blockedRequests.push({at:new Date().toISOString(),stage,method,operation:code,origin:url.origin,path:url.pathname,action});persist();
    return route.abort('blockedbyclient');
   };
   if((/^\/(auth|rest|functions|storage)\/v1\//.test(url.pathname)||request.headers().authorization)&&url.origin!==api)return deny('UNTRUSTED_API_ORIGIN');
   if(['DELETE','PUT','PATCH'].includes(method))return deny('DESTRUCTIVE_HTTP');
   if(['GET','HEAD','OPTIONS'].includes(method))return route.continue();
   if(method==='POST'&&url.origin===new URL(base).origin&&url.pathname==='/cdn-cgi/rum'){proof.excludedBackgroundRequests.push({stage,method,operation:'site-telemetry:cdn-cgi/rum',sent:false});return route.abort('blockedbyclient');}
   if(url.origin!==api||method!=='POST')return deny('NON_ALLOWLISTED_MUTATION');
   let body={};try{body=request.postDataJSON()||{};}catch(_){}
   if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='refresh_token')return route.continue();
   // Published TopBar invokes this when Ver app opens home. Keep financial initialization outside this test.
   if(url.pathname==='/functions/v1/financial-legacy'&&body.action==='loanSessionOpen'){proof.excludedBackgroundRequests.push({stage,method,operation:'financial-legacy:loanSessionOpen',sent:false});return route.abort('blockedbyclient');}
   if(url.pathname.startsWith('/storage/v1/object/sign/'))return route.continue();
   if(url.pathname==='/functions/v1/document-access'&&['ADMIN','SELF_SERVICE'].includes(body.mode))return route.continue();
   const op=url.pathname.split('/').pop();
   if(url.pathname.startsWith('/rest/v1/rpc/')&&readRpc.has(op))return route.continue();
   if(activeStep&&url.pathname.startsWith('/storage/v1/object/private-assets/')){
    const objectPath=decodeURIComponent(url.pathname.slice('/storage/v1/object/private-assets/'.length));
    if(!new RegExp('^affiliate-documents/'+affiliate+'/[a-f0-9-]+\\.jpg$').test(objectPath)||request.headers()['x-upsert']==='true')return deny('STORAGE_PATH_OR_UPSERT_DENIED');
    if(checkpoint.steps[activeStep])return deny('DUPLICATE_STEP_DISPATCH');
    checkpoint.steps[activeStep]={status:'DISPATCHED',path:objectPath,startedAt:new Date().toISOString()};persist();return route.continue();
   }
   if(activeStep&&url.pathname==='/rest/v1/rpc/'+(activeStep==='selfReplacement'?'register_affiliate_document':'register_admin_affiliate_document')){
    const step=checkpoint.steps[activeStep];
    if(!step||body.p_storage_path!==step.path||body.p_document_type_id!==typeId||body.p_mime_type!=='image/jpeg'||body.p_file_size!==sourceBytes.length||String(body.p_sha256).toUpperCase()!==hash(sourceBytes))return deny('UPLOAD_RPC_ARGUMENT_MISMATCH');
    if(activeStep==='selfReplacement'?body.p_source!=='FILE':body.p_affiliate_id!==affiliate||body.p_reason!==reason)return deny('UPLOAD_RPC_OWNER_OR_REASON_MISMATCH');
    if(step.rpcDispatched)return deny('DUPLICATE_REGISTRATION_DISPATCH');
    step.rpcDispatched=true;persist();return route.continue();
   }
   return deny('NON_ALLOWLISTED_'+op.replace(/[^A-Za-z0-9_-]/g,'').slice(0,70));
  });
  stage='browser_session';await page.goto(base+'#/admin/menu',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SutiSupabase?.getClient);
  const installed=await page.evaluate(async tokens=>{const r=await SutiSupabase.getClient().auth.setSession(tokens);return !r.error;},{access_token:session.access_token,refresh_token:session.refresh_token});assert(installed,'SESSION_INSTALL_FAILED');
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
  await page.waitForFunction(()=>window.AdminRepository?.getState().phase==='authorized',null,{timeout:60000});
  const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
  const identity=await page.evaluate(async()=>{const r=await SutiSupabase.getClient().rpc('get_effective_affiliate_id');if(r.error)throw Error('IDENTITY_LOOKUP_FAILED');return r.data;});assert.equal(identity,affiliate,'EFFECTIVE_AFFILIATE_MISMATCH');
  proof.bundleSha256=await page.evaluate(async()=>{const src=document.querySelector('script[src*="app/bundle.js"]').src;const r=await fetch(src,{cache:'no-store'});return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');});
  const ownDocs=()=>page.evaluate(()=>DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_EXPEDIENTE'));
  const before=await ownDocs();assert(before.some(d=>d.id===source.id&&d.available),'LEGITIMATE_SOURCE_UNAVAILABLE');
  if(!checkpoint.baselineDocuments){checkpoint.baselineDocuments=before;persist();}
  stage='source_bytes';
  const preview=await page.evaluate(async id=>{const docs=await DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_EXPEDIENTE');return DocumentWorkflowRepository.selfPreview(docs.find(d=>d.id===id),'SELF_SERVICE_EXPEDIENTE');},source.id);
  const download=await fetch(preview.signedUrl,{redirect:'error'});assert(download.ok,'SOURCE_DOWNLOAD_FAILED');sourceBytes=Buffer.from(await download.arrayBuffer());
  assert.equal(sourceBytes.length,Number(source.file_size),'SOURCE_SIZE_CHANGED');assert.equal(hash(sourceBytes),source.content_sha256.toUpperCase(),'SOURCE_HASH_CHANGED');assert(sourceBytes.length<=2500*1024,'SOURCE_WOULD_BE_COMPRESSED');
  const file={name:'expediente-verificacion.jpg',mimeType:'image/jpeg',buffer:sourceBytes};
  const openAdmin=async()=>{
   stage='admin_navigation';
   await page.goto(base+'#/admin/affiliates',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AdminRepository?.getState().phase==='authorized',null,{timeout:60000});
   const details=await page.evaluate(id=>AdminAffiliatesRepository.detail(id),affiliate);const search=page.getByRole('textbox',{name:'Buscar afiliados'});await search.fill(String(details.profile.numero_control));
   await page.locator('[data-affiliate-row="'+affiliate+'"]').click();await page.locator('[data-admin-affiliate-detail="'+affiliate+'"]').waitFor();await page.getByRole('button',{name:'Expediente',exact:true}).click();
  };
  const verifyDocument=async step=>{
   const docs=await ownDocs(),doc=docs.find(d=>d.id===step.documentId);assert(doc&&doc.affiliate_id===affiliate&&doc.document_type_id===typeId,'UPLOADED_DOCUMENT_NOT_VISIBLE');assert.equal(doc.private_asset_id,step.assetId);assert.equal(doc.sha256?.toUpperCase(),hash(sourceBytes));
   const signed=await page.evaluate(async id=>{const d=(await DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_EXPEDIENTE')).find(x=>x.id===id);return DocumentWorkflowRepository.selfPreview(d,'SELF_SERVICE_EXPEDIENTE');},doc.id);
   const r=await fetch(signed.signedUrl,{redirect:'error'});assert.equal(r.status,200,'UPLOADED_PREVIEW_FAILED');assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(sourceBytes),'UPLOADED_BYTES_CHANGED');
   const asset=await page.evaluate(async id=>{const r=await SutiSupabase.getClient().from('private_assets').select('id,storage_path,content_sha256').eq('id',id).single();if(r.error)throw Error('ASSET_READ_FAILED');return r.data;},step.assetId);
   assert.equal(asset.storage_path,step.path);assert.equal(asset.content_sha256.toUpperCase(),hash(sourceBytes));step.previewStatus=200;step.sha256=hash(sourceBytes);persist();
  };
  const perform=async(name,action)=>{
   if(checkpoint.steps[name]&&['COMPLETE','REGISTERED'].includes(checkpoint.steps[name].status)){await verifyDocument(checkpoint.steps[name]);checkpoint.steps[name].status='COMPLETE';persist();return;}
   assert.equal(proof.blockedRequests.length,0,'UNEXPECTED_REQUEST_BEFORE_UPLOAD');
   stage=name;activeStep=name;
   const rpc=name==='selfReplacement'?'register_affiliate_document':'register_admin_affiliate_document';
   const storageWait=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.startsWith('/storage/v1/object/private-assets/'));
   const rpcWait=page.waitForResponse(r=>new URL(r.url()).pathname==='/rest/v1/rpc/'+rpc);
   try{
    const [storageResponse,rpcResponse]=await Promise.all([storageWait,rpcWait,action()]);
    const step=checkpoint.steps[name];step.storageStatus=storageResponse.status();step.rpcStatus=rpcResponse.status();
    const result=await rpcResponse.json();if(!rpcResponse.ok()){step.error={code:result.code,message:result.message};persist();throw Error('UPLOAD_RPC_HTTP_'+rpcResponse.status());}
    assert(storageResponse.ok(),'STORAGE_UPLOAD_FAILED');const doc=name==='selfReplacement'?result:result.document;assert(doc?.id&&doc.private_asset_id,'UPLOAD_RESPONSE_INCOMPLETE');
    step.documentId=doc.id;step.assetId=doc.private_asset_id;step.replacesDocumentId=doc.replaces_document_id;step.status='REGISTERED';persist();
    assert.equal(doc.affiliate_id,affiliate);assert.equal(doc.document_type_id,typeId);assert.equal(doc.status,'PENDING_REVIEW');
    await verifyDocument(step);step.status='COMPLETE';step.completedAt=new Date().toISOString();persist();
   }finally{activeStep=null;}
  };
  await openAdmin();
  await perform('adminGeneral',async()=>{
   await page.locator('[data-affiliate-upload-open]').click();const modal=page.getByRole('dialog').filter({has:page.locator('[data-admin-affiliate-upload="'+affiliate+'"]')});
   await modal.locator('select').selectOption(typeId);await modal.locator('input[type=file]').setInputFiles(file);await modal.locator('textarea').fill(reason);await modal.getByRole('button',{name:'Crear versión',exact:true}).click();await modal.waitFor({state:'hidden'});
  });
  await openAdmin();
  await perform('adminReplacement',async()=>{
   await page.locator('[data-affiliate-document-replace="'+checkpoint.steps.adminGeneral.documentId+'"]').click();const modal=page.getByRole('dialog').filter({has:page.locator('[data-admin-affiliate-upload="'+affiliate+'"]')});
   assert.equal(await modal.locator('select').inputValue(),typeId);assert(await modal.locator('select').isDisabled());await modal.locator('input[type=file]').setInputFiles(file);await modal.locator('textarea').fill(reason);await modal.getByRole('button',{name:'Crear versión',exact:true}).click();await modal.waitFor({state:'hidden'});
  });
  assert.equal(checkpoint.steps.adminReplacement.replacesDocumentId,checkpoint.steps.adminGeneral.documentId,'ADMIN_HISTORY_CHAIN_MISMATCH');
  stage='self_navigation';await page.locator('[data-admin-view-app]').first().click();
  try{
   // Home can show the published promotional overlay and notification invitation.
   // Their actual Ahora no controls dismiss them; never force a pointer through an overlay.
   for(let attempt=0;attempt<3;attempt++){
    const postpone=page.getByRole('button',{name:'Ahora no',exact:true}).last();
    const visible=await postpone.waitFor({state:'visible',timeout:attempt===0?3500:1500}).then(()=>true,()=>false);if(!visible)break;
    const handle=await postpone.elementHandle();await postpone.click({timeout:5000});if(handle)await handle.waitForElementState('hidden',{timeout:5000});
   }
   await page.getByRole('button',{name:'Mi Perfil',exact:true}).click({timeout:12000});await page.getByRole('button',{name:'Mis documentos',exact:true}).click({timeout:12000});
  }catch(error){
   checkpoint.navigationDiagnostics=await page.evaluate(()=>{
    const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';};
    const target=document.querySelector('button[aria-label="Mi Perfil"]'),r=target&&target.getBoundingClientRect(),hit=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return{visibleButtonLabels:Array.from(document.querySelectorAll('button')).filter(visible).map(el=>(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,100)).slice(0,70),profilePointerTarget:hit?{tag:hit.tagName,className:typeof hit.className==='string'?hit.className:'',role:hit.getAttribute('role')}:null};
   }).catch(()=>({unavailable:true}));persist();throw error;
  }
  await page.locator('[data-document-authority="supabase"][data-document-phase="ready"]').waitFor();
  await perform('selfReplacement',async()=>{
   const row=page.locator('[data-document-authority="supabase"] [data-document-type-id="'+typeId+'"]');await row.locator('[data-document-action="replace"]').click();
   const chooser=page.waitForEvent('filechooser');await page.locator('[data-document-origin="file"]').click();await(await chooser).setFiles(file);
   await row.locator('[data-document-action="replace"]').waitFor();
  });
  assert.equal(checkpoint.steps.selfReplacement.replacesDocumentId,checkpoint.steps.adminReplacement.documentId,'SELF_HISTORY_CHAIN_MISMATCH');
  stage='refresh_and_preservation';await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
  for(const step of Object.values(checkpoint.steps))await verifyDocument(step);
  const after=await ownDocs();
  for(const original of checkpoint.baselineDocuments){const current=after.find(d=>d.id===original.id);assert(current,'ORIGINAL_DOCUMENT_MISSING');for(const key of ['affiliate_id','document_type_id','private_asset_id','affiliate_file_id','sha256','created_at','replaces_document_id'])assert.equal(current[key],original[key],'ORIGINAL_REFERENCE_CHANGED');if(original.document_type_id!==typeId)assert.deepEqual(current,original,'OTHER_DOCUMENT_SLOT_CHANGED');}
  const originalPreview=await page.evaluate(async id=>{const d=(await DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_EXPEDIENTE')).find(x=>x.id===id);return DocumentWorkflowRepository.selfPreview(d,'SELF_SERVICE_EXPEDIENTE');},source.id);
  const originalAgain=await fetch(originalPreview.signedUrl,{redirect:'error'});assert.equal(originalAgain.status,200,'ORIGINAL_OBJECT_NOT_PRESERVED');assert.equal(hash(Buffer.from(await originalAgain.arrayBuffer())),hash(sourceBytes));
  const steps=Object.entries(checkpoint.steps);assert.equal(steps.length,3);assert.equal(new Set(steps.map(([,s])=>s.assetId)).size,3);assert.equal(new Set(steps.map(([,s])=>s.path)).size,3);
  assert.equal(proof.pageErrors,0,'BROWSER_PAGE_ERRORS');assert.equal(proof.blockedRequests.length,0,'UNEXPECTED_REQUEST_BLOCKED');
  proof.steps=steps.map(([name,s])=>({name,status:s.status,storageStatus:s.storageStatus,rpcStatus:s.rpcStatus,previewStatus:s.previewStatus,bytesVerified:true}));proof.retainedNewVersions=steps.length;proof.originalDocumentsPreserved=checkpoint.baselineDocuments.length;proof.unchangedOtherDocumentTypes=true;proof.originalObjectPreserved=true;proof.independentAssetsAndPaths=true;proof.refreshVerified=true;proof.status='PASS';
 }catch(error){proof.stage=stage;proof.error=/^[A-Z0-9_]+$/.test(error.message)?error.message:'LIVE_CHECK_FAILED';proof.steps=Object.entries(checkpoint.steps).map(([name,s])=>({name,status:s.status,storageStatus:s.storageStatus||null,rpcStatus:s.rpcStatus||null}));checkpoint.lastFailure={stage,message:error.message,at:new Date().toISOString()};persist();throw error;
 }finally{save(proofPath,proof);console.log(JSON.stringify(proof));if(browser)await browser.close();sourceBytes=null;}
}
if(require.main===module)main().catch(()=>{process.exitCode=1;});
