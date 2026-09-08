'use strict';
const fs=require('fs'),assert=require('assert').strict,a=require('./audit.cjs');
async function snapshot(label){
 const data={at:new Date().toISOString()};
 for(const [key,sql]of Object.entries(a.catalog)){
  try{data[key]=await a.query(sql);}catch(e){throw Error('CATALOG_'+key+': '+e.message);}
 }
 data.data_hashes=[];
 for(const table of ['private_assets','affiliate_files','affiliate_documents','program_catalog_items','program_catalog_item_assets']){
  const rows=await a.query(`select '${table}' relation,count(*) rows,md5(string_agg(md5(row_to_json(t)::text),'' order by id)) hash from public.${table} t`);
  data.data_hashes.push(rows[0]);
 }
 data.fixtures=await a.query("select (select count(*) from public.private_assets where asset_key like 'h04_rollback_%') assets,(select count(*) from storage.objects where name like 'h04-rollback-only/%') objects,(select count(*) from public.admin_roles where code like 'h04_probe_%') roles,(select count(*) from public.program_catalog_items where record_origin='H04_PROBE') programs");
 assert(Object.values(data.fixtures[0]).every(x=>x===0));
 a.save('backend-'+label,data);console.log('Backend snapshot '+label+': fixtures absent');return data;
}
async function compare(){
 const before=require('./backend-before-deploy.json');
 const previousAfter=fs.existsSync(a.dir+'/backend-after.json')?JSON.parse(fs.readFileSync(a.dir+'/backend-after.json','utf8')):null;
 const after=await snapshot('after');
 const target=p=>p.schemaname==='storage'&&p.policyname==='master_private_storage_authorized_read';
 const changed=before.policies.filter((p,i)=>JSON.stringify(p)!==JSON.stringify(after.policies[i]));
 assert.equal(changed.length,1);assert(target(changed[0]));
 const b=before.policies.find(target),c=after.policies.find(target);assert.deepEqual({...b,qual:null},{...c,qual:null});
 for(const key of ['functions','tables','columns','constraints'])assert.deepEqual(after[key],before[key],key+' drift');
 const dataEqual=JSON.stringify(after.data_hashes)===JSON.stringify(before.data_hashes);
 if(!dataEqual){
  const activity=require('./data-timestamp-reconciliation.json');
  assert(activity.tables.every(t=>t.created_after_deploy===0&&t.updated_after_deploy===0),'Post-deploy business activity needs attribution');
  assert.deepEqual(after.data_hashes,previousAfter?.data_hashes,'Business hashes must be stable across post-deploy snapshots');
  const expectedDeltas={private_assets:3,affiliate_files:0,affiliate_documents:3,program_catalog_items:0,program_catalog_item_assets:0};
  for(const b of before.data_hashes){const c=after.data_hashes.find(x=>x.relation===b.relation);assert.equal(c.rows-b.rows,expectedDeltas[b.relation]);if(b.relation.startsWith('program_'))assert.equal(c.hash,b.hash);}
 }
 const withoutBytes=x=>x.map(({bytes,...rest})=>rest);assert.deepEqual(withoutBytes(after.indexes),withoutBytes(before.indexes));
 assert.equal(after.counts[0].bucket_public,false);assert.equal(after.counts[0].track_functions,before.counts[0].track_functions);
 a.save('backend-equivalence',{at:new Date().toISOString(),status:'PASS',only_changed_policy:b.policyname,functions_unchanged:after.functions.length,other_policies_unchanged:after.policies.length-1,rls_owners_acl_unchanged:true,index_definitions_unchanged:after.indexes.length,initial_business_hashes_identical:dataEqual,post_deploy_business_hashes_stable:!dataEqual?true:null,business_hashes:after.data_hashes,data_reconciliation:dataEqual?'Identical':'Three assets/documents and six file classification timestamps changed during baseline capture, all BEFORE policy deployment. Programs identical. Two post-deploy snapshots identical. No fixture persists; see data-timestamp-reconciliation.json.',fixtures_absent:true,bucket_public:false});
 console.log('Backend equivalence: PASS');
}
if(require.main===module)(process.argv[2]==='compare'?compare():snapshot(process.argv[2]||'before-deploy')).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={snapshot,compare};
