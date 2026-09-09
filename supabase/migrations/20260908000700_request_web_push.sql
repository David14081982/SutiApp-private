begin;

create table public.request_push_config (
  singleton boolean primary key default true check(singleton),
  public_key text not null check(public_key ~ '^[A-Za-z0-9_-]{87}$'),
  enabled boolean not null default false
);
create table public.request_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  endpoint text unique,
  p256dh text,
  auth_key text,
  expiration_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  check(revoked_at is not null or (endpoint is not null and p256dh is not null and auth_key is not null))
);
create index request_push_subscriptions_owner on public.request_push_subscriptions(auth_user_id) where revoked_at is null;
create table public.request_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.program_request_admin_events(id) on delete cascade,
  subscription_id uuid not null references public.request_push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','accepted','failed','suppressed')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(event_id,subscription_id)
);
create index request_push_deliveries_pending on public.request_push_deliveries(next_attempt_at) where status in ('pending','sending');
-- Audit UUIDs intentionally survive authorized removal of a request/subscription.
-- No endpoint, encryption key, token or notification body is retained here.
create table public.request_push_attempts (
  id bigint generated always as identity primary key,
  delivery_id uuid not null,
  event_id uuid not null,
  subscription_id uuid not null,
  actor_auth_user_id uuid,
  affiliate_id uuid not null,
  attempt integer not null,
  outcome text not null,
  http_status integer,
  created_at timestamptz not null default now(),
  unique(delivery_id,attempt)
);
alter table public.request_push_config enable row level security;
alter table public.request_push_config force row level security;
alter table public.request_push_subscriptions enable row level security;
alter table public.request_push_subscriptions force row level security;
alter table public.request_push_deliveries enable row level security;
alter table public.request_push_deliveries force row level security;
alter table public.request_push_attempts enable row level security;
alter table public.request_push_attempts force row level security;
revoke all on public.request_push_config,public.request_push_subscriptions,public.request_push_deliveries,public.request_push_attempts from public,anon,authenticated,service_role;
revoke all on sequence public.request_push_attempts_id_seq from public,anon,authenticated,service_role;

-- Reuse the authoritative resolver in a normal (non-impersonated) context.
-- Private helper only; restore both legacy and modern JWT settings even on error.
create function public.request_push_affiliate(p_user uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare old_claims text:=current_setting('request.jwt.claims',true); old_sub text:=current_setting('request.jwt.claim.sub',true); result uuid;
begin
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
  result:=public.get_effective_affiliate_id();
  perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  return result;
exception when others then
  perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  raise;
end $$;

create function public.get_self_request_push_config() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or public.get_effective_affiliate_id() is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  return coalesce((select jsonb_build_object('enabled',enabled,'public_key',public_key) from public.request_push_config where singleton),'{}'::jsonb);
end $$;

create function public.register_self_request_push(p_endpoint text,p_p256dh text,p_auth text,p_expiration_at timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); affiliate uuid; result uuid;
begin
  affiliate:=public.get_effective_affiliate_id();
  if owner_id is null or affiliate is null or affiliate is distinct from public.request_push_affiliate(owner_id) then raise exception 'OWN_AFFILIATE_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.request_push_config where enabled) then raise exception 'PUSH_UNAVAILABLE'; end if;
  if length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]#]+$'
    or p_endpoint is null or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$'
    or p_expiration_at<=now() then raise exception 'INVALID_PUSH_SUBSCRIPTION' using errcode='22023'; end if;
  -- Serialize per user for quota enforcement; endpoints cannot transfer between principals.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,712));
  select id into result from public.request_push_subscriptions where endpoint=p_endpoint and auth_user_id=owner_id and affiliate_id=affiliate and revoked_at is null for update;
  if result is not null then
    update public.request_push_subscriptions set p256dh=p_p256dh,auth_key=p_auth,expiration_at=p_expiration_at,updated_at=now() where id=result;
    return result;
  end if;
  if exists(select 1 from public.request_push_subscriptions where endpoint=p_endpoint) then raise exception 'SUBSCRIPTION_NOT_AVAILABLE' using errcode='42501'; end if;
  if (select count(*) from public.request_push_subscriptions where auth_user_id=owner_id and revoked_at is null)>=10 then raise exception 'DEVICE_LIMIT'; end if;
  insert into public.request_push_subscriptions(auth_user_id,affiliate_id,endpoint,p256dh,auth_key,expiration_at)
    values(owner_id,affiliate,p_endpoint,p_p256dh,p_auth,p_expiration_at) returning id into result;
  return result;
