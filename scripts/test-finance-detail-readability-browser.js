const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const out=path.join(root,'docs/qa/evidence/finance-detail-readability-20260922');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],checks=[];try{
const original=read('scripts/test-finance-request-detail-modal-browser.js');let setup=original.slice(original.indexOf('    async function fixture('),original.indexOf('    const before = await fixture'));
setup=setup.replace("window.__app =","window.AdminFinanceQueueRepository = { enrich: async rows => rows }; window.AffiliateRepository = { getProfilePhoto: async () => null }; window.__app =");
const fixture=new Function('browser','errors','read','cp','root','assert',setup+';return fixture;')(browser,errors,read,cp,root,assert);
const page=await fixture();
const dossier=page.locator('[data-financial-current-documents]');assert.equal(await dossier.getAttribute('open'),null);
await dossier.locator('summary').click();assert(await dossier.evaluate(e=>e.open));await dossier.locator('summary').press('Enter');assert.equal(await dossier.evaluate(e=>e.open),false);
for(const viewport of [{width:1440,height:1000},{width:1024,height:768},{width:390,height:844},{width:320,height:667}]){
await page.setViewportSize(viewport);
const metrics=await page.evaluate(()=>{const scroll=document.querySelector('.finwb-detail-scroll'),doc=scroll.querySelector('[data-financial-documents]'),img=doc.querySelector('img');return {overflow:scroll.scrollWidth>scroll.clientWidth,value:getComputedStyle(scroll.querySelector('.finwb-kv strong')).fontSize,label:getComputedStyle(scroll.querySelector('.finwb-kv span')).fontSize,title:getComputedStyle(scroll.querySelector('h3')).fontSize,docWidth:doc.clientWidth,scrollWidth:scroll.clientWidth,imageWidth:img.clientWidth,imageHeight:img.clientHeight,ratio:img.naturalWidth/img.naturalHeight};});
assert(!metrics.overflow,JSON.stringify(metrics));assert.equal(metrics.value,'18px');assert.equal(metrics.label,'16px');assert.equal(metrics.title,'21px');assert(metrics.docWidth>metrics.scrollWidth*.85);assert(Math.abs(metrics.imageWidth/metrics.imageHeight-metrics.ratio)<.02);checks.push({viewport,...metrics});
await page.locator('.finwb-detail-scroll').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,`detail-${viewport.width}.png`)});
}
await page.setViewportSize({width:1440,height:1000});await page.locator('[data-financial-documents]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'documents.png')});
await page.getByRole('button',{name:'Ampliar',exact:true}).first().click();await page.waitForSelector('[data-image-viewer]');await page.keyboard.press('Escape');assert.equal(await page.locator('[data-image-viewer]').count(),0);assert.equal(await page.locator('dialog[open]').count(),1);
assert.equal(await page.evaluate(()=>__calls.length),0);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',checks,accordion:'mouse and keyboard PASS',viewer:'PASS',writes:0,errors},null,2));console.log('PASS readability, full-width proportional images, accordion, viewer, responsive, zero writes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
