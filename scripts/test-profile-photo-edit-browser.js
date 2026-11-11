'use strict';
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const {serve}=require('./test-admin-user-modules-browser');
const outIndex=process.argv.indexOf('--out');
const out=(outIndex>=0?process.argv[outIndex+1]:'docs/qa/evidence/profile-photo-edit-20260916').replace(/[\\/]?$/,'/');
const checks=[];
async function check(name,test){try{await test();checks.push({name,status:'PASS'});}catch(error){checks.push({name,status:'FAIL',error:error.message});}}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const server=await serve(),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.route('**/profile-fixture',r=>r.fulfill({contentType:'text/html',body:'<html><body><main id="root"></main></body></html>'}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/profile-fixture');
  const html=fs.readFileSync('SutiApp.html','utf8');
  for(const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))await page.addStyleTag({content:m[1]});
  for(const path of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/ui.jsx','app/affiliate-repository.js'])await page.addScriptTag({path});
  const source=fs.readFileSync('app/app.jsx','utf8');
  await page.addScriptTag({content:'const I=window.Icon;'+source.slice(source.indexOf('  function PerfilScreen('),source.indexOf('  // ---------- TOAST'))+'window.TestPerfil=PerfilScreen;'});
  await page.evaluate(()=>{
   window.calls={upload:0,register:0,refresh:0};window.failUpload=false;window.failRegister=false;window.currentPhoto=null;
   window.contextEpoch=1;window.PrivateResourceDemand={context:()=>window.contextEpoch};
   window.toasts=[];window.signCalls=0;
   const affiliate={id:'00000000-0000-4000-8000-000000000001',auth_user_id:'auth-self'};
   const row={id:'00000000-0000-4000-8000-000000000002',affiliate_id:affiliate.id,private_asset_id:'asset-new',storage_bucket:'private-assets',storage_path:'fixture/new.jpg',mime_type:'image/jpeg'};
   const query={select(){return this;},eq(){return this;},order(){return this;},limit:async()=>({data:window.currentPhoto?[row]:[]}),maybeSingle:async()=>({data:affiliate})};
   const client={auth:{getUser:async()=>({data:{user:{id:'auth-self'}}})},from:()=>query,rpc:async(name,args)=>{
    if(name==='get_current_affiliate_access_state')return{data:'ACTIVE'};
    if(name==='get_effective_affiliate_id')return{data:affiliate.id};
    if(name==='get_impersonation_context')return{data:[]};
    if(name==='set_self_profile_photo'){window.calls.register++;if(window.failRegister)return{error:new Error('fixture registration error')};window.currentPhoto=window.uploadedUrl;return{data:row.id};}
    throw Error('Unexpected RPC '+name);
   },storage:{from:()=>({upload:async(path,blob,options)=>{window.calls.upload++;window.uploadDetails={path,size:blob.size,type:blob.type,upsert:options.upsert};if(window.failUpload)return{error:new Error('fixture upload error')};window.uploadedUrl=URL.createObjectURL(blob);return{data:{path}};},createSignedUrl:async()=>{window.signCalls++;return window.failSign?{error:new Error('fixture signing error')}:{data:{signedUrl:window.currentPhoto}};}})}};
   window.AffiliateRepository=window.createAffiliateRepository(()=>client);
   window.testApp={user:{id:affiliate.id,name:'USUARIO DE PRUEBA',email:'prueba@example.invalid',phone:'—',city:'—',unit:'—',position:'—',category:'—',affiliation:'—',status:'Vigente',numeroControl:'QA',seccion:'—'},back(){},setTab(){},push(){},logout(){},toast(message){window.lastToast=message;window.toasts.push(message);}};
   window.testRoot=ReactDOM.createRoot(document.getElementById('root'));
   window.renderProfile=()=>window.testRoot.render(React.createElement(window.TestPerfil,{app:window.testApp}));
   window.AffiliateAuth={refreshContext:async()=>{window.calls.refresh++;if(window.failRefresh)throw Error('synthetic Auth refresh failure');const photo=await window.AffiliateRepository.getProfilePhoto(affiliate.id);window.testApp.user.photoUrl=photo&&photo.signedUrl;window.renderProfile();return{phase:'authenticated',affiliate};}};
   window.renderProfile();
  });
  const button=page.getByRole('button',{name:'Cambiar foto de perfil'});
  await button.waitFor();
  const filechooser=page.waitForEvent('filechooser');await button.click();await filechooser;
  const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=200;const x=c.getContext('2d');x.fillStyle='#902040';x.fillRect(0,0,200,200);return c.toDataURL('image/png').split(',')[1];}),'base64');
  await page.locator('[data-profile-photo-input]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>window.lastToast==='Foto de perfil actualizada');
  await page.locator('[data-profile-photo-consumer=profile] img').waitFor();
  assert.equal(await page.locator('[data-profile-photo-consumer=profile] img').count(),1);
  assert.deepEqual(await page.evaluate(()=>window.calls),{upload:1,register:1,refresh:1});
  assert.equal(await page.evaluate(()=>window.uploadDetails.type),'image/jpeg');
  assert.equal(await page.evaluate(()=>window.uploadDetails.upsert),false);
  assert.equal(await page.evaluate(()=>window.testApp.user.photoUrl===window.currentPhoto),true,'visible photo must come from canonical signing');
  checks.push({name:'existing mobile picker, actual PNG-to-JPEG conversion, private upload, registration and canonical signed photo',status:'PASS'});
  await page.screenshot({path:out+'profile-mobile.png'});
  await page.locator('[data-profile-photo-input]').setInputFiles({name:'wrong.pdf',mimeType:'application/pdf',buffer:Buffer.from('invalid')});
  await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.calls.upload),1);
  await page.evaluate(()=>window.failUpload=true);
  await page.locator('[data-profile-photo-input]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>window.calls.upload===2);await page.waitForFunction(()=>!document.querySelector('[aria-label="Cambiar foto de perfil"]').disabled);
  assert.equal(await page.locator('[data-profile-photo-consumer=profile] img').count(),1);
  assert.equal(await page.evaluate(()=>window.calls.register),1);
  await page.evaluate(()=>{window.failUpload=false;window.failRegister=true;});
  await page.locator('[data-profile-photo-input]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>window.calls.register===2);await page.waitForFunction(()=>!document.querySelector('[aria-label="Cambiar foto de perfil"]').disabled);
  assert.equal(await page.evaluate(()=>window.calls.refresh),1);
  checks.push({name:'invalid type, upload and registration failures remain visible and preserve previous photo',status:'PASS'});
  for(const flag of ['failSign','failRefresh']){
   await check('confirmed write remains success after '+flag,async()=>{
    const previous=await page.evaluate(flag=>{window.failRegister=false;window.failSign=false;window.failRefresh=false;window[flag]=true;window.lastToast='';return{calls:{...window.calls},toasts:window.toasts.length,photo:window.testApp.user.photoUrl};},flag);
    await page.locator('[data-profile-photo-input]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(count=>window.calls.upload===count,previous.calls.upload+1);
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Cambiar foto de perfil"]').disabled);
    assert.equal(await page.evaluate(()=>window.calls.upload),previous.calls.upload+1,'no duplicate upload');
    assert.equal(await page.evaluate(()=>window.calls.register),previous.calls.register+1,'one confirmed registration');
    assert.equal(await page.evaluate(()=>window.toasts.length),previous.toasts+1,'confirmed save must be acknowledged before read/refresh failure');
    assert.match(await page.getByRole('alert').innerText(),/Tu foto se guardó/);
    assert.equal(await page.evaluate(()=>window.testApp.user.photoUrl),previous.photo,'failed refresh must preserve previous visible photo');
   });
  }
  await page.evaluate(()=>{window.failSign=false;window.failRefresh=false;window.lastToast='';});
  await page.locator('[data-profile-photo-input]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>window.lastToast==='Foto de perfil actualizada'&&window.testApp.user.photoUrl===window.currentPhoto);
  checks.push({name:'a subsequent successful canonical read displays the server-confirmed photo',status:'PASS'});
  for(const label of ['Mi credencial digital','Mis documentos','Mis solicitudes','Ayuda y soporte','Configuración','Cerrar sesión'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),1);
  assert.deepEqual(errors,[]);
  checks.push({name:'all existing navigation and profile controls preserved',status:'PASS'});
  const report={status:checks.every(item=>item.status==='PASS')?'PASS':'FAIL',isolation:'Local Chrome, actual React/Perfil/Repository; synthetic Auth/Storage/RPC only. Blob URL is a fixture adapter for the canonical signer, never production code.',checks,errors};
  fs.writeFileSync(out+'browser.json',JSON.stringify(report,null,2));
  console.log('PROFILE PHOTO browser '+report.status+' ('+checks.filter(item=>item.status==='PASS').length+'/'+checks.length+')');
  if(report.status!=='PASS')process.exitCode=1;
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

