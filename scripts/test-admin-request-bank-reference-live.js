'use strict';
// Real login and read-only modal acceptance. No bank values or screenshots in receipts.
const fs=require('fs'),path=require('path');
process.env.SUTIAPP_TEST_ENV_FILE ||= 'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env';
const file=path.join(__dirname,'test-finance-request-detail-modal-live.js');
let source=fs.readFileSync(file,'utf8').replaceAll('bundle.js?v=228','bundle.js?v=231')
 .replace('headless:true,executablePath:',"headless:true,args:['--disable-http2','--disable-quic'],executablePath:")
 .replace('docs/qa/evidence/finance-request-detail-modal-20260908','docs/qa/evidence/admin-request-bank-reference-20260908/live')
 .replace('page.setDefaultTimeout(30000);',"page.setDefaultTimeout(300000);await page.addLocatorHandler(page.getByRole('button',{name:'Ahora no',exact:true}),async button=>button.click());")
 .replace("r=>r.program_id==='prestamo'","r=>r.folio==='SR-2026-000195'")
 .replace("if(url.includes('/functions/v1/document-access'))", "if(url.includes('/functions/v1/request-delete'))result.businessWrites++;if(url.includes('/functions/v1/document-access'))")
 .replace("result.types[kind]=proof;",`const bankProof=await page.evaluate(async id=>{
     const detail=await ProgramRequestRepository.adminFlowDetail(id),reference=detail.deposit_reference;
     const node=document.querySelector('[data-financial-bank-reference]');
     return {status:reference?.status,correctState:node?.getAttribute('data-financial-bank-reference')===reference?.status,exactValues:reference?.status==='available'?['bank_name','account_holder','card_number','clabe'].filter(key=>reference[key]).every(key=>[...node.querySelectorAll('strong')].some(e=>e.textContent===reference[key])):node?.querySelectorAll('strong').length===0};
    },id);
    assert(bankProof.correctState&&bankProof.exactValues,'captured bank projection mismatch');
    if(kind==='loan')assert.equal(bankProof.status,'available');
    result.types[kind]={...proof,bank:bankProof};`)
 .replace('await page.waitForFunction(()=>window.AffiliateAuth',"result.stage='auth';await page.waitForFunction(()=>window.AffiliateAuth")
 .replace('const admin=page.getByRole',"result.stage='admin';const admin=page.getByRole")
 .replace("await page.waitForSelector('[data-financial-queue-row]');","result.stage='queue';await page.waitForSelector('[data-financial-queue-row]');");
const testModule=new(require('module'))(file,module);testModule.filename=file;testModule.paths=module.paths;testModule._compile(source,file);
