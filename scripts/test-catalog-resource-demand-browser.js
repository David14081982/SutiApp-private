'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),results=[];
 try{for(const stage of ['before','after']){
  const page=await browser.newPage({viewport:{width:390,height:420}});
  await page.setContent('<style>.mr-doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mr-doc-tile{height:150px;position:relative}.mr-doc-thumb{width:150px;height:100px}button{max-width:100%}</style><div id="fixture"></div>');
  for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
  await page.evaluate(()=>{
   window.__calls=[];window.__listeners=new Set();window.__auth={phase:'authenticated',session:{user:{id:'isolated-actor'},access_token:'isolated'},affiliate:{id:'isolated-affiliate'}};
   window.AffiliateAuth={getState:()=>__auth,subscribe:fn=>{__listeners.add(fn);return()=>__listeners.delete(fn);}};window.AdminRepository={getState:()=>({phase:'ready',assignment:{role:'affiliate'}}),subscribe:()=>()=>{}};
   window.Icon=()=>React.createElement('span');window.Sheet=()=>null;
   window.DocumentWorkflowRepository={selfPreview:async(doc,purpose)=>{__calls.push({id:doc.id,purpose});const svg='<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>';return{signedUrl:URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),expiresIn:300};}};
  });
  if(stage==='after')await page.addScriptTag({content:read('app/private-resource-demand.js')});
  await page.addScriptTag({content:read('app/image-viewer.jsx')});
  await page.addScriptTag({content:read(stage==='before'?'docs/qa/evidence/disk-io-remediation/H06/before/workspace/screens-documentos.jsx':'app/screens-documentos.jsx')});
  await page.evaluate(()=>{
   const types=Array.from({length:10},(_,i)=>({id:'type-'+i,code:'type-'+i,label:'Fixture '+i,accepted_mime_types:['image/png'],camera_allowed:true,file_upload_allowed:true}));
   window.__types=types;window.__docs=types.map((t,i)=>({id:'document-'+i,document_type_id:t.id,status:i===8?'REJECTED':i===9?'ARCHIVED':'VERIFIED',created_at:'2026-01-01',updated_at:'2026-01-01',available:true,mimeType:'image/png'}));
   window.__variant='tiles';window.__root=ReactDOM.createRoot(document.getElementById('fixture'));
   window.__render=()=>__root.render(React.createElement(DocumentRequirementList,{requirements:__types.map(document_type=>({document_type})),documents:__docs.map(d=>({...d})),variant:__variant,editable:true,onChanged:async()=>{},accessPurpose:'SELF_SERVICE_MEMBERSHIP'}));__render();
  });
  await page.waitForFunction(()=>document.querySelector('.mr-doc-thumb')?.naturalWidth>0);
  const first=await page.evaluate(()=>__calls.length);
  for(let i=0;i<4;i++){await page.evaluate(()=>__render());await page.waitForTimeout(80);}
  const afterRenders=await page.evaluate(()=>__calls.length);
  if(stage==='after')assert.equal(afterRenders,first,'array-reference rerenders must make no requests');else assert(afterRenders>first);
  assert.equal(await page.evaluate(()=>__calls.some(x=>['document-8','document-9'].includes(x.id))),false);
  await page.locator('[data-document-id="document-7"]').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-document-id="document-7"] img')?.naturalWidth>0);
  const afterScroll=await page.evaluate(()=>__calls.length);
  await page.locator('[data-document-id="document-7"] .mr-doc-view').click();await page.waitForSelector('[data-image-viewer="open"]');
  const afterOpen=await page.evaluate(()=>__calls.length);assert.equal(afterOpen,afterScroll+1,'explicit open must authorize again');
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  const beforeList=await page.evaluate(()=>__calls.length);await page.evaluate(()=>{__variant=undefined;__render();});await page.waitForTimeout(150);const listExtra=await page.evaluate(n=>__calls.length-n,beforeList);if(stage==='after')assert.equal(listExtra,0);
  results.push({stage,first,afterFourReferenceRenders:afterRenders,afterScroll,explicitOpen:afterOpen-afterScroll,listExtra,rejectedAndArchived:'DENIED'});
  if(stage==='after'){
   await page.evaluate(()=>{window.scrollTo(0,0);__variant='tiles';__render();});await page.waitForFunction(()=>document.querySelector('.mr-doc-thumb')?.naturalWidth>0);
   await page.clock.install(); // Isolated expiry test; no server or production session.
   // Remount after clock installation so the component timers use the controlled clock.
   await page.evaluate(()=>{__root.unmount();__root=ReactDOM.createRoot(document.getElementById('fixture'));__render();});await page.clock.runFor(100);
   const old=await page.evaluate(()=>({count:__calls.length,url:document.querySelector('.mr-doc-thumb')?.src}));
   await page.clock.fastForward(300100);await page.clock.runFor(100);
   const renewed=await page.evaluate(()=>({count:__calls.length,url:document.querySelector('.mr-doc-thumb')?.src}));assert(renewed.count>old.count);assert.notEqual(renewed.url,old.url);results.push({expiry:'PASS',requests:renewed.count-old.count});
   await page.addScriptTag({content:read('app/screens-catalogo.jsx')});
   await page.evaluate(()=>{
    __root.unmount();__root=ReactDOM.createRoot(document.getElementById('fixture'));window.scrollTo(0,0);window.__imageCalls=0;
    window.ProgramCatalogRepository={resolveImage:async()=>{__imageCalls++;return{signedUrl:URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>'],{type:'image/svg+xml'})),expiresIn:3600};}};
    window.__asset={link_id:'stable-link',resource:{private_asset_id:'asset-a'}};
    window.__renderImage=()=>__root.render(React.createElement(ProgramCatalogImage,{asset:__asset,style:{width:100,height:100}}));__renderImage();
   });await page.clock.runFor(100);await page.waitForFunction(()=>document.querySelector('#fixture img')?.naturalWidth>0);
   assert.equal(await page.evaluate(()=>__imageCalls),1);
   await page.evaluate(()=>document.getElementById('fixture').style.display='none');await page.clock.runFor(100);
   await page.evaluate(()=>document.getElementById('fixture').style.display='block');await page.clock.runFor(100);assert.equal(await page.evaluate(()=>__imageCalls),1,'same mounted intention retains valid URL');
   await page.evaluate(()=>{__asset={link_id:'stable-link',resource:{private_asset_id:'asset-b'}};__renderImage();});await page.clock.runFor(100);assert.equal(await page.evaluate(()=>__imageCalls),2,'changed asset under same link invalidates URL');
   await page.clock.fastForward(3600100);await page.clock.runFor(100);assert.equal(await page.evaluate(()=>__imageCalls),3);results.push({programImageVisibilityReuse:'PASS',assetReplacement:'PASS',programExpiry:'PASS'});
   await page.evaluate(()=>{__auth={phase:'anonymous',session:null};__listeners.forEach(fn=>fn());});await page.clock.runFor(50);assert.equal(await page.locator('#fixture img[src]').count(),0);results.push({logout:'PASS'});
  }
  await page.close();
 }
 console.log(JSON.stringify({status:'PASS',results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
