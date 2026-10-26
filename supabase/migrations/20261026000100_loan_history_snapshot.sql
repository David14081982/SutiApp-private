begin;
set local lock_timeout='3s';
set local statement_timeout='90s';
-- H-HISTORY-SNAPSHOT-001: derived observations only; Google remains financial authority.
-- Install disabled, configure the three named Vault secrets, deploy/verify the worker,
-- then explicitly enable through configure_loan_history_sync(true). No business DML.
do $guard$ begin
 if current_user<>'postgres' then raise exception 'HISTORY_SNAPSHOT_OWNER_REQUIRED'; end if;
 if coalesce(current_setting('cron.timezone',true),'GMT') not in ('UTC','GMT','Etc/UTC','Etc/GMT') then
  raise exception 'HISTORY_SNAPSHOT_CRON_UTC_REQUIRED'; end if;
 if to_regnamespace('loan_history_private') is not null
   or to_regclass('public.loan_history_publication') is not null
   or to_regprocedure('public.get_self_loan_history_snapshot()') is not null then
  raise exception 'HISTORY_SNAPSHOT_ALREADY_INSTALLED'; end if;
 if to_regprocedure('public.get_self_loan_history_context()') is null
   or to_regprocedure('public.has_admin_permission(text)') is null
   or to_regprocedure('public.admin_module_boundary(text[],text)') is null
   or to_regclass('vault.decrypted_secrets') is null
   or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
   or to_regprocedure('cron.schedule(text,text,text)') is null then
  raise exception 'HISTORY_SNAPSHOT_INFRASTRUCTURE_REQUIRED'; end if;
end $guard$;

create schema loan_history_private authorization postgres;
revoke all on schema loan_history_private from public,anon,authenticated,service_role;
create table loan_history_private.runs (
 id uuid primary key, kind text not null check(kind in ('MANUAL','SCHEDULE')),
 requested_by uuid, requested_at timestamptz not null,
 started_at timestamptz, finished_at timestamptz,
 status text not null check(status in ('QUEUED','RUNNING','SUCCEEDED','FAILED','DISABLED')),
 error_code text, source_metadata jsonb,
 check(kind<>'MANUAL' or requested_by is not null)
);
create table loan_history_private.state (
 id boolean primary key default true check(id), enabled boolean not null default false,
 status text not null default 'EMPTY' check(status in ('EMPTY','READY','QUEUED','RUNNING','FAILED','DISABLED')),
 run_id uuid references loan_history_private.runs(id), lease_token uuid, lease_until timestamptz,
 last_attempt_at timestamptz, last_success_at timestamptz, last_error_code text,
 sync_version uuid, source_updated_at timestamptz, source_metadata jsonb,
 check((lease_token is null)=(lease_until is null)),
 check((sync_version is null)=(source_updated_at is null))
);
create table loan_history_private.observations (
 folio text collate "C" primary key, source jsonb not null,
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 is_current boolean not null default true, changed_at timestamptz not null,
 invalidated_at timestamptz, published_run_id uuid not null references loan_history_private.runs(id),
 check(jsonb_typeof(source)='object'), check(is_current=(invalidated_at is null))
);
create table loan_history_private.staged (
 run_id uuid not null references loan_history_private.runs(id), folio text collate "C" not null,
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'), source jsonb not null,
 primary key(run_id,folio)
);
create table public.loan_history_publication (
 id boolean primary key default true check(id), version uuid, source_updated_at timestamptz,
 check((version is null)=(source_updated_at is null))
);
alter table loan_history_private.runs enable row level security;
alter table loan_history_private.runs force row level security;
alter table loan_history_private.state enable row level security;
alter table loan_history_private.state force row level security;
alter table loan_history_private.observations enable row level security;
alter table loan_history_private.observations force row level security;
alter table loan_history_private.staged enable row level security;
alter table loan_history_private.staged force row level security;
alter table public.loan_history_publication enable row level security;
alter table public.loan_history_publication force row level security;
revoke all on all tables in schema loan_history_private from public,anon,authenticated,service_role;
revoke all on public.loan_history_publication from public,anon,authenticated,service_role;
insert into loan_history_private.state(id) values(true);
insert into public.loan_history_publication(id) values(true);

