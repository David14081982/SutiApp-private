'use strict';
// Reviewable local artifact. No network, Git operation or database application.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const preview=JSON.parse(read('tmp/editorial-preview-latest.json'));
const old=read('app/bundle.js'),built=fs.readFileSync(path.join(preview.source,'app/bundle.js'),'utf8').replace(/\r\n/g,'\n');
const chunks=s=>new Map([...s.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[0]]));
const before=chunks(old),after=chunks(built),selected=new Set(['admin-store.jsx','admin-cutover-store.jsx','screens-admin-content.jsx','screens-home-r2.jsx','app.jsx','editorial-repository.js','editorial-content.jsx']);
assert.equal([...before.values()].join(''),old);assert.equal([...after.values()].join(''),built);
assert.deepEqual([...before.keys()],[...after.keys()].filter(k=>before.has(k)),'EXISTING_CHUNK_ORDER_CHANGED');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),sandbox);
const preserved=[];let result='';
for(const [file,code] of after){
 if(selected.has(file)){result+=code;continue;}
 assert(before.has(file),'UNEXPECTED_NEW_CHUNK:'+file);
 if(before.get(file)!==code)assert.equal(sandbox.Babel.transform(before.get(file),{comments:false}).code,sandbox.Babel.transform(code,{comments:false}).code,'UNDECLARED_SEMANTIC_CHANGE:'+file);
 result+=before.get(file);preserved.push(file);
}
for(const file of before.keys())assert(after.has(file),'REMOVED_CHUNK:'+file);
assert.equal(chunks(result).size,after.size);new vm.Script(result);
let html=read('SutiApp.html'),worker=read('sw.js');
const oldBundle=Math.max(...[...html.matchAll(/app\/bundle\.js\?v=(\d+)/g),...worker.matchAll(/app\/bundle\.js\?v=(\d+)/g)].map(m=>Number(m[1])));
const oldCache=Number(worker.match(/sutiapp-v(\d+)/)[1]);
const version=oldBundle+(result===old?0:1),cache=oldCache+(result===old?0:1);
const nextHtml=html.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+version).replace(/sw\.js\?v=\d+/g,'sw.js?v='+cache);
const nextWorker=worker.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+version).replace(/sutiapp-v\d+/g,'sutiapp-v'+cache);
const normalize=s=>s.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=N').replace(/sutiapp-v\d+/g,'sutiapp-vN');
assert.equal(normalize(worker),normalize(nextWorker));new vm.Script(nextWorker);
fs.writeFileSync(path.join(root,'app/bundle.js'),result);fs.writeFileSync(path.join(root,'SutiApp.html'),nextHtml);fs.writeFileSync(path.join(root,'sw.js'),nextWorker);
assert(path.resolve(preview.site).startsWith(path.join(root,'tmp')+path.sep));
fs.writeFileSync(path.join(preview.site,'app/bundle.js'),result);fs.writeFileSync(path.join(preview.site,'SutiApp.html'),nextHtml);fs.writeFileSync(path.join(preview.site,'index.html'),nextHtml);fs.writeFileSync(path.join(preview.site,'sw.js'),nextWorker);
const sqlFiles=['supabase/migrations/20260924000200_admin_screen_permission_boundaries.sql','supabase/recovery/20260924000200_admin_screen_permission_boundaries_recovery.sql','supabase/migrations/20260924000300_app_editorial_panels.sql','supabase/recovery/20260924000300_app_editorial_panels_recovery.sql'];
const proof={status:'PREPARED_NOT_DEPLOYED',bundleVersion:version,cacheVersion:cache,bundleSha256:sha(result),testedCanonicalSha256:sha(built),canonicalSemanticParity:true,unchangedChunks:preserved.length,changedChunks:[...selected],workerLogicUnchanged:true,sql:Object.fromEntries(sqlFiles.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]))};
fs.writeFileSync(path.join(root,'docs/qa/evidence/screen-permission-fix-20260924/release.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
