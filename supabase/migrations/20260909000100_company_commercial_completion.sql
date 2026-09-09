begin;
-- Narrow tenant projection; program_requests remains canonical and table grants stay closed.
create function public.list_company_commercial_requests() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'folio',r.folio,'company_id',r.company_id,'affiliate_id',r.affiliate_id,'numero_control',r.numero_control,
  'program_id',r.program_id,'product_id',r.product_id,'request_type',r.request_type,'status',r.status,'quantity',r.quantity,
  'notes',r.notes,'quoted_amount',r.quoted_amount,'quote_note',r.quote_note,'valid_until',r.valid_until,'responded_at',r.responded_at,
  'seen_at',r.seen_at,'created_at',r.created_at,'updated_at',r.updated_at,
  'affiliate',jsonb_build_object('display_name',coalesce(a.display_name,a.full_name)),
  'product',jsonb_build_object('name',p.name,'price',p.price),'company',jsonb_build_object('display_name',c.display_name)
 ) order by r.created_at desc),'[]') into v_result
 from public.program_requests r join public.companies c on c.id=r.company_id
 left join public.marketplace_products p on p.id=r.product_id left join public.affiliates a on a.id=r.affiliate_id
 where r.program_id='marketplace' and r.request_type in ('quote','benefit')
 and not exists(select 1 from public.program_request_deletions d where d.request_id=r.id)
 and (public.has_admin_permission('company_portal.read') or public.has_admin_permission('program_requests.read')
  or (public.is_marketplace_company_member(r.company_id) and public.company_has_active_plan(r.company_id)));
 return v_result;
end $$;
revoke all on function public.list_company_commercial_requests() from public,anon,authenticated;
grant execute on function public.list_company_commercial_requests() to authenticated;

create function public.enforce_company_promotion_publication() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()='service_role' then return new;end if;
 if (tg_op='INSERT' and new.approval_status<>'pending') or (tg_op='UPDATE' and new.approval_status is distinct from old.approval_status and new.approval_status<>'pending') then
  if not public.has_admin_permission('marketplace.write') and not public.has_section_action('marketplace','publish') then raise exception 'PROMOTION_PUBLICATION_DENIED';end if;
 end if;
 if new.image_asset_id is not null and not public.has_admin_permission('marketplace.write') and not public.has_section_action('marketplace','assets') then
  if not exists(select 1 from public.app_assets a where a.id=new.image_asset_id and a.owner_company_id=new.company_id and a.status='READY') then raise exception 'PROMOTION_IMAGE_DENIED';end if;
 end if;
 return new;
end $$;
revoke all on function public.enforce_company_promotion_publication() from public,anon,authenticated;
create trigger company_promotion_publication_guard before insert or update on public.marketplace_promotions for each row execute function public.enforce_company_promotion_publication();

create function public.enforce_company_popup_author() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' and (not public.is_marketplace_company_member(new.company_id,'write') or not public.company_has_active_plan(new.company_id)) then raise exception 'COMPANY_POPUP_AUTHOR_DENIED';end if;
 return new;
end $$;
revoke all on function public.enforce_company_popup_author() from public,anon,authenticated;
create trigger company_popup_author_guard before insert on public.company_popup_proposals for each row execute function public.enforce_company_popup_author();
create or replace function public.list_public_convenios() returns jsonb
language sql stable security definer set search_path='' as $$
 with company_rows as (
 select c.sort_order, jsonb_build_object('id',c.id,'source_kind',case when public.company_is_paid(c.id) then 'paid_company' else 'agreement' end,
 'display_name',c.display_name,'description',c.description,'category_raw',coalesce(nullif(p.category_label,''),c.category_raw),
 'address_raw',coalesce(nullif(p.address,''),c.address_raw),'location_raw',c.location_raw,'phone_raw',c.phone_raw,'whatsapp_raw',c.whatsapp_raw,'email_raw',c.email_raw,'website_url',c.website_url,
 'social_links',c.social_links,'public_details',c.public_details,'agreement_description',coalesce(p.description,''),'conditions',coalesce(p.conditions,''),'discount_percent',p.discount_percent,'featured',coalesce(p.featured,false),
 'logo_asset_id',c.logo_asset_id,'cover_asset_id',(select asset_id from public.company_assets where company_id=c.id and role='cover' order by sort_order limit 1),
 'gallery_asset_ids',coalesce((select jsonb_agg(asset_id order by sort_order) from public.company_assets where company_id=c.id and role='gallery'),'[]'),
 'benefits',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'label',b.label,'description',b.description) order by b.sort_order) from public.company_benefits b where b.company_id=c.id and b.enabled and public.matches_current_affiliate_audience(b.audience_mode,b.union_codes,b.employment_category_codes,b.gender_codes,b.tag_codes)),'[]'),
 'promotions',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'image_asset_id',m.image_asset_id,'label',m.title,'description',m.description,'discount_percent',m.discount_percent,'benefit_text',m.benefit_text,'restrictions',m.restrictions,'end_date',m.end_date)) from public.marketplace_promotions m where m.company_id=c.id and m.enabled and m.approval_status='approved' and (m.start_date is null or m.start_date<=current_date) and (m.end_date is null or m.end_date>=current_date)),'[]')) as row
 from public.companies c left join public.company_benefit_profiles p on p.company_id=c.id
 where c.enabled and public.can_view_company(c.id) and (not public.company_is_paid(c.id) or public.company_has_active_plan(c.id))
 ), education_rows as (
 select e.sort_order,jsonb_build_object('id',e.id,'source_kind','education','display_name',e.title,'description',e.description,'category_raw','Educación',
 'logo_asset_id',e.image_asset_id,'cover_asset_id',e.cover_asset_id,'gallery_asset_ids','[]'::jsonb,'document_asset_id',e.document_asset_id,'website_url',e.external_url,
 'address_raw',e.public_details->>'address','phone_raw',e.public_details->>'phone','whatsapp_raw',e.public_details->>'whatsapp',
 'agreement_description',e.public_details->>'offer','conditions',e.public_details->>'conditions','discount_percent',e.public_details->'discount_percent',
 'benefits',coalesce(e.public_details->'benefits','[]'),'services',coalesce(e.public_details->'services','[]'),'public_details',e.public_details,'featured',false,'promotions','[]'::jsonb) as row
 from public.educational_resources e where e.published and e.resource_kind='education'
 ) select coalesce(jsonb_agg(row order by sort_order,row->>'display_name'),'[]') from (select * from company_rows union all select * from education_rows) x
$$;
commit;