end $$;

create function public.revoke_self_request_push(p_subscription_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  update public.request_push_subscriptions set revoked_at=coalesce(revoked_at,now()),endpoint=null,p256dh=null,auth_key=null,updated_at=now()
    where id=p_subscription_id and auth_user_id=auth.uid();
  get diagnostics n=row_count;
  update public.request_push_deliveries d set status='suppressed',completed_at=now(),lease_token=null,lease_until=null
    where d.subscription_id=p_subscription_id and d.status in('pending','sending') and exists(select 1 from public.request_push_subscriptions s where s.id=d.subscription_id and s.auth_user_id=auth.uid() and s.revoked_at is not null);
  return n>0;
end $$;

create function public.enqueue_request_event_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.action='COMMENT' or (new.from_status is not distinct from new.to_status and new.from_stage_id is not distinct from new.to_stage_id) then return new; end if;
  insert into public.request_push_deliveries(event_id,subscription_id)
    select new.id,s.id from public.program_requests r join public.request_push_subscriptions s on s.affiliate_id=r.affiliate_id
    where r.id=new.request_id and s.revoked_at is null and (s.expiration_at is null or s.expiration_at>now())
      and public.request_push_affiliate(s.auth_user_id)=r.affiliate_id
      and exists(select 1 from public.request_push_config where enabled)
    on conflict(event_id,subscription_id) do nothing;
  return new;
end $$;
-- AFTER INSERT is required for the event FK; delivery remains invisible until commit.
create trigger request_event_push_after_commit after insert on public.program_request_admin_events
  for each row execute function public.enqueue_request_event_push();

create function public.claim_request_push_batch() returns setof jsonb
language plpgsql security definer set search_path='' as $$
declare job record; sub public.request_push_subscriptions; token uuid;
begin
  if not exists(select 1 from public.request_push_config where enabled) then return; end if;
  update public.request_push_subscriptions set revoked_at=now(),endpoint=null,p256dh=null,auth_key=null,updated_at=now() where revoked_at is null and expiration_at<=now();
  for job in select d.*,e.actor_auth_user_id,e.request_id,e.to_status,e.from_status,r.affiliate_id,r.folio,
      coalesce((select s->>'label' from jsonb_array_elements(r.workflow_snapshot->'stages') s where s->>'id'=e.to_stage_id::text),'') stage
    from public.request_push_deliveries d join public.program_request_admin_events e on e.id=d.event_id join public.program_requests r on r.id=e.request_id
    where d.status in('pending','sending') and d.next_attempt_at<=now() and (d.lease_until is null or d.lease_until<now())
    order by d.next_attempt_at,d.id limit 30 for update of d skip locked
  loop
    select * into sub from public.request_push_subscriptions where id=job.subscription_id;
    if sub.revoked_at is not null or public.request_push_affiliate(sub.auth_user_id) is distinct from job.affiliate_id or sub.affiliate_id<>job.affiliate_id or job.created_at<now()-interval '24 hours' or job.attempts>=5 then
      update public.request_push_deliveries set status=case when job.attempts>=5 then 'failed' else 'suppressed' end,completed_at=now(),lease_token=null,lease_until=null where id=job.id;
      continue;
    end if;
    -- A crashed lease is explicitly auditable before a retry.
    if job.status='sending' then
      insert into public.request_push_attempts(delivery_id,event_id,subscription_id,actor_auth_user_id,affiliate_id,attempt,outcome)
        values(job.id,job.event_id,job.subscription_id,job.actor_auth_user_id,job.affiliate_id,job.attempts,'lease_expired') on conflict do nothing;
    end if;
    token:=gen_random_uuid();
    update public.request_push_deliveries set status='sending',attempts=attempts+1,lease_token=token,lease_until=now()+interval '90 seconds' where id=job.id;
    return next jsonb_build_object('id',job.id,'lease_token',token,'event_id',job.event_id,'request_id',job.request_id,'subscription_id',job.subscription_id,
      'endpoint',sub.endpoint,'keys',jsonb_build_object('p256dh',sub.p256dh,'auth',sub.auth_key),'folio',job.folio,'status',job.to_status,
      'authorized',job.to_status='approved' and job.from_status<>'approved','stage',left(job.stage,120));
  end loop;
end $$;

create function public.finish_request_push(p_id uuid,p_lease_token uuid,p_http_status integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.request_push_deliveries; outcome text;
begin
  select * into job from public.request_push_deliveries where id=p_id and lease_token=p_lease_token and status='sending' for update;
  if job.id is null then return false; end if;
  if p_http_status between 200 and 299 then outcome:='accepted';
  elsif p_http_status in(404,410) then outcome:='expired';
  elsif job.attempts>=5 or (p_http_status between 400 and 499 and p_http_status not in(408,429)) then outcome:='failed';
  else outcome:='retry'; end if;
  insert into public.request_push_attempts(delivery_id,event_id,subscription_id,actor_auth_user_id,affiliate_id,attempt,outcome,http_status)
    select job.id,job.event_id,job.subscription_id,e.actor_auth_user_id,r.affiliate_id,job.attempts,outcome,p_http_status
    from public.program_request_admin_events e join public.program_requests r on r.id=e.request_id where e.id=job.event_id on conflict do nothing;
  update public.request_push_deliveries set status=case when outcome='retry' then 'pending' when outcome='expired' then 'suppressed' else outcome end,
    next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,job.attempts)::integer)),lease_token=null,lease_until=null,
    completed_at=case when outcome='retry' then null else now() end where id=job.id;
  if outcome='expired' then
    update public.request_push_subscriptions set revoked_at=now(),endpoint=null,p256dh=null,auth_key=null,updated_at=now() where id=job.subscription_id;
    update public.request_push_deliveries set status='suppressed',completed_at=now(),lease_token=null,lease_until=null where subscription_id=job.subscription_id and status in('pending','sending');
  end if;
  return true;
