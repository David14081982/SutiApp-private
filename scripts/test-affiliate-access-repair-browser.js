'use strict';
// H-AFFILIATE-ACCESS-REPAIR-001 — actual screen + repository in Chrome with isolated backend
// fixtures shaped like the real rolled-back diagnosis (fictitious people). No production traffic.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dir=path.join(root,'docs/qa/evidence/affiliate-access-repair-20260926');
async function main(){
 fs.mkdirSync(dir,{recursive:true});const errors=[],checks=[];
 const server=http.createServer((req,res)=>res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="fixture"></div></body></html>'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  async function fixture(width,height,writable){
   const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.addStyleTag({content:':root{--surface:#fff;--surface-2:#edf0f5;--hairline:#e1e5ed;--ink:#172033;--ink-2:#364154;--ink-3:#657086;--guinda:#901040;--guinda-50:#fff1f6;--grad-guinda-soft:#a80038;--font:Arial;--mono:monospace}*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#f3f5f9}.su-app-scroll{height:100vh;overflow:auto}'});
   for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
   await page.evaluate((writable)=>{
    window.Icon=({size})=>React.createElement('svg',{width:size||16,height:size||16,'aria-hidden':'true'});window.__calls=[];window.__fail='';
    window.__profiles=[
     {id:'caso',numero_control:'QA-100',full_name:'PERSONA DE PRUEBA A',display_name:'PERSONA A',historical_email_raw:'persona.a@example.com',updated_at:'2026-09-05T03:52:51Z',affiliate_status_raw:'Activo',auth_linked:false,auth_eligibility:'duplicate_email'},
     {id:'fila-erronea',numero_control:'QA-200',full_name:'PERSONA DE PRUEBA B',display_name:'PERSONA B',historical_email_raw:null,updated_at:'2026-09-22T23:37:26Z',affiliate_status_raw:'Activo',auth_linked:true,auth_eligibility:'eligible'}];
    window.__repaired=false;
    window.__diag=(id)=>{
     if(id==='caso')return __repaired
      ?{affiliate_id:'caso',updated_at:'2026-09-26T18:00:00Z',state:'ACTIVE',email:'persona.a@example.com',activation_status:'ALREADY_ACTIVATED',issues:[],siblings:[],linked_account:{email:'persona.a@example.com',confirmed:true,last_sign_in_at:'2026-09-23T00:16:17Z',matches_email:true,certified:false},email_account:{confirmed:true,holder:{id:'caso',numero_control:'QA-100',name:'PERSONA A',is_self:true}},actions:{relink:false,release:false,recalculate:false}}
      :{affiliate_id:'caso',updated_at:'2026-09-05T03:52:51Z',state:'BLOCKED',email:'persona.a@example.com',activation_status:'NOT_ELIGIBLE',issues:['STALE_BLOCK','ACCOUNT_ON_OTHER_AFFILIATE'],siblings:[],linked_account:null,email_account:{confirmed:true,last_sign_in_at:'2026-09-23T00:16:17Z',holder:{id:'fila-erronea',numero_control:'QA-200',name:'PERSONA B',is_self:false,certified:false}},actions:{relink:true,release:false,recalculate:true}};
     return {affiliate_id:id,updated_at:'2026-09-22T23:37:26Z',state:'BLOCKED',email:null,activation_status:null,issues:['LINK_EMAIL_MISMATCH'],siblings:[],linked_account:{email:'persona.a@example.com',confirmed:true,last_sign_in_at:'2026-09-23T00:16:17Z',matches_email:false,certified:false},email_account:null,actions:{relink:false,release:true,recalculate:false}};
    };
    window.__detail=id=>({profile:__profiles.find(p=>p.id===id),capabilities:{documents:false,requests:false},documents:[],requests:[],audit:[],options:{union:[],employment_category:[]}});
    window.AdminRepository={has:p=>!p.endsWith('.write')||writable,getState:()=>({phase:'authorized'}),subscribe:()=>()=>{},startImpersonation:async()=>{}};
    window.AffiliateAuth={getState:()=>({phase:'authenticated',session:{user:{id:'admin-fixture'}}}),subscribe:()=>()=>{}};
    window.__client={
     rpc:async(name,args)=>{__calls.push({name,args});
      if(name==='list_admin_affiliates')return{data:{items:__profiles,total:2,page:1,page_size:25,filter_options:{statuses:['Activo'],unions:[],categories:[]}}};
      if(name==='get_admin_affiliate_workbench')return{data:__detail(args.p_affiliate_id)};
      if(name==='get_admin_affiliate_access_diagnosis')return{data:__diag(args.p_affiliate_id)};
      if(name==='list_admin_affiliate_access_issues')return{data:[
       {id:'caso',numero_control:'QA-100',name:'PERSONA A',email:'persona.a@example.com',linked:false,issues:['ACCOUNT_ON_OTHER_AFFILIATE','STALE_BLOCK']},
       {id:'fila-erronea',numero_control:'QA-200',name:'PERSONA B',email:null,linked:true,issues:['LINK_EMAIL_MISMATCH']}]};
      if(name==='admin_relink_affiliate_account'){
       if(__fail)return{error:{message:__fail}};
       __repaired=true;const p=__profiles.find(p=>p.id===args.p_affiliate_id);Object.assign(p,{auth_linked:true,auth_eligibility:'eligible',updated_at:'2026-09-26T18:00:00Z'});return{data:__detail(p.id)};
      }
      if(name==='update_admin_affiliate'){const p=__profiles.find(p=>p.id===args.p_affiliate_id);Object.assign(p,args.p_patch,{updated_at:'2026-09-26T19:00:00Z'});return{data:__detail(p.id)};}
      throw Error('UNEXPECTED_RPC '+name);
     }};
    window.SutiSupabase={getClient:()=>__client};
   },writable);
   await page.addScriptTag({content:read('app/admin-affiliates-repository.js')});
   await page.addScriptTag({content:read('app/screens-admin-affiliates.jsx')});
   await page.evaluate(()=>{
    window.__root=ReactDOM.createRoot(document.getElementById('fixture'));
    __root.render(React.createElement(AffiliatesAdminModule,{app:{admin:AdminRepository,toast:(m)=>__calls.push({name:'toast',m})},header:()=>React.createElement('header',null,'Afiliados'),onOpenModule:()=>{}}));
   });
   await page.locator('[data-affiliate-row="caso"]').waitFor();return page;
  }
  const calls=(page,name)=>page.evaluate((n)=>__calls.filter(c=>c.name===n),name);
  const hScroll=(page)=>page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);

  // 1. Worklist → opens the affiliate directly on the Acceso tab
  let page=await fixture(1440,900,true);
  await page.locator('[data-access-issues-open]').click();
  await page.locator('[data-access-issue-row="caso"]').waitFor();
  assert.match(await page.locator('.aff-access-list').innerText(),/2 afiliado\(s\)[\s\S]*Cuenta en otra ficha[\s\S]*Bloqueo sin motivo[\s\S]*Cuenta ajena unida/);
  await page.screenshot({path:path.join(dir,'issues-1440x900.png')});
  await page.locator('[data-access-issue-row="caso"]').click();
  await page.locator('[data-affiliate-access-repair="BLOCKED"]').waitFor();
  checks.push('lista de problemas abre la ficha en la pestaña Acceso');

  // 2. Diagnosis in plain language
  const panel=await page.locator('[data-affiliate-access-repair]').innerText();
  assert.match(panel,/No puede entrar a la app/);
  assert.match(panel,/Este correo no está habilitado para activar una cuenta/);
  assert.match(panel,/Está bloqueado por un correo duplicado que ya no existe/);
  assert.match(panel,/unida a la ficha del control QA-200 \(PERSONA B\)/);
  assert.equal(await page.locator('[data-access-action="relink"]').innerText(),'Pasar la cuenta a este afiliado');
  assert.equal(await page.locator('[data-access-action="recalculate"]').count(),0,'relink already lifts the block');
  await page.screenshot({path:path.join(dir,'access-blocked-1440x900.png')});
  checks.push('diagnóstico explica el caso y ofrece solo la acción correcta');

  // 3. Backend error is shown inside the confirmation, nothing changes
  await page.evaluate(()=>{__fail='AFFILIATE_VERSION_CONFLICT';});
  await page.locator('[data-access-action="relink"]').click();
  assert.match(await page.locator('[data-admin-affiliate-modal]').innerText(),/se separará del control QA-200 \(PERSONA B\)[\s\S]*misma contraseña/);
  await page.locator('[data-access-confirm="relink"]').click();
  await page.getByText('La ficha cambió mientras la revisabas').waitFor();
  checks.push('error del backend se muestra en español sin cerrar la confirmación');

  // 4. Repair: exact RPC contract, then the panel re-diagnoses as ACTIVE
  await page.evaluate(()=>{__fail='';});
  await page.locator('[data-admin-affiliate-modal] textarea').fill('El correo estaba en la ficha equivocada');
  await page.locator('[data-access-confirm="relink"]').click();
  await page.locator('[data-affiliate-access-repair="ACTIVE"]').waitFor();
  const relink=(await calls(page,'admin_relink_affiliate_account')).pop();
  assert.deepEqual(relink.args,{p_affiliate_id:'caso',p_expected_updated_at:'2026-09-05T03:52:51Z',p_reason:'El correo estaba en la ficha equivocada'});
  assert.match(await page.locator('[data-affiliate-access-repair]').innerText(),/Entra correctamente[\s\S]*«Entrar» y su contraseña/);
  assert.equal(await page.locator('[data-admin-affiliate-modal]').count(),0);
  await page.screenshot({path:path.join(dir,'access-repaired-1440x900.png')});
  checks.push('reparación envía id, versión y motivo exactos y el diagnóstico queda en ACTIVE');

  // 5. Holder link opens the wrong record, which offers "Separar"
  await page.close();page=await fixture(1440,900,true);
  await page.locator('[data-affiliate-row="caso"]').click();
  await page.getByRole('button',{name:'Acceso',exact:true}).click();
  await page.locator('[data-affiliate-access-repair="BLOCKED"]').waitFor();
  await page.locator('.aff-access-links button').click();
  await page.locator('[data-admin-affiliate-detail="fila-erronea"]').waitFor();
  await page.locator('[data-access-action="release"]').waitFor();
  assert.match(await page.locator('[data-affiliate-access-repair]').innerText(),/tiene unida la cuenta persona\.a@example\.com, que no corresponde/);
  checks.push('enlace a la ficha donde está la cuenta y opción de separarla');

  // 6. Edit form warns before breaking a linked account; silent otherwise
  await page.getByRole('button',{name:'Editar información',exact:true}).click();
  const email=page.locator('[data-affiliate-edit-form] label',{hasText:'Correo de contacto'}).locator('input');
  assert.equal(await page.locator('[data-affiliate-email-warning]').count(),0);
  await email.fill('otro@example.com');
  await page.locator('[data-affiliate-email-warning]').waitFor();
  await email.fill('');
  assert.equal(await page.locator('[data-affiliate-email-warning]').count(),0);
  checks.push('aviso al cambiar el correo de una ficha con cuenta unida');

  // 7. Read-only admin: diagnosis visible, no repair buttons
  await page.close();page=await fixture(1440,900,false);
  await page.locator('[data-affiliate-row="caso"]').click();
  await page.getByRole('button',{name:'Acceso',exact:true}).click();
  await page.locator('[data-affiliate-access-repair="BLOCKED"]').waitFor();
  assert.equal(await page.locator('[data-access-action]').count(),0);
  checks.push('sin affiliates.write: diagnóstico sí, botones no');

  // 8. Phone widths: no horizontal scroll in the panel or the worklist
  for(const [w,hgt] of [[390,844],[1024,768]]){
   await page.close();page=await fixture(w,hgt,true);
   await page.locator('[data-access-issues-open]').click();
   await page.locator('[data-access-issue-row="caso"]').waitFor();
   assert.equal(await hScroll(page),false,'worklist overflow '+w);
   await page.screenshot({path:path.join(dir,`issues-${w}x${hgt}.png`)});
   await page.locator('[data-access-issue-row="caso"]').click();
   await page.locator('[data-affiliate-access-repair="BLOCKED"]').waitFor();
   await page.locator('[data-affiliate-access-repair]').scrollIntoViewIfNeeded();
   assert.equal(await hScroll(page),false,'panel overflow '+w);
   await page.screenshot({path:path.join(dir,`access-blocked-${w}x${hgt}.png`)});
  }
  checks.push('390 y 1024 px sin scroll horizontal');
  assert.deepEqual(errors,[]);
  const result={status:'PASS',checks,pageErrors:0,productionTraffic:false};
  fs.writeFileSync(path.join(dir,'browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,1));
 }finally{await browser.close();server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
