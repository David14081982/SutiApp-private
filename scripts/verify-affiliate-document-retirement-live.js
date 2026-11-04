'use strict';
// Real authenticated reads; never confirms deletion or writes fixture data.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {environment}=require('./investors-db');const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/affiliate-document-retirement'),out=path.join(root,'docs/qa/evidence/affiliate-document-retirement');
const mode=process.argv[2]||'candidate',base='https://sutiapp.com/',sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function main(){
 assert(['candidate','production'].includes(mode));const env=environment(),assembly=JSON.parse(fs.readFileSync(path.join(out,'assembly.json'),'utf8'));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],blocked=[],checks=[];let stage='prepare';
 try{
  const context=await browser.newContext({viewport:{width:1400,height:950},serviceWorkers:mode==='candidate'?'block':'allow'}),page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.name||'PAGE_ERROR'));
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname.endsWith('.supabase.co')&&(/\/(prepare_admin_affiliate_document_delete|resume_admin_affiliate_document_delete|affiliate_document_delete_storage|affiliate-document-delete)$/.test(url.pathname)||['PATCH','PUT','DELETE'].includes(req.method()))){blocked.push(url.pathname.split('/').pop());return route.abort();}
   if(mode==='candidate'&&url.origin==='https://sutiapp.com'&&req.method()==='GET'){
    const site=path.join(dir,'site'),file=path.resolve(site,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if(file.startsWith(site+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
   }
   return route.continue();
  });
  stage='bundle';await page.goto(base+'#/admin/menu',{waitUntil:'domcontentloaded'});
  const loadedHash=await page.evaluate(async()=>{const s=document.querySelector('script[src*="app/bundle.js"]');const r=await fetch(s.src,{cache:'no-store'});return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');});assert.equal(loadedHash,assembly.bundleSha256,'BUNDLE_MISMATCH');
  stage='login';await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});
  const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.isVisible().catch(()=>false))await later.click();await page.waitForFunction(()=>window.AdminRepository?.getState().phase==='authorized',null,{timeout:60000});
  stage='affiliates';const sidebar=page.locator('[data-admin-sidebar-module="affiliates"]');if(await sidebar.count())await sidebar.click();else{const admin=page.getByRole('button',{name:'Admin',exact:true});if(await admin.count())await admin.evaluate(e=>e.click());await page.locator('[data-admin-module="affiliates"]').click();}
  await page.getByRole('textbox',{name:'Buscar afiliados'}).fill('13788');const row=page.locator('[data-affiliate-row]').filter({has:page.locator('.aff-control',{hasText:'13788'})}).first();await row.waitFor();await row.click();await page.waitForFunction(()=>document.querySelector('[data-admin-affiliate-detail] .aff-profile-head p')?.textContent.includes('13788'));
  await page.getByRole('button',{name:'Expediente',exact:true}).click();const buttons=page.locator('[data-affiliate-document-delete]');await buttons.first().waitFor();const count=await buttons.count();assert(count>0);assert.equal(await page.locator('.aff-document-card').count(),count);
  stage='confirmation';await buttons.first().click();const dialog=page.getByRole('dialog');await dialog.locator('[data-delete-version-list]').waitFor();const versions=await dialog.locator('[data-delete-version-list] li').count();assert(versions>0);assert(await dialog.locator('[data-confirm-document-delete]').isDisabled());await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await buttons.count(),count);checks.push('Real Afiliados access, per-document action, server-derived version scope and cancellation without deletion');
  stage='preview';const preview=await page.evaluate(async()=>{const affiliate=document.querySelector('[data-admin-affiliate-detail]').dataset.adminAffiliateDetail;const detail=await AdminAffiliatesRepository.detail(affiliate);const doc=detail.documents.find(d=>d.available);if(!doc)return {available:false};const signed=await AdminAffiliatesRepository.previewDocument(doc.id,affiliate);const response=await fetch(signed.signedUrl,{cache:'no-store'});return {available:true,status:response.status,bytes:(await response.arrayBuffer()).byteLength,summary:!!detail.document_summary,required:detail.document_summary?.required_count};});assert(preview.available);assert.equal(preview.status,200);assert(preview.bytes>0);assert(preview.summary);checks.push('Legitimate current document still opens; authoritative required-document counters present');
  stage='refresh';await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:60000});const v=await page.locator('script[src*="app/bundle.js"]').getAttribute('src');assert(v.includes(assembly.version));checks.push('Authenticated refresh loads exact release');
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  // Denials use nonexistent identifiers and existing controlled accounts only.
  stage='backend-denials';const api=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY,empty='00000000-0000-4000-8000-000000000000';
  const anon=await fetch(api+'/rest/v1/rpc/preview_admin_affiliate_document_delete',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_affiliate_id:empty,p_document_id:empty})});assert([401,403,404].includes(anon.status));
  const noAuth=await fetch(api+'/functions/v1/affiliate-document-delete',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}'});assert([401,403].includes(noAuth.status));
  let unprivileged='NOT_CONFIGURED';
  if(env.H005_TEST2_EMAIL&&env.H005_TEST2_PASSWORD){
   const login=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST2_EMAIL,password:env.H005_TEST2_PASSWORD})});assert(login.ok,'CONTROLLED_SECOND_LOGIN');const session=await login.json();
   const denied=await fetch(api+'/rest/v1/rpc/preview_admin_affiliate_document_delete',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_affiliate_id:empty,p_document_id:empty})});const reason=await denied.json();assert.equal(denied.status,403);assert.equal(reason.message,'AFFILIATE_DOCUMENT_DELETE_DENIED');unprivileged=403;
  }
  checks.push('Anonymous RPC/Edge denied; existing unprivileged account checked when configured');
  const proof={status:'PASS',mode,bundleSha256:loadedHash,version:assembly.version,documentCards:count,confirmedScopeVersions:versions,legitimatePreviewStatus:preview.status,requiredDocumentCount:preview.required,anonymousRpc:anon.status,anonymousEdge:noAuth.status,unprivilegedRpc:unprivileged,checks,productionDocumentDeletions:0,blockedWrites:blocked.length,pageErrors:errors.length,screenshots:0};
  fs.writeFileSync(path.join(out,'live-'+mode+'.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }catch(e){const proof={status:'FAIL',mode,stage,error:/^[A-Z0-9_]+$/.test(e.message)?e.message:'CHECK_FAILED',pageErrors:errors,blockedWrites:blocked.length};fs.writeFileSync(path.join(out,'live-'+mode+'.json'),JSON.stringify(proof,null,2)+'\n');console.error(JSON.stringify(proof));throw e;}finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
