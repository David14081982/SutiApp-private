'use strict';
// Isolated UI -> real repository -> local PostgreSQL functions. No live Auth/API.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
module.exports=async function({query,scalar,auth,superuser,ids}){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 const out=path.join(root,'docs/qa/evidence/admin-revocation-20260924'),errors=[],requests=[];
 let queue=Promise.resolve();
 const sql={
  list_admin_assignments:()=>['select * from list_admin_assignments()',[],true],
  list_admin_module_catalog:()=>['select list_admin_module_catalog() value',[]],
  get_admin_access_context:()=>['select get_admin_access_context() value',[]],
  set_total_admin_by_email:p=>['select set_total_admin_by_email($1) value',[p.p_email]],
  revoke_admin_assignment:p=>['select revoke_admin_assignment($1) value',[p.p_auth_user_id]],
 };
 async function pageFor(who){
  const page=await browser.newPage({viewport:{width:1100,height:850},serviceWorkers:'block'});
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
  await page.exposeFunction('__rpc',async(name,p={})=>{
   const task=queue.then(async()=>{await auth(who,'browser-session-'+who);if(!sql[name])throw Error('UNEXPECTED_TEST_RPC '+name);const [text,args,many]=sql[name](p);try{const data=many?await query(text,args):await scalar(text,args);requests.push({who,name,status:'success'});return {data,error:null};}catch(e){requests.push({who,name,status:'denied',code:e.code});return {data:null,error:{message:e.message,code:e.code}};}});
   queue=task.catch(()=>{});return task;
  });
  const styles=[...read('SutiApp.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
  await page.setContent('<!doctype html><html><head><style>'+styles+'</style></head><body><main id="root"></main></body></html>');
  for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/ui.jsx'])await page.addScriptTag({content:read(file)});
  await page.addScriptTag({content:'window.SutiSupabase={getClient:()=>({rpc:(name,p)=>window.__rpc(name,p)})};'});
  for(const file of ['app/admin-cutover-repository.js','app/screens-admin-access.jsx'])await page.addScriptTag({content:read(file)});
  await page.evaluate(()=>{const h=React.createElement;ReactDOM.createRoot(document.getElementById('root')).render(h(window.AdministratorsModule,{app:{admin:{has:()=>true}},onBack:()=>{},header:({title,sub})=>h('header',null,h('h1',null,title),h('p',null,sub))}));});
  await page.waitForSelector('[data-admin-assignment]');return page;
 }
 try{
  const owner=await pageFor('owner');
  const protectedCard=owner.locator('[data-admin-assignment]').filter({hasText:'owner@example.invalid'});
  assert.equal(await protectedCard.getByRole('button',{name:'Revocar',exact:true}).count(),0);
  await owner.getByRole('textbox',{name:'Correo del nuevo administrador',exact:true}).fill('total@example.invalid');
  await owner.getByRole('button',{name:'Agregar',exact:true}).click();await owner.getByText('Administrador agregado con acceso total.',{exact:true}).waitFor();
  const total=await pageFor('total');
  const card=owner.locator('[data-admin-assignment]').filter({hasText:'total@example.invalid'});
  await card.getByRole('button',{name:'Revocar',exact:true}).click();await owner.getByText('Acceso administrativo revocado.',{exact:true}).waitFor();
  await owner.waitForFunction(()=>[...document.querySelectorAll('[data-admin-assignment="revoked"]')].some(e=>e.textContent.includes('total@example.invalid')));
  assert.equal(await card.getByRole('button',{name:'Revocar',exact:true}).count(),0);
  assert.equal(await card.getByRole('button',{name:'Pantallas',exact:true}).count(),1);
  // Keep the subject's old page and cached canWrite=true. Backend must still deny.
  await total.getByRole('textbox',{name:'Correo del nuevo administrador',exact:true}).fill('normal@example.invalid');
  await total.getByRole('button',{name:'Agregar',exact:true}).click();await total.getByRole('alert').filter({hasText:'No fue posible agregar al administrador.'}).waitFor();
  const context=await total.evaluate(()=>window.__rpc('get_admin_access_context'));
  assert.equal(context.data.full_access,false);assert.equal(context.data.technical_permissions.length,0);assert.equal(context.data.section_actions.length,0);
  await superuser();assert.equal(await scalar('select count(*)::int value from admin_assignments where auth_user_id=$1',[ids.normal]),0);
  await owner.screenshot({path:path.join(out,'administrators-desktop.png'),fullPage:true});
  await owner.setViewportSize({width:430,height:932});await owner.screenshot({path:path.join(out,'administrators-mobile.png'),fullPage:true});
  assert.equal(await owner.locator('[data-admin-assignment]').count(),4);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:'PASS',productionWrites:0,network:'all browser network blocked',source:'actual screen, UI primitives and repository',database:'actual installed SQL functions plus candidate, synthetic PostgreSQL fixtures',checks:['protected owner has no revoke button','actual Add and Revoke controls work','revoked row and Pantallas retained','already-open stale admin page cannot add an administrator','same session receives empty admin capabilities','desktop/mobile structure preserved'],requests,pageErrors:errors},null,2));
 }finally{await browser.close();}
};
