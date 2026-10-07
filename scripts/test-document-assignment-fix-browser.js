/* Isolated React/Chrome behavioral contract. No network or production records. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const playwright=require(process.env.PLAYWRIGHT_CORE_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const Babel=require(process.env.BABEL_STANDALONE_PATH||'C:/tmp/babel-standalone-7.29.0.min.js');
const sourcePath='app/screens-admin-document-generation.jsx';
const source=fs.readFileSync(path.join(root,sourcePath),'utf8');
const original=cp.execFileSync('git',['show','HEAD:'+sourcePath],{cwd:root,encoding:'utf8',maxBuffer:4e6});
const compile=s=>Babel.transform(s,{presets:['react'],sourceType:'script'}).code;
const currentCode=compile(source),originalCode=compile(original);
const result={status:'FAIL',fixture:'isolated synthetic records, all HTTP(S) blocked',baselineCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),viewports:{},checks:{},pageErrors:[],networkRequests:[]};

function fixture(){
 const template=(id,name,active=false)=>({id,name,active,version:1,asset_id:null,valid_from:'2020-01-01',margins:{top:34,bottom:28,left:22,right:22},page_size:{width:612,height:792}});
 const signer=(n,enabled=true)=>({id:'signer-'+n,person_id:'person-'+n,full_name:'Responsable de prueba '+n,title:'Cargo de prueba '+n,enabled,valid_from:'2020-01-01',valid_until:null,asset_id:null});
 const config=(program,type,template_id)=>({id:'config-'+program+'-'+type,program,document_type:type,template_id,follow_active:false,valid_from:'2020-01-01',valid_until:null,signers:[{version_id:'signer-1',role:'Autoriza'},{version_id:'signer-2',role:'Testigo'}]});
 const assignment=(program,type,template_id,fund_key='')=>({id:'assignment-'+program+'-'+type+'-'+fund_key,program,document_type:type,fund_key,layout_id:'layout-'+program+'-'+type+'-'+fund_key,layout_name:'Diseño de prueba',layout_version:1,template_id,template_name:template_id==='new'?'Solicitudes de préstamo':'PROGRAMAS FINANCIEROS',template_version:1});
 return {templates:[template('new','Solicitudes de préstamo',true),template('old','PROGRAMAS FINANCIEROS')],signers:[signer(1),signer(2),signer(3,false)],signer_versions:[],programs:['auto'],permissions:Object.fromEntries(['read','templates.write','signers.write','signatures.read','signatures.write','config.write'].map(k=>[k,true])),configurations:[config('membership','MEMBERSHIP_APPROVAL','new'),config('prestamo','LOAN_APPROVAL','new'),config('caja','LOAN_APPROVAL','old'),config('caja','SAVINGS_ENROLLMENT_APPROVAL','new'),config('auto','PROGRAM_FINANCING_APPROVAL','old')],layout_assignments:[assignment('membership','MEMBERSHIP_APPROVAL','old'),assignment('membership','MEMBERSHIP_APPROVAL','new','company-variant'),assignment('prestamo','LOAN_APPROVAL','new'),assignment('caja','LOAN_APPROVAL','old'),assignment('caja','SAVINGS_ENROLLMENT_APPROVAL','new')]};
}

async function mount(browser,width,code=currentCode,options={}){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();
 page.setDefaultTimeout(10000);
 page.on('pageerror',e=>result.pageErrors.push(e.message));
 await context.route('**/*',route=>{const url=route.request().url();if(url==='http://127.0.0.1/assignment-fixture')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="es"><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0}button,input,select{font:inherit}</style></head><body><div id="root"></div></body></html>'});if(/^https?:/.test(url)){result.networkRequests.push(url);return route.abort();}return route.continue();});
 await page.goto('http://127.0.0.1/assignment-fixture');
 for(const asset of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/document-generation-design.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,asset),'utf8')});
 await page.evaluate(({data,options})=>{
  window.fixture=data;window.calls=[];window.testOptions=options;window.backCount=0;window.designerCalls=[];
  if(options.noMetadata)delete data.layout_assignments;
  if(options.emptyAssignments)data.layout_assignments=[];
  window.DocumentGenerationRepository={context:()=> 'isolated-actor',dashboard:async()=>{window.calls.push({action:'DASHBOARD'});return structuredClone(data);},list:async()=>[],asset:async()=>({url:'about:blank'}),preview:async(program,document_type,config)=>{window.calls.push({action:'LEGACY_PREVIEW',payload:structuredClone({program,document_type,config})});return new Blob(['%PDF-1.4\n% isolated fixture'],{type:'application/pdf'});},command:async(action,payload)=>{window.calls.push({action,payload:structuredClone(payload)});if(action!=='SAVE_CONFIGURATION')throw Error('UNEXPECTED_MUTATION_'+action);const index=data.configurations.findIndex(c=>c.program===payload.program&&c.document_type===payload.document_type);const value={...payload,id:'legacy-saved'};if(index<0)data.configurations.push(value);else data.configurations[index]=value;return value;}};
  window.DocumentLayoutRepository={request:async(action,payload)=>{
   window.calls.push({action,payload:structuredClone(payload)});
   if(!['LAYOUT_CONFIGURE','LAYOUT_CONFIGURE_PREVIEW'].includes(action))throw Error('UNEXPECTED_LAYOUT_ACTION');
   if(action==='LAYOUT_CONFIGURE_PREVIEW')return new Blob(['%PDF-1.4\n% preview '+payload.template_id],{type:'application/pdf'});
   if(window.testOptions.failSave)throw Error(window.testOptions.failSave);
   const config=data.configurations.find(c=>c.program===payload.program&&c.document_type===payload.document_type),assignment=data.layout_assignments.find(a=>a.program===payload.program&&a.document_type===payload.document_type&&!a.fund_key);
   if(config.id!==payload.expected_configuration_id||assignment.id!==payload.expected_assignment_id)throw Error('DOCUMENT_CONFIGURATION_CHANGED');
   Object.assign(config,{...payload,id:'config-saved',follow_active:false});
   const template=data.templates.find(t=>t.id===payload.template_id);Object.assign(assignment,{id:'assignment-saved',layout_id:'layout-saved',layout_version:2,template_id:template.id,template_name:template.name,template_version:template.version});return {configuration_id:config.id,assignment_id:assignment.id};
  }};
  window.DocumentLayoutDesigner=({scope,onClose})=>{window.designerCalls.push(scope);return React.createElement('div',{role:'dialog','aria-label':'Diseñador aislado'},React.createElement('button',{onClick:onClose},'Cerrar diseñador'));};
 },{data:fixture(),options});
 await page.addScriptTag({content:code});
 await page.evaluate(()=>{window.renderRoot=ReactDOM.createRoot(document.getElementById('root'));window.renderRoot.render(React.createElement(window.AdminDocumentGeneration,{app:{},onBack:()=>window.backCount++}));});
 await page.locator('h1').waitFor();
 if(options.noMetadata)await page.locator('[role="alert"]').first().waitFor();
 else await page.waitForFunction(()=>document.querySelector('.df-active__t')?.textContent==='Solicitudes de préstamo');
 return {context,page};
}

