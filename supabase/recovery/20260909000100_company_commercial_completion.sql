begin;
-- Roll frontend back before removing these additive entry points. No history is deleted.
drop trigger company_popup_author_guard on public.company_popup_proposals;
drop function public.enforce_company_popup_author();
drop trigger company_promotion_publication_guard on public.marketplace_promotions;
drop function public.enforce_company_promotion_publication();
drop function public.list_company_commercial_requests();
create or replace function public.list_public_convenios() returns jsonb
language sql stable security definer set search_path='' as $$
 with company_rows as (
 select c.sort_order, jsonb_build_object('id',c.id,'source_kind',case when public.company_is_paid(c.id) then 'paid_company' else 'agreement' end,
 'display_name',c.display_name,'description',c.description,'category_raw',coalesce(nullif(p.category_label,''),c.category_raw),
 'address_raw',coalesce(nullif(p.address,''),c.address_raw),'location_raw',c.location_raw,'phone_raw',c.phone_raw,'whatsapp_raw',c.whatsapp_raw,'email_raw',c.email_raw,'website_url',c.website_url,
 'public_details',c.public_details,'agreement_description',coalesce(p.description,''),'conditions',coalesce(p.conditions,''),'discount_percent',p.discount_percent,'featured',coalesce(p.featured,false),
 'logo_asset_id',c.logo_asset_id,'cover_asset_id',(select asset_id from public.company_assets where company_id=c.id and role='cover' order by sort_order limit 1),
 'gallery_asset_ids',coalesce((select jsonb_agg(asset_id order by sort_order) from public.company_assets where company_id=c.id and role='gallery'),'[]'),
 'benefits',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'label',b.label,'description',b.description) order by b.sort_order) from public.company_benefits b where b.company_id=c.id and b.enabled and public.matches_current_affiliate_audience(b.audience_mode,b.union_codes,b.employment_category_codes,b.gender_codes,b.tag_codes)),'[]'),
 'promotions',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'image_asset_id',m.image_asset_id,'label',m.title,'description',m.description,'discount_percent',m.discount_percent)) from public.marketplace_promotions m where m.company_id=c.id and m.enabled and m.approval_status='approved' and (m.start_date is null or m.start_date<=current_date) and (m.end_date is null or m.end_date>=current_date)),'[]')) as row
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
