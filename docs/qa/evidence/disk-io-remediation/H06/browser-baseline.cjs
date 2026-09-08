'use strict';
const fs=require('fs'),crypto=require('crypto'),{chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core'),a=require('./audit.cjs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),e=a.env();
  await page.goto('https://david14081982.github.io/SutiApp-private/',{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(e.H005_TEST_EMAIL);await page.locator('input[type=password]').fill(e.H005_TEST_PASSWORD);await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>window.AffiliateAuth?.getState().phase==='authenticated',null,{timeout:45000});
  const rows=await page.evaluate(async()=>{
   const original=window.fetch,metrics=[];let current=null;
   window.fetch=async(...args)=>{const start=performance.now(),r=await original(...args);if(current){const u=String(args[0]?.url||args[0]),kind=u.includes('/rest/v1/')?'query':u.includes('/storage/v1/object/sign/')?'sign':u.includes('/functions/v1/')?'edge':null;if(kind){const body=await r.clone().text();let objects=0;try{const j=JSON.parse(body);objects=Array.isArray(j)?j.length:0;}catch(_){}metrics.push({label:current,kind,http:r.status,bytes:new TextEncoder().encode(body).length,objects,ms:performance.now()-start});}}return r;};
   try{const out=[];for(const admin of [false,true]){current=admin?'admin':'affiliate';const start=performance.now(),items=await ProgramCatalogRepository.listItems({admin}),payload=items.map(({imagenes,imagenAssets,...item})=>({...item,imageCount:imagenes.length,imagenAssets:imagenAssets.map(({url,...asset})=>asset)}));out.push({label:current,ms:performance.now()-start,items:items.length,links:items.reduce((n,x)=>n+x.imagenAssets.length,0),images:items.reduce((n,x)=>n+x.imagenes.length,0),payload});}return{out,metrics};}finally{window.fetch=original;}
  });
  const summaries=rows.out.map(x=>({label:x.label,ms:x.ms,items:x.items,links:x.links,images:x.images,payload_sha256:hash(x.payload),programs:[...new Set(x.payload.map(p=>p.program_key))].map(k=>({key:k,items:x.payload.filter(p=>p.program_key===k).length,sha256:hash(x.payload.filter(p=>p.program_key===k))}))}));
  // Payload stays in process memory; evidence contains only aggregate counts and hashes.
  a.save('browser-before',{at:new Date().toISOString(),source:'published H05',summaries,metrics:rows.metrics});console.log(JSON.stringify({summaries,metrics:rows.metrics}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message.replace(/https?:\/\/\S+/g,'[url]'));process.exitCode=1;});
