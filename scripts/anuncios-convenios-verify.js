'use strict';
// H-SUTIAPP-CONVENIOS-ANUNCIOS-001 browser verification with real login against the real Supabase project.
// Admin flow: every write (Storage upload, app_assets/asset_sources/banners writes, archive RPC) is intercepted, so the run
// proves the exact payloads the editor sends without persisting data. The carousel first reads the real audience-aware RPC,
// then renders a fixture response to prove slides and accent color.
//   node scripts/anuncios-convenios-verify.js [--production]
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const {env}=require('./voting-live-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/anuncios-convenios-20260917');
const production=process.argv.includes('--production'),PAGES='https://david14081982.github.io/SutiApp-private/',tag=production?'production':'local';
const FAKE_ASSET='00000000-0000-4000-8000-00000000a001',FAKE_AD='00000000-0000-4000-8000-00000000ad01';
const png=fs.readFileSync(path.join(root,'assets/branding/credencial-puno.png')),imageFile=path.join(root,'assets/branding/credencial-puno.png');
const asset=(p)=>({id:'fixture-'+p,asset_key:'fixture.'+p,storage_bucket:'app-assets',storage_path:'fixture/'+p+'.png',mime_type:'image/png',alt_text:'',status:'READY'});
const adminRow={id:FAKE_AD,placement:'marketplace',title:'AMCO',description:'Descuentos exclusivos',action_label:null,action_url:'https://example.invalid/amco',company_raw:null,category_raw:null,image_asset_id:FAKE_ASSET,enabled:true,start_at:null,end_at:null,sort_order:99,record_origin:'ADMIN_H009',audience_mode:'segment',union_codes:['SUTISSSTESON'],employment_category_codes:['BASE'],gender_codes:[],tag_codes:[],accent_hue:150,image_asset:asset('ad-amco')};
const carouselFixture=[
 {id:'fixture-ad-1',placement:'marketplace',title:'AMCO',description:'Descuentos exclusivos',action_url:'https://example.invalid/amco',sort_order:1,accent_hue:150,image_asset:asset('ad-amco')},
 {id:'fixture-ad-2',placement:'marketplace',title:'Sin acento',description:'Usa el guinda institucional',action_url:null,sort_order:2,accent_hue:null,image_asset:asset('ad-plain')}];

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const values=env(),server=production?null:await serve(),target=production?PAGES+'SutiApp.html':`http://127.0.0.1:${server.address().port}/SutiApp.html`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:430,height:900},serviceWorkers:'block'}),page=await context.newPage();
 const errors=[],checks=[],calls={storageUpload:[],assetInsert:0,sourceInsert:0,assetDelete:0,bannerInsert:[],bannerPatch:[],archive:[],rpc:{home:[],marketplace:[]}};
 const flags={injectAd:false,failPatch:false,carouselFixture:false};let uploadedPublicPath=null;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(url=>url.hostname.endsWith('.supabase.co'),async route=>{
  const req=route.request(),u=new URL(req.url()),m=req.method(),body=()=>{try{return JSON.parse(req.postData()||'null');}catch(_){return null;}};
  if(m==='POST'&&u.pathname.startsWith('/storage/v1/object/app-assets/')){const rest=u.pathname.slice('/storage/v1/object/app-assets/'.length);calls.storageUpload.push(rest);uploadedPublicPath='/storage/v1/object/public/app-assets/'+rest;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({Key:'app-assets/'+rest,Id:FAKE_ASSET})});}
  if(m==='DELETE'&&u.pathname.startsWith('/storage/v1/object/'))return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  if(m==='GET'&&(u.pathname===uploadedPublicPath||/\/storage\/v1\/(object|render\/image)\/public\/app-assets\/fixture\//.test(u.pathname)))return route.fulfill({status:200,contentType:'image/png',body:png});
  if(u.pathname==='/rest/v1/app_assets'&&m==='POST'){calls.assetInsert++;return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:FAKE_ASSET})});}
  if(u.pathname==='/rest/v1/app_assets'&&m==='DELETE'){calls.assetDelete++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:FAKE_ASSET}])});}
  if(u.pathname==='/rest/v1/asset_sources'&&m==='POST'){calls.sourceInsert++;return route.fulfill({status:201,contentType:'application/json',body:''});}
  if(u.pathname==='/rest/v1/banners'&&m==='POST'){calls.bannerInsert.push(body());return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:FAKE_AD})});}
  if(u.pathname==='/rest/v1/banners'&&m==='PATCH'){calls.bannerPatch.push({query:u.search,body:body()});if(flags.failPatch)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'23514',message:'new row violates check constraint'})});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:FAKE_AD})});}
  if(u.pathname==='/rest/v1/rpc/archive_admin_banner'){calls.archive.push(body());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({archived:true})});}
  if(u.pathname==='/rest/v1/banners'&&m==='GET'&&(u.searchParams.get('select')||'').includes('image_asset:')){const res=await route.fetch();const rows=await res.json();if(flags.injectAd)rows.push(adminRow);return route.fulfill({response:res,json:rows});}
  if(u.pathname==='/rest/v1/rpc/list_public_banners'){const placement=(body()||{}).p_placement;if(flags.carouselFixture&&placement==='marketplace')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(carouselFixture)});const res=await route.fetch();const rows=await res.json();(calls.rpc[placement]||[]).push({status:res.status(),count:Array.isArray(rows)?rows.length:null});return route.fulfill({response:res,json:rows});}
  // Signed URL creation is a read. Any other write to these domains must have been intercepted above.
  if(['POST','PATCH','DELETE','PUT'].includes(m)&&(/^\/rest\/v1\/(banners|app_assets|asset_sources)/.test(u.pathname)||(u.pathname.startsWith('/storage/v1/object/')&&!u.pathname.startsWith('/storage/v1/object/sign/')))){calls.unintercepted=(calls.unintercepted||[]).concat(m+' '+u.pathname);return route.abort();}
  return route.continue();
 });
 try{
  await page.goto(target+'#/admin/convenios',{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.getByText('Convenios y beneficios',{exact:true}).first().waitFor({timeout:60000});
  await page.getByRole('button',{name:'Anuncios',exact:true}).click();
  await page.getByText('CAMPAÑAS / ANUNCIOS',{exact:true}).waitFor({timeout:30000});
  checks.push('admin_anuncios_tab');

  // New ad: image required, real upload path intercepted, segmentation by union + category, accent color.
  await page.getByRole('button',{name:'Nuevo',exact:true}).click();
  const editor=page.locator('[data-ad-editor="new"]');await editor.waitFor();
  assert.equal(await editor.getByRole('button',{name:'Falta la imagen',exact:true}).isDisabled(),true);
  await editor.getByPlaceholder('Ej. Coppel').fill('AMCO');await editor.getByPlaceholder('Ej. Hasta 18 meses sin intereses').fill('Descuentos exclusivos');await editor.getByPlaceholder('https://…').fill('https://example.invalid/amco');
  await editor.locator('input[type=file]').setInputFiles(imageFile);
  await editor.locator('[data-ad-image="ready"] img').waitFor({timeout:20000});
  assert.equal(calls.storageUpload.length,1);assert.equal(calls.assetInsert,1);assert.equal(calls.sourceInsert,1);assert(calls.storageUpload[0].startsWith('banners/'),'section asset path');
  await editor.getByRole('button',{name:'Color 150',exact:true}).click();
  await editor.getByRole('button',{name:/^Segmentado/}).click();
  await editor.getByRole('button',{name:'SUTISSSTESON',exact:true}).click();await editor.getByRole('button',{name:'Base',exact:true}).click();
  assert.equal(await editor.getByText('Cargo en la aplicación',{exact:true}).count(),0,'cargo hidden for ads');
  await page.screenshot({path:path.join(out,tag+'-editor-nuevo.png'),fullPage:false});
  flags.injectAd=true;
  await editor.getByRole('button',{name:'Guardar',exact:true}).click();
  await editor.waitFor({state:'detached',timeout:20000});
  const sent=calls.bannerInsert[0];
  assert.equal(sent.placement,'marketplace');assert.equal(sent.title,'AMCO');assert.equal(sent.description,'Descuentos exclusivos');assert.equal(sent.action_url,'https://example.invalid/amco');
  assert.equal(sent.image_asset_id,FAKE_ASSET);assert.equal(sent.accent_hue,150);assert.equal(sent.audience_mode,'segment');assert.deepEqual(sent.union_codes,['SUTISSSTESON']);
  assert.deepEqual(sent.employment_category_codes,['BASE']);assert.deepEqual(sent.gender_codes,[]);assert.deepEqual(sent.tag_codes,[]);assert.equal(sent.enabled,true);assert.equal(sent.record_origin,'ADMIN_H009');assert(Number(sent.sort_order)>0);
  assert.equal(calls.assetDelete,0,'saved image is kept');checks.push('admin_save_payload');

  // The saved ad is listed with its image and audience.
  const row=page.locator('button',{hasText:'AMCO'}).first();await row.waitFor({timeout:20000});
  await page.getByText('Segmentado',{exact:true}).first().waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('img')].some(i=>/fixture\/ad-amco/.test(i.src)&&i.complete&&i.naturalWidth>0),null,{timeout:20000});
  await page.screenshot({path:path.join(out,tag+'-lista-anuncios.png'),fullPage:false});checks.push('admin_list_row');

  // Visibility toggle sends only enabled.
  await page.getByRole('button',{name:'Visible',exact:true}).first().click();
  await page.waitForFunction(()=>true);await page.waitForTimeout(800);
  const toggle=calls.bannerPatch.find(p=>p.body&&Object.keys(p.body).length===1&&p.body.enabled===false);
  assert(toggle&&toggle.query.includes('id=eq.'+FAKE_AD),'toggle payload');checks.push('admin_toggle');

  // Edit error stays visible inside the editor; delete archives.
  await row.click();const edit=page.locator('[data-ad-editor="edit"]');await edit.waitFor();
  flags.failPatch=true;await edit.getByRole('button',{name:'Guardar',exact:true}).click();
  await edit.locator('[data-ad-error]').waitFor({timeout:15000});assert.equal(await edit.count(),1,'editor stays open on error');
  await page.screenshot({path:path.join(out,tag+'-editor-error.png'),fullPage:false});
  flags.failPatch=false;
  await edit.getByRole('button',{name:'Eliminar anuncio',exact:true}).click();await edit.waitFor({state:'detached',timeout:20000});
  assert.deepEqual(calls.archive[0],{p_banner_id:FAKE_AD});checks.push('admin_error_and_archive');
  flags.injectAd=false;

  // Cancel discards an uploaded but unsaved image.
  await page.getByRole('button',{name:'Nuevo',exact:true}).click();const cancelEditor=page.locator('[data-ad-editor="new"]');await cancelEditor.waitFor();
  await cancelEditor.locator('input[type=file]').setInputFiles(imageFile);await cancelEditor.locator('[data-ad-image="ready"]').waitFor({timeout:20000});
  await cancelEditor.getByRole('button',{name:'Cancelar',exact:true}).click();await cancelEditor.waitFor({state:'detached'});
  await page.waitForTimeout(800);assert.equal(calls.assetDelete,1,'unsaved upload discarded');checks.push('admin_cancel_discards_upload');

  // Convenios carousel: real audience-aware RPC, then fixture slides with accent.
  await page.evaluate(()=>{location.hash='#/home';});await page.waitForTimeout(3000);
  for(let i=0;i<3;i++){const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.count()){await later.first().click().catch(()=>{});await page.waitForTimeout(500);}}
  await page.locator('[data-app-tab="convenios"]').first().click({timeout:20000});
  await page.locator('[data-convenios-section="ads"]').waitFor({timeout:60000});
  assert.equal(await page.locator('[data-convenios-state="error"]').count(),0);
  assert(calls.rpc.marketplace.length>0&&calls.rpc.marketplace.every(r=>r.status===200&&Array.isArray([]) ),'real marketplace rpc');
  assert(calls.rpc.home.length>0&&calls.rpc.home[0].count>0,'home banners still served through the rpc');
  const realMarketplace=calls.rpc.marketplace[0].count;checks.push('carousel_real_rpc');
  flags.carouselFixture=true;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated',null,{timeout:60000});
  await page.evaluate(()=>{location.hash='#/home';});await page.waitForTimeout(2500);
  for(let i=0;i<3;i++){const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.count()){await later.first().click().catch(()=>{});await page.waitForTimeout(500);}}
  await page.locator('[data-app-tab="convenios"]').first().click({timeout:20000});
  await page.locator('[data-convenios-ad="fixture-ad-1"]').waitFor({timeout:60000});
  assert.equal((await page.locator('[data-convenios-ad-position]').textContent()).trim(),'1 / 2');
  const styles=await page.evaluate(()=>{const a=document.querySelector('[data-convenios-ad="fixture-ad-1"]'),b=document.querySelector('[data-convenios-ad="fixture-ad-2"]');return {accent:a.style.background,plain:b.style.background};});
  assert(/hsl\(150/.test(styles.accent)||/rgb/.test(styles.accent),'accent background applied: '+styles.accent);assert(/var\(--guinda\)/.test(styles.plain),'plain keeps guinda: '+styles.plain);
  await page.locator('[data-convenios-section="ads"]').screenshot({path:path.join(out,tag+'-carrusel.png')});checks.push('carousel_fixture_accent');

  assert.deepEqual(errors,[]);assert.equal(calls.unintercepted,undefined,'no write reached Supabase');
  const result={status:'PASS',target:production?'https://sutiapp.com':'local build + production Supabase',checks,realMarketplaceAdsForThisAdmin:realMarketplace,homeBannersServed:calls.rpc.home[0].count,interceptedWrites:{storageUpload:calls.storageUpload.length,assetInsert:calls.assetInsert,sourceInsert:calls.sourceInsert,assetDelete:calls.assetDelete,bannerInsert:calls.bannerInsert.length,bannerPatch:calls.bannerPatch.length,archive:calls.archive.length},savedPayload:sent,businessWrites:0};
  fs.writeFileSync(path.join(out,tag+'-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(e){await page.screenshot({path:path.join(out,tag+'-browser-failure.png')}).catch(()=>{});console.error(JSON.stringify({checks,errors,calls:{...calls,bannerInsert:calls.bannerInsert.length},error:e.message}));process.exitCode=1;}
 finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
})();
