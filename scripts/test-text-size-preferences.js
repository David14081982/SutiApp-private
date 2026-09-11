'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict;
const {root,chromium}=require('./test-text-size-helpers');
const out=path.join(root,'docs/qa/evidence/text-size-small-20260911');
(async()=>{
 let user={id:'a',user_metadata:{other_setting:'preserved'}},calls=[],readError=false,writeError=false;
 const client={auth:{getUser:async()=>readError?{error:Error('offline')}:{data:{user:structuredClone(user)}},updateUser:async payload=>{calls.push(payload);if(writeError)return {error:Error('offline')};user.user_metadata={...user.user_metadata,...payload.data};return {data:{user:structuredClone(user)}};}}};
 const window={SutiSupabase:{getClient:()=>client}},context={window};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'app/text-size-preferences.js'),'utf8'),context);
 const api=window.TextSizePreferences;
 assert.deepEqual(Array.from(api.options,o=>[o.value,o.label,o.scale]),[['small','Pequeño',.875],['normal','Normal',1],['large','Grande',1.15],['largest','Muy grande',1.35]]);
 for(const candidate of [null,{}, {user_metadata:{}}, {user_metadata:{sutiapp_text_size:null}}])assert.equal(api.fromUser(candidate),'normal');
 for(const unknown of ['', 'SMALL', 'huge', 0, false, {}, []])assert.throws(()=>api.fromUser({user_metadata:{sutiapp_text_size:unknown}}),/INVALID_TEXT_SIZE/);
 assert.equal(await api.read('a'),'normal');for(const size of ['small','large','largest','normal']){assert.equal(await api.write('a',size),size);assert.equal(await api.read('a'),size);assert.equal(user.user_metadata.other_setting,'preserved');}
 await assert.rejects(()=>api.write('a','huge'));const before=calls.length;await assert.rejects(()=>api.write('b','large'));assert.equal(calls.length,before);await assert.rejects(()=>api.read('b'));
 readError=true;await assert.rejects(()=>api.read('a'));readError=false;writeError=true;await assert.rejects(()=>api.write('a','large'));assert.equal(user.user_metadata.sutiapp_text_size,'normal');writeError=false;
 user.user_metadata.sutiapp_text_size='invalid';await assert.rejects(()=>api.read('a'));assert.equal(await api.write('a','large'),'large');
 const browser=await chromium.launch({executablePath:process.env.SUTIAPP_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage();await page.setContent('<div id="root"></div>');for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{window.__saved='normal';window.__fail=false;window.__writes=[];window.SutiSupabase={getClient:()=>({auth:{getUser:async()=>({data:{user:{id:'a',user_metadata:{sutiapp_text_size:__saved}}}}),updateUser:async p=>{__writes.push(p);await new Promise(r=>window.__resolveSave=r);if(__fail)return {error:Error('offline')};__saved=p.data.sutiapp_text_size;return {data:{user:{id:'a',user_metadata:{sutiapp_text_size:__saved}}}};}}})};window.Btn=p=>React.createElement('button',{onClick:p.onClick},p.children);});
  await page.addScriptTag({path:path.join(root,'app/text-size-preferences.js')});
  await page.evaluate(()=>{function Harness(){const p=useTextSizePreference('a');return React.createElement('main',{'data-text-size':p.value},React.createElement(TextSizeSettings,{preference:p}));}window.__root=ReactDOM.createRoot(document.getElementById('root'));__root.render(React.createElement(Harness));});
  await page.getByRole('radio',{name:'Grande',exact:true}).check();await page.waitForFunction(()=>document.querySelector('main').dataset.textSize==='large');assert.equal(await page.getByRole('status').innerText(),'Guardando tu preferencia…');await page.evaluate(()=>__resolveSave());await page.getByText('Tamaño de texto guardado.',{exact:true}).waitFor();
  await page.evaluate(()=>window.__fail=true);await page.getByRole('radio',{name:'Muy grande',exact:true}).check();await page.waitForFunction(()=>document.querySelector('main').dataset.textSize==='largest');await page.evaluate(()=>__resolveSave());await page.getByRole('alert').waitFor();assert.equal(await page.locator('main').getAttribute('data-text-size'),'large');assert.equal(await page.evaluate(()=>__saved),'large');
  await page.evaluate(()=>window.__fail=false);await page.getByRole('radio',{name:'Muy grande',exact:true}).check();await page.evaluate(()=>__resolveSave());await page.getByText('Tamaño de texto guardado.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>__saved),'largest');
  assert(await page.getByRole('radio',{name:'Muy grande',exact:true}).isChecked());
  const options=[['small','Pequeño'],['normal','Normal'],['large','Grande'],['largest','Muy grande']];
  for(const [prior,label] of options){
   if(!(await page.getByRole('radio',{name:label,exact:true}).isChecked())){
    await page.getByRole('radio',{name:label,exact:true}).check();await page.evaluate(()=>__resolveSave());await page.getByText('Tamaño de texto guardado.',{exact:true}).waitFor();
   }
   for(const [next,nextLabel] of options.filter(([v])=>v!==prior)){
    await page.evaluate(()=>window.__fail=true);
    await page.getByRole('radio',{name:nextLabel,exact:true}).check();
    assert.equal(await page.locator('main').getAttribute('data-text-size'),next,'immediate preview');
    assert(await page.getByRole('radio',{name:label,exact:true}).isDisabled(),'serialize pending choices');
    await page.evaluate(()=>__resolveSave());await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('main').getAttribute('data-text-size'),prior,'rollback for '+prior+' → '+next);
    assert.equal(await page.evaluate(()=>__saved),prior);
    assert(await page.getByRole('radio',{name:label,exact:true}).isChecked());
    await page.evaluate(()=>window.__fail=false);
   }
  }
  const writeCount=await page.evaluate(()=>__writes.length);
  await page.evaluate(()=>{window.__saved='future-size';document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByText(/Esta versión no reconoce/).waitFor();
  assert.equal(await page.evaluate(()=>__writes.length),writeCount,'unknown reads never replace remote preference');
  assert.equal(await page.evaluate(()=>__saved),'future-size');
  await page.getByRole('radio',{name:'Pequeño',exact:true}).check();await page.evaluate(()=>__resolveSave());await page.getByText('Tamaño de texto guardado.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>__saved),'small','explicit user choice repairs unknown metadata');
  const result={status:'PASS',rollbackPairs:12,checks:['Remote authority only','Normal when absent/null','Four ordered allowlisted values and scales','Unknown strings/types rejected','Metadata merge preserves unrelated keys','No target user selector','Cross-principal read/write rejected','Read/write failures propagate','Unknown metadata update message; no automatic remote replacement','Immediate preview during pending save','All 12 failed transitions roll back and announce error','Pending choices serialized','Retry succeeds including small','Native radio selection'],businessWrites:0};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'preferences-unit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
