begin;

do $guard$
begin
  if exists(select 1 from public.program_requests where seen_at is not null) then
    raise exception 'RECOVERY_REQUIRES_SEEN_AT_BACKUP';
  end if;
end $guard$;

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
    valid_until=p_valid_until,responded_by_auth_user_id=(select auth.uid()),responded_at=now(),updated_at=now()
  where id=p_request_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.mark_marketplace_quote_seen(p_quote_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
  update public.marketplace_quote_requests set seen_at=now(),updated_at=now()
  where id=p_quote_id and affiliate_id=public.get_effective_affiliate_id();
  if not found then raise exception 'QUOTE_DENIED' using errcode='P0001'; end if;
end $$;

drop index if exists public.program_requests_affiliate_unseen_quote_idx;
alter table public.program_requests drop column seen_at;

revoke all on function public.mark_marketplace_quote_seen(uuid) from public,anon,authenticated;
grant execute on function public.mark_marketplace_quote_seen(uuid) to authenticated;
revoke execute on function public.respond_program_request_quote(uuid,numeric,text,date) from public,anon;
grant execute on function public.respond_program_request_quote(uuid,numeric,text,date) to authenticated;

notify pgrst, 'reload schema';

commit;
