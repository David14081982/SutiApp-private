'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'.tmp/savings-individual-withdrawal/before');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const hashes=JSON.parse(fs.readFileSync(path.join(base,'hashes.json'),'utf8'));
const allowed=new Set(['SutiApp.html','sw.js','app/bundle.js','app/savings-panel-admin.jsx','app/savings-runtime-admin.jsx','scripts/build-bundle.js','docs/AGENT_CHANGELOG.md','docs/SOURCE_OF_TRUTH.md']);
const allowedPath=f=>allowed.has(f)||f.startsWith('docs/architecture/')||f.includes('savings-individual-withdrawal')||f==='supabase/migrations/20260930000100_savings_individual_withdrawal.sql'||f==='supabase/recovery/20260930000100_savings_individual_withdrawal.sql'||f==='docs/audits/H-SAVINGS-INDIVIDUAL-WITHDRAWAL-UX-001.md';
const changed=Object.keys(hashes).filter(f=>!fs.existsSync(path.join(root,f))||hash(fs.readFileSync(path.join(root,f)))!==hashes[f]);
assert.deepEqual(changed.filter(f=>!allowedPath(f)),[],'unrelated tracked content changed');
const baseline=fs.readFileSync(path.join(base,'status.txt'),'utf8').split(/\r?\n/).filter(Boolean).map(x=>x.slice(3));
const status=cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean).map(x=>x.slice(3));
const introduced=status.filter(f=>!baseline.includes(f));assert.deepEqual(introduced.filter(f=>!allowedPath(f)),[],'unexpected new files');
for(const file of ['SutiApp.html','sw.js']){
 const old=fs.readFileSync(path.join(base,file),'utf8'),current=fs.readFileSync(path.join(root,file),'utf8');
 const norm=s=>s.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=VERSION').replace(/sw\.js\?v=\d+/g,'sw.js?v=VERSION').replace(/sutiapp-v\d+/g,'sutiapp-vVERSION');
 assert.equal(norm(current),norm(old),'generated cachebuster must not change shell/SW logic');
}
const scopes=['app/savings-panel-admin.jsx','app/savings-runtime-admin.jsx','scripts/build-bundle.js','SutiApp.html','sw.js','docs/SOURCE_OF_TRUTH.md','docs/AGENT_CHANGELOG.md'];
cp.execFileSync('git',['diff','--check','--',...scopes],{cwd:root,stdio:'pipe'});
const result={status:'PASS',changedTracked:changed,newPaths:introduced,unexpected:[],unrelatedDirtyWorkspacePreserved:true,cachebustersOnly:true};
fs.writeFileSync(path.join(root,'docs/qa/evidence/savings-individual-withdrawal/workspace.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
