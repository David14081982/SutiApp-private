begin;
-- Keep origin columns and values: dropping them would destroy post-cutover provenance.
do $$ declare r record;begin for r in select * from(values
 ('company_assets','companies','companies.write','','sort_order','asset_id','',''),
 ('company_benefit_profiles','agreements','companies.write','','sort_order','','',''),
 ('company_benefits','agreements','companies.write','enabled','sort_order','','',''),
 ('company_audience_rules','agreements','companies.write','','','','',''),
 ('marketplace_product_assets','marketplace','marketplace.write','','sort_order','asset_id','',''),
 ('marketplace_promotions','marketplace','marketplace.write','enabled','sort_order','image_asset_id','','')
)v(tbl,section_key,technical,publish_col,order_col,asset_cols,origin_col,admin_origin) loop
 execute format('drop trigger if exists %I_section_action_guard on public.%I',r.tbl,r.tbl);
 execute format('create trigger %I_section_action_guard before insert or update or delete on public.%I for each row execute function public.enforce_section_row_action(%L,%L,%L,%L,%L,%L,%L)',r.tbl,r.tbl,r.section_key,r.technical,r.publish_col,r.order_col,r.asset_cols,r.origin_col,r.admin_origin);
end loop;end $$;
commit;
