begin;

drop function if exists public.mark_marketplace_quote_seen(uuid);
grant insert on public.marketplace_quote_requests, public.marketplace_benefit_requests to authenticated;
grant update (status,quoted_amount,quote_note,valid_until,quoted_by_auth_user_id,quoted_at,seen_at,updated_at) on public.marketplace_quote_requests to authenticated;

drop policy marketplace_products_public_read on public.marketplace_products;
create policy marketplace_products_public_read on public.marketplace_products for select to anon,authenticated
using (enabled or public.has_admin_permission('marketplace.read') or public.is_marketplace_company_member(company_id));

create or replace function public.create_marketplace_quote(p_product_id uuid,p_message text,p_signature_data text,p_terms_accepted boolean)
returns public.marketplace_quote_requests language plpgsql security definer set search_path=''
as $$
declare v_product public.marketplace_products%rowtype; v_affiliate uuid; v_row public.marketplace_quote_requests%rowtype;
begin
  v_affiliate:=public.get_effective_affiliate_id();
  if v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='P0001'; end if;
  select * into v_product from public.marketplace_products where id=p_product_id and enabled and requires_quote;
  if v_product.id is null then raise exception 'PRODUCT_NOT_QUOTABLE' using errcode='P0001'; end if;
  insert into public.marketplace_quote_requests(actor_real_auth_user_id,affiliate_id,product_id,company_id,message,signature_data,terms_accepted)
  values ((select auth.uid()),v_affiliate,v_product.id,v_product.company_id,left(coalesce(p_message,''),2000),p_signature_data,coalesce(p_terms_accepted,false)) returning * into v_row;
  return v_row;
end $$;

create or replace function public.create_marketplace_benefit_request(p_product_id uuid,p_quantity integer,p_message text,p_signature_data text,p_terms_accepted boolean)
returns public.marketplace_benefit_requests language plpgsql security definer set search_path=''
as $$
declare v_product public.marketplace_products%rowtype;v_affiliate uuid;v_row public.marketplace_benefit_requests%rowtype;
begin
  v_affiliate:=public.get_effective_affiliate_id();if v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='P0001';end if;
  select * into v_product from public.marketplace_products where id=p_product_id and enabled and not requires_quote;if v_product.id is null then raise exception 'PRODUCT_NOT_REQUESTABLE' using errcode='P0001';end if;
  insert into public.marketplace_benefit_requests(actor_real_auth_user_id,affiliate_id,product_id,company_id,quantity,message,signature_data,terms_accepted)
  values((select auth.uid()),v_affiliate,v_product.id,v_product.company_id,greatest(1,least(coalesce(p_quantity,1),999)),left(coalesce(p_message,''),2000),p_signature_data,coalesce(p_terms_accepted,false)) returning * into v_row;return v_row;
end $$;

commit;
