'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {root,privateDir,chromium,serve,login,inspect}=require('./test-text-size-helpers');
(async()=>{
 const local=process.argv[2]?null:await serve(),url=process.argv[2]||local.url;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:320,height:844},reducedMotion:'reduce'});page.setDefaultTimeout(25000);
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER_ERROR '+e.message);});
 try {await login(page,url);await page.waitForTimeout(3500);if(await page.getByRole('button',{name:'Ahora no',exact:true}).count())await page.getByRole('button',{name:'Ahora no',exact:true}).click();else if(await page.getByRole('button',{name:'Cerrar',exact:true}).count())await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();await page.waitForTimeout(400);const results=[];
  await page.evaluate(()=>{const Original=window.TopBar;window.TopBar=props=>{window.__qaApp=props.app;return React.createElement(Original,props);};});
  for(const width of [320,390,430])for(const size of ['normal','large','largest'])for(const tab of ['home','financiera','convenios','historial','credencial']){
   await page.setViewportSize({width,height:844});
   await page.locator('[data-app-tab="'+tab+'"]').click();await page.waitForTimeout(2200);
   await page.locator('[data-text-size]').evaluate((e,size)=>e.setAttribute('data-text-size',size),size);await page.waitForTimeout(250);
   const result=await inspect(page);results.push({tab,...result});await page.screenshot({path:path.join(privateDir,tab+'-'+width+'-'+size+'.png')});console.log([tab,width,size,result.issues.length].join(' '));
  }
  for(const width of [320,390,430])for(const size of ['normal','large','largest'])for(const route of ['perfil','settings','notifs','savings','loan','documentos']){
   await page.setViewportSize({width,height:844});await page.evaluate(route=>__qaApp.push(route),route);await page.waitForTimeout(1800);if(route==='loan')await page.locator('[data-simulator-result=ready]').waitFor({timeout:60000});await page.locator('[data-text-size]').evaluate((e,size)=>e.setAttribute('data-text-size',size),size);await page.waitForTimeout(200);const result=await inspect(page);results.push({tab:route,...result});if(route==='loan')await page.screenshot({path:path.join(privateDir,'loan-'+width+'-'+size+'.png')});console.log([route,width,size,result.issues.length].join(' '));await page.evaluate(()=>__qaApp.back());await page.waitForTimeout(150);
  }
  fs.writeFileSync(path.join(privateDir,'inspection.json'),JSON.stringify({results,errors},null,2));const failures=results.filter(r=>r.issues.length||r.bodyOverflow);const report={status:failures.length||errors.length?'FAIL':'PASS',target:url.startsWith('http:')?'LOCAL_BUILD':'PRODUCTION',combinations:9,surfaces:results.length,errors,failures:failures.map(r=>({screen:r.tab,width:r.viewport,size:r.scale,issueTypes:r.issues.map(i=>i.type)}))};const out=path.join(root,'docs/qa/evidence/text-size-20260909');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,url.startsWith('http:')?'browser-result.json':'browser-production.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(report.status,'PASS');
 }finally{await browser.close();if(local)local.server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
