'use strict';
const assert=require('assert');
const fs=require('fs');
const read=(file)=>fs.readFileSync(file,'utf8');

assert(!fs.existsSync('app/live-text.jsx'),'live-text source remains');
assert(!fs.existsSync('app/copy-store.jsx'),'copy-store source remains');

const build=read('scripts/build-bundle.js');
const app=read('app/app.jsx');
const roles=read('app/screens-admin-roles.jsx');
const convenios=read('app/screens-convenios.jsx');
const publicRepo=read('app/content-repositories.js');
const adminRepo=read('app/admin-repository.js');
const adminStore=read('app/admin-store.jsx');
const bundle=read('app/bundle.js');
const authority=read('docs/SOURCE_OF_TRUTH.md');
const decisions=read('docs/DECISIONS.md');
const mapping=read('docs/DATA_MAPPING.md');

for(const source of [build,app,roles,convenios,publicRepo,adminRepo,adminStore,bundle]){
  assert(!/TextEditBar|LiveText|copyStore|ManagedCopyRepository/.test(source),'live-copy runtime symbol remains');
}
assert(!/copy-store\.jsx|live-text\.jsx/.test(build),'retired source is still bundled');
assert(!/saveCopy|removeCopy|managed_copy_overrides/.test(publicRepo+adminRepo),'live-copy repository surface remains');
assert(!/Quién puede editar textos|Editar textos · pendiente backend|Edición de textos del frontend/.test(roles+convenios+adminStore),'live-copy UI access remains');
assert(!/@@file copy-store\.jsx|@@file live-text\.jsx|Quién puede editar textos|Editar textos · pendiente backend/.test(bundle),'live-copy bundle artifact remains');
assert(authority.includes('LIVE COPY RETIRED')&&authority.includes('Ninguno desde frontend'),'authority retirement is undocumented');
assert(decisions.includes('ADR-072')&&decisions.includes('Retiro de la edición global de textos'),'owner decision is undocumented');
assert(mapping.includes('LIVE COPY RETIRED')&&mapping.includes('copyStore/LiveText were retired by ADR-072'),'data mapping still marks live copy active');

console.log('Live text removal contract PASS');