const tab=(page,label)=>page.getByRole('navigation',{name:'Secciones'}).getByRole('button',{name:new RegExp('^'+label)}).click();
const card=(page,label)=>page.locator('.df-pr').filter({has:page.locator('.df-pr__n',{hasText:new RegExp('^'+label+'$')})});
const configDialog=page=>page.getByRole('dialog',{name:'Configurar · Membresías'});
const fieldSelect=(dialog,label)=>dialog.locator('label').filter({has:dialog.page().locator('.df-field__l',{hasText:new RegExp('^'+label+'$')})}).locator('select');
const templateSelect=dialog=>fieldSelect(dialog,'Plantilla');
async function openMembership(page){await tab(page,'Firmas por programa');await card(page,'Membresías').getByRole('button',{name:'Configurar',exact:true}).click();return configDialog(page);}
async function calls(page){return page.evaluate(()=>structuredClone(window.calls));}
async function structure(page){return page.evaluate(()=>({head:document.querySelector('h1').textContent,sections:[...document.querySelectorAll('main>section')].map(n=>n.getAttribute('aria-label')),tabs:[...document.querySelectorAll('nav button')].map(n=>n.textContent.replace(/\d+$/,'').trim()),cards:{templates:document.querySelectorAll('.df-hist').length,signers:document.querySelectorAll('.df-fi').length,programs:document.querySelectorAll('.df-pr').length},ranges:[...document.querySelectorAll('input[type="range"]')].map(n=>n.getAttribute('aria-label')),footers:document.querySelectorAll('.df-pr__foot').length}));}
async function browseTabs(page){
 const checks={};
 for(const [name,selector] of [['Plantillas','.df-panel--pl'],['Firmantes','.df-panel--fi'],['Firmas por programa','.df-panel--pr']]){await tab(page,name);assert(await page.locator(selector).isVisible(),name+' panel visible');checks[name]={visible:true,controls:await page.locator(selector+' button,'+selector+' input,'+selector+' select').count(),scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth)};}
 await tab(page,'Firmantes');await page.getByRole('searchbox',{name:'Buscar firmante'}).fill('Responsable de prueba 2');assert.equal(await page.locator('.df-fi').count(),1);await page.getByRole('searchbox',{name:'Buscar firmante'}).fill('');await page.getByRole('button',{name:'Sólo activos',exact:true}).click();assert.equal(await page.locator('.df-fi').count(),2);await page.getByRole('button',{name:'Mostrar todos',exact:true}).click();
 await tab(page,'Firmas por programa');await page.getByRole('searchbox',{name:'Buscar programa'}).fill('Membresías');assert.equal(await page.locator('.df-pr').count(),1);await page.getByRole('searchbox',{name:'Buscar programa'}).fill('');
 return checks;
}

