'use strict';
// Read-only schema evidence, no financial rows or credentials in the artifact.
const fs=require('fs'),path=require('path'),{query}=require('./savings-admin-review-db');
(async()=>{
 const signatures=['sicof_private.context(date,date)','public.savings_workspace_history(uuid)','public.generate_savings_schedule(uuid,date,date)','public.savings_next_contribution_date(date,text)'];
 const functions=await query("begin read only;set local statement_timeout='30s';select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,md5(pg_get_functiondef(oid)) md5,pg_get_userbyid(proowner) owner,proacl::text acl from pg_proc where oid in ("+signatures.map(s=>"'"+s+"'::regprocedure").join(',')+");commit;");
 const versions=await query("begin read only;select version from supabase_migrations.schema_migrations order by version desc limit 5;commit;");
 const file=path.resolve(__dirname,'fixtures/sicof-evidence-schema.json');
 if(fs.existsSync(file))throw Error('SCHEMA_EVIDENCE_ALREADY_CAPTURED');
 fs.writeFileSync(file,JSON.stringify({captured_at:new Date().toISOString(),functions,versions},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',functions:functions.map(({signature,md5,owner,acl})=>({signature,md5,owner,acl})),versions}));
})().catch(()=>{console.error('SICOF_SCHEMA_INSPECTION_FAILED');process.exitCode=1;});
