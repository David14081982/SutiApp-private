'use strict';
// Prepare a reviewable candidate only. Does not apply SQL, deploy, commit or push.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/qa/evidence/history-loan-payments'),dir=path.join(root,'.tmp/history-loan-payments');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['app/history-loans-repository.js','app/history-loans.jsx','app/screens-historial.jsx','scripts/build-bundle.js','app/bundle.js','SutiApp.html',
 'supabase/functions/loan-history/index.ts','supabase/functions/loan-history/history.mjs','supabase/functions/loan-history/source.mjs',
 'supabase/migrations/20261025000100_self_loan_history.sql','supabase/recovery/20261025000100_self_loan_history.sql',
 'google-apps-script/financial-handoff/Code.gs','scripts/inspect-loan-history.js','scripts/test-loan-history.js','scripts/test-loan-history-receiver.js',
 'scripts/test-loan-history-browser.js','scripts/test-sicof-loan-receiver.js','scripts/package-loan-history.js','scripts/preflight-loan-history.js'];
for(const name of ['core','receiver','browser'])if(JSON.parse(read('docs/qa/evidence/history-loan-payments/'+name+'.json')).status!=='PASS')throw Error('EVIDENCE_REQUIRED_'+name);
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('C:/tmp/sutiapp-babel-7.28.4.min.js','utf8'),context);
const bundle=read('app/bundle.js');new vm.Script(bundle);
const chunks=s=>new Map([...s.matchAll(/\/\* @@file (.*?) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[2]]));
const a=chunks(read('.tmp/history-loan-payments/before/app__bundle.js')),b=chunks(bundle),changed=[...b].filter(([name,v])=>a.get(name)!==v).map(([name])=>name);
const expected=['history-loans-repository.js','history-loans.jsx','screens-historial.jsx'];
if(changed.some(f=>!expected.includes(f))||expected.some(f=>!changed.includes(f)))throw Error('UNEXPECTED_BUNDLE_CHANGE');
for(const name of expected){const source=read('app/'+name).replace(/\r\n/g,'\n'),compiled=name.endsWith('.jsx')?context.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd();
 if(b.get(name)!==`(function(){\n${compiled}\n})();\n`)throw Error('FOCAL_BUNDLE_DRIFT_'+name);}
context.Babel.transform(read('supabase/functions/loan-history/index.ts'),{presets:['typescript'],filename:'index.ts'});
const manifest={status:'PASS',scope:'LOCAL_CANDIDATE_NOT_DEPLOYED',checks:{focalBundleSyntax:true,focalSourceParity:true,unchangedOtherBundleChunks:true,edgeTypeScriptSyntax:true},bundleChanges:changed,
 files:files.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),productionChanges:0,activationOrder:['Readback remote baseline and back up receiver deployment; reject drift','Publish additive read_self_history receiver; preserve all existing code/manifest/properties','Apply additive SQL reader with migration collision and approval-history guards','Deploy loan-history Edge with JWT verification and existing server secrets','Verify real own/anonymous/forged target reads without test loans','Publish only focal frontend and generated chunks; verify actual browser and identity isolation'],
 recovery:['Disable new reader and revert focal UI/Edge','Restore prior Google deployment version only if no concurrent change','Run additive SQL recovery; preserve all requests, approval timestamps, notes and installments']};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'candidate.json'),JSON.stringify(manifest,null,2)+'\n');
const destination=path.join(dir,'candidate');fs.mkdirSync(destination,{recursive:true});for(const file of files){const target=path.join(destination,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
console.log(JSON.stringify({status:manifest.status,scope:manifest.scope,files:manifest.files.length,checks:manifest.checks,bundleChanges:changed}));
if(process.argv.includes('--build')){
 const {environment}=require('./inspect-loan-history'),e=environment(),target=path.join(dir,'site-'+sha(Buffer.from(bundle)).slice(0,12));
 const result=require('child_process').spawnSync(process.execPath,[path.join(root,'scripts/build-pages-site.js'),target],{cwd:root,env:{...process.env,SUTIAPP_SUPABASE_URL:e.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:e.SUPABASE_PUBLISHABLE_KEY},encoding:'utf8',windowsHide:true});
 fs.writeFileSync(path.join(dir,'pages-build.log'),(result.stdout||'')+(result.stderr||''));if(result.status!==0)throw Error('PAGES_BUILD_FAILED_SEE_PRIVATE_LOG');
 const proof={status:'PASS',bundleSha256:sha(fs.readFileSync(path.join(target,'app/bundle.js'))),sourceBundleSha256:sha(Buffer.from(bundle)),productionChanges:0};
 if(proof.bundleSha256!==proof.sourceBundleSha256)throw Error('BUILT_BUNDLE_MISMATCH');
 fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
