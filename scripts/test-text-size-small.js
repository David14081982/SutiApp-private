'use strict';
// Isolated presentation/compatibility checks; no Auth or business backend.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),assert=require('assert').strict;
const {root,chromium}=require('./test-text-size-helpers');
const out=path.join(root,'docs/qa/evidence/text-size-small-20260911');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),base=process.env.SUTIAPP_TEXT_SIZE_BASE||'2aa05b9';
const old=f=>cp.execFileSync('git',['show',base+':'+f],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}).replace(/\r\n/g,'\n');
const near=(a,b,label)=>assert(Math.abs(a-b)<.06,label+': '+a+' != '+b);
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const css=read('app/text-size.css'),html=read('SutiApp.html'),sw=read('sw.js');
 assert(!css.includes(':not([data-text-size="normal"])'));
 const normalize=s=>s.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=VERSION').replace(/app\/text-size\.css\?v=\d+/g,'app/text-size.css?v=VERSION').replace(/sw\.js\?v=\d+/g,'sw.js?v=VERSION').replace(/sutiapp-v\d+/g,'sutiapp-vVERSION').replace(/\r\n/g,'\n');
 assert.equal(normalize(sw),normalize(old('sw.js')),'SW logic unchanged');
 assert.equal(normalize(html),normalize(old('SutiApp.html')),'shell logic unchanged');
 for(const pattern of [/app\/bundle\.js\?v=\d+/,/app\/text-size\.css\?v=\d+/])assert(sw.includes(html.match(pattern)[0]));
 assert(!/(localStorage|sessionStorage|indexedDB|service_role)/.test(read('app/text-size-preferences.js')));
 const prior={window:{}};vm.createContext(prior);vm.runInContext(old('app/text-size-preferences.js'),prior);
 assert.throws(()=>prior.window.TextSizePreferences.fromUser({user_metadata:{sutiapp_text_size:'small'}}),/INVALID_TEXT_SIZE/,'old-client incompatibility reproduced');
 const bundle=read('app/bundle.js'),priorBundle=old('app/bundle.js');
 const chunks=s=>new Map(s.split('/* @@file ').slice(1).map(c=>[c.slice(0,c.indexOf(' */')),c.replace(/\r\n/g,'\n')]));
 const before=chunks(priorBundle),after=chunks(bundle),changed=[...after].filter(([f,s])=>s!==before.get(f)).map(([f])=>f);
 assert.deepEqual(changed,['text-size-preferences.js'],'only focal module regenerated in bundle');
 const browser=await chromium.launch({executablePath:process.env.SUTIAPP_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const measurements=[],parity=[];
 try{
  const page=await browser.newPage({viewport:{width:320,height:844}});await page.route('**/*',r=>r.abort());
  const tokens=['12','13','16','18','25','32','44'],normal=[14,15,16,18,25,32,44];
  await page.setContent('<style>'+html.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style><style id="typography">'+css+'</style><main data-text-size="normal">'+
   tokens.map((t,i)=>'<div><span data-probe="'+i+'" style="font-size:var(--text-'+t+')">Texto '+normal[i]+'</span></div>').join('')+
   '<button>Solicitar</button><a href="#local">Ver detalle</a><input aria-label="Nombre"><select aria-label="Plazo"><option>24 quincenas</option></select><textarea aria-label="Notas"></textarea><label><input type="radio" name="check">Opción</label><label><input type="checkbox">Acepto</label>'+
   '<div class="su-finance-mini-stats" style="display:flex"><div>Capital</div><div style="width:1px"> </div><div>Interés</div></div>'+
   '<div data-finance-summary-actions style="display:grid;grid-template-columns:1fr 1fr"><button>Solicitar</button><button>Detalle</button></div>'+
   '<div class="su-tab-heading" style="display:flex"><div>Mi Financiera</div><button>Perfil</button></div>'+
   '<div data-home-financial-chips style="display:flex"><div>Ahorro</div><div>Crédito</div></div>'+
   '<div class="su-catalog-grid"><div>Catálogo</div></div><div class="sav-year-grid"><div>Ahorro</div></div>'+
   '<div data-simulator-result><div style="display:grid;grid-template-columns:1fr 1fr"><span>Simulador</span></div></div>'+
   '<div><button class="su-btn">Solicitar</button><button class="su-btn">Continuar</button></div></main>');
  const metrics=()=>page.evaluate(()=>{
   const m=document.querySelector('main'),q=s=>m.querySelector(s),cs=s=>getComputedStyle(q(s));
   return {text:[...m.querySelectorAll('[data-probe]')].map(e=>({font:parseFloat(getComputedStyle(e).fontSize),line:parseFloat(getComputedStyle(e).lineHeight)})),
    button:parseFloat(cs('button').fontSize),fields:[...m.querySelectorAll('input:not([type]),select,textarea')].map(e=>parseFloat(getComputedStyle(e).fontSize)),
    targets:[...m.querySelectorAll('button,a,label')].map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height];}),
    direction:cs('.su-finance-mini-stats').flexDirection,headingWrap:cs('.su-tab-heading').flexWrap,chipBasis:parseFloat(cs('[data-home-financial-chips] > div').flexBasis),pairBasis:parseFloat(cs('.su-btn').flexBasis),
    styles:[...m.querySelectorAll('*')].map(e=>{const s=getComputedStyle(e);return ['fontSize','lineHeight','padding','borderRadius','boxShadow','minHeight','minWidth','flexDirection','flexBasis','flexWrap','gridTemplateColumns'].map(p=>s[p]);})};
  });
  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});
   for(const size of ['normal','large','largest']){
    await page.locator('main').evaluate((e,size)=>e.dataset.textSize=size,size);
    await page.locator('#typography').evaluate((e,s)=>e.textContent=s,old('app/text-size.css'));const previous=await metrics();
    await page.locator('#typography').evaluate((e,s)=>e.textContent=s,css);const current=await metrics();
    assert.deepEqual(current,previous,'baseline parity '+width+' '+size);parity.push({width,size,status:'PASS'});
   }
   await page.locator('main').evaluate(e=>e.dataset.textSize='small');const small=await metrics();
   small.text.forEach((m,i)=>{near(m.font,normal[i]*.875,'scale');near(m.line/m.font,1.45,'line height');});
   near(small.button,14,'button');small.fields.forEach(f=>near(f,16,'form text'));
   small.targets.forEach(([w,h],i)=>assert(w>=44&&h>=44,'minimum hit target '+i+' '+w+'x'+h));
   assert.equal(small.direction,'row');assert.equal(small.headingWrap,'nowrap');near(small.chipBasis,135*.875,'home chip');near(small.pairBasis,130*.875,'button pair');
   measurements.push({width,normal,small:small.text.map(m=>m.font),formText:small.fields,button:small.button,minimumTarget:Math.min(...small.targets.flat()),lineHeight:1.45});
  }
 }finally{await browser.close();}
 const result={status:'PASS',base,bundleModulesChanged:changed,legacyClientSmall:'INVALID_TEXT_SIZE',swLogicUnchanged:true,appShellLogicUnchanged:true,parity,measurements,backendRequests:0,businessWrites:0};
 fs.writeFileSync(path.join(out,'scale-and-compatibility.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
