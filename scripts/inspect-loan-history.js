'use strict';
// Read-only metadata and aggregate baseline. No credentials or customer rows logged.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/history-loan-payments');
function environment(){const e={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)e[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return e;}
async function query(sql){const e=environment(),r=await fetch('https://api.supabase.com/v1/projects/'+new URL(e.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+e.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:true}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('CATALOG_HTTP_'+r.status);return r.json();}
async function main(){const result=await query(`select jsonb_build_object(
 'versions',(select jsonb_agg(version) from (select version from supabase_migrations.schema_migrations order by version desc limit 8)t),
 'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'type',data_type)) from information_schema.columns where table_schema='public' and table_name in('affiliates','program_requests','program_request_admin_events')),
 'functions',(select jsonb_agg(jsonb_build_object('name',proname,'definition',pg_get_functiondef(oid),'acl',proacl,'owner',proowner,'oid',oid)) from pg_proc where pronamespace='public'::regnamespace and (proname in('get_effective_affiliate_id','list_self_program_request_history') or proname like '%approv%financial%' or proname like '%financial%approv%')),
 'approvalCounts',(select jsonb_build_object('approved',count(*),'timestamped',count(financial_approved_at)) from public.program_requests where status='approved' and financial_processing_status is not null)) baseline`);
fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,'catalog.json');if(fs.existsSync(f))throw Error('BASELINE_EXISTS');fs.writeFileSync(f,JSON.stringify(result[0].baseline,null,2));const b=result[0].baseline;console.log(JSON.stringify({versions:b.versions,approvalCounts:b.approvalCounts,functions:b.functions.map(x=>x.name),affiliateStateColumns:b.columns.filter(x=>x.table==='affiliates'&&/archiv|active|auth|control/.test(x.name))}));}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={environment,query};
