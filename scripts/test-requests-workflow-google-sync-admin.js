'use strict';
// Reuse the existing focal modal browser harness, retaining the original fixture and callbacks.
// The only new visible block is the explicitly requested Google delivery status.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert').strict;
const file=path.join(__dirname,'test-finance-request-detail-modal-browser.js');
let source=fs.readFileSync(file,'utf8');
const anchor="assert.deepEqual(await page.locator('.finwb-detail-scroll').textContent(), await before.locator('.finwb-detail-scroll').textContent(), 'all original detail content (layout whitespace excluded)');";
assert(source.includes(anchor),'MODAL_HARNESS_CHANGED');
source=source.replace('docs/qa/evidence/finance-request-detail-modal-20260908','docs/qa/evidence/requests-workflow-google-sync-20260908/admin');
source=source.replace(anchor,"assert.equal(await page.locator('[data-request-google-sync]').count(), 1); assert.equal(await page.locator('.finwb-detail-scroll').evaluate(el => { const copy=el.cloneNode(true); copy.querySelector('[data-request-google-sync]').remove(); return copy.textContent; }), await before.locator('.finwb-detail-scroll').textContent(), 'all original information preserved with Google status added');");
source=source.replace("assert.deepEqual(traces[1], traces[0], 'changed callback or confirmation: ' + action);", "if(action==='approveProduct') traces[0].confirmations=traces[0].confirmations.map(text=>text.replace('No se enviará información a Google.','Se actualizará el estado de esta misma solicitud en Google.')); assert.deepEqual(traces[1], traces[0], 'callback and authorized confirmation: ' + action);");
source=source.replace('identical baseline callback and confirmation','same callback; confirmation follows owner Google contract');
vm.runInNewContext(source,{require,__dirname,console,process,Buffer,setTimeout,clearTimeout},{filename:file});
