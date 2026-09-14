begin;
create table public.savings_source_observations(
 id uuid primary key default extensions.gen_random_uuid(),record_id uuid not null references public.savings_review_records(id),
 source_sha text not null check(source_sha~'^[a-f0-9]{64}$'),observed_at timestamptz not null,
 source_total numeric(14,2) not null check(source_total>=0),changes jsonb not null check(jsonb_typeof(changes)='array'),
 created_at timestamptz not null default clock_timestamp(),unique(record_id,source_sha)
);
create table public.savings_source_acceptances(
 id uuid primary key default extensions.gen_random_uuid(),observation_id uuid not null unique references public.savings_source_observations(id),
 actor_real_auth_user_id uuid not null references auth.users(id),usuario_contexto_affiliate_id uuid references public.affiliates(id),
 created_at timestamptz not null default clock_timestamp(),client_action_id uuid not null unique,record_version integer not null
);
alter table public.savings_source_observations enable row level security;
alter table public.savings_source_observations force row level security;
alter table public.savings_source_acceptances enable row level security;
alter table public.savings_source_acceptances force row level security;
revoke all on public.savings_source_observations,public.savings_source_acceptances from public,anon,authenticated,service_role;
create trigger savings_source_observations_immutable before update or delete on public.savings_source_observations for each row execute function public.reject_savings_history_mutation();
create trigger savings_source_acceptances_immutable before update or delete on public.savings_source_acceptances for each row execute function public.reject_savings_history_mutation();

