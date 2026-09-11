'use strict';
// Focal build and read-only acceptance. Reports contain no bank values or credentials.
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),assert=require('assert').strict,crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/credential-bank-isolation-20260911');
const baseline=path.join(os.tmpdir(),'sutiapp-credential-bank-20260911');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function receipt(name,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
function env(){const e={};for(const raw of read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=raw.match(/^([A-Z0-9_]+)=(.*)$/);if(m)e[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return e;}
function chunk(bundle,name){const start=bundle.indexOf('/* @@file '+name+' */'),end=bundle.indexOf('/* @@file ',start+10);assert(start>=0&&end>start,'module boundaries');return {start,end,text:bundle.slice(start,end)};}
function build(){
  const bundle=read('app/bundle.js'),source=read('app/screens-credencial.jsx').replace(/\r\n/g,'\n').trimEnd();
  const c=chunk(bundle,'screens-credencial.jsx'),replacement='/* @@file screens-credencial.jsx */\n(function(){\n'+source+'\n})();\n';
  const result=bundle.slice(0,c.start)+replacement+bundle.slice(c.end);new vm.Script(result);
  const html=read('SutiApp.html'),worker=read('sw.js');
  const version=Math.max(...[html,worker].map(s=>Number(s.match(/app\/bundle\.js\?v=(\d+)/)[1])))+1;
  const cache=Math.max(Number(worker.match(/sutiapp-v(\d+)/)[1]),Number(html.match(/sw\.js\?v=(\d+)/)[1]))+1;
  const nextHtml=html.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+version).replace(/sw\.js\?v=\d+/g,'sw.js?v='+cache);
  const nextWorker=worker.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+version).replace(/sutiapp-v\d+/,'sutiapp-v'+cache);
  const normalize=s=>s.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=VERSION').replace(/sutiapp-v\d+/g,'sutiapp-vVERSION').replace(/sw\.js\?v=\d+/g,'sw.js?v=VERSION');
  assert.equal(normalize(worker),normalize(nextWorker));assert.equal(normalize(html),normalize(nextHtml));
  fs.writeFileSync(path.join(root,'app/bundle.js'),result);fs.writeFileSync(path.join(root,'SutiApp.html'),nextHtml);fs.writeFileSync(path.join(root,'sw.js'),nextWorker);
  const e=env(),site=path.join(baseline,'site-'+version);
  cp.execFileSync(process.execPath,['scripts/build-pages-site.js',site],{cwd:root,env:{...process.env,SUTIAPP_SUPABASE_URL:e.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:e.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe'});
  const before=fs.readFileSync(path.join(baseline,'bundle.js'),'utf8'),old=chunk(before,'screens-credencial.jsx');
  assert.equal(result.slice(0,c.start),before.slice(0,old.start));assert.equal(result.slice(c.start+replacement.length),before.slice(old.end));
  receipt('build',{status:'PASS',sourceSha256:sha(source),bundleSha256:sha(result),unrelatedModulesIdentical:true,swLogicIdentical:true,htmlOnlyCachebusters:true,bundleVersion:version,workerVersion:cache,pagesBuild:true,productionDeployed:false});
}
async function live(){
  const e=env(),report={status:'PASS',environment:'LIVE_SUPABASE_READ_ONLY',sessions:[],businessWrites:0};
  const request=async(endpoint,token,body)=>{const r=await fetch(e.SUPABASE_URL+endpoint,{method:body===undefined?'GET':'POST',headers:{apikey:e.SUPABASE_PUBLISHABLE_KEY,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return {status:r.status,data:await r.json()};};
  const seen=new Set();
  for(const alias of ['H005_TEST']){
    const auth=await request('/auth/v1/token?grant_type=password',null,{email:e[alias+'_EMAIL'],password:e[alias+'_PASSWORD']});assert.equal(auth.status,200,alias+' login');
    const token=auth.data.access_token;
    const effective=await request('/rest/v1/rpc/get_effective_affiliate_id',token,{});assert.equal(effective.status,200);assert(effective.data,'effective identity');assert(!seen.has(effective.data),'distinct test identities');seen.add(effective.data);
    const scope=await request('/rest/v1/rpc/list_current_deposit_accounts',token,{});assert.equal(scope.status,200,alias+' scoped RPC');assert(Array.isArray(scope.data));assert(scope.data.every(r=>r.affiliate_id===effective.data),'cross-user RPC row');
    const direct=await request('/rest/v1/affiliate_bank_accounts?select=id,affiliate_id',token);assert.equal(direct.status,200);
    const foreign=direct.data.filter(r=>r.affiliate_id!==effective.data).length;
    if(alias==='H005_TEST')assert(foreign>0,'admin reproduction must see broad authorized list');else assert.equal(foreign,0,'non-admin RLS denies foreign rows');
    assert.deepEqual(scope.data.map(r=>r.id).sort(),direct.data.filter(r=>r.affiliate_id===effective.data).map(r=>r.id).sort(),'all and only own accounts');
    report.sessions.push({alias,scopedRows:scope.data.length,foreignScopedRows:0,rlsChecked:true,adminBroadListReproduced:alias==='H005_TEST'?true:undefined});
  }
  const management=async query=>{
    const ref=new URL(e.SUPABASE_URL).hostname.split('.')[0];
    const r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)});
    assert(r.ok,'read-only management HTTP '+r.status);return r.json();
  };
  // Existing secondary QA password is stale. Exercise actual deployed RLS with
  // authenticated role/JWT claims inside READ ONLY + ROLLBACK; no Auth edits.
  const identities=await management(`begin read only;
    select a.id,u.id auth_id from public.affiliates a join auth.users u on u.id=a.auth_user_id
    where u.email_confirmed_at is not null and a.historical_email_normalized=lower(btrim(u.email))
    and (select count(*) from public.affiliates x where x.historical_email_normalized=a.historical_email_normalized)=1
    and exists(select 1 from public.affiliate_bank_accounts b where b.affiliate_id=a.id)
    order by a.id limit 12; rollback;`);
  report.rlsRoleCases=[];
  for(const identity of identities){
    if(seen.has(identity.id))continue;
    assert(/^[a-f0-9-]{36}$/.test(identity.id)&&/^[a-f0-9-]{36}$/.test(identity.auth_id));
    const result=await management(`begin read only; set local role authenticated;
      set local request.jwt.claims='{"sub":"${identity.auth_id}","role":"authenticated"}';
      select public.get_effective_affiliate_id()='${identity.id}'::uuid as identity_matches,
        public.has_admin_permission('bank_accounts.read') as is_admin,
        (select count(*)::int from public.list_current_deposit_accounts()) as own_count,
        (select count(*)::int from public.list_current_deposit_accounts() where affiliate_id<>'${identity.id}'::uuid) as foreign_rpc,
        (select count(*)::int from public.affiliate_bank_accounts where affiliate_id<>'${identity.id}'::uuid) as foreign_rls;
      rollback;`);
    const proof=result[0];if(!proof.identity_matches||proof.is_admin)continue;
    assert(proof.own_count>0);assert.equal(proof.foreign_rpc,0);assert.equal(proof.foreign_rls,0);
    seen.add(identity.id);report.rlsRoleCases.push({identityMatches:true,ownRows:proof.own_count,foreignRpcRows:0,foreignRlsRows:0,mode:'AUTHENTICATED_ROLE_READ_ONLY_ROLLBACK'});
    if(report.rlsRoleCases.length===2)break;
  }
  assert.equal(report.rlsRoleCases.length,2,'two distinct normal-user backend RLS cases');
  const anon=await request('/rest/v1/rpc/list_current_deposit_accounts',null,{});assert([401,403].includes(anon.status),'anonymous RPC denied');
  report.anonymousDenied=true;report.distinctIdentities=seen.size;report.secondaryQaPasswordStale=true;receipt('security-live',report);
}
async function browser(){
  const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const report={status:'PASS',environment:'ISOLATED_CHROME_390x844',cases:[],pageErrors:[]};
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.pageErrors.push(e.message));
    await page.route('**/*',route=>route.abort());
    const styles=[...read('SutiApp.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
    await page.setContent('<html><head><style>'+styles+'</style></head><body><div id="root"></div></body></html>');
    for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
    await page.addScriptTag({content:`
      window.Icon=()=>null; window.SutiSeal=()=>null; window.FistMark=()=>null; window.Avatar=()=>null; window.IconTile=()=>null;
      window.TopBar=()=>React.createElement('header',null,'Mi Credencial');
      window.SectionHead=({title})=>React.createElement('h2',null,title);
      window.Btn=({children,onClick})=>React.createElement('button',{onClick},children);
      window.Sheet=({open,title,children})=>open?React.createElement('section',{'data-editor':true},React.createElement('h2',null,title),children):null;
      window.calls=[];window.mode='ready';window.active='A';window.pending=null;
      window.fixtureRows=id=>[{id:'account-'+id,affiliate_id:id,bank_name:'Banco QA '+id,account_holder:'Titular QA '+id,account_number:'000012345678',is_primary:true,data_status:'COMPLETE'},{id:'incomplete-'+id,affiliate_id:id,bank_name:'Incompleto QA '+id,is_primary:false,data_status:'INCOMPLETE_HISTORICAL_DATA'}];
      window.SutiSupabase={getClient:()=>({from:()=>{throw Error('BROAD_BANK_QUERY_FORBIDDEN')},rpc:async name=>{
        window.calls.push(name);if(name!=='list_current_deposit_accounts')throw Error('UNEXPECTED_WRITER');
        if(window.mode==='error')return {error:{message:'ISOLATED_ERROR'}};
        if(window.mode==='pending')return new Promise(resolve=>window.pending=resolve);
        return {data:window.mode==='empty'?[]:fixtureRows(window.active)};
      }})};
      window.CredentialQrRepository={issue:async()=>({token:'qa',destination_path:'/qa',expires_at:new Date(Date.now()+60000).toISOString()})};
      window.testRoot=ReactDOM.createRoot(document.getElementById('root'));
      window.renderUser=id=>{window.active=id;window.testRoot.render(React.createElement(window.CredencialScreen,{app:{user:{id,name:'Usuario QA '+id,numeroControl:'QA-'+id},push:()=>{},toast:()=>{}}}));};
    `});
    const bundle=read('app/bundle.js');
    for(const name of ['bank-account-repository.js','screens-credencial.jsx'])await page.addScriptTag({content:chunk(bundle,name).text});
    await page.evaluate(()=>renderUser('A'));await page.waitForSelector('[data-banking-phase=ready]');
    assert.equal(await page.locator('[data-bank-account-id]').count(),2);assert.equal(await page.locator('[data-bank-account-id="account-B"]').count(),0);
    assert.equal(await page.locator('[data-bank-masked]').first().innerText(),'•••• 5678');
    const headings=await page.locator('h2').allTextContents();assert.deepEqual(headings,['Datos del afiliado','Datos bancarios','Actualiza tus documentos']);
    await page.getByText('Titular QA A',{exact:true}).click();await page.waitForSelector('[data-editor]');
    report.cases.push('own cards, masking, incomplete account, sections and edit entry');
    await page.evaluate(()=>{window.mode='pending';renderUser('B')});await page.waitForSelector('[data-banking-phase=loading]');
    assert.equal(await page.locator('[data-bank-account-id]').count(),0);assert.equal(await page.locator('[data-editor]').count(),0);
    await page.evaluate(()=>{window.pending({data:fixtureRows('B')});window.mode='ready'});await page.waitForSelector('[data-banking-phase=ready]');
    assert.equal(await page.locator('[data-bank-account-id="account-A"]').count(),0);assert.equal(await page.locator('[data-bank-account-id="account-B"]').count(),1);
    report.cases.push('user switch discards prior cards and editor');
    await page.evaluate(()=>{window.mode='empty';renderUser('C')});await page.waitForSelector('[data-banking-phase=ready]');assert.equal(await page.locator('[data-bank-account-id]').count(),0);assert(await page.getByText('Agregar datos bancarios',{exact:true}).isVisible());
    report.cases.push('empty account list preserves add control');
    await page.evaluate(()=>{window.mode='error';renderUser('D')});await page.waitForSelector('[data-banking-phase=error]');assert.equal(await page.locator('[data-bank-account-id]').count(),0);assert(await page.getByRole('alert').isVisible());
    await page.evaluate(()=>window.mode='ready');await page.getByText('Reintentar',{exact:true}).click();await page.waitForSelector('[data-banking-phase=ready]');
    report.cases.push('source error fails closed and retry reloads own accounts');
    await page.evaluate(()=>{window.mode='pending';renderUser('E')});await page.waitForSelector('[data-banking-phase=loading]');await page.evaluate(()=>{window.late=window.pending;window.mode='ready';renderUser('F')});await page.waitForSelector('[data-banking-phase=ready]');await page.evaluate(()=>window.late({data:fixtureRows('E')}));
    assert.equal(await page.locator('[data-bank-account-id="account-E"]').count(),0);assert.equal(await page.locator('[data-bank-account-id="account-F"]').count(),1);
    report.cases.push('late response from previous user cannot repopulate section');
    assert((await page.evaluate(()=>window.calls)).every(x=>x==='list_current_deposit_accounts'));assert.deepEqual(report.pageErrors,[]);
    fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'credential-isolated.png'),fullPage:true});receipt('browser',report);
  }finally{await browser.close()}
}
(async()=>{if(process.argv.includes('--build'))build();else if(process.argv.includes('--live'))await live();else await browser()})().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1});
