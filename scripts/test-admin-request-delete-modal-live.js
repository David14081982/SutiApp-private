'use strict';
// Reuse the released modal's focused read-only acceptance; add a real preview and cancel.
const fs=require('fs'),path=require('path'),vm=require('vm');
process.env.SUTIAPP_TEST_ENV_FILE='C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env';
const file=path.join(__dirname,'test-finance-request-detail-modal-live.js');
let source=fs.readFileSync(file,'utf8').replaceAll('bundle.js?v=228','bundle.js?v=230')
 .replace('headless:true,executablePath:',"headless:true,args:['--disable-http2','--disable-quic'],executablePath:")
 .replace('docs/qa/evidence/finance-request-detail-modal-20260908','docs/qa/evidence/admin-request-delete-20260908/modal-live')
 .replace('await page.waitForFunction(()=>window.AffiliateAuth',"result.stage='auth';await page.waitForFunction(()=>window.AffiliateAuth")
 .replace('const admin=page.getByRole',"result.stage='admin';const admin=page.getByRole")
 .replace("await page.waitForSelector('[data-financial-queue-row]');", "result.stage='queue';await page.waitForSelector('[data-financial-queue-row]');")
 .replace('page.setDefaultTimeout(30000);',"page.setDefaultTimeout(300000); await page.addLocatorHandler(page.getByRole('button',{name:'Ahora no',exact:true}), async button=>{await button.click();});")
 .replace("if(url.includes('/functions/v1/document-access'))", "if(url.includes('/functions/v1/request-delete'))result.businessWrites++;if(url.includes('/functions/v1/document-access'))")
 .replace("if(kind==='loan'){",`if(kind==='loan'){
    assert.equal(await page.locator('[data-request-delete]').count(),1);
    let dismissed=false;
    page.once('dialog',async dialog=>{assert.equal(dialog.type(),'confirm');assert(dialog.message().includes('SR-')&&dialog.message().includes('expediente'));await dialog.dismiss();dismissed=true;});
    await page.locator('[data-request-delete]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-request-delete]').disabled);
    assert(dismissed);assert.equal(await page.locator('dialog[open]').count(),1);result.deletePreviewCancelled='PASS';`);
vm.runInNewContext(source,{require,__dirname,console,process,Buffer,setTimeout,clearTimeout},{filename:file});
