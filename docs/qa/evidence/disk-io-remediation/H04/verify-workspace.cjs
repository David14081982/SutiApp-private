'use strict';
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert').strict,a=require('./audit.cjs'),{env}=a;
const before=require('./workspace-before.json').hashes;
const allowed=f=>f.startsWith('docs/qa/evidence/disk-io-remediation/H04/')||f==='docs/qa/evidence/disk-io-remediation/README.md'||f==='docs/AGENT_CHANGELOG.md'||/^docs\/architecture\/(SUTIAPP_ARCHITECTURE_REGISTRY|registry-(code|data|edges|search))\.json$/.test(f)||/^supabase\/(migrations|recovery)\/20260907000400_private_storage_rls_work\.sql$/.test(f);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const unexpected=[],changed=[];
for(const [f,h]of Object.entries(before)){
 if(!fs.existsSync(f)||hash(fs.readFileSync(f))!==h){changed.push(f);if(!allowed(f))unexpected.push(f);}
}
const files=[...new Set(cp.execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const added=files.filter(f=>!Object.hasOwn(before,f));for(const f of added)if(!allowed(f))unexpected.push(f);
const secrets=Object.entries(env()).filter(([k,v])=>/PASSWORD|ACCESS_TOKEN|SECRET_KEY/.test(k)&&v.length>=8),leaks=[];
for(const f of [...changed,...added].filter(allowed)){
 if(!fs.existsSync(f))continue;const text=fs.readFileSync(f,'utf8');for(const [key,value]of secrets)if(text.includes(value))leaks.push({file:f,key});
}
assert.deepEqual(unexpected,[],'Unexpected workspace files');assert.deepEqual(leaks,[],'Sensitive value in changed files');
a.save('workspace-preservation',{at:new Date().toISOString(),status:'PASS',baseline_files:Object.keys(before).length,changed,added,unexpected,secret_value_matches:leaks.length,frontend_sources_unchanged:true,preexisting_work_preserved:true});
console.log(JSON.stringify({status:'PASS',baseline:Object.keys(before).length,changed:changed.length,added:added.length,secrets:0,unexpected:0}));
