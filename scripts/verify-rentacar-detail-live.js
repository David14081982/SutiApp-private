'use strict';
// Focal rental checks only; real authenticated data and images. No requests/uploads/writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'local',envFile=process.argv[3]||path.join(root,'supabase.env'),out=path.join(root,'docs/qa/evidence/rentacar-detail');
const env={};for(const line of fs.readFileSync(envFile,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)env[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');}
const origin='https://david14081982.github.io/SutiApp-private/',expected=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'app/bundle.js'))).digest('hex');
(async()=>{fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(root,'.tmp/rental-detail'),{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const results=[];try{
 for(const width of [390,430]){
  const context=await browser.newContext({viewport:{width,height:932},serviceWorkers:mode==='local'?'block':'allow'});
  if(mode==='local')await context.route(origin+'**',async route=>{let name=new URL(route.request().url()).pathname.replace('/SutiApp-private/','')||'SutiApp.html';if(name==='index.html')name='SutiApp.html';const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();const ext=path.extname(file),body=fs.readFileSync(file);await route.fulfill({body:['.js','.html','.css'].includes(ext)?body.toString('utf8').replace(/\r\n/g,'\n'):body,contentType:({'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'})[ext]||'application/octet-stream'});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  const bundle=await page.evaluate(async()=>{const source=document.querySelector('script[src*="app/bundle.js"]');const bytes=await(await fetch(source.src,{cache:'no-store'})).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');});assert.equal(bundle,expected,'WRONG_BUNDLE');
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  const openCatalog=async()=>{await page.locator('[data-app-tab=financiera]').click();await page.getByText('Renta Car',{exact:true}).first().click();await page.locator('[data-rental-sheet]').waitFor();};
  await openCatalog();const sheet=page.locator('[data-rental-sheet]');
  await page.waitForFunction(()=>{const i=document.querySelector('[data-rental-sheet] img');return i&&i.complete&&i.naturalWidth>0;});
  assert.equal(await page.locator('[data-rental-card]').count(),0);
  assert.equal(await sheet.getAttribute('data-expanded'),'true');
  await page.waitForTimeout(350);const initial=await sheet.boundingBox();assert(initial.y<45,'EXPANDED_TO_TOP');
  const records=await page.evaluate(()=>ProgramCatalogRepository.listItems({programKey:'renta',includeAssets:false}));
  const actual=records.find(r=>!r.sold),ids=records.map(r=>r.id),info=sheet.locator('[data-rental-vehicle-info]');
  assert.equal(await info.getAttribute('data-rental-vehicle-info'),actual.id);
  assert((await info.innerText()).includes(actual.nombre));
  for(const key of ['engine','vehicle_type','seats','tank'])assert.equal(await info.locator('[data-rental-spec='+key+']').innerText(),actual.rental_specs[key]||'No registrado');
  assert.equal(await info.locator('[data-rental-rate]').count(),1);
  const textSizes=await info.evaluate(n=>[...n.querySelectorAll('*')].filter(e=>[...e.childNodes].some(t=>t.nodeType===3&&t.textContent.trim())).map(e=>parseFloat(getComputedStyle(e).fontSize)));assert(textSizes.every(s=>s>=14),'SMALL_INFO_TEXT');
  assert(await info.evaluate(n=>n.scrollWidth<=n.clientWidth),'INFO_OVERFLOW');
  await sheet.screenshot({path:path.join(root,'.tmp/rental-detail',mode+'-'+width+'-sheet.png')});
  const grip=page.locator('.rc-sheet-head');let b=await grip.boundingBox();await page.mouse.move(b.x+60,b.y+20);await page.mouse.down();await page.mouse.move(b.x+60,b.y+145,{steps:10});await page.mouse.up();await page.waitForTimeout(300);assert.equal(await sheet.getAttribute('data-expanded'),'false');
  b=await grip.boundingBox();await page.mouse.move(b.x+60,b.y+20);await page.mouse.down();await page.mouse.move(b.x+60,b.y+145,{steps:10});await page.mouse.up();await sheet.waitFor({state:'detached'});
  const card=page.locator('.su-press').filter({has:page.getByText(actual.nombre,{exact:true})}).first();
  await card.waitFor();await page.waitForTimeout(500);assert.equal(await sheet.count(),0,'NO_AUTO_REOPEN_AFTER_CLOSE');
  for(const label of ['Llamar','WhatsApp','Guardar','Por qu\u00e9 te conviene','Disponibles ahora'])assert(await page.getByText(label,{exact:true}).first().isVisible());
  assert.equal(await page.locator('[data-rental-card]').count(),0);
  await page.locator('[data-category-header-icon]').waitFor();await page.screenshot({path:path.join(root,'.tmp/rental-detail',mode+'-'+width+'-landing.png')});
  await card.click();await sheet.waitFor();assert.equal(await sheet.getAttribute('data-expanded'),'true');
  await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();await sheet.waitFor({state:'detached'});await card.waitFor();
  await card.click();await sheet.waitFor();await page.evaluate(()=>history.back());await sheet.waitFor({state:'detached'});await card.waitFor();
  await page.locator('[aria-label="Guardar programa"]').locator('..').getByRole('button').first().click();
  await openCatalog();assert.equal(await sheet.getAttribute('data-expanded'),'true','REENTRY_AUTO_OPENS');
  await page.getByRole('button',{name:'Reducir detalle',exact:true}).click();assert.equal(await sheet.getAttribute('data-expanded'),'false');
  await page.getByRole('button',{name:'Expandir detalle',exact:true}).click();assert.equal(await sheet.getAttribute('data-expanded'),'true');
  await page.locator('[data-renta-calendar]').waitFor();
  await sheet.locator('img').first().click();await page.locator('[role=dialog]:not([data-rental-sheet])').waitFor();await page.keyboard.press('Escape');assert(await sheet.isVisible(),'VIEWER_ESCAPE_KEEPS_SHEET');
  const dates=await page.evaluate(async id=>{const c=await RentaCarRepository.context(id);for(let i=0;i<90;i++){const start=new Date(Date.parse(c.today+'T12:00:00Z')+i*86400000).toISOString().slice(0,10),end=new Date(Date.parse(start+'T12:00:00Z')+86400000).toISOString().slice(0,10);if(!c.booked.some(b=>start<=b.end&&end>=b.start))return{start,end};}throw Error('NO_DATES');},actual.id);
  for(const d of [dates.start,dates.end]){for(let i=0;i<4&&!(await page.locator('[data-renta-day="'+d+'"]').count());i++)await page.getByRole('button',{name:'Mes siguiente'}).click();await page.locator('[data-renta-day="'+d+'"]').click();}
  await page.getByRole('button',{name:'Continuar con esta solicitud'}).click();await page.locator('[data-renta-application=documents]').waitFor();await page.getByRole('button',{name:'Continuar al resumen'}).click();await page.locator('[data-renta-summary]').waitFor();assert((await page.locator('[data-renta-summary]').innerText()).includes(new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(2*actual.precio)));assert.equal(await page.locator('[data-renta-application] canvas').count(),1);
  // Existing Admin entrance/editor, read-only: all fields and original ordered images.
  await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();await sheet.waitFor({state:'detached'});await page.goto(origin+'#/admin/program_products',{waitUntil:'domcontentloaded'});await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-program-key=renta]').click({timeout:45000});await page.locator('[data-program-product="'+actual.id+'"]').locator('button').nth(1).click();await page.locator('[data-rental-admin]').waitFor();
  for(const key of ['year','engine','vehicle_type','seats','tank'])assert.equal(await page.locator('[data-rental-field='+key+']').inputValue(),String(actual.rental_specs[key]??''));
  for(const field of ['name','description','price','order'])assert.equal(await page.locator('[data-program-product-field='+field+']').count(),1);
  assert.equal(await page.locator('[data-program-product-image-input]').count(),1);assert.equal(await page.locator('[data-product-financing-editor]').count(),0);assert.equal(await page.locator('[data-program-product-active-control]').count(),1);
  assert.deepEqual(errors,[]);results.push({width,status:'PASS',cards:ids.length,realImages:true,allSpecsMatchBackend:true,missingSpecsShownHonestly:true,originalLandingRestored:true,autoOpenOncePerVisit:true,singlePrice:true,minFontSize:Math.min(...textSizes),expandDragCloseDeviceBack:true,galleryViewerPreserved:true,rentalCalendarDocumentsSummarySignaturePreserved:true,adminFieldsAndGallery:true});await context.close();
 }
 const result={status:'PASS',mode,bundleSha256:expected,viewports:results,productionWrites:0,requestsSubmitted:0,backendResponseOverrides:0};fs.writeFileSync(path.join(out,mode+'-live.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
