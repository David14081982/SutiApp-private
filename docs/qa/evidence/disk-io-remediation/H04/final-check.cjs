'use strict';
const fs=require('fs'),assert=require('assert').strict,crypto=require('crypto'),a=require('./audit.cjs');
const read=n=>JSON.parse(fs.readFileSync(a.dir+'/'+n+'.json','utf8'));
const modes=['owner','other','principal','unauthorized_admin','assets_admin','documents_admin','program_admin','impersonation','impersonation_expired','impersonation_revoked','impersonation_wrong_session','anon'];
for(const m of modes){const b=read('matrix-'+m),c=read('matrix-live-'+m);assert.equal(b.status,'PASS');assert.equal(c.status,'PASS');assert.deepEqual(b.before,b.after);assert.deepEqual(c.before,b.before);assert.deepEqual(c.after,b.before);}
for(const name of ['backend-equivalence','global-local','global-production','recovery-final','drift-rejection','signed-expiry-before','signed-expiry-after','policy-final'])assert.equal(read(name).status,'PASS',name);
for(const n of ['global-local','global-production']){const r=read(n);assert.equal(r.browserErrors,0);assert.equal(r.initial.failures.length,0);assert.equal(r.legitimatePdf.status,'PASS');assert.equal(r.cacheComparison.withoutServiceWorker.status,'PASS');assert.equal(r.admin.status,'PASS');}
const perf=read('performance-live');assert.equal(perf.samples.length,3);assert(perf.samples.every(s=>s.hits===757&&s.document_rows===0&&s.executed_document_seq_scans===0));
const obs=read('observation-summary');assert(obs.seconds>=60&&obs.stats_reset_equal);assert.equal(obs.delta.xact_rollback,0);assert.equal(obs.delta.deadlocks,0);assert.equal(read('logs-observation').data.result.length,0);
assert.equal(read('backend-equivalence').fixtures_absent,true);assert.equal(read('backend-equivalence').bucket_public,false);
for(const h of ['H01','H02','H03']){
 const bytes=fs.readFileSync(a.dir+'/preconditions/'+h+'-VERIFICATION.md');
 assert(bytes.toString().includes(h+' STATUS: PASS'));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),read('preconditions').files.find(f=>f.task===h).sha256);
}
assert(fs.readFileSync(a.dir+'/VERIFICATION.md','utf8').trim().endsWith('STATUS: PASS'));
assert(fs.readFileSync(a.dir+'/registry-tests.txt','utf8').includes('Exit: 0'));
const files=['supabase/migrations/20260907000400_private_storage_rls_work.sql','supabase/recovery/20260907000400_private_storage_rls_work.sql'];
const hashes=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
a.save('final-check',{at:new Date().toISOString(),status:'PASS',matrix_before_candidate:192,matrix_deployed:192,global_local:'PASS',global_production:'PASS',backend:'PASS',recovery:'PASS',registry_acceptance:'PASS',migration_hashes:hashes,frontend_change:false,limitations:'See VERIFICATION.md; concurrent pre-deploy activity and local empty directories explicitly retained.'});
console.log('H04 final evidence gate: PASS');
