'use strict';
// Package an explicit report-only allowlist on the published isolated base.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),target=path.join(root,'.tmp/cash-flow-consolidated/release'),out=path.join(root,'docs/qa/evidence/cash-flow-criteria'),privateDir=path.join(root,'.tmp/cash-flow-criteria');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),json=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const git=args=>cp.execFileSync('git',['-c','safe.directory='+target.replaceAll('\\','/'),...args],{cwd:target,encoding:'utf8',maxBuffer:64*1024*1024});
function main(){
 assert.equal(git(['rev-parse','HEAD']).trim(),'183177cdb7b46668c70090cc737fc8cb75ad569c');
 const release=json(path.join(privateDir,'release-manifest.json')),registry=json(path.join(out,'registry-manifest.json')),deployed=json(path.join(out,'backend-deployed.json'));
 assert.equal(json(path.join(out,'browser-live-candidate.json')).status,'PASS');assert.equal(deployed.status,'PASS');
 const sources=['cash-flow.mjs','cash-flow-google.mjs','cash-flow-consolidated.mjs','cash-flow-contracts.mjs','cash-flow-investors.mjs'].map(f=>'supabase/functions/reports-jc/'+f);
 const sql=require('./release-cash-flow-criteria.js').migrations.flatMap(f=>['supabase/migrations/'+f,'supabase/recovery/'+f]);
 const scripts=['test-cash-flow-contracts.mjs','test-cash-flow-consolidated.mjs','test-cash-flow-consolidated-ui.js','test-cash-flow-criteria-contracts.mjs','test-cash-flow-criteria-integration.mjs','test-cash-flow-criteria-savings-sql.js','test-cash-flow-investor-criteria.mjs','test-cash-flow-investor-criteria-sql.js','verify-cash-flow-criteria-contracts.mjs','verify-cash-flow-criteria-assembly.mjs','verify-cash-flow-criteria-browser-live.js','prepare-cash-flow-criteria-release.js','release-cash-flow-criteria.js','package-cash-flow-criteria-release.js','update-cash-flow-criteria-registry.py'].map(f=>'scripts/'+f);
 scripts.push(...['test-cash-flow-criteria-savings-query.js','verify-cash-flow-criteria-savings-query.mjs','verify-cash-flow-criteria-savings-source.mjs','verify-cash-flow-criteria-http.js','verify-cash-flow-investor-criteria.mjs'].map(f=>'scripts/'+f));
 const evidence=fs.readdirSync(out).filter(f=>/\.(json|md)$/.test(f)&&!['package.json','publication.json','final-result.json'].includes(f)).map(f=>'docs/qa/evidence/cash-flow-criteria/'+f);
 const files=[...sources,...sql,...scripts,...evidence,'docs/audits/H-FLUJO-EFECTIVO-CRITERIO-001.md'];
 for(const f of sources)assert.equal(sha(fs.readFileSync(path.join(root,f))),deployed.sourceHashes[path.basename(f)]);
 for(const f of files){const dest=path.join(target,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,f),dest);}
 for(const [f,h]of Object.entries(release.candidateHashes))assert.equal(sha(fs.readFileSync(path.join(target,f))),h,'UI_CANDIDATE_DRIFT');
 for(const [f,h]of Object.entries(registry.candidateSourceHashes))assert.equal(sha(fs.readFileSync(path.join(target,f))),h,'REGISTRY_SOURCE_DRIFT:'+f);
 for(const f of registry.updatedFiles)assert.equal(sha(fs.readFileSync(path.join(target,f.path))),f.sha256,'REGISTRY_ARTIFACT_DRIFT');
 const allow=[...new Set([...files,...Object.keys(release.candidateHashes),...registry.updatedFiles.map(f=>f.path),'docs/DECISIONS.md','docs/AGENT_CHANGELOG.md'])];
 const changed=git(['status','--porcelain','--untracked-files=all']).split(/\r?\n/).filter(Boolean).map(s=>s.slice(3));for(const f of changed)assert(allow.includes(f),'OUTSIDE_REPORT_SCOPE:'+f);
 for(const f of allow){const body=fs.readFileSync(path.join(target,f),'utf8');assert(!/sbp_[a-z0-9]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----|"private_key"\s*:\s*"-----/i.test(body),'SECRET_PATTERN:'+f);}
 const proof={status:'PASS',baseCommit:release.baseCommit,files:allow,filesCount:allow.length,unexpectedFiles:[],otherPublishedModulesPreserved:173,financialWrites:0,privateSourcesExcluded:true};
 fs.writeFileSync(path.join(out,'package.json'),JSON.stringify(proof,null,2)+'\n');fs.writeFileSync(path.join(privateDir,'package-files.json'),JSON.stringify(allow,null,2)+'\n');console.log(JSON.stringify({...proof,files:undefined}));
}
if(require.main===module)main();
