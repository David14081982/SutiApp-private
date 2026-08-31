begin;

create function public.enforce_program_catalog_asset_owner()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=(select auth.uid());
begin
  if new.source_column='ADMIN_UPLOAD'
     and (tg_op='INSERT' or new.public_asset_id is distinct from old.public_asset_id)
     and (v_actor is null or not exists(
       select 1 from public.app_assets a
       where a.id=new.public_asset_id
         and a.storage_bucket='app-assets'
         and a.storage_path like 'program-products/'||v_actor::text||'/%'
     ))
  then
    raise exception 'PROGRAM_CATALOG_ASSET_NOT_OWNED' using errcode='42501';
  end if;
  return new;
end $$;

create trigger program_catalog_asset_owner_guard
before insert or update of public_asset_id,source_column on public.program_catalog_item_assets
for each row execute function public.enforce_program_catalog_asset_owner();

revoke all on function public.enforce_program_catalog_asset_owner() from public,anon,authenticated;
comment on function public.enforce_program_catalog_asset_owner() is 'Prevents an Admin writer from linking another actor folder asset to a program product.';

commit;
