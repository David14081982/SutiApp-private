'use strict';
// Real React screen/repository over isolated RPC fixtures. No production data or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/reports-jc/refund-browser');
const html='<!doctype html><html lang="es"><meta charset="utf-8"><style>:root{--surface:#fff;--surface-2:#f7f7fa;--ink:#17233b;--ink-2:#526078;--hairline:#dfe3ea;--hairline-strong:#c4cad5;--guinda:#861e45}*{box-sizing:border-box}body{margin:0;font:14px Arial;background:#f7f7fa}#root{padding:16px}</style><body><div id="root"></div></body></html>';
async function main(){
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:940}}),errors=[],external=[];page.setDefaultTimeout(7000);
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{if(route.request().url()==='http://127.0.0.1/refunds-isolated')return route.fulfill({status:200,contentType:'text/html',body:html});external.push(route.request().url());return route.abort();});
 try{
  await page.goto('http://127.0.0.1/refunds-isolated');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{
   window.__calls=[];window.__peopleCalls=[];window.__cases=[];window.__periods=[];window.__dirty=false;window.__dirtyEvents=[];window.__saved=0;window.__phase='authenticated';window.__token='synthetic-token-1';window.__session='synthetic-session-1';window.__readOnly=false;window.__ambiguousOnce=true;window.__prior={};window.__holdRead=false;window.__listError=null;
   window.AffiliateAuth={getState:()=>({phase:window.__phase,session:{user:{id:'synthetic-admin'},session_id:window.__session,access_token:window.__token},affiliate:{id:'synthetic-context'},impersonation:null})};
   window.AdminRepository={getState:()=>({subjectKey:'synthetic-admin',assignment:{permissions:window.__readOnly?['savings.read']:['savings.read','savings.write','savings.approve']}})};
   const clone=value=>structuredClone(value);
   window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
    window.__calls.push({name,args:clone(args)});
    if(name==='get_admin_savings_refund_people'){window.__peopleCalls.push(args);return {data:{rows:[{participant_id:'00000000-0000-4000-8000-000000000001',nombre:'Persona de prueba',folio:'TEST-001',is_archived:false},{participant_id:'00000000-0000-4000-8000-000000000002',nombre:'Identidad en conflicto',folio:'TEST-X',identity_conflict:true},{participant_id:'00000000-0000-4000-8000-000000000003',nombre:'Afiliado anterior',folio:'TEST-ARCHIVED',is_archived:true}]},error:null};}
    if(name==='get_admin_savings_refunds'){
     const data={cases:clone(window.__cases.filter(c=>!args.p_case_id||c.id===args.p_case_id).map(c=>({...c,events:args.p_case_id?c.events:[]}))),permissions:{can_write:!window.__readOnly,can_approve:!window.__readOnly},coveragePeriods:clone(window.__periods),coverageEvents:[],today:'2026-11-20'};
     if(window.__holdRead)await new Promise(resolve=>{window.__releaseRead=resolve;});
     return window.__listError?{error:{message:window.__listError}}:{data,error:null};
    }
    if(name!=='save_admin_savings_refund')throw Error('UNEXPECTED_RPC');
    const c=args.p_command,id=args.p_client_action_id;
    if(window.__prior[id])return {data:clone(window.__prior[id]),error:null};
    if(window.__saveError)return {error:{message:window.__saveError}};
    let entry=window.__cases[0],result;
    if(c.kind==='CREATE'){
     if(entry)throw Error('FIXTURE_DUPLICATE_CREATE');
     entry={id:'00000000-0000-4000-8000-000000000010',folio:'RE-TEST-001',participant_id:c.participant_id,numero_control:'TEST-001',cause:c.cause,reason:c.reason,version:1,status:'DRAFT',authorized_amount:null,paid_amount:0,pending_amount:null,deductions:clone(c.deductions),payments:[],events:[]};window.__cases=[entry];
    }else if(c.kind==='CONFIRM_PERIOD'){
     result={period:c.period,confirmed_at:'2026-11-20T20:00:00Z',invalidated_at:null,confirmed_case_count:1,version:1,reason:c.reason};window.__periods=[result];
    }else{
     if(c.case_id!==entry.id||c.expected_version!==entry.version)throw Error('FIXTURE_VERSION_CONTRACT');
     if(c.kind==='SAVE'){entry.reason=c.reason;entry.cause=c.cause;entry.deductions=clone(c.deductions);entry.status='DRAFT';}
     else if(c.kind==='SUBMIT')entry.status='SUBMITTED';
     else if(c.kind==='APPROVE'){entry.status='APPROVED';entry.authorized_amount=300;entry.pending_amount=300;}
     else if(c.kind==='PAY'){
      const first=entry.payments.length===0;entry.status=first?'PARTIAL':'PAID';entry.paid_amount=first?100:300;entry.pending_amount=first?200:0;
      entry.payments.push({id:'synthetic-payment-'+entry.payments.length,amount:c.amount,paid_on:c.paid_on,bank_reference:c.bank_reference});
     }else throw Error('UNEXPECTED_COMMAND');entry.version++;
    }
    if(c.kind!=='CONFIRM_PERIOD'){entry.events.push({id:'synthetic-event-'+entry.events.length,action:c.kind,created_at:'2026-11-20T20:00:00Z',reason:c.reason});result=clone(entry);delete result.events;}
    window.__prior[id]=clone(result);
    if(c.kind==='CREATE'&&window.__ambiguousOnce){window.__ambiguousOnce=false;return {error:{message:'SYNTHETIC_RESPONSE_LOST'}};}
    return {data:result,error:null};
   }})};
  });
  for(const file of ['app/savings-refunds-repository.js','app/savings-refunds-admin.jsx'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{
   window.__root=ReactDOM.createRoot(document.getElementById('root'));
   window.__mount=key=>window.__root.render(React.createElement(window.SavingsRefundsAdmin,{key,onSaved:async()=>{window.__saved++;},onDirty:value=>{window.__dirty=value;window.__dirtyEvents.push(value);}}));window.__mount('first');
  });
  await page.getByRole('button',{name:'Nuevo expediente',exact:true}).click();await page.getByLabel('Buscar por número de control o nombre').fill('TEST-001');await page.getByRole('button',{name:'Buscar ahorrador',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/Identidad en conflicto/}).count(),0);assert.equal(await page.getByRole('button',{name:/Afiliado anterior/}).count(),0,'archived identities are only available in retrospective capture');await page.getByRole('button',{name:'Persona de prueba · TEST-001',exact:true}).click();
  await page.getByLabel('Justificación',{exact:true}).fill('Descuentos de prueba enviados antes de la baja.');
  async function fillDeduction(index,{reference,date,actual,confirmed}){
   const form=page.locator('fieldset').nth(index);await form.getByLabel('Referencia única del descuento o recibo').fill(reference);await form.getByLabel('Fecha del descuento / quincena').fill(date);await form.getByLabel('Fecha en que se envió a RH').fill('2026-10-01');await form.getByLabel('Importe que correspondía descontar').fill('0');
   if(actual!==null){await form.getByLabel('Importe realmente descontado (vacío si es futuro)').fill(String(actual));await form.getByLabel('Fecha de confirmación del descuento').fill(confirmed);assert.equal(await form.getByLabel('Referencia que acredita el descuento').getAttribute('maxlength'),'180');await form.getByLabel('Referencia que acredita el descuento').fill('Constancia sintética '+reference);}
   await form.getByLabel('Tratamiento del importe en el ahorro').selectOption('NOT_CREDITED');await form.getByLabel('Explicación del tratamiento del saldo').fill('El importe de prueba no se acreditó al ahorro.');
  }
  await fillDeduction(0,{reference:'TEST-QUINCENA-1',date:'2026-10-15',actual:100,confirmed:'2026-10-15'});await page.getByRole('button',{name:'Agregar otra quincena'}).click();await fillDeduction(1,{reference:'TEST-QUINCENA-2',date:'2026-11-15',actual:null});assert.equal(await page.evaluate(()=>window.__dirty),true);
  const refreshed=await page.evaluate(()=>{const before=window.SavingsRefundsRepository.contextKey();window.__token='synthetic-refreshed-token';window.__mount('first');return before===window.SavingsRefundsRepository.contextKey();});assert.equal(refreshed,true,'token refresh preserves actor/session context');assert.equal(await page.locator('textarea').first().inputValue(),'Descuentos de prueba enviados antes de la baja.');assert.equal(await page.locator('fieldset').count(),2);assert.equal(await page.evaluate(()=>window.__dirty),true);
  await page.getByRole('button',{name:'Guardar expediente',exact:true}).click();await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Guardar expediente',exact:true}).click();await page.getByRole('button',{name:/Ver expediente|Cerrar detalle/}).waitFor();
  const creates=await page.evaluate(()=>window.__calls.filter(c=>c.name==='save_admin_savings_refund'&&c.args.p_command.kind==='CREATE'));
  assert.equal(creates.length,2);assert.equal(creates[0].args.p_client_action_id,creates[1].args.p_client_action_id,'ambiguous retry keeps the same idempotency key');assert.equal(await page.evaluate(()=>window.__cases.length),1);assert.equal(creates[0].args.p_command.deductions.length,2);assert.equal(creates[0].args.p_command.deductions[1].actual_amount,null);assert.equal(creates[0].args.p_command.deductions[1].confirmed_on,null);assert.equal(creates[0].args.p_command.participant_id,'00000000-0000-4000-8000-000000000001');
  async function openCase(){if(await page.getByRole('button',{name:'Ver expediente',exact:true}).count())await page.getByRole('button',{name:'Ver expediente',exact:true}).click();}
  await openCase();await page.getByRole('button',{name:'Editar captura',exact:true}).click();const second=page.locator('fieldset').nth(1);assert(await second.getByLabel('Referencia única del descuento o recibo').isEditable()===false);await second.getByLabel('Importe realmente descontado (vacío si es futuro)').fill('200');await second.getByLabel('Fecha de confirmación del descuento').fill('2026-11-15');await second.getByLabel('Referencia que acredita el descuento').fill('Constancia sintética confirmada');
  await page.evaluate(()=>{window.__saveError='SAVINGS_REFUND_VERSION_CONFLICT';});await page.getByRole('button',{name:'Guardar expediente',exact:true}).click();await page.getByRole('alert').filter({hasText:'Otra persona'}).waitFor();await page.evaluate(()=>{window.__saveError=null;});await page.getByRole('button',{name:'Guardar expediente',exact:true}).click();await page.getByRole('button',{name:/Ver expediente|Cerrar detalle/}).waitFor();
  const edit=await page.evaluate(()=>window.__calls.find(c=>c.args?.p_command?.kind==='SAVE').args.p_command);assert.equal(edit.expected_version,1);assert.equal(edit.deductions[1].actual_amount,200);await openCase();await page.getByRole('button',{name:'Enviar a revisión',exact:true}).click();await page.getByLabel('Justificación',{exact:true}).fill('Revisión del expediente sintético completo.');assert.equal(await page.evaluate(()=>window.__dirty),true,'editing an action must protect navigation');await page.getByRole('button',{name:'Enviar a revisión',exact:true}).click();await page.locator('.srf-state').filter({hasText:'Por autorizar'}).waitFor();
  await openCase();await page.getByRole('button',{name:'Autorizar',exact:true}).click();assert.equal(await page.getByLabel('Importe autorizado').inputValue(),'300.00');await page.getByLabel('Justificación',{exact:true}).fill('Autorización del exceso confirmado de prueba.');await page.getByRole('button',{name:'Autorizar reembolso',exact:true}).click();await page.locator('.srf-state').filter({hasText:'Autorizado'}).waitFor();
  for(const payment of [{amount:'100',date:'2026-11-16',reference:'TEST-BANK-1',state:'Pago parcial'},{amount:'200',date:'2026-11-20',reference:'TEST-BANK-2',state:'Reembolsado'}]){
   await openCase();await page.getByRole('button',{name:'Registrar devolución',exact:true}).click();await page.getByLabel('Importe devuelto').fill(payment.amount);await page.getByLabel('Fecha real de la devolución').fill(payment.date);await page.getByLabel('Referencia bancaria o comprobante del pago').fill(payment.reference);await page.getByLabel('Justificación y explicación si es una devolución anterior').fill('Devolución manual de prueba acreditada por comprobante.');assert.equal(await page.evaluate(()=>window.__dirty),true);await page.getByRole('button',{name:'Registrar devolución realizada',exact:true}).click();await page.locator('.srf-state').filter({hasText:payment.state}).waitFor();
  }
  const payments=await page.evaluate(()=>window.__calls.filter(c=>c.args?.p_command?.kind==='PAY').map(c=>c.args.p_command));assert.deepEqual(payments.map(p=>[p.amount,p.paid_on,p.bank_reference,p.expected_version]),[[100,'2026-11-16','TEST-BANK-1',4],[200,'2026-11-20','TEST-BANK-2',5]]);assert.equal(await page.evaluate(()=>window.__cases[0].pending_amount),0);
  await openCase();await page.getByText('Historial del expediente',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-savings-refunds]').textContent.includes('SUBMIT'));assert((await page.evaluate(()=>window.__calls)).some(c=>c.name==='get_admin_savings_refunds'&&c.args.p_case_id),'audit details must be fetched with the case ID');
  await page.getByText('Histórico mensual de reembolsos',{exact:true}).click();await page.getByLabel('Mes del histórico').fill('2026-11');await page.getByLabel('Referencia o explicación de la revisión').fill('Revisión de todos los casos sintéticos del periodo.');assert(await page.getByRole('button',{name:'Confirmar histórico del mes'}).isDisabled());assert.equal(await page.evaluate(()=>window.__dirty),true,'editing historical coverage protects navigation');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Confirmar histórico del mes'}).click();await page.getByText(/2026-11 · Histórico registrado/).waitFor({state:'attached'});
  const coverage=await page.evaluate(()=>window.__calls.find(c=>c.args?.p_command?.kind==='CONFIRM_PERIOD').args.p_command);assert.equal(coverage.period,'2026-11-01');assert.equal(await page.evaluate(()=>window.__dirty),false);
  await page.evaluate(()=>{window.__savedCases=structuredClone(window.__cases);window.__cases=[{...window.__cases[0],status:'SUBMITTED',authorized_amount:null,paid_amount:0,pending_amount:null,payments:[],deductions:[{...window.__cases[0].deductions[0],expected_amount:100.10,actual_amount:100.30}]}];window.__mount('cents');});await page.getByRole('button',{name:'Ver expediente',exact:true}).waitFor();await openCase();await page.getByRole('button',{name:'Autorizar',exact:true}).click();assert.equal(await page.getByLabel('Importe autorizado').inputValue(),'0.20','authorization default is exact to two decimals');await page.evaluate(()=>{window.__cases=window.__savedCases;window.__mount('restored');});await page.getByText('RE-TEST-001 · Control TEST-001',{exact:true}).waitFor();
  await page.evaluate(()=>{window.__readOnly=true;window.__mount('read-only');});await page.getByText('RE-TEST-001 · Control TEST-001',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Nuevo expediente',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Confirmar histórico del mes'}).count(),0);
  const mismatch=await page.evaluate(async()=>{window.__holdRead=true;const request=window.SavingsRefundsRepository.list({});await new Promise(resolve=>setTimeout(resolve,0));window.__session='synthetic-session-2';window.__holdRead=false;window.__releaseRead();try{await request;return false;}catch(error){return error.message;}});assert.equal(mismatch,'CONTEXT_CHANGED');
  await page.evaluate(()=>{window.__phase='signed_out';window.__mount('signed-out');});await page.getByRole('alert').waitFor();assert.equal(await page.locator('article').count(),0);assert.equal(await page.getByRole('button',{name:'Nuevo expediente',exact:true}).count(),0);
  await page.evaluate(()=>{window.__phase='authenticated';window.__readOnly=false;window.__mount('mobile');});await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Nuevo expediente',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(output,'refunds-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const result={status:'PASS',syntheticRpcOnly:true,flows:6,multipleQuincenas:true,futureAndConfirmedDistinct:true,idempotencyAmbiguousRetry:true,versionedEditAndApproval:true,partialThenPaid:true,paymentFieldsMatchSql:true,auditDetailFetched:true,periodConfirmation:true,dirtyForms:true,tokenRefreshPreservesDraft:true,exactCentAuthorization:true,confirmationReferenceLimit:180,readonlyUi:true,changedContextDiscarded:true,signedOutDataCleared:true,mobile390:true,externalRequests:0,productionWrites:0};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(error){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
