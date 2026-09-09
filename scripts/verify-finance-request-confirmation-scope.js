'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto'),vm=require('vm');
const root=path.resolve(__dirname,'..'),backup='C:/tmp/sutiapp-confirmation-ux-20260908';
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
const before=fs.readFileSync(path.join(backup,'screens-admin-finanzas.jsx'),'utf8').replace(/\r\n/g,'\n'),after=read('app/screens-admin-finanzas.jsx');
for(const [start,end] of [
 ['  function useFinancialDocumentPreviews(', '  function RequestBankReference('],
 ['    const renderConditions =','    const renderNavigation ='],
 ["        h('div', { className: 'finwb-detail-scroll' },", "        h('div', { className: 'finwb-actionbar'"],
 ['      const adminAction =', '        const refreshed ='],
 ['    const deleteRequest =', '    const onKeyDown ='],
 ['    const actionOptions =', '    const clearFilters =']
]){
 const extract=s=>{assert(s.includes(start)&&s.includes(end),start);return s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));};
 assert.equal(extract(after),extract(before),'Protected section changed: '+start);
}
const source=read('app/app.jsx'),original=fs.readFileSync(path.join(backup,'app.jsx'),'utf8').replace(/\r\n/g,'\n');
assert.equal(source.slice(source.indexOf('  // ---------- PERFIL')),original.slice(original.indexOf('  // ---------- PERFIL')),'routing/auth/profile changed');
for(const file of ['app/screens-admin-finanzas.jsx','app/screens-historial.jsx','app/request-notifications.js','app/app.jsx']){
 const text=read(file);new vm.Script(text,{filename:file});assert(!/SUPABASE_SERVICE_ROLE_KEY|service_role_key|localStorage|sessionStorage/.test(text),file+' has alternate persistence/secret');
}
const chunks=s=>new Map(s.split(/(?=\/\* @@file )/).filter(Boolean).map(chunk=>[chunk.match(/^\/\* @@file (.*?) \*\//)[1],chunk]));
const oldChunks=chunks(fs.readFileSync(path.join(backup,'bundle.js'),'utf8').replace(/\r\n/g,'\n')),newChunks=chunks(read('app/bundle.js'));
const changed=[...newChunks].filter(([name,text])=>oldChunks.get(name)!==text).map(([name])=>name);
const allowed=new Set(['screens-admin-finanzas.jsx','screens-historial.jsx','request-notifications.js','app.jsx']);
assert(changed.every(name=>allowed.has(name)),'Unexpected bundle modules: '+changed.filter(name=>!allowed.has(name)).join(','));
new vm.Script(read('app/bundle.js'));
const proof={status:'PASS',protectedSections:6,workflowCallsUnchanged:true,routingAndAuthUnchanged:true,browserStorageFallbacks:0,changedBundleModules:changed,bundleSha256:crypto.createHash('sha256').update(read('app/bundle.js')).digest('hex')};
fs.writeFileSync(path.join(root,'docs/qa/evidence/finance-request-confirmation-20260908/scope.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
