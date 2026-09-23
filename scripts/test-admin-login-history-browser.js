'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/admin-login-history-20260923');
async function main(){
 process.env.SUTIAPP_MODULE_SITE_ROOT=path.join(root,'tmp/login-history-site');
 const production=process.argv.includes('--production'),live=production||process.argv.includes('--live'),server=live&&!production?await serve():null;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage(),checks=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  if(live){
   const e={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)e[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
   await page.goto(production?'https://david14081982.github.io/SutiApp-private/#/admin/login_history':`http://127.0.0.1:${server.address().port}/SutiApp.html#/admin/login_history`);
   await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
   await page.locator('[data-admin-login-history] tbody tr').first().waitFor({timeout:60000});
   assert(await page.locator('[data-admin-sidebar-module=login_history]').count());checks.push('actual bundle/router/Admin sidebar/production RPC');
   await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByRole('status').filter({hasText:'cuentas han ingresado'}).waitFor();assert.equal(await page.getByRole('alert').count(),0);await page.locator('tbody tr').first().waitFor();checks.push('native history contains real login events');
   await page.reload();await page.locator('[data-admin-login-history] tbody tr').first().waitFor({timeout:60000});checks.push('deep-link refresh');
  }else{
   await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--surface:#fff;--line:#ddd;--ink:#222;--ink-3:#666}body{font:14px Arial;margin:0}button:disabled{opacity:.5}.su-app-scroll{box-sizing:border-box}</style></head><body><div id="root"></div></body></html>');
   for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/login-history-repository.js','app/screens-admin-login-history.jsx'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
   await page.evaluate(()=>{
    window.testState={fail:false,empty:false,slow:false,allowed:true,calls:[]};
    window.AdminRepository={has:()=>testState.allowed};
    window.SutiSupabase={getClient:()=>({rpc:async(name,f)=>{
      testState.calls.push(f);const slow=testState.slow;if(slow)await new Promise(r=>setTimeout(r,600));
      if(testState.fail)return {error:new Error('denied')};
      const total=testState.empty?0:131;
      return {data:{items:Array.from({length:Math.min(25,Math.max(0,total-(f.p_page-1)*25))},(_,i)=>({id:String((f.p_page-1)*25+i),full_name:slow?'OLD RESPONSE':'Persona de prueba '+((f.p_page-1)*25+i),email:'prueba@example.invalid',numero_control:'0007',phone:i?'': '6621234567',historical_phone:'6627654321',occurred_at:'2026-09-23T07:30:00Z'})),total,total_users_signed_in:131,users_in_filter:131,history_available_from:'2026-09-23T07:30:00Z'}};
    }})};
    window.mount=()=>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.LoginHistoryModule,{app:{admin:{has:()=>testState.allowed}},header:({title})=>React.createElement('h1',null,title),onBack:()=>{}}));mount();
   });
   await page.locator('tbody tr').first().waitFor();assert.equal(await page.locator('tbody tr').count(),25);
   for(let i=0;i<5;i++)await page.getByRole('button',{name:'Siguiente',exact:true}).click();
   await page.getByText('Página 6 de 6',{exact:true}).waitFor();assert.equal(await page.locator('tbody tr').count(),6);assert(await page.getByRole('button',{name:'Siguiente',exact:true}).isDisabled());checks.push('pagination beyond 100');
   await page.getByLabel('Buscar nombre, control, correo o teléfono').fill('0007');await page.getByLabel('Desde',{exact:true}).fill('2026-09-22');await page.getByLabel('Hasta',{exact:true}).fill('2026-09-23');await page.getByRole('button',{name:'Buscar',exact:true}).click();
   await page.getByText('Página 1 de 6',{exact:true}).waitFor();let last=await page.evaluate(()=>testState.calls.at(-1));assert.equal(last.p_query,'0007');assert.equal(last.p_from,'2026-09-22');checks.push('search/date filter resets page');
   await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByText(/Cada fila corresponde/).waitFor();assert.equal((await page.evaluate(()=>testState.calls.at(-1))).p_mode,'history');checks.push('history and latest access semantics');
   await page.evaluate(()=>testState.fail=true);await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('tbody tr').count(),0);checks.push('error hides prior personal data');
   await page.evaluate(()=>{testState.fail=false;testState.empty=true;});await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.getByText('No hay accesos registrados para estos filtros.').waitFor();checks.push('empty state');
   await page.evaluate(()=>{testState.empty=false;testState.slow=true;});await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByText('Consultando accesos…').waitFor();await page.evaluate(()=>testState.slow=false);await page.getByRole('button',{name:'Usuarios que ya ingresaron',exact:true}).click();await page.locator('tbody tr').first().waitFor();await page.waitForTimeout(700);assert.equal(await page.getByText('OLD RESPONSE',{exact:true}).count(),0);checks.push('loading and stale request cancellation');
   assert(await page.getByText('Sin teléfono confirmado',{exact:true}).count());assert(await page.getByText('Histórico: 6627654321',{exact:true}).count());checks.push('confirmed and historical phone explicitly separated');
  }
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('mobile overflow contained in results table');
  if(!live)await page.screenshot({path:path.join(out,'mobile-fixture.png'),fullPage:true});
  assert.deepEqual(errors,[]);const result={status:'PASS',mode:production?'production':live?'live-local':'isolated fixtures',checks,personalDataStored:false};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,production?'browser-production.json':live?'browser-live.json':'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await context.close();await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
