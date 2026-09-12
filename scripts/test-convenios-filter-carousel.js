'use strict';
// Isolated browser fixtures only: no Auth, backend, data writes, or runtime test exports.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/convenios-filter-carousel-20260911');
const categories=['Todos','Salud y belleza','Educación','Funerarios','Hoteles y hospedaje','Automotriz','Restaurantes','Paquetería y envíos','Papelería y artículos escolares'];
async function main(){
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const proof={status:'FAIL',environment:'ISOLATED_BROWSER',networkRequests:0,checks:[],errors:[]};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'});await context.route('**/*',route=>{proof.networkRequests++;return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>proof.errors.push(e.message));
  await page.setContent('<style>body{margin:0;background:#f1f2f5;font-family:Arial;color:#20243b}*{box-sizing:border-box}:root{--surface:white;--ink-2:#535975;--grad-guinda-soft:linear-gradient(135deg,#b00040,#87002e);--neo-sm:0 3px 7px #18253b18;--glow-guinda:0 4px 8px #99003844}button:focus-visible{outline:2px solid #b00040;outline-offset:2px}</style><button id="outside">Fuera de filtros</button><main id="root" style="max-width:430px;margin:auto"></main>');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/motion.jsx'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
  const source=fs.readFileSync(path.join(root,'app/screens-convenios.jsx'),'utf8').replace('Object.assign(window,{ConveniosScreen,ConvenioDetail});','Object.assign(window,{ConveniosScreen,ConvenioDetail,TestCategoryCarousel:ConveniosCategoryCarousel});');await page.addScriptTag({content:source});
  await page.evaluate(items=>{window.testItems=items;window.root=ReactDOM.createRoot(document.getElementById('root'));window.renderTest=(next)=>{window.testItems=next;root.render(React.createElement(App));};function App(){const [value,setValue]=React.useState('Todos');return React.createElement(React.Fragment,null,React.createElement('h2',null,'Convenios'),React.createElement(TestCategoryCarousel,{items:window.testItems,value,onChange:setValue}),React.createElement('output',{'data-selected':''},value));}window.renderTest(items);},categories);
  const row=page.locator('[data-convenios-category-carousel]'),track=page.locator('[data-convenios-category-track]'),all=row.getByRole('button',{name:'Todos',exact:true});await row.waitFor();
  const x=()=>track.evaluate(e=>e.scrollLeft),pause=async(ms=350)=>page.waitForTimeout(ms);
  const fixed=await all.boundingBox();await page.waitForFunction(()=>document.querySelector('[data-convenios-category-track]').scrollLeft>10);assert.equal((await all.boundingBox()).x,fixed.x);proof.checks.push('Autoplay advances; Todos stays fixed');
  await row.hover();await pause(80);let pos=await x();await pause();assert.equal(await x(),pos);proof.checks.push('Hover pauses');
  for(const width of [320,390,430,1440]){await page.setViewportSize({width,height:844});await row.hover();const geometry=await row.locator('button').evaluateAll(ns=>ns.map(n=>({y:n.getBoundingClientRect().y,h:n.getBoundingClientRect().height})));assert(geometry.every(g=>Math.abs(g.y-geometry[0].y)<1));assert.equal(await all.count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  proof.checks.push('Single row at 320/390/430/1440; no page overflow');await page.setViewportSize({width:390,height:844});await row.hover();
  await page.screenshot({path:path.join(out,'mobile.png')});
  await page.mouse.move(0,0);pos=await x();await page.waitForTimeout(1200);assert((await x())>pos);proof.checks.push('Hover exit resumes');
  // Native touchscreen gesture: pointercancel must not restart autoplay while finger remains down.
  const cdp=await context.newCDPSession(page),bounds=await track.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width-20,y:bounds.y+20}]});await pause(100);pos=await x();await pause();assert.equal(await x(),pos);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:bounds.x+30,y:bounds.y+20}]});await pause(150);pos=await x();await pause();assert.equal(await x(),pos);assert(pos>20);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(1200);pos=await x();await pause(600);assert((await x())>pos);proof.checks.push('Native swipe and touch hold pause, including pointercancel; release resumes');
  // Mouse drag does not accidentally select the chip beneath the pointer.
  await row.hover();await track.evaluate(e=>{e.scrollLeft=40;});const box=await track.boundingBox();await page.mouse.move(box.x+box.width-20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+25,box.y+20,{steps:8});await page.mouse.up();assert((await x())>80);assert.equal(await page.locator('[data-selected]').innerText(),'Todos');proof.checks.push('Mouse drag scrolls without accidental selection');
  await track.evaluate(e=>{e.scrollLeft=0;});await row.getByRole('button',{name:'Educación',exact:true}).click();assert.equal(await page.locator('[data-selected]').innerText(),'Educación');assert.equal(await row.getByRole('button',{name:'Educación',exact:true}).getAttribute('aria-pressed'),'true');await all.click();assert.equal(await page.locator('[data-selected]').innerText(),'Todos');assert.equal(await all.getAttribute('aria-pressed'),'true');proof.checks.push('Category selection and Todos reset');
  await page.mouse.move(0,0);await page.locator('#outside').focus();await page.keyboard.press('Tab');await page.keyboard.press('Tab');await pause(80);pos=await x();await page.waitForTimeout(1200);assert.equal(await x(),pos);await page.keyboard.press('Enter');assert.equal(await page.locator('[data-selected]').innerText(),'Salud y belleza');proof.checks.push('Keyboard focus pauses; Enter selects');await page.locator('#outside').focus();
  // End of the track reverses direction instead of getting stuck or jumping.
  await row.hover();await track.evaluate(e=>{e.scrollLeft=e.scrollWidth-e.clientWidth-2;});await pause(100);pos=await x();await page.mouse.move(0,0);await page.waitForTimeout(2000);assert((await x())<pos-5);proof.checks.push('End reverses smoothly');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'app/text-size.css'),'utf8')});await row.hover();
  for(const size of ['small','normal','large','largest']){await page.evaluate(size=>document.getElementById('root').setAttribute('data-text-size',size),size);const ys=await row.locator('button').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().y));assert(ys.every(y=>Math.abs(y-ys[0])<1));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.evaluate(()=>document.getElementById('root').removeAttribute('data-text-size'));await page.mouse.move(0,0);proof.checks.push('Published CSS and all four text sizes preserve one row');
  await page.emulateMedia({reducedMotion:'reduce'});await pause(80);pos=await x();await pause(1000);assert.equal(await x(),pos);proof.checks.push('Reduced motion disables autoplay');
  await page.evaluate(()=>window.renderTest(['Todos','Educación']));await pause(100);assert.equal(await x(),0);await page.emulateMedia({reducedMotion:'no-preference'});await pause(1200);assert.equal(await x(),0);await page.evaluate(()=>window.renderTest(['Todos']));await pause(100);assert.equal(await row.locator('button').count(),1);proof.checks.push('No overflow and empty categories stay stable');
  await page.evaluate(()=>root.unmount());await pause(100);assert.deepEqual(proof.errors,[]);assert.equal(proof.networkRequests,0);proof.checks.push('Unmount cleans observers and events');proof.status='PASS';await context.close();
 }finally{await browser.close();fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
