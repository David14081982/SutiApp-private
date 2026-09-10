'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert').strict;
const {chromium,webkit}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/popup-dots-single-row-20260909');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const old=f=>cp.execFileSync('git',['show','908846d:'+f],{cwd:root,encoding:'utf8',maxBuffer:8e6});
const popup=source=>'(function(){const {useState,useEffect}=React,I=Icon;'+source.slice(source.indexOf('  function AdminPopup('),source.indexOf('  window.AdminPopup = AdminPopup;'))+'window.AdminPopup=AdminPopup;})();';
async function ready(page,count){
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.locator('h3').waitFor();if(count>1)await page.getByRole('slider').waitFor();
 await page.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Cerrar"]');if(!b)return false;const s=getComputedStyle(b.parentElement);return s.opacity==='1'&&s.transform==='matrix(1, 0, 0, 1, 0, 0)';});
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const results=[],errors=[];let baseline;
 for(const [engine,type,opts]of [['chromium',chromium,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}],['webkit',webkit,{}]]){
  const browser=await type.launch({headless:true,...opts});
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
   await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+read('SutiApp.html').match(/<style>([\s\S]*?)<\/style>/)[1]+'</style><style id="text-css">'+old('app/text-size.css')+'</style><div id="root"></div>');
   for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/icons.jsx','app/ui.jsx'])await page.addScriptTag({content:read(f)});
   await page.addScriptTag({content:popup(old('app/admin-store.jsx'))});
   await page.evaluate(()=>{
    window.qaRoot=ReactDOM.createRoot(document.getElementById('root'));window.__popupClosed=0;window.renderQA=(count,size)=>{
     const items=Array.from({length:count},(_,i)=>({id:'fixture-'+i,titulo:'Promocion '+(i+1),contenido:'Beneficios para toda la comunidad.',image_url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="340" height="184"><rect width="340" height="184" fill="#910022"/></svg>'),actionType:'none'}));
     qaRoot.render(React.createElement('div',{'data-text-size':size,style:{position:'absolute',inset:0}},React.createElement(AdminPopup,{key:count+'-'+size,items,onClose:()=>window.__popupClosed++})));
    };
   });
   if(engine==='chromium'){
    await page.evaluate(()=>renderQA(7,'normal'));await page.locator('button[aria-label="Pop-up 7"]').waitFor();await page.waitForTimeout(350);
    baseline=await page.locator('button[aria-label^="Pop-up "]').evaluateAll(es=>({count:es.length,rows:new Set(es.map(e=>Math.round(e.getBoundingClientRect().top))).size}));assert.equal(baseline.rows,2);
   }
   await page.addScriptTag({content:popup(read('app/admin-store.jsx'))});await page.locator('#text-css').evaluate((e,css)=>e.textContent=css,read('app/text-size.css'));
   for(const width of [320,390,430])for(const size of ['normal','large','largest'])for(const count of [1,2,5,7,10]){
    await page.setViewportSize({width,height:844});await page.evaluate(({count,size})=>renderQA(count,size),{count,size});await ready(page,count);
    assert.equal(await page.locator('[data-popup-dot]').count(),count>1?count:0);
    if(count>1){
     const slider=page.getByRole('slider',{name:'Elegir imagen del carrusel'});const box=await slider.boundingBox();assert(box.width>=48&&box.height>=48);
     const markers=await page.locator('[data-popup-dot]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),a=getComputedStyle(e,'::after');return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,markWidth:parseFloat(a.width),markHeight:parseFloat(a.height)};}));
     assert.equal(new Set(markers.map(m=>Math.round(m.y))).size,1,'markers wrapped');
     for(const m of markers){assert(m.left>=box.x-.5&&m.right<=box.x+box.width+.5);assert(m.markWidth<=m.right-m.left+.5);assert.equal(m.markHeight,8);}
     for(const name of ['Anterior','Siguiente']){const b=await page.getByRole('button',{name,exact:true}).boundingBox();assert(b.width>=48&&b.height>=48);assert(b.x+b.width<=box.x+.5||b.x>=box.x+box.width-.5,'arrow/selector targets overlap');}
     for(let i=0;i<count;i++){
      await page.mouse.click(markers[i].x,markers[i].y);assert.equal(await slider.inputValue(),String(i+1),JSON.stringify({engine,width,size,count,marker:i+1}));
      assert.equal(await page.locator('[data-active="true"]').getAttribute('data-popup-dot'),String(i+1));assert.equal(await page.locator('h3').innerText(),'Promocion '+(i+1));
     }
     await slider.press('Home');assert.equal(await slider.inputValue(),'1');await slider.press('ArrowRight');assert.equal(await slider.inputValue(),'2');await slider.press('End');assert.equal(await slider.inputValue(),String(count));
     assert((await slider.getAttribute('aria-valuetext')).startsWith(count+' de '+count+':'));
     await page.getByRole('button',{name:'Siguiente',exact:true}).click();assert.equal(await slider.inputValue(),'1');await page.getByRole('button',{name:'Anterior',exact:true}).click();assert.equal(await slider.inputValue(),String(count));
     // A real touch gesture selects the first image, not just mouse/keyboard input.
     await page.touchscreen.tap(markers[0].x,markers[0].y);await page.waitForFunction(()=>document.querySelector('.su-popup-pagination input').value==='1');
     await page.mouse.move(markers[0].x,markers[0].y);await page.mouse.down();await page.mouse.move(markers[count-1].x,markers[count-1].y,{steps:4});await page.mouse.up();await page.waitForFunction(n=>document.querySelector('.su-popup-pagination input').value===String(n),count,{timeout:2000});
     await page.touchscreen.tap(markers[0].x,markers[0].y);
     if(width===390&&size==='normal'&&count===7){await page.waitForTimeout(300);await page.screenshot({path:path.join(out,engine+'-7-dots.png')});}
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('.su-popup-pagination').evaluateAll(es=>es.some(e=>e.scrollWidth>e.clientWidth+1)),false);
    results.push({engine,width,size,count,status:'PASS'});
   }
   await page.evaluate(()=>renderQA(7,'normal'));await ready(page,7);const slider=page.getByRole('slider');await slider.focus();await slider.press('ArrowRight');await slider.press('Home');assert.equal(await page.locator('.su-popup-pagination').evaluate(e=>getComputedStyle(e).outlineStyle),'solid','keyboard focus must be visible');await page.mouse.move(0,0);await page.waitForTimeout(5350);assert.equal(await slider.inputValue(),'1','autoplay must pause for keyboard focus');await slider.blur();await page.waitForTimeout(5350);assert.equal(await slider.inputValue(),'2','autoplay resumes after focus leaves');
   await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__popupClosed),1);
   await page.evaluate(()=>renderQA(2,'large'));await ready(page,2);await page.getByRole('button',{name:'Ahora no',exact:true}).click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__popupClosed),2);
   console.log(engine+' PASS');
  }finally{await browser.close();}
 }
 assert.deepEqual(errors,[]);const result={status:'PASS',baseline,scenarios:results.length,results,markers:'ONE_ROW',selection:'MOUSE_TOUCH_KEYBOARD_PASS',minimumSelectorAndArrowTarget:48,focusPauseAndAutoplay:'PASS',ctaDismissal:'PASS',businessWrites:0,backendRequests:0,errors};fs.writeFileSync(path.join(out,'focal.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',scenarios:results.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