create function loan_history_private.folio_is_addressable(p_folio text) returns boolean
language sql immutable set search_path='' as $$
 -- Same whitespace boundary as JavaScript trim, without changing the stored raw key.
 select coalesce(p_folio<>'' and p_folio<>'0' and char_length(p_folio)<=100
  and char_length(p_folio)+(select count(*) from regexp_split_to_table(p_folio,'') ch where ascii(ch)>65535)<=100
  and p_folio=btrim(p_folio,
  U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),false);
$$;
create function public.can_read_loan_history_publication() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.affiliates a where a.id=public.get_effective_affiliate_id() and not a.is_archived
   and loan_history_private.folio_is_addressable(a.numero_control)
   and (select count(*) from public.affiliates b where not b.is_archived and b.numero_control=a.numero_control)=1
 );
$$;
create policy own_context_publication on public.loan_history_publication for select to authenticated
 using(public.can_read_loan_history_publication());
grant select on public.loan_history_publication to authenticated;

create function loan_history_private.sync_metadata(s loan_history_private.state) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object(
  'status',case when not s.enabled then 'DISABLED'
    when s.status='RUNNING' and s.lease_until<=now() then 'FAILED'
    when s.status='QUEUED' and s.last_attempt_at<=now()-interval '10 minutes' then 'FAILED'
    else s.status end,
  'last_attempt_at',s.last_attempt_at,
  'last_error_code',case when s.status='RUNNING' and s.lease_until<=now() then 'HISTORY_SYNC_LEASE_EXPIRED'
    when s.status='QUEUED' and s.last_attempt_at<=now()-interval '10 minutes' then 'HISTORY_SYNC_DISPATCH_EXPIRED'
    else s.last_error_code end
 );
$$;
create function public.get_self_loan_history_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb; s loan_history_private.state; body jsonb;
begin
 -- The unchanged resolver enforces Auth, exact unique active Folio and audited assistance.
 -- All reads share this statement's MVCC snapshot; the caller supplies no identity.
 ctx:=public.get_self_loan_history_context();
 if not loan_history_private.folio_is_addressable(ctx->>'folio') then
  raise exception 'HISTORY_IDENTITY_AMBIGUOUS' using errcode='42501'; end if;
 select * into strict s from loan_history_private.state where id;
 if not s.enabled then raise exception 'HISTORY_SNAPSHOT_DISABLED' using errcode='55000'; end if;
 if s.sync_version is not null then
  select o.source into body from loan_history_private.observations o where o.folio=ctx->>'folio' and o.is_current;
  body:=coalesce(body,'{"loans":[],"requests":[],"issues":[]}'::jsonb);
 end if;
 return jsonb_build_object('context',ctx,'source',body,'source_updated_at',s.source_updated_at,
  'sync_version',s.sync_version,'sync_state',loan_history_private.sync_metadata(s));
end $$;

create function public.get_admin_loan_history_sync_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s loan_history_private.state;
begin
 if auth.uid() is null or not(public.has_admin_permission('program_requests.read')
  and public.admin_module_boundary(array['finanzas'],'read')) then
  raise exception 'HISTORY_SYNC_ADMIN_DENIED' using errcode='42501'; end if;
 select * into strict s from loan_history_private.state where id;
 return jsonb_build_object('enabled',s.enabled,'run_id',s.run_id,'sync_version',s.sync_version,
  'can_sync',public.has_admin_permission('program_requests.write') and public.admin_module_boundary(array['finanzas'],'update'),
  'source_updated_at',s.source_updated_at,'last_success_at',s.last_success_at,
  'source_metadata',s.source_metadata,'sync_state',loan_history_private.sync_metadata(s));
