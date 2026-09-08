'use strict';
const fs=require('fs'),assert=require('assert').strict,a=require('./audit.cjs');
(async()=>{
 const baseline=JSON.parse(fs.readFileSync(a.dir+'/BASELINE.json')),checks={};
 for(const key of ['functions','policies','tables','columns','constraints']){const rows=await a.query(a.catalog[key]);assert.deepEqual(rows,baseline[key],key+' drift');checks[key]={status:'PASS',rows:rows.length};}
 const fingerprints=await a.query("select 'program_catalog_items' relation,count(*) rows,md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) hash from program_catalog_items t union all select 'program_catalog_item_assets',count(*),md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from program_catalog_item_assets t union all select 'affiliate_documents',count(*),md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from affiliate_documents t");
 assert.deepEqual(fingerprints,baseline.fingerprints,'historical data drift');
 const response=await fetch('https://api.supabase.com/v1/projects/jsucdyothkuptosvskqf/functions',{headers:{Authorization:'Bearer '+a.env().SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('EDGE_METADATA_HTTP_'+response.status);
 const edge=(await response.json()).filter(f=>f.name==='document-access').map(({name,version,status,verify_jwt,updated_at})=>({name,version,status,verify_jwt,updated_at}));assert.equal(edge.length,1);
 a.save('backend-'+(process.argv[2]||'before-delivery'),{at:new Date().toISOString(),status:'PASS',checks,fingerprints,edge,sqlApplied:0});console.log(JSON.stringify({status:'PASS',checks,fingerprints,edge}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