create function public.import_savings_source_observations(p_source_sha text,p_observed_at timestamptz,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; c jsonb; r public.savings_review_records%rowtype; delta numeric; n integer:=0; existing public.savings_source_observations%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SAVINGS_SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if p_source_sha is null or p_source_sha!~'^[a-f0-9]{64}$' or p_observed_at is null or p_observed_at>clock_timestamp()+interval '5 minutes' or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>366 then raise exception 'SAVINGS_CAPTURE_INVALID';end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  select * into r from public.savings_review_records where source_sheet='Ahorro' and source_row=(item->>'source_row')::int and source_folio=item->>'folio';
  if not found or (select count(*) from public.savings_review_records where source_sheet='Ahorro' and source_folio=item->>'folio')<>1 then raise exception 'SAVINGS_SOURCE_IDENTITY_MISMATCH';end if;
  delta:=0;
  if jsonb_typeof(item->'changes') is distinct from 'array' or jsonb_array_length(item->'changes')=0 then raise exception 'SAVINGS_SOURCE_CHANGES_REQUIRED';end if;
  for c in select value from jsonb_array_elements(item->'changes') loop
   if not exists(select 1 from jsonb_array_elements(r.field_defs) f where f->>'key'=c->>'key' and f->>'label' like '%Descuento registrado%' and left(f->>'label',10)=c->>'date')
   or r.source_data->(c->>'key') is distinct from c->'previous' or public.savings_panel_number(c->'current') is null or public.savings_panel_number(c->'current')<0 then raise exception 'SAVINGS_SOURCE_CELL_MISMATCH';end if;
   delta:=delta+public.savings_panel_number(c->'current')-coalesce(public.savings_panel_number(c->'previous'),0);
  end loop;
  if (select count(*) from jsonb_array_elements(item->'changes'))<>(select count(distinct value->>'key') from jsonb_array_elements(item->'changes')) or public.savings_panel_number(item->'source_total') is distinct from public.savings_panel_number(r.source_data->'Q')+delta then raise exception 'SAVINGS_SOURCE_Q_MISMATCH';end if;
  select * into existing from public.savings_source_observations where record_id=r.id and source_sha=p_source_sha;
  if found then
   if existing.changes is distinct from item->'changes' or existing.source_total is distinct from (item->>'source_total')::numeric or existing.observed_at<>p_observed_at then raise exception 'SAVINGS_SOURCE_RETRY_CONFLICT';end if;
  else
   insert into public.savings_source_observations(record_id,source_sha,observed_at,source_total,changes) values(r.id,p_source_sha,p_observed_at,(item->>'source_total')::numeric,item->'changes');n:=n+1;
  end if;
 end loop;
 return jsonb_build_object('inserted',n,'source_sha',p_source_sha,'financial_changes',0);
end $$;

alter function public.savings_certification_context(uuid) rename to savings_context_before_source_refresh;
revoke all on function public.savings_context_before_source_refresh(uuid) from public,anon,authenticated,service_role;
create function public.savings_certification_context(p_record_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; o public.savings_source_observations%rowtype; proposal jsonb; conflict boolean;
begin
 result:=public.savings_context_before_source_refresh(p_record_id);
 select * into o from public.savings_source_observations where record_id=p_record_id order by observed_at desc,id desc limit 1;
 if found then
  select proposed_data into proposal from public.savings_review_records where id=p_record_id;
  select exists(select 1 from jsonb_array_elements(o.changes)c where proposal ? (c->>'key') and proposal->(c->>'key') is distinct from c->'current') into conflict;
  result:=result||jsonb_build_object('source_update',jsonb_build_object('id',o.id,'source_total',o.source_total,'observed_at',o.observed_at,'changes',o.changes,
   'pending',not exists(select 1 from public.savings_source_acceptances where observation_id=o.id),'conflict',conflict),
   'can_accept_source_update',public.savings_review_edit_allowed());
  result:=jsonb_set(result,'{snapshot,source_observation}',jsonb_build_object('id',o.id,'sha',o.source_sha));
 end if;
 return result;
end $$;

create function public.admin_accept_savings_source(p_record_id uuid,p_observation_id uuid,p_version integer,p_client_action_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.savings_source_observations%rowtype; r public.savings_review_records%rowtype; prior public.savings_source_acceptances%rowtype; changes jsonb; result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') or not public.savings_review_edit_allowed() then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 if p_client_action_id is null then raise exception 'SAVINGS_ACTION_KEY_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-source:'||p_client_action_id,0));
 select * into prior from public.savings_source_acceptances where client_action_id=p_client_action_id;
 if found then
  if prior.observation_id<>p_observation_id or prior.actor_real_auth_user_id<>auth.uid() or prior.record_version<>p_version then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('accepted',true);
 end if;
 select * into r from public.savings_review_records where id=p_record_id for update;
 select * into o from public.savings_source_observations where id=p_observation_id and record_id=p_record_id;
 if not found or r.version<>p_version then raise exception 'SAVINGS_PREVIEW_STALE';end if;
 if exists(select 1 from public.savings_balance_certifications where record_id=p_record_id) then raise exception 'SAVINGS_CONFIRMED_BALANCE_REVIEW_REQUIRED';end if;
 if exists(select 1 from jsonb_array_elements(o.changes)c where r.proposed_data ? (c->>'key') and r.proposed_data->(c->>'key') is distinct from c->'current') then raise exception 'SAVINGS_SOURCE_REVIEW_CONFLICT';end if;
 select jsonb_object_agg(c->>'key',c->'current') into changes from jsonb_array_elements(o.changes)c;
 result:=public.admin_save_savings_review(r.id,r.version,changes,'IN_REVIEW',null,p_client_action_id);
 insert into public.savings_source_acceptances(observation_id,actor_real_auth_user_id,usuario_contexto_affiliate_id,client_action_id,record_version)
 values(o.id,auth.uid(),public.get_effective_affiliate_id(),p_client_action_id,p_version);
 return jsonb_build_object('accepted',true,'review',result);
end $$;
revoke all on function public.savings_certification_context(uuid),public.import_savings_source_observations(text,timestamptz,jsonb),public.admin_accept_savings_source(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.import_savings_source_observations(text,timestamptz,jsonb) to service_role;
grant execute on function public.admin_accept_savings_source(uuid,uuid,integer,uuid) to authenticated;
commit;
