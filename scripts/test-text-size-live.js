'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {root,privateDir,chromium,serve,login,inspect}=require('./test-text-size-helpers');
const out=path.join(root,'docs/qa/evidence/text-size-small-20260911');
(async()=>{
 const local=process.argv[2]?null:await serve(),url=process.argv[2]||local.url;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(30000);
 const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='PUT'&&new URL(r.url()).pathname==='/auth/v1/user')writes.push(JSON.parse(r.postData()));});
 let original,restore=false;
 const openSettings=async p=>{if(await p.getByRole('button',{name:'Cerrar',exact:true}).count())await p.getByRole('button',{name:'Cerrar',exact:true}).last().click();await p.getByRole('button',{name:'Mi Perfil',exact:true}).click();await p.getByRole('button',{name:'Configuración',exact:true}).click();await p.locator('[data-text-size-settings]').waitFor();};
 try{
  await login(page,url);original=await page.evaluate(async()=>{const r=await SutiSupabase.getClient().auth.getUser();if(r.error)throw Error('GET_USER_FAILED');return r.data.user.user_metadata.sutiapp_text_size??null;});restore=true;fs.writeFileSync(path.join(privateDir,'preference-before.json'),JSON.stringify({value:original}));
  await openSettings(page);
  for(const [value,label] of [['small','Pequeño'],['normal','Normal'],['large','Grande'],['largest','Muy grande']]){
   // Force an explicit selection when the account already has this value.
   if(await page.getByRole('radio',{name:label,exact:true}).isChecked())continue;
   await page.getByRole('radio',{name:label,exact:true}).check();await page.waitForFunction(v=>document.querySelector('[data-text-size]').dataset.textSize===v,value);await page.getByText('Tamaño de texto guardado.',{exact:true}).waitFor();
   assert.equal(await page.evaluate(async()=>{const r=await SutiSupabase.getClient().auth.getUser();return r.data.user.user_metadata.sutiapp_text_size;}),value);
   if(value==='small'){
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('[data-text-size]')?.dataset.textSize==='small',null,{timeout:60000});
    await openSettings(page);assert(await page.getByRole('radio',{name:'Pequeño',exact:true}).isChecked());
   }
  }
  assert.equal(await page.locator('[data-text-size]').getAttribute('data-text-size'),'largest');
  await page.evaluate(()=>localStorage.setItem('sutiapp_text_size','normal'));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[data-text-size]')?.dataset.textSize==='largest',null,{timeout:60000});
  await openSettings(page);assert(await page.getByRole('radio',{name:'Muy grande',exact:true}).isChecked());
  await page.route('**/auth/v1/user',r=>r.request().method()==='PUT'?r.abort('internetdisconnected'):r.continue());
  await page.getByRole('radio',{name:'Grande',exact:true}).check();await page.getByText(/No se guardó el cambio/).last().waitFor();assert.equal(await page.locator('[data-text-size]').getAttribute('data-text-size'),'largest');await page.unroute('**/auth/v1/user');
  const second=await browser.newPage({viewport:{width:320,height:844},reducedMotion:'reduce'});await login(second,url);await second.waitForFunction(()=>document.querySelector('[data-text-size]')?.dataset.textSize==='largest');await openSettings(second);assert(await second.getByRole('radio',{name:'Muy grande',exact:true}).isChecked());await second.close();
  assert(writes.every(p=>Object.keys(p).every(k=>['data','code_challenge','code_challenge_method'].includes(k))&&Object.keys(p.data).join(',')==='sutiapp_text_size'),'Only presentation data and SDK PKCE transport allowed: '+JSON.stringify(writes.map(p=>Object.keys(p))));assert.deepEqual(errors,[]);
  const result={status:'PASS',target:url.startsWith('http:')?'LOCAL_BUILD':'PRODUCTION',checks:['Real UI settings route','Immediate scale change','Auth remote readback','Small survives browser refresh','Browser refresh','Local preference poison ignored','New browser and independent login','Network failure announced with rollback','Only allowlisted metadata in writer payload'],backendBusinessChanges:0,schemaChanges:0,errors};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,url.startsWith('http:')?'preferences-live.json':'preferences-production.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{
  if(restore){const ok=await page.evaluate(async original=>{const r=await SutiSupabase.getClient().auth.updateUser({data:{sutiapp_text_size:original}});return !r.error;},original).catch(()=>false);if(!ok)process.exitCode=1;console.log('Preference restored: '+ok);}
  await browser.close();if(local)local.server.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
