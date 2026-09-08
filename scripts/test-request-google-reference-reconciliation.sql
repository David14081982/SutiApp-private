select set_config('request.jwt.claim.role','service_role',true);
do $$
declare s public.program_request_google_sync%rowtype; original_request jsonb; result jsonb; audit_before bigint;
begin
  select * into s from public.program_request_google_sync where request_id='af0f53b7-a990-491c-a792-e69f30760fe4';
  if s.request_id is null or s.initial_row is null then raise exception 'TEST_SOURCE_UNAVAILABLE'; end if;
  select to_jsonb(r) into original_request from public.program_requests r where id=s.request_id;
  select count(*) into audit_before from public.program_request_google_reference_audit;
  -- Real existing request, metadata changes only, enclosed by caller's ROLLBACK.
  update public.program_request_google_sync set phase='processing',leased_revision=revision,lease_until=now()+interval '90 seconds' where request_id=s.request_id;
  result:=public.finish_program_request_google_sync(s.request_id,s.revision,s.initial_row,2317,null);
  if result->>'phase'<>'synced' or (result->>'google_row')::int<>2317 then raise exception 'RELOCATION_FAILED'; end if;
  if exists(select 1 from public.program_request_google_sync where request_id=s.request_id and (lease_until is not null or leased_revision is not null)) then raise exception 'LEASE_NOT_CLEARED'; end if;
  if (select to_jsonb(r) from public.program_requests r where id=s.request_id)<>original_request then raise exception 'BUSINESS_REQUEST_CHANGED'; end if;
  if (select count(*) from public.program_request_google_reference_audit)<>audit_before+(case when s.google_row<>2317 then 1 else 0 end) then raise exception 'RELOCATION_AUDIT_FAILED'; end if;
  perform public.finish_program_request_google_sync(s.request_id,s.revision,s.initial_row,2317,null);
  begin
    perform public.finish_program_request_google_sync(s.request_id,s.revision,jsonb_set(s.initial_row,'{1}','"other-control"'),2317,null);
    raise exception 'INVALID_PAYLOAD_ACCEPTED';
  exception when sqlstate '22023' then if sqlerrm<>'REQUEST_SYNC_INITIAL_ROW_CHANGED' then raise; end if; end;
  begin
    perform public.finish_program_request_google_sync(s.request_id,s.revision,s.initial_row,2300,null);
    raise exception 'STALE_LEASE_ACCEPTED';
  exception when sqlstate '22023' then if sqlerrm<>'REQUEST_SYNC_REFERENCE_LEASE_REQUIRED' then raise; end if; end;
  update public.program_request_google_sync set phase='processing',leased_revision=revision,lease_until=now()+interval '90 seconds' where request_id=s.request_id;
  result:=public.finish_program_request_google_sync(s.request_id,s.revision,s.initial_row,null,'REQUEST_SYNC_TARGET_MISSING');
  if result->>'phase'<>'error' or result->>'error_code'<>'REQUEST_SYNC_TARGET_MISSING' then raise exception 'MISSING_NOT_VISIBLE'; end if;
  if exists(select 1 from public.program_request_google_sync where request_id=s.request_id and lease_until is not null) then raise exception 'ERROR_LEASE_NOT_CLEARED'; end if;
  update public.program_request_google_sync set phase='processing',leased_revision=revision,lease_until=now()+interval '90 seconds' where request_id=s.request_id;
  result:=public.finish_program_request_google_sync(s.request_id,s.revision,s.initial_row,2317,null);
  if result->>'phase'<>'synced' or result ? 'error_code' then raise exception 'RESTORE_FAILED'; end if;
  if (select to_jsonb(r) from public.program_requests r where id=s.request_id)<>original_request then raise exception 'BUSINESS_REQUEST_CHANGED'; end if;
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform public.finish_program_request_google_sync(s.request_id,s.revision,s.initial_row,2317,null);
    raise exception 'BROWSER_ACCEPTED';
  exception when sqlstate '42501' then null; end;
  perform set_config('request.jwt.claim.role','service_role',true);
  if has_table_privilege('authenticated','public.program_request_google_reference_audit','SELECT')
     or has_table_privilege('anon','public.program_request_google_reference_audit','SELECT')
     or has_table_privilege('service_role','public.program_request_google_reference_audit','UPDATE')
     or has_table_privilege('service_role','public.program_request_google_reference_audit','DELETE')
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.program_request_google_reference_audit'::regclass)
  then raise exception 'AUDIT_SECURITY_FAILED'; end if;
end $$;
