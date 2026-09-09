begin;

-- Notifications are a projection of committed workflow events, not a second workflow.
create table public.program_request_event_receipts (
  event_id uuid primary key references public.program_request_admin_events(id) on delete cascade,
  seen_at timestamptz not null default now(),
  actor_auth_user_id uuid not null references auth.users(id) on delete restrict
);
alter table public.program_request_event_receipts enable row level security;
alter table public.program_request_event_receipts force row level security;
revoke all on public.program_request_event_receipts from public, anon, authenticated;

create function public.list_self_request_event_notifications()
returns setof jsonb language plpgsql stable security definer set search_path=''
as $$
declare affiliate uuid;
begin
  affiliate := public.get_effective_affiliate_id();
  if affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  return query
  select jsonb_build_object('id',e.id,'request_id',r.id,'folio',r.folio,'program_id',r.program_id,
    'status',e.to_status,'action',e.action,'created_at',e.created_at,'seen_at',receipt.seen_at,
    'authorized',e.to_status='approved' and e.from_status<>'approved',
    'stage',coalesce((select s->>'label' from jsonb_array_elements(r.workflow_snapshot->'stages') s where s->>'id'=e.to_stage_id::text),''))
  from public.program_request_admin_events e
  join public.program_requests r on r.id=e.request_id
  left join public.program_request_event_receipts receipt on receipt.event_id=e.id
  where r.affiliate_id=affiliate and e.action<>'COMMENT'
    and (e.from_status<>e.to_status or e.from_stage_id is distinct from e.to_stage_id)
    -- Existing Marketplace quote approvals already have an authoritative notification/receipt.
    and not (r.program_id='marketplace' and r.request_type='quote' and e.to_status not in ('rejected','cancelled'))
  order by e.created_at desc,e.id desc;
end $$;

create function public.mark_self_request_event_seen(p_event_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare affiliate uuid; claimed uuid;
begin
  affiliate := public.get_effective_affiliate_id();
  if affiliate is null or auth.uid() is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.list_self_request_event_notifications() n where n->>'id'=p_event_id::text) then
    raise exception 'NOTIFICATION_NOT_AVAILABLE' using errcode='42501';
  end if;
  insert into public.program_request_event_receipts(event_id,actor_auth_user_id)
    values(p_event_id,auth.uid()) on conflict(event_id) do nothing returning event_id into claimed;
  return claimed is not null;
end $$;

revoke all on function public.list_self_request_event_notifications() from public,anon,authenticated;
revoke all on function public.mark_self_request_event_seen(uuid) from public,anon,authenticated;
grant execute on function public.list_self_request_event_notifications() to authenticated;
grant execute on function public.mark_self_request_event_seen(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
