'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),release=path.join(root,'tmp/voting-release'),out=path.join(root,'docs/qa/evidence/voting-20260915');
process.env.SUTIAPP_MODULE_SITE_ROOT=release;
const {serve}=require('./test-admin-user-modules-browser');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
async function main(){const production=process.argv.includes('--production'),global=process.argv.includes('--global');
 fs.mkdirSync(out,{recursive:true});
 if(!production)fs.copyFileSync(path.join(root,'app/supabase-config.js'),path.join(release,'app/supabase-config.js'));
 // Windows checkout may convert vendor LF to CRLF and invalidate existing SRI.
 // Serve exact committed bytes; no source/vendor change is introduced.
 if(!production)for(const file of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js','supabase-js-2.112.3/supabase.min.js'])fs.writeFileSync(path.join(release,'app/vendor',file),cp.execFileSync('git',['show','origin/main:app/vendor/'+file],{cwd:root,maxBuffer:4000000}));
 const server=production?null:await serve();
 if(global&&server){await new Promise(r=>server.close(r));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8080,'127.0.0.1',resolve);});}
 const target=production?'https://david14081982.github.io/SutiApp-private/':global?'http://localhost:8080/SutiApp.html':`http://127.0.0.1:${server.address().port}/SutiApp.html`;
 if(global){try{const result=await new Promise((resolve,reject)=>{const child=cp.spawn(process.execPath,[path.join(root,'scripts/test-global-image-regression-production-live.js')],{cwd:root,env:{...process.env,SUTIAPP_IMAGE_E2E_URL:target},windowsHide:true});let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));});
  fs.writeFileSync(path.join(out,production?'global-production.json':'global-local.json'),JSON.stringify(result,null,2));assert.equal(result.code,0,result.stderr.slice(-2500));console.log(JSON.stringify({status:'PASS',global:true,production}));
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}return;}
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addLocatorHandler(page.getByRole('button',{name:'Cerrar',exact:true}),async locator=>locator.click());
 try{
  await page.goto(target+'#/admin/votaciones',{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.locator('[data-voting-admin]').waitFor({timeout:60000});await page.getByRole('button',{name:'Nueva consulta',exact:true}).waitFor({timeout:30000});
  assert.equal(await page.locator('[data-voting-admin] [role=alert]').count(),0);checks.push('real_auth_admin_rpc');
  const live=await page.evaluate(async()=>{const r=await window.VotingRepository.list(false);return {count:r.consultations.length,canVote:r.can_vote};});
  assert.equal(live.count,0,'No authorized production consultation expected at initial release');checks.push('production_empty_no_demo');
  await page.getByRole('button',{name:'Regresar',exact:true}).click();await page.locator('[data-admin-module=votaciones]').waitFor();checks.push('admin_navigation');
  await page.evaluate(()=>location.hash='#/home');await page.locator('[data-reveal-key=ecosistema]').waitFor();await page.waitForTimeout(800);assert.equal(await page.locator('[data-voting-home]').count(),0);checks.push('empty_home_hidden');
  if(!production){
   const fixture={consultations:[{id:'isolated-local',title:'Consulta de verificación visual',closes_on:'2099-09-30',electorate:100,published:true,open:true,questions:[{id:'q1',title:'Pregunta con explicación completa',detail:'Esta consulta existe únicamente en la respuesta interceptada del navegador local.',mine:null,results:null}]}],can_vote:true};
   await page.route('**/rest/v1/rpc/list_voting_consultations',r=>r.request().postDataJSON()?.p_admin?r.continue():r.fulfill({json:fixture}));
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-voting-home] .head').click();
   assert.equal(await page.locator('[data-voting-home] .body').evaluate(e=>getComputedStyle(e).paddingLeft),'18px');
   const ordering=await page.evaluate(()=>{const voting=document.querySelector('[data-voting-home]'),union=[...document.querySelectorAll('h2,h3')].find(e=>e.textContent==='Tu sindicato');return !!(voting&&union&&(voting.compareDocumentPosition(union)&Node.DOCUMENT_POSITION_FOLLOWING));});assert(ordering);checks.push('owner_spacing_and_position');
   for(const size of ['normal','large','largest']){await page.locator('[data-voting-home]').evaluate((e,s)=>e.dataset.textSize=s,size);assert(await page.locator('[data-voting-home]').evaluate(e=>e.scrollWidth<=e.clientWidth),'voting overflow '+size);await page.locator('[data-voting-home]').screenshot({path:path.join(out,'integrated-'+size+'.png')});}
   await page.getByRole('button',{name:'Sí',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Cancelar',exact:true}).click();checks.push('integrated_sheet');
  }
  assert.deepEqual(errors,[]);const result={status:'PASS',checks,production,productionBusinessWrites:0};fs.writeFileSync(path.join(out,production?'production.json':'integrated-local.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(e){await page.screenshot({path:path.join(out,production?'production-failure.png':'integrated-failure.png')});console.error(JSON.stringify({checks,errors,error:e.message}));throw e;}
 finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
