begin;

create table public.program_request_deletions (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null unique,
  folio text not null,
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check(length(btrim(reason)) between 3 and 2000),
  phase text not null default 'prepared' check(phase in('prepared','google_deleted','completed')),
  snapshot jsonb not null,
  google_backup jsonb null,
  google_deleted_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);
alter table public.program_request_deletions enable row level security;
alter table public.program_request_deletions force row level security;
revoke all on public.program_request_deletions from public,anon,authenticated,service_role;
grant select on public.program_request_deletions to service_role;

create function public.get_admin_request_delete_preview(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.program_requests%rowtype; d public.program_request_deletions%rowtype;
begin
  if auth.uid() is null or not public.has_admin_permission('program_requests.write') then raise exception 'REQUEST_DELETE_DENIED' using errcode='42501';end if;
  select * into r from public.program_requests where id=p_request_id;
  select * into d from public.program_request_deletions where request_id=p_request_id;
  if r.id is null and d.phase='completed' then return jsonb_build_object('request_id',p_request_id,'folio',d.folio,'phase','completed','documents_count',0);end if;
  if r.id is null then raise exception 'REQUEST_NOT_FOUND';end if;
  if exists(select 1 from public.program_requests x where x.id<>r.id and x.financial_submission_snapshot->>'quote_request_id'=r.id::text) then raise exception 'REQUEST_DELETE_DEPENDENT_REQUEST';end if;
  return jsonb_build_object('request_id',r.id,'folio',r.folio,'updated_at',r.updated_at,'documents_count',(select count(*) from public.request_documents where request_id=r.id),'phase',coalesce(d.phase,'available'));
end $$;

create function public.prepare_admin_request_delete(p_request_id uuid,p_folio text,p_updated_at timestamptz,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.program_requests%rowtype; d public.program_request_deletions%rowtype; v jsonb;
begin
  perform public.get_admin_request_delete_preview(p_request_id);
  select * into r from public.program_requests where id=p_request_id for update;
  select * into d from public.program_request_deletions where request_id=p_request_id;
  if d.id is not null then
    if d.folio<>p_folio then raise exception 'REQUEST_DELETE_CONFIRMATION_MISMATCH';end if;
    return jsonb_build_object('id',d.id,'request_id',d.request_id,'folio',d.folio,'phase',d.phase);
  end if;
  if r.id is null then raise exception 'REQUEST_NOT_FOUND';end if;
  if p_folio is distinct from r.folio then raise exception 'REQUEST_DELETE_CONFIRMATION_MISMATCH';end if;
  if p_updated_at is distinct from r.updated_at then raise exception 'REQUEST_DELETE_CHANGED';end if;
  if length(btrim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'REQUEST_DELETE_REASON_REQUIRED';end if;
  perform 1 from public.program_request_google_sync where request_id=r.id for update;
  if exists(select 1 from public.program_request_google_sync where request_id=r.id and lease_until>now()) or exists(select 1 from public.financial_request_export_audit where program_request_id=r.id and export_status='in_progress') then raise exception 'REQUEST_DELETE_SYNC_BUSY';end if;
  if exists(select 1 from public.program_requests x where x.id<>r.id and x.financial_submission_snapshot->>'quote_request_id'=r.id::text) then raise exception 'REQUEST_DELETE_DEPENDENT_REQUEST';end if;
  v:=jsonb_build_object('request',to_jsonb(r),
    'documents',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.request_documents x where request_id=r.id),
    'events',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.program_request_admin_events x where request_id=r.id),
    'tracking',(select to_jsonb(x) from public.operational_request_tracking x where request_id=r.id),
    'deposit',(select to_jsonb(x) from public.loan_request_deposit_snapshots x where request_id=r.id),
    'sync',(select to_jsonb(x) from public.program_request_google_sync x where request_id=r.id),
    'export',(select to_jsonb(x) from public.financial_request_export_audit x where program_request_id=r.id),
    'references',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.program_request_google_reference_audit x where request_id=r.id),
    'sessions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.financial_session_snapshots x where quote_request_id=r.id));
  insert into public.program_request_deletions(request_id,folio,actor_auth_user_id,reason,snapshot)
    values(r.id,r.folio,auth.uid(),btrim(p_reason),v) returning * into d;
  return jsonb_build_object('id',d.id,'request_id',r.id,'folio',r.folio,'phase',d.phase);
end $$;

create function public.guard_request_deletion() returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_phase text;
begin
  v_id:=case when tg_op='DELETE' then old.id else new.id end;
  if tg_op<>'DELETE' then
    perform 1 from public.program_requests where id::text=new.financial_submission_snapshot->>'quote_request_id' for key share;
  end if;
  select phase into v_phase from public.program_request_deletions where request_id=v_id;
  if v_phase is not null and not(tg_op='DELETE' and v_phase='google_deleted' and coalesce(auth.role(),'')='service_role') then raise exception 'REQUEST_DELETE_IN_PROGRESS';end if;
  if tg_op<>'DELETE' and exists(select 1 from public.program_request_deletions where request_id::text=new.financial_submission_snapshot->>'quote_request_id') then raise exception 'REQUEST_DELETE_DEPENDENT_REQUEST';end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger program_requests_00_deletion_guard before insert or update or delete on public.program_requests for each row execute function public.guard_request_deletion();

create function public.guard_request_deletion_child() returns trigger language plpgsql security definer set search_path='' as $$
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
end $$;
do $$ declare t text;begin
  foreach t in array array['request_documents','program_request_admin_events','operational_request_tracking','loan_request_deposit_snapshots','program_request_google_sync','financial_request_export_audit','program_request_google_reference_audit','financial_session_snapshots'] loop
    execute format('create trigger request_delete_guard before insert or update or delete on public.%I for each row execute function public.guard_request_deletion_child()',t);
  end loop;
end $$;

-- Same signature and grants; an active deletion is never eligible for a sync lease.
create or replace function public.claim_program_request_google_sync(p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.program_request_google_sync%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
  select * into s from public.program_request_google_sync q
  where (p_request_id is null or q.request_id=p_request_id) and phase<>'synced'
    and (lease_until is null or lease_until<now()) and next_attempt_at<=now()
    and not exists(select 1 from public.program_request_deletions d where d.request_id=q.request_id)
  order by next_attempt_at,request_id for update skip locked limit 1;
  if s.request_id is null then return null;end if;
  update public.program_request_google_sync set phase='processing',lease_until=now()+interval '90 seconds',leased_revision=revision,attempts=attempts+1,updated_at=now() where request_id=s.request_id returning * into s;
  return to_jsonb(s);
end $$;

create function public.record_request_delete_google(p_deletion_id uuid,p_backup jsonb,p_deleted boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.program_request_deletions%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
  select * into d from public.program_request_deletions where id=p_deletion_id for update;
  if d.id is null then raise exception 'REQUEST_DELETE_NOT_PREPARED';end if;
  if p_backup is not null and (p_backup->>'program_request_id' is distinct from d.request_id::text or p_backup->>'operation_id' is distinct from d.id::text) then raise exception 'REQUEST_DELETE_BACKUP_MISMATCH';end if;
  if d.google_backup is not null and p_backup is not null and d.google_backup is distinct from p_backup then raise exception 'REQUEST_DELETE_BACKUP_MISMATCH';end if;
  if d.google_backup is null and p_backup is null then raise exception 'REQUEST_DELETE_BACKUP_REQUIRED';end if;
  update public.program_request_deletions set google_backup=coalesce(google_backup,p_backup),phase=case when phase='completed' then phase when p_deleted then 'google_deleted' else phase end,google_deleted_at=case when p_deleted then coalesce(google_deleted_at,now()) else google_deleted_at end where id=d.id;
  return jsonb_build_object('ok',true);
end $$;

create function public.finish_admin_request_delete(p_deletion_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.program_request_deletions%rowtype; r public.program_requests%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
  select * into d from public.program_request_deletions where id=p_deletion_id for update;
  if d.id is null then raise exception 'REQUEST_DELETE_NOT_PREPARED';end if;
  if d.phase='completed' then return jsonb_build_object('deleted',true,'request_id',d.request_id,'folio',d.folio);end if;
  if d.phase<>'google_deleted' or d.google_backup is null then raise exception 'REQUEST_DELETE_GOOGLE_NOT_CONFIRMED';end if;
  select * into r from public.program_requests where id=d.request_id for update;
  if r.id is null or to_jsonb(r) is distinct from d.snapshot->'request' then raise exception 'REQUEST_DELETE_CHANGED';end if;
  if exists(select 1 from public.program_requests x where x.id<>r.id and x.financial_submission_snapshot->>'quote_request_id'=r.id::text) then raise exception 'REQUEST_DELETE_DEPENDENT_REQUEST';end if;
  -- Preserve actor attribution in the existing audit trigger; never impersonate the affiliate.
  perform set_config('request.jwt.claim.sub',d.actor_auth_user_id::text,true);
  delete from public.financial_session_snapshots where quote_request_id=r.id;
  delete from public.program_request_google_reference_audit where request_id=r.id;
  delete from public.program_request_admin_events where request_id=r.id;
  delete from public.financial_request_export_audit where program_request_id=r.id;
  delete from public.program_request_google_sync where request_id=r.id;
  delete from public.program_requests where id=r.id;
  -- Request documents/tracking/deposit snapshots cascade; affiliate documents and assets never do.
  update public.program_request_deletions set phase='completed',completed_at=now() where id=d.id;
  return jsonb_build_object('deleted',true,'request_id',d.request_id,'folio',d.folio,'documents_removed',jsonb_array_length(d.snapshot->'documents'),'affiliate_files_preserved',true);
end $$;

revoke all on function public.get_admin_request_delete_preview(uuid),public.prepare_admin_request_delete(uuid,text,timestamptz,text),public.guard_request_deletion(),public.guard_request_deletion_child(),public.record_request_delete_google(uuid,jsonb,boolean),public.finish_admin_request_delete(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_request_delete_preview(uuid),public.prepare_admin_request_delete(uuid,text,timestamptz,text) to authenticated;
grant execute on function public.record_request_delete_google(uuid,jsonb,boolean),public.finish_admin_request_delete(uuid) to service_role;
commit;
