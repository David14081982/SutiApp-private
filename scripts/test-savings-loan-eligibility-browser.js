'use strict';
// Synthetic RPC fixture in a sealed browser origin. No production credentials.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results=[];
 try {for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>:root{--surface:#fff;--surface-2:#f4f5f8;--ink:#182039;--ink-3:#68728a;--guinda:#a00030;--hairline:#dde1ea}body{font-family:Arial;margin:16px;background:#f3f4f7}button:disabled{opacity:.5}</style></head><body><div id="root"></div></body></html>'}));
  await page.goto('https://savings-loan.test/');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
  await page.evaluate(()=>{
   window.calls=[];window.policy={minimum_months:null,starts_from:null,version:0};window.grant=null;window.testHistory=[];window.fail=false;window.retryKeys=[];
   window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
    window.calls.push({name,args});
    if(name==='get_admin_savings_loan_access')return {data:{policy:window.policy,person:args.p_numero_control?{id:'test-affiliate',numero_control:args.p_numero_control,name:'Persona de prueba'}:null,eligibility:args.p_numero_control?{eligible:!!window.grant,ordinary_eligible:false,reason:'NO_ACTUAL_DEDUCTION',active_authorization_id:window.grant,enrollment_date:'2026-09-01',first_deduction_date:null}:null,history:window.testHistory,can_configure:true,can_authorize:true}};
    if(name==='set_admin_savings_loan_policy'){
     window.policy={minimum_months:args.p_months,starts_from:args.p_starts_from,version:window.policy.version+1};
    }else{
     window.retryKeys.push(args.p_client_action_id);
     if(window.fail){window.fail=false;return {error:{message:'NETWORK_ERROR'}};}
     window.grant=args.p_action==='GRANT'?'test-grant':null;
    }
    window.testHistory.unshift({action:name==='set_admin_savings_loan_policy'?'POLICY':args.p_action,created_at:'2026-09-22T18:00:00Z',actor_label:'Finanzas de prueba',reason:args.p_reason});
    return {data:{ok:true}};
   }})};
  });
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'app/savings-loan-eligibility.js'),'utf8')});
  await page.evaluate(()=>{window.testRoot=ReactDOM.createRoot(document.getElementById('root'));window.testRoot.render(React.createElement(window.SavingsLoanAccessAdmin,{app:{admin:{has:()=>true}}}));});
  const header=page.getByRole('button',{name:/Caja de Ahorro · requisitos/});
  await header.click();await page.getByText('Sin configurar:',{exact:false}).waitFor({timeout:5000}).catch(async e=>{throw Error(e.message+' BODY='+await page.locator('body').innerText()+' ERRORS='+JSON.stringify(errors));});
  await page.getByLabel('Meses mínimos ahorrando').fill('13');
  await page.getByLabel('Contar desde').selectOption('FIRST_DEDUCTION');
  await page.getByLabel('Motivo del cambio de regla').fill('Aplicar normativa del programa');
  await page.getByRole('button',{name:'Guardar regla',exact:true}).click();
  await page.getByText('Regla guardada y registrada.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>[window.policy.minimum_months,window.policy.starts_from]),[13,'FIRST_DEDUCTION']);
  await page.getByLabel('Número de control exacto').fill('0007');
  await page.getByRole('button',{name:'Consultar persona',exact:true}).click();
  await page.getByText('Persona de prueba · Control 0007',{exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'Autorizar una solicitud',exact:true}).isDisabled());
  await page.getByLabel('Motivo de la autorización o revocación').fill('Nuevo ahorrador autorizado por Finanzas');
  await page.evaluate(()=>{window.fail=true;});
  await page.getByRole('button',{name:'Autorizar una solicitud',exact:true}).click();
  await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Autorizar una solicitud',exact:true}).click();
  await page.getByText('Autorización registrada para una sola solicitud.',{exact:true}).waitFor();
  const keys=await page.evaluate(()=>window.retryKeys);assert.equal(keys[0],keys[1],'ambiguous retry retains command id');
  await page.getByLabel('Motivo de la autorización o revocación').fill('Revocación solicitada por responsable');
  await page.getByRole('button',{name:'Revocar autorización',exact:true}).click();
  await page.getByText('Autorización revocada.',{exact:true}).waitFor();
  await page.getByLabel('Número de control exacto').fill('0008');
  assert.equal(await page.locator('[data-savings-loan-person]').count(),0,'changing search immediately clears prior target');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  assert.deepEqual(errors,[]);
  const out=path.join(root,'.tmp/savings-loan-eligibility');fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'admin-'+width+'.png'),fullPage:true});
  results.push({width,status:'PASS',checks:['free month entry','date basis','save','exact control','reason','retry idempotency','grant','revoke','target isolation','responsive','no JS errors']});
  await page.close();
 }
 console.log(JSON.stringify({status:'PASS',mode:'ISOLATED_SYNTHETIC_BROWSER',results}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