end $$;

create function public.wake_request_push() returns bigint
language plpgsql security definer set search_path='' as $$
declare edge_url text; worker_key text; result bigint;
begin
  if not exists(select 1 from public.request_push_config where enabled) or not exists(select 1 from public.request_push_deliveries where status in('pending','sending') and next_attempt_at<=now() and (lease_until is null or lease_until<now())) then return null; end if;
  select decrypted_secret into edge_url from vault.decrypted_secrets where name='request_push_edge_url';
  select decrypted_secret into worker_key from vault.decrypted_secrets where name='request_push_worker_key';
  if edge_url is null or worker_key is null then raise exception 'PUSH_WORKER_NOT_CONFIGURED'; end if;
  select net.http_post(url:=edge_url,headers:=jsonb_build_object('Content-Type','application/json','x-request-push-key',worker_key),body:='{}'::jsonb,timeout_milliseconds:=60000) into result;
  return result;
end $$;

revoke all on function public.request_push_affiliate(uuid),public.get_self_request_push_config(),public.register_self_request_push(text,text,text,timestamptz),public.revoke_self_request_push(uuid),public.enqueue_request_event_push(),public.claim_request_push_batch(),public.finish_request_push(uuid,uuid,integer),public.wake_request_push() from public,anon,authenticated,service_role;
grant execute on function public.get_self_request_push_config(),public.register_self_request_push(text,text,text,timestamptz),public.revoke_self_request_push(uuid) to authenticated;
grant execute on function public.claim_request_push_batch(),public.finish_request_push(uuid,uuid,integer) to service_role;
select cron.schedule('request-event-web-push','* * * * *','select public.wake_request_push()');
notify pgrst,'reload schema';
commit;
