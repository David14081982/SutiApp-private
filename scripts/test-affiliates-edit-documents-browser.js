'use strict';
// Actual screen and repository, isolated backend fixtures, no production traffic.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dir=path.join(root,'docs/qa/evidence/affiliates-edit-documents-20260909');
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
    window.AdminRepository={has:p=>!p.endsWith('.write')||__writable,getState:()=>({phase:'authorized'}),subscribe:()=>()=>{}};
    window.AffiliateAuth={getState:()=>({phase:'authenticated',session:{user:{id:'admin-fixture'}},affiliate:{id:'a1'}}),subscribe:()=>()=>{}};
    window.__client={
     rpc:async(name,args)=>{__calls.push({name,args});
      if(name==='list_admin_affiliates')return{data:{items:__profiles,total:2,page:1,page_size:25,filter_options:{statuses:['Activo'],unions:[],categories:[]}}};
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
   await page.addScriptTag({content:before?fs.readFileSync(path.join(dir,'screen-before.txt'),'utf8'):read('app/screens-admin-affiliates.jsx')});
   await page.evaluate(()=>{
    window.__root=ReactDOM.createRoot(document.getElementById('fixture'));
    window.__render=()=>__root.render(React.createElement(AffiliatesAdminModule,{app:{admin:AdminRepository,toast:()=>{}},header:()=>React.createElement('header',null,'Afiliados'),onOpenModule:(id,args)=>__calls.push({name:'navigate',id,args})}));__render();
   });
   await page.locator('[data-admin-affiliate-detail="a1"]').waitFor();return page;
  }
  const page=await fixture();
  await page.getByRole('button',{name:'Editar información',exact:true}).click();
  const form=page.locator('[data-affiliate-edit-form]'),save=form.getByRole('button',{name:'Guardar cambios auditados'});
  assert.equal(await form.locator('input').count(),25);assert.equal(await form.locator('select').count(),2);
  await form.getByLabel('Teléfono',{exact:true}).fill('6629999999');await save.click();
  assert((await form.getByRole('alert').textContent()).includes('8 caracteres'));assert.equal(await page.evaluate(()=>__calls.filter(c=>c.name==='update_admin_affiliate').length),0);
  assert(await form.locator('textarea').evaluate(e=>document.activeElement===e));
  await form.locator('textarea').fill('Corrección de teléfono');
  await page.evaluate(()=>window.__fail='AFFILIATE_VERSION_CONFLICT');await save.click();
  assert((await form.getByRole('alert').textContent()).includes('otra sesión'));assert.equal(await form.getByLabel('Teléfono',{exact:true}).inputValue(),'6629999999');
  await page.evaluate(()=>window.__fail='AFFILIATE_RFC_DUPLICATE');await save.click();assert((await form.getByRole('alert').textContent()).includes('RFC'));
  await page.evaluate(()=>{window.__fail='';window.__wait=true;});await save.click();assert(await form.getByRole('button',{name:'Guardando…'}).isDisabled());assert(await form.getByRole('button',{name:'Cancelar'}).isDisabled());
  await page.evaluate(()=>{window.__wait=false;window.__resolve();});await page.locator('[data-admin-affiliate-detail="a1"]').waitFor();
  assert((await page.locator('.aff-facts').textContent()).includes('6629999999'));
  const call=await page.evaluate(()=>__calls.filter(c=>c.name==='update_admin_affiliate').at(-1));
  assert.deepEqual(call.args.p_patch,{phone_raw:'6629999999'});assert.equal(call.args.p_affiliate_id,'a1');assert.equal(call.args.p_expected_updated_at,'2026-09-09T01:00:00Z');
  checks.push('Save reaches actual repository with minimal patch, version, target and reason; validation, conflict, duplicate, busy, retry, readback');
  await page.getByRole('button',{name:'Expediente',exact:true}).click();
  const actions=page.locator('.aff-document-actions'),grid=page.locator('.aff-document-grid');
  assert((await actions.boundingBox()).y<(await grid.boundingBox()).y);
  await page.locator('[data-affiliate-document-replace="d0"]').click();
  let modal=page.getByRole('dialog');assert.equal(await modal.locator('select').inputValue(),'t2');assert(await modal.locator('select').isDisabled());
  await modal.locator('input[type=file]').setInputFiles({name:'prueba.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nfixture only\n%%EOF')});await modal.locator('textarea').fill('Documento actualizado de prueba');await modal.getByRole('button',{name:'Crear versión',exact:true}).click();await modal.waitFor({state:'detached'});
  const upload=await page.evaluate(()=>__calls.find(c=>c.name==='register_admin_affiliate_document'));
  assert.equal(upload.args.p_affiliate_id,'a1');assert.equal(upload.args.p_document_type_id,'t2');assert.equal(upload.args.p_reason,'Documento actualizado de prueba');assert.match(upload.args.p_sha256,/^[A-F0-9]{64}$/);
  assert((await page.locator('.aff-document-grid').textContent()).includes('PENDING_REVIEW'));
  assert.equal(await page.evaluate(()=>__docs.filter(d=>d.status==='VERIFIED').length),10);
  await page.locator('[data-affiliate-upload-open]').click();modal=page.getByRole('dialog');await modal.locator('select').selectOption('t1');
  await modal.locator('input[type=file]').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('bad')});await modal.locator('textarea').fill('Prueba de archivo inválido');await modal.getByRole('button',{name:'Crear versión',exact:true}).click();assert((await modal.getByRole('alert').textContent()).includes('formatos'));assert.equal(await page.evaluate(()=>__calls.filter(c=>c.name==='storage.upload').length),1);
  await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  checks.push('Replacement selects exact document type; actual repository upload/hash/register; preserves verified history; invalid MIME never uploaded');
  await page.locator('[data-affiliate-row="a2"]').click();await page.locator('[data-admin-affiliate-detail="a2"]').waitFor();await page.getByRole('button',{name:'Expediente',exact:true}).click();assert((await page.locator('.aff-document-grid').textContent()).includes('Expediente vacío'));
  await page.locator('[data-affiliate-upload-open]').click();modal=page.getByRole('dialog');await modal.locator('input[type=file]').setInputFiles({name:'new.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nnew fixture\n%%EOF')});await modal.locator('textarea').fill('Carga de expediente vacío');await modal.getByRole('button',{name:'Cargar documento',exact:true}).click();await modal.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>__calls.filter(c=>c.name==='register_admin_affiliate_document').at(-1).args.p_affiliate_id),'a2');
  checks.push('Upload to empty second affiliate targets that affiliate and does not reuse first profile');
  await page.close();
  const guarded=await fixture();
  await guarded.getByRole('button',{name:'Expediente',exact:true}).click();
  await guarded.locator('.aff-document-card').first().click();await guarded.getByRole('button',{name:'Cerrar vista de documento'}).click();
  assert.equal(await guarded.evaluate(()=>__calls.find(c=>c.name==='preview').affiliate),'a1');
  await guarded.getByRole('button',{name:'Abrir Document Workbench'}).click();assert.equal(await guarded.evaluate(()=>__calls.find(c=>c.name==='navigate').args.affiliateId),'a1');
  await guarded.locator('[data-affiliate-document-replace="d0"]').click();
  const failed=guarded.getByRole('dialog');await failed.locator('input[type=file]').setInputFiles({name:'retry.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 retry')});await failed.locator('textarea').fill('Prueba de error y reintento');
  await guarded.evaluate(()=>window.__fail='ADMIN_DOCUMENT_WRITE_DENIED');await failed.getByRole('button',{name:'Crear versión',exact:true}).click();assert((await failed.getByRole('alert').textContent()).includes('permiso'));assert.equal(await failed.locator('input[type=file]').evaluate(e=>e.files.length),1);
  assert.equal(await guarded.evaluate(()=>__calls.filter(c=>c.name==='storage.remove').length),1);
  await failed.getByRole('button',{name:'Cancelar',exact:true}).click();
  await guarded.evaluate(()=>{window.__types=[];window.__fail='';});await guarded.locator('[data-affiliate-document-replace="d0"]').click();assert((await guarded.getByRole('dialog').getByRole('alert').textContent()).includes('no permite'));assert(await guarded.getByRole('dialog').locator('input[type=file]').isDisabled());await guarded.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  await guarded.evaluate(()=>{window.__writable=false;window.__render();});assert.equal(await guarded.locator('[data-affiliate-upload-open]').count(),0);assert.equal(await guarded.locator('[data-affiliate-document-replace]').count(),0);assert.equal(await guarded.getByRole('button',{name:'Editar información',exact:true}).count(),0);
  checks.push('Preview/navigation preserve affiliate context; upload denial keeps file/reason and cleans staged object; unavailable type and missing write permission fail closed');
  await guarded.close();
  for(const [width,height] of [[1440,900],[1100,849],[1024,768],[390,844],[390,600]]){
   const p=await fixture(width,height),before=await fixture(width,height,true);
   for(const current of [before,p])await current.getByRole('button',{name:'Editar información',exact:true}).click();
   const editor=p.locator('[data-affiliate-edit-form]');await editor.evaluate(e=>e.scrollIntoView({block:'start'}));
   const b=await editor.boundingBox(),button=await editor.getByRole('button',{name:'Guardar cambios auditados'}).boundingBox();
   assert(button.y>=b.y&&button.y+button.height<=b.y+b.height+1,'save outside editor '+width);assert(button.y+button.height<=height+1,'save below viewport '+width);
   assert(await editor.locator('fieldset').evaluate(e=>e.scrollHeight>e.clientHeight),'fields must scroll');
   const labels=await editor.locator('label>span').allTextContents(),prior=await before.locator('.aff-edit label>span').allTextContents();assert.deepEqual(labels.slice(0,27),prior.slice(0,27));
   await editor.locator('fieldset').evaluate(e=>e.scrollTop=e.scrollHeight);assert(await editor.locator('select').last().isVisible(),'category missing '+width);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow '+width);
   await p.screenshot({path:path.join(dir,`edit-${width}x${height}.png`)});
   checks.push(`Layout ${width}x${height}: all original fields, independent scroll, save visible, no horizontal overflow`);
   await p.close();await before.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'browser-result.json'),JSON.stringify({status:'PASS',checks,pageErrors:errors,productionTraffic:false},null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
