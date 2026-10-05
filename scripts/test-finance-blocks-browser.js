'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),checks=[];
 try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.abort());await page.setContent('<html lang="es"><body><div id="root"></div></body></html>');
 for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
 await page.evaluate(()=>{
  window.currentIdentity='admin-test';window.listeners=[];window.rows=[];window.calls=[];window.fail=false;window.deny=false;
  const subscribe=fn=>{listeners.push(fn);fn();return()=>{listeners=listeners.filter(x=>x!==fn);};};
  window.AffiliateAuth={getState:()=>({session:{user:{id:currentIdentity}},affiliate:{id:'affiliate-test'}}),subscribe};
  window.AdminRepository={getState:()=>({assignment:{id:currentIdentity}}),subscribe};
  window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
   calls.push({name,args});if(fail)return{error:{message:'Unavailable'}};
   if(name==='get_self_finance_block')return{data:{blocked:deny,block:{starts_on:'2026-10-04',ends_on:'2026-10-20',reason:'Expediente pendiente <script>bad</script>'}}};
   if(name==='list_admin_finance_blocks')return{data:structuredClone(rows)};
   if(name==='save_admin_finance_block'){rows=[{id:'block-test',affiliate_id:'affiliate-test',full_name:'Persona sintética',numero_control:'00007',starts_on:args.p_starts_on,ends_on:args.p_ends_on,reason:args.p_reason,version:1,events:[{id:'event-1',action:'CREATE',created_at:new Date().toISOString(),actor_auth_user_id:'admin-test',reason:args.p_reason}]}];return{data:rows[0]};}
   if(name==='revoke_admin_finance_block'){rows[0].revoked_at=new Date().toISOString();rows[0].events.push({id:'event-2',action:'REVOKE',created_at:new Date().toISOString(),actor_auth_user_id:'admin-test',reason:args.p_reason});return{data:rows[0]};}
   throw Error(name);
  }})};
 });
 for(const file of ['app/finance-blocks-repository.js','app/finance-blocks.jsx'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
 await page.evaluate(()=>{window.root=ReactDOM.createRoot(document.getElementById('root'));window.render=write=>root.render(React.createElement(FinanceBlockRequestControl,{app:{admin:{has:()=>write}},request:{id:'request-test',affiliate_id:'affiliate-test'}}));render(true);});
 await page.getByRole('button',{name:'Bloquear programas de Finanzas'}).click();
 await page.getByLabel('Fecha de inicio').fill('2026-10-04');await page.getByLabel('Fecha de fin').fill('2026-10-20');await page.getByLabel('Explicación visible para el afiliado').fill('Expediente pendiente');await page.getByRole('button',{name:'Guardar bloqueo'}).click();
 await page.getByText('Persona sintética · Control 00007').waitFor();assert.equal(await page.locator('[data-finance-block-id]').count(),1);
 await page.getByRole('button',{name:'Editar bloqueo'}).click();assert.equal(await page.getByLabel('Fecha de fin').inputValue(),'2026-10-20');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Levantar bloqueo',exact:true}).click();await page.getByLabel('Motivo para levantar el bloqueo').fill('Revisión completada');await page.getByRole('button',{name:'Confirmar desbloqueo'}).click();await page.getByText('Levantado',{exact:true}).first().waitFor();
 checks.push('create from request; dates/reason/raw control; edit; lift and retained history');
 await page.evaluate(()=>{render(false);});assert.equal(await page.getByRole('button',{name:'Programar nuevo bloqueo'}).count(),0);
 await page.evaluate(()=>{window.backCalls=0;root.render(React.createElement(FinanceBlocksModule,{app:{admin:{has:()=>false}},onBack:()=>{window.backCalls++;},header:({onBack})=>React.createElement('button',{onClick:onBack},'Volver a Finanzas')}));});
 await page.getByRole('button',{name:'Volver a Finanzas'}).click();assert.equal(await page.evaluate(()=>window.backCalls),1);checks.push('history header preserves return navigation');
 await page.getByLabel('Buscar por nombre o número de control').fill('00007');assert.equal(await page.locator('[data-finance-block-id]').count(),1);await page.getByLabel('Buscar por nombre o número de control').fill('no-existe');assert.equal(await page.locator('[data-finance-block-id]').count(),0);
 checks.push('history search and read-only administrator');
 await page.evaluate(async()=>{deny=true;try{await FinanceBlocksRepository.assertAllowed();}catch(e){window.blockCode=e.code;}});
 await page.getByRole('dialog').waitFor();assert.equal(await page.evaluate(()=>blockCode),'FINANCE_REQUEST_BLOCKED');await page.getByText('Expediente pendiente <script>bad</script>',{exact:false}).waitFor();assert.equal(await page.locator('[data-finance-block-explanation] script').count(),0);assert((await page.getByRole('dialog').innerText()).includes('20/10/2026'));
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'Entendido'}).click();
 checks.push('self denial shows inclusive dates and escaped note; mobile modal fits and closes');
 await page.evaluate(()=>{currentIdentity='other-test';listeners.slice().forEach(fn=>fn());});await page.getByText('La sesión cambió. Vuelve a abrir la bitácora.').waitFor();assert.equal(await page.locator('[data-finance-block-id]').count(),0);
 checks.push('immediate subscriptions preserve UI; identity change clears private records');
 assert.deepEqual(errors,[]);
 const dir=path.join(root,'docs/qa/evidence/finance-blocks');fs.mkdirSync(dir,{recursive:true});const result={status:'PASS',checks,productionTouched:false};fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
