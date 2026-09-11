'use strict';
// Actual React/screen/viewer, isolated synthetic records and intercepted writer boundaries.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert').strict;
const {chromium}=require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),out=path.join(root,'docs/qa/evidence/finance-detail-ui-20260909');
async function main(){
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],checks=[];
 try{
  // Reuse the existing real-screen fixture setup, without executing its historical layout assertions.
  const original=read('scripts/test-finance-request-detail-modal-browser.js');
  let setup=original.slice(original.indexOf('    async function fixture('),original.indexOf('    const before = await fixture'));
  setup=setup.replace('c5e3a8f:app/screens-admin-finanzas.jsx','1795be0:app/screens-admin-finanzas.jsx')
   .replace('if (!before) {','if (true) {')
   .replace("for (const file of ['app/private-resource-demand.js', 'app/image-viewer.jsx'])",`await page.evaluate(() => {
     const states=['PENDING_REVIEW','UNDER_REVIEW','VERIFIED','REJECTED','REUPLOAD_REQUIRED'];
     __rows.forEach((r,i)=>{r.affiliate_id='a'+i;r.affiliate={full_name:i?'Carlos Alberto Pérez Ramírez':'MARÍA GUADALUPE FERNÁNDEZ HERNÁNDEZ DE LA CRUZ',display_name:i?'Carlos':'María'};r.nombre=r.affiliate.display_name;r.requested_fund='Fondo de prueba';r.current_affiliate_documents=states.map((status,j)=>({id:'current'+j,affiliate_document_id:'current'+j,mimeType:'image/svg+xml',status,document_type:{label:'Documento '+j}}));});
     window.AdminFinanceQueueRepository={enrich:async rows=>rows.map(r=>({...r,nombre:r.affiliate.full_name}))};
     const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>','<< /Length 0 >>\\nstream\\n\\nendstream'];let pdf='%PDF-1.4\\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\\n'+object+'\\nendobj\\n';});const xref=pdf.length;pdf+='xref\\n0 5\\n0000000000 65535 f \\n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \\n').join('')+'trailer\\n<< /Size 5 /Root 1 0 R >>\\nstartxref\\n'+xref+'\\n%%EOF';
     __rows.forEach(r=>r.current_affiliate_documents[4].mimeType='application/pdf');const originalPreview=DocumentWorkflowRepository.adminPreview;DocumentWorkflowRepository.adminPreview=async id=>id==='current4'?{signedUrl:'data:application/pdf;base64,'+btoa(pdf),expiresIn:300}:originalPreview(id);
     window.__photoReads=[];window.AffiliateRepository={getProfilePhoto:async id=>{__photoReads.push(id);if(id==='a1')return null;return {signedUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#F4E8ED"/><circle cx="30" cy="22" r="12" fill="#916477"/><ellipse cx="30" cy="56" rx="24" ry="20" fill="#916477"/></svg>'),expiresAt:Date.now()+300000};}};
   });
   for (const file of ['app/private-resource-demand.js', 'app/image-viewer.jsx'])`)
   .replace("document.querySelectorAll('.finwb-doc img').length === 9", "document.querySelectorAll('.finwb-doc img').length === 12");
  const fixture=new Function('browser','errors','read','cp','root','assert',setup+';return fixture;')(browser,errors,read,cp,root,assert);
  const content=page=>page.evaluate(()=>[...document.querySelectorAll('.finwb-detail-scroll section.finwb-card')].map(section=>{
   const clone=section.cloneNode(true),title=clone.querySelector('h3').textContent;
   clone.querySelectorAll('.finwb-doc-status').forEach(el=>{el.textContent=(el.textContent.startsWith('Estado al enviar:')?'Estado al enviar: ':'Estado vigente: ')+el.querySelector('[data-financial-document-status]').dataset.financialDocumentStatus;});
   if(section.hasAttribute('data-financial-detail-person'))clone.querySelector('.finwb-kv strong').textContent='[IDENTITY]';
   return {title,text:clone.textContent.replace(/\s+/g,' ').trim()};
  }).sort((a,b)=>a.title.localeCompare(b.title)));
  // 640x389 checks the reflow space of a 1280x778 viewport at 200% browser zoom.
  const viewports=[{width:1395,height:777},{width:1280,height:777},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:320,height:667},{width:844,height:390},{width:640,height:389}];
  for(const variant of ['normal','loan','quote','product','handoff']){
   const before=await fixture(true,variant),page=await fixture(false,variant);
   assert.deepEqual(await content(page),await content(before),'Section content lost: '+variant);await before.close();
   assert.equal(await page.locator('dialog.finwb-modal h2').textContent(),'MARÍA GUADALUPE FERNÁNDEZ HERNÁNDEZ DE LA CRUZ');
   await page.waitForFunction(()=>document.querySelector('[data-financial-detail-photo] img')?.naturalWidth>0);
   assert.equal(await page.locator('[data-financial-document-status]').count(),13);
   for(const state of ['PENDING_REVIEW','UNDER_REVIEW','VERIFIED','REJECTED','REUPLOAD_REQUIRED'])assert(await page.locator('[data-financial-document-status="'+state+'"]').count());
   const states=await page.locator('.finwb-action-fields select option').evaluateAll(options=>options.map(o=>({value:o.value,label:o.textContent})));
   if(variant==='quote')await page.locator('.finwb-action-fields select').selectOption('quoteAdvance');
   if(variant==='handoff')await page.locator('.finwb-action-fields select').selectOption('handoff');
   for(const viewport of viewports){
    await page.setViewportSize(viewport);
    const metrics=await page.evaluate(()=>{
     const modal=document.querySelector('dialog.finwb-modal'),scroll=modal.querySelector('.finwb-detail-scroll'),footer=modal.querySelector('.finwb-actionbar'),header=modal.querySelector('header');
     const before={h:header.getBoundingClientRect().top,f:footer.getBoundingClientRect().top};scroll.scrollTop=scroll.scrollHeight;
     const controls=[...footer.querySelectorAll('button,input,select,textarea')];
     return {overflow:modal.scrollWidth>modal.clientWidth+1||scroll.scrollWidth>scroll.clientWidth+1||document.documentElement.scrollWidth>innerWidth,bodyHeight:scroll.clientHeight,headerHeight:header.clientHeight,footerHeight:footer.clientHeight,fixed:before.h===header.getBoundingClientRect().top&&before.f===footer.getBoundingClientRect().top,controlsVisible:controls.every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth;}),thumbnailFit:[...modal.querySelectorAll('.finwb-doc-preview img')].every(img=>getComputedStyle(img).objectFit==='contain'),photoWidth:modal.querySelector('[data-financial-detail-photo]').clientWidth};
    });
    assert(!metrics.overflow&&metrics.bodyHeight>50&&metrics.fixed&&metrics.controlsVisible&&metrics.thumbnailFit&&metrics.photoWidth>=44,JSON.stringify({variant,viewport,metrics}));checks.push({variant,viewport,...metrics,status:'PASS'});
    if(variant==='loan'&&[1395,390,320].includes(viewport.width)){await page.locator('.finwb-detail-scroll').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,'isolated-'+viewport.width+'.png')});}
   }
   await page.setViewportSize({width:1395,height:777});
   if(variant==='quote'){assert.equal(await page.getByLabel('Monto de la cotización').count(),1);assert.equal(await page.getByLabel('Vigencia de la cotización').count(),1);await page.getByLabel('Monto de la cotización').fill('12500');await page.getByLabel('Vigencia de la cotización').fill('2026-10-01');}
   if(variant==='normal'){
    await page.locator('.finwb-action-fields select').selectOption('note');await page.locator('.finwb-note').fill('Borrador que se conserva');
    await page.getByRole('button',{name:'Cerrar detalle de solicitud'}).click();assert.equal(await page.evaluate(()=>document.activeElement.dataset.financialQueueRow),'r1');
    await page.locator('[data-financial-queue-row="r1"]').click();assert.equal(await page.locator('.finwb-note').inputValue(),'Borrador que se conserva');
    for(let n=0;n<24;n++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('dialog')));}
    await page.getByRole('button',{name:'Ampliar',exact:true}).first().click();await page.locator('[data-image-viewer]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog.finwb-modal[open]').count(),1);
    await page.getByRole('button',{name:'Ver PDF',exact:true}).click();await page.locator('[data-document-viewer]').waitFor();assert((await page.locator('[data-document-viewer] iframe').getAttribute('src')).startsWith('data:application/pdf;base64,'));await page.keyboard.press('Escape');assert.equal(await page.locator('dialog.finwb-modal[open]').count(),1);
    await page.getByRole('button',{name:'Siguiente solicitud',exact:true}).click();await page.getByRole('heading',{name:'Carlos Alberto Pérez Ramírez',exact:true}).waitFor();assert.equal(await page.locator('[data-financial-detail-photo="a1"] img').count(),0);
    await page.getByRole('button',{name:'Anterior',exact:true}).click();await page.getByRole('heading',{name:'MARÍA GUADALUPE FERNÁNDEZ HERNÁNDEZ DE LA CRUZ',exact:true}).waitFor();
    await page.locator('.finwb-action-fields select').selectOption('reject');await page.locator('.finwb-note').fill('');await page.locator('.finwb-actionbar .finwb-primary').click();assert.equal(await page.evaluate(()=>__calls.length),0,'Blank rejection wrote');
    await page.locator('.finwb-note').fill('Motivo de rechazo aislado');await page.locator('.finwb-actionbar .finwb-primary').click();await page.locator('dialog[open]').nth(1).waitFor();assert.equal(await page.evaluate(()=>__calls.length),0,'Confirmation bypassed');await page.keyboard.press('Escape');
    for(const status of ['rejected','cancelled']){await page.evaluate(status=>{__rows[0].status=status;},status);await page.getByRole('button',{name:'Siguiente solicitud',exact:true}).click();await page.getByRole('heading',{name:'Carlos Alberto Pérez Ramírez',exact:true}).waitFor();await page.getByRole('button',{name:'Anterior',exact:true}).click();await page.getByRole('heading',{name:'MARÍA GUADALUPE FERNÁNDEZ HERNÁNDEZ DE LA CRUZ',exact:true}).waitFor();assert.equal(await page.locator('[data-financial-workflow]').count(),1);assert.equal(await page.locator('[data-financial-current-documents]').count(),1);}
   }
   if(variant==='product'){await page.getByText('Ver calendario de 1 descuentos',{exact:true}).click();assert(await page.getByText('2026-09-15',{exact:true}).isVisible());}
   if(variant==='handoff')assert(await page.locator('.finwb-note').isDisabled());
   assert.equal(await page.evaluate(()=>__calls.length),0);checks.push({variant,case:'original section content, actions, specialized fields and zero writes',actions:states,status:'PASS'});await page.close();
  }
  const readonly=await fixture(false,'normal',false);assert.equal(await readonly.locator('.finwb-actionbar .finwb-primary').count(),0);assert.equal(await readonly.locator('[data-request-delete]').count(),0);await readonly.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'PASS',checks,errors,backendConnections:0},null,2)+'\n');console.log(JSON.stringify({status:'PASS',cases:checks.length}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
