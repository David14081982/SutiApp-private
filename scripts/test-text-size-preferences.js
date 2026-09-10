'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict;
const {root,chromium}=require('./test-text-size-helpers');
const out=path.join(root,'docs/qa/evidence/text-size-20260909');
(async()=>{
 let user={id:'a',user_metadata:{other_setting:'preserved'}},calls=[],readError=false,writeError=false;
 const client={auth:{getUser:async()=>readError?{error:Error('offline')}:{data:{user:structuredClone(user)}},updateUser:async payload=>{calls.push(payload);if(writeError)return {error:Error('offline')};user.user_metadata={...user.user_metadata,...payload.data};return {data:{user:structuredClone(user)}};}}};
 const window={SutiSupabase:{getClient:()=>client}},context={window};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'app/text-size-preferences.js'),'utf8'),context);
 const api=window.TextSizePreferences;assert.equal(await api.read('a'),'normal');for(const size of ['large','largest','normal']){assert.equal(await api.write('a',size),size);assert.equal(await api.read('a'),size);assert.equal(user.user_metadata.other_setting,'preserved');}
 await assert.rejects(()=>api.write('a','huge'));const before=calls.length;await assert.rejects(()=>api.write('b','large'));assert.equal(calls.length,before);await assert.rejects(()=>api.read('b'));
 readError=true;await assert.rejects(()=>api.read('a'));readError=false;writeError=true;await assert.rejects(()=>api.write('a','large'));assert.equal(user.user_metadata.sutiapp_text_size,'normal');writeError=false;
 user.user_metadata.sutiapp_text_size='invalid';await assert.rejects(()=>api.read('a'));assert.equal(await api.write('a','large'),'large');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage();await page.setContent('<div id="root"></div>');for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{window.__saved='normal';window.__fail=false;window.__writes=[];window.SutiSupabase={getClient:()=>({auth:{getUser:async()=>({data:{user:{id:'a',user_metadata:{sutiapp_text_size:__saved}}}}),updateUser:async p=>{__writes.push(p);await new Promise(r=>window.__resolveSave=r);if(__fail)return {error:Error('offline')};__saved=p.data.sutiapp_text_size;return {data:{user:{id:'a',user_metadata:{sutiapp_text_size:__saved}}}};}}})};window.Btn=p=>React.createElement('button',{onClick:p.onClick},p.children);});
  await page.addScriptTag({path:path.join(root,'app/text-size-preferences.js')});
  await page.evaluate(()=>{function Harness(){const p=useTextSizePreference('a');return React.createElement('main',{'data-text-size':p.value},React.createElement(TextSizeSettings,{preference:p}));}window.__root=ReactDOM.createRoot(document.getElementById('root'));__root.render(React.createElement(Harness));});
  await page.getByRole('radio',{name:'Grande',exact:true}).check();await page.waitForFunction(()=>document.querySelector('main').dataset.textSize==='large');assert.equal(await page.getByRole('status').innerText(),'Guardando tu preferencia…');await page.evaluate(()=>__resolveSave());await page.getByText('Tamaño de texto guardado.',{exact:true}).waitFor();
  await page.evaluate(()=>window.__fail=true);await page.getByRole('radio',{name:'Muy grande',exact:true}).check();await page.waitForFunction(()=>document.querySelector('main').dataset.textSize==='largest');await page.evaluate(()=>__resolveSave());await page.getByRole('alert').waitFor();assert.equal(await page.locator('main').getAttribute('data-text-size'),'large');assert.equal(await page.evaluate(()=>__saved),'large');
  await page.evaluate(()=>window.__fail=false);await page.getByRole('radio',{name:'Muy grande',exact:true}).check();await page.evaluate(()=>__resolveSave());await page.getByText('Tamaño de texto guardado.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>__saved),'largest');
  assert(await page.getByRole('radio',{name:'Muy grande',exact:true}).isChecked());
  const result={status:'PASS',checks:['Remote authority only','Normal when absent','Three allowlisted values','Metadata merge preserves unrelated keys','No target user selector','Cross-principal read/write rejected','Read/write failures propagate','Invalid metadata visible and repairable','Immediate preview during pending save','Failed save rolls back and announces error','Retry succeeds','Native radio selection'],businessWrites:0};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'preferences-unit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
