'use strict';
// Read-only production verification. Never confirms availability or creates a request.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/savings-individual-withdrawal'),env={};
for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
async function main(){
 const browserMode=process.argv.includes('--browser'),proof={status:'PASS',productionBusinessWrites:0};
 const login=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});assert(login.ok,'LOGIN_FAILED');const session=await login.json();
 const rpc=async token=>{const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/get_admin_savings_individual_withdrawal',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({p_folio:'12603'})});return{status:r.status,data:await r.json()};};
 const actual=await rpc(session.access_token);assert.equal(actual.status,200);assert.equal(actual.data.folio,'12603');assert(actual.data.ready);assert(actual.data.can_configure);assert(actual.data.can_create);const denied=await rpc();assert([401,403].includes(denied.status));
 Object.assign(proof,{authenticatedReader:true,exactFolio:true,accountReady:true,canConfigure:true,anonymousDenied:true});
 if(browserMode){
  const base='https://sutiapp.com/',html=await (await fetch(base+'?verify=individual-withdrawal')).text(),src=html.match(/src="(app\/bundle\.js\?v=\d+)"/)[1];
  const bundle=await (await fetch(new URL(src,base))).text(),digest=crypto.createHash('sha256').update(bundle.replace(/\r\n/g,'\n')).digest('hex');assert.equal(digest,JSON.parse(fs.readFileSync(path.join(out,'release-package.json'),'utf8')).normalizedBundleSha256);
  const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];let blockedWrites=0;
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/rest/v1/rpc/**',route=>{const name=new URL(route.request().url()).pathname.split('/').pop();if(/^(admin_set_savings|savings_runtime_submit|apply_savings)/.test(name)){blockedWrites++;return route.abort();}return route.continue();});
   await page.goto(base+'#/admin/menu',{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
   await page.locator('[data-admin-module=savings]').waitFor({timeout:60000});await page.locator('[data-admin-module=savings]').click();
   await page.getByRole('tab',{name:'Ahorradores',exact:true}).click();
   try{await page.getByPlaceholder('Buscar por nombre o folio',{exact:true}).fill('12603');}catch(e){await page.screenshot({path:path.join(root,'.tmp/savings-individual-withdrawal/live-navigation.png'),fullPage:true});console.error(JSON.stringify({pageErrors:errors,headings:await page.getByRole('heading').allTextContents()}));throw e;}
   const person=page.locator('.svp').getByText('DIAZ AVILEZ ARCE ALEJANDRO',{exact:true});await person.first().click();
   const card=page.locator('[data-individual-withdrawal="12603"]');await card.getByRole('button',{name:'Habilitar retiro',exact:true}).click({timeout:60000});
   assert(await card.getByLabel('Motivo',{exact:true}).isVisible());assert(await card.getByLabel(/Habilitado hasta/).isVisible());assert.equal(await card.locator('select').count(),0);
   await card.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(blockedWrites,0);assert.deepEqual(errors,[]);
   Object.assign(proof,{deployedBundleSha256:digest,realAccountNavigation:true,individualFormNoPeriod:true,cancelWithoutWrite:true,pageErrors:errors});
  }finally{await browser.close();}
 }
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,browserMode?'production.json':'installed-rpc.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
