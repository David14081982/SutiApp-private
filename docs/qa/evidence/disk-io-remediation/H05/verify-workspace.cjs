'use strict';
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert').strict,a=require('./audit.cjs');
const before=require('./workspace-before.json').hashes;
const allowed=f=>f.startsWith('docs/qa/evidence/disk-io-remediation/H05/')||['docs/qa/evidence/disk-io-remediation/README.md','docs/AGENT_CHANGELOG.md','SutiApp.html','sw.js','app/bundle.js','app/savings-repository.js','app/savings-store.jsx','scripts/test-savings-read-work.js','scripts/test-savings-read-work-browser.js','scripts/test-savings-shadow-foundation.js'].includes(f)||/^docs\/architecture\/(SUTIAPP_ARCHITECTURE_REGISTRY|registry-(code|data|edges|search))\.json$/.test(f)||/^supabase\/(migrations|recovery)\/20260907000500_savings_read_work\.sql$/.test(f);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),unexpected=[],changed=[];
for(const[f,h]of Object.entries(before))if(!fs.existsSync(f)||hash(fs.readFileSync(f))!==h){changed.push(f);if(!allowed(f))unexpected.push(f);}
const files=[...new Set(cp.execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))],added=files.filter(f=>!Object.hasOwn(before,f));for(const f of added)if(!allowed(f))unexpected.push(f);
const secrets=Object.entries(a.env()).filter(([k,v])=>/PASSWORD|ACCESS_TOKEN|SECRET_KEY|SERVICE_ROLE/.test(k)&&v.length>=8),leaks=[];
for(const f of [...changed,...added].filter(allowed)){if(!fs.existsSync(f))continue;const s=fs.readFileSync(f,'utf8');for(const[k,v]of secrets)if(s.includes(v))leaks.push({file:f,key:k});}
assert.deepEqual(unexpected,[],'Unexpected workspace file');assert.deepEqual(leaks,[],'Secret in changed file');
a.save('workspace-preservation',{at:new Date().toISOString(),status:'PASS',baseline_files:Object.keys(before).length,changed,added,unexpected,secret_value_matches:leaks.length,preexisting_work_preserved:true,unpublished_admin_source_unchanged:true});console.log(JSON.stringify({status:'PASS',baseline:Object.keys(before).length,changed:changed.length,added:added.length,unexpected:0,secrets:0}));
