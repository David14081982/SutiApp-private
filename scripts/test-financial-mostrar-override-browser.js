/* Isolated browser test. No credentials, production connections, or business writes. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const out=path.join(root,'docs/qa/evidence/financial-mostrar-override');
const categories=['Eventuales','Suplentes variables','Suplentes fijos'];
const rows=categories.map((category,i)=>({id:'isolated-rule-'+i,rule_id:'00000000-0000-0000-0000-00000000000'+i,criterion_identity:'SUPABASE_RULE:00000000-0000-0000-0000-00000000000'+i,
 program_id:'prestamo',fund:'Fondo de prueba '+(i+1),category,union:'SUTISSSTESON',max_amount:10000,rate:6,payment_count:1,term_label:'1 pago',payment_period:'quincenal',
 available_on:'2026-11-30',status:'UNAVAILABLE',sheet_row:null,visibility_mode:'AUTO',automatic_visibility:'HIDDEN',effective_visibility:'HIDDEN',visibility_window_start:'2026-11-06',visibility_window_end:'2027-03-31',permanent:false}));
async function main(){
 fs.mkdirSync(out,{recursive:true});let browser,checks=0;const errors=[],network=[];
 const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu','--no-first-run','--disable-background-networking']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>{network.push(route.request().url());return route.abort();});
  async function mount(source,permission=true,width=1440){
   const page=await context.newPage();await page.setViewportSize({width,height:1000});page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<!doctype html><html><head><style>:root{--surface:#fff;--surface-2:#f4f6fa;--bg:#eef0f4;--ink:#17202e;--ink-2:#344054;--ink-3:#667085;--guinda:#8a1237;--guinda-50:#f8edf1;--hairline:#ddd;--neo-sm:0 2px 7px #0001}*{box-sizing:border-box}body{margin:0;font-family:Arial}button{cursor:pointer}.su-app-scroll{overflow:auto}#root{position:relative;min-height:100vh}h1{font-size:20px;margin:14px}</style></head><body><div id="root"></div></body></html>');
   await page.addScriptTag({path:path.join(root,'app/vendor/react-18.3.1/react.production.min.js')});await page.addScriptTag({path:path.join(root,'app/vendor/react-dom-18.3.1/react-dom.production.min.js')});
   await page.evaluate(({rows,permission})=>{
    const h=React.createElement;window.fixture={rows,writes:[],refreshes:0,permission,failNext:false,confirm:true};window.confirm=()=>fixture.confirm;
    window.Icon=()=>h('span',{'aria-hidden':true},'•');window.Badge=({children})=>h('span',null,children);
    window.Btn=({children,variant,full,...props})=>h('button',props,children);window.EmptyState=({title,sub})=>h('div',null,title,' ',sub);window.SavingsLoanAccessAdmin=()=>null;
    window.financialLegacyStore={loadOverview:async()=>{fixture.refreshes++;}};
    window.FinancialLegacyRepository={
     listCriteriaCatalog:async()=>({rules:fixture.rows}),
     getFinancialAdminCatalog:async()=>({authority:'SUPABASE',programs:[{id:'prestamo',name:'Suti Préstamo',enabled:true,publication_status:'PUBLISHED',version:1}],funds:[],rules:[]}),
     setCriteriaVisibility:async(id,mode,reason)=>{
      if(!fixture.permission)throw Error('VISIBILITY_WRITE_REQUIRED');
      if(reason.trim().length<8)throw Error('VISIBILITY_CHANGE_INVALID');
      if(fixture.failNext){fixture.failNext=false;throw Error('No fue posible guardar: error de prueba');}
      const row=fixture.rows.find(r=>r.criterion_identity===id);if(!row)throw Error('CRITERION_FINGERPRINT_MISMATCH');
      fixture.writes.push({id,mode,reason});row.visibility_mode=mode;row.effective_visibility=mode==='MOSTRAR'?'VISIBLE':'HIDDEN';row.status=mode==='MOSTRAR'?'AVAILABLE':'UNAVAILABLE';
     }};
   },{rows,permission});
   await page.addScriptTag({path:path.join(root,'app/funds-store.jsx')});await page.addScriptTag({content:source});
   await page.evaluate(()=>{const h=React.createElement;ReactDOM.createRoot(document.getElementById('root')).render(h(window.FondosModule,{app:{admin:{has:key=>fixture.permission&&key==='financial_criteria.visibility.write'},toast:()=>{}},onBack:()=>{},header:({title})=>h('h1',null,title)}));});
   await page.waitForFunction(()=>window.fundsStore.status()==='ready');if(width>=1024)await page.waitForSelector('[data-criteria-detail]:not([data-criteria-detail=empty])');else await page.waitForSelector('[data-criterion-row]');return page;
  }
  const built=process.argv.includes('--bundle');const bundle=read('app/bundle.js');const marker='/* @@file screens-admin-fondos.jsx */';const start=bundle.indexOf(marker),end=bundle.indexOf('/* @@file ',start+marker.length);const source=built?bundle.slice(start,end<0?undefined:end):read('app/screens-admin-fondos.jsx');const baselinePath='.tmp/financial-mostrar-override/before/app/screens-admin-fondos.jsx';
  const structure=page=>page.evaluate(()=>({tabs:[...document.querySelectorAll('[role=tab]')].map(e=>e.textContent),headers:[...document.querySelectorAll('th')].map(e=>e.textContent),filters:[...document.querySelectorAll('select')].map(e=>e.getAttribute('aria-label')),sections:[...document.querySelectorAll('.pcmx-detail-card h3')].map(e=>e.textContent),rows:document.querySelectorAll('[data-criteria-row]').length}));
  let originalStructure=null;
  if(fs.existsSync(path.join(root,baselinePath))){const before=await mount(read(baselinePath));originalStructure=await structure(before);await before.screenshot({path:path.join(out,'desktop-before.png')});await before.close();}
  const page=await mount(source);if(originalStructure)check(await structure(page),originalStructure,'existing desktop sections/controls preserved');
  check(await page.locator('[data-criteria-row]').count(),3,'all unavailable rules listed');
  check(await page.locator('[data-visibility-control]').count(),1,'desktop visibility permission exposes control');
  check(await page.locator('[data-financial-rule-edit]').count(),0,'visibility permission does not grant financial rule editing');
  await page.getByRole('textbox',{name:'Buscar criterios de programas'}).fill('Fondo de prueba 2');check(await page.locator('[data-criteria-row]').count(),1,'search preserved');await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
  await page.getByRole('combobox',{name:'Filtrar por categoría'}).selectOption(categories[1]);check(await page.locator('[data-criteria-row]').count(),1,'category filter preserved');await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
  await page.locator('.pcmx-compare-cell input').nth(0).check();await page.locator('.pcmx-compare-cell input').nth(1).check();check(await page.locator('[data-criteria-comparison="2"]').count(),1,'comparison preserved');
  await page.locator('[data-criteria-row]').first().click();
  const target=await page.locator('[data-visibility-control]').getAttribute('data-visibility-control');
  await page.locator('[data-visibility-control]').click();
  const editor=page.locator('[data-visibility-editor]');const confirm=editor.getByRole('button',{name:'Confirmar cambio',exact:true});
  await editor.getByRole('button',{name:/Mostrar excepcionalmente/}).click();check(await confirm.isDisabled(),true,'reason required');
  await editor.locator('textarea').fill('corto');check(await confirm.isDisabled(),true,'short reason rejected');
  await editor.locator('textarea').fill('Excepción autorizada de prueba');
  await page.evaluate(()=>{fixture.confirm=false;});await confirm.click();check(await page.evaluate(()=>fixture.writes.length),0,'cancel confirmation writes nothing');
  await page.evaluate(()=>{fixture.confirm=true;fixture.failNext=true;});await confirm.click();await editor.getByText('No fue posible guardar: error de prueba',{exact:true}).waitFor();check(await page.evaluate(()=>fixture.writes.length),0,'failed save has no optimistic change');
  await confirm.click();await editor.waitFor({state:'detached'});
  check(await page.evaluate(id=>fundsStore.get(id).status,target),'AVAILABLE','selected rule becomes available');
  check(await page.evaluate(id=>fundsStore.all().filter(r=>r.id!==id).map(r=>r.status),target),['UNAVAILABLE','UNAVAILABLE'],'other rules stay unavailable');
  check(await page.evaluate(()=>fixture.refreshes),1,'overview refresh after save');
  await page.screenshot({path:path.join(out,'desktop-after.png')});
  await page.locator('[data-visibility-control]').click();await editor.getByRole('button',{name:/Automático/}).click();await editor.locator('textarea').fill('Restaurar política automática');await confirm.click();await editor.waitFor({state:'detached'});check(await page.evaluate(id=>fundsStore.get(id).status,target),'UNAVAILABLE','AUTO restores cutoff');
  await page.setViewportSize({width:1024,height:768});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'1024 desktop no page overflow');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-criterion-row]').first().waitFor();check(await page.locator('[data-criterion-row]').count(),3,'mobile cards preserved');
  await page.locator('[data-visibility-control]').first().click();await editor.getByRole('button',{name:/Mostrar excepcionalmente/}).click();await editor.locator('textarea').fill('Excepción móvil de prueba');await confirm.click();await editor.waitFor({state:'detached'});
  check(await page.evaluate(id=>fundsStore.get(id).status,target),'AVAILABLE','mobile MOSTRAR works');await page.screenshot({path:path.join(out,'mobile-after.png')});
  await page.locator('[data-visibility-control]').first().click();await editor.getByRole('button',{name:/^Ocultar/}).click();await editor.locator('textarea').fill('Ocultar excepción de prueba');await confirm.click();await editor.waitFor({state:'detached'});check(await page.evaluate(id=>fundsStore.get(id).status,target),'UNAVAILABLE','OCULTAR hides the exception');
  for(const width of [1440,390]){const readonly=await mount(source,false,width);check(await readonly.locator('[data-visibility-control]').count(),0,'read-only profile has no visibility control at '+width);check(await readonly.locator('[data-visibility-editor]').count(),0,'read-only profile cannot open editor');await readonly.close();}
  check(errors,[],'no browser exceptions');check(network,[],'no external or production requests');
  const result={status:'PASS',checks,isolated:true,realBrowser:'Chrome',viewports:[1440,1024,390],structurePreserved:!!originalStructure,builtModuleTested:built,productionWrites:0,networkRequests:network.length};fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{if(browser)await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
