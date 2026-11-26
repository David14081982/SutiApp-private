'use strict';
// Isolated UI contract tests. Fixtures never enter the production bundle or database.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/seniority'),privateDir=path.join(root,'.tmp/seniority');
async function main(){
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script src="/app/vendor/react-18.3.1/react.production.min.js"></script><script src="/app/vendor/react-dom-18.3.1/react-dom.production.min.js"></script><script src="/app/icons.jsx"></script><script src="/app/seniority-repository.js"></script><script src="/app/screens-seniority.jsx"></script></body></html>');}
  const file=path.resolve(root,'.'+decodeURIComponent(req.url));if(!file.startsWith(path.join(root,'app')+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type','application/javascript');fs.createReadStream(file).pipe(res);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.SeniorityScreen);
 await page.evaluate(()=>{
  window.testMode='loaded';window.testCalls=[];window.testBack=0;
  window.testRows=Array.from({length:75},(_,i)=>({id:'isolated-'+i,name:'Afiliado de prueba '+(i+1),numero_control:'000'+i,city:'Hermosillo',unit:i<60?'OFICINAS CENTRALES/UNIDAD DE PRUEBA':'MÓDULO DE PRUEBA',unit_total:i<60?60:15,rank:i<60?i+1:i-59,tenure_months:240-i,entry_date:'2000-01-01',date_status:'VALID'}));
  window.SeniorityRepository={page:async(offset=0,limit=50)=>{window.testCalls.push({offset,limit});if(window.testMode==='error')throw Error('Fallo controlado de consulta');const rows=window.testMode==='empty'?[]:window.testRows;return{items:rows.slice(offset,offset+limit),total:rows.length,next_offset:Math.min(offset+limit,rows.length),revision:'isolated',as_of:'2026-11-25'};}};
  window.testRoot=ReactDOM.createRoot(document.getElementById('root'));window.mountTest=()=>testRoot.render(React.createElement(SeniorityScreen,{key:Math.random(),app:{back:()=>testBack++,toast:message=>window.testToast=message}}));mountTest();
 });
 const checks=[];
 for(const [width,height]of[[390,844],[820,1180],[1440,1000]]){
  await page.setViewportSize({width,height});await page.locator('[data-seniority="loaded"]').waitFor();
  const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth>innerWidth,screen:document.querySelector('.seniority-screen').scrollWidth>innerWidth,scroll:document.querySelector('.seniority-scroll').scrollWidth>document.querySelector('.seniority-scroll').clientWidth}));assert.deepEqual(overflow,{body:false,screen:false,scroll:false});
  await page.screenshot({path:path.join(privateDir,'ui-isolated-'+width+'.png')});checks.push('Responsive '+width+'px without horizontal overflow');
 }
 await page.locator('.seniority-scroll').evaluate(el=>el.scrollTo(0,el.scrollHeight));await page.waitForFunction(()=>document.querySelectorAll('[data-seniority-row]').length===75);assert.equal(await page.locator('[data-seniority-unit]').count(),2);
 assert.equal(await page.locator('[data-seniority-total]').getAttribute('data-seniority-total'),'75');
 assert.deepEqual(await page.evaluate(()=>testCalls.map(x=>x.offset)),[0,50]);checks.push('Scroll loads only the next page; one unit spanning pages remains one group with exact totals');
 assert.equal(await page.locator('.seniority-nav button').count(),1);assert.equal(await page.getByRole('button',{name:/descarg/i}).count(),0);
 const centered=await page.evaluate(()=>{const nav=document.querySelector('.seniority-nav').getBoundingClientRect(),title=document.querySelector('.seniority-nav > span:not([aria-hidden])').getBoundingClientRect();return Math.abs((title.left+title.right)/2-(nav.left+nav.right)/2);});assert(centered<1,'title off-center by '+centered+'px');
 checks.push('Header has only the back button (download removed) and the title stays centered');
 const units=()=>page.locator('[data-seniority-unit]').evaluateAll(nodes=>nodes.map(n=>n.dataset.seniorityUnit)),summary=()=>page.locator('[data-seniority-total]').textContent();
 await page.evaluate(()=>{testCalls=[];mountTest();});await page.locator('[data-seniority="loaded"]').waitFor();
 const box=page.getByRole('searchbox',{name:'Buscar módulo de trabajo',exact:true});await box.fill('modulo');await page.locator('[data-seniority-matches]').waitFor();
 assert.deepEqual(await page.evaluate(()=>testCalls.map(x=>[x.offset,x.limit])),[[0,50],[50,100]]);
 assert.deepEqual(await units(),['MÓDULO DE PRUEBA']);assert.equal(await page.locator('[data-seniority-row]').count(),15);assert.equal(await summary(),'1 módulo · 15 agremiados · Al 25/11/2026 · Hermosillo');
 await box.fill('Afiliado de prueba 3');await page.getByText('No hay módulos con ese nombre.').waitFor();assert.deepEqual(await units(),[]);
 await box.fill('  Oficinas   CENTRALES ');assert.deepEqual(await units(),['OFICINAS CENTRALES/UNIDAD DE PRUEBA']);assert.equal(await page.locator('[data-seniority-row]').count(),60);assert.equal(await summary(),'1 módulo · 60 agremiados · Al 25/11/2026 · Hermosillo');
 await box.fill('prueba');assert.equal(await summary(),'2 módulos · 75 agremiados · Al 25/11/2026 · Hermosillo');
 await page.getByRole('button',{name:'Borrar búsqueda',exact:true}).click();assert.equal(await box.inputValue(),'');assert.equal((await units()).length,2);assert.equal(await summary(),'75 agremiados · Al 25/11/2026 · Hermosillo');
 await box.fill('xyz');await box.press('Escape');assert.equal(await box.inputValue(),'');assert.equal(await page.getByRole('button',{name:'Borrar búsqueda'}).count(),0);
 assert.equal(await page.evaluate(()=>testCalls.length),2);
 checks.push('Search matches work module or area only (accents/case ignored), never person names; reads remaining pages once; counter, empty state, clear and Escape work');
 await page.getByRole('button',{name:'Regresar a Inicio',exact:true}).click();assert.equal(await page.evaluate(()=>testBack),1);
 await page.evaluate(()=>{testMode='empty';mountTest();});await page.getByText('No hay agremiados que cumplan los criterios.').waitFor();
 await page.evaluate(()=>{testMode='error';mountTest();});await page.getByRole('alert').waitFor();await page.evaluate(()=>{testMode='loaded';});await page.getByRole('button',{name:'Reintentar'}).click();await page.locator('[data-seniority="loaded"]').waitFor();
 checks.push('Back, empty state, visible source error and retry work');assert.deepEqual(errors,[]);
 fs.mkdirSync(out,{recursive:true});const proof={status:'PASS',checks,consoleErrors:0,mode:'ISOLATED_UI_FIXTURES',productionDataAccess:false};fs.writeFileSync(path.join(out,'browser-isolated.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
