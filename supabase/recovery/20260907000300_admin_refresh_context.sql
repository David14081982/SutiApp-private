-- Restore the previous frontend first. No business tables/data are changed.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
do $recovery$
begin
  if md5(pg_get_functiondef(to_regprocedure('public.get_admin_refresh_context()'))) is distinct from '40c99eff8e19fedb085b205f9406550d' then
    raise exception 'H03_RECOVERY_DEFINITION_REVIEW_REQUIRED';
  end if;
  if obj_description(to_regprocedure('public.get_admin_refresh_context()'),'pg_proc') is distinct from
    'H03: delegates security to get_admin_access_context; ephemeral RLS-visible MVCC fingerprints, never authorization or persisted business versions.' then
    raise exception 'H03_RECOVERY_DEFINITION_REVIEW_REQUIRED';
  end if;
end;
$recovery$;
drop function public.get_admin_refresh_context();
commit;
