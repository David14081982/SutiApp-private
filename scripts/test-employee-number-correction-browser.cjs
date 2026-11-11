'use strict';
// Real React + screen + repository, with synthetic in-memory RPC responses only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),before=process.argv.includes('--before');
const baseRef='36977c57db14e4cbfd485e80ce194e49fd10a2d4',screenPath='app/screens-admin-affiliates.jsx';
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const baseline=cp.execFileSync('git',['show',baseRef+':'+screenPath],{cwd:root,encoding:'utf8'}),current=read(screenPath);
const out=path.join(root,'docs/qa/evidence/employee-number-correction');fs.mkdirSync(out,{recursive:true});
function loadPlaywright(){for(const p of [process.env.SUTIAPP_PLAYWRIGHT_PATH,'playwright-core','C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'].filter(Boolean)){try{return require(p);}catch{}}throw Error('Playwright Core unavailable');}
const unavailable='Este número de control no está disponible, elige otro';
const result={startedAt:new Date().toISOString(),mode:before?'BEFORE':'AFTER',baselineRef:baseRef,screenSha256:hash(current),repositorySha256:hash(read('app/admin-affiliates-repository.js')),synthetic:true,productionRequests:0,businessWrites:0,cases:[],pageErrors:[],blockedRequests:[],visual:[]};
async function check(name,fn){try{const evidence=await fn();result.cases.push({name,status:'PASS',...(evidence===undefined?{}:{evidence})});}catch(e){result.cases.push({name,status:'FAIL',error:e.message});}}
async function main(){
 const {chromium}=loadPlaywright(),browser=await chromium.launch({headless:true,executablePath:process.env.SUTIAPP_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
 const pages=new Set();
 async function mount(options={},source=current,width=1440,full=false){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});pages.add(page);page.setDefaultTimeout(2500);
  page.on('pageerror',error=>result.pageErrors.push(error.message));
  await page.route('**/*',route=>{result.blockedRequests.push({method:route.request().method(),protocol:new URL(route.request().url()).protocol});return route.abort();});
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>:root{--guinda:#910022;--guinda-50:#fff0f4;--grad-guinda-soft:linear-gradient(#a90030,#810026);--surface:#fff;--surface-2:#f6f3f4;--ink:#201520;--ink-3:#665566;--hairline:#ddd;--font:Arial;--mono:monospace}body{margin:0;font-family:Arial;background:#eef1f6}button,input,textarea,select{font-family:Arial}</style></head><body><main id="root"></main></body></html>');
  for(const p of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(p)});
  await page.evaluate(options=>{
   window.rpcCalls=[];window.created=[];window.closedCount=0;window.confirmCalls=0;
   window.confirm=()=>{window.confirmCalls++;return options.confirm!==false;};
   window.Icon=()=>React.createElement('svg',{'aria-hidden':true,width:16,height:16});
   window.AdminRepository={has:p=>['affiliates.read','affiliates.write'].includes(p)&&!(options.denied||[]).includes(p)};
   window.fixtureOptions={statuses:['Activo','Inactivo'],unions:[{code:'U',label:'Sindicato sintético'}],categories:[{code:'C',label:'Categoría sintética'}]};
   window.fixtureProfile={id:'00000000-0000-4000-8000-000000000001',numero_control:'SYNTH-1',full_name:'Persona sintética',affiliate_status_raw:'Activo',updated_at:'2026-01-01T00:00:00Z',required_count:0,verified_required_count:0,pending_document_count:0,auth_linked:false,is_archived:false};
   window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
    rpcCalls.push({name,args:JSON.parse(JSON.stringify(args))});
    if(name==='find_admin_affiliate_duplicates')return options.duplicateError?{error:options.duplicateError}:{data:options.duplicates||[]};
    if(name==='create_admin_affiliate')return options.error?{error:options.error}:{data:{profile:{...fixtureProfile,numero_control:args.p_values.numero_control,full_name:args.p_values.full_name},documents:[],requests:[],audit:[]}};
    if(name==='list_admin_affiliates'||name==='list_admin_archived_affiliates')return{data:{items:[fixtureProfile],total:1,page:1,page_size:25,filter_options:fixtureOptions}};
    if(name==='get_admin_affiliate_workbench')return{data:{profile:fixtureProfile,documents:[],requests:[],audit:[],capabilities:{documents:true,requests:true},options:{union:[],employment_category:[]}}};
    if(name==='list_admin_affiliate_control_changes')return{data:[]};
    throw Error('UNEXPECTED_RPC '+name);
   },from(){throw Error('UNEXPECTED_TABLE_ACCESS');},storage:{from(){throw Error('UNEXPECTED_STORAGE_ACCESS');}}})};
  },options);
  await page.addScriptTag({content:read('app/admin-affiliates-repository.js')});
  const anchor='window.AffiliatesAdminModule=AffiliatesModule;';assert.equal(source.split(anchor).length,2);
  await page.addScriptTag({content:source.replace(anchor,'window.TestNewAffiliateModal=NewAffiliateModal;window.TestAffiliateStyles=Styles;'+anchor)});
  await page.evaluate(full=>{
   const h=React.createElement;window.testRoot=ReactDOM.createRoot(document.getElementById('root'));
   testRoot.render(full?h(AffiliatesAdminModule,{app:{admin:AdminRepository,toast(){}},header:()=>h('header',null,'Afiliados'),onBack(){},onOpenModule(){}}):h(React.Fragment,null,h(TestAffiliateStyles),h(TestNewAffiliateModal,{options:fixtureOptions,onClose:()=>window.closedCount++,onCreated:value=>window.created.push(value)})));
  },full);
  await page.locator(full?'[data-admin-affiliate-detail]':'[role="dialog"]').waitFor();return page;
 }
 async function close(page){pages.delete(page);await page.close();}
 const input=(page,label)=>page.locator('label').filter({has:page.locator('span',{hasText:new RegExp('^'+label+'$')})}).locator('input');
 async function fill(page,number='SYNTH-NEW'){await input(page,'Número de control').fill(number);await input(page,'Nombre completo').fill('Nueva persona sintética');}
 async function submit(page){await page.getByRole('button',{name:'Crear afiliado',exact:true}).click();}
 async function alertFor(error,expected){const page=await mount({error});try{await fill(page);await submit(page);await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('alert').innerText(),expected);assert.equal(await page.evaluate(()=>created.length),0);return{safeMessage:expected};}finally{await close(page);}}
 try{
  await check('reserved number has a specific safe error',()=>alertFor({message:'AFFILIATE_CONTROL_RESERVED',code:'23505'},unavailable));
  await check('only control input is capped at 80',async()=>{const p=await mount();try{const observed={control:await input(p,'Número de control').getAttribute('maxlength'),name:await input(p,'Nombre completo').getAttribute('maxlength'),email:await input(p,'Correo de contacto').getAttribute('maxlength')};assert.deepEqual(observed,{control:'80',name:'240',email:'160'});await input(p,'Número de control').fill('X'.repeat(81));assert.equal((await input(p,'Número de control').inputValue()).length,80);return observed;}finally{await close(p);}});
  await check('precheck and create receive the same ASCII-trimmed TEXT with leading zeros',async()=>{const p=await mount();try{await fill(p,'  008322  ');await submit(p);await p.waitForFunction(()=>created.length===1);const calls=await p.evaluate(()=>rpcCalls);assert.deepEqual(calls.map(x=>x.name),['find_admin_affiliate_duplicates','create_admin_affiliate']);assert.equal(calls[0].args.p_values.numero_control,'008322');assert.deepEqual(calls[0].args.p_values,calls[1].args.p_values);assert.equal(calls[1].args.p_reason,'');return{precheck:calls[0].args.p_values.numero_control,create:calls[1].args.p_values.numero_control,optionalReason:true};}finally{await close(p);}});
  if(!before){
   const errors=[
    ['AFFILIATE_CONTROL_DUPLICATE','23505',unavailable],['AFFILIATE_CONTROL_UNAVAILABLE','23505',unavailable],
    ['AFFILIATE_CONTROL_RETRY_REQUIRED','40001','No fue posible confirmar la disponibilidad del número. Vuelve a intentar.'],
    ['could not serialize access due to concurrent update','40001','No fue posible confirmar la disponibilidad del número. Vuelve a intentar.'],
    ['AFFILIATE_WRITE_DENIED','42501','Tu cuenta no tiene permiso para registrar afiliados.'],
    ['AFFILIATE_CONTROL_REQUIRED','22023','El número de control debe tener entre 1 y 80 caracteres.'],
    ['AFFILIATE_NAME_REQUIRED','22023','El nombre completo debe tener entre 3 y 240 caracteres.'],
    ['AFFILIATE_STATUS_INVALID','22023','El estado seleccionado ya no está disponible. Recarga el padrón.'],
    ['AFFILIATE_RFC_DUPLICATE','23505','El RFC ya está registrado en otro afiliado. Revisa el dato.'],
    ['AFFILIATE_CURP_DUPLICATE','23505','La CURP ya está registrada en otro afiliado. Revisa el dato.'],
    ['AFFILIATE_DUPLICATE_REVIEW_REQUIRED','23505','El alta fue detenida por una coincidencia de identidad.'],
    ['AFFILIATE_REASON_TOO_LONG','22023','El motivo no puede superar los 500 caracteres.'],
    ['AFFILIATE_UNION_INVALID','22023','El sindicato seleccionado ya no está disponible. Recarga el padrón.'],
    ['AFFILIATE_CATEGORY_INVALID','22023','La categoría seleccionada ya no está disponible. Recarga el padrón.'],
    ['synthetic constraint details must not escape','23514','Los datos no cumplen las validaciones del padrón. Revisa los campos e inténtalo de nuevo.'],
    ['synthetic unique constraint is not necessarily the control','23505','El alta fue detenida por una coincidencia de identidad.'],
    ['synthetic raw error must not escape','500','No fue posible crear el afiliado. Verifica campos y permisos.'],
   ];
   for(const [message,code,expected]of errors)await check('safe backend error '+message,()=>alertFor({message,code},expected));
   for(const [matches,state,expected]of [[['numero_control'],'ACTIVE_MATCH',unavailable],[['numero_control'],'ARCHIVED_MATCH',unavailable],[['rfc'],'ACTIVE_MATCH','Hay una coincidencia de identidad. El alta se detuvo para revisión.'],[['curp'],'ACTIVE_MATCH','Hay una coincidencia de identidad. El alta se detuvo para revisión.'],[['email'],'ARCHIVED_MATCH','Existe una identidad archivada. El alta se bloqueó: restaura el registro existente.']])await check('precheck '+matches[0]+' '+state,async()=>{const p=await mount({duplicates:[{id:'00000000-0000-4000-8000-000000000002',numero_control:'SYNTH-2',name:'Otra persona sintética',matches,match_state:state}]});try{await fill(p);await submit(p);assert.equal(await p.getByRole('alert').innerText(),expected);assert.equal(await p.evaluate(()=>rpcCalls.filter(x=>x.name==='create_admin_affiliate').length),0);assert.equal(await p.getByText('Coincidencias encontradas').count(),1);}finally{await close(p);}});
   await check('email review keeps the existing explicit second confirmation',async()=>{const p=await mount({duplicates:[{id:'00000000-0000-4000-8000-000000000002',numero_control:'SYNTH-2',name:'Otra persona sintética',matches:['email'],match_state:'ACTIVE_MATCH'}]});try{await fill(p);await submit(p);assert.equal(await p.evaluate(()=>created.length),0);await p.getByRole('button',{name:'Confirmar alta',exact:true}).click();await p.waitForFunction(()=>created.length===1);assert.equal(await p.evaluate(()=>confirmCalls),1);}finally{await close(p);}});
   await check('repository permission denial remains enforced',async()=>{const p=await mount({denied:['affiliates.write']});try{await fill(p);await submit(p);assert.equal(await p.getByRole('alert').innerText(),'Tu cuenta no tiene permiso para registrar afiliados.');assert.equal(await p.evaluate(()=>rpcCalls.some(x=>x.name==='create_admin_affiliate')),false);}finally{await close(p);}});
   for(const number of ['00 AB 12','\u00a0008322\u00a0'])await check('normalization preserves non-ASCII or internal characters '+JSON.stringify(number),async()=>{const p=await mount();try{await fill(p,number);await submit(p);await p.waitForFunction(()=>created.length===1);assert.equal(await p.evaluate(()=>rpcCalls[0].args.p_values.numero_control),number);}finally{await close(p);}});
   await check('cancel and confirmation refusal do not create',async()=>{const p=await mount({confirm:false});try{await fill(p);await submit(p);assert.equal(await p.evaluate(()=>rpcCalls.some(x=>x.name==='create_admin_affiliate')),false);await p.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await p.evaluate(()=>closedCount),1);}finally{await close(p);}});
   await check('unchanged styles, other screens and mutation handlers',async()=>{const rest=s=>s.replace(/\r/g,'').replace(/  function (?:trimEmployeeNumber|creationError)[\s\S]*?(?=  function NewAffiliateModal)/,'').replace(/  function NewAffiliateModal[\s\S]*?(?=  function StatusModal)/,'');assert.equal(rest(current),rest(baseline));return{otherSourceUnchanged:true};});
  }
  for(const width of [390,1440])await check('visual and interaction parity at '+width,async()=>{
   const outputs=[];
   for(const [label,source]of [['baseline',baseline],['candidate',current]]){
    const page=await mount({},source,width,true);try{
     const initial=await page.locator('#root').innerHTML();
     await page.getByRole('button',{name:'Expediente',exact:true}).click();await page.getByText('Expediente vacío',{exact:true}).waitFor();
     await page.getByRole('button',{name:'Solicitudes',exact:true}).click();await page.getByText('Sin solicitudes',{exact:true}).waitFor();
     await page.getByRole('button',{name:'Auditoría',exact:true}).click();await page.getByText('Sin eventos administrativos',{exact:true}).waitFor();
     await page.getByRole('button',{name:'Datos generales',exact:true}).click();
     await page.getByRole('button',{name:'Nuevo afiliado',exact:true}).click();await page.getByRole('dialog').waitFor();
     const empty=await page.locator('#root').innerHTML();await fill(page);
     await page.screenshot({path:path.join(out,'browser-'+(before?'before':'after')+'-'+label+'-'+width+'.png'),fullPage:true,animations:'disabled'});
     await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
     outputs.push({initial,empty:empty.replace(/maxlength="(?:80|160)"/g,'maxlength="allowed"')});
    }finally{await close(page);}
   }
   assert.deepEqual(outputs[0],outputs[1]);const evidence={width,initialStructureSha256:hash(outputs[0].initial),modalStructureSha256:hash(outputs[0].empty),sectionsAndTabs:true,newAndCancel:true,allowedDifference:'numero_control maxlength only; empty-state copy unchanged'};result.visual.push(evidence);return evidence;
  });
 }finally{for(const page of pages)await page.close().catch(()=>{});await browser.close();}
 result.completedAt=new Date().toISOString();result.passed=result.cases.filter(x=>x.status==='PASS').length;result.failed=result.cases.filter(x=>x.status==='FAIL').length;result.status=result.failed||result.pageErrors.length||result.blockedRequests.length?'FAIL':'PASS';
 const output=path.join(out,'browser-'+(before?'before':'after')+'.json');fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,passed:result.passed,failed:result.failed,pageErrors:result.pageErrors,output,failures:result.cases.filter(x=>x.status==='FAIL')},null,2));if(result.status!=='PASS')process.exitCode=1;
}
main().catch(error=>{result.status='FAIL';result.harnessError=error.stack;fs.writeFileSync(path.join(out,'browser-'+(before?'before':'after')+'.json'),JSON.stringify(result,null,2)+'\n');console.error(error.stack);process.exitCode=1;});
