'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/savings-individual-withdrawal');
const chunks=process.env.SAVINGS_TEST_BUNDLE==='1'?new Map(fs.readFileSync(path.join(root,'app/bundle.js'),'utf8').split(/(?=\/\* @@file )/).filter(Boolean).map(x=>[x.match(/^\/\* @@file (.*?) \*\//)[1],x])):null;
const content=f=>chunks&&chunks.has(path.basename(f))?chunks.get(path.basename(f)):fs.readFileSync(path.join(root,f),'utf8');
async function main(){const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});fs.mkdirSync(out,{recursive:true});
 try{const page=await browser.newPage({viewport:{width:430,height:920}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await page.route('**/*',r=>r.abort());
  await page.setContent('<html lang="es"><body style="margin:0"><main class="svp"><div class="svp-body" id="root"></div></main></body></html>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'app/savings-panel-admin.jsx'),'utf8').match(/const css=`([\s\S]*?)`;/)[1]});
  for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/savings-panel-reference.jsx','app/savings-individual-withdrawal-repository.js','app/savings-individual-withdrawal.jsx','app/savings-runtime-admin.jsx','app/savings-panel-admin.jsx'])await page.addScriptTag({content:content(f)});
  await page.evaluate(()=>{
   let keys=0;window.crypto.randomUUID=()=> 'synthetic-key-'+(++keys);window.calls=[];window.fail='';window.configure=true;window.readOnly=false;window.delay=null;window.pending={};window.states={};window.intent=0;
   window.current=folio=>states[folio]||{folio,name:'PERSONA SINTÉTICA '+folio,ready:true,enabled:false,can_configure:configure,can_create:!readOnly,today:'2026-09-30',suggested_until:'2026-10-07',version:'v1'};
   window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
    calls.push({name,args:structuredClone(args)});
    if(name==='get_admin_savings_individual_withdrawal'){
     if(delay===args.p_folio)return new Promise(resolve=>pending[args.p_folio]=()=>resolve({data:current(args.p_folio)}));
     if(fail==='get'){fail='';return {error:{message:'NETWORK'}};}
     return {data:{...current(args.p_folio),can_configure:configure,can_create:!readOnly}};
    }
    if(name==='admin_set_savings_individual_withdrawal'){
     if(fail==='set'){fail='';return {error:{message:'NETWORK'}};}
     states[args.p_folio]={...current(args.p_folio),enabled:args.p_enabled,scope:'PARTICIPANT',version:'v2',ends_at:args.p_enabled?args.p_until+'T23:59:59-07:00':null};
     if(fail==='readback'){fail='get';}
     return {data:current(args.p_folio)};
    }
    throw Error('Unexpected RPC '+name);
   }})};
   window.GeneratedDocuments=()=>null;
   window.SavingsPanelRepository={runtimeRequests:async()=>({can_create:!readOnly,requests:[]}),operation:async c=>{calls.push({operation:structuredClone(c)});return {saved:true};}};
   window.ui=ReactDOM.createRoot(document.getElementById('root'));
   function Harness({folio}){const [intent,setIntent]=React.useState(0);return React.createElement(React.Fragment,null,React.createElement(SavingsIndividualWithdrawal,{key:folio,folio,onRequest:()=>setIntent(x=>x+1)}),React.createElement(SavingsRequestsAdmin,{key:'r'+folio,folio,expanded:true,withdrawalIntent:intent,onSaved:async()=>{}}));}
   window.render=folio=>ui.render(React.createElement(Harness,{key:folio,folio}));render('00123');
  });
  const writes=()=>page.evaluate(()=>calls.filter(c=>c.name==='admin_set_savings_individual_withdrawal'));
  await page.getByRole('button',{name:'Habilitar retiro',exact:true}).click();
  assert.equal(await page.getByLabel('Periodo',{exact:true}).count(),0);assert.equal(await page.getByLabel('Aplicar a',{exact:true}).count(),0);
  await page.getByLabel('Motivo',{exact:true}).fill('Retiro individual solicitado');
  assert.equal(await page.getByLabel(/Habilitado hasta/).inputValue(),'2026-10-07');
  await page.evaluate(()=>{fail='set';});await page.getByRole('button',{name:'Confirmar habilitación',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.equal(await page.getByLabel('Motivo',{exact:true}).inputValue(),'Retiro individual solicitado');
  await page.getByRole('button',{name:'Confirmar habilitación',exact:true}).dblclick();await page.getByRole('button',{name:'Registrar retiro',exact:true}).waitFor();
  const saved=await writes();assert.equal(saved.length,2);assert.equal(saved[0].args.p_key,saved[1].args.p_key);assert.equal(saved[1].args.p_folio,'00123');assert.equal(saved[1].args.p_until,'2026-10-07');
  await page.getByRole('button',{name:'Registrar retiro',exact:true}).click();await page.getByLabel('Importe solicitado para retirar',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Operación',{exact:true}).inputValue(),'WITHDRAW');assert.equal(await page.getByLabel('Folio exacto del ahorrador',{exact:true}).inputValue(),'00123');assert(await page.getByLabel('Folio exacto del ahorrador',{exact:true}).evaluate(e=>e.readOnly));
  await page.getByLabel('Importe solicitado para retirar',{exact:true}).fill('9164.40');await page.getByRole('button',{name:'Registrar retiro',exact:true}).click();assert.equal(await page.getByLabel('Importe solicitado para retirar',{exact:true}).inputValue(),'9164.40');await page.getByRole('button',{name:'Guardar solicitud',exact:true}).click();
  await page.getByText('Solicitud guardada. Puedes seguirla en esta lista.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>calls.find(x=>x.operation).operation.command),{kind:'SUBMIT',folio:'00123',type:'WITHDRAW',observation:'',amount:9164.4,continue_saving:true});
  await page.getByRole('button',{name:'Deshabilitar retiro',exact:true}).click();await page.getByLabel('Motivo',{exact:true}).fill('Terminó la vigencia autorizada');await page.getByRole('button',{name:'Confirmar deshabilitación',exact:true}).click();await page.getByRole('button',{name:'Habilitar retiro',exact:true}).waitFor();
  assert.equal((await writes()).at(-1).args.p_until,null);
  await page.evaluate(()=>render('00456'));await page.getByRole('button',{name:'Habilitar retiro',exact:true}).waitFor();
  await page.getByRole('button',{name:'Habilitar retiro',exact:true}).click();await page.getByLabel('Motivo',{exact:true}).fill('Segunda persona');
  await page.evaluate(()=>{fail='readback';});await page.getByRole('button',{name:'Confirmar habilitación',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button',{name:'Registrar retiro',exact:true}).count(),0);const retryKey=(await writes()).at(-1).args.p_key;
  await page.getByRole('button',{name:'Confirmar habilitación',exact:true}).click();await page.getByRole('button',{name:'Registrar retiro',exact:true}).waitFor();assert.equal((await writes()).at(-1).args.p_key,retryKey);
  await page.evaluate(()=>{configure=false;readOnly=true;render('00999');});await page.getByText('Para cambiar esta habilitación se necesita permiso de configuración de Ahorro.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Habilitar retiro',exact:true}).count(),0);
  await page.evaluate(()=>{configure=true;readOnly=false;delay='00111';render('00111');});await page.getByText('Consultando habilitación…',{exact:true}).waitFor();
  await page.evaluate(()=>{delay=null;render('00222');});await page.getByRole('button',{name:'Habilitar retiro',exact:true}).waitFor();await page.evaluate(()=>pending['00111']());assert.equal(await page.locator('[data-individual-withdrawal]').getAttribute('data-individual-withdrawal'),'00222');
  for(const width of [320,430,1440]){await page.setViewportSize({width,height:920});await page.getByRole('button',{name:'Habilitar retiro',exact:true}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,'individual-'+width+(chunks?'-bundle':'')+'.png'),fullPage:true});await page.getByRole('button',{name:'Cancelar',exact:true}).click();}
  // Actual historical and native account shells: the card is visible before expanding requests.
  await page.evaluate(()=>{
   const person={id:'record',folio:'00123',nombre:'PERSONA SINTÉTICA',estado:'ahorrando',saldo:9164.40,source_saldo:9164.40,certified:true,capital_actual:9000,rendimiento_actual:164.40,aporte:500,proceso:'1',observed_at:'2026-09-30'};
   const record={id:'record',version:1,status:'RESOLVED',source_data:{},proposed_data:{},field_defs:[],history:[]};
   SavingsPanelRepository.list=async()=>({rows:[person],total:1,saldo_total:9164.4,can_write:false,publication_mode:'PUBLISHED',cutoff:'2026-09-30',kpis:{padron:1,total:9164.4,activos:1,altas:0,bajas:0,pendientes:0,incidencias:0,cobranza:{},uncertified:0}});
   SavingsPanelRepository.nativeList=async()=>({items:[{participant_id:'native',folio:'00456',name:'PERSONA NATIVA',status:'Ahorrando',balance:1000}],total:1});
   SavingsPanelRepository.detail=async()=>({person,record,can_write:false,dates:[],date_count:0,withdrawn_total:0,withdrawals:[],as_of:'2026-09-30'});
   SavingsPanelRepository.affiliate=async()=>({folio:'00123',records:[{id:'record'}]});
   window.SavingsCertificationAdmin=()=>React.createElement('p',null,'Certificación conservada');window.SavingsWithdrawalList=()=>null;
   window.mountPanel=()=>ui.render(React.createElement(SavingsPanelAdmin,{app:{},onBack:()=>{},initialAffiliateId:'affiliate'}));mountPanel();
  });
  await page.locator('[data-individual-withdrawal="00123"]').waitFor();assert(await page.getByText('TIENE AHORRADO',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Habilitar retiro',exact:true}).click();await page.getByLabel('Motivo',{exact:true}).fill('Desde expediente');await page.getByRole('button',{name:'Confirmar habilitación',exact:true}).click();await page.getByRole('button',{name:'Registrar retiro',exact:true}).click();await page.getByLabel('Importe solicitado para retirar',{exact:true}).waitFor();
  assert(await page.getByLabel('Importe solicitado para retirar',{exact:true}).isVisible());
  await page.evaluate(()=>{SavingsPanelRepository.affiliate=async()=>({folio:'00456',records:[]});ui.render(React.createElement(SavingsPanelAdmin,{key:'native',app:{},onBack:()=>{window.returned=true;},initialAffiliateId:'native-affiliate'}));});
  await page.locator('[data-individual-withdrawal="00456"]').waitFor();await page.getByRole('button',{name:'Registrar retiro',exact:true}).click();await page.getByLabel('Importe solicitado para retirar',{exact:true}).waitFor();assert.equal(await page.getByLabel('Folio exacto del ahorrador',{exact:true}).inputValue(),'00456');
  await page.getByRole('button',{name:'Volver al administrador',exact:true}).click();assert.equal(await page.evaluate(()=>window.returned),true);
  assert.deepEqual(errors,[]);
  const result={status:'PASS',bundle:!!chunks,network:'BLOCKED',checks:['zero-period flow','fixed account and draft preserved on repeated entry','idempotent retry','duplicate-click lock','readback failure retains key and draft','read/config permission distinction','late response cannot cross accounts','direct existing withdrawal request','historical/native account navigation and external back','responsive 320/430/1440','no browser errors'],productionWrites:0};
  fs.writeFileSync(path.join(out,chunks?'browser-bundle.json':'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