(async()=>{
 let browser;
 try{
  console.log('Launching isolated Chrome');
  browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,timeout:30000,args:['--no-first-run','--disable-extensions']});
  console.log('Chrome ready');
  for(const width of [390,1440]){
   console.log('Checking screen contract at '+width);
   const baseline=await mount(browser,width,originalCode),before=await structure(baseline.page),beforeTabs=await browseTabs(baseline.page);await baseline.context.close();
   const current=await mount(browser,width),page=current.page,after=await structure(page),afterTabs=await browseTabs(page);
   assert.deepEqual(after,before,'existing structural screen contract '+width);
   for(const label of Object.keys(beforeTabs)){assert.equal(afterTabs[label].controls,beforeTabs[label].controls,'control count '+label+' '+width);assert(afterTabs[label].scrollWidth<=beforeTabs[label].scrollWidth,'new overflow '+label+' '+width);}
   result.viewports[width]={structure:after,tabs:afterTabs,baselineScrollWidths:Object.fromEntries(Object.entries(beforeTabs).map(([k,v])=>[k,v.scrollWidth])),structuralParity:true,filters:true};
   await page.getByRole('button',{name:'Volver',exact:true}).click();assert.equal(await page.evaluate(()=>window.backCount),1);
   await current.context.close();
  }
  {
   const {context,page}=await mount(browser,1440);await tab(page,'Firmas por programa');
   const membership=card(page,'Membresías');assert.match(await membership.locator('.df-pr__tpl').innerText(),/PROGRAMAS FINANCIEROS/);assert.doesNotMatch(await membership.locator('.df-pr__tpl').innerText(),/Solicitudes/);result.checks.effectiveCardUsesActiveLayout=true;
   const untouchedBefore=await page.evaluate(()=>JSON.stringify({templates:fixture.templates,configurations:fixture.configurations.filter(c=>c.program!=='membership'),assignments:fixture.layout_assignments.filter(a=>a.program!=='membership'||a.fund_key)}));
   let dialog=await openMembership(page);assert.equal(await templateSelect(dialog).inputValue(),'old');result.checks.configUsesEffectiveTemplate=true;
   await templateSelect(dialog).selectOption('new');await dialog.getByRole('button',{name:'Vista previa',exact:true}).click();await page.getByRole('dialog',{name:'Vista previa del documento'}).waitFor();
   let log=await calls(page);const preview=log.find(c=>c.action==='LAYOUT_CONFIGURE_PREVIEW');assert(preview);assert.equal(preview.payload.program,'membership');assert.equal(preview.payload.document_type,'MEMBERSHIP_APPROVAL');assert.equal(preview.payload.template_id,'new');assert.equal(preview.payload.fund_key,'');assert.equal(preview.payload.expected_assignment_id,'assignment-membership-MEMBERSHIP_APPROVAL-');assert.equal(log.filter(c=>['LAYOUT_CONFIGURE','SAVE_CONFIGURATION','LEGACY_PREVIEW'].includes(c.action)).length,0);result.checks.previewCandidateWithoutWrites=true;
   await page.getByRole('dialog',{name:'Vista previa del documento'}).getByRole('button',{name:'Cerrar',exact:true}).last().click();
   dialog=configDialog(page);await dialog.waitFor();assert.equal(await templateSelect(dialog).inputValue(),'new');result.checks.previewReturnsToUnsavedDraft=true;await dialog.getByRole('button',{name:'Bajar',exact:true}).first().click();assert.match(await dialog.locator('.df-ord__n').first().innerText(),/2$/);await dialog.getByRole('button',{name:'Guardar configuración',exact:true}).click();await dialog.waitFor({state:'detached'});
   log=await calls(page);const saves=log.filter(c=>c.action==='LAYOUT_CONFIGURE');assert.equal(saves.length,1);assert.equal(log.filter(c=>c.action==='SAVE_CONFIGURATION').length,0);assert.equal(saves[0].payload.template_id,'new');assert.equal(saves[0].payload.signers[0].version_id,'signer-2');assert.equal(saves[0].payload.expected_configuration_id,'config-membership-MEMBERSHIP_APPROVAL');assert.match(saves[0].payload.id,/^[0-9a-f-]{36}$/i);assert.match(await membership.locator('.df-pr__tpl').innerText(),/Solicitudes de préstamo/);
   const untouchedAfter=await page.evaluate(()=>JSON.stringify({templates:fixture.templates,configurations:fixture.configurations.filter(c=>c.program!=='membership'),assignments:fixture.layout_assignments.filter(a=>a.program!=='membership'||a.fund_key)}));assert.equal(untouchedAfter,untouchedBefore);result.checks.atomicSaveEffectiveRefresh=true;result.checks.unrelatedScopesAndGlobalTemplateUnchanged=true;result.checks.signerOrderPreserved=true;await context.close();
  }
  {
   const {context,page}=await mount(browser,390,currentCode,{failSave:'DOCUMENT_CONFIGURATION_CHANGED'}),dialog=await openMembership(page);await templateSelect(dialog).selectOption('new');await dialog.getByRole('button',{name:'Guardar configuración',exact:true}).click();await dialog.locator('[role="alert"]').waitFor();assert.equal(await templateSelect(dialog).inputValue(),'new');assert(await dialog.isVisible());assert.match(await card(page,'Membresías').locator('.df-pr__tpl').textContent(),/PROGRAMAS FINANCIEROS/);const first=(await calls(page)).filter(c=>c.action==='LAYOUT_CONFIGURE')[0];await dialog.getByRole('button',{name:'Guardar configuración',exact:true}).click();await page.waitForFunction(()=>window.calls.filter(c=>c.action==='LAYOUT_CONFIGURE').length===2);const second=(await calls(page)).filter(c=>c.action==='LAYOUT_CONFIGURE')[1];assert.equal(second.payload.id,first.payload.id);result.checks.casErrorVisibleDraftPreserved=true;result.checks.unchangedRetryKeepsIdempotencyKey=true;await context.close();
  }
  {
   const {context,page}=await mount(browser,1440,currentCode,{noMetadata:true});assert.match(await page.locator('[role="alert"]').first().innerText(),/asignaci|consult|diseñ/i);assert.equal((await calls(page)).filter(c=>c.action==='SAVE_CONFIGURATION'||c.action==='LAYOUT_CONFIGURE').length,0);assert.equal(await page.locator('.df-active__t').innerText(),'Sin plantilla activa');result.checks.missingMetadataFailsExplicitly=true;await context.close();
  }
  {
   const {context,page}=await mount(browser,1440,currentCode,{emptyAssignments:true});const range=page.getByRole('slider',{name:'Margen superior',exact:true});await range.focus();await range.press('ArrowRight');await range.press('ArrowRight');assert.equal(await range.inputValue(),'36');await page.getByRole('button',{name:'Ver con datos',exact:true}).click();const preview=page.getByRole('dialog',{name:'Vista previa del documento'});await preview.waitFor();const log=await calls(page),request=log.find(c=>c.action==='LEGACY_PREVIEW');assert(request);assert.equal(request.payload.config.margins.top,36);assert.equal(request.payload.config.template_id,'new');assert.equal(log.filter(c=>['LAYOUT_CONFIGURE_PREVIEW','LAYOUT_CONFIGURE','SAVE_CONFIGURATION'].includes(c.action)).length,0);await preview.getByRole('button',{name:'Cerrar',exact:true}).last().click();assert.equal(await page.getByRole('dialog').count(),0);assert(await page.locator('.df-panel--pl').isVisible());result.checks.templatePreviewPreservesMarginsWithoutActiveLayout=true;await context.close();
  }
  {
   const {context,page}=await mount(browser,1440);await tab(page,'Firmas por programa');await card(page,'Autos').getByRole('button',{name:'Configurar',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Configurar · Autos'});await dialog.getByRole('button',{name:'Diseñar documento',exact:true}).click();await page.getByRole('dialog',{name:'Diseñador aislado'}).waitFor();let log=await calls(page);assert.equal(log.filter(c=>c.action==='SAVE_CONFIGURATION').length,1);assert.equal(log.filter(c=>c.action==='LAYOUT_CONFIGURE').length,0);assert.equal(log.find(c=>c.action==='SAVE_CONFIGURATION').payload.program,'auto');result.checks.unassignedScopeRetainsSaveAndDesigner=true;
   await page.evaluate(()=>fixture.layout_assignments.push({...fixture.layout_assignments.find(a=>a.program==='prestamo'&&!a.fund_key),id:'auto-created-assignment',layout_id:'auto-created-layout',program:'auto',document_type:'PROGRAM_FINANCING_APPROVAL'}));await page.getByRole('button',{name:'Cerrar diseñador',exact:true}).click();await dialog.waitFor();assert.equal(await templateSelect(dialog).inputValue(),'new');await dialog.getByRole('button',{name:'Guardar configuración',exact:true}).click();await dialog.waitFor({state:'detached'});log=await calls(page);const save=log.find(c=>c.action==='LAYOUT_CONFIGURE');assert(save,'newly activated layout must use atomic configuration');assert.equal(save.payload.expected_configuration_id,'legacy-saved');assert.equal(save.payload.expected_assignment_id,'auto-created-assignment');assert.equal(log.filter(c=>c.action==='SAVE_CONFIGURATION').length,1);result.checks.newDesignerActivationRefreshesSavedBaselineAndAtomicPath=true;await context.close();
  }
  {
   const {context,page}=await mount(browser,1440);await tab(page,'Firmas por programa');const loan=card(page,'Caja de Ahorro').filter({has:page.locator('.df-pr__doc',{hasText:/^Autorización de préstamo$/})});await loan.getByRole('button',{name:'Configurar',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Configurar · Caja de Ahorro'});assert.equal(await templateSelect(dialog).inputValue(),'old');await fieldSelect(dialog,'Tipo de documento').selectOption('SAVINGS_ENROLLMENT_APPROVAL');assert.equal(await templateSelect(dialog).inputValue(),'new');await dialog.getByRole('button',{name:'Vista previa',exact:true}).click();await page.getByRole('dialog',{name:'Vista previa del documento'}).waitFor();const preview=(await calls(page)).find(c=>c.action==='LAYOUT_CONFIGURE_PREVIEW');assert.equal(preview.payload.document_type,'SAVINGS_ENROLLMENT_APPROVAL');assert.equal(preview.payload.expected_configuration_id,'config-caja-SAVINGS_ENROLLMENT_APPROVAL');assert.equal(preview.payload.expected_assignment_id,'assignment-caja-SAVINGS_ENROLLMENT_APPROVAL-');result.checks.documentTypeTransitionReloadsExactScope=true;await context.close();
  }
  {
   const {context,page}=await mount(browser,1440);let dialog=await openMembership(page);await dialog.getByRole('button',{name:'Diseñar documento',exact:true}).click();await page.getByRole('dialog',{name:'Diseñador aislado'}).waitFor();assert.equal((await calls(page)).filter(c=>['SAVE_CONFIGURATION','LAYOUT_CONFIGURE'].includes(c.action)).length,0);await page.evaluate(()=>{const assignment=fixture.layout_assignments.find(a=>a.program==='membership'&&!a.fund_key);Object.assign(assignment,{id:'designer-assignment',template_id:'new',template_name:'Solicitudes de préstamo'});});await page.getByRole('button',{name:'Cerrar diseñador',exact:true}).click();dialog=configDialog(page);await dialog.waitFor();assert.equal(await templateSelect(dialog).inputValue(),'new');await dialog.getByRole('button',{name:'Vista previa',exact:true}).click();await page.getByRole('dialog',{name:'Vista previa del documento'}).waitFor();const preview=(await calls(page)).find(c=>c.action==='LAYOUT_CONFIGURE_PREVIEW');assert.equal(preview.payload.expected_assignment_id,'designer-assignment');result.checks.activeDesignerOpensWithoutMutation=true;result.checks.designerExitRefreshesUnmodifiedAssignment=true;await context.close();
  }
  {
   const {context,page}=await mount(browser,390);let dialog=await openMembership(page);await templateSelect(dialog).selectOption('new');await dialog.getByRole('button',{name:'Bajar',exact:true}).first().click();await dialog.getByRole('combobox',{name:'Rol en el documento',exact:true}).first().selectOption('Visto bueno');result.mobileConfigurationActions=await dialog.locator('.df-ov__f button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {label:n.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height,insideViewport:r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight};}));assert(result.mobileConfigurationActions.every(b=>b.insideViewport),'configuration actions must be reachable on mobile');await dialog.getByRole('button',{name:'Diseñar documento',exact:true}).click();await page.getByRole('dialog',{name:'Diseñador aislado'}).waitFor();result.checks.mobileConfigurationActionsReachable=true;assert.equal((await calls(page)).filter(c=>['SAVE_CONFIGURATION','LAYOUT_CONFIGURE'].includes(c.action)).length,0);await page.evaluate(()=>{const assignment=fixture.layout_assignments.find(a=>a.program==='membership'&&!a.fund_key);Object.assign(assignment,{id:'concurrent-assignment',layout_id:'concurrent-layout'});});await page.getByRole('button',{name:'Cerrar diseñador',exact:true}).click();dialog=configDialog(page);await dialog.waitFor();assert.equal(await templateSelect(dialog).inputValue(),'new');assert.match(await dialog.locator('.df-ord__n').first().innerText(),/2$/);assert.equal(await dialog.getByRole('combobox',{name:'Rol en el documento',exact:true}).first().inputValue(),'Visto bueno');result.checks.designerExitPreservesUnsavedTemplateAndSigners=true;
   await dialog.getByRole('button',{name:'Guardar configuración',exact:true}).click();await dialog.locator('[role="alert"]').waitFor();const save=(await calls(page)).find(c=>c.action==='LAYOUT_CONFIGURE');assert.equal(save.payload.expected_assignment_id,'assignment-membership-MEMBERSHIP_APPROVAL-');assert.equal(save.payload.expected_configuration_id,'config-membership-MEMBERSHIP_APPROVAL');assert.equal(save.payload.template_id,'new');assert.equal(save.payload.signers[0].version_id,'signer-2');assert.equal(save.payload.signers[0].role,'Visto bueno');assert.equal(await page.evaluate(()=>fixture.layout_assignments.find(a=>a.program==='membership'&&!a.fund_key).id),'concurrent-assignment');assert.equal(await templateSelect(dialog).inputValue(),'new');assert.match(await dialog.locator('.df-ord__n').first().innerText(),/2$/);result.checks.designerConcurrentChangeDoesNotRebasePendingDraft=true;result.checks.designerConcurrentSaveFailsCASWithoutDiscardingEdits=true;await context.close();
  }
  assert.equal(result.pageErrors.length,0,'uncaught browser exceptions');assert.equal(result.networkRequests.length,0,'unexpected HTTP(S) network access');result.status='PASS';
 }catch(e){result.failure=e.stack;process.exitCode=1;}
 finally{if(browser)await browser.close();const out=path.join(root,'docs/qa/evidence/document-assignment-fix/browser.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
})();
