'use strict';
// Read-only catalog baseline; never prints credentials, identities or business rows.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-document-private');
const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
async function main(){
 const query=`select jsonb_build_object('definition',pg_get_functiondef(p.oid),'oid',p.oid,'owner',p.proowner,'acl',p.proacl,'securityDefiner',p.prosecdef,'config',p.proconfig,'records',(select count(*) from document_private.records),'versions',(select jsonb_agg(version) from (select version from supabase_migrations.schema_migrations order by version desc limit 5)t)) catalog from pg_proc p where p.oid='document_private.visible(document_private.records,boolean)'::regprocedure`;
 const r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:true}),signal:AbortSignal.timeout(30000)});
 assert(r.ok,'CATALOG_HTTP_'+r.status);const result=(await r.json())[0].catalog;
 fs.mkdirSync(dir,{recursive:true});assert(!fs.existsSync(path.join(dir,'catalog.json')),'BASELINE_ALREADY_CAPTURED');fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({status:'PASS',...result}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
