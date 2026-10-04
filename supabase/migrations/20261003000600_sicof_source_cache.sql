begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- H-SICOF-RESPONSE-LATENCY-001. Owner authorized a private Google observation
-- valid for at most 300 seconds. This is disposable derived data, never a ledger.
-- Install without scheduling; configure Vault, deploy/prime Edge, then activate
-- only job sicof-source-refresh: */4 * * * * / select sicof_source_private.run_refresh().
do $guard$ begin
 if to_regnamespace('sicof_source_private') is not null
  or to_regprocedure('public.service_sicof_source_read()') is not null
  or to_regprocedure('public.service_sicof_source_claim(boolean)') is not null
  or to_regprocedure('public.service_sicof_source_finish(uuid,jsonb,text)') is not null
  then raise exception 'SICOF_SOURCE_CACHE_ALREADY_INSTALLED';end if;
 if to_regclass('vault.decrypted_secrets') is null
  or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
  then raise exception 'SICOF_SOURCE_CACHE_INFRASTRUCTURE_REQUIRED';end if;
end $guard$;

create schema sicof_source_private authorization postgres;
revoke all on schema sicof_source_private from public,anon,authenticated,service_role;
create table sicof_source_private.observation (
 singleton boolean primary key default true check(singleton),
 source jsonb,
 source_fingerprint text,
 version bigint not null default 0 check(version>=0),
 observed_at timestamptz,
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 last_error text,
 lease_token uuid,
 lease_until timestamptz,
 check((source is null and source_fingerprint is null and observed_at is null and version=0)
    or (source is not null and source_fingerprint ~ '^[A-Fa-f0-9]{64}$' and observed_at is not null and version>0)),
 check((lease_token is null)=(lease_until is null))
);
alter table sicof_source_private.observation owner to postgres;
alter table sicof_source_private.observation enable row level security;
alter table sicof_source_private.observation force row level security;
revoke all on sicof_source_private.observation from public,anon,authenticated,service_role;
insert into sicof_source_private.observation(singleton) values(true);

create function sicof_source_private.metadata(p_row sicof_source_private.observation,p_now timestamptz)
returns jsonb language sql immutable set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'state',case when p_row.source is null then 'EMPTY'
    when p_row.observed_at>p_now-interval '300 seconds' and p_row.observed_at<=p_now+interval '5 seconds' then 'READY' else 'STALE' end,
  'version',p_row.version,'observed_at',p_row.observed_at,
  'expires_at',p_row.observed_at+interval '300 seconds',
  'last_attempt_at',p_row.last_attempt_at,'last_success_at',p_row.last_success_at,
  'last_error',p_row.last_error,
  'refreshing',coalesce(p_row.lease_token is not null and p_row.lease_until>p_now,false)
 )
$function$;
alter function sicof_source_private.metadata(sicof_source_private.observation,timestamptz) owner to postgres;
revoke all on function sicof_source_private.metadata(sicof_source_private.observation,timestamptz) from public,anon,authenticated,service_role;

create function public.service_sicof_source_read() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $function$
declare r sicof_source_private.observation;m jsonb;
begin
 select * into strict r from sicof_source_private.observation where singleton;
 m:=sicof_source_private.metadata(r,clock_timestamp());
 return jsonb_build_object('source',case when m->>'state'='READY' then r.source else null end,'meta',m);
end $function$;
alter function public.service_sicof_source_read() owner to postgres;
revoke all on function public.service_sicof_source_read() from public,anon,authenticated,service_role;
grant execute on function public.service_sicof_source_read() to service_role;

