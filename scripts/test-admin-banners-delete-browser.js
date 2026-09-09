'use strict';
// Isolated browser fixtures exercise the real compiled module. No production writes.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert').strict;
const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/admin-banners-delete-20260908');
async function main(){
 const proof={status:'FAIL',environment:'ISOLATED_BROWSER_WITH_COMPILED_MODULE',checks:{},productionWrites:0,errors:[]};let browser,server;
 try{
  const html=fs.readFileSync(path.join(root,'SutiApp.html'),'utf8'),styles=html.match(/<style[^>]*>[\s\S]*?<\/style>/g).join('\n');
  server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1)));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:950}});page.on('pageerror',e=>proof.errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.setContent('<!doctype html><html><head>'+styles+'</head><body><div id="fixture"></div></body></html>');
  await page.addScriptTag({url:base+'/app/vendor/react-18.3.1/react.production.min.js'});await page.addScriptTag({url:base+'/app/vendor/react-dom-18.3.1/react-dom.production.min.js'});
  // Extract the exact compiled IIFE; avoids running unrelated app/Auth bootstrap.
  const bundle=fs.readFileSync(path.join(root,'app/bundle.js'),'utf8');const chunk=bundle.split('/* @@file screens-admin-visual-crud.jsx */')[1].split('/* @@file ')[0];assert(chunk.includes('archive_admin_banner'));
  await page.evaluate(()=>{window.Icon=()=>React.createElement('span');window.SectionResponsibilityPanel=()=>null;window.EmptyState=({title})=>React.createElement('p',null,title);});
  await page.addScriptTag({content:chunk});
  await page.evaluate(()=>{
   window.fixture={allowed:true,calls:0,refreshes:0,mode:'success',toasts:[],rows:[{id:'active',title:'Campaña activa',enabled:true,record_origin:'HISTORICAL_IMPORT',image_url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#90002b"/></svg>')},{id:'inactive',title:'',enabled:false,record_origin:'HISTORICAL_IMPORT'}]};
   window.AdminRepository={has:p=>p==='banners.delete'?fixture.allowed:true,listManaged:async()=>fixture.rows};
   window.SutiSupabase={getClient:()=>({rpc:async(name,p)=>{if(name!=='archive_admin_banner')throw Error('Unexpected RPC');fixture.calls++;await new Promise(r=>fixture.resolve=r);if(fixture.mode==='error')return {error:{message:'Private backend error'}};fixture.rows=fixture.rows.filter(x=>x.id!==p.p_banner_id);return {data:{id:p.p_banner_id,deleted:true}};}})};
   window.mount=()=>{if(window.fixtureRoot)fixtureRoot.unmount();fixtureRoot=ReactDOM.createRoot(document.getElementById('fixture'));fixtureRoot.render(React.createElement(VisualCrudModule,{kind:'banners',app:{toast:m=>fixture.toasts.push(m),visual:{retry:async()=>{fixture.refreshes++;fixture.public=fixture.rows.filter(x=>x.enabled);}}},header:({title})=>React.createElement('h1',null,title)}));};mount();
  });
  const row=id=>page.locator('[data-h009-id='+id+']'),dialog=page.getByRole('dialog');
  await row('active').waitFor();assert.equal(await row('active').getByRole('button').count(),5);assert.equal(await row('inactive').getByRole('button').count(),5);
  await row('active').getByRole('button',{name:'Eliminar banner'}).click();await dialog.waitFor();assert.equal(await dialog.getByRole('heading').innerText(),'¿Eliminar banner?');assert.equal(await dialog.locator('#banner-delete-message').innerText(),'Esta acción eliminará el banner de la aplicación.');assert(await dialog.getByAltText('Miniatura del banner').isVisible());assert(await dialog.getByText('ACTIVO',{exact:true}).isVisible());
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Cancelar');await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>document.activeElement.closest('dialog')!==null));await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>fixture.calls),0);proof.checks.modalAndKeyboard='PASS';
  await row('inactive').getByRole('button',{name:'Eliminar banner'}).click();assert(await dialog.getByText('Sin título',{exact:true}).isVisible());assert(await dialog.getByText('INACTIVO',{exact:true}).isVisible());await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.evaluate(()=>fixture.calls),0);proof.checks.cancel='PASS';
  await row('active').getByRole('button',{name:'Eliminar banner'}).click();await page.evaluate(()=>{fixture.mode='error';const b=document.querySelector('[data-banner-delete-confirm]');b.click();b.click();});
  await page.waitForFunction(()=>fixture.calls===1);assert(await row('active').isVisible());assert(await dialog.getByRole('button',{name:'Cancelar'}).isDisabled());await page.keyboard.press('Escape');assert(await dialog.isVisible());await page.evaluate(()=>fixture.resolve());await dialog.getByRole('alert').waitFor();assert(await row('active').isVisible());assert.equal(await page.evaluate(()=>fixture.refreshes),0);assert(!await dialog.innerText().then(s=>s.includes('Private backend error')));proof.checks.backendFailureRetainsCard='PASS';proof.checks.doubleClick='PASS';
  fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'error-desktop.png')});
  await page.evaluate(()=>fixture.mode='success');await dialog.getByRole('button',{name:'Eliminar banner',exact:true}).click();await page.waitForFunction(()=>fixture.calls===2);await page.evaluate(()=>fixture.resolve());await row('active').waitFor({state:'detached'});await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>fixture.public.length),0);proof.checks.activeDeleteAndPublicRefresh='PASS';
  await page.setViewportSize({width:390,height:844});await row('inactive').getByRole('button',{name:'Eliminar banner'}).click();await page.screenshot({path:path.join(out,'modal-mobile.png')});const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=390);await dialog.getByRole('button',{name:'Eliminar banner',exact:true}).click();await page.waitForFunction(()=>fixture.calls===3);await page.evaluate(()=>fixture.resolve());await row('inactive').waitFor({state:'detached'});assert(await page.getByText('Sin banners',{exact:true}).isVisible());proof.checks.inactiveDeleteAndEmpty='PASS';
  await page.evaluate(()=>{fixture.rows=[{id:'active',title:'Campaña activa',enabled:true,record_origin:'HISTORICAL_IMPORT'}];fixture.allowed=false;mount();});await row('active').waitFor();assert.equal(await page.getByRole('button',{name:'Eliminar banner'}).count(),0);proof.checks.noDeletePermission='DENIED';
  await page.evaluate(()=>{fixture.allowed=true;mount();});await row('active').getByRole('button',{name:'Eliminar banner'}).click();await page.evaluate(()=>fixture.allowed=false);await dialog.getByRole('button',{name:'Eliminar banner',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>fixture.calls),3);proof.checks.permissionRevokedWhileOpen='DENIED';
  assert.deepEqual(proof.errors,[]);proof.status='PASS';
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
