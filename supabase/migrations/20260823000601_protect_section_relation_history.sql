begin;

alter table public.company_assets add column if not exists record_origin text not null default 'HISTORICAL_IMPORT' check(record_origin in('HISTORICAL_IMPORT','ADMIN_SECTION_ROLLOUT'));
alter table public.company_benefit_profiles add column if not exists record_origin text not null default 'HISTORICAL_IMPORT' check(record_origin in('HISTORICAL_IMPORT','ADMIN_SECTION_ROLLOUT'));
alter table public.company_benefits add column if not exists record_origin text not null default 'HISTORICAL_IMPORT' check(record_origin in('HISTORICAL_IMPORT','ADMIN_SECTION_ROLLOUT'));
alter table public.company_audience_rules add column if not exists record_origin text not null default 'HISTORICAL_IMPORT' check(record_origin in('HISTORICAL_IMPORT','ADMIN_SECTION_ROLLOUT'));
alter table public.marketplace_product_assets add column if not exists record_origin text not null default 'HISTORICAL_IMPORT' check(record_origin in('HISTORICAL_IMPORT','ADMIN_PHASE3'));
alter table public.marketplace_promotions add column if not exists record_origin text not null default 'HISTORICAL_IMPORT' check(record_origin in('HISTORICAL_IMPORT','ADMIN_PHASE3'));

do $$ declare r record;begin for r in select * from(values
 ('company_assets','companies','companies.write','','sort_order','asset_id','record_origin','ADMIN_SECTION_ROLLOUT'),
 ('company_benefit_profiles','agreements','companies.write','','sort_order','','record_origin','ADMIN_SECTION_ROLLOUT'),
 ('company_benefits','agreements','companies.write','enabled','sort_order','','record_origin','ADMIN_SECTION_ROLLOUT'),
 ('company_audience_rules','agreements','companies.write','','','','record_origin','ADMIN_SECTION_ROLLOUT'),
 ('marketplace_product_assets','marketplace','marketplace.write','','sort_order','asset_id','record_origin','ADMIN_PHASE3'),
 ('marketplace_promotions','marketplace','marketplace.write','enabled','sort_order','image_asset_id','record_origin','ADMIN_PHASE3')
)v(tbl,section_key,technical,publish_col,order_col,asset_cols,origin_col,admin_origin) loop
 execute format('drop trigger if exists %I_section_action_guard on public.%I',r.tbl,r.tbl);
 execute format('create trigger %I_section_action_guard before insert or update or delete on public.%I for each row execute function public.enforce_section_row_action(%L,%L,%L,%L,%L,%L,%L)',r.tbl,r.tbl,r.section_key,r.technical,r.publish_col,r.order_col,r.asset_cols,r.origin_col,r.admin_origin);
end loop;end $$;

grant insert(record_origin) on public.company_assets,public.company_benefit_profiles,public.company_benefits,public.company_audience_rules,public.marketplace_product_assets,public.marketplace_promotions to authenticated;
commit;
