'use strict';
// Isolated records only. No account, network or financial writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
   await page.setContent('<html lang="es"><body><div id="root"></div></body></html>');
   await page.addStyleTag({content:[...fs.readFileSync(path.join(root,'SutiApp.html'),'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n')});
   for(const file of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js','app/savings-review-admin.jsx'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
   await page.evaluate(()=>{
    window.Icon=()=>null;window.pending={};window.failDetail=false;
    const records=Array.from({length:45},(_,i)=>({id:String(i),folio:'00'+i,sheet:'Ahorro',row:i+2,status:'PENDING',batch_id:'test',identity:{name:'Ahorrador de prueba '+i,match_count:1},issues:[],proposed_balance:100+i}));
    window.reviewDetail=id=>({id,status:'PENDING',version:0,source_sheet:'Ahorro',source_row:+id+2,identity:records[+id].identity,source_data:{A:records[+id].folio,Q:100+(+id)},proposed_data:{},field_defs:[{key:'A',label:'Folio',kind:'text',editable:true},{key:'Q',label:'Saldo (HOY)',kind:'money',editable:true}],raw_source:{},batch:{observed_at:'2026-09-06T20:00:00Z'},history:[]});
    window.SavingsReviewRepository={list:async()=>({records,batches:[],can_write:true,can_review_identity:true}),detail:id=>{if(window.failDetail){window.failDetail=false;return Promise.reject(Error('NETWORK'));}if(window.delayDetail)return new Promise(resolve=>window.pending[id]=resolve);return Promise.resolve(window.reviewDetail(id));}};
    window.uiRoot=ReactDOM.createRoot(document.getElementById('root'));window.uiRoot.render(React.createElement(window.SavingsReviewAdmin));
   });
   await page.getByRole('button',{name:'Revisar 0015 fila 17',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Expediente del ahorrador'});await dialog.waitFor();
   assert((await dialog.boundingBox()).y>=0);assert((await dialog.boundingBox()).y<100);
   await page.getByLabel('Saldo del archivo original',{exact:true}).fill('999');
   page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:/Siguiente ahorrador/}).click();
   assert.match(await dialog.locator('.svr-dialog-head').innerText(),/Ahorrador de prueba 15/);
   assert.equal(await page.getByLabel('Saldo del archivo original',{exact:true}).inputValue(),'999');
   page.once('dialog',d=>d.accept());await page.getByRole('button',{name:/Siguiente ahorrador/}).click();
   await page.getByLabel('Saldo del archivo original',{exact:true}).waitFor();assert.equal(await page.getByLabel('Saldo del archivo original',{exact:true}).inputValue(),'116');
   await page.locator('.svr-detail').evaluate(e=>e.scrollTop=e.scrollHeight);
   await page.getByRole('button',{name:/Anterior ahorrador/}).click();
   assert.equal(await page.locator('.svr-detail').evaluate(e=>e.scrollTop),0);
   // Native modal contains keyboard focus and returns it to the original row.
   await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Revisar 0015 fila 17');
   await page.evaluate(()=>window.failDetail=true);await page.getByRole('button',{name:'Revisar 000 fila 2',exact:true}).click();
   await dialog.getByRole('alert').waitFor();await dialog.getByRole('button',{name:'Reintentar abrir expediente'}).click();await page.getByLabel('Saldo del archivo original',{exact:true}).waitFor();
   await page.evaluate(()=>window.delayDetail=true);await page.getByRole('button',{name:/Siguiente ahorrador/}).click();
   await page.getByRole('button',{name:/Siguiente ahorrador/}).click();
   await page.evaluate(()=>window.pending['2'](window.reviewDetail('2')));await page.getByLabel('Saldo del archivo original',{exact:true}).waitFor();
   await page.evaluate(()=>window.pending['1'](window.reviewDetail('1')));assert.equal(await page.getByLabel('Saldo del archivo original',{exact:true}).inputValue(),'102');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   fs.mkdirSync(path.join(root,'docs/qa/evidence/savings-navigation-20260906'),{recursive:true});
   await page.screenshot({path:path.join(root,`docs/qa/evidence/savings-navigation-20260906/review-${width}.png`)});
   await page.keyboard.press('Escape');
   // Released and in-progress screens use identical focal navigation.
   for(const file of ['app/savings-operations-admin.jsx','app/savings-retirement-admin.jsx','app/savings-yield-admin.jsx','app/screens-admin-savings.jsx'])if(fs.existsSync(path.join(root,file)))await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
   await page.evaluate(w=>{if(w>=1024)document.documentElement.setAttribute('data-admin-desktop','true');},width);
   await page.addStyleTag({content:'#root{height:100dvh;overflow-y:auto}.sava-root{min-height:100%}'});
   await page.evaluate(()=>{window.SavingsAccessAdmin=()=>null;window.delayDetail=false;window.SavingsRepository={getAdminDashboard:async id=>({participants:Array.from({length:25},(_,i)=>({id:String(i),legacy_folio:'00'+i,display_name:'Persona de prueba '+i,total:100+i,legacy_reported_balance:100+i,identity_status:'LINKED',certification_status:'PENDING',current_process:'PROCESS_1'})),kpis:{},history:[]})};window.uiRoot.render(React.createElement(window.SavingsAdminModule,{app:{admin:{has:()=>false}},header:()=>React.createElement('h1',null,'Ahorro')}));});
   await page.locator('[data-savings-admin-tab="summary"]').click();
   await page.evaluate(()=>document.getElementById('root').addEventListener('click',e=>{if(e.target.closest('.sava-person')){window.previousListTop=document.getElementById('root').scrollTop;window.previousInnerListTop=document.querySelector('.sava-list').scrollTop;}},true));
   await page.locator('.sava-person').filter({hasText:'Persona de prueba 12'}).click();
   await page.locator('[data-person-open="true"]').waitFor();
   assert.equal(await page.locator('#root').evaluate(e=>e.scrollTop),0);
   assert.equal(await page.locator('.sava-workbench>aside').isVisible(),false);
   assert.match(await page.locator('.sava-person-heading').innerText(),/Persona de prueba 12/);
   assert((await page.locator('.sava-person-heading').boundingBox()).y<120,JSON.stringify(await page.locator('.sava-person-heading').boundingBox()));
   assert(!/ledger|legacy|PROCESS|Supabase|shadow|backend/.test(await page.locator('.sava-root').innerText()));
   await page.getByRole('button',{name:/Siguiente ahorrador/}).click();assert.match(await page.locator('.sava-person-heading').innerText(),/Persona de prueba 13/);
   await page.screenshot({path:path.join(root,`docs/qa/evidence/savings-navigation-20260906/person-${width}.png`)});
   await page.getByRole('button',{name:/Volver a ahorradores/}).click();assert(await page.locator('.sava-workbench>aside').isVisible());
   await page.waitForFunction(()=>Math.abs(document.getElementById('root').scrollTop-window.previousListTop)<3&&Math.abs(document.querySelector('.sava-list').scrollTop-window.previousInnerListTop)<3);
   assert.equal(await page.locator('.sava-person').count(),25);assert.deepEqual(errors,[]);await page.close();
  }
  const out={status:'PASS',network:'BLOCKED',viewports:[390,1440],checks:['immediate person view','previous/next','preserved list and focus','unsaved changes protected','keyboard containment and Escape','visible failed-load retry','late response cannot cross persons','readable labels','retained sections','mobile without page overflow']};fs.writeFileSync(path.join(root,'docs/qa/evidence/savings-navigation-20260906/browser-result.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
