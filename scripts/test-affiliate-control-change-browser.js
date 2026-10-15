'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),dir=path.join(root,'docs/qa/evidence/affiliate-control-change');
async function main(){
 fs.mkdirSync(dir,{recursive:true});const checks=[],errors=[];
 const server=http.createServer((req,res)=>res.end('<!doctype html><html><meta charset="utf-8"><body><div id="fixture"></div></body></html>'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  async function fixture(width=1440,before=false){
   const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.addStyleTag({content:':root{--surface:#fff;--surface-2:#edf0f5;--hairline:#e1e5ed;--ink:#172033;--ink-3:#657086;--guinda:#901040;--guinda-50:#fff1f6;--grad-guinda-soft:#a80038;--font:Arial;--mono:monospace}*{box-sizing:border-box}body{font-family:Arial;background:#f3f5f9;margin:0}header{padding:20px}button,input,textarea,select{font-family:inherit}'});
   for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
   await page.evaluate(()=>{
    window.Icon=()=>null;window.confirm=()=>true;window.__calls=[];window.__error='';window.__readonly=false;window.__block=false;window.__changes=[];
    window.__profiles=[{id:'a1',numero_control:'00007',full_name:'Afiliado sintético',updated_at:'2026-10-14T00:00:00Z',affiliate_status_raw:'Activo'}, {id:'a2',numero_control:'00008',full_name:'Otra persona sintética',updated_at:'2026-10-14T00:00:00Z',affiliate_status_raw:'Activo'}];
    window.__detail=id=>({profile:__profiles.find(p=>p.id===id),capabilities:{},documents:[],requests:[],audit:[],options:{union:[],employment_category:[]}});
    window.AdminRepository={has:p=>!__readonly||!p.endsWith('.write'),getState:()=>({phase:'authorized'}),subscribe:()=>()=>{}};
    window.SutiSupabase={getClient:()=>({rpc:async(name,args)=>{
     __calls.push({name,args});
     if(name==='list_admin_affiliates')return{data:{items:__profiles,total:2,page:1,page_size:25,filter_options:{statuses:['Activo'],unions:[],categories:[]}}};
     if(name==='get_admin_affiliate_workbench')return{data:__detail(args.p_affiliate_id)};
     if(name==='list_admin_affiliate_control_changes')return{data:__changes.filter(c=>c.affiliate_id===args.p_affiliate_id)};
     if(name==='preview_admin_affiliate_control'){
      if(__error==='preview')return{error:{message:'SOURCE_UNAVAILABLE'}};
      const profile=__profiles.find(p=>p.id===args.p_affiliate_id);
      window.__report={affiliate_id:profile.id,old_control:profile.numero_control,new_control:args.p_new_control,expected_updated_at:profile.updated_at,fingerprint:'real-server-fixture-hash',tables_checked:12,blockers:__block?['NUMBER_ALREADY_ASSIGNED']:[],groups:[{source:'public.program_requests',count:1,records:[{key:{id:'request-1'},number_match:true,related:true}]}],excluded:['Google Sheets / Apps Script','Archivos y documentos emitidos','Valores dentro de JSON o texto libre','Relaciones sin FK, FK compuestas o de más de cuatro pasos']};return{data:__report};
     }
     if(name==='change_admin_affiliate_control'){
      if(__error&&__error!=='network-after-commit')return{error:{message:__error}};
      let change=__changes.find(c=>c.client_action_id===args.p_client_action_id);
      if(!change){change={id:'event-1',affiliate_id:args.p_affiliate_id,old_control:__report.old_control,new_control:args.p_new_control,actor_auth_user_id:'admin-fixture',created_at:'2026-10-14T01:00:00Z',reason:args.p_reason,impact:__report,client_action_id:args.p_client_action_id};__changes.push(change);Object.assign(__profiles.find(p=>p.id===args.p_affiliate_id),{numero_control:args.p_new_control,updated_at:'2026-10-14T01:00:00Z'});}
      if(__error==='network-after-commit'){__error='';throw Error('NETWORK_FAILURE');}return{data:{change}};
     }
     throw Error('UNEXPECTED_RPC '+name);
    }})};
   });
   await page.addScriptTag({content:read('app/admin-affiliates-repository.js')});
   await page.addScriptTag({content:read(before?'.tmp/affiliate-control-change/before/app/screens-admin-affiliates.jsx':'app/screens-admin-affiliates.jsx')});
   await page.evaluate(()=>{window.__root=ReactDOM.createRoot(document.getElementById('fixture'));window.__render=()=>__root.render(React.createElement(AffiliatesAdminModule,{app:{admin:AdminRepository,toast:()=>{}},header:()=>React.createElement('header',null,'Afiliados'),onOpenModule:()=>{}}));__render();});
   await page.locator('[data-admin-affiliate-detail="a1"]').waitFor();return page;
  }
  async function start(page,number='00009'){await page.getByRole('button',{name:'Cambiar número de control',exact:true}).click();const modal=page.getByRole('dialog');await modal.getByLabel('Nuevo número de control',{exact:true}).fill(number);await modal.getByRole('button',{name:'Revisar registros afectados'}).click();await modal.locator('.aff-modal-body > [data-control-impact]').waitFor();return modal;}
  const page=await fixture(),prior=await fixture(1440,true);
  assert.deepEqual(await page.locator('.aff-tabs button').allTextContents(),await prior.locator('.aff-tabs button').allTextContents());
  const existing=await prior.locator('[data-affiliate-actions] button').allTextContents(),current=await page.locator('[data-affiliate-actions] button').allTextContents();for(const label of existing)assert(current.includes(label));await prior.close();checks.push('Original sections, tabs and existing administrative controls preserved');
  let modal=await start(page);assert(await modal.getByRole('button',{name:'Confirmar cambio de número'}).isDisabled());
  await modal.locator('details').first().locator('summary').click();assert((await modal.textContent()).includes('request-1'));assert((await modal.textContent()).includes('Google Sheets'));
  await modal.getByLabel('Nuevo número de control',{exact:true}).fill('00010');assert.equal(await modal.locator('.aff-modal-body > [data-control-impact]').count(),0);assert(await modal.getByRole('button',{name:'Confirmar cambio de número'}).isDisabled());
  await modal.getByRole('button',{name:'Revisar registros afectados'}).click();await modal.getByRole('checkbox').check();
  await page.evaluate(()=>__error='network-after-commit');await modal.getByRole('button',{name:'Confirmar cambio de número'}).click();await modal.getByRole('alert').waitFor();
  assert(await modal.getByLabel('Nuevo número de control',{exact:true}).isDisabled());await modal.getByRole('button',{name:'Reintentar confirmación'}).click();await modal.getByText('Cambio guardado y auditado.',{exact:true}).waitFor();
  const calls=await page.evaluate(()=>__calls.filter(c=>c.name==='change_admin_affiliate_control'));assert.equal(calls.length,2);assert.equal(calls[0].args.p_client_action_id,calls[1].args.p_client_action_id);assert.equal(calls[0].args.p_new_control,'00010');assert.equal(calls[0].args.p_affiliate_id,'a1');
  const downloadPromise=page.waitForEvent('download');await modal.getByRole('button',{name:'Descargar informe',exact:true}).click();const download=await downloadPromise;assert(download.suggestedFilename().endsWith('.txt'));
  await modal.getByRole('button',{name:'Cerrar y recargar'}).click();await page.locator('[data-admin-affiliate-detail="a1"]').waitFor();assert((await page.locator('.aff-profile-identity').textContent()).includes('00010'));
  await page.getByRole('button',{name:'Cambiar número de control',exact:true}).click();modal=page.getByRole('dialog');await modal.locator('[data-control-history]>summary').click();await modal.getByText('00007 → 00010',{exact:false}).first().waitFor();await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  checks.push('Review invalidates on input change; explicit acknowledgement; idempotent retry after committed/network failure; refresh, durable history and download');
  await page.evaluate(()=>__block=true);modal=await start(page,'00008');assert(await modal.getByRole('button',{name:'Confirmar cambio de número'}).isDisabled());assert((await modal.textContent()).includes('reservado por otro afiliado'));await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.evaluate(()=>{__block=false;__error='AFFILIATE_CONTROL_IMPACT_CHANGED';});modal=await start(page,'00011');await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'Confirmar cambio de número'}).click();await modal.getByRole('alert').waitFor();assert.equal(await modal.locator('.aff-modal-body > [data-control-impact]').count(),0);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.evaluate(()=>{__error='preview';});await page.getByRole('button',{name:'Cambiar número de control',exact:true}).click();modal=page.getByRole('dialog');await modal.getByLabel('Nuevo número de control',{exact:true}).fill('00012');await modal.getByRole('button',{name:'Revisar registros afectados'}).click();await modal.getByRole('alert').waitFor();assert(await modal.getByRole('button',{name:'Confirmar cambio de número'}).isDisabled());await modal.getByRole('button',{name:'Cancelar',exact:true}).click();checks.push('Collision, stale impact and source failure cannot be confirmed');
  await page.evaluate(()=>{__readonly=true;__render();});await page.waitForFunction(()=>!document.querySelector('[data-control-change-open]'));
  assert.equal(await page.evaluate(async()=>{try{await AdminAffiliatesRepository.previewControl('a1','X');return false;}catch(e){return e.message==='ADMIN_DENIED';}}),true);checks.push('Read-only account has no action and repository refuses mutation/preview');await page.close();
  for(const width of [390,1024,1440]){const p=await fixture(width),m=await start(p);await m.getByRole('checkbox').check();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const b=await m.boundingBox(),footer=await m.locator('footer').boundingBox();assert(b.y>=0&&b.y+b.height<=901);assert(footer.y+footer.height<=901);await p.screenshot({path:path.join(dir,'control-'+width+'.png')});await p.close();checks.push('Responsive modal '+width+': scrolling body and visible confirmation, no overflow');}
  assert.deepEqual(errors,[]);const result={status:'PASS',checks,pageErrors:errors,productionTraffic:false};fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
