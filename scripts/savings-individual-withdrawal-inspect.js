'use strict';
// Read-only production metadata and aggregate fingerprints. Never returns account rows.
const fs=require('fs'),path=require('path');
const {query}=require('./savings-admin-review-db');
const dir=path.resolve(__dirname,'../.tmp/savings-individual-withdrawal');
const tables=['affiliates','savings_participants','savings_enrollments','savings_action_availability','savings_audit_events','savings_operation_settings'];
async function main(){
 fs.mkdirSync(dir,{recursive:true});
 const names=tables.map(n=>"'"+n+"'").join(',');
 const columns=await query(`select c.relname table_name,a.attname column_name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull required,pg_get_expr(d.adbin,d.adrelid) default_value from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relname in (${names}) and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`);
 const constraints=await query(`select c.relname table_name,ct.contype,pg_get_constraintdef(ct.oid) definition from pg_constraint ct join pg_class c on c.oid=ct.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${names})`);
 const definitions=await query(`select proname name,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname in ('savings_effective_action','savings_runtime_assert_identity','savings_runtime_submit','savings_runtime_assert_payout','has_admin_permission','get_admin_savings_runtime_requests')`);
 const metadata=await query(`select c.relname,c.relrowsecurity,c.relforcerowsecurity,(select count(*) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) custom_triggers from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${names})`);
 const fingerprints=await query(['savings_transactions','savings_holds','savings_requests','savings_yield_periods','savings_yield_allocations','savings_contribution_plans','savings_action_availability','savings_withdrawal_openings'].map(n=>`select '${n}' resource,count(*) total,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by id),'')) fingerprint from public.${n} t`).join(' union all '));
 fs.writeFileSync(path.join(dir,'schema.json'),JSON.stringify({columns,constraints,definitions,metadata},null,2));
 fs.writeFileSync(path.join(dir,'before-fingerprints.json'),JSON.stringify(fingerprints,null,2));
 console.log(JSON.stringify({status:'PASS',readOnly:true,definitions:definitions.length,tables:metadata,fingerprints}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
