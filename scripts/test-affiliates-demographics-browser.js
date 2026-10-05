'use strict';
// Actual screen and repository, isolated backend fixtures, no production traffic.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(process.env.AFFILIATES_TEST_ROOT||path.join(__dirname,'..')),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dir=path.resolve(root,process.env.AFFILIATES_EVIDENCE_DIR||'docs/qa/evidence/affiliates-demographics');
async function main(){
 fs.mkdirSync(dir,{recursive:true});const errors=[],checks=[];
 const server=http.createServer((req,res)=>res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="fixture"></div></body></html>'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  async function fixture(width=1440,height=900,before=false){
   const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.addStyleTag({content:':root{--surface:#fff;--surface-2:#edf0f5;--hairline:#e1e5ed;--ink:#172033;--ink-2:#364154;--ink-3:#657086;--guinda:#901040;--guinda-50:#fff1f6;--grad-guinda-soft:#a80038;--font:Arial;--mono:monospace}*{box-sizing:border-box}body{font-family:Arial;background:#f3f5f9;margin:0}header{padding:20px}button,input,textarea,select{font-family:inherit}#fixture{max-width:100%}'});
   for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
   await page.evaluate(()=>{
    window.Icon=()=>null;window.confirm=()=>true;window.__calls=[];window.__fail='';window.__wait=false;window.__writable=true;
    window.__profiles=[{id:'a1',numero_control:'QA-001',full_name:'Persona de prueba Uno',display_name:'Uno',phone_raw:'6620000001',updated_at:'2026-09-09T01:00:00Z',affiliate_status_raw:'Activo',auth_linked:false},{id:'a2',numero_control:'QA-002',full_name:'Persona de prueba Dos',display_name:'Dos',updated_at:'2026-09-09T01:00:00Z',affiliate_status_raw:'Activo',auth_linked:false}];
    window.__types=[{id:'t1',code:'ine_front',label:'Identificación oficial',accepted_mime_types:['application/pdf','image/png'],file_upload_allowed:true,max_file_size_bytes:10485760},{id:'t2',code:'address_proof',label:'Comprobante de domicilio',accepted_mime_types:['application/pdf'],file_upload_allowed:true,max_file_size_bytes:10485760}];
    window.__docs=Array.from({length:10},(_,i)=>({id:'d'+i,affiliate_id:'a1',document_type_id:i===0?'t2':'t1',document_type:__types[i===0?1:0],mimeType:'application/pdf',mime_type:'application/pdf',status:'VERIFIED',available:true,created_at:'2026-09-01T01:00:00Z',updated_at:'2026-09-01T01:00:00Z'}));
    window.__detail=id=>({profile:__profiles.find(p=>p.id===id),capabilities:{documents:true,requests:true},documents:__docs.filter(d=>d.affiliate_id===id),requests:[],audit:[],options:{union:[],employment_category:[]}});
    window.AdminRepository={has:p=>!p.endsWith('.write')||__writable,getState:()=>({phase:'authorized'}),subscribe:()=>()=>{},startImpersonation:async(id,reason)=>{__calls.push({name:'start_affiliate_impersonation',args:{p_affiliate_id:id,p_reason:reason}});}};
    window.AffiliateAuth={getState:()=>({phase:'authenticated',session:{user:{id:'admin-fixture'}},affiliate:{id:'a1'}}),subscribe:()=>()=>{}};
    window.__client={
     rpc:async(name,args)=>{__calls.push({name,args});
      if(name==='list_admin_affiliates'||name==='list_admin_archived_affiliates')return{data:{items:__profiles,total:2,page:1,page_size:25,filter_options:{statuses:['Activo','Baja'],unions:[],categories:[]}}};
      if(name==='find_admin_affiliate_duplicates')return{data:[]};
      if(name==='create_admin_affiliate'){const p={id:'new-affiliate',...args.p_values,updated_at:'2026-09-24T00:00:00Z'};__profiles.push(p);return{data:__detail(p.id)};}
      if(['change_admin_affiliate_status','archive_admin_affiliate','restore_admin_affiliate'].includes(name)){const p=__profiles.find(p=>p.id===args.p_affiliate_id);if(name==='change_admin_affiliate_status')p.affiliate_status_raw=args.p_new_status;else p.is_archived=name==='archive_admin_affiliate';return{data:__detail(p.id)};}
      if(name==='get_admin_affiliate_workbench')return{data:__detail(args.p_affiliate_id)};
      if(name==='update_admin_affiliate'){
       if(__wait)await new Promise(resolve=>window.__resolve=resolve);
       if(__fail)return{error:{message:__fail}};
       const p=__profiles.find(p=>p.id===args.p_affiliate_id);Object.assign(p,args.p_patch,{updated_at:'2026-09-09T02:00:00Z'});return{data:__detail(p.id)};
      }
      if(name==='register_admin_affiliate_document'){
       if(__fail)return{error:{message:__fail}};
       const type=__types.find(t=>t.id===args.p_document_type_id),doc={id:'new-doc',affiliate_id:args.p_affiliate_id,document_type_id:type.id,document_type:type,status:'PENDING_REVIEW',mimeType:args.p_mime_type,created_at:'2026-09-09T02:00:00Z',updated_at:'2026-09-09T02:00:00Z'};__docs.push(doc);return{data:{document:doc}};
      }
      throw Error('UNEXPECTED_RPC '+name);
     },
     from:name=>{if(name!=='document_types')throw Error('UNEXPECTED_TABLE');const q={select:()=>q,eq:()=>q,order:async()=>({data:__types})};return q;},
     storage:{from:bucket=>({upload:async(p,file,options)=>{__calls.push({name:'storage.upload',bucket,path:p,size:file.size,options});return{};},remove:async paths=>{__calls.push({name:'storage.remove',paths});return{};}})}
    };
    window.SutiSupabase={getClient:()=>__client};
    window.DocumentWorkflowRepository={listAdminDocuments:async id=>__docs.filter(d=>d.affiliate_id===id),adminPreview:async(id,affiliate)=>{__calls.push({name:'preview',id,affiliate});return{signedUrl:'data:application/pdf;base64,JVBERi0xLjQK'};}};
    window.DocumentViewer=({onClose})=>React.createElement('button',{onClick:onClose},'Cerrar vista de documento');
   });
   for(const f of ['app/private-resource-demand.js','app/admin-affiliates-repository.js'])await page.addScriptTag({content:read(f)});
   await page.addScriptTag({content:before?require('child_process').execFileSync('git',['show','HEAD:app/screens-admin-affiliates.jsx'],{cwd:root,encoding:'utf8'}):fs.readFileSync(process.env.AFFILIATES_BUNDLE_PATH||path.join(root,'app/bundle.js'),'utf8').split('/* @@file screens-admin-affiliates.jsx */')[1].split('/* @@file ')[0]});
   await page.evaluate(()=>{
    window.__root=ReactDOM.createRoot(document.getElementById('fixture'));
    window.__render=()=>__root.render(React.createElement(AffiliatesAdminModule,{app:{admin:AdminRepository,toast:()=>{}},header:()=>React.createElement('header',null,'Afiliados'),onOpenModule:(id,args)=>__calls.push({name:'navigate',id,args})}));__render();
   });
   await page.locator('[data-admin-affiliate-detail="a1"]').waitFor();return page;
  }
  const p=await fixture(),editor=p.locator('[data-affiliate-edit-form]');
  const edit=()=>p.getByRole('button',{name:'Editar información',exact:true}).click();
  const save=()=>editor.getByRole('button',{name:'Guardar cambios auditados'}).click();
  const detail=()=>p.locator('[data-admin-affiliate-detail]').waitFor();
  const checkControls=async(container)=>{
   for(const [label,values] of [['Género',['','Masculino','Femenino']],['Estado civil',['','Soltero(a)','Casado(a)','Unión Libre','Viudo(a)']]]){
    const control=container.getByLabel(label,{exact:true});assert.equal(await control.evaluate(e=>e.tagName),'SELECT');
    assert.deepEqual(await control.locator('option:not([disabled])').evaluateAll(nodes=>nodes.map(n=>n.value)),values);
   }
   assert.equal(await container.getByLabel('Número de hijos',{exact:true}).getAttribute('inputmode'),'numeric');
   for(const label of ['Tipo de empleado','Estatus de afiliación','Estatus laboral'])assert.equal(await container.getByLabel(label,{exact:true}).count(),0);
  };
  await edit();await checkControls(editor);
  await editor.getByLabel('Género',{exact:true}).selectOption('Femenino');await editor.getByLabel('Estado civil',{exact:true}).selectOption('Unión Libre');
  for(const invalid of ['-1','1.5','abc','1e2']){
   await editor.getByLabel('Número de hijos',{exact:true}).fill(invalid);await save();assert.match(await editor.getByRole('alert').textContent(),/entero/);
   assert.equal(await p.evaluate(()=>__calls.filter(c=>c.name==='update_admin_affiliate').length),0);
  }
  await editor.getByLabel('Número de hijos',{exact:true}).fill('0');await p.evaluate(()=>window.__fail='NETWORK_ERROR');await save();
  assert.equal(await editor.getByLabel('Número de hijos',{exact:true}).inputValue(),'0');assert.match(await editor.getByRole('alert').textContent(),/vuelve a intentar/);
  await p.evaluate(()=>window.__fail='');await save();await detail();
  const patched=await p.evaluate(()=>__calls.filter(c=>c.name==='update_admin_affiliate').at(-1).args);
  assert.deepEqual(patched.p_patch,{gender_raw:'Femenino',marital_status_raw:'Unión Libre',children_count_raw:'0'});assert.equal(patched.p_affiliate_id,'a1');
  assert.equal(await p.locator('.aff-fact').filter({hasText:'Número de hijos'}).locator('strong').textContent(),'0');
  await p.locator('[data-affiliate-row="a2"]').click();await p.locator('[data-admin-affiliate-detail="a2"]').waitFor();
  await p.locator('[data-affiliate-row="a1"]').click();await p.locator('[data-admin-affiliate-detail="a1"]').waitFor();
  await edit();assert.equal(await editor.getByLabel('Género',{exact:true}).inputValue(),'Femenino');assert.equal(await editor.getByLabel('Estado civil',{exact:true}).inputValue(),'Unión Libre');assert.equal(await editor.getByLabel('Número de hijos',{exact:true}).inputValue(),'0');
  await editor.getByLabel('Número de hijos',{exact:true}).fill('');await save();await detail();assert.deepEqual(await p.evaluate(()=>__calls.filter(c=>c.name==='update_admin_affiliate').at(-1).args.p_patch),{children_count_raw:null});
  checks.push('Edit: exact dropdowns, invalid count blocked, zero retained, error preserves draft, retry, RPC minimal patch, readback and explicit NULL');

  await p.evaluate(()=>Object.assign(__profiles[0],{gender_raw:'F',marital_status_raw:'DIVORCIADO',children_count_raw:'SIN DATO',financial_employee_type:'HISTORICAL_TYPE',financial_affiliation_status:'HISTORICAL_AFFILIATION',financial_employment_status:'HISTORICAL_EMPLOYMENT'}));
  await p.locator('[data-affiliate-row="a2"]').click();await p.locator('[data-admin-affiliate-detail="a2"]').waitFor();await p.locator('[data-affiliate-row="a1"]').click();await p.locator('[data-admin-affiliate-detail="a1"]').waitFor();
  await edit();await checkControls(editor);assert.equal(await editor.getByLabel('Género',{exact:true}).inputValue(),'F');assert.equal(await editor.getByLabel('Estado civil',{exact:true}).inputValue(),'DIVORCIADO');
  assert.equal(await editor.getByLabel('Estado civil',{exact:true}).locator('option:checked').evaluate(option=>option.disabled),true);
  await editor.getByLabel('Teléfono',{exact:true}).fill('6621111111');await save();await detail();
  assert.deepEqual(await p.evaluate(()=>__calls.filter(c=>c.name==='update_admin_affiliate').at(-1).args.p_patch),{phone_raw:'6621111111'});
  assert.equal(await p.evaluate(()=>__profiles[0].children_count_raw),'SIN DATO');
  assert.deepEqual(await p.locator('.aff-tabs button').allTextContents(),['Datos generales','Afiliación','Expediente','Solicitudes','Acceso','Auditoría']);
  await p.getByRole('button',{name:'Afiliación',exact:true}).click();assert(!/Tipo de empleado|Estatus laboral/.test(await p.locator('.aff-facts').textContent()));
  assert.equal(await p.evaluate(()=>__profiles[0].financial_employee_type),'HISTORICAL_TYPE');
  checks.push('Historical raw values preserved on unrelated edits; disabled current value visible; removed fields never patched; six tabs preserved');

  await p.getByRole('button',{name:'Nuevo afiliado',exact:true}).click();const modal=p.getByRole('dialog');await checkControls(modal);
  await modal.getByLabel('Número de control',{exact:true}).fill('QA-003');await modal.getByLabel('Nombre completo',{exact:true}).fill('Persona nueva de prueba');
  await modal.getByLabel('Género',{exact:true}).selectOption('Masculino');await modal.getByLabel('Estado civil',{exact:true}).selectOption('Casado(a)');
  await modal.getByLabel('Número de hijos',{exact:true}).fill('-2');await modal.getByRole('button',{name:'Crear afiliado',exact:true}).click();assert.match(await modal.getByRole('alert').textContent(),/entero/);assert.equal(await p.evaluate(()=>__calls.filter(c=>c.name==='create_admin_affiliate').length),0);
  await modal.getByLabel('Número de hijos',{exact:true}).fill('3');await modal.getByRole('button',{name:'Crear afiliado',exact:true}).click();await modal.waitFor({state:'detached'});await p.locator('[data-admin-affiliate-detail="new-affiliate"]').waitFor();
  const created=await p.evaluate(()=>__calls.find(c=>c.name==='create_admin_affiliate').args.p_values);
  assert.equal(created.gender_raw,'Masculino');assert.equal(created.marital_status_raw,'Casado(a)');assert.equal(created.children_count_raw,'3');
  for(const key of ['financial_employee_type','financial_affiliation_status','financial_employment_status'])assert(!(key in created));
  await p.getByRole('button',{name:'Datos generales',exact:true}).click();assert.equal(await p.locator('.aff-fact').filter({hasText:'Número de hijos'}).locator('strong').textContent(),'3');
  await edit();assert.equal(await editor.getByLabel('Número de hijos',{exact:true}).inputValue(),'3');await p.screenshot({path:path.join(dir,'edit-desktop.png')});
  checks.push('Create: same choices, invalid count blocked before RPC, complete payload, readback in detail and edit');
  await p.close();
  for(const [width,height] of [[1440,900],[390,844]]){
   const page=await fixture(width,height);await page.getByRole('button',{name:'Nuevo afiliado',exact:true}).click();const dialog=page.getByRole('dialog');await checkControls(dialog);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await dialog.getByLabel('Número de hijos',{exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(dir,`create-${width}.png`)});await page.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify({status:'PASS',checks,pageErrors:errors,source:'generated bundle screen + actual repository',productionTraffic:false},null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
