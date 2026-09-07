begin;
-- Independent of staged operational migrations 001–004. Administrative proposals only.
create table public.savings_review_batches (
 id uuid primary key default extensions.gen_random_uuid(),
 source_sha256 text not null unique check(source_sha256 ~ '^[a-f0-9]{64}$'),
 source_name text not null, observed_at timestamptz not null,
 expected_records integer not null check(expected_records>0),
 created_at timestamptz not null default now()
);
create table public.savings_review_records (
 id uuid primary key default extensions.gen_random_uuid(),
 batch_id uuid not null references public.savings_review_batches(id),
 source_sheet text not null, source_row integer not null check(source_row>1),
 source_folio text, source_data jsonb not null check(jsonb_typeof(source_data)='object'),
 field_defs jsonb not null check(jsonb_typeof(field_defs)='array'),
 raw_source jsonb not null,
 issues jsonb not null default '[]' check(jsonb_typeof(issues)='array'),
 proposed_data jsonb not null default '{}' check(jsonb_typeof(proposed_data)='object'),
 status text not null default 'PENDING' check(status in ('PENDING','IN_REVIEW','RESOLVED')),
 version integer not null default 0,
 updated_at timestamptz not null default now(),
 unique(batch_id,source_sheet,source_row)
);
create table public.savings_review_events (
 id bigint generated always as identity primary key,
 record_id uuid not null references public.savings_review_records(id),
 actor_real_auth_user_id uuid not null,
 usuario_contexto_affiliate_id uuid,
 created_at timestamptz not null default clock_timestamp(),
 observation text,
 before_data jsonb not null, after_data jsonb not null,
 command jsonb not null, client_action_id uuid not null unique
);
create index savings_review_queue_idx on public.savings_review_records(batch_id,status,source_sheet,source_row);
create index savings_review_folio_idx on public.savings_review_records(source_folio);
create index savings_review_history_idx on public.savings_review_events(record_id,id);
alter table public.savings_review_batches enable row level security;
alter table public.savings_review_batches force row level security;
alter table public.savings_review_records enable row level security;
alter table public.savings_review_records force row level security;
alter table public.savings_review_events enable row level security;
alter table public.savings_review_events force row level security;
revoke all on public.savings_review_batches,public.savings_review_records,public.savings_review_events from public,anon,authenticated,service_role;
revoke all on sequence public.savings_review_events_id_seq from public,anon,authenticated,service_role;

create function public.savings_review_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name in ('savings_review_batches','savings_review_events') or tg_op='DELETE' then raise exception 'SAVINGS_REVIEW_HISTORY_IMMUTABLE'; end if;
 if (to_jsonb(new)-array['proposed_data','status','version','updated_at']) is distinct from
    (to_jsonb(old)-array['proposed_data','status','version','updated_at']) then raise exception 'SAVINGS_REVIEW_SOURCE_IMMUTABLE'; end if;
 return new;
end $$;
create trigger savings_review_source_guard before update or delete on public.savings_review_records for each row execute function public.savings_review_immutable();
create trigger savings_review_batch_guard before update or delete on public.savings_review_batches for each row execute function public.savings_review_immutable();
create trigger savings_review_event_guard before update or delete on public.savings_review_events for each row execute function public.savings_review_immutable();

create function public.savings_review_identity(p_folio text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('match_count',count(*),'active_match_count',count(*) filter(where not coalesce(a.is_archived,false)),
 'name',case when count(*)=0 then 'SIN REGISTRO' else
 (array_agg(coalesce(nullif(a.full_name,''),nullif(a.display_name,''),p_folio) order by a.source_row_ordinal nulls last,a.created_at,a.id))[1]
 ||case when count(*)>1 then ' DUPLICADO' else '' end end)
 from public.affiliates a where a.numero_control=p_folio and p_folio is not null and p_folio<>'';
$$;

create function public.get_admin_savings_review(p_record_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_REVIEW_DENIED' using errcode='42501'; end if;
 if p_record_id is null then
  select jsonb_build_object('publication','PRIVATE_REVIEW_ONLY','can_write',public.has_admin_permission('savings.write'),
   'can_review_identity',public.has_admin_permission('savings.identity_review'),
   'batches',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from public.savings_review_batches b),'[]'::jsonb),
   'records',coalesce(jsonb_agg(jsonb_build_object('id',r.id,'batch_id',r.batch_id,'sheet',r.source_sheet,'row',r.source_row,
    'folio',(r.source_data||r.proposed_data)->>'A','identity',public.savings_review_identity((r.source_data||r.proposed_data)->>'A'),
    'issues',r.issues,'status',r.status,'version',r.version,'updated_at',r.updated_at,
    'source_balance',case when r.source_sheet='Ahorro' then r.source_data->'Q' end,
    'proposed_balance',case when r.source_sheet='Ahorro' then (r.source_data||r.proposed_data)->'Q' end)
    order by case when r.source_sheet='Ahorro' then 0 else 1 end,r.source_sheet,r.source_row),'[]'::jsonb)) into result
   from public.savings_review_records r;
 else
  select to_jsonb(r)||jsonb_build_object('publication','PRIVATE_REVIEW_ONLY','identity',public.savings_review_identity((r.source_data||r.proposed_data)->>'A'),
   'batch',(select to_jsonb(b) from public.savings_review_batches b where b.id=r.batch_id),
   'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'actor',e.actor_real_auth_user_id,'actor_name',
    coalesce((select a.full_name from public.affiliates a where a.auth_user_id=e.actor_real_auth_user_id order by a.id limit 1),'Administrador'),
    'context',e.usuario_contexto_affiliate_id,'at',e.created_at,'observation',e.observation,'before',e.before_data,'after',e.after_data) order by e.id desc)
    from public.savings_review_events e where e.record_id=r.id),'[]'::jsonb)) into result from public.savings_review_records r where r.id=p_record_id;
  if result is null then raise exception 'SAVINGS_REVIEW_NOT_FOUND'; end if;
 end if;
 return result;
