'use strict';
// Four focused checks. All identities, provider responses and messages are isolated fixtures.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),vm=require('vm'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),site=process.env.SUTIAPP_PUSH_SITE||root;
const out=path.join(root,'docs/qa/evidence/request-push-ux-fix');
const names=['interface','persistence','recovery','security'],selected=process.argv.slice(2);
assert(selected.every(name=>names.includes(name)),'Optional arguments: interface persistence recovery security');
const bundle=fs.readFileSync(path.join(site,'app/bundle.js'),'utf8').replace(/\r\n/g,'\n');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function source(name){
  const marker='/* @@file '+name+' */\n(function(){\n',start=bundle.indexOf(marker);
  assert(start>=0,'Built module exists: '+name);
  const next=bundle.indexOf('/* @@file ',start+marker.length),section=bundle.slice(start+marker.length,next<0?undefined:next);
  return section.slice(0,section.lastIndexOf('\n})();')).trimEnd();
}
const babelContext={};vm.createContext(babelContext);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),babelContext);
for(const name of ['affiliate-auth.js','request-push.js','app.jsx']){
  const raw=fs.readFileSync(path.join(root,'app',name),'utf8').replace(/\r\n/g,'\n').trimEnd();
  const expected=name==='app.jsx'?babelContext.Babel.transform(raw,{presets:['react'],filename:'app.jsx'}).code:raw;
  assert.equal(sha(source(name)),sha(expected),'Built/source parity: '+name);
}

