'use strict';
// Isolated browser fixtures only. This test never contacts Supabase or publishes balances.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.env.SAVINGS_CERTIFICATION_QA_OUTPUT||path.join(root,'tmp/savings-certification-browser'));
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const results=[];
 try{for(const width of (process.env.SAVINGS_CERTIFICATION_VIEWPORTS||'320,430,1440').split(',').map(Number)){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort());
  await page.setContent('<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><main class="svp"><div id="root" class="svp-body"></div></main></body></html>');
  const panel=fs.readFileSync(path.join(root,'app/savings-panel-admin.jsx'),'utf8');
  await page.addStyleTag({content:panel.match(/const css=`([\s\S]*?)`;/)[1]});
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/savings-panel-reference.jsx','app/savings-certification-admin.jsx'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
  await page.evaluate(()=>{
   window.calls=[];window.failKind='';window.failureMessage='NETWORK_FAILURE';window.delayId='';let sequence=0;
   window.crypto.randomUUID=()=>`fixture-command-${++sequence}`;
   window.fixture={certified:false,context:{person:{folio:'00123',saldo:1100,saldo_revision:1100,aporte:500,inicio:'2026-01-15',plan_inicio:'2026-07-15',plan_fin:'2028-06-30',prox:'2026-09-15',proceso:'1',estado:'ahorrando'},record_status:'RESOLVED',source_version:8,cutoff_on:'2026-09-06'},can_confirm:true,can_write:true,source_changed:false,balance:{capital:1000,yield_amount:100,total:1100},balance_version:1,projected_total:2100,unconfirmed_dates:1,schedule:[{date:'2026-09-15',expected:500,actual:null,version:0,confirmed:false,future:false},{date:'2026-09-30',expected:500,actual:null,version:0,confirmed:false,future:true}],history:[]};
   const copy=x=>structuredClone(x);
   async function action(kind,c){calls.push({kind,...copy(c)});if(failKind===kind){failKind='';const message=failureMessage;failureMessage='NETWORK_FAILURE';throw Error(message);}}
   window.SavingsPanelRepository={
    financial:async(id,until)=>{calls.push({kind:'financial',id,until});const result=copy(fixture);if(id==='readonly'){result.can_confirm=false;result.can_write=false;}if(id==='empty')result.schedule=[];if(id==='slow'){await new Promise(r=>setTimeout(r,200));result.context.person.folio='OLD';}if(id==='new')result.context.person.folio='NEW';if(failKind==='financial'){failKind='';throw Error('NETWORK_FAILURE');}return result;},
    previewBalance:async c=>{await action('previewBalance',c);return {total:1100,capital:1000,yield:100,source_total:1100,review_total:1100,difference:0,schedule:copy(fixture.schedule),fingerprint:'server-fingerprint',can_confirm:true,already_confirmed:false,context:copy(fixture.context)};},
    confirmBalance:async c=>{await action('confirmBalance',c);fixture.certified=true;return {id:'certificate'};},
    receipt:async c=>{await action('receipt',c);const row=fixture.schedule.find(r=>r.date===c.date);row.actual=c.actual;row.version++;row.confirmed=true;fixture.unconfirmed_dates=0;fixture.balance_version++;return {saved:true};},
    adjustBalance:async c=>{await action('adjustBalance',c);fixture.balance={capital:c.capital,yield_amount:c.yield,total:1000};fixture.balance_version++;return {saved:true};},
    acceptSource:async c=>{await action('acceptSource',c);fixture.context.source_update.pending=false;fixture.context.source_version++;return {saved:true};},
    nativeFinancial:async(participantId,until)=>{calls.push({kind:'nativeFinancial',participantId,until});return {...copy(fixture),participant_id:participantId,certified:true,native:true,can_confirm:false,context:{person:{folio:'00999',nombre:'NUEVO AHORRADOR'},cutoff_on:'2026-09-06'},schedule:[{enrollment_id:'native-enrollment',date:'2026-09-15',expected:500,actual:null,version:2,confirmed:false,future:false}],certificate:null};},
    nativeReceipt:async c=>{await action('nativeReceipt',c);return {saved:true};}
   };
   window.SavingsRepository={getAdminDashboard:async()=>{calls.push({kind:'retirementDashboard'});return {participants:[{id:'native-person'},{id:'other-person'}],process_changes:[{id:'own-change',participant_id:'native-person'},{id:'other-change',participant_id:'other-person'}]};}};
   window.SavingsRetirementAdmin=props=>{window.retirementProps=props;return React.createElement('div',null,'Plan de jubilación de prueba');};
   window.saved=0;window.ui=ReactDOM.createRoot(document.getElementById('root'));window.render=(id='fixture',version=8)=>ui.render(React.createElement(SavingsCertificationAdmin,{recordId:id,version,onSaved:()=>{saved++;}}));render();
   window.renderNative=()=>ui.render(React.createElement(SavingsCertificationAdmin,{participantId:'native-person',app:{admin:{has:()=>true}},onSaved:()=>{saved++;}}));
  });
  await page.getByLabel('Capital disponible al corte',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Capital disponible al corte',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('Rendimiento incluido al corte',{exact:true}).inputValue(),'');
  assert(await page.getByRole('button',{name:'Revisar saldo y calendario',exact:true}).isDisabled());
  await page.getByLabel('Capital disponible al corte',{exact:true}).fill('1000');await page.getByLabel('Rendimiento incluido al corte',{exact:true}).fill('100');
  assert.equal(await page.getByLabel('Observaciones (opcional)',{exact:true}).inputValue(),'');
  await page.evaluate(()=>{failKind='previewBalance';});
  await page.getByRole('button',{name:'Revisar saldo y calendario',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.equal(await page.getByLabel('Capital disponible al corte',{exact:true}).inputValue(),'1000');
  await page.getByRole('button',{name:'Revisar saldo y calendario',exact:true}).click();await page.getByRole('button',{name:'Confirmar saldo definitivo',exact:true}).waitFor();
  const previews=await page.evaluate(()=>calls.filter(x=>x.kind==='previewBalance'));assert.equal(previews[0].key,previews[1].key,'Preview retry keeps same operation');
  assert.equal(previews[1].command.confirmed,true);assert.equal(previews[1].command.observation,'');
  assert.equal(previews[1].command.first_date,'2026-01-15');assert.equal(previews[1].command.enrollment_start,'2026-07-15');assert.equal(previews[1].command.plan_end,'2028-06-30');
  await page.getByLabel('Aportación por quincena',{exact:true}).fill('700');assert.equal(await page.getByRole('button',{name:'Confirmar saldo definitivo',exact:true}).count(),0,'Editing invalidates preview');
  await page.getByRole('button',{name:'Revisar saldo y calendario',exact:true}).click();await page.getByRole('button',{name:'Confirmar saldo definitivo',exact:true}).waitFor();
  if(process.env.SAVINGS_SKIP_SCREENSHOTS!=='1')await page.screenshot({path:path.join(output,`confirm-${width}.png`),fullPage:true});
  await page.evaluate(()=>{failKind='confirmBalance';});await page.getByRole('button',{name:'Confirmar saldo definitivo',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Confirmar saldo definitivo',exact:true}).click();await page.getByText('Saldo confirmado. Continúa en preparación privada.',{exact:true}).waitFor();
  const confirms=await page.evaluate(()=>calls.filter(x=>x.kind==='confirmBalance'));assert.equal(confirms[0].key,confirms[1].key,'Confirmation retry uses same idempotency key');
  assert.equal(confirms[1].fingerprint,'server-fingerprint');
  assert.equal(await page.getByRole('button',{name:'Registrar descuento recibido',exact:true}).count(),1,'Future date has no receipt action');
  await page.getByRole('button',{name:'Registrar descuento recibido',exact:true}).click();assert(await page.getByRole('button',{name:'Guardar descuento',exact:true}).isDisabled(),'Blank is unconfirmed');
  await page.getByLabel('Importe realmente recibido',{exact:true}).fill('0');assert(await page.getByRole('button',{name:'Guardar descuento',exact:true}).isEnabled(),'Zero can be confirmed');
  await page.evaluate(()=>{failKind='receipt';});await page.getByRole('button',{name:'Guardar descuento',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('Importe realmente recibido',{exact:true}).inputValue(),'0');
  await page.getByRole('button',{name:'Guardar descuento',exact:true}).click();await page.getByRole('button',{name:'Corregir descuento recibido',exact:true}).waitFor();
  const receipts=await page.evaluate(()=>calls.filter(x=>x.kind==='receipt'));assert.equal(receipts[0].key,receipts[1].key);assert.equal(receipts[1].actual,0);assert.equal(receipts[1].version,0);assert.equal(receipts[1].observation,'');
  await page.getByLabel('Proyectar hasta',{exact:true}).fill('2027-06-30');await page.getByRole('button',{name:'Recalcular proyección',exact:true}).click();await page.waitForFunction(()=>calls.some(c=>c.kind==='financial'&&c.until==='2027-06-30'));
  await page.getByRole('button',{name:'Corregir saldo confirmado',exact:true}).click();await page.getByLabel('Capital disponible correcto',{exact:true}).fill('900');
  assert(await page.getByRole('button',{name:'Guardar saldo corregido',exact:true}).isDisabled());await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Guardar saldo corregido',exact:true}).click();await page.getByText('Saldo corregido. Se conservó el registro anterior.',{exact:true}).waitFor();
  const adjustment=await page.evaluate(()=>calls.find(c=>c.kind==='adjustBalance'));assert.equal(adjustment.capital,900);assert.equal(adjustment.yield,100);assert.equal(adjustment.version,2);assert.equal(adjustment.observation,'');
  await page.getByRole('button',{name:'Corregir descuento recibido',exact:true}).click();await page.getByLabel('Importe realmente recibido',{exact:true}).fill('75');
  await page.evaluate(()=>{fixture.schedule[0].actual=25;fixture.schedule[0].version=3;failKind='receipt';failureMessage='SAVINGS_VERSION_STALE';});
  await page.getByRole('button',{name:'Guardar descuento',exact:true}).click();await page.getByRole('button',{name:'Actualizar datos',exact:true}).waitFor();
  await page.getByRole('button',{name:'Actualizar datos',exact:true}).click();await page.getByText('Datos actualizados. Compara lo registrado con tu captura antes de guardar.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Importe realmente recibido',{exact:true}).inputValue(),'75','Refreshing preserves officer capture');
  await page.getByRole('button',{name:'Guardar descuento',exact:true}).click();await page.getByRole('button',{name:'Corregir descuento recibido',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.kind==='receipt').at(-1).version),3,'Explicit refresh adopts reviewed current version');
  if(process.env.SAVINGS_SKIP_SCREENSHOTS!=='1')await page.screenshot({path:path.join(output,`receipts-${width}.png`),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  await page.evaluate(()=>render('readonly'));await page.locator('[data-savings-certification="readonly"]').waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-busy=true]'));
  assert.equal(await page.getByRole('button',{name:'Corregir saldo confirmado',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Corregir descuento recibido',exact:true}).count(),0);
  await page.evaluate(()=>render('slow'));await page.locator('[data-savings-certification="slow"]').waitFor();await page.evaluate(()=>render('new'));await page.getByText('NEW',{exact:true}).waitFor();await page.waitForTimeout(250);assert.equal(await page.getByText('OLD',{exact:true}).count(),0,'Older person response cannot overwrite new person');
  await page.evaluate(()=>{failKind='financial';render('error');});await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Reintentar consulta',exact:true}).click();await page.getByRole('button',{name:'Corregir saldo confirmado',exact:true}).waitFor();
  await page.evaluate(()=>render('empty'));await page.getByText('No hay descuentos programados para el intervalo consultado.',{exact:true}).waitFor();
  await page.evaluate(()=>{fixture.certified=false;fixture.context.source_update={id:'source-2',source_total:1600,observed_at:'2026-09-13T20:00:00Z',changes:[{key:'BC',date:'2026-09-05',previous:0,current:500}],pending:true,conflict:true};fixture.context.can_accept_source_update=true;render('source-conflict');});
  await page.getByText('Ver descuentos nuevos del archivo',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Aplicar descuentos del archivo',exact:true}).count(),0,'Conflicting manual correction is not overwritten');
  await page.evaluate(()=>{fixture.context.source_update.conflict=false;render('source-update');});await page.getByRole('button',{name:'Aplicar descuentos del archivo',exact:true}).waitFor();await page.getByLabel('Capital disponible al corte',{exact:true}).fill('1000');await page.getByLabel('Rendimiento incluido al corte',{exact:true}).fill('100');await page.getByRole('button',{name:'Revisar saldo y calendario',exact:true}).click();await page.getByRole('button',{name:'Confirmar saldo definitivo',exact:true}).waitFor();assert(await page.getByRole('button',{name:'Confirmar saldo definitivo',exact:true}).isDisabled(),'Pending source update blocks confirmation');
  await page.getByRole('button',{name:'Aplicar descuentos del archivo',exact:true}).click();await page.getByText('Descuentos del archivo aplicados. Revisa el saldo actualizado antes de confirmarlo.',{exact:true}).waitFor();const accepted=await page.evaluate(()=>calls.find(c=>c.kind==='acceptSource'));assert.equal(accepted.id,'source-update');assert.equal(accepted.updateId,'source-2');assert.equal(accepted.version,8);assert.equal(await page.getByRole('button',{name:'Confirmar saldo definitivo',exact:true}).count(),0,'Source acceptance invalidates preview');
  await page.evaluate(()=>{fixture.context.person={...fixture.context.person,saldo:0,saldo_revision:0,inicio:null,plan_inicio:null,plan_fin:null,estado:'baja'};render('never-started');});await page.getByLabel('Capital disponible al corte',{exact:true}).fill('0');await page.getByLabel('Rendimiento incluido al corte',{exact:true}).fill('0');assert(await page.getByRole('button',{name:'Revisar saldo y calendario',exact:true}).isEnabled());await page.getByRole('button',{name:'Revisar saldo y calendario',exact:true}).click();await page.waitForFunction(()=>calls.some(c=>c.kind==='previewBalance'&&c.id==='never-started'));const never=await page.evaluate(()=>calls.find(c=>c.kind==='previewBalance'&&c.id==='never-started').command);assert.equal(never.first_date,null);assert.equal(never.enrollment_start,null);assert.equal(never.active,false);
  await page.evaluate(()=>renderNative());await page.getByText('00999',{exact:true}).waitFor();assert.equal(await page.getByText('Saldo reconocido del archivo',{exact:true}).count(),0);assert.equal(await page.getByLabel('Capital disponible al corte',{exact:true}).count(),0);await page.getByRole('button',{name:'Registrar descuento recibido',exact:true}).click();await page.getByLabel('Importe realmente recibido',{exact:true}).fill('250');await page.getByRole('button',{name:'Guardar descuento',exact:true}).click();await page.waitForFunction(()=>calls.some(c=>c.kind==='nativeReceipt'));const native=await page.evaluate(()=>calls.find(c=>c.kind==='nativeReceipt'));assert.equal(native.participantId,'native-person');assert.equal(native.enrollmentId,'native-enrollment');assert.equal(native.actual,250);assert.equal(native.version,2);
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.kind==='retirementDashboard').length),0);await page.getByText('Cambio de descuento por jubilación',{exact:true}).click();await page.getByText('Plan de jubilación de prueba',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>retirementProps.selected.id),'native-person');assert.deepEqual(await page.evaluate(()=>retirementProps.rows.map(r=>r.id)),['own-change']);

  await page.addScriptTag({content:fs.readFileSync(path.join(root,'app/savings-panel-admin.jsx'),'utf8')});
  await page.evaluate(()=>{
   window.nativeCalls=[];window.nativeFailOnce=false;window.panelPublished=false;window.SavingsRuntimeAdmin=()=>null;
   window.panelNatives=Array.from({length:23},(_,i)=>({participant_id:'native-'+i,folio:String(i).padStart(5,'0'),nombre:'Nuevo '+String(i).padStart(2,'0'),saldo:500,aporte:250,proceso:'1',ultimo:'2026-09-15',estado:i<21?'ahorrando':'baja'}));
   SavingsPanelRepository.list=async q=>({publication_mode:panelPublished?'PUBLISHED':'PRIVATE',collection_status:'ACTUAL_CONFIRMATION_PENDING',rows:[],total:0,saldo_total:0,can_write:false,cutoff:'2026-09-06T20:00:00Z',kpis:{current_summary:true,as_of:'2026-10-05',uncertified:2,projection_pending:2,pending_actual_count:3,total:0,activos:0,padron:0,afiliados:947,prox:null,porRecibir:null,altas:0,bajas:0,pendientes:0,incidencias:0,cobranza:{fecha:'2026-09-05',recibido:0,esperado:null}}});
   SavingsPanelRepository.nativeList=async q=>{nativeCalls.push(structuredClone(q));if(nativeFailOnce){nativeFailOnce=false;throw Error('NETWORK');}const rows=panelNatives.filter(a=>(!q.search||a.folio.includes(q.search)||a.nombre.toLowerCase().includes(q.search.toLowerCase()))&&(!q.filter||q.filter==='todos'||a.estado===q.filter));return {items:rows.slice(q.offset,q.offset+20),total:rows.length,offset:q.offset,limit:20};};
   SavingsPanelRepository.nativeFinancial=async participantId=>{const person=panelNatives.find(a=>a.participant_id===participantId);nativeCalls.push({financial:participantId});return {certified:true,native:true,can_confirm:false,can_write:false,context:{person},balance:{capital:500,yield_amount:0,total:500},schedule:[],projected_total:500,unconfirmed_dates:0,history:[]};};
   SavingsPanelRepository.runtimeRequests=async()=>({requests:[],can_create:false});
   window.renderPanel=()=>ui.render(React.createElement(SavingsPanelAdmin,{app:{admin:{has:()=>true}},onBack:()=>{window.leftPanel=true;}}));renderPanel();
  });
  await page.getByRole('tab',{name:'Programa',exact:true}).click();
  await page.getByText('3 descuentos por confirmar en los expedientes. Abre al ahorrador y revisa sus descuentos reales.',{exact:true}).waitFor();
  await page.getByText('Revisi'+String.fromCharCode(243)+'n privada '+String.fromCharCode(183)+' Sin publicar a los ahorradores',{exact:true}).waitFor();
  await page.getByText('Resumen general del programa',{exact:true}).click();
  assert((await page.locator('.svp-program-summary').innerText()).includes('ahorrando al d'+String.fromCharCode(237)+'a'));
  await page.evaluate(()=>{panelPublished=true;});
  await page.getByRole('tab',{name:'Ahorradores',exact:true}).click();await page.locator('[data-savings-person-id="native-19"]').waitFor();await page.getByText('Saldos publicados a los ahorradores',{exact:true}).waitFor();assert.equal(await page.locator('.svp-person').count(),20);
  const geometry=await page.evaluate(()=>({primary:document.querySelectorAll('[role=tablist] [role=tab]').length,overflow:document.documentElement.scrollWidth-innerWidth}));assert.equal(geometry.primary,3);assert(geometry.overflow<=1);
  await page.locator('[data-savings-person-id="native-19"]').click();await page.getByRole('heading',{name:'Nuevo 19',exact:true}).waitFor();await page.locator('[data-savings-certification="participant:native-19"]').waitFor();
  await page.getByRole('button',{name:'Siguiente '+String.fromCharCode(8250),exact:true}).click();await page.getByRole('heading',{name:'Nuevo 20',exact:true}).waitFor();assert(await page.evaluate(()=>nativeCalls.some(c=>c.offset===20&&c.filter==='todos')));
  await page.getByRole('button',{name:String.fromCharCode(8249)+' Anterior',exact:true}).click();await page.getByRole('heading',{name:'Nuevo 19',exact:true}).waitFor();await page.getByRole('button',{name:'Volver al administrador',exact:true}).click();await page.locator('[data-savings-person-id="native-19"]').waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.savingsPersonId),'native-19');
  await page.getByRole('button',{name:'Dej'+String.fromCharCode(243)+' de ahorrar',exact:true}).click();await page.locator('[data-savings-person-id="native-21"]').waitFor();assert.equal(await page.locator('.svp-person').count(),2);assert.equal(await page.evaluate(()=>nativeCalls.filter(c=>c.filter).at(-1).filter),'baja');
  await page.getByRole('button',{name:'Todos',exact:true}).click();await page.locator('[data-savings-person-id="native-0"]').waitFor();await page.getByLabel('Buscar por nombre o folio',{exact:true}).fill('00022');await page.locator('[data-savings-person-id="native-22"]').waitFor();await page.waitForFunction(()=>document.querySelectorAll('.svp-person').length===1);assert.equal(await page.evaluate(()=>nativeCalls.filter(c=>c.search).at(-1).search),'00022');
  await page.evaluate(()=>{nativeFailOnce=true;});await page.getByLabel('Buscar por nombre o folio',{exact:true}).fill('Nuevo');await page.getByRole('button',{name:'Reintentar nuevos ahorradores',exact:true}).waitFor();await page.getByRole('button',{name:'Reintentar nuevos ahorradores',exact:true}).click();await page.locator('[data-savings-person-id="native-0"]').waitFor();assert.equal(await page.locator('.svp-person').count(),20);

  await page.evaluate(()=>{
   window.SavingsWithdrawalList=()=>null;
   const person={id:'imported-current',folio:'00007',nombre:'Cuenta confirmada',estado:'baja',proceso:'1',aporte:300,saldo:1250,source_saldo:1000,certified:true,capital_actual:1200,rendimiento_actual:50,retirado:0,inicio:'2025-01-15',plan_inicio:'2026-01-15',ultimo:'2026-09-30',bajaAt:'2026-10-05',observed_at:'2026-09-06T20:00:00Z',correccion:0,version:1};
   const priorList=SavingsPanelRepository.list;
   SavingsPanelRepository.list=async q=>({...await priorList(q),rows:[person],total:1,saldo_total:1250});
   SavingsPanelRepository.nativeList=async()=>({items:[],total:0,offset:0,limit:20});
   SavingsPanelRepository.detail=async()=>({person,as_of:'2026-10-05',source_person:{...person,saldo:1000},can_write:false,record:{version:1,source_data:{Q:1000},proposed_data:{},field_defs:[],history:[],status:'RESOLVED'},dates:[],date_count:0,withdrawals:{records:[]},withdrawn_total:0});
   SavingsPanelRepository.financial=async()=>({certified:true,context:{person},can_confirm:false,can_write:false,balance:{capital:1200,yield_amount:50,total:1250},schedule:[],history:[],projected_total:1250,unconfirmed_dates:0});
  });
  await page.getByLabel('Buscar por nombre o folio',{exact:true}).fill('00007');await page.locator('[data-savings-person-id="imported-current"]').waitFor();await page.locator('[data-savings-person-id="imported-current"]').click();
  await page.getByRole('heading',{name:'Cuenta confirmada',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.svp-hero strong')?.textContent.includes('1,250.00'));
  assert((await page.locator('.svp-hero').innerText()).includes('Capital actual'));assert((await page.locator('.svp-hero').innerText()).includes('1,200.00'));
  assert(await page.getByText(/Saldo actual confirmado al/).count());assert((await page.getByText(/Saldo actual confirmado al/).innerText()).includes('Saldo original del archivo: $1,000.00'));

  assert.deepEqual(errors,[]);results.push({width,status:'PASS'});await page.close();
 }}finally{await browser.close();}
 const report={status:'PASS',network:'BLOCKED',physical_devices:false,results,checks:['current/private/published labels and pending receipt notice','confirmed hero preserves original reference','native list/detail/search/filters/page-neighbors','native load error and retry','never-started dates null','native receipt enrollment identity','retirement exact participant','source update conflicts/preview invalidation','empty components are explicit','optional observations','server preview invalidated by edit','idempotent preview/confirmation/receipt retry','future dates cannot be received','blank differs from confirmed zero','server projection query','audited correction command/version','stale receipt refresh preserves capture and reviews latest version','read-only permission','stale person response ignored','loading/error/retry/empty','no horizontal overflow','no page errors']};
 fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