end $$;

create function public.admin_save_savings_review(p_record_id uuid,p_version integer,p_changes jsonb,p_status text,p_observation text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.savings_review_records; prior public.savings_review_events; command jsonb; before_state jsonb; after_state jsonb;
 field record; def jsonb; proposal jsonb; ident jsonb; folio text;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_REVIEW_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or p_version is null or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_status is null or p_status not in ('PENDING','IN_REVIEW','RESOLVED') or length(coalesce(p_observation,''))>4000 then raise exception 'SAVINGS_REVIEW_INVALID'; end if;
 command:=jsonb_build_object('record',p_record_id,'version',p_version,'changes',p_changes,'status',p_status,'observation',nullif(btrim(p_observation),''));
 perform pg_advisory_xact_lock(hashtextextended(p_client_action_id::text,605));
 select * into prior from public.savings_review_events where client_action_id=p_client_action_id;
 if found then
  if prior.actor_real_auth_user_id<>auth.uid() or prior.command<>command then raise exception 'SAVINGS_REVIEW_RETRY_CONFLICT'; end if;
  return prior.after_data;
 end if;
 select * into r from public.savings_review_records where id=p_record_id for update;
 if not found then raise exception 'SAVINGS_REVIEW_NOT_FOUND'; end if;
 if r.version<>p_version then raise exception 'SAVINGS_REVIEW_CHANGED'; end if;
 for field in select * from jsonb_each(p_changes) loop
  select d into def from jsonb_array_elements(r.field_defs) d where d->>'key'=field.key;
  if def is null or coalesce((def->>'editable')::boolean,true)=false then raise exception 'SAVINGS_REVIEW_FIELD_INVALID'; end if;
  if field.key='A' and not public.has_admin_permission('savings.identity_review') then raise exception 'SAVINGS_REVIEW_IDENTITY_DENIED' using errcode='42501'; end if;
  if field.value<>'null'::jsonb then
   if def->>'kind'='money' then
    if jsonb_typeof(field.value)<>'number' or abs((field.value::text)::numeric)>9999999999 or (field.value::text)::numeric<>round((field.value::text)::numeric,2) then raise exception 'SAVINGS_REVIEW_MONEY_INVALID'; end if;
   elsif jsonb_typeof(field.value)<>'string' or length(field.value#>>'{}')>2000 then raise exception 'SAVINGS_REVIEW_TEXT_INVALID';
   end if;
   if def->>'kind'='date' and ((field.value#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' or (field.value#>>'{}')::date is null) then raise exception 'SAVINGS_REVIEW_DATE_INVALID'; end if;
   if field.key='A' and ((field.value#>>'{}')='' or (field.value#>>'{}')<>btrim(field.value#>>'{}')) then raise exception 'SAVINGS_REVIEW_FOLIO_INVALID'; end if;
  end if;
 end loop;
 proposal:=r.proposed_data||p_changes;
 if p_status='RESOLVED' then
  folio:=(r.source_data||proposal)->>'A';
  ident:=public.savings_review_identity(folio);
  if (ident->>'match_count')::integer<>1 or (ident->>'active_match_count')::integer<>1 then raise exception 'SAVINGS_REVIEW_IDENTITY_PENDING'; end if;
  if exists(select 1 from public.savings_review_records other where other.batch_id=r.batch_id and other.source_sheet='Ahorro' and r.source_sheet='Ahorro' and other.id<>r.id and (other.source_data||other.proposed_data)->>'A'=folio) then raise exception 'SAVINGS_REVIEW_DUPLICATE_PENDING'; end if;
  if r.source_sheet='Ahorro' and (jsonb_typeof((r.source_data||proposal)->'Q') is distinct from 'number' or ((r.source_data||proposal)->>'Q')::numeric<0) then raise exception 'SAVINGS_REVIEW_BALANCE_PENDING'; end if;
 end if;
 before_state:=jsonb_build_object('proposed_data',r.proposed_data,'status',r.status,'version',r.version);
 after_state:=jsonb_build_object('proposed_data',proposal,'status',p_status,'version',r.version+1,'publication','PRIVATE_REVIEW_ONLY');
 update public.savings_review_records set proposed_data=proposal,status=p_status,version=version+1,updated_at=clock_timestamp() where id=r.id;
 insert into public.savings_review_events(record_id,actor_real_auth_user_id,usuario_contexto_affiliate_id,observation,before_data,after_data,command,client_action_id)
 values(r.id,auth.uid(),public.get_effective_affiliate_id(),nullif(btrim(p_observation),''),before_state,after_state,command,p_client_action_id);
 return after_state;
end $$;
revoke all on function public.savings_review_immutable(),public.savings_review_identity(text),public.get_admin_savings_review(uuid),public.admin_save_savings_review(uuid,integer,jsonb,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_review(uuid),public.admin_save_savings_review(uuid,integer,jsonb,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
