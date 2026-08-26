begin;

create table public.company_popup_proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  popup_id uuid null references public.popups(id) on delete restrict,
  title text not null check(length(btrim(title)) between 1 and 140),
  body text not null default '' check(length(body)<=4000),
  action_label text null check(action_label is null or length(action_label)<=80),
  action_type text not null default 'none' check(action_type in ('none','internal','url','custom')),
  action_target text null check(action_target is null or length(action_target)<=2000),
  custom_screen jsonb null check(custom_screen is null or jsonb_typeof(custom_screen)='object'),
  image_asset_id uuid null references public.app_assets(id) on delete restrict,
  audience_raw jsonb not null default '{"mode":"all","cargos":[],"sindicatos":[],"niveles":[]}'::jsonb check(jsonb_typeof(audience_raw)='object'),
  accent_hue integer not null default 345 check(accent_hue between 0 and 359),
  start_at timestamptz null,
  end_at timestamptz null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  rejection_reason text null check(rejection_reason is null or length(rejection_reason)<=1000),
  submitted_by uuid not null default auth.uid(),
  reviewed_by uuid null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_popup_proposal_dates check(end_at is null or start_at is null or end_at>=start_at),
  constraint company_popup_review_state check(
    (status='pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null and popup_id is null)
    or (status='approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null and popup_id is not null)
    or (status='rejected' and reviewed_by is not null and reviewed_at is not null and nullif(btrim(rejection_reason),'') is not null and popup_id is null)
  )
);

create index company_popup_proposals_company_idx on public.company_popup_proposals(company_id,created_at desc);
create index company_popup_proposals_review_idx on public.company_popup_proposals(status,created_at desc);
create trigger company_popup_proposals_updated_at before update on public.company_popup_proposals for each row execute function public.set_h0072_updated_at();
create trigger company_popup_proposals_admin_audit after insert or update or delete on public.company_popup_proposals for each row execute function public.audit_admin_write();

alter table public.company_popup_proposals enable row level security;
alter table public.company_popup_proposals force row level security;
revoke all on public.company_popup_proposals from public,anon,authenticated;
grant select,insert on public.company_popup_proposals to authenticated;

create policy company_popup_proposals_read on public.company_popup_proposals for select to authenticated using(
  public.has_admin_permission('popups.read') or public.is_marketplace_company_member(company_id)
);
create policy company_popup_proposals_company_insert on public.company_popup_proposals for insert to authenticated with check(
  submitted_by=(select auth.uid())
  and status='pending' and popup_id is null and reviewed_by is null and reviewed_at is null and rejection_reason is null
  and public.is_marketplace_company_member(company_id)
  and (image_asset_id is null or exists(
    select 1 from public.app_assets a where a.id=image_asset_id and a.owner_company_id=company_popup_proposals.company_id and a.status='READY'
  ))
  and exists(
    select 1 from public.company_portal_subscriptions s
    join public.company_portal_plans p on p.id=s.plan_id
    where s.company_id=company_popup_proposals.company_id and s.status='active' and p.enabled and p.allows_popups
      and s.starts_on<=current_date and s.ends_on>=current_date
  )
);

create function public.review_company_popup_proposal(p_proposal_id uuid,p_approve boolean,p_reason text default null)
returns public.company_popup_proposals language plpgsql security definer set search_path=''
as $$
declare v_proposal public.company_popup_proposals%rowtype; v_popup_id uuid;
begin
  if not public.has_admin_permission('popups.write') then raise exception 'ADMIN_PERMISSION_REQUIRED' using errcode='42501'; end if;
  select * into v_proposal from public.company_popup_proposals where id=p_proposal_id for update;
  if v_proposal.id is null then raise exception 'POPUP_PROPOSAL_NOT_FOUND' using errcode='P0002'; end if;
  if v_proposal.status<>'pending' then raise exception 'POPUP_PROPOSAL_ALREADY_REVIEWED' using errcode='P0001'; end if;
  if p_approve then
    insert into public.popups(title,body,image_asset_id,action_label,action_url,audience_raw,enabled,start_at,end_at,sort_order,record_origin)
    values(v_proposal.title,v_proposal.body,v_proposal.image_asset_id,v_proposal.action_label,
      case when v_proposal.action_type='url' then v_proposal.action_target else null end,
      v_proposal.audience_raw,false,v_proposal.start_at,v_proposal.end_at,
      coalesce((select max(sort_order)+1 from public.popups),1),'ADMIN_H009') returning id into v_popup_id;
    update public.company_popup_proposals set status='approved',popup_id=v_popup_id,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=null where id=p_proposal_id returning * into v_proposal;
  else
    if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'REJECTION_REASON_REQUIRED' using errcode='22023'; end if;
    update public.company_popup_proposals set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=btrim(p_reason) where id=p_proposal_id returning * into v_proposal;
  end if;
  return v_proposal;
end $$;

revoke execute on function public.review_company_popup_proposal(uuid,boolean,text) from public,anon;
grant execute on function public.review_company_popup_proposal(uuid,boolean,text) to authenticated;
comment on table public.company_popup_proposals is 'Authoritative company-to-admin popup proposal workflow. Approved rows create disabled popup drafts for final publication control.';
commit;
