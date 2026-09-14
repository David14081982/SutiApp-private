'use strict';
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{for(const width of [320,430,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.abort());await page.setContent('<html><body><div id="root"></div></body></html>');
  for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/savings-repository.js','app/savings-store.jsx','app/savings-request-form.jsx','app/screens-savings.jsx'])await page.addScriptTag({content:fs.readFileSync(f,'utf8')});
  await page.evaluate(()=>{
   window.calls=[];window.fail=true;window.saved=null;window.intakeClosed=false;window.number=0;
   window.crypto.randomUUID=()=>`test-${++number}`;
   window.affiliate='affiliate-one';
   window.AffiliateAuth={getState:()=>({phase:'authenticated',affiliate:{id:affiliate},session:{user:{id:'actor'},session_id:'session'}}),subscribe:()=>()=>{}};
   window.SutiSupabase={getClient:()=>({rpc:async(name,input)=>{
    const context={actor_auth_user_id:'actor',effective_affiliate_id:affiliate,actor_session_id:'session',impersonation_id:''};
    if(name==='get_self_savings_if_changed')return {data:{modified:true,cacheable:false,context,data:{participant:null,balances:{total:0},actions:{JOIN:false},write_capabilities:{requests:false},cutover_status:'PRIVATE'}}};
    if(name==='get_self_savings_join_context')return {data:{context,can_join:!saved&&!intakeClosed,reason:saved?'REQUEST_PENDING':intakeClosed?'INTAKE_CLOSED':null,request:saved,amount:input.p_amount||500,registration_date:'2026-09-06',first_discount_on:'2026-11-05',frequency:'MONTHLY',upcoming:[{contribution_date:'2026-11-05',expected_amount:input.p_amount||500},{contribution_date:'2026-12-05',expected_amount:input.p_amount||500}]}};
    if(name==='submit_self_savings_join'){calls.push({idempotencyKey:input.p_idempotency_key,newContributionAmount:input.p_amount,reason:input.p_observation,expectedAffiliate:input.p_expected_affiliate_id});if(fail){fail=false;throw Error('NETWORK');}saved={id:'request',folio:'AHO-TEST',status:'SUBMITTED',submitted_at:'2026-09-06T20:00:00Z',effective_from:'2026-11-05',amount:input.p_amount,usuario_contexto_affiliate_id:affiliate,actor_real_auth_user_id:'actor'};return {data:saved};}
    throw Error('Unexpected RPC '+name);
   }})};
   ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(SavingsScreen,{app:{back:()=>{}}}));
  });
  await page.getByRole('button',{name:'Ingresar al ahorro',exact:true}).click();await page.getByLabel('Monto de cada descuento').fill('500');
  await page.locator('[data-savings-join-preview]').getByText('Primer descuento previsto:',{exact:false}).waitFor();
  await page.locator('[data-savings-join-preview] summary').click();assert.equal(await page.locator('[data-savings-join-preview] .sav-row').count(),2);
  await page.getByRole('button',{name:'Revisar solicitud',exact:true}).click();assert.equal(await page.evaluate(()=>calls.length),0);
  await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).click();await page.getByRole('button',{name:'Entendido',exact:true}).waitFor();
  const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,2);assert.equal(calls[0].idempotencyKey,calls[1].idempotencyKey);assert.equal(calls[0].newContributionAmount,500);assert.equal(calls[0].reason,'');assert.equal(calls[0].expectedAffiliate,'affiliate-one');
  await page.getByRole('button',{name:'Entendido',exact:true}).click();await page.getByRole('heading',{name:'Tu solicitud de ingreso'}).waitFor();assert(await page.getByRole('button',{name:'Ingresar al ahorro',exact:true}).isDisabled());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
  await page.evaluate(()=>{saved=null;intakeClosed=true;});await page.getByRole('button',{name:'Actualizar ahorro',exact:true}).click();await page.getByText('Por el momento no se reciben nuevos ingresos al ahorro.').waitFor();assert(await page.getByRole('button',{name:'Ingresar al ahorro',exact:true}).isDisabled());
  const stale=await page.evaluate(async()=>{
   let finish;const client=window.SutiSupabase.getClient();window.SutiSupabase.getClient=()=>({rpc:(name,input)=>name==='get_self_savings_join_context'?new Promise(resolve=>{finish=()=>resolve({data:{context:{actor_auth_user_id:'actor',effective_affiliate_id:'affiliate-one'},can_join:true}});}):client.rpc(name,input)});
   const pending=window.SavingsRepository.getJoinContext(501).then(()=>false,e=>e.message==='SAVINGS_CONTEXT_CHANGED');window.affiliate='affiliate-two';finish();return pending;
  });assert.equal(stale,true);
  await page.close();
 }
 console.log('PASS PRIVATE new saver, server preview, optional observations, retry identity, request history, closed intake, responsive320/430/1440; isolated browser, network blocked');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
