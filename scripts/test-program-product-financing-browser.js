'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/program-product-financing-20260922');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync(out,{recursive:true});
 try{
 await page.setContent('<html lang="es"><head><meta charset="utf-8"><style>:root{--surface:#fff;--surface-2:#edf0f5;--bg:#f3f4f6;--ink:#102346;--ink-2:#395071;--ink-3:#8091ac;--guinda:#ad0032;--hairline:#dce1e9;--guinda-50:#fff0f4;--guinda-700:#760020;--neo-sm:0 2px 5px #0001;--neo-inset:inset 0 1px 3px #0001}body{font-family:Arial;margin:0;color:var(--ink)}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}#root{position:relative;height:100vh;overflow:auto}</style></head><body><div id="root"></div></body></html>');
 for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({path:path.join(root,file)});
 await page.evaluate(()=>{
  const h=React.createElement;window.Icon=()=>h('span',null,'•');window.IconTile=window.Icon;window.useFlipRows=()=>{};window.money=x=>'$'+Number(x).toLocaleString('en-US');
  window.Btn=({children,onClick,disabled,...props})=>h('button',{'data-program-product-save':props['data-program-product-save'],onClick,disabled,style:{padding:12,...props.style}},children);
  window.Toggle=({on,onClick})=>h('button',{onClick},on?'Sí':'No');window.ProgramGeneralInfo={keys:[]};
  window.PrivateResourceDemand={};window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{window.lastRpc={name,args};return {data:{id:'product',financing_config:args.p_config},error:null};}})};
  window.AdminRepository={has:()=>true};
 });
 await page.addScriptTag({path:path.join(root,'app/program-catalog-repository.js')});
 await page.evaluate(()=>{
  const repository=window.ProgramCatalogRepository;
  window.ProgramCatalogRepository={...repository,imageAssets:()=>[],financingOptions:async()=>[{type:'union',code:'U1',label:'Sindicato A'},{type:'employment_category',code:'BASE',label:'Base'}]};
  const product={id:'product',program_key:'tours',nombre:'Viaje aislado',desc:'Servicio de prueba aislada',category_raw:'Viajes',precio:17100,commercialMode:'PAYROLL_FIXED',activo:true,sold:false,orden:1,imagenAssets:[],financing_config:null};
  const store={state:()=>({phase:'loaded'}),all:()=>[product],programs:()=>[{key:'tours',label:'Viajes',count:1,active:1,fixed:1}],byProgram:()=>[product],loadProgram:async()=>true,clearSelection:()=>{},save:async(draft,media)=>{await repository.saveAdminItem(draft,media);product.financing_config=window.lastRpc.args.p_config;},move:()=>{},toggle:()=>{}};
  window.programCatalogAdminStore=store;window.useProgramCatalogAdminStore=()=>store;window.fixtureProduct=product;
  window.testRoot=ReactDOM.createRoot(document.querySelector('#root'));
 });
 await page.addScriptTag({path:path.join(root,'app/screens-admin-program-products.jsx')});
 await page.evaluate(()=>testRoot.render(React.createElement(ProgramProductsModule,{app:{admin:{has:()=>true}},onBack:()=>{},header:({title})=>React.createElement('h1',null,title)})));
 await page.locator('[data-program-key=tours]').click();await page.getByText('Viaje aislado',{exact:true}).click();
 for(const marker of ['[data-program-product-field=name]','[data-program-product-field=price]','[data-program-product-field=order]','[data-program-product-active-control]','[data-program-product-sold-control]','[data-program-product-image-input]'])assert.equal(await page.locator(marker).count(),1,marker);
 await page.locator('[data-product-default-rate]').fill('2');await page.locator('[data-product-rate-add]').click();
 await page.getByLabel('Sindicato regla 1',{exact:true}).selectOption('U1');await page.getByLabel('Categoría del empleado regla 1',{exact:true}).selectOption('BASE');await page.getByLabel('Tasa regla 1',{exact:true}).fill('1.5');
 await page.locator('[data-product-down-required]').check();await page.getByLabel('Tipo de enganche').selectOption('PERCENT');await page.getByLabel('Enganche mínimo').fill('10');
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});await page.locator('[data-product-financing-editor]').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'editor-'+width+'.png')});}
 await page.locator('[data-program-product-save]').click();await page.waitForFunction(()=>!document.querySelector('[data-program-product-editor]'));
 const saved=await page.evaluate(()=>window.lastRpc);assert.equal(saved.name,'save_program_catalog_item_financing');assert.equal(saved.args.p_config.default_rate,2);assert.equal(saved.args.p_config.rules[0].rate,1.5);assert.equal(saved.args.p_config.down_payment.value,10);assert.equal(saved.args.p_expected_config,null);
 await page.getByText('Viaje aislado',{exact:true}).click();assert.equal(await page.locator('[data-product-default-rate]').inputValue(),'2');assert.equal(await page.getByLabel('Enganche mínimo').inputValue(),'10');
 await page.locator('[data-program-product-mode=direct]').click();assert(await page.locator('[data-product-default-rate]').isDisabled());await page.locator('[data-program-product-mode=fixed]').click();assert(await page.locator('[data-product-default-rate]').isEnabled());
 await page.getByRole('button',{name:'Restablecer condiciones de Caja Chica'}).click();assert.equal(await page.locator('[data-product-default-rate]').inputValue(),'');await page.locator('[data-program-product-save]').click();assert.equal((await page.evaluate(()=>lastRpc)).args.p_config,null);
 await page.addScriptTag({path:path.join(root,'app/screens-program-product-payment.jsx')});
 await page.evaluate(()=>{
  window.FinancialLegacyRepository={openProgramPaymentSession:async()=>({status:'READY',authorizedPrice:17100,minimumDownPayment:1710,program:{payment_period:'quincenal',custom_term:{min:1,max:24}},loanSession:{id:'isolated'}}),quoteProgramPayment:async(_,down,term)=>{if(window.failQuote)throw {code:'CONDITIONS_CHANGED'};if(down<1710)throw {code:'DOWN_PAYMENT_OUT_OF_RANGE'};const amount=17100-down,interest=Math.round(amount*.02*term*100)/100,total=amount+interest+15*term,payment=Math.round(total/term*100)/100;return {authorizedPrice:17100,downPayment:down,financedAmount:amount,financialResult:{rate:2,paymentPeriod:'quincenal',ratePeriod:'quincenal',paymentCount:term,paymentPerPeriod:payment,interest,administrativeFeePerPayment:15,administrativeFeeTotal:15*term,total},paymentSchedule:{first_payment_date:'2026-10-30',rows:[{number:1,date:'2026-10-30',payment}]}};}};
  testRoot.render(React.createElement(ProgramProductPaymentFlow,{item:fixtureProduct,app:{},onRequestQuote:()=>{}}));
 });
 await page.locator('[data-program-payment-open]').click();await page.getByText('2% quincenal',{exact:true}).waitFor();
 const down=page.locator('input[type=number]');assert.equal(await down.inputValue(),'1710');assert.equal(await down.getAttribute('min'),'1710');
 await down.fill('1700');await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Continuar con esta simulación'}).count(),0);
 await down.fill('2000');await page.getByRole('button',{name:'Continuar con esta simulación'}).waitFor();await page.getByText('Ver 1 pagos',{exact:true}).click();assert.equal(await page.locator('[data-program-payment-schedule]').count(),1);
 await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(out,'simulator-390.png'),fullPage:true});
 await page.evaluate(()=>window.failQuote=true);await down.fill('2100');await page.getByText('Las condiciones cambiaron. Actualiza el plan antes de continuar.').waitFor();await page.evaluate(()=>window.failQuote=false);await page.getByRole('button',{name:'Actualizar plan de pago'}).click();await page.getByText('2% quincenal',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);const result={status:'PASS',isolated:true,adminSaveReload:true,rateAudience:true,requiredDownPayment:true,inheritanceReset:true,directContactPreserved:true,simulatorMinimum:true,staleSessionRetry:true,calendar:true,viewports:[390,1280],browserErrors:errors,productionWrites:0};
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
