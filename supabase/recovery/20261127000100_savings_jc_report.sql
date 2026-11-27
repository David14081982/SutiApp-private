-- Recovery for H-SAVINGS-JC-REPORT-001. Revert the frontend button and the savings-jc-report Edge first.
-- Drops only the additive read function; no financial data is touched.
begin;
set local lock_timeout='2s';
drop function if exists public.get_admin_savings_jc_report();
delete from supabase_migrations.schema_migrations where version='20261127000100' and name='savings_jc_report';
notify pgrst,'reload schema';
commit;
