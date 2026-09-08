begin;
-- Prepare already locks existing outbox rows; avoid worker row -> parent lock inversion.
create or replace function public.guard_request_deletion_child() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb; prior jsonb; p text; parent_id uuid;
begin
  v:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  prior:=case when tg_op='UPDATE' then to_jsonb(old) else v end;
  for parent_id in select distinct x::uuid from unnest(array[coalesce(v->>'request_id',v->>'program_request_id',v->>'quote_request_id'),coalesce(prior->>'request_id',prior->>'program_request_id',prior->>'quote_request_id')]) x where x is not null order by x::uuid loop
    -- Serialize child mutations with prepare's parent lock before checking the journal.
    if tg_table_name<>'program_request_google_sync' or tg_op='INSERT' or
       (tg_op='UPDATE' and v->>'request_id' is distinct from prior->>'request_id') then
      perform 1 from public.program_requests where id=parent_id for key share;
    end if;
    select phase into p from public.program_request_deletions where request_id=parent_id;
    if p is not null and not(tg_op='DELETE' and p='google_deleted' and coalesce(auth.role(),'')='service_role') then raise exception 'REQUEST_DELETE_IN_PROGRESS';end if;
  end loop;
  return case when tg_op='DELETE' then old else new end;
end $$;
commit;
