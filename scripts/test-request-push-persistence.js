'use strict';
// Exactly two automated suites; real application JS/IndexedDB, isolated transport.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/request-push-persistence-fix-20260911');
const suite=process.argv[2];assert(['lifecycle','security'].includes(suite),'Choose lifecycle or security');
const build=JSON.parse(fs.readFileSync(path.join(out,'build.json'),'utf8'));
const bundle=fs.readFileSync(path.join(build.site,'app/bundle.js'),'utf8').replace(/\r\n/g,'\n');
const source=name=>{
  const marker='/* @@file '+name+' */\n(function(){\n',start=bundle.indexOf(marker),end=bundle.indexOf('/* @@file ',start+marker.length);
  assert(start>=0&&end>start);const section=bundle.slice(start+marker.length,end);return section.slice(0,section.lastIndexOf('\n})();')).trimEnd();
};
assert.equal(source('request-push.js'),fs.readFileSync(path.join(root,'app/request-push.js'),'utf8').replace(/\r\n/g,'\n').trimEnd());
async function initialize(page,options={}){
  for(const vendor of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:fs.readFileSync(path.join(build.site,'app/vendor',vendor),'utf8')});
  await page.evaluate(options=>{
    window.__failure=options.failure||null;window.__backendStatus=true;window.__answer='granted';window.__asks=0;window.__unsubscribes=0;window.__revokes=0;window.__registrations=0;window.__subscribeCalls=0;
    window.__user='11111111-1111-4111-8111-111111111111';window.__impersonation=false;window.__permission=options.existing?'granted':'default';
    window.__subid='22222222-2222-4222-8222-222222222222';window.__trace=[];
    const sub={toJSON:()=>({endpoint:'https://fcm.googleapis.com/test/isolated-persistence',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}}),unsubscribe:async()=>{__unsubscribes++;window.__sub=null;return true;}};
    window.__sub=options.existing?sub:null;
    Object.defineProperty(Notification,'permission',{get:()=>__permission,configurable:true});
    Notification.requestPermission=async()=>{__asks++;__permission=__answer;return __permission;};
    const reg={getNotifications:async()=>[],pushManager:{getSubscription:async()=>__sub,subscribe:async()=>{__subscribeCalls++;if(window.__holdSubscribe)await new Promise(resolve=>{window.__releaseSubscribe=resolve;});window.__sub=sub;return sub;}}};
    Object.defineProperty(navigator.serviceWorker,'ready',{value:Promise.resolve(reg),configurable:true});
    Object.defineProperty(navigator.serviceWorker,'getRegistration',{value:async()=>reg,configurable:true});
    const session=()=>({user:{id:__user},access_token:'isolated-fixture-not-a-real-token'});
    const client={auth:{getSession:async()=>__failure==='session'?{error:Error('ISOLATED_OFFLINE')}:{data:{session:session()}},onAuthStateChange:cb=>{window.__authCallback=cb;return{data:{subscription:{}}};},signOut:async()=>{__authCallback('SIGNED_OUT',null);return{};}},rpc:async name=>{
      if(name==='get_admin_access_context')return{data:{}};
      if(__failure==='rpc')return{error:Error('ISOLATED_OFFLINE')};
      if(name==='get_self_request_push_config')return{data:{enabled:true,public_key:'B'.repeat(87)}};
      if(name==='get_self_request_push_status'){
        if(window.__holdStatus){window.__holdStatus=false;return new Promise(resolve=>{window.__releaseStatus=()=>resolve({data:false});});}
        return{data:__backendStatus};
      }
      if(name==='register_self_request_push'){__registrations++;return{data:__subid};}
      if(name==='revoke_self_request_push'){__revokes++;return{data:true};}
      throw Error('UNEXPECTED_RPC:'+name);
    }};
    window.SutiSupabase={getClient:()=>client};
    window.AffiliateRepository={getCurrentAffiliate:async()=>{if(__failure==='affiliate')throw Error('ISOLATED_OFFLINE');return{id:'isolated-affiliate',auth_user_id:__user,auth_eligibility:'eligible',_impersonation:__impersonation?{actor:'isolated-actor'}:null};},getProfilePhoto:async()=>null,clearProfilePhotoCache:()=>{}};
    window.createAffiliateViewModel=value=>value;
    window.__binding=()=>new Promise((resolve,reject)=>{
      const open=indexedDB.open('sutiapp-request-push-v1',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('device'),r=tx.objectStore('device').get('binding');let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>{db.close();resolve(!!result);};tx.onerror=()=>reject(tx.error);};open.onerror=()=>reject(open.error);
    });
  },options);
  for(const name of ['affiliate-auth.js','request-push.js'])await page.addScriptTag({content:source(name)});
  await page.evaluate(async()=>{AffiliateAuth.subscribe(s=>__trace.push(s.phase));await AffiliateAuth.bootstrap();window.__root=ReactDOM.createRoot(document.getElementById('root'));__root.render(React.createElement(RequestPushInvitation));});
}
async function snapshot(page){return page.evaluate(async()=>({phase:(await RequestPush.state()).phase,permission:Notification.permission,binding:await __binding(),subscription:!!__sub,unsubscribes:__unsubscribes,revokes:__revokes,asks:__asks,registrations:__registrations}));}
async function enable(page){await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();await page.locator('[data-request-push="active"]').waitFor();}
async function refresh(page){await page.evaluate(()=>window.dispatchEvent(new Event('focus')));}
async function main(){
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--surface:white;--guinda:#99002b;--ink-2:#405371;--neo-sm:0 3px 8px #0001}body{background:#eef1f4;font-family:Arial;padding:16px}</style><div id="root"></div>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const cases=[],errors=[];
  async function fresh(){const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await initialize(page);return{page,context};}
  try{
    if(suite==='lifecycle'){
      let {page,context}=await fresh();await page.locator('[data-request-push="ready"]').waitFor();assert.equal(await page.evaluate(()=>__asks),0);
      await page.screenshot({path:path.join(out,'permission-ready.png')});
      await page.evaluate(()=>{__answer='default';});await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();await page.waitForFunction(()=>__asks===1);await page.locator('[data-request-push="ready"]').waitFor();assert.equal(await page.evaluate(()=>__subscribeCalls),0);
      await page.evaluate(()=>{__answer='denied';});await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();await page.locator('[data-request-push="denied"]').waitFor();assert.equal(await page.evaluate(()=>__subscribeCalls),0);
      await page.evaluate(()=>{__permission='default';__answer='granted';__holdSubscribe=true;});await refresh(page);
      await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();await page.waitForFunction(()=>typeof __releaseSubscribe==='function');
      await refresh(page);await page.evaluate(()=>__releaseSubscribe());await page.locator('[data-request-push="active"]').waitFor();assert.equal(await page.evaluate(()=>__asks),3);
      cases.push({name:'permission_default_dismissed_denied_granted',result:await snapshot(page)});
      for(const failure of [null,'affiliate','session']){
        await page.reload();await initialize(page,{failure,existing:true});
        await page.locator('[data-request-push="'+(failure?'error':'active')+'"]').waitFor();
        const during=await snapshot(page);assert.equal(during.unsubscribes,0);assert(during.binding&&during.subscription);assert.equal(during.asks,0);
        if(failure){assert.equal(during.phase,'error');await page.evaluate(async()=>{__failure=null;await AffiliateAuth.retry();});await page.locator('[data-request-push="active"]').waitFor();}
        cases.push({name:'reopen_'+(failure||'healthy'),during,after:await snapshot(page)});
      }
      await page.evaluate(async()=>{__failure='affiliate';await AffiliateAuth.refreshContext();});await page.locator('[data-request-push="error"]').waitFor();assert.equal((await snapshot(page)).unsubscribes,0);
      await page.evaluate(async()=>{__failure=null;await AffiliateAuth.retry();});await page.locator('[data-request-push="active"]').waitFor();
      cases.push({name:'context_refresh_recovery',result:await snapshot(page)});
      await page.evaluate(()=>{__failure='rpc';});await refresh(page);await page.locator('[data-request-push="error"]').waitFor();await page.screenshot({path:path.join(out,'connection-error.png')});
      await page.evaluate(()=>{__failure=null;window.dispatchEvent(new Event('online'));});await page.locator('[data-request-push="active"]').waitFor();assert.equal((await snapshot(page)).unsubscribes,0);
      cases.push({name:'rpc_offline_online',result:await snapshot(page)});
      // Older backend response must not overwrite a newer successful state.
      await page.evaluate(()=>{__holdStatus=true;window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>typeof __releaseStatus==='function');
      await refresh(page);await page.locator('[data-request-push="active"]').waitFor();await page.evaluate(()=>__releaseStatus());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.locator('[data-request-push="active"]').waitFor();
      await page.screenshot({path:path.join(out,'active-preserved.png')});cases.push({name:'stale_response_ignored',result:await snapshot(page)});
      await context.close();
    }else{
      for(const action of ['logout','switch','impersonation']){
        const {page,context}=await fresh();await enable(page);
        if(action==='logout')await page.evaluate(async()=>{await RequestPush.clearDevice();await AffiliateAuth.signOut();});
        if(action==='switch')await page.evaluate(async()=>{__user='66666666-6666-4666-8666-666666666666';await AffiliateAuth.refreshContext();});
        if(action==='impersonation')await page.evaluate(async()=>{__impersonation=true;await AffiliateAuth.refreshContext();});
        await page.waitForFunction(()=>__sub===null);const result=await snapshot(page);assert(!result.binding&&!result.subscription);assert.equal(result.unsubscribes,1);assert.equal(result.registrations,1);
        if(action==='impersonation'){assert.equal(result.phase,'unavailable');assert.equal(await page.evaluate(async()=>{try{await RequestPush.enable({public_key:'B'.repeat(87)});return false;}catch{return true;}}),true);}
        if(action==='logout')assert.equal(result.revokes,1);
        cases.push({name:action,result});await context.close();
      }
      const {page,context}=await fresh();await enable(page);
      for(const reason of ['revoked','expired']){
        await page.evaluate(()=>{__backendStatus=false;});await refresh(page);await page.locator('[data-request-push="ready"]').waitFor();const result=await snapshot(page);assert.equal(result.phase,'ready');assert.equal(result.registrations,1);assert.equal(result.asks,1);
        cases.push({name:'backend_'+reason+'_not_auto_registered',result});await page.evaluate(()=>{__backendStatus=true;});await refresh(page);await page.locator('[data-request-push="active"]').waitFor();
      }
      await page.evaluate(workerSource=>{
        window.__handlers={};window.__shown=[];window.__opened=[];
        const worker={addEventListener:(name,fn)=>{__handlers[name]=fn;},location:{origin:location.origin},registration:{scope:location.origin+'/',showNotification:async(title,options)=>__shown.push({title,...options})},clients:{matchAll:async()=>[],openWindow:async url=>__opened.push(url)}};
        new Function('self',workerSource)(worker);
        window.__emit=async(name,data)=>{let pending;__handlers[name]({...data,waitUntil:p=>{pending=p;}});await pending;};
        window.__payload={v:1,event_id:'33333333-3333-4333-8333-333333333333',request_id:'44444444-4444-4444-8444-444444444444',subscription_id:__subid,title:'Aviso técnico aislado',body:'Prueba sin datos reales'};
      },fs.readFileSync(path.join(build.site,'sw.js'),'utf8'));
      await page.evaluate(async()=>{await Promise.all(Array.from({length:8},()=>__emit('push',{data:{json:()=>__payload}})));});assert.equal(await page.evaluate(()=>__shown.length),1);
      await page.evaluate(()=>__emit('notificationclick',{notification:{...__shown[0],close:()=>{}}}));assert.match(await page.evaluate(()=>__opened[0]),/#\/historial\?request=44444444-4444-4444-8444-444444444444$/);
      await page.evaluate(()=>__emit('push',{data:{json:()=>({...__payload,event_id:'55555555-5555-4555-8555-555555555555',subscription_id:'77777777-7777-4777-8777-777777777777'})}}));assert.equal(await page.evaluate(()=>__shown.length),1);
      await page.getByRole('button',{name:'Desactivar en este dispositivo'}).click();await page.locator('[data-request-push="ready"]').waitFor();
      await page.evaluate(()=>__emit('push',{data:{json:()=>({...__payload,event_id:'88888888-8888-4888-8888-888888888888'})}}));assert.equal(await page.evaluate(()=>__shown.length),1);
      cases.push({name:'worker_dedup_click_cross_binding_revocation',displayed:1,openedCorrectRequest:true,otherBindingIgnored:true,revokedIgnored:true});await context.close();
    }
    assert.deepEqual(errors,[]);
    const proof={suite,status:'PASS',checkedAt:new Date().toISOString(),bundleSha256:build.bundleSha256,environment:'Chrome desktop mobile viewport; built Auth/Push/SW source and real IndexedDB; Auth RPC, Push provider and native permission simulated; no production writes or messages',cases,errors};
    fs.writeFileSync(path.join(out,suite+'.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({suite,status:'PASS',groupedScenarios:cases.length,errors}));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
