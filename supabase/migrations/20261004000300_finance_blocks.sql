begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- One current administrative restriction per canonical affiliate. Events retain every revision.
-- numero_control is TEXT evidence, not a new identity master nor a uniqueness constraint.
create table public.finance_blocks (
 id uuid primary key default gen_random_uuid(),
 affiliate_id uuid not null unique references public.affiliates(id) on delete restrict,
 numero_control text not null check(length(btrim(numero_control))>0),
 source_request_id uuid references public.program_requests(id) on delete set null,
 starts_on date not null, ends_on date not null,
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 check(isfinite(starts_on) and isfinite(ends_on) and ends_on>=starts_on)
);
create table public.finance_block_events (
 id uuid primary key default gen_random_uuid(),
 block_id uuid not null references public.finance_blocks(id) on delete restrict,
 actor_auth_user_id uuid not null,
 action text not null check(action in ('CREATE','EDIT','REVOKE')),
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 before_state jsonb, after_state jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create index finance_block_events_history on public.finance_block_events(block_id,created_at,id);
alter table public.finance_blocks enable row level security;
alter table public.finance_blocks force row level security;
alter table public.finance_block_events enable row level security;
alter table public.finance_block_events force row level security;
revoke all on public.finance_blocks,public.finance_block_events from public,anon,authenticated,service_role;

create function public.get_self_finance_block() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare affiliate uuid; b public.finance_blocks; d date:=(clock_timestamp() at time zone 'America/Hermosillo')::date;
begin
 if auth.uid() is null then raise exception 'FINANCE_BLOCK_ACCESS_DENIED' using errcode='42501'; end if;
 affiliate:=public.get_effective_affiliate_id();
 if affiliate is null then raise exception 'AFFILIATE_CONTEXT_UNAVAILABLE' using errcode='42501'; end if;
 select * into b from public.finance_blocks where affiliate_id=affiliate and revoked_at is null and d between starts_on and ends_on;
 if b.id is null then return jsonb_build_object('blocked',false); end if;
 return jsonb_build_object('blocked',true,'block',jsonb_build_object('starts_on',b.starts_on,'ends_on',b.ends_on,'reason',b.reason));
end $$;

create function public.list_admin_finance_blocks(p_affiliate_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.has_admin_permission('program_requests.read') and public.admin_module_boundary(array['finanzas'],'read')) then raise exception 'FINANCE_BLOCK_ACCESS_DENIED' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('full_name',a.full_name,'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'reason',e.reason,'actor_auth_user_id',e.actor_auth_user_id,'created_at',e.created_at,'before',e.before_state,'after',e.after_state) order by e.created_at desc,e.id desc) from public.finance_block_events e where e.block_id=b.id),'[]'::jsonb)) order by b.updated_at desc,b.id)
 from public.finance_blocks b join public.affiliates a on a.id=b.affiliate_id where p_affiliate_id is null or b.affiliate_id=p_affiliate_id),'[]'::jsonb);
end $$;

