'use strict';
// Read-only by default. Never log credentials or business rows.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/program-product-financing');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=raw.indexOf('=');if(at>0&&!raw.trim().startsWith('#'))out[raw.slice(0,at).trim()]=raw.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function sql(query){const v=env(),ref=new URL(v.SUPABASE_URL).hostname.split('.')[0];const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+v.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error('MANAGEMENT_SQL_'+r.status);return r.json();}
async function inspect(){
 const names=['create_validated_program_product_payment_request','save_program_catalog_item','create_first_cirugias_program_catalog_item','resolve_suti_loan_quote_contract','resolve_suti_loan_quote_contract_v1_engine','normalize_suti_financial_key','get_financial_runtime_rules','approve_program_product_payment_request','generate_program_product_payment_schedule'];
 const definitions=await sql(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${names.map(n=>"'"+n+"'").join(',')})`);
 const migrations=await sql('select version,name from supabase_migrations.schema_migrations order by version desc limit 8');
 const columns=await sql("select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('program_catalog_items','segmentation_catalog_entries') order by table_name,ordinal_position");
 const grants=await sql("select grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='program_catalog_items'");
 const tables=await sql("select n.nspname schema,c.relname name,string_agg(quote_ident(a.attname)||' '||format_type(a.atttypid,a.atttypmod),',' order by a.attnum) columns from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped where (n.nspname='public' and c.relname in ('affiliates','program_catalog_items','program_requests','loan_term_policy','segmentation_catalog_entries','impersonation_sessions','admin_assignments','admin_roles','program_terms_versions','affiliate_documents','affiliate_files','private_assets','request_documents','sensitive_change_audit','program_request_admin_events','admin_audit_log')) or (n.nspname='auth' and c.relname='users') or (n.nspname='storage' and c.relname='objects') group by n.nspname,c.relname");
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'baseline.json'),JSON.stringify({definitions,migrations,columns,grants,tables},null,2));
 console.log(JSON.stringify({status:'PASS',mode:'READ_ONLY',functions:definitions.map(x=>x.signature),migrations,grants}));
}
async function apply(){
 // Run only after explicit owner approval of production installation.
 const id='20260922000200_program_product_financing',version='20260922000200';
 const migration=fs.readFileSync(path.join(root,'supabase/migrations',id+'.sql'),'utf8');
 const existing=await sql("select version from supabase_migrations.schema_migrations where version='"+version+"'");
 if(existing.length)throw Error('MIGRATION_ALREADY_REGISTERED');
 const body=migration.replace(/^begin;\s*/,'').replace(/\s*commit;\s*$/,'');
 const fingerprint=`select jsonb_build_object(
 'catalog',(select md5(coalesce(string_agg((to_jsonb(i)-'financing_config')::text,';' order by id),'')) from public.program_catalog_items i),
 'rules',(select md5(coalesce(string_agg(to_jsonb(r)::text,';' order by id),'')) from public.financial_rules r),
 'requests',(select md5(coalesce(string_agg(to_jsonb(r)::text,';' order by id),'')) from public.program_requests r),
 'assets',(select md5(coalesce(string_agg(to_jsonb(a)::text,';' order by id),'')) from public.program_catalog_item_assets a)) as value`;
 const transaction=`begin isolation level repeatable read;
 set local lock_timeout='2s';set local statement_timeout='60s';
 create temp table product_financing_before on commit drop as ${fingerprint};
 ${body}
 do $verify$ declare before_value jsonb;after_value jsonb;begin
 select value into before_value from product_financing_before;
 select value into after_value from (${fingerprint}) q;
 if before_value is distinct from after_value then raise exception 'PRODUCT_FINANCING_PROTECTED_DATA_CHANGED'; end if;
 if exists(select 1 from public.program_catalog_items where financing_config is not null) then raise exception 'PRODUCT_FINANCING_DEFAULT_CHANGED'; end if;
 if has_function_privilege('authenticated','public.resolve_program_product_financing(uuid,uuid,jsonb,numeric)','execute')
 or has_function_privilege('anon','public.save_program_catalog_item_financing(uuid,jsonb,jsonb,jsonb,jsonb,boolean)','execute')
 or has_column_privilege('authenticated','public.program_catalog_items','financing_config','update') then raise exception 'PRODUCT_FINANCING_GRANTS_INVALID'; end if;
 end $verify$;
 insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','program_product_financing',array[$migration$${migration}$migration$]);
 commit;`;
 await sql(transaction);
 const installed=await sql("select version,name from supabase_migrations.schema_migrations where version='"+version+"'");
 const receipt={status:'PASS',mode:'APPLIED',installed,protectedDataPreserved:true,defaultConfigurations:0};
 const out=path.join(root,'docs/qa/evidence/program-product-financing-20260922');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'migration-apply.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}
if(require.main===module)(process.argv.includes('--apply')?apply():inspect()).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={sql,root,dir};
