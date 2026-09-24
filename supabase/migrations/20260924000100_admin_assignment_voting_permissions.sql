begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Candidate only. Exact production baseline read on 2026-09-24.
-- Installation does not change accounts, assignments, section grants or history.
lock table public.admin_assignments in access exclusive mode;
lock table public.admin_section_responsibilities in share row exclusive mode;
lock table public.admin_roles,public.admin_role_permissions in share mode;
do $baseline$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check')
 is distinct from '2d001f1a4f3f0b8e4a3c8ae948647051' then raise exception 'PERMISSION_CONSTRAINT_DRIFT'; end if;
 if md5(pg_get_functiondef('public.revoke_admin_assignment(uuid)'::regprocedure))<>'d2341af7fe87c0be83ab40cdf86267bf'
 or md5(pg_get_functiondef('public.assign_admin_role(uuid,uuid,boolean)'::regprocedure))<>'4f36a81ae47f0996092c4a2a452a2bac'
 or md5(pg_get_functiondef('public.has_admin_permission(text)'::regprocedure))<>'ede6d35b74b6163f3765b518adead8ce'
 or md5(pg_get_functiondef('admin_support_private.has_admin_permission(uuid,text)'::regprocedure))<>'a1a563930a2d9bd5e6fafbcd3c4d63a9'
 then raise exception 'ADMIN_REVOCATION_FUNCTION_DRIFT'; end if;
end $baseline$;
-- Recovery metadata only; not an operational permissions source.
create table public.admin_assignment_voting_permissions_state_20260924000100 (
 singleton boolean primary key default true check(singleton),
 applied_at timestamptz not null default now(),
 prior_constraint_definition text not null, applied_constraint_hash text,
 prior_revoke_definition text not null, applied_revoke_hash text,
 assignments_hash text not null, responsibilities_hash text not null,
 roles_hash text not null, role_permissions_hash text not null,
 authorization_audit_hash text not null
);
alter table public.admin_assignment_voting_permissions_state_20260924000100 enable row level security;
alter table public.admin_assignment_voting_permissions_state_20260924000100 force row level security;
revoke all on public.admin_assignment_voting_permissions_state_20260924000100 from public,anon,authenticated,service_role;
insert into public.admin_assignment_voting_permissions_state_20260924000100(
 prior_constraint_definition,prior_revoke_definition,assignments_hash,responsibilities_hash,roles_hash,role_permissions_hash,authorization_audit_hash)
select pg_get_constraintdef(oid),pg_get_functiondef('public.revoke_admin_assignment(uuid)'::regprocedure),
 (select md5(coalesce(string_agg(to_jsonb(a)::text,'' order by a.id),'')) from public.admin_assignments a),
 (select md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),'')) from public.admin_section_responsibilities g),
 (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),'')) from public.admin_roles r),
 (select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by p.role_id,p.permission),'')) from public.admin_role_permissions p),
 (select md5(coalesce(string_agg(to_jsonb(e)::text,'' order by e.id),'')) from public.admin_audit_log e
  where resource in ('admin_assignments','admin_section_responsibilities','admin_roles','admin_role_permissions'))
from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check';
do $permissions$ declare prior text; begin
 select prior_constraint_definition into strict prior from public.admin_assignment_voting_permissions_state_20260924000100;
 execute 'alter table public.admin_assignments drop constraint admin_assignments_permissions_check';
 execute 'alter table public.admin_assignments add constraint admin_assignments_permissions_check '||replace(prior,'''savings.read''::text',
  '''votaciones.read''::text, ''votaciones.create''::text, ''votaciones.update''::text, ''votaciones.delete''::text, ''votaciones.publish''::text, ''votaciones.results''::text, ''votaciones.export_identified_votes''::text, ''savings.read''::text');
 if exists(select 1 from public.admin_role_permissions rp where not exists(
  select 1 from pg_constraint c where c.conrelid='public.admin_assignments'::regclass and c.conname='admin_assignments_permissions_check'
  and position(''''||rp.permission||'''::text' in pg_get_constraintdef(c.oid))>0))
 then raise exception 'ROLE_PERMISSION_OUTSIDE_ASSIGNMENT_CHECK'; end if;
end $permissions$;

create or replace function public.revoke_admin_assignment(p_auth_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_role uuid; v_actor uuid:=auth.uid(); v_before jsonb; v_after jsonb;
begin
 if v_actor is null or not public.has_admin_permission('authorization.write') then
  raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
 -- Serialize with existing assignment/section writers, including writers without
 -- the module editor advisory lock. Later explicit grants remain new decisions.
 lock table public.admin_assignments in share row exclusive mode;
 lock table public.admin_section_responsibilities in share row exclusive mode;
 if not public.has_admin_permission('authorization.write') then
  raise exception 'AUTHORIZATION_DENIED' using errcode='42501'; end if;
 select role_id into v_role from public.admin_assignments where auth_user_id=p_auth_user_id for update;
 if v_role is null then raise exception 'ADMIN_ASSIGNMENT_NOT_FOUND' using errcode='P0001'; end if;
 -- Canonical writer preserves self/attended/protected/last-principal guards,
 -- original grant metadata, audit, and termination of operator support sessions.
 perform public.assign_admin_role(p_auth_user_id,v_role,false);
 select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]'::jsonb) into v_before
 from public.admin_section_responsibilities g where g.auth_user_id=p_auth_user_id and g.enabled;
 update public.admin_section_responsibilities set enabled=false,revoked_at=now(),
  revoked_by_auth_user_id=v_actor,updated_at=now() where auth_user_id=p_auth_user_id and enabled;
 select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]'::jsonb) into v_after
 from public.admin_section_responsibilities g where g.auth_user_id=p_auth_user_id
 and g.id in (select (entry->>'id')::uuid from jsonb_array_elements(v_before) entry);
 insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
 values(v_actor,'admin_section_responsibilities','REVOKE',p_auth_user_id::text,'SUCCESS',
  jsonb_build_object('subject_auth_user_id',p_auth_user_id,'before',v_before,'after',v_after,
   'cause','ADMIN_ASSIGNMENT_REVOKED','migration','20260924000100'));
 return true;
end $function$;
-- CREATE OR REPLACE preserves the installed OID, owner and ACL.
update public.admin_assignment_voting_permissions_state_20260924000100 set
 applied_constraint_hash=(select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check'),
 applied_revoke_hash=md5(pg_get_functiondef('public.revoke_admin_assignment(uuid)'::regprocedure));
commit;
