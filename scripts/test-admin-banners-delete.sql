-- Run inside a caller-owned transaction; every business/permission write is rolled back.
select set_config('request.jwt.claim.sub',current_setting('test.banner_actor'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('test.banner_active',(select id::text from public.banners where enabled order by id limit 1),true);
select set_config('test.banner_inactive',(select id::text from public.banners where not enabled order by id limit 1),true);
select set_config('test.banner_hash',(select md5(string_agg(to_jsonb(b)::text,'' order by id)) from public.banners b),true);
select set_config('test.banner_audit_count',(select count(*)::text from public.admin_audit_log where resource='banners' and action='BANNERS_DELETE'),true);
select set_config('test.banner_normal',(select id::text from auth.users where id<>current_setting('test.banner_actor')::uuid and not exists(select 1 from public.admin_assignments a where a.auth_user_id=auth.users.id and enabled) and not exists(select 1 from public.admin_section_responsibilities s where s.auth_user_id=auth.users.id and enabled) order by id limit 1),true);
set local role authenticated;
do $$ declare a uuid:=current_setting('test.banner_active')::uuid;i uuid:=current_setting('test.banner_inactive')::uuid;r jsonb;r2 jsonb;n integer;begin
  if a is null or i is null then raise exception 'ACTIVE_INACTIVE_REQUIRED';end if;
  r:=public.archive_admin_banner(i);r2:=public.archive_admin_banner(i);
  if r<>r2 or r->>'deleted'<>'true' then raise exception 'IDEMPOTENCY_FAILED';end if;
  r:=public.archive_admin_banner(a);
  if r->>'id'<>a::text then raise exception 'ACTIVE_ARCHIVE_FAILED';end if;
  if exists(select 1 from public.banners where id in(a,i)) then raise exception 'ADMIN_STILL_VISIBLE';end if;
  update public.banners set enabled=true where id=a;get diagnostics n=row_count;
  if n<>0 then raise exception 'ARCHIVED_UPDATE_ALLOWED';end if;
  delete from public.banners where id=a;get diagnostics n=row_count;
  if n<>0 then raise exception 'ARCHIVED_DELETE_ALLOWED';end if;
  begin perform * from public.banner_deletions;raise exception 'PRIVATE_AUDIT_EXPOSED';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
  if (select md5(string_agg(to_jsonb(b)::text,'' order by id)) from public.banners b)<>current_setting('test.banner_hash') then raise exception 'MASTER_HISTORY_CHANGED';end if;
  if (select count(*) from public.admin_audit_log where resource='banners' and action='BANNERS_DELETE')<>current_setting('test.banner_audit_count')::int+2 then raise exception 'AUDIT_DUPLICATED_OR_MISSING';end if;
  if (select count(*) from public.banner_deletions d join public.admin_audit_log l on l.target_id=d.banner_id::text and l.action='BANNERS_DELETE' and l.actor_auth_user_id=d.actor_auth_user_id and (l.details->>'deleted_at')::timestamptz=d.deleted_at where d.banner_id in(current_setting('test.banner_active')::uuid,current_setting('test.banner_inactive')::uuid) and d.actor_auth_user_id=current_setting('test.banner_actor')::uuid)<>2 then raise exception 'AUDIT_ACTOR_TIME_FAILED';end if;
  if not exists(select 1 from public.banners b join public.banner_deletions d on d.banner_id=b.id where record_origin='HISTORICAL_IMPORT') then raise exception 'HISTORICAL_ARCHIVE_UNTESTED';end if;
end $$;
set local role anon;
do $$ begin
  if exists(select 1 from public.banners where id in(current_setting('test.banner_active')::uuid,current_setting('test.banner_inactive')::uuid)) then raise exception 'PUBLIC_STILL_VISIBLE';end if;
  begin perform public.archive_admin_banner(current_setting('test.banner_active')::uuid);raise exception 'ANON_ALLOWED';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.banner_normal'),true);
set local role authenticated;
do $$ begin
  if auth.uid() is null then raise exception 'NORMAL_USER_REQUIRED';end if;
  begin perform public.archive_admin_banner(current_setting('test.banner_active')::uuid);raise exception 'NORMAL_USER_ALLOWED';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Existing exact section actions: update/read do not confer delete.
insert into public.admin_section_responsibilities(auth_user_id,section_key,action,granted_by_auth_user_id)
  select current_setting('test.banner_normal')::uuid,'banners',a,current_setting('test.banner_actor')::uuid from unnest(array['read','update']) a;
set local role authenticated;
do $$ begin
  begin perform public.archive_admin_banner(current_setting('test.banner_active')::uuid);raise exception 'UPDATE_ONLY_ALLOWED';exception when insufficient_privilege then null;end;
end $$;
reset role;
delete from public.admin_section_responsibilities where auth_user_id=current_setting('test.banner_normal')::uuid and section_key='banners' and action in('read','update');
insert into public.admin_section_responsibilities(auth_user_id,section_key,action,granted_by_auth_user_id)
  values(current_setting('test.banner_normal')::uuid,'banners','delete',current_setting('test.banner_actor')::uuid);
select set_config('test.banner_section_target',(select id::text from public.banners where id not in(current_setting('test.banner_active')::uuid,current_setting('test.banner_inactive')::uuid) order by id limit 1),true);
set local role authenticated;
do $$ declare r jsonb;begin
  r:=public.archive_admin_banner(current_setting('test.banner_section_target')::uuid);
  if r->>'deleted'<>'true' then raise exception 'EXACT_DELETE_DENIED';end if;
  begin perform public.archive_admin_banner('00000000-0000-0000-0000-000000000000');raise exception 'MISSING_SUCCEEDED';exception when no_data_found then null;end;
end $$;
reset role;
-- A failing audit write must roll back the lifecycle marker atomically.
select set_config('test.banner_failure_target',(select id::text from public.banners where not public.is_banner_archived(id) order by id limit 1),true);
alter table public.admin_audit_log add constraint banners_test_audit_failure check(action<>'BANNERS_DELETE') not valid;
set local role authenticated;
do $$ begin
  begin perform public.archive_admin_banner(current_setting('test.banner_failure_target')::uuid);raise exception 'AUDIT_FAILURE_NOT_ATOMIC';exception when check_violation then null;end;
end $$;
reset role;
alter table public.admin_audit_log drop constraint banners_test_audit_failure;
do $$ begin
  if public.is_banner_archived(current_setting('test.banner_failure_target')::uuid) then raise exception 'FAILED_ARCHIVE_PERSISTED';end if;
end $$;
select 'PASS' as status,'active/inactive/historical/admin/public/denied/exact-delete/audit/idempotency/history' as checks;
