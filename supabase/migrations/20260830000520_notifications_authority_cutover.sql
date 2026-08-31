begin;

alter table public.program_requests
  add column seen_at timestamptz null;

create index program_requests_affiliate_unseen_quote_idx
  on public.program_requests(affiliate_id,responded_at desc,id)
  where request_type='quote' and status='approved' and seen_at is null;

comment on column public.program_requests.seen_at is
  'Affiliate acknowledgement time for a completed quote. NULL means the real quote response remains unread; it is never inferred from browser state.';

create or replace function public.respond_program_request_quote(p_request_id uuid,p_amount numeric,p_note text,p_valid_until date)
returns public.program_requests language plpgsql security definer set search_path=''
as $$
declare v_row public.program_requests%rowtype;
begin
  select * into v_row from public.program_requests where id=p_request_id;
  if v_row.id is null or v_row.request_type<>'quote' then raise exception 'QUOTE_NOT_FOUND' using errcode='P0001'; end if;
  if not (public.has_admin_permission('program_requests.write') or (v_row.company_id is not null and public.is_marketplace_company_member(v_row.company_id,'quotes'))) then
    raise exception 'QUOTE_DENIED' using errcode='42501';
  end if;
  if p_amount is null or p_amount<=0 then raise exception 'QUOTE_AMOUNT_INVALID' using errcode='22023'; end if;
  update public.program_requests set status='approved',quoted_amount=p_amount,quote_note=left(nullif(btrim(coalesce(p_note,'')),''),2000),
    valid_until=p_valid_until,responded_by_auth_user_id=(select auth.uid()),responded_at=now(),seen_at=null,updated_at=now()
  where id=p_request_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.mark_marketplace_quote_seen(p_quote_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_affiliate uuid;
begin
  v_affiliate:=public.get_effective_affiliate_id();
  if v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;

  update public.program_requests
  set seen_at=coalesce(seen_at,now()),updated_at=now()
  where id=p_quote_id and affiliate_id=v_affiliate and request_type='quote' and status='approved';
  if found then return; end if;

  -- Historical pre-cutover quotes retain their original authority and writer.
  update public.marketplace_quote_requests
  set seen_at=coalesce(seen_at,now()),updated_at=now()
  where id=p_quote_id and affiliate_id=v_affiliate and status='quoted';
  if not found then raise exception 'QUOTE_DENIED' using errcode='42501'; end if;
end $$;

revoke all on function public.mark_marketplace_quote_seen(uuid) from public,anon,authenticated;
grant execute on function public.mark_marketplace_quote_seen(uuid) to authenticated;
revoke execute on function public.respond_program_request_quote(uuid,numeric,text,date) from public,anon;
grant execute on function public.respond_program_request_quote(uuid,numeric,text,date) to authenticated;

notify pgrst, 'reload schema';

commit;