create function public.save_admin_finance_block(p_request_id uuid,p_id uuid,p_version integer,p_starts_on date,p_ends_on date,p_reason text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare affiliate uuid; control text; old_row public.finance_blocks; new_row public.finance_blocks;
begin
 if auth.uid() is null or not (public.has_admin_permission('program_requests.write') and public.admin_module_boundary(array['finanzas'],'write')) then raise exception 'FINANCE_BLOCK_WRITE_DENIED' using errcode='42501'; end if;
 if p_starts_on is null or p_ends_on is null or not isfinite(p_starts_on) or not isfinite(p_ends_on) or p_ends_on<p_starts_on or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'FINANCE_BLOCK_DATES_OR_REASON_INVALID' using errcode='22023'; end if;
 if p_id is null then
  select affiliate_id into affiliate from public.program_requests where id=p_request_id;
 else
  select affiliate_id into affiliate from public.finance_blocks where id=p_id;
 end if;
 if affiliate is null then raise exception 'FINANCE_BLOCK_TARGET_NOT_FOUND' using errcode='22023'; end if;
 -- Same affiliate row lock in the request trigger serializes block versus submission.
 select numero_control into control from public.affiliates where id=affiliate for update;
 if control is null or length(btrim(control))=0 then raise exception 'FINANCE_BLOCK_CONTROL_REQUIRED' using errcode='22023'; end if;
 select * into old_row from public.finance_blocks where affiliate_id=affiliate for update;
 if p_id is null then
  if old_row.id is not null then raise exception 'FINANCE_BLOCK_ALREADY_EXISTS_REFRESH' using errcode='40001'; end if;
  insert into public.finance_blocks(affiliate_id,numero_control,source_request_id,starts_on,ends_on,reason) values(affiliate,control,p_request_id,p_starts_on,p_ends_on,btrim(p_reason)) returning * into new_row;
 else
  if old_row.id is distinct from p_id or old_row.version is distinct from p_version then raise exception 'FINANCE_BLOCK_VERSION_CHANGED' using errcode='40001'; end if;
  update public.finance_blocks set starts_on=p_starts_on,ends_on=p_ends_on,reason=btrim(p_reason),revoked_at=null,version=version+1,updated_at=clock_timestamp() where id=p_id returning * into new_row;
 end if;
 insert into public.finance_block_events(block_id,actor_auth_user_id,action,reason,before_state,after_state) values(new_row.id,auth.uid(),case when p_id is null then 'CREATE' else 'EDIT' end,btrim(p_reason),case when p_id is null then null else to_jsonb(old_row) end,to_jsonb(new_row));
 return to_jsonb(new_row);
end $$;

create function public.revoke_admin_finance_block(p_id uuid,p_version integer,p_reason text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare affiliate uuid; old_row public.finance_blocks; new_row public.finance_blocks;
begin
 if auth.uid() is null or not (public.has_admin_permission('program_requests.write') and public.admin_module_boundary(array['finanzas'],'write')) then raise exception 'FINANCE_BLOCK_WRITE_DENIED' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'FINANCE_BLOCK_REASON_REQUIRED' using errcode='22023'; end if;
 select affiliate_id into affiliate from public.finance_blocks where id=p_id;
 perform 1 from public.affiliates where id=affiliate for update;
 select * into old_row from public.finance_blocks where id=p_id for update;
 if old_row.id is null or old_row.version is distinct from p_version or old_row.revoked_at is not null then raise exception 'FINANCE_BLOCK_VERSION_CHANGED' using errcode='40001'; end if;
 update public.finance_blocks set revoked_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where id=p_id returning * into new_row;
 insert into public.finance_block_events(block_id,actor_auth_user_id,action,reason,before_state,after_state) values(p_id,auth.uid(),'REVOKE',btrim(p_reason),to_jsonb(old_row),to_jsonb(new_row));
 return to_jsonb(new_row);
end $$;

create function public.enforce_finance_request_block() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare b public.finance_blocks; d date;
begin
 -- Finance programs, memberships and payroll requests; ordinary Marketplace stays separate.
 if new.program_id='prestamo' or new.program_item_id is not null or new.membership_offering_id is not null or new.financial_processing_status is not null then
  perform 1 from public.affiliates where id=new.affiliate_id for update;
  d:=(clock_timestamp() at time zone 'America/Hermosillo')::date;
  select * into b from public.finance_blocks where affiliate_id=new.affiliate_id and revoked_at is null and d between starts_on and ends_on;
  if b.id is not null then raise exception 'FINANCE_REQUEST_BLOCKED' using errcode='P0001',detail=jsonb_build_object('starts_on',b.starts_on,'ends_on',b.ends_on,'reason',b.reason)::text; end if;
 end if;
 return new;
end $$;
create trigger zz_finance_request_block before insert on public.program_requests for each row execute function public.enforce_finance_request_block();

revoke all on function public.get_self_finance_block(),public.list_admin_finance_blocks(uuid),public.save_admin_finance_block(uuid,uuid,integer,date,date,text),public.revoke_admin_finance_block(uuid,integer,text),public.enforce_finance_request_block() from public,anon,authenticated,service_role;
grant execute on function public.get_self_finance_block(),public.list_admin_finance_blocks(uuid),public.save_admin_finance_block(uuid,uuid,integer,date,date,text),public.revoke_admin_finance_block(uuid,integer,text) to authenticated;
commit;
