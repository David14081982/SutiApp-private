'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert').strict,a=require('./audit.cjs'),b=require('./benchmark.cjs');
const root=path.resolve(__dirname,'../../../../..'),filename='20260907000500_savings_read_work.sql';
const source=folder=>fs.readFileSync(path.join(root,'supabase',folder,filename),'utf8');
const body=s=>s.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'');
async function snapshot(name){const data={at:new Date().toISOString()};for(const[k,q]of Object.entries(a.catalog))data[k]=await a.query(q);a.save(name,data);return data;}
async function main(mode){
 if(mode==='rehearsal'){
  const sql="begin;set local statement_timeout='45s';"+b.setup+"select pg_temp.h05_capture('before');"+body(source('migrations'))+"select pg_temp.h05_capture('optimized');"+body(source('recovery'))+
  "select pg_temp.h05_capture('recovered');"+b.claims+`reset role;
  create temporary table h05_recovered as select public.get_self_savings_if_changed('arbitrary') value;
  select b.label,b.payload=o.payload optimized_equal,b.payload=r.payload recovered_equal,
   (select value->>'cacheable'='false' and value->>'modified'='true' and value->'data'=public.get_self_savings_live_readonly() from h05_recovered) open_client_compatible,
   to_regclass('public.savings_legacy_evidence_participant_type_source_idx') is null index_removed
  from h05_results b join h05_results o using(label) join h05_results r using(label) where b.stage='before' and o.stage='optimized' and r.stage='recovered' order by label;rollback;`;
  const rows=await a.raw(sql),pass=rows.length===10&&rows.every(r=>r.optimized_equal&&r.recovered_equal&&r.open_client_compatible&&r.index_removed);a.save('recovery-rehearsal',{at:new Date().toISOString(),status:pass?'PASS':'FAIL',rows});assert(pass);console.log('Recovery and complete financial equivalence: PASS (10 cases)');return;
 }
 if(mode==='apply'){
  for(const f of ['equivalence-B','conditional-equivalence','invalidation-backend','security','recovery-rehearsal','unit-tests'])assert.equal(require('./'+f+'.json').status,'PASS',f);
  const before=await snapshot('backend-before-deploy'),baseline=require('./BASELINE.json');
  for(const key of Object.keys(a.catalog))assert.deepEqual(before[key],baseline[key],'Pre-deployment drift: '+key);
  const at=new Date().toISOString();await a.raw(source('migrations'));a.save('deployment',{at,status:'APPLIED',migration:filename,source_sha256:require('crypto').createHash('sha256').update(source('migrations')).digest('hex'),financial_dml:false});console.log('H05 backend migration applied');
 }
 const after=await snapshot('backend-after'),baseline=require('./BASELINE.json');
 for(const key of ['policies','tables','columns','constraints','triggers'])assert.deepEqual(after[key],baseline[key],key);
 assert.deepEqual(after.functions.filter(f=>f.signature!=='get_self_savings_if_changed(text)'),baseline.functions);
 assert.deepEqual(after.indexes.filter(i=>i.indexname!=='savings_legacy_evidence_participant_type_source_idx'),baseline.indexes);
 assert.equal(after.functions.length,baseline.functions.length+1);assert.equal(after.indexes.length,baseline.indexes.length+1);console.log('All existing functions, policies, financial schema, triggers and grants unchanged; one index and one endpoint added');
}
if(require.main===module)main(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main,snapshot};