create function public.service_sicof_source_claim(p_force boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $function$
declare r sicof_source_private.observation;t timestamptz;token uuid;cooldown interval;
begin
 select * into strict r from sicof_source_private.observation where singleton for update;
 t:=clock_timestamp();
 cooldown:=case when coalesce(p_force,false) then interval '60 seconds' else interval '180 seconds' end;
 if (r.lease_token is not null and r.lease_until>t)
  or r.last_attempt_at>t-cooldown
  or (not coalesce(p_force,false) and r.observed_at>t-interval '180 seconds') then
  return jsonb_build_object('claimed',false,'lease',null,'meta',sicof_source_private.metadata(r,t));
 end if;
 token:=gen_random_uuid();
 update sicof_source_private.observation set lease_token=token,lease_until=t+interval '90 seconds',last_attempt_at=t
  where singleton returning * into r;
 return jsonb_build_object('claimed',true,'lease',token,'meta',sicof_source_private.metadata(r,t));
end $function$;
alter function public.service_sicof_source_claim(boolean) owner to postgres;
revoke all on function public.service_sicof_source_claim(boolean) from public,anon,authenticated,service_role;
grant execute on function public.service_sicof_source_claim(boolean) to service_role;

create function public.service_sicof_source_finish(p_lease uuid,p_source jsonb default null,p_error text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $function$
declare r sicof_source_private.observation;t timestamptz;observed timestamptz;fingerprint text;
 fields constant text[]:=array['source_row','date','paid','loan_id','folio','name','process','fund','rate','term','principal','total_due','discount_start','loan_charges','scheduled_charges','expected','discount_end','payment_count','ends_payment','paid_to_date','expected_to_date','status','total_recorded_paid','scheduled_admin_fee','admin_fee_total','interest_total','principal_interest_total','scheduled_capital','transfer_date','discount_date','request_date'];
begin
 select * into strict r from sicof_source_private.observation where singleton for update;
 t:=clock_timestamp();
 if p_lease is null or r.lease_token is distinct from p_lease or r.lease_until<=t then
  raise exception 'SICOF_SOURCE_CACHE_LEASE_EXPIRED';
 end if;
 if (p_source is null)=(p_error is null) then raise exception 'SICOF_SOURCE_CACHE_FINISH_INVALID';end if;
 if p_source is null then
  -- Keep the observation and its original expiry; diagnostics never contain cells.
  update sicof_source_private.observation set lease_token=null,lease_until=null,
   last_error=case when p_error ~ '^[A-Z][A-Z0-9_]{0,95}$' then p_error else 'SICOF_SOURCE_REFRESH_FAILED' end
   where singleton returning * into r;
  return jsonb_build_object('meta',sicof_source_private.metadata(r,t));
 end if;
 if jsonb_typeof(p_source) is distinct from 'object'
  or p_source->>'contract_version' is distinct from 'SICOF_FINANCIAL_READ_V1'
  or p_source->>'source' is distinct from '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80:1245291756'
  or p_source->>'date_semantics' is distinct from 'AMORTIZATION_DATE_NOT_RECEIPT_DATE'
  or jsonb_typeof(p_source->'headers') is distinct from 'array'
  or jsonb_typeof(p_source->'rows') is distinct from 'array'
  or p_source->'columns' is distinct from '["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG"]'::jsonb
  or coalesce(p_source->>'source_fingerprint','') !~ '^[A-Fa-f0-9]{64}$'
  or coalesce(p_source->>'observed_at','') !~ '^\d{4}-\d{2}-\d{2}T'
  then raise exception 'SICOF_SOURCE_CACHE_SOURCE_INVALID';end if;
 if jsonb_array_length(p_source->'headers')<>30 or jsonb_array_length(p_source->'rows')<1
  or p_source->'scanned_rows' is distinct from to_jsonb(jsonb_array_length(p_source->'rows'))
  or exists(select 1 from jsonb_array_elements(p_source->'headers') h where jsonb_typeof(h) is distinct from 'string')
  then raise exception 'SICOF_SOURCE_CACHE_SOURCE_INVALID';end if;
 -- Scalar/header normalization and source hashing belong to the existing Edge
 -- decoder. Recheck the normalized shape here so no arbitrary object is stored.
 if exists(select 1 from jsonb_array_elements(p_source->'rows') item
    where jsonb_typeof(item) is distinct from 'object') then raise exception 'SICOF_SOURCE_CACHE_SOURCE_INVALID';end if;
 if exists(select 1 from jsonb_array_elements(p_source->'rows') item
    where not(item ?& fields) or (select count(*) from jsonb_object_keys(item))<>31
     or jsonb_typeof(item->'source_row') is distinct from 'number'
     or (item->>'source_row') !~ '^[0-9]+$'
     or exists(select 1 from jsonb_each(item) cell where jsonb_typeof(cell.value) not in ('string','number','boolean','null')))
  then raise exception 'SICOF_SOURCE_CACHE_SOURCE_INVALID';end if;
 if exists(select 1 from (
    select (item->>'source_row')::numeric n,lag((item->>'source_row')::numeric,1,1::numeric) over(order by ordinal) previous
    from jsonb_array_elements(p_source->'rows') with ordinality as entries(item,ordinal)
   ) ordered where n<=previous or n>2147483647)
  then raise exception 'SICOF_SOURCE_CACHE_SOURCE_INVALID';end if;
 begin observed:=(p_source->>'observed_at')::timestamptz;
 exception when others then raise exception 'SICOF_SOURCE_CACHE_SOURCE_INVALID';end;
 if not isfinite(observed) or observed>t+interval '5 seconds' or observed<=t-interval '300 seconds'
  then raise exception 'SICOF_SOURCE_CACHE_OBSERVATION_EXPIRED';end if;
 if r.observed_at is not null and observed<r.observed_at then raise exception 'SICOF_SOURCE_CACHE_OBSERVATION_OLDER';end if;
 fingerprint:=p_source->>'source_fingerprint';
 if r.source_fingerprint=fingerprint and (r.source-'observed_at') is distinct from (p_source-'observed_at') then
  raise exception 'SICOF_SOURCE_CACHE_CONTENT_MISMATCH';
 end if;
 -- Validation can take time for a complete history. Authority to publish must
 -- still be valid after that work, not merely when the row lock was acquired.
 t:=clock_timestamp();
 if r.lease_until<=t then raise exception 'SICOF_SOURCE_CACHE_LEASE_EXPIRED';end if;
 if observed<=t-interval '300 seconds' then raise exception 'SICOF_SOURCE_CACHE_OBSERVATION_EXPIRED';end if;
 update sicof_source_private.observation set source=p_source,source_fingerprint=fingerprint,
  version=r.version+case when r.source_fingerprint is distinct from fingerprint then 1 else 0 end,
  observed_at=observed,last_success_at=t,last_error=null,lease_token=null,lease_until=null
  where singleton returning * into r;
 return jsonb_build_object('meta',sicof_source_private.metadata(r,clock_timestamp()));
end $function$;
alter function public.service_sicof_source_finish(uuid,jsonb,text) owner to postgres;
revoke all on function public.service_sicof_source_finish(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.service_sicof_source_finish(uuid,jsonb,text) to service_role;

create function sicof_source_private.run_refresh() returns bigint
language plpgsql security definer set search_path=pg_catalog as $function$
declare endpoint text;gateway_key text;worker_secret text;request_id bigint;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='sicof_source_refresh_url';
 select decrypted_secret into gateway_key from vault.decrypted_secrets where name='sicof_source_refresh_anon_key';
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='sicof_source_refresh_secret';
 if endpoint is null or endpoint !~ '^https://[^/?#]+/functions/v1/sicof$'
  or coalesce(gateway_key,'')='' or coalesce(worker_secret,'')='' then raise exception 'SICOF_SOURCE_REFRESH_CONFIG_REQUIRED';end if;
 select net.http_post(url:=endpoint,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway_key,'x-sicof-source-refresh-secret',worker_secret),
  body:='{"action":"REFRESH_SOURCE_JOB"}'::jsonb,timeout_milliseconds:=60000) into request_id;
 return request_id;
end $function$;
alter function sicof_source_private.run_refresh() owner to postgres;
revoke all on function sicof_source_private.run_refresh() from public,anon,authenticated,service_role;
commit;
