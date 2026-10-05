'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const dir=path.join(root,'.tmp/finance-blocks/before');
for(const file of ['SutiApp.html','sw.js','scripts/screen-permission-contract.js'])if(!fs.existsSync(path.join(dir,file))){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(dir,file));}
cp.execFileSync(process.execPath,[path.join(root,'scripts/build-bundle.js'),'C:/tmp/babel-standalone-7.29.0.min.js'],{stdio:'pipe'});
const parse=s=>Object.fromEntries(s.split('/* @@file ').slice(1).map(x=>[x.slice(0,x.indexOf(' */')),x]));
const before=parse(read('.tmp/finance-blocks/before/app/bundle.js')),after=parse(read('app/bundle.js'));
const changed=Object.keys(after).filter(k=>before[k]!==after[k]);
assert(changed.every(k=>['finance-blocks-repository.js','finance-blocks.jsx','program-request-repository.js','screens-admin-finanzas.jsx','screens-admin.jsx'].includes(k)),'UNEXPECTED_BUNDLE_CHANGE');
assert(Object.keys(before).every(k=>after[k]),'BUNDLE_MODULE_REMOVED');
const oldHtml=read('.tmp/finance-blocks/before/SutiApp.html'),oldWorker=read('.tmp/finance-blocks/before/sw.js');
const observedFile='docs/qa/evidence/finance-blocks/global-production-retry.txt';
const observedBytes=fs.existsSync(path.join(root,observedFile))?fs.readFileSync(path.join(root,observedFile)):null;
const observed=observedBytes?JSON.parse(observedBytes.toString(observedBytes[0]===255&&observedBytes[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'').trim()):null;
const publishedVersion=Math.max(0,...(observed?.initial?.cache?.cacheNames||[]).map(s=>Number(s.match(/^sutiapp-v(\d+)$/)?.[1]||0)));
const values=[oldHtml,oldWorker],bundleVersion=Math.max(publishedVersion,...values.map(s=>Number(s.match(/app\/bundle\.js\?v=(\d+)/)[1])))+1;
const workerVersion=Math.max(publishedVersion,...values.map(s=>Number(s.match(/sutiapp-v(\d+)|sw\.js\?v=(\d+)/)?.slice(1).find(Boolean)||0)))+1;
const repoVersion=Math.max(publishedVersion,Number(oldHtml.match(/financial-legacy-repository\.js\?v=(\d+)/)[1]))+1;
const normalize=s=>s.replace(/app\/bundle\.js\?v=\d+/g,'BUNDLE').replace(/sw\.js\?v=\d+/g,'WORKER').replace(/sutiapp-v\d+/g,'CACHE').replace(/financial-legacy-repository\.js\?v=\d+/g,'FINANCE_REPO');
for(const [name,old] of [['SutiApp.html',oldHtml],['sw.js',oldWorker]]){assert.equal(normalize(read(name)),normalize(old),'CACHEBUSTER_SOURCE_DRIFT');write(name,old.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+bundleVersion).replace(/sw\.js\?v=\d+/g,'sw.js?v='+workerVersion).replace(/sutiapp-v\d+/g,'sutiapp-v'+workerVersion).replace(/financial-legacy-repository\.js\?v=\d+/g,'financial-legacy-repository.js?v='+repoVersion));}
const evidence={status:'PASS',changedChunks:changed,unrelatedChunksIdentical:true,workerLogicIdentical:true,bundleVersion,workerVersion,repoVersion,bundleSha256:crypto.createHash('sha256').update(read('app/bundle.js')).digest('hex'),productionPublished:false};
write('docs/qa/evidence/finance-blocks/build.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
