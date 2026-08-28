begin;

do $$
begin
  if exists(select 1 from public.affiliates where record_origin='ADMIN_AFFILIATES') then
    raise exception 'RECOVERY_BLOCKED_ADMIN_AFFILIATES_EXIST';
  end if;
  if exists(select 1 from public.affiliate_admin_events) then
    raise exception 'RECOVERY_BLOCKED_AFFILIATE_AUDIT_EXISTS';
  end if;
end $$;

revoke execute on function public.list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text) from authenticated;
revoke execute on function public.find_admin_affiliate_duplicates(jsonb,uuid) from authenticated;
revoke execute on function public.get_admin_affiliate_workbench(uuid) from authenticated;
revoke execute on function public.create_admin_affiliate(jsonb,text) from authenticated;
revoke execute on function public.update_admin_affiliate(uuid,timestamptz,jsonb,text) from authenticated;
revoke execute on function public.change_admin_affiliate_status(uuid,timestamptz,text,text) from authenticated;
drop function public.list_admin_affiliates(text,text,boolean,text,boolean,text,text,integer,integer,text);
drop function public.find_admin_affiliate_duplicates(jsonb,uuid);
drop function public.get_admin_affiliate_workbench(uuid);
drop function public.create_admin_affiliate(jsonb,text);
drop function public.update_admin_affiliate(uuid,timestamptz,jsonb,text);
drop function public.change_admin_affiliate_status(uuid,timestamptz,text,text);
drop table public.affiliate_admin_events;
drop index public.affiliates_admin_union_category_idx;
drop index public.affiliates_admin_status_idx;
drop index public.affiliates_historical_source_identity_unique;
alter table public.affiliates
  drop constraint affiliates_source_provenance_check,
  drop constraint affiliates_record_origin_check,
  alter column source_row_ordinal set not null,
  alter column source_file_hash set not null,
  add constraint affiliates_source_row_ordinal_check check(source_row_ordinal>0),
  add constraint affiliates_source_file_hash_check check(source_file_hash ~ '^[A-F0-9]{64}$'),
  add constraint affiliates_source_identity_unique unique(source_file_hash,source_row_ordinal),
  drop column record_origin;

notify pgrst,'reload schema';
commit;
