'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const out=path.join(root,'docs/qa/evidence/history-snapshot');fs.mkdirSync(out,{recursive:true});
const babel={};vm.createContext(babel);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/sutiapp-babel-7.28.4.min.js','utf8'),babel);
for(const file of ['supabase/functions/loan-history/index.ts','supabase/functions/loan-history-sync/index.ts']){
 babel.Babel.transform(read(file),{presets:[['typescript',{allExtensions:true}]],sourceType:'module'});
 for(const match of read(file).matchAll(/from ['"](\.[^'"]+)['"]/g))assert(fs.existsSync(path.resolve(root,path.dirname(file),match[1])),'MISSING_IMPORT');
}
assert(!/readHistorySource|readHistorySnapshotSource|GOOGLE_REQUEST/.test(read('supabase/functions/loan-history/index.ts')),'own reader must not access Google');
for(const file of ['app/history-loans-repository.js','app/history-loans.jsx','app/history-statement.js','app/history-sync-admin.js']){
 new vm.Script(read(file));assert(!/localStorage|sessionStorage|indexedDB|CacheStorage|service_role|SUPABASE_SERVICE_ROLE/.test(read(file)),file);
}
const git=args=>cp.execFileSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),...args],{cwd:root,encoding:'utf8',maxBuffer:30e6});
const baseRef='85c78e138515851823843994c781e83b56071c7e';
for(const file of ['app/app.jsx','app/affiliate-auth.js','app/private-resource-demand.js','app/image-viewer.jsx','app/document-workflow-repository.js','app/asset-repository.js'])if(fs.existsSync(path.join(root,file)))assert.equal(read(file).replace(/\r/g,''),git(['show',baseRef+':'+file]).replace(/\r/g,''),'SHARED_INFRASTRUCTURE_CHANGED_'+file);
assert.equal(read('sw.js').replace(/\d{10}/g,'VERSION').replace(/\r/g,''),git(['show',baseRef+':sw.js']).replace(/\d{10}/g,'VERSION').replace(/\r/g,''),'WORKER_LOGIC_CHANGED');
const browserPath=path.resolve(root,'../evidence/browser/browser.json'),browser=JSON.parse(fs.readFileSync(browserPath,'utf8'));assert.equal(browser.status,'PASS');
fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(browser,null,2)+'\n');
const run=(file)=>{const r=cp.spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:10e6});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;};
const runtime=run('scripts/test-history-snapshot-runtime.js'),source=JSON.parse(run('scripts/test-history-snapshot-source.mjs')),pages=JSON.parse(run('scripts/test-pages-deployment.js'));
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify(source,null,2)+'\n');
const files=['app/history-loans-repository.js','app/history-loans.jsx','app/history-statement.js','app/history-sync-admin.js',
 'supabase/functions/loan-history/index.ts','supabase/functions/loan-history/history.mjs','supabase/functions/loan-history/snapshot.mjs','supabase/functions/loan-history/snapshot-source.mjs',
 'supabase/functions/loan-history-sync/index.ts','supabase/functions/loan-history-sync/worker.mjs','google-apps-script/financial-handoff/Code.gs'];
const result={status:'PASS',phase:'LOCAL_CANDIDATE',edgeSyntax:'Babel TypeScript syntax + local imports; remote compilation not executed',runtime:runtime.trim().split(/\r?\n/),pages,
 sourceFixtureRows:source.fixtureRows,sharedInfrastructureUnchanged:true,workerLogicUnchanged:true,globalImageRegression:'NOT APPLICABLE: focal modules + generated artifacts only',
 productionDeployments:0,googleSheetWrites:0,productionLatency:'NOT MEASURED',files:files.map(file=>({file,sha256:sha(read(file))}))};
fs.writeFileSync(path.join(out,'candidate.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,phase:result.phase,files:files.length,sourceFixtureRows:result.sourceFixtureRows,pages:pages.status,productionDeployments:0}));
