begin;
CREATE OR REPLACE FUNCTION public.guard_request_deletion_child()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb; prior jsonb; p text; parent_id uuid;
begin
  v:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  prior:=case when tg_op='UPDATE' then to_jsonb(old) else v end;
  for parent_id in select distinct x::uuid from unnest(array[coalesce(v->>'request_id',v->>'program_request_id',v->>'quote_request_id'),coalesce(prior->>'request_id',prior->>'program_request_id',prior->>'quote_request_id')]) x where x is not null order by x::uuid loop
    -- Serialize child mutations with prepare's parent lock before checking the journal.
    perform 1 from public.program_requests where id=parent_id for key share;
    select phase into p from public.program_request_deletions where request_id=parent_id;
    if p is not null and not(tg_op='DELETE' and p='google_deleted' and coalesce(auth.role(),'')='service_role') then raise exception 'REQUEST_DELETE_IN_PROGRESS';end if;
  end loop;
  return case when tg_op='DELETE' then old else new end;
end $function$
;
commit;
