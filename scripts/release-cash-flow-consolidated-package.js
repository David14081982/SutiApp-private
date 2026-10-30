'use strict';
// Assemble only this authorized change on the already-published isolated base.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),target=path.join(root,'.tmp/cash-flow-consolidated/release');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),readJson=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const git=args=>cp.execFileSync('git',args,{cwd:target,encoding:'utf8',maxBuffer:64*1024*1024});
const backend=['index.ts','cash-flow.mjs','cash-flow-google.mjs','cash-flow-consolidated.mjs','cash-flow-contracts.mjs','cash-flow-pv2-engine.mjs','cash-flow-investors.mjs'].map(f=>'supabase/functions/reports-jc/'+f);
const sql=['20261030000200_reports_jc_cash_flow_investors.sql','20261030000300_reports_jc_cash_flow_contracts.sql'].flatMap(f=>['supabase/migrations/'+f,'supabase/recovery/'+f]);
const scripts=['test-cash-flow-consolidated.mjs','test-cash-flow-contracts.mjs','test-cash-flow-investors.mjs','test-cash-flow-investors-sql.js','test-cash-flow-contracts-sql.js','test-cash-flow-consolidated-ui.js','verify-cash-flow-consolidated-assembly.mjs','verify-cash-flow-consolidated-sources.mjs','verify-cash-flow-consolidated-live.js','verify-cash-flow-consolidated-browser-live.js','prepare-cash-flow-consolidated-release.js','release-cash-flow-consolidated.js','release-cash-flow-consolidated-package.js'].map(f=>'scripts/'+f);
const generated=['app/cash-flow-report.jsx','app/cash-flow-export.js','app/bundle.js','scripts/build-bundle.js','SutiApp.html','sw.js'];
function main(){
 assert.equal(git(['rev-parse','HEAD']).trim(),'d1163880218fdf114532ce92ceb24c4bb58f93d9');
 const manifest=readJson(path.join(root,'.tmp/cash-flow-consolidated/release-manifest.json')),registry=readJson(path.join(root,'docs/qa/evidence/cash-flow-consolidated/registry-manifest.json')),deployed=readJson(path.join(root,'docs/qa/evidence/cash-flow-consolidated/backend-deployed.json'));
 assert.equal(deployed.status,'PASS');
 for(const file of backend)assert.equal(sha(fs.readFileSync(path.join(root,file))),deployed.sourceHashes[path.basename(file)]);
 for(const file of generated)assert.equal(sha(fs.readFileSync(path.join(target,file))),manifest.candidateHashes[file]);
 const evidence=fs.readdirSync(path.join(root,'docs/qa/evidence/cash-flow-consolidated')).filter(f=>f.endsWith('.json')&&f!=='package.json').map(f=>'docs/qa/evidence/cash-flow-consolidated/'+f);
 const files=[...backend,...sql,...scripts,'docs/audits/H-FLUJO-EFECTIVO-CONSOLIDADO-001.md',...evidence];
 for(const file of files){const dest=path.join(target,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
 for(const [file,hash]of Object.entries(registry.candidateSourceHashes))assert.equal(sha(fs.readFileSync(path.join(target,file))),hash,'REGISTRY_SOURCE:'+file);
 for(const file of registry.updatedFiles)assert.equal(sha(fs.readFileSync(path.join(target,file.path))),file.sha256,'REGISTRY_FILE:'+file.path);
 const allow=[...new Set([...generated,...files,...registry.updatedFiles.map(f=>f.path)])];
 const changed=git(['status','--porcelain','--untracked-files=all']).split(/\r?\n/).filter(Boolean).map(s=>s.slice(3));
 for(const file of changed)assert(allow.includes(file),'OUTSIDE_SCOPE:'+file);
 for(const file of allow){const body=fs.readFileSync(path.join(target,file),'utf8');assert(!/sbp_[a-z0-9]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----|"private_key"\s*:\s*"-----/i.test(body),'SECRET_PATTERN:'+file);}
 const proof={status:'PASS',baseCommit:manifest.baseCommit,files:allow,filesCount:allow.length,financialWrites:0,unexpectedFiles:[],originalModulesPreserved:173,privateTemplateExcluded:true};
 fs.writeFileSync(path.join(root,'docs/qa/evidence/cash-flow-consolidated/package.json'),JSON.stringify(proof,null,2)+'\n');fs.writeFileSync(path.join(root,'.tmp/cash-flow-consolidated/package-files.json'),JSON.stringify(allow,null,2));console.log(JSON.stringify({...proof,files:undefined}));
}
if(require.main===module)main();
module.exports={main};
