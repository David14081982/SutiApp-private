begin;

create function public.list_self_marketplace_quote_notifications()
returns setof jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_affiliate uuid;
begin
  v_affiliate:=public.get_effective_affiliate_id();
  if v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  return query
  select jsonb_strip_nulls(jsonb_build_object(
    'id',r.id,'folio',r.folio,'affiliate_id',r.affiliate_id,'program_id',r.program_id,
    'product_id',r.product_id,'company_id',r.company_id,'request_type',r.request_type,
    'status',r.status,'quoted_amount',r.quoted_amount,'quote_note',r.quote_note,
    'valid_until',r.valid_until,'responded_at',r.responded_at,'seen_at',r.seen_at,
    'created_at',r.created_at,'updated_at',r.updated_at,
    'product',case when p.id is null then null else jsonb_build_object('name',p.name,'price',p.price) end,
    'company',case when c.id is null then null else jsonb_build_object('display_name',c.display_name) end
  ))
  from public.program_requests r
  left join public.marketplace_products p on p.id=r.product_id
  left join public.companies c on c.id=r.company_id
  where r.affiliate_id=v_affiliate and r.program_id='marketplace' and r.request_type='quote'
  order by r.created_at desc,r.id desc;
end $$;

revoke all on function public.list_self_marketplace_quote_notifications() from public,anon,authenticated;
grant execute on function public.list_self_marketplace_quote_notifications() to authenticated;

notify pgrst, 'reload schema';

commit;
