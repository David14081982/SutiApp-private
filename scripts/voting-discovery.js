'use strict';
const {query}=require('./savings-admin-review-db');
query(`select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='admin_support_private' and p.proname in ('has_admin_permission','context')) or (n.nspname='public' and p.proname in ('list_admin_section_definitions','save_admin_section_responsibility','list_admin_section_catalog','set_admin_section_actions'))),
 'affiliate_columns',(select jsonb_agg(column_name) from information_schema.columns where table_schema='public' and table_name='affiliates'),
 'catalog',(select jsonb_agg(jsonb_build_object('type',catalog_type,'code',code,'label',label)) from public.segmentation_catalog_entries where enabled),
 'voting_existing',(select jsonb_agg(table_name) from information_schema.tables where table_schema='public' and table_name ~ '(vot|poll|ballot)'),
 'section_columns',(select jsonb_agg(column_name) from information_schema.columns where table_schema='public' and table_name='admin_section_definitions')) result`)
.then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
