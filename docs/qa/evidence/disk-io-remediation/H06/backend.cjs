'use strict';
const fs=require('fs'),assert=require('assert').strict,a=require('./audit.cjs');
(async()=>{
 const baseline=JSON.parse(fs.readFileSync(a.dir+'/BASELINE.json')),checks={};
 for(const key of ['functions','policies','tables','columns','constraints']){const rows=await a.query(a.catalog[key]);assert.deepEqual(rows,baseline[key],key+' drift');checks[key]={status:'PASS',rows:rows.length};}
 const fingerprints=await a.query("select 'program_catalog_items' relation,count(*) rows,md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) hash from program_catalog_items t union all select 'program_catalog_item_assets',count(*),md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from program_catalog_item_assets t union all select 'affiliate_documents',count(*),md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from affiliate_documents t");
 let concurrentProductionInsert=null;
 try { assert.deepEqual(fingerprints,baseline.fingerprints,'historical data drift'); }
 catch (error) {
  a.save('backend-full-table-drift',{at:new Date().toISOString(),expected:baseline.fingerprints,actual:fingerprints});
  assert.deepEqual(fingerprints.slice(0,2),baseline.fingerprints.slice(0,2),'catalog data drift');
  const investigation=JSON.parse(fs.readFileSync(a.dir+'/data-drift-investigation.json'));
  assert.equal(investigation.cutoff,baseline.at);assert.equal(new Date(baseline.at).toISOString(),baseline.at);
  const historical=await a.query(`select count(*) rows,md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) hash from affiliate_documents t where created_at < '${baseline.at}'::timestamptz`);
  assert.deepEqual(historical,[{rows:baseline.fingerprints[2].rows,hash:baseline.fingerprints[2].hash}],'historical document drift');
  assert.equal(fingerprints[2].rows-baseline.fingerprints[2].rows,investigation.added.length);
  assert(investigation.added.every(r=>r.controlled_actor===false),'unattributed controlled write');
  concurrentProductionInsert={historical,added:investigation.added,fullTableEqual:false,scope:'All baseline documents exactly preserved; later production insert by another actor.'};
 }
 const response=await fetch('https://api.supabase.com/v1/projects/jsucdyothkuptosvskqf/functions',{headers:{Authorization:'Bearer '+a.env().SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('EDGE_METADATA_HTTP_'+response.status);
 const edge=(await response.json()).filter(f=>f.name==='document-access').map(({name,version,status,verify_jwt,updated_at})=>({name,version,status,verify_jwt,updated_at}));assert.equal(edge.length,1);
 a.save('backend-'+(process.argv[2]||'before-delivery'),{at:new Date().toISOString(),status:'PASS',checks,fingerprints,edge,concurrentProductionInsert,sqlApplied:0});console.log(JSON.stringify({status:'PASS',checks,fingerprints,edge,concurrentProductionInsert}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
