'use strict';
// H-SUTIAPP-CREDENCIAL-PUNO-001 real-app verification (read-only; the back side is shown by rotating the DOM, so no QR is issued).
//   node scripts/credencial-puno-verify.js [--production]
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const {env}=require('./voting-live-db');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/credencial-puno-20260917');
const production=process.argv.includes('--production'),PAGES='https://david14081982.github.io/SutiApp-private/',tag=production?'production':'local';
// Production before the change (2026-09-17, same account and viewport).
const BASELINE={normal:{card:432,gap:128},large:{card:469,gap:144},largest:{card:520,gap:166}};

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const values=env(),server=production?null:await serve(),target=production?PAGES+'SutiApp.html':`http://127.0.0.1:${server.address().port}/SutiApp.html`;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await (await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'})).newPage(),errors=[],rpc=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{const m=r.url().match(/\/rest\/v1\/rpc\/([a-z_]+)/);if(m)rpc.push(m[1]);});
 try{
  await page.goto(target+'#/admin/votaciones',{waitUntil:'domcontentloaded'});
  if(production){const html=await (await fetch(PAGES+'SutiApp.html?verify='+Date.now(),{cache:'no-store'})).text();assert(html.includes('bundle.js?v=credencial-puno-20260917-001')&&html.includes('text-size.css?v=245'),'published HTML versions');}
  await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.locator('[data-voting-admin]').waitFor({timeout:60000});
  await page.evaluate(()=>{location.hash='#/home';});await page.waitForTimeout(3500);
  for(let i=0;i<3;i++){const later=page.getByRole('button',{name:'Ahora no',exact:true});if(await later.count()){await later.first().click().catch(()=>{});await page.waitForTimeout(500);}}
  await page.locator('[data-app-tab="credencial"]').first().click({timeout:20000});
  await page.locator('[data-credential-mark]').waitFor({state:'attached',timeout:60000});
  await page.waitForFunction(()=>{const i=document.querySelector('[data-credential-mark]');return i&&i.complete&&i.naturalWidth>0;},null,{timeout:20000});
  const sizes={};
  for(const size of ['small','normal','large','largest']){
   await page.evaluate(s=>{document.querySelector('[data-text-size]').dataset.textSize=s;},size);await page.waitForTimeout(250);
   const m=await page.evaluate(()=>{
    const r=e=>e.getBoundingClientRect(),[front,back]=[...document.querySelectorAll('.su-credential-face')],mark=document.querySelector('[data-credential-mark]');
    const header=front.children[1],avatarRow=front.children[2],qrBox=back.children[3];
    return {card:Math.round(r(front).height),gap:Math.round(r(avatarRow).top-r(header).bottom),
     mark:{w:Math.round(r(mark).width),h:Math.round(r(mark).height),right:Math.round(r(front).right-r(mark).right),top:Math.round(r(mark).top-r(front).top),natural:mark.naturalWidth,src:mark.getAttribute('src')},
     // In-flow content must end inside the padding box; absolute decorations (the seal watermark) overflow on purpose.
     frontFits:[front].every(face=>{const limit=r(face).bottom-parseFloat(getComputedStyle(face).paddingBottom)+1;return [...face.children].filter(c=>getComputedStyle(c).position!=='absolute').every(c=>r(c).bottom<=limit);}),
     backFits:[back].every(face=>{const limit=r(face).bottom-parseFloat(getComputedStyle(face).paddingBottom)+1;return [...face.children].filter(c=>getComputedStyle(c).position!=='absolute').every(c=>r(c).bottom<=limit);}),
     qrBox:{w:Math.round(r(qrBox).width),h:Math.round(r(qrBox).height)},qrInner:Math.round(r(qrBox.firstElementChild).width),
     pageOverflowX:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(m.mark.w,36,size+' mark width');assert.equal(m.mark.h,36,size+' mark height');assert(m.mark.natural>0,size+' mark loaded');assert(m.mark.src.includes('credencial-puno.png'),size+' registry src');
   assert(m.mark.right>=20&&m.mark.right<=28&&m.mark.top>=20&&m.mark.top<=28,size+' mark in top-right corner');
   assert.equal(m.qrInner,176,size+' QR size unchanged');assert(m.frontFits&&m.backFits,size+' content clipped');assert.equal(m.pageOverflowX,false,size+' horizontal overflow');
   if(BASELINE[size]){m.baseline=BASELINE[size];m.cardReduction=BASELINE[size].card-m.card;m.gapReduction=BASELINE[size].gap-m.gap;assert(m.gapReduction>=25,size+' gap not reduced enough: '+m.gapReduction);}
   sizes[size]=m;
   const flip=page.locator('.su-credential-flip');
   await flip.screenshot({path:path.join(out,`${tag}-frente-${size}.png`)});
   await page.evaluate(()=>{const f=document.querySelector('.su-credential-flip');f.dataset.prevTransition=f.style.transition;f.style.transition='none';f.style.transform='rotateY(180deg)';});await page.waitForTimeout(150);
   await flip.screenshot({path:path.join(out,`${tag}-reverso-${size}.png`)});
   // Rotate back without animation first; restoring the transition in the same frame would animate the return mid-measurement.
   await page.evaluate(()=>{const f=document.querySelector('.su-credential-flip');f.style.transform='rotateY(0deg)';void f.offsetWidth;});await page.waitForTimeout(120);
   await page.evaluate(()=>{const f=document.querySelector('.su-credential-flip');f.style.transition=f.dataset.prevTransition||'';});await page.waitForTimeout(120);
  }
  await page.evaluate(()=>{document.querySelector('[data-text-size]').dataset.textSize='normal';});
  const validate=await page.evaluate(()=>window.ASSETS_REGISTRY.validate());
  assert.deepEqual(validate,[],'asset registry validate');
  assert.equal(rpc.filter(n=>/credential_qr/.test(n)).length,0,'no QR issued during verification');
  assert.deepEqual(errors,[]);
  const result={status:'PASS',target:production?'https://sutiapp.com':'local build + production Supabase',sizes,registryValidate:validate,qrIssued:0,businessWrites:0};
  fs.writeFileSync(path.join(out,tag+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(e){await page.screenshot({path:path.join(out,tag+'-failure.png')}).catch(()=>{});console.error(JSON.stringify({errors,error:e.message}));process.exitCode=1;}
 finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
})();
