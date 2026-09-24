begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- NO-USE schema recovery only. Never re-enable an administrator or delete audit
-- history/assignment permissions to force rollback. After use, prefer forward repair.
lock table public.admin_assignments in access exclusive mode;
lock table public.admin_section_responsibilities in share row exclusive mode;
lock table public.admin_roles,public.admin_role_permissions in share mode;
lock table public.admin_audit_log in share mode;
do $recovery$
declare state public.admin_assignment_voting_permissions_state_20260924000100%rowtype;
begin
 select * into strict state from public.admin_assignment_voting_permissions_state_20260924000100;
 if state.applied_constraint_hash is distinct from (select md5(pg_get_constraintdef(oid)) from pg_constraint
  where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check')
 or state.applied_revoke_hash is distinct from md5(pg_get_functiondef('public.revoke_admin_assignment(uuid)'::regprocedure))
 then raise exception 'RECOVERY_BLOCKED_DEFINITION_DRIFT'; end if;
 if state.assignments_hash is distinct from (select md5(coalesce(string_agg(to_jsonb(a)::text,'' order by a.id),'')) from public.admin_assignments a)
 or state.responsibilities_hash is distinct from (select md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),'')) from public.admin_section_responsibilities g)
 or state.roles_hash is distinct from (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),'')) from public.admin_roles r)
 or state.role_permissions_hash is distinct from (select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by p.role_id,p.permission),'')) from public.admin_role_permissions p)
 or state.authorization_audit_hash is distinct from (select md5(coalesce(string_agg(to_jsonb(e)::text,'' order by e.id),'')) from public.admin_audit_log e
  where resource in ('admin_assignments','admin_section_responsibilities','admin_roles','admin_role_permissions'))
 then raise exception 'RECOVERY_BLOCKED_AUTHORIZATION_HISTORY'; end if;
 execute 'alter table public.admin_assignments drop constraint admin_assignments_permissions_check';
 execute 'alter table public.admin_assignments add constraint admin_assignments_permissions_check '||state.prior_constraint_definition;
 execute state.prior_revoke_definition;
end $recovery$;
drop table public.admin_assignment_voting_permissions_state_20260924000100;
commit;
