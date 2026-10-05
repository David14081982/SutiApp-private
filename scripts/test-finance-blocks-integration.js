'use strict';
// Preserve the existing request workbench regression, with the new read-only restriction RPC fixture.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const file=path.join(__dirname,'test-admin-finance-queue-identity-browser.js');
let source=fs.readFileSync(file,'utf8').replaceAll('finance-queue-identity-20260909','finance-blocks/integration');
const anchor="    await page.addScriptTag({ content: generatedDocuments });";
// Published queue fixtures predate document/SICOF dependencies. Supply them in this isolated wrapper.
if(!source.includes(anchor)){
 const declaration="const out = path.join(root,";
 assert(source.includes(declaration),'QUEUE_FIXTURE_OUTPUT_ANCHOR');
 source=source.replace(declaration,"const generatedDocuments = read('app/bundle.js').split(/(?=\\/\\* @@file )/).find(chunk => chunk.startsWith('/* @@file screens-admin-document-generation.jsx */'));\nif (!generatedDocuments) throw Error('Missing compiled real GeneratedDocuments component');\n"+declaration);
 const admin="      window.AdminRepository =";
 assert(source.includes(admin),'QUEUE_FIXTURE_ADMIN_ANCHOR');
 source=source.replace(admin,"      window.DocumentGenerationRepository = { context: () => 'synthetic-documents', list: async () => [] };\n      window.SicofRepository = { getBehavior: async () => ({ status: 'NO_HISTORY', label: 'Sin historial', loans: [], observed_at: null }) };\n"+admin);
 const dependencies="    for (const file of ['app/private-resource-demand.js', 'app/admin-finance-queue-repository.js', 'app/screens-admin-finanzas.jsx']) {";
 assert(source.includes(dependencies),'QUEUE_FIXTURE_DEPENDENCY_ANCHOR');
 source=source.replace(dependencies,anchor+"\n"+dependencies.replace("'app/screens-admin-finanzas.jsx'","'app/sicof-payment-behavior.jsx', 'app/screens-admin-finanzas.jsx'"));
}
assert(source.includes(anchor));
source=source.replace(anchor,`await page.evaluate(()=>{window.SutiSupabase={getClient:()=>({rpc:async name=>{if(name==='list_admin_finance_blocks')return {data:[]};throw Error('Unexpected fixture RPC '+name);}})};});
    for(const file of ['app/finance-blocks-repository.js','app/finance-blocks.jsx'])await page.addScriptTag({content:read(file)});
${anchor}`);
const assertion="await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0);";
assert(source.includes(assertion));
source=source.replace(assertion,"await page.locator('[data-finance-block-control]').waitFor(); await page.getByText('No hay bloqueos registrados.').waitFor(); "+assertion);
const fixture=new(require('module'))(file,module);fixture.filename=file;fixture.paths=module.paths;fixture._compile(source,file);
