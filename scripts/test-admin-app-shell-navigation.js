'use strict';
// Focused real-browser navigation check; no business writes or UI mocking.
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),env={};
for(const line of fs.readFileSync(process.env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0&&!line.trim().startsWith('#'))env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const target=process.argv[2]||'https://sutiapp.com/',out=path.join(root,'docs/qa/evidence/admin-app-shell-navigation-20260908');
const proof={status:'FAIL',target,checks:{},viewports:[],pageErrors:[],businessWrites:0,newPasswordLogins:0};
async function main(){
 let browser,page,started=false;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(30000);
  page.on('pageerror',e=>proof.pageErrors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/auth/v1/token?grant_type=password'))proof.newPasswordLogins++;if(/\/rpc\/(submit_|create_.*request|save_|update_|delete_|approve_|transition_program|mark_)/.test(r.url()))proof.businessWrites++;});
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated');
  async function identity(){return page.evaluate(async()=>{const a=AffiliateAuth.getState(),r=await SutiSupabase.getClient().rpc('get_effective_affiliate_id');if(r.error)throw Error('Identity RPC failed');const jwt=JSON.parse(atob(a.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),admin=AdminRepository.getState();return {actor:a.session.user.id,session:jwt.session_id,affiliate:a.affiliate?.id||null,effective:r.data,context:a.impersonation,permissions:JSON.stringify((admin.assignment?.permissions||[]).slice().sort()),fullAccess:admin.assignment?.fullAccess};});}
  const own=await identity();assert(own.affiliate,'Controlled administrator needs a valid own affiliate');assert(!own.context,'Do not replace a pre-existing impersonation');assert.equal(own.effective,own.affiliate);
  async function sameSession(effective,context){const next=await identity();assert.equal(next.actor,own.actor);assert.equal(next.session,own.session);assert.equal(next.permissions,own.permissions);assert.equal(next.fullAccess,own.fullAccess);assert.equal(next.affiliate,effective);assert.equal(next.effective,effective);assert.equal(next.context?.session_id||null,context||null);return next;}
  async function enterAdmin(){const banner=page.getByRole('button',{name:'Volver al Admin',exact:true});if(await banner.count())await banner.click();else await page.locator('[data-app-tab=admin]').click();await page.locator('[data-admin-view=menu]').waitFor();assert(await page.locator('[data-admin-view-app]').isVisible());}
  async function viewApp(){await page.locator('[data-admin-view-app]').click();await page.locator('[data-app-tab-scroll=home]').waitFor();assert.equal(await page.locator('[data-admin-view]').count(),0);assert.equal(await page.locator('[data-admin-desktop-shell]').count(),0);}
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   for(let cycle=0;cycle<3;cycle++){
    await enterAdmin();await sameSession(own.affiliate,null);await viewApp();await sameSession(own.affiliate,null);
    assert(await page.locator('[data-app-tab=admin]').isVisible());
    for(const tab of ['home','financiera','convenios','historial','credencial'])assert(await page.locator('[data-app-tab='+tab+']').isVisible());
   }
   proof.viewports.push({width,cycles:3,status:'PASS'});
  }
  proof.checks.adminToApp='PASS';proof.checks.appToAdmin='PASS';proof.checks.normalTabs='PASS';proof.checks.ownContext='PASS';
  await enterAdmin();
  const person=await page.evaluate(async()=>{const own=AffiliateAuth.getState().affiliate.id;const rows=await AdminRepository.searchAffiliates('00');const row=rows.find(r=>r.id!==own);if(!row)throw Error('Distinct real affiliate required');return {id:row.id,control:row.numero_control,label:row.display_name||row.full_name};});
  await page.locator('[data-admin-module=impersonation]').click();await page.locator('input[placeholder="Nombre, control o correo"]').fill(person.control);await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.locator('[data-admin-impersonation] button').filter({hasText:person.label}).first().click();await page.locator('textarea').fill('H-ADMIN-APP-SHELL-NAVIGATION-001: validación focal autorizada');
  await page.locator('[data-admin-impersonation]').getByRole('button',{name:'Tomar control',exact:true}).click();await page.locator('[data-impersonation-active]').waitFor();started=true;await page.locator('[data-app-tab-scroll=home]').waitFor();
  const active=await identity();assert(active.context);await sameSession(person.id,active.context.session_id);
  for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await enterAdmin();await sameSession(person.id,active.context.session_id);await viewApp();await sameSession(person.id,active.context.session_id);assert(await page.getByRole('button',{name:'Volver al Admin',exact:true}).isVisible());}
  proof.checks.impersonatedContext='PASS';proof.checks.returnAdminKeepsImpersonation='PASS';
  await page.getByRole('button',{name:'Salir de tomar control',exact:true}).click();await page.locator('[data-admin-view=menu]').waitFor();await sameSession(own.affiliate,null);assert.equal(await page.locator('[data-impersonation-active]').count(),0);started=false;proof.checks.exitRestoresActor='PASS';
  await viewApp();await sameSession(own.affiliate,null);assert(await page.locator('[data-app-tab=admin]').isVisible());
  assert.equal(proof.newPasswordLogins,1);proof.checks.sessionPreserved='PASS';assert.equal(proof.businessWrites,0);assert.deepEqual(proof.pageErrors,[]);proof.status='PASS';
 }finally{
  if(started&&page)await page.evaluate(()=>AdminRepository.stopImpersonation()).catch(()=>{});
  if(browser)await browser.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'production.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