end $$;

create function loan_history_private.worker_configuration() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare endpoint text; secret text; gateway_key text;
begin
 if (select count(*) from vault.decrypted_secrets where name='loan_history_sync_url')<>1
  or (select count(*) from vault.decrypted_secrets where name='loan_history_sync_secret')<>1
  or (select count(*) from vault.decrypted_secrets where name='loan_history_sync_anon_key')<>1 then
  raise exception 'HISTORY_SYNC_CONFIGURATION_REQUIRED'; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='loan_history_sync_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='loan_history_sync_secret';
 select decrypted_secret into gateway_key from vault.decrypted_secrets where name='loan_history_sync_anon_key';
 if endpoint !~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/loan-history-sync$'
   or coalesce(length(secret),0)<32 or coalesce(gateway_key,'')='' then raise exception 'HISTORY_SYNC_CONFIGURATION_INVALID'; end if;
 return jsonb_build_object('url',endpoint,'secret',secret,'gateway_key',gateway_key);
end $$;

create function loan_history_private.enqueue(p_kind text,p_actor uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare s loan_history_private.state; t timestamptz; next_run uuid; config jsonb; dispatch bigint;
begin
 select * into strict s from loan_history_private.state where id for update; t:=clock_timestamp();
 if not s.enabled then raise exception 'HISTORY_SNAPSHOT_DISABLED'; end if;
 if (s.status='RUNNING' and s.lease_until>t) or (s.status='QUEUED' and s.last_attempt_at>t-interval '10 minutes') then
  return jsonb_build_object('accepted',false,'coalesced',true,'run_id',s.run_id,'sync_state',loan_history_private.sync_metadata(s));
 end if;
 config:=loan_history_private.worker_configuration();
 if s.status in ('QUEUED','RUNNING') then
  update loan_history_private.runs set status='FAILED',finished_at=t,error_code='HISTORY_SYNC_LEASE_EXPIRED' where id=s.run_id;
  delete from loan_history_private.staged where run_id=s.run_id;
 end if;
 next_run:=gen_random_uuid();
 insert into loan_history_private.runs(id,kind,requested_by,requested_at,status) values(next_run,p_kind,p_actor,t,'QUEUED');
 update loan_history_private.state set status='QUEUED',run_id=next_run,lease_token=null,lease_until=null,
  last_attempt_at=t,last_error_code=null where id returning * into s;
 select net.http_post(url:=config->>'url',headers:=jsonb_build_object('Content-Type','application/json',
   'Authorization','Bearer '||(config->>'gateway_key'),'x-history-sync-secret',config->>'secret'),body:=jsonb_build_object('action','SYNC','run_id',next_run),
   timeout_milliseconds:=60000) into dispatch;
 return jsonb_build_object('accepted',true,'coalesced',false,'run_id',next_run,'sync_state',loan_history_private.sync_metadata(s));
end $$;
create function public.request_admin_loan_history_sync() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.has_admin_permission('program_requests.write')
   and public.admin_module_boundary(array['finanzas'],'update')) then
  raise exception 'HISTORY_SYNC_ADMIN_DENIED' using errcode='42501'; end if;
 return loan_history_private.enqueue('MANUAL',auth.uid());
end $$;
create function loan_history_private.run_daily() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
 if not exists(select 1 from loan_history_private.state where id and enabled) then return jsonb_build_object('enabled',false); end if;
 return loan_history_private.enqueue('SCHEDULE',null);
