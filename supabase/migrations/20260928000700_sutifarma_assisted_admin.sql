begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

do $guard$ begin
 if md5(pg_get_functiondef('farma_private.allowed(text)'::regprocedure))<>'6ca73476d701cb7cee2ffbc943936720' then
  raise exception 'FARMA_ASSISTED_BASELINE_DRIFT';
 end if;
 if exists(select 1 from farma_private.definition_backup where signature='farma_private.allowed(text)') then
  raise exception 'FARMA_ASSISTED_BACKUP_EXISTS';
 end if;
end $guard$;

insert into farma_private.definition_backup(signature,definition)
values('farma_private.allowed(text)',pg_get_functiondef('farma_private.allowed(text)'::regprocedure));

create or replace function farma_private.allowed(p_action text default 'read') returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and public.has_admin_permission('program_catalog.'||case when p_action='read' then 'read' else 'write' end)
 and (not public.is_module_admin() or public.has_admin_module('farma',p_action) or public.has_admin_module('program_products',p_action));
$$;

do $verify$ begin
 if pg_get_userbyid((select proowner from pg_proc where oid='farma_private.allowed(text)'::regprocedure))<>'postgres'
 or (select proacl::text from pg_proc where oid='farma_private.allowed(text)'::regprocedure)<>'{postgres=X/postgres}' then
  raise exception 'FARMA_ASSISTED_FUNCTION_SECURITY_DRIFT';
 end if;
end $verify$;
commit;
