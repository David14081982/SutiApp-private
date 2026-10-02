'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),task=path.join(root,'.tmp/savings-admin-ux-20261001'),release=path.join(task,'release');
const files=[
 'supabase/migrations/20261001000100_savings_auto_enrollment.sql','supabase/recovery/20261001000100_savings_auto_enrollment.sql',
 'supabase/migrations/20261001000200_savings_admin_workspace.sql','supabase/recovery/20261001000200_savings_admin_workspace.sql',
 'scripts/test-savings-auto-enrollment.js','scripts/test-savings-admin-workspace.js','scripts/test-savings-admin-workspace-repository.js','scripts/test-savings-admin-workspace-browser.js',
 'scripts/build-savings-admin-ux.js','scripts/release-savings-admin-ux.js','scripts/verify-savings-admin-ux-live.js','scripts/package-savings-admin-ux.js',
 'docs/audits/H-SAVINGS-ADMIN-UX-IMPLEMENTATION-001.md'
];
for(const file of files){const target=path.join(release,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
for(const file of ['docs/SOURCE_OF_TRUTH.md','docs/DECISIONS.md','docs/AGENT_CHANGELOG.md']){
 const current=fs.readFileSync(path.join(root,file),'utf8'),before=fs.readFileSync(path.join(task,'before',file),'utf8');
 assert(current.startsWith(before),'Non-append governance edit '+file);const delta=current.slice(before.length);assert(delta.includes('H-SAVINGS-ADMIN-UX-IMPLEMENTATION-001'));
 const target=path.join(release,file),remote=fs.readFileSync(target,'utf8');assert(!remote.includes('## H-SAVINGS-ADMIN-UX-IMPLEMENTATION-001'),'Already packaged governance');fs.writeFileSync(target,remote+delta);
}
const evidence='docs/qa/evidence/savings-admin-ux-20261001';fs.mkdirSync(path.join(release,evidence),{recursive:true});
for(const name of fs.readdirSync(path.join(root,evidence))){assert(/\.(json|png)$/.test(name),'Unexpected evidence type');fs.copyFileSync(path.join(root,evidence,name),path.join(release,evidence,name));}
console.log(JSON.stringify({status:'PASS',sourceFiles:files.length,governance:'only appended H sections',privateBackupsPackaged:false}));