end $$;
create function public.configure_loan_history_sync(p_enabled boolean) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare s loan_history_private.state;
begin
 if p_enabled is null then raise exception 'HISTORY_SYNC_CONFIGURATION_INVALID'; end if;
 select * into strict s from loan_history_private.state where id for update;
 if p_enabled then perform loan_history_private.worker_configuration(); end if;
 if not p_enabled and s.status in ('QUEUED','RUNNING') then
  update loan_history_private.runs set status='DISABLED',finished_at=clock_timestamp(),error_code='HISTORY_SYNC_DISABLED' where id=s.run_id;
 end if;
 update loan_history_private.state set enabled=p_enabled,
  status=case when not p_enabled then 'DISABLED' when s.enabled then status when sync_version is null then 'EMPTY' else 'READY' end,
  lease_token=case when p_enabled then lease_token else null end,
  lease_until=case when p_enabled then lease_until else null end where id;
 return jsonb_build_object('enabled',p_enabled);
end $$;

create function public.claim_loan_history_sync(p_run_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare s loan_history_private.state; token uuid; t timestamptz;
begin
 select * into strict s from loan_history_private.state where id for update; t:=clock_timestamp();
 if not s.enabled or s.run_id is distinct from p_run_id or s.status<>'QUEUED'
  or s.last_attempt_at<=t-interval '10 minutes' then return jsonb_build_object('claimed',false); end if;
 token:=gen_random_uuid();
 update loan_history_private.state set status='RUNNING',lease_token=token,lease_until=t+interval '10 minutes' where id returning * into s;
 update loan_history_private.runs set status='RUNNING',started_at=t where id=p_run_id;
 return jsonb_build_object('claimed',true,'run_id',p_run_id,'lease_token',token,'lease_until',s.lease_until,
  'manifest',coalesce((select jsonb_agg(jsonb_build_object('folio',folio,'content_hash',content_hash) order by folio)
    from loan_history_private.observations where is_current),'[]'::jsonb));
end $$;
create function loan_history_private.assert_lease(p_run_id uuid,p_lease_token uuid) returns loan_history_private.state
language plpgsql volatile security definer set search_path='' as $$
declare s loan_history_private.state;
begin
 select * into strict s from loan_history_private.state where id for update;
 if not s.enabled or s.status<>'RUNNING' or s.run_id is distinct from p_run_id or p_lease_token is null
  or s.lease_token is distinct from p_lease_token or s.lease_until<=clock_timestamp() then
  raise exception 'HISTORY_SYNC_LEASE_EXPIRED' using errcode='55000'; end if;
 return s;
end $$;
create function public.stage_loan_history_sync(p_run_id uuid,p_lease_token uuid,p_groups jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare s loan_history_private.state; item jsonb; src jsonb; raw text; hash text; v_folio text;
begin
 s:=loan_history_private.assert_lease(p_run_id,p_lease_token);
 if jsonb_typeof(p_groups) is distinct from 'array' then raise exception 'HISTORY_SYNC_GROUPS_INVALID'; end if;
 if jsonb_array_length(p_groups)>100 then raise exception 'HISTORY_SYNC_BATCH_TOO_LARGE'; end if;
 for item in select value from jsonb_array_elements(p_groups) loop
  if jsonb_typeof(item) is distinct from 'object' or not(item ?& array['folio','source_text','content_hash'])
   or (select count(*) from jsonb_object_keys(item))<>3 or jsonb_typeof(item->'folio') is distinct from 'string'
   or jsonb_typeof(item->'source_text') is distinct from 'string' then raise exception 'HISTORY_SYNC_GROUP_INVALID'; end if;
  v_folio:=item->>'folio'; raw:=item->>'source_text'; hash:=encode(sha256(convert_to(raw,'UTF8')),'hex');
  if octet_length(raw)>16777216 or item->>'content_hash' is distinct from hash then raise exception 'HISTORY_SYNC_HASH_INVALID'; end if;
  begin src:=raw::jsonb; exception when others then raise exception 'HISTORY_SYNC_SOURCE_INVALID'; end;
  if jsonb_typeof(src) is distinct from 'object' or not(src ?& array['loans','requests','issues'])
   or (select count(*) from jsonb_object_keys(src))<>3 or jsonb_typeof(src->'loans') is distinct from 'array'
   or jsonb_typeof(src->'requests') is distinct from 'array' or jsonb_typeof(src->'issues') is distinct from 'array' then
   raise exception 'HISTORY_SYNC_SOURCE_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements((src->'loans')||(src->'requests')) row
    where jsonb_typeof(row) is distinct from 'object' or jsonb_typeof(row->'owner') is distinct from 'string'
     or (row->>'owner') collate "C" is distinct from v_folio collate "C") then
   raise exception 'HISTORY_SYNC_OWNER_MISMATCH'; end if;
  if exists(select 1 from jsonb_array_elements(src->'issues') issue
   where jsonb_typeof(issue) is distinct from 'object' or not(issue ?& array['owner','source_row','code'])
    or (select count(*) from jsonb_object_keys(issue))<>3
    or jsonb_typeof(issue->'owner') is distinct from 'string'
    or (issue->>'owner') collate "C" is distinct from v_folio collate "C"
    or issue->>'code' is distinct from 'HISTORY_TRANSFER_IDENTITY_INVALID'
    or jsonb_typeof(issue->'source_row') is distinct from 'number'
    or coalesce(issue->>'source_row','') !~ '^[0-9]+$'
    or case when (issue->>'source_row') ~ '^[0-9]+$' then (issue->>'source_row')::numeric not between 2 and 2147483647 else false end)
   or (select count(*) from jsonb_array_elements(src->'issues'))<>(select count(distinct issue->>'source_row') from jsonb_array_elements(src->'issues') issue)
   or (jsonb_array_length(src->'issues')>0 and jsonb_array_length(src->'requests')=0) then
   raise exception 'HISTORY_SYNC_ISSUE_INVALID'; end if;
  if exists(select 1 from loan_history_private.staged x where x.run_id=p_run_id and x.folio=v_folio
    and (x.content_hash<>hash or x.source<>src)) then raise exception 'HISTORY_SYNC_STAGE_CONFLICT'; end if;
  insert into loan_history_private.staged(run_id,folio,content_hash,source) values(p_run_id,v_folio,hash,src) on conflict do nothing;
 end loop;
 perform loan_history_private.assert_lease(p_run_id,p_lease_token);
 update loan_history_private.state set lease_until=least(clock_timestamp()+interval '10 minutes',
  (select started_at+interval '20 minutes' from loan_history_private.runs where id=p_run_id)) where id;
 return jsonb_build_object('staged',jsonb_array_length(p_groups));
end $$;

create function public.publish_loan_history_sync(p_run_id uuid,p_lease_token uuid,p_manifest jsonb,
 p_source_updated_at timestamptz,p_source_metadata jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare s loan_history_private.state; totals record; changed integer; invalidated integer; t timestamptz; v_version uuid;
begin
 s:=loan_history_private.assert_lease(p_run_id,p_lease_token); t:=clock_timestamp();
 if jsonb_typeof(p_manifest) is distinct from 'array' or jsonb_typeof(p_source_metadata) is distinct from 'object' then
  raise exception 'HISTORY_SYNC_MANIFEST_INVALID'; end if;
 if exists(select 1 from jsonb_array_elements(p_manifest) m where jsonb_typeof(m) is distinct from 'object'
   or jsonb_typeof(m->'folio') is distinct from 'string' or coalesce(m->>'content_hash','') !~ '^[a-f0-9]{64}$'
   or (select count(*) from jsonb_object_keys(m))<>2)
  or (select count(*) from jsonb_array_elements(p_manifest))<>(select count(distinct (m->>'folio') collate "C") from jsonb_array_elements(p_manifest) m)
  then raise exception 'HISTORY_SYNC_MANIFEST_INVALID'; end if;
 if p_source_updated_at is null or not isfinite(p_source_updated_at) or p_source_updated_at>t+interval '5 minutes'
  or p_source_updated_at<s.last_attempt_at-interval '10 minutes'
  or (s.source_updated_at is not null and p_source_updated_at<s.source_updated_at) then
  raise exception 'HISTORY_SYNC_OBSERVATION_INVALID'; end if;
 if jsonb_typeof(p_source_metadata->'source_fingerprint') is distinct from 'string'
  or coalesce(p_source_metadata->>'source_fingerprint','') !~ '^[a-fA-F0-9]{64}$'
  or not(p_source_metadata ?& array['loan_rows','request_rows','group_count'])
  or exists(select 1 from jsonb_each(p_source_metadata) e where e.key<>'source_fingerprint'
    and (e.key not in ('loan_rows','request_rows','group_count','unaddressable_owner_rows','unaddressable_owner_groups',
       'issues','loan_source_rows','request_source_rows','ignored_blank_loan_rows','ignored_blank_request_rows')
      or jsonb_typeof(e.value)<>'number' or e.value::text !~ '^[0-9]+$')) then
  raise exception 'HISTORY_SYNC_METADATA_INVALID'; end if;
 -- Every manifest entry must resolve to its verified staged body or unchanged current body.
 if exists(select 1 from jsonb_array_elements(p_manifest) m
   left join loan_history_private.staged x on x.run_id=p_run_id and x.folio=(m->>'folio') collate "C" and x.content_hash=m->>'content_hash'
   left join loan_history_private.observations o on o.folio=(m->>'folio') collate "C" and o.content_hash=m->>'content_hash' and o.is_current
   where x.folio is null and o.folio is null)
  or exists(select 1 from loan_history_private.staged x where x.run_id=p_run_id and not exists(
    select 1 from jsonb_array_elements(p_manifest) m where (m->>'folio') collate "C"=x.folio and m->>'content_hash'=x.content_hash)) then
  raise exception 'HISTORY_SYNC_INCOMPLETE'; end if;
 select count(*) groups,coalesce(sum(jsonb_array_length(coalesce(x.source,o.source)->'loans')),0) loans,
  coalesce(sum(jsonb_array_length(coalesce(x.source,o.source)->'requests')),0) requests,
  coalesce(sum(jsonb_array_length(coalesce(x.source,o.source)->'issues')),0) issues,
  count(*) filter(where not loan_history_private.folio_is_addressable(m->>'folio')) unaddressable_groups,
  coalesce(sum(case when not loan_history_private.folio_is_addressable(m->>'folio') then
    jsonb_array_length(coalesce(x.source,o.source)->'loans')+jsonb_array_length(coalesce(x.source,o.source)->'requests') else 0 end),0) unaddressable_rows into totals
  from jsonb_array_elements(p_manifest) m
  left join loan_history_private.staged x on x.run_id=p_run_id and x.folio=(m->>'folio') collate "C" and x.content_hash=m->>'content_hash'
  left join loan_history_private.observations o on o.folio=(m->>'folio') collate "C" and o.content_hash=m->>'content_hash' and o.is_current;
 if p_source_metadata->'group_count' is distinct from to_jsonb(totals.groups)
  or p_source_metadata->'loan_rows' is distinct from to_jsonb(totals.loans)
  or p_source_metadata->'request_rows' is distinct from to_jsonb(totals.requests)
  or (p_source_metadata ? 'issues' and p_source_metadata->'issues' is distinct from to_jsonb(totals.issues))
  or (p_source_metadata ? 'unaddressable_owner_groups' and p_source_metadata->'unaddressable_owner_groups' is distinct from to_jsonb(totals.unaddressable_groups))
  or (p_source_metadata ? 'unaddressable_owner_rows' and p_source_metadata->'unaddressable_owner_rows' is distinct from to_jsonb(totals.unaddressable_rows)) then
  raise exception 'HISTORY_SYNC_COUNTS_MISMATCH'; end if;
 insert into loan_history_private.observations as prior(folio,source,content_hash,is_current,changed_at,invalidated_at,published_run_id)
  select x.folio,x.source,x.content_hash,true,t,null,p_run_id from loan_history_private.staged x where x.run_id=p_run_id
  on conflict(folio) do update set source=excluded.source,content_hash=excluded.content_hash,is_current=true,
   changed_at=excluded.changed_at,invalidated_at=null,published_run_id=excluded.published_run_id
   where prior.content_hash<>excluded.content_hash or not prior.is_current;
 get diagnostics changed=row_count;
 update loan_history_private.observations o set is_current=false,invalidated_at=t
  where o.is_current and not exists(select 1 from jsonb_array_elements(p_manifest) m where (m->>'folio') collate "C"=o.folio);
 get diagnostics invalidated=row_count;
 -- Recheck the lease after validation and writes: expiry rolls back this entire transaction.
 perform loan_history_private.assert_lease(p_run_id,p_lease_token); v_version:=gen_random_uuid();
 update loan_history_private.state set status='READY',lease_token=null,lease_until=null,last_success_at=t,
  last_error_code=null,sync_version=v_version,source_updated_at=p_source_updated_at,source_metadata=p_source_metadata where id;
 update loan_history_private.runs set status='SUCCEEDED',finished_at=t,source_metadata=p_source_metadata where id=p_run_id;
 update public.loan_history_publication set version=v_version,source_updated_at=p_source_updated_at where id;
 delete from loan_history_private.staged where run_id=p_run_id;
 return jsonb_build_object('published',true,'sync_version',v_version,'source_updated_at',p_source_updated_at,
  'changed_groups',changed,'invalidated_groups',invalidated);
end $$;
create function public.fail_loan_history_sync(p_run_id uuid,p_lease_token uuid,p_error_code text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare s loan_history_private.state; code text;
begin
 s:=loan_history_private.assert_lease(p_run_id,p_lease_token);
 code:=case when p_error_code ~ '^[A-Z][A-Z0-9_]{0,95}$' then p_error_code else 'HISTORY_SYNC_FAILED' end;
 update loan_history_private.state set status='FAILED',last_error_code=code,lease_token=null,lease_until=null where id;
 update loan_history_private.runs set status='FAILED',finished_at=clock_timestamp(),error_code=code where id=p_run_id;
 delete from loan_history_private.staged where run_id=p_run_id;
 return jsonb_build_object('failed',true,'error_code',code);
end $$;

revoke all on all functions in schema loan_history_private from public,anon,authenticated,service_role;
revoke all on function public.can_read_loan_history_publication(),public.get_self_loan_history_snapshot(),
 public.get_admin_loan_history_sync_status(),public.request_admin_loan_history_sync(),
 public.configure_loan_history_sync(boolean),public.claim_loan_history_sync(uuid),
 public.stage_loan_history_sync(uuid,uuid,jsonb),public.publish_loan_history_sync(uuid,uuid,jsonb,timestamptz,jsonb),
 public.fail_loan_history_sync(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.can_read_loan_history_publication(),public.get_self_loan_history_snapshot(),
 public.get_admin_loan_history_sync_status(),public.request_admin_loan_history_sync() to authenticated;
grant execute on function public.configure_loan_history_sync(boolean),public.claim_loan_history_sync(uuid),
 public.stage_loan_history_sync(uuid,uuid,jsonb),public.publish_loan_history_sync(uuid,uuid,jsonb,timestamptz,jsonb),
 public.fail_loan_history_sync(uuid,uuid,text) to service_role;
-- This is the only schedule. Disabled installations do not dispatch requests.
select cron.schedule('loan-history-snapshot-daily','0 22 * * *','select loan_history_private.run_daily()');
do $realtime$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.loan_history_publication;
 end if;
end $realtime$;
commit;
