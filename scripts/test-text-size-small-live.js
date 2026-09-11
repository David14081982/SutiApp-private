'use strict';
// Real local build and legitimate business data. Only Auth preference READ responses
// are overridden inside this isolated browser to exercise all sizes without writes.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,cp=require('child_process'),crypto=require('crypto');
const {root,privateDir,chromium,serve,login,inspect}=require('./test-text-size-helpers');
const out=path.join(root,'docs/qa/evidence/text-size-small-20260911'),captures=path.join(privateDir,'small-001-captures');
(async()=>{
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(captures,{recursive:true});
 // Use the established local origin allowed by document-access CORS.
 const external=process.argv.find(value=>/^https?:\/\//.test(value));
 const local=external?{url:external,server:{close(){}},build:null}:await serve();
 if(local.build)fs.writeFileSync(path.join(out,process.argv.includes('--global')?'global-pages-build.json':'pages-build.json'),JSON.stringify(local.build,null,2));
 try{
  if(process.argv.includes('--global')){
   const targets=[['local',local.url],['production','https://david14081982.github.io/SutiApp-private/']]
    .filter(([target])=>!process.argv.includes('--local-only')||target==='local')
    .filter(([target])=>!process.argv.includes('--production-only')||target==='production');
   for(const [target,url] of targets){
    let script=path.join(root,'scripts/test-global-image-regression-production-live.js'),harness;
    if(process.argv.includes('--http1')||process.env.SUTIAPP_CHROMIUM_EXECUTABLE){
     // Same established diagnostic transport configuration as test-bottom-nav-labels-global.js.
     const source=fs.readFileSync(script,'utf8'),oldRoot="const root = path.resolve(__dirname, '..');",newRoot='const root = '+JSON.stringify(root)+';',oldFlags="'--disable-gpu']",newFlags="'--disable-gpu', '--disable-http2', '--disable-quic']";
     assert(source.includes(oldRoot)&&source.includes(oldFlags));const chromeLine=source.match(/^const chromePath = .+;$/m)[0],newChrome=process.env.SUTIAPP_CHROMIUM_EXECUTABLE?'const chromePath = '+JSON.stringify(process.env.SUTIAPP_CHROMIUM_EXECUTABLE)+';':chromeLine;
     const selectedFlags=process.argv.includes('--http1')?newFlags:oldFlags;
     const configured=source.replace(oldRoot,newRoot).replace(oldFlags,selectedFlags).replace(chromeLine,newChrome);
     assert.equal(configured.replace(newRoot,oldRoot).replace(selectedFlags,oldFlags).replace(newChrome,chromeLine),source,'No changes to assertions, corpus or timeouts');
     script=path.join(privateDir,'small-global-http1.js');fs.writeFileSync(script,configured);
     harness={file:'scripts/test-global-image-regression-production-live.js',sha256:crypto.createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex'),browserTransport:process.argv.includes('--http1')?'HTTP_1_1':'DEFAULT',configuredBrowser:!!process.env.SUTIAPP_CHROMIUM_EXECUTABLE,assertionOrCorpusChanges:0,timeoutChanges:0};
    }
    const child=cp.spawn(process.execPath,[script],{cwd:root,env:{...process.env,SUTIAPP_IMAGE_E2E_URL:url},windowsHide:true});let stdout='',stderr='';
    child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
    const code=await new Promise(resolve=>child.on('close',resolve));fs.writeFileSync(path.join(privateDir,'small-global-'+target+'.log'),stdout+'\n'+stderr);
    let result;try{result=JSON.parse((stdout.trim()||stderr.trim()).split(/\r?\n/).at(-1));}catch{result={status:'FAIL',exitCode:code,details:'See private small-global-'+target+'.log'};}if(harness)result.harness=harness;
    fs.writeFileSync(path.join(out,'global-'+target+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({target,exitCode:code,status:result.status}));if(code||result.status!=='PASS')process.exitCode=1;
   }
   return;
  }
  const browser=await chromium.launch({executablePath:process.env.SUTIAPP_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
   const context=await browser.newContext({viewport:{width:320,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(30000);
   let fixtureSize='normal';const errors=[],writes=[],results=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/auth/v1/user',async route=>{
    if(route.request().method()!=='GET'){writes.push(route.request().method());return route.abort();}
    const response=await route.fetch();if(!response.ok())return route.fulfill({response});const body=await response.json();
    body.user_metadata={...body.user_metadata,sutiapp_text_size:fixtureSize};await route.fulfill({response,json:body});
   });
   await login(page,local.url);
   const invitation=page.getByRole('button',{name:'Ahora no',exact:true});
   if(await invitation.count())await invitation.click();
   else {const close=page.getByRole('button',{name:'Cerrar',exact:true});if(await close.count())await close.last().click();}
   await page.evaluate(()=>{const Original=window.TopBar;window.TopBar=props=>{window.__qaApp=props.app;return React.createElement(Original,props);};});
   for(const width of [320,390,430])for(const size of ['small','normal','large','largest']){
    fixtureSize=size;await page.setViewportSize({width,height:844});
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(size=>document.querySelector('[data-text-size]')?.dataset.textSize===size&&document.querySelector('[data-nav-text-size]')?.dataset.navTextSize===size,size);
    for(const tab of ['home','financiera','convenios','historial','credencial','settings']){
     if(tab==='settings')await page.evaluate(()=>__qaApp.push('settings'));
     else await page.locator('[data-app-tab="'+tab+'"]').click();
     await page.waitForTimeout(1400);await page.evaluate(()=>document.fonts.ready);
     const result=await inspect(page),file=tab+'-'+width+'-'+size+'.png';
     await page.screenshot({path:path.join(captures,file)});
     if(tab==='settings'){
      assert.deepEqual(await page.getByRole('radio').evaluateAll(es=>es.map(e=>e.value)),['small','normal','large','largest']);
      assert(await page.locator('input[type=radio][value="'+size+'"]').isChecked());
      const rows=await page.locator('.su-text-option').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,width:r.width};}));
      assert(rows.every(r=>r.left>=0&&r.right<=width&&r.height>=44&&r.width>=44));
      await page.evaluate(()=>__qaApp.back());
     }
     results.push({screen:tab,width,size,file,...result});console.log([tab,width,size,result.issues.length].join(' '));
    }
   }
   fs.writeFileSync(path.join(captures,'inspection.json'),JSON.stringify({results,errors,writes},null,2));
   const failures=results.filter(r=>r.issues.length||r.bodyOverflow);
   const report={status:failures.length||errors.length||writes.length?'FAIL':'PASS',target:'LOCAL_BUILD',screens:6,widths:[320,390,430],sizes:['small','normal','large','largest'],captures:results.length,captureDirectory:captures,preferenceReadFixture:true,businessData:'Legitimate existing data',businessWrites:0,authWrites:writes.length,errors,failures:failures.map(r=>({screen:r.screen,width:r.width,size:r.size,types:r.issues.map(i=>i.type)}))};
   fs.writeFileSync(path.join(out,'screen-matrix.json'),JSON.stringify(report,null,2));assert.equal(report.status,'PASS');console.log(JSON.stringify(report));
  }finally{await browser.close();}
 }finally{local.server.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
