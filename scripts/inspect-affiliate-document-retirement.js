'use strict';
// Catalog only. No document bytes, paths, users, or business rows are captured.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {query}=require('./investors-db');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/affiliate-document-retirement');
const names=['affiliate_documents','affiliate_files','private_assets','document_types','sensitive_change_audit','affiliate_admin_events','affiliates','request_documents','savings_requests','program_terms_versions','historical_asset_sources','program_catalog_item_assets','financial_programs','impersonation_sessions'];
const functions=['get_admin_affiliate_workbench','list_admin_affiliates','list_admin_archived_affiliates','list_admin_affiliate_documents','list_effective_affiliate_documents','authorize_admin_document_preview','authorize_self_document_preview','get_affiliate_document_availability','register_admin_affiliate_document','register_affiliate_document','review_affiliate_document','refresh_affiliate_expediente_classification','enforce_request_document_availability','has_admin_permission','admin_module_boundary','has_admin_module','module_visible'];
async function main(){
 fs.mkdirSync(dir,{recursive:true});
 const list=names.map(n=>"'"+n+"'").join(','),fns=functions.map(n=>"'"+n+"'").join(',');
 const rows=await query(`select jsonb_build_object(
 'columns',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by n.nspname,c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where ((n.nspname='public' and c.relname in (${list})) or (n.nspname='storage' and c.relname in('objects','buckets'))) and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',r.relname,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid))) from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname in (${list})),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'name',p.proname,'schema',n.nspname,'definition',pg_get_functiondef(p.oid),'md5',md5(pg_get_functiondef(p.oid)),'oid',p.oid,'owner',p.proowner,'acl',p.proacl)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','admin_support_private') and p.proname in (${fns})),
 'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where (schemaname='public' and tablename in('affiliate_documents','affiliate_files','private_assets')) or (schemaname='storage' and tablename='objects')),
 'triggers',(select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid))) from pg_trigger t where not t.tgisinternal and t.tgrelid in ('public.affiliate_documents'::regclass,'public.affiliate_files'::regclass)),
 'asset_references',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'column',a.attname,'target',c.confrelid::regclass::text)) from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.contype='f' and c.confrelid in('public.affiliate_documents'::regclass,'public.affiliate_files'::regclass,'public.private_assets'::regclass)),
 'views',(select jsonb_agg(jsonb_build_object('schema',schemaname,'name',viewname,'definition',definition)) from pg_views where schemaname='public' and definition ilike '%affiliate_documents%')
 ) catalog`);
 const catalog=rows[0].catalog,bytes=JSON.stringify(catalog,null,2)+'\n';
 const target=path.join(dir,'catalog.json');if(fs.existsSync(target))throw Error('BASELINE_EXISTS');fs.writeFileSync(target,bytes);
 // Schema fixture is public metadata; contains no business rows or credentials.
 fs.writeFileSync(path.join(root,'scripts/fixtures/affiliate-document-retirement-schema.json'),bytes);
 console.log(JSON.stringify({status:'PASS',tables:new Set(catalog.columns.map(c=>c.schema+'.'+c.table)).size,functions:catalog.functions.map(f=>f.signature),references:catalog.asset_references,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),businessRowsCopied:0}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
