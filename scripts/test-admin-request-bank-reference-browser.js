'use strict';
// Reuse the actual released modal's isolated fixtures and callback comparisons.
const fs=require('fs'),path=require('path'),vm=require('vm');
const file=path.join(__dirname,'test-admin-request-delete-browser.js');
let source=fs.readFileSync(file,'utf8')
 .replaceAll('admin-request-delete-20260908','admin-request-bank-reference-20260908')
 .replaceAll('ed19f77:','91f3e32:')
 .replace("window.__rows = [base,", "base.deposit_reference={status:'available',bank_name:'Banco de prueba',account_holder:'Titular de prueba',card_number:'4111111111111111',clabe:'012345678901234567'}; window.__rows = [base,")
 .replace("id: 'r2', folio:", "deposit_reference:{status:'not_selected'}, id: 'r2', folio:")
 .replace("assert.deepEqual(await page.locator('.finwb-detail-scroll').textContent(),", "assert.deepEqual(await page.locator('.finwb-detail-scroll').evaluate(e=>{const c=e.cloneNode(true);c.querySelector('[data-financial-bank-reference]').remove();return c.textContent;}),")
 .replace("await before.close(); receipts.push", `await before.close();
    const bank=page.locator('[data-financial-bank-reference]');
    assert.equal(await bank.getAttribute('data-financial-bank-reference'),'available');
    for(const text of ['Banco de prueba','Titular de prueba','4111111111111111','012345678901234567'])assert((await bank.textContent()).includes(text));
    receipts.push({case:'captured bank, holder, card and CLABE displayed distinctly',status:'PASS'});
    receipts.push`)
 .replace("assert.equal(await page.evaluate(() => __calls.length), 0);", `assert.equal(await page.evaluate(() => __calls.length), 0);
    async function refreshReference(reference){
      await page.evaluate(reference=>{__rows[0].deposit_reference=reference;},reference);
      await page.getByRole('button',{name:'Siguiente solicitud',exact:true}).click();
      await page.locator('[data-financial-bank-reference="not_selected"]').waitFor();
      assert(!(await page.locator('[data-financial-detail-person]').textContent()).includes('4111111111111111'),'previous bank leaked during navigation');
      await page.getByRole('button',{name:'Anterior',exact:true}).click();
      await page.locator('[data-financial-bank-reference="'+(reference?.status||'unavailable')+'"]').waitFor();
    }
    for(const status of ['not_recorded','not_selected','forbidden']){
      await refreshReference({status});
      assert.equal(await bank.locator('strong').count(),0);
      assert((await bank.locator('p').textContent()).length>20);
    }
    await refreshReference(null);assert((await bank.textContent()).includes('No fue posible'));
    for(const instrument of ['card_number','clabe']){
      await refreshReference({status:'available',bank_name:'Banco de prueba',[instrument]:instrument==='clabe'?'012345678901234567':'4111111111111111'});
      assert.equal(await bank.locator('strong').count(),2);
      assert((await bank.textContent()).includes(instrument==='clabe'?'CLABE':'Tarjeta'));
      assert(!(await bank.textContent()).includes(instrument==='clabe'?'Tarjeta':'CLABE'));
    }
    receipts.push({case:'no snapshot, no selection, permission denied, absent projection, card-only, CLABE-only, navigation has no stale bank values',status:'PASS'});`);
const fixtureModule=new (require('module'))(file,module);
fixtureModule.filename=file;fixtureModule.paths=module.paths;fixtureModule._compile(source,file);