async function initialize(page,options={}){
  for(const vendor of ['react-18.3.1/react.production.min.js','react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:fs.readFileSync(path.join(site,'app/vendor',vendor),'utf8')});
  await page.evaluate(options=>{
    Object.assign(window,{__user:options.user||'11111111-1111-4111-8111-111111111111',__permission:options.existing?'granted':'default',__asks:0,__subscribeCalls:0,__registrations:0,__unsubscribes:0,__revokes:0,__failure:null,__backendStatus:true,__statusChecks:[],__holdConfig:!!options.holdConfig});
    window.__endpoint=options.endpoint||'https://fcm.googleapis.com/isolated-ux-fixture';
    window.__subid=options.subid||'22222222-2222-4222-8222-222222222222';
    window.__backendBindings=options.backendBindings||[];
    const sub={toJSON:()=>({endpoint:__endpoint,keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}}),unsubscribe:async()=>{__unsubscribes++;window.__sub=null;return true;}};
    window.__sub=options.existing?sub:null;
    Object.defineProperty(Notification,'permission',{get:()=>__permission,configurable:true});
    Notification.requestPermission=async()=>{__asks++;return window.__permission='granted';};
    const reg={getNotifications:async()=>[],pushManager:{getSubscription:async()=>__sub,subscribe:async()=>{__subscribeCalls++;window.__sub=sub;return sub;}}};
    Object.defineProperty(navigator.serviceWorker,'ready',{value:Promise.resolve(reg),configurable:true});
    Object.defineProperty(navigator.serviceWorker,'getRegistration',{value:async()=>reg,configurable:true});
    const session=()=>({user:{id:__user},access_token:'isolated-fixture-not-a-real-token'});
    const client={auth:{getSession:async()=>({data:{session:session()}}),onAuthStateChange:cb=>{window.__authCallback=cb;return{data:{subscription:{}}};},signOut:async()=>{__authCallback('SIGNED_OUT',null);return{};}},rpc:async(name,args)=>{
      if(name==='get_admin_access_context')return{data:{}};
      if(__failure==='rpc')return{error:Error('ISOLATED_OFFLINE')};
      if(name==='get_self_request_push_config'){
        if(__holdConfig)await new Promise(resolve=>{window.__releaseConfig=()=>{window.__holdConfig=false;resolve();};});
        return{data:{enabled:true,public_key:'B'.repeat(87)}};
      }
      if(name==='get_self_request_push_status'){
        __statusChecks.push({owner:__user,id:args.p_subscription_id});
        return{data:__backendStatus&&__backendBindings.some(row=>row.id===args.p_subscription_id&&row.owner===__user&&row.active)};
      }
      if(name==='register_self_request_push'){
        let row=__backendBindings.find(value=>value.endpoint===args.p_endpoint&&value.owner===__user&&value.active);
        if(!row){row={id:'22222222-2222-4222-8222-'+String(__backendBindings.length+1).padStart(12,'0'),owner:__user,endpoint:args.p_endpoint,active:true};__backendBindings.push(row);}
        __registrations++;window.__subid=row.id;return{data:row.id};
      }
      if(name==='revoke_self_request_push'){__revokes++;const row=__backendBindings.find(value=>value.id===args.p_subscription_id&&value.owner===__user);if(row)row.active=false;return{data:!!row};}
      throw Error('UNEXPECTED_RPC:'+name);
    }};
    window.SutiSupabase={getClient:()=>client};
    window.AffiliateRepository={getCurrentAffiliate:async()=>({id:'isolated-affiliate-'+__user,auth_user_id:__user,auth_eligibility:'eligible'}),getProfilePhoto:async()=>null,clearProfilePhotoCache:()=>{}};
    window.createAffiliateViewModel=value=>({...value,name:'Afiliado de prueba',short:'Prueba'});
    window.__device=(key,value,write=false)=>new Promise((resolve,reject)=>{
      const open=indexedDB.open('sutiapp-request-push-v1',1);
      open.onsuccess=()=>{const db=open.result,tx=db.transaction('device',write?'readwrite':'readonly'),request=write?tx.objectStore('device').put(value,key):tx.objectStore('device').get(key);let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>{db.close();resolve(result||null);};tx.onerror=()=>reject(tx.error);};open.onerror=()=>reject(open.error);
    });
  },options);
  for(const name of ['affiliate-auth.js','request-push.js'])await page.addScriptTag({content:source(name)});
  await page.evaluate(async()=>{await AffiliateAuth.bootstrap();window.__root=ReactDOM.createRoot(document.getElementById('root'));});
  if(!options.shell)await page.evaluate(()=>__root.render(React.createElement(RequestPushInvitation)));
}
async function renderShell(page){
  await page.evaluate(()=>{
    const empty=()=>null;
    window.Icon=empty;window.Res=empty;window.SutiSeal=empty;window.Avatar=empty;
    window.useTweaks=defaults=>[{...defaults,showPromo:false},()=>{}];
    window.useTextSizePreference=()=>({value:'normal'});
    window.useInstitutionalContent=()=>({phase:'loaded'});window.useVisualContent=()=>({phase:'loaded',popups:[]});window.useEditorialContent=()=>({phase:'loaded'});
    window.useAdminAuth=()=>({phase:'denied',assignment:null,has:()=>false});window.AdminRepository={refreshAccessContext:async()=>({phase:'denied'})};
    window.useAsset=()=>null;window.useRequestNotifications=()=>({phase:'loaded',rows:[],retry:()=>{}});
    window.useQuoteStore=()=>({state:()=>({phase:'loaded'}),mine:()=>[],readyUnseen:()=>[],retry:()=>{}});
    window.TweaksPanel=empty;window.TweakSection=empty;window.TweakRadio=empty;window.TweakColor=empty;window.TweakToggle=empty;window.TweakButton=empty;
    window.AppScreenLayout={Region:empty,RouteSlot:empty};
    window.HomeScreen=({app})=>React.createElement(TopBar,{app,variant:'home'});
  });
  // Expose existing shell only inside this fixture; keep its components and routing intact.
  const appSource=source('app.jsx'),entry="ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Root));";
  assert(appSource.includes(entry));
  await page.addScriptTag({content:appSource.replace(entry,'window.__PushTestApp=App;')});
  await page.evaluate(()=>__root.render(React.createElement(__PushTestApp,{auth:{...AffiliateAuth.getState(),affiliateView:{id:'fixture-view',name:'Afiliado de prueba',short:'Prueba'}}})));
}
async function snapshot(page){return page.evaluate(async()=>({phase:(await RequestPush.state()).phase,binding:await __device('binding'),subscription:!!__sub,asks:__asks,registrations:__registrations,subscribeCalls:__subscribeCalls,unsubscribes:__unsubscribes,revokes:__revokes}));}
async function enable(page){await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();await page.locator('[data-request-push="active"]').waitFor();}
async function flush(page){await page.evaluate(async()=>{window.dispatchEvent(new Event('focus'));await RequestPush.state();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
async function expandActive(page){const summary=page.locator('[data-request-push="active"] summary');if(await summary.count()){if(!await summary.evaluate(el=>el.parentElement.open))await summary.click();}else{const control=page.locator('[data-request-push="active"] button[aria-expanded="false"]');if(await control.count())await control.click();}}
async function reopen(page,context,url){
  const restored=await page.evaluate(()=>({existing:!!__sub,subid:__subid,endpoint:__endpoint,backendBindings:__backendBindings,user:__user}));
  await page.close();const reopened=await context.newPage();await reopened.goto(url);await initialize(reopened,restored);return reopened;
}
async function main(){
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--surface:white;--guinda:#910022;--ink-2:#405371;--bg:#eef1f4;--neo-sm:0 3px 8px #0001}body{margin:0;font-family:Arial}#root{position:relative;height:844px}</style><div id="root"></div>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[],contexts=[];
  async function fresh(options={}){
    const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
    const page=await context.newPage();await page.goto(url);await initialize(page,options);return{page,context};
  }
  const checks={
    interface:async()=>{
      const {page}=await fresh({shell:true,existing:true,holdConfig:true});await renderShell(page);
      await page.locator('.su-topbar').waitFor();await page.waitForFunction(()=>typeof __releaseConfig==='function');
      const before=await page.locator('.su-topbar').boundingBox();assert.equal(await page.locator('[data-request-push]').count(),0);
      await page.evaluate(()=>__releaseConfig());await flush(page);
      const after=await page.locator('.su-topbar').boundingBox();assert.equal(after.y,before.y);assert.equal(after.height,before.height);assert.equal(await page.locator('[data-request-push]').count(),0);
      assert.equal(await page.evaluate(()=>__asks),0);
      await page.getByRole('button',{name:'Notificaciones',exact:true}).click();await page.locator('[data-app-route="notifs"] [data-request-push="repair"]').waitFor();
      await page.getByRole('button',{name:'Restablecer notificaciones',exact:true}).click();await page.locator('[data-request-push="active"]').waitFor();
      await expandActive(page);assert(await page.getByRole('button',{name:'Desactivar en este dispositivo',exact:true}).isVisible());
      return{actualShellAndTopBar:true,unrelatedProviders:'isolated',headerBefore:before,headerAfter:after,homeBannerCount:0,bellManagement:true,nativePrompts:await page.evaluate(()=>__asks)};
    },
    persistence:async()=>{
      let {page,context}=await fresh();await enable(page);const before=await snapshot(page);
      page=await reopen(page,context,url);await page.locator('[data-request-push="active"]').waitFor();const after=await snapshot(page);
      assert.equal(after.binding.subscription_id,before.binding.subscription_id);assert.equal(after.binding.user_id,before.binding.user_id);
      assert.equal(after.asks,0);assert.equal(after.registrations,0);assert.equal(after.subscribeCalls,0);assert.equal(after.unsubscribes,0);assert(after.subscription);
      return{closedAndOpenedPage:true,indexedDBPreserved:true,permissionAndProvider:'simulated restoration',before,after};
    },
    recovery:async()=>{
      const {page}=await fresh();await enable(page);const before=await snapshot(page);
      await page.evaluate(()=>{__sub=null;__endpoint+='-recovered';document.dispatchEvent(new Event('visibilitychange'));});await flush(page);
      const recovered=await snapshot(page);assert.equal(recovered.phase,'active');assert.equal(recovered.registrations,before.registrations+1);assert.equal(recovered.asks,before.asks);
      await flush(page);const repeated=await snapshot(page);assert.equal(repeated.registrations,recovered.registrations);assert.equal(repeated.subscribeCalls,recovered.subscribeCalls);assert.equal(repeated.asks,before.asks);
      await page.evaluate(()=>{__failure='rpc';});await flush(page);await page.locator('[data-request-push="error"]').waitFor();assert.equal((await snapshot(page)).unsubscribes,0);
      await page.evaluate(()=>{__failure=null;});await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.locator('[data-request-push="active"]').waitFor();
      await page.evaluate(()=>{__backendStatus=false;});await flush(page);await page.locator('[data-request-push="repair"]').waitFor();assert.equal((await snapshot(page)).registrations,recovered.registrations);
      await page.evaluate(()=>{__backendStatus=true;__backendBindings.forEach(row=>{row.active=false;});});
      await page.getByRole('button',{name:'Restablecer notificaciones',exact:true}).click();await page.locator('[data-request-push="active"]').waitFor();const repaired=await snapshot(page);assert.equal(repaired.asks,before.asks);
      // A persisted explicit opt-out must win even if an old valid binding remains.
      await page.evaluate(async()=>{await __device('prompt:'+__user,{disabled:true},true);__sub=null;});await flush(page);
      const disabled=await snapshot(page);assert.notEqual(disabled.phase,'active');assert.equal(disabled.subscribeCalls,repaired.subscribeCalls);assert.equal(disabled.registrations,repaired.registrations);assert.equal(disabled.subscription,false);
      return{validBindingRecoveredOnce:recovered,repeatedRefresh:repeated,networkFailurePreservedBinding:true,invalidBindingRequiresExplicitRepair:repaired,explicitOptout:disabled};
    },
    security:async()=>{
      const {page}=await fresh();await enable(page);const oldBinding=(await snapshot(page)).binding;
      await page.evaluate(workerSource=>{
        window.__handlers={};window.__shown=[];
        const worker={addEventListener:(name,fn)=>{__handlers[name]=fn;},location:{origin:location.origin},registration:{scope:location.origin+'/',showNotification:async(title,options)=>{__shown.push({title,...options});}},clients:{matchAll:async()=>[],openWindow:async()=>{}}};
        new Function('self',workerSource)(worker);
        window.__emit=async payload=>{let pending;__handlers.push({data:{json:()=>payload},waitUntil:p=>{pending=p;}});await pending;};
        window.__payload={v:1,event_id:'33333333-3333-4333-8333-333333333333',request_id:'44444444-4444-4444-8444-444444444444',subscription_id:__subid,title:'Fixture aislado',body:'Sin datos privados reales'};
      },fs.readFileSync(path.join(site,'sw.js'),'utf8'));
      await page.evaluate(()=>__emit(__payload));assert.equal(await page.evaluate(()=>__shown.length),1);
      await page.evaluate(()=>__emit({...__payload,event_id:'55555555-5555-4555-8555-555555555555',subscription_id:'77777777-7777-4777-8777-777777777777'}));assert.equal(await page.evaluate(()=>__shown.length),1);
      await page.evaluate(async()=>{__user='66666666-6666-4666-8666-666666666666';await AffiliateAuth.refreshContext();});await flush(page);
      const switched=await snapshot(page);assert.equal(switched.binding,null);assert.equal(switched.subscription,false);
      await page.evaluate(()=>__emit({...__payload,event_id:'88888888-8888-4888-8888-888888888888'}));assert.equal(await page.evaluate(()=>__shown.length),1);
      assert.equal(await page.evaluate(oldId=>__statusChecks.some(row=>row.owner===__user&&row.id===oldId),oldBinding.subscription_id),false);
      await page.getByRole('button',{name:'Restablecer notificaciones',exact:true}).click();await page.locator('[data-request-push="active"]').waitFor();const current=(await snapshot(page)).binding;
      assert.notEqual(current.user_id,oldBinding.user_id);assert.notEqual(current.subscription_id,oldBinding.subscription_id);
      await page.evaluate(()=>__emit({...__payload,event_id:'99999999-9999-4999-8999-999999999999'}));assert.equal(await page.evaluate(()=>__shown.length),1);
      await page.evaluate(async()=>{await RequestPush.clearDevice();await AffiliateAuth.signOut();});
      const loggedOut=await snapshot(page);assert.equal(loggedOut.binding,null);assert.equal(loggedOut.subscription,false);assert.equal(loggedOut.revokes,1);
      assert.equal(await page.evaluate(id=>__backendBindings.find(row=>row.id===id).active,current.subscription_id),false);
      await page.evaluate(id=>__emit({...__payload,event_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',subscription_id:id}),current.subscription_id);assert.equal(await page.evaluate(()=>__shown.length),1);
      return{providerDelivery:'local SW handler only',validBindingDisplayed:1,foreignBindingIgnored:true,oldAccountIgnoredAfterSwitch:true,oldAccountIgnoredAfterNewBinding:true,logoutRevokedAndIgnored:true,oldBinding,currentBinding:current,loggedOut,backendRLS:'not retested; RPC ownership simulated, SQL unchanged'};
    }
  };
  try{
    fs.mkdirSync(out,{recursive:true});
    for(const name of selected.length?selected:names){
      const proof={check:name,status:'FAIL',checkedAt:new Date().toISOString(),bundleSha256:sha(bundle),environment:'Chrome mobile viewport; built App/Auth/Push/SW and real IndexedDB; isolated native permission/provider/RPC; external network blocked; no production writes or messages'};
      const firstError=errors.length;
      try{proof.evidence=await checks[name]();assert.deepEqual(errors.slice(firstError),[]);proof.status='PASS';}
      catch(error){proof.error=error.stack;throw error;}
      finally{proof.browserErrors=errors.slice(firstError);fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({check:name,status:proof.status}));}
    }
  }finally{for(const context of contexts)await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
