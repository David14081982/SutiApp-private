'use strict';
const fs=require('fs'),assert=require('assert').strict,a=require('./audit.cjs'),baseline=require('./BASELINE.json');
(async()=>{
 const functions=await a.query(a.catalog.functions),policies=await a.query(a.catalog.policies);
 const previous=new Set(baseline.functions.map(x=>x.signature));
 assert.deepEqual(functions.filter(x=>previous.has(x.signature)),baseline.functions);
 assert.deepEqual(policies,baseline.policies);
 const added=functions.filter(x=>!previous.has(x.signature));assert.equal(added.length,1);assert.equal(added[0].signature,'get_data_export_auth_emails(uuid[])');
 assert.equal(added[0].owner,'postgres');assert.equal(added[0].prosecdef,true);assert(added[0].definition.includes("00000000-0000-0000-0000-000000000000"));
 assert.equal(added[0].acl,'{postgres=X/postgres,service_role=X/postgres}');
 const fingerprints=await a.query(a.tables.filter(t=>t!=='data_export_audit_log').map(t=>`select '${t}' relation,count(*) rows,md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) hash from public.${t} t`).join(' union all '));
 assert.deepEqual(fingerprints,baseline.fingerprints);
 const [auth]=await a.query("select count(*) users,count(*) filter(where deleted_at is not null) soft_deleted,md5(string_agg(md5(jsonb_build_array(id,email)::text),'' order by id)) hash from auth.users");
 assert.equal(auth.hash,baseline.identity[0].auth_hash);
 const edges=await(await a.api('functions')).json(),edge=edges.find(x=>x.slug==='data-exports'||x.name==='data-exports');assert.equal(edge.version,13);assert.equal(edge.verify_jwt,true);
 a.save('backend-final',{at:new Date().toISOString(),status:'PASS',functionsExisting:previous.size,policies:policies.length,added:added[0],fingerprints,authIdentity:auth,edge:{version:edge.version,verify_jwt:edge.verify_jwt}});
 console.log(JSON.stringify({status:'PASS',functionsExisting:previous.size,policies:policies.length,masterDataUnchanged:true,authIdentityUnchanged:true,edge:edge.version}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
