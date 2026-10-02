'use strict';
// Reuse isolated React/screen/demand tests; all fixtures remain browser-only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const file=path.join(__dirname,'test-admin-finance-queue-identity-browser.js');
let source=fs.readFileSync(file,'utf8').replaceAll('finance-queue-identity-20260909','finance-request-process-20261002');
source=source.replace("errors.push(error.message)", "(errors.push(error.message),console.error(error.message))");
source=source.replace("window.Icon = () => null;", "window.DocumentGenerationRepository={context:()=> 'synthetic-context',list:async()=>[]}; window.Icon = () => null;");
source=source.replace("for (const file of ['app/private-resource-demand.js'", "await page.addScriptTag({content:read('app/bundle.js').split('/* @@file screens-admin-document-generation.jsx */')[1].split('/* @@file ')[0]});\n    for (const file of ['app/private-resource-demand.js'");
const insertion="await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0);";
assert.equal(source.split(insertion).length,2);
source=source.replace(insertion,`
    const person=page.locator('[data-financial-detail-person]');
    await person.waitFor();
    assert((await person.textContent()).includes('Proceso'));
    assert((await person.textContent()).includes('No registrada'));
    assert(!(await person.textContent()).includes('Contexto'));
    assert(!(await person.textContent()).includes('Solicitud propia'));
    for(const category of ['BASE','CONFIANZA','SUPLENTES_FIJOS','SUPLENTES_VARIABLES','EVENTUALES','JUBILADOS_PENSIONADOS',null]){
      await page.evaluate(category=>{__rows[0].affiliate.financial_employee_category_code=category;__rows[0].impersonation_session_id='synthetic-assisted';__rows[1].affiliate.financial_employee_category_code='CONFIANZA';},category);
      await page.getByRole('button',{name:'Siguiente solicitud',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-financial-detail-person]')?.textContent.includes('María Fernanda López Hernández 1'));
      assert((await person.textContent()).includes('CONFIANZA'));
      await page.getByRole('button',{name:'Anterior',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-financial-detail-person]')?.textContent.includes('María Fernanda López Hernández 0'));
      assert((await person.textContent()).includes(category||'No registrada'));
    }
    await page.evaluate(()=>{__rows[0].affiliate.financial_employee_category_code='SUPLENTES_VARIABLES';});
    await page.getByRole('button',{name:'Siguiente solicitud',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('dialog h2')?.textContent.endsWith('1'));
    await page.getByRole('button',{name:'Anterior',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-financial-detail-person]')?.textContent.includes('SUPLENTES_VARIABLES'));
    for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:667}]){
      await page.setViewportSize(viewport);
      assert(await person.evaluate(e=>e.scrollWidth<=e.clientWidth),'category overflow');
      assert(await page.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),'modal overflow');
      await page.screenshot({path:path.join(out,'process-'+viewport.width+'.png')});
    }
    checks.push({case:'six category codes, explicit absence, assisted request, previous/next and responsive long codes',status:'PASS'});
    ${insertion}
`);
const fixtureModule=new (require('module'))(file,module);fixtureModule.filename=file;fixtureModule.paths=module.paths;fixtureModule._compile(source,file);
