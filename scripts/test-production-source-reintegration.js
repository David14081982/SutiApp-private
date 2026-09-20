'use strict';
// Offline source reconciliation checks. No network, database, credentials or production writes.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:30000000});
const norm=s=>s.replace(/\r\n/g,'\n');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read('docs/qa/evidence/production-source-reintegration-20260920/source-manifest.json'));
assert.equal(git('rev-parse','HEAD').trim(),manifest.base);
for(const f of manifest.sql)assert.equal(sha(fs.readFileSync(path.join(root,f.path))),f.source_sha256,f.path);
const edgeFile='supabase/functions/financial-legacy/index.ts',edge=norm(read(edgeFile));
assert.equal(edge.split(manifest.edge.new_block).length-1,1);
assert.equal(edge.replace(manifest.edge.new_block,manifest.edge.old_block),norm(git('show',manifest.base+':'+edgeFile)),'Unrelated/later Edge content changed');
let portableCases=0;
for(const file of manifest.portable_scripts){
 const source=read(file),match=source.match(/const ENV_FILE\s*=([\s\S]*?);/);
 assert(match,file+' missing environment resolver');
 assert(!source.includes('Sutiapp 20082026'),file+' old path');
 for(const env of [{SUTIAPP_TEST_ENV_FILE:'test.env',SUTIAPP_ENV_FILE:'general.env'},{SUTIAPP_ENV_FILE:'general.env'},{}]){
  const result=vm.runInNewContext(match[1],{process:{env},require,__dirname:path.join(root,'scripts')});
  assert.equal(result,env.SUTIAPP_TEST_ENV_FILE||env.SUTIAPP_ENV_FILE||path.join(root,'supabase.env'));
  portableCases++;
 }
}
assert(read('scripts/test-admin-request-delete-modal-live.js').includes('process.env.SUTIAPP_TEST_ENV_FILE ||= ENV_FILE'));
const {targets}=require('./disk-io-business-conflicts-targets');
let conflicts=0;
for(const t of targets){
 const after=norm(t.after),before=norm(t.before);
 const pattern=/errcode\s*=\s*'PT409'/gi;
 const matches=after.match(pattern)||[];
 conflicts+=matches.length;
 assert.equal(after.replace(pattern,m=>m.replace('PT409','40001')),before,'Change beyond reviewed conflict SQLSTATE: '+t.signature);
 assert.equal(crypto.createHash('md5').update(t.after).digest('hex'),t.after_md5);
 assert.equal(crypto.createHash('md5').update(t.before).digest('hex'),t.before_md5);
}
assert.equal(conflicts,12);
const proof=JSON.parse(read('docs/qa/evidence/production-source-reintegration-20260920/production-comparison.json'));
assert.equal(proof.status,'PASS');assert.equal(proof.read_only,true);assert.equal(proof.functions.length,28);
assert.equal(proof.functions.filter(f=>f.exact_body).length,24);
assert.equal(proof.functions.filter(f=>f.matched_later_guarantor).length,4);
for(const f of proof.functions)assert(f.exact_body||f.matched_later_guarantor);
const trackedChanges=git('diff','--name-only',manifest.base).trim().split(/\r?\n/).filter(Boolean);
assert(!trackedChanges.some(f=>f.startsWith('app/')||['SutiApp.html','sw.js'].includes(f)),'Frontend changed');
for(const name of ['20260917000100_affiliate_eligibility_counterpart_recompute.sql','20260906000300_savings_identity_and_affiliate_protection.sql'])
 assert(!fs.existsSync(path.join(root,'supabase/migrations',name)),'Unapplied migration included');
assert.equal(git('diff','--cached','--name-only').trim(),'','Index must remain unchanged');
console.log(JSON.stringify({status:'PASS',restored_sql:manifest.sql.length,edge_inverse_delta:'PASS',portable_scripts:manifest.portable_scripts.length,environment_precedence_cases:portableCases,disk_functions:targets.length,sqlstate_only_changes:conflicts,frontend_unchanged:true,unapplied_excluded:true,index_unchanged:true}));
