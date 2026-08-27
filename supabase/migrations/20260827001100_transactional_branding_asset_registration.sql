begin;

create or replace function public.register_branding_assets(p_assets jsonb)
returns table(
  asset_key text,
  asset_id uuid,
  previous_storage_bucket text,
  previous_storage_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_asset_key text;
  v_storage_path text;
  v_mime_type text;
  v_file_size bigint;
  v_content_sha256 text;
  v_extension text;
  v_expected_path text;
  v_asset_id uuid;
  v_previous_bucket text;
  v_previous_path text;
  v_count integer;
  v_keys text[] := array[]::text[];
begin
  if not public.has_admin_permission('assets.write') then
    raise exception 'ADMIN_DENIED' using errcode = '42501';
  end if;

  if jsonb_typeof(p_assets) <> 'array' then
    raise exception 'INVALID_ASSET_BATCH' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_assets);
  if v_count < 1 or v_count > 4 then
    raise exception 'INVALID_ASSET_BATCH' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_assets)
  loop
    v_asset_key := nullif(trim(v_item->>'asset_key'), '');
    v_storage_path := nullif(trim(v_item->>'storage_path'), '');
    v_mime_type := nullif(trim(v_item->>'mime_type'), '');
    v_content_sha256 := upper(nullif(trim(v_item->>'content_sha256'), ''));
    begin
      v_file_size := (v_item->>'file_size')::bigint;
    exception when others then
      raise exception 'INVALID_ASSET_FILE_SIZE' using errcode = '22023';
    end;

    if v_asset_key is null or not (v_asset_key = any(array[
      'brand.pwa.512',
      'brand.institutional-seal',
      'brand.favicon-pwa-192',
      'brand.pwa.apple-touch',
      'brand.pwa.maskable-512',
      'pwa.install-screen-1',
      'pwa.install-screen-2',
      'pwa.install-screen-3',
      'home.header.collapsed'
    ]::text[])) then
      raise exception 'UNKNOWN_BRANDING_ASSET' using errcode = '22023';
    end if;
    if v_asset_key = any(v_keys) then
      raise exception 'DUPLICATE_BRANDING_ASSET' using errcode = '22023';
    end if;
    v_keys := array_append(v_keys, v_asset_key);

    v_extension := case v_mime_type
      when 'image/png' then 'png'
      when 'image/jpeg' then 'jpg'
      when 'image/gif' then 'gif'
      when 'image/webp' then 'webp'
      when 'image/svg+xml' then 'svg'
      when 'image/x-icon' then 'ico'
      else null
    end;
    if v_extension is null or v_file_size < 1 or v_file_size > 10485760
       or v_content_sha256 !~ '^[A-F0-9]{64}$' then
      raise exception 'INVALID_BRANDING_ASSET' using errcode = '22023';
    end if;

    v_expected_path := 'branding/admin/' ||
      regexp_replace(v_asset_key, '[^a-zA-Z0-9._-]', '-', 'g') || '/' ||
      lower(v_content_sha256) || '.' || v_extension;
    if v_storage_path is distinct from v_expected_path then
      raise exception 'INVALID_BRANDING_STORAGE_PATH' using errcode = '22023';
    end if;
    if not exists(
      select 1 from storage.objects o
      where o.bucket_id = 'app-assets' and o.name = v_storage_path
    ) then
      raise exception 'BRANDING_UPLOAD_NOT_FOUND' using errcode = '22023';
    end if;

    select a.id, a.storage_bucket, a.storage_path
      into v_asset_id, v_previous_bucket, v_previous_path
    from public.app_assets a
    where a.asset_key = v_asset_key
    for update;

    if v_asset_id is null then
      insert into public.app_assets(
        asset_key, asset_type, title, alt_text, storage_bucket, storage_path,
        mime_type, file_size, content_sha256, status
      ) values (
        v_asset_key, 'BRANDING', v_asset_key, replace(v_asset_key, '.', ' '),
        'app-assets', v_storage_path, v_mime_type, v_file_size,
        v_content_sha256, 'READY'
      ) returning id into v_asset_id;
    else
      update public.app_assets set
        asset_type = 'BRANDING',
        title = v_asset_key,
        alt_text = replace(v_asset_key, '.', ' '),
        storage_bucket = 'app-assets',
        storage_path = v_storage_path,
        mime_type = v_mime_type,
        file_size = v_file_size,
        content_sha256 = v_content_sha256,
        status = 'READY'
      where id = v_asset_id;
    end if;

    insert into public.asset_sources(
      asset_id, source_sheet, source_column, source_snapshot_hash
    ) values (
      v_asset_id, 'ADMIN_H009', v_asset_key, v_content_sha256
    ) on conflict do nothing;

    case v_asset_key
      when 'brand.pwa.512' then
        update public.app_settings
          set app_icon_asset_id = v_asset_id, pwa_icon_512_asset_id = v_asset_id
        where id = 'primary';
      when 'brand.institutional-seal' then
        update public.app_settings set institutional_seal_asset_id = v_asset_id where id = 'primary';
      when 'brand.favicon-pwa-192' then
        update public.app_settings
          set favicon_asset_id = v_asset_id, pwa_icon_192_asset_id = v_asset_id
        where id = 'primary';
      when 'brand.pwa.apple-touch' then
        update public.app_settings set apple_touch_asset_id = v_asset_id where id = 'primary';
      when 'brand.pwa.maskable-512' then
        update public.app_settings set pwa_maskable_512_asset_id = v_asset_id where id = 'primary';
      when 'pwa.install-screen-1' then
        update public.app_settings set install_screen_1_asset_id = v_asset_id where id = 'primary';
      when 'pwa.install-screen-2' then
        update public.app_settings set install_screen_2_asset_id = v_asset_id where id = 'primary';
      when 'pwa.install-screen-3' then
        update public.app_settings set install_screen_3_asset_id = v_asset_id where id = 'primary';
      when 'home.header.collapsed' then null;
    end case;

    asset_key := v_asset_key;
    asset_id := v_asset_id;
    previous_storage_bucket := v_previous_bucket;
    previous_storage_path := v_previous_path;
    return next;
  end loop;
end;
$$;

revoke all on function public.register_branding_assets(jsonb) from public, anon, authenticated;
grant execute on function public.register_branding_assets(jsonb) to authenticated;

comment on function public.register_branding_assets(jsonb) is
  'Atomically registers allowlisted public branding assets, provenance and app_settings links after an authorized Storage upload.';

commit;
