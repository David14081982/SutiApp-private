'use strict';
// Normal configured administrator login; reads only. No JWT claim impersonation.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/savings-admin-ux-20261001'),env={};
for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const hash=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
async function main(){
 const mode=process.argv[2]||'rpc';assert(['rpc','local','production'].includes(mode));
 const login=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});assert(login.ok,'LOGIN_FAILED');const session=await login.json();
 const headers={apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',Authorization:'Bearer '+session.access_token};
 const timings={};const rpc=async(name,args={})=>{const start=Date.now(),r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args)});const data=await r.json();assert.equal(r.status,200,name+': '+JSON.stringify(data).slice(0,180));timings[name]=Date.now()-start;return data;};
 try{
  const summary=await rpc('get_admin_savings_workspace_summary'),people=await rpc('get_admin_savings_workspace_people');
  assert.equal(people.rows.length,20);assert(people.total>=people.rows.length);assert.equal(summary.today,people.today);
  const matches=await rpc('get_admin_savings_workspace_people',{p_search:'ACOSTA CAMPOS LEONEL'});assert.equal(matches.total,1);
  const row=matches.rows[0],person=await rpc('get_admin_savings_workspace_person',{p_participant_id:row.participant_id});
  assert.equal(person.person.folio,row.folio);assert.equal(person.balance.total,row.saldo);assert.equal(person.last_received,row.ultimo);assert.equal(person.next_expected.date,row.prox);
  assert(person.history.every(x=>x.date<=person.today));assert(person.history.filter(x=>x.status==='PENDING').every(x=>x.amount===null));
  const nativePending=await rpc('get_admin_savings_workspace_people',{p_filter:'revision'});
  assert(nativePending.rows.filter(x=>x.enrollment_id===null).every(x=>x.balance===null));
  for(const name of ['get_admin_savings_workspace_summary','get_admin_savings_workspace_people','get_admin_savings_workspace_person']){
   const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(name.endsWith('_person')?{p_participant_id:row.participant_id}:{})});assert([401,403].includes(r.status),'anonymous denied '+name);
  }
  const proof={status:'PASS',mode,productionBusinessWrites:0,normalAuthenticatedLogin:true,anonymousDenied:true,peopleTotal:people.total,initialRows:people.rows.length,pendingReceipts:summary.attention.pending_receipts,pendingPeriods:summary.attention.periods,exactIdentity:true,listDetailBalanceAgreement:true,noFutureReceipt:true,noInventedPendingAmount:true,timingsMs:timings};
  if(mode!=='rpc'){
   const base='https://sutiapp.com/',html=await(await fetch(base+'?savings-ux-verification='+Date.now())).text(),src=html.match(/src="(app\/bundle\.js\?v=\d+)"/)[1];
   const local=fs.readFileSync(path.join(root,'.tmp/savings-admin-ux-20261001/release/app/bundle.js'),'utf8');
   const compiled=mode==='local'?local:await(await fetch(new URL(src,base))).text();assert.equal(hash(compiled),hash(local),'Deployed bundle mismatch');
   const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
   let page;
   try{
    page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});const errors=[],calls=[];let blockedWrites=0;
    page.on('pageerror',e=>errors.push(e.message));
    if(mode==='local')await page.route('**/app/bundle.js*',r=>r.fulfill({status:200,contentType:'text/javascript',body:compiled}));
    await page.route('**/rest/v1/rpc/**',route=>{const name=new URL(route.request().url()).pathname.split('/').pop();if(name.includes('savings')){calls.push(name);if(!/^(get_|preview_)/.test(name)){blockedWrites++;return route.abort();}}return route.continue();});
    await page.goto(base+'#/admin/menu',{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
    await page.locator('[data-admin-module=savings]').click({timeout:60000});await page.getByText('Panorama del ahorro',{exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('.svp')?.textContent.includes('Consultando Supabase'));
    const initialCalls=calls.slice();assert(!initialCalls.includes('get_admin_savings_workspace_people'));assert(!initialCalls.includes('get_admin_savings_workspace_person'));
    await page.getByRole('tab',{name:'Personas',exact:true}).click();await page.getByRole('textbox',{name:'Buscar por nombre o folio'}).fill(row.folio);
    await page.locator('.svp-person').filter({hasText:row.nombre}).click({timeout:60000});
    await page.locator('.svp-inline-detail').getByText('Historial de aportaciones',{exact:true}).waitFor({timeout:60000});
    assert.equal(await page.locator('.svp-inline-detail').count(),1);assert(await page.getByRole('textbox',{name:'Buscar por nombre o folio'}).isVisible());
    const detailCalls=calls.filter(x=>x==='get_admin_savings_workspace_person').length;assert.equal(detailCalls,1);
    await page.locator('.svp-person').filter({hasText:row.nombre}).click();await page.locator('.svp-person').filter({hasText:row.nombre}).click();await page.locator('.svp-inline-detail').getByText('Historial de aportaciones',{exact:true}).waitFor();assert.equal(calls.filter(x=>x==='get_admin_savings_workspace_person').length,1);
    for(const width of [320,430,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+width);}
    await page.getByRole('tab',{name:'Programa',exact:true}).click();await page.getByRole('combobox',{name:'Operación del programa'}).waitFor();
    assert.equal(blockedWrites,0);assert.deepEqual(errors,[]);Object.assign(proof,{bundleHash:hash(compiled),publicUrl:base,initialSavingsCalls:initialCalls,personRequests:detailCalls,inlineListPreserved:true,shortCacheReopen:true,responsive:[320,430,1440],pageErrors:errors,serviceWorker:'blocked for controlled fresh runtime'});
   }finally{if(page)await page.evaluate(async()=>{await window.SutiSupabase?.getClient().auth.signOut({scope:'local'});}).catch(()=>{});await browser.close();}
  }
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }finally{await fetch(env.SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
