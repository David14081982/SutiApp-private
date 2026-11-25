'use strict';
const C=require('./common.cjs');
const dir=C.path.join(C.root,'.tmp/seniority');
async function main(){const db=C.connection(C.environment());await db.connect();try{
 const queries={
 columns:`select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='affiliates' order by ordinal_position`,
 policies:`select policyname,roles,cmd,qual from pg_policies where schemaname='public' and tablename='affiliates'`,
 functions:`select n.nspname,p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and n.nspname in('public','affiliate_access_private') and (p.proname ~ '(seniority|antiguedad)' or p.proname in('get_current_affiliate_access_state','get_effective_affiliate_id','has_admin_permission','get_impersonation_context'))`,
 codes:`select financial_union_code,affiliate_status_raw,financial_employee_category_code,count(*)::int n from public.affiliates group by 1,2,3 order by n desc`,
 formats:`select case when employment_entry_date_raw is null or btrim(employment_entry_date_raw)='' then 'empty' when btrim(employment_entry_date_raw) ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$' then 'DMY' when btrim(employment_entry_date_raw) ~ '^\\d{4}-\\d{2}-\\d{2}$' then 'ISO' else 'other' end format,count(*)::int n from public.affiliates where upper(btrim(financial_union_code))='SUTISSSSTESON' and upper(btrim(affiliate_status_raw))='ACTIVO' and upper(btrim(financial_employee_category_code)) not in ('BASE','JUBILADOS_PENSIONADOS') group by 1`,
 summary:`select count(*)::int total,count(distinct id)::int distinct_ids,count(distinct unit_raw)::int units,count(*) filter(where unit_raw is null or btrim(unit_raw)='')::int missing_unit,count(*) filter(where auth_user_id is null)::int without_auth from public.affiliates where upper(btrim(financial_union_code))='SUTISSSSTESON' and upper(btrim(affiliate_status_raw))='ACTIVO' and upper(btrim(financial_employee_category_code)) not in ('BASE','JUBILADOS_PENSIONADOS')`,
 };
 queries.realFormats=`select regexp_replace(employment_entry_date_raw,'[0-9]','9','g') pattern,count(*)::int n from public.affiliates where financial_union_code='SUTISSSTESON' and upper(btrim(affiliate_status_raw))='ACTIVO' and financial_employee_category_code not in ('BASE','JUBILADOS_PENSIONADOS') group by 1 order by n desc`;
 queries.realUnits=`select count(distinct unit_raw)::int raw_units,count(distinct upper(btrim(unit_raw)))::int normalized_units,count(*) filter(where unit_raw is null or btrim(unit_raw)='')::int missing_unit from public.affiliates where financial_union_code='SUTISSSTESON' and upper(btrim(affiliate_status_raw))='ACTIVO' and financial_employee_category_code not in ('BASE','JUBILADOS_PENSIONADOS')`;
 const result={};for(const[k,q]of Object.entries(queries))result[k]=(await db.query(q)).rows;
 C.fs.mkdirSync(dir,{recursive:true});C.fs.writeFileSync(C.path.join(dir,'inspect.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({formats:result.realFormats,units:result.realUnits,literalFilter:result.summary}));
}finally{await db.end();}}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
