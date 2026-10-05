'use strict';
// Read-only schema inspection. Never prints credentials or business rows.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/finance-blocks');
const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
async function main(){
 const query=`select jsonb_build_object(
 'versions',(select jsonb_agg(version) from (select version from supabase_migrations.schema_migrations order by version desc limit 8) t),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('list_admin_finance_request_flow_queue','get_effective_affiliate_id','admin_module_boundary')) or (n.nspname='admin_support_private' and p.proname='module_visible')),
 'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type)) from information_schema.columns where table_schema='public' and table_name in ('program_requests','affiliates','admin_section_definitions')),
 'triggers',(select jsonb_agg(pg_get_triggerdef(oid)) from pg_trigger where tgrelid='public.program_requests'::regclass and not tgisinternal)
 ) catalog`;
 const r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:true}),signal:AbortSignal.timeout(30000)});
 assert(r.ok,'CATALOG_HTTP_'+r.status);const result=(await r.json())[0].catalog;
 fs.mkdirSync(dir,{recursive:true});assert(!fs.existsSync(path.join(dir,'catalog.json')),'BASELINE_ALREADY_CAPTURED');fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify(result,null,2));
 for(const name of ['app/screens-admin-finanzas.jsx','app/screens-admin.jsx','app/financial-legacy-repository.js','app/program-request-repository.js','scripts/build-bundle.js','app/bundle.js']){fs.mkdirSync(path.dirname(path.join(dir,'before',name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(dir,'before',name));}
 console.log(JSON.stringify({status:'PASS',versions:result.versions,functions:result.functions.map(x=>x.name),productionWrites:0,businessRowsRead:0}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
