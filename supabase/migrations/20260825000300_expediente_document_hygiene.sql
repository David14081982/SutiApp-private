begin;

-- Owner-authorized semantic separation. This classifies relations; it does not
-- delete, move or duplicate either logical relations or physical objects.
alter table public.affiliate_files
  add column expediente_classification text;

update public.affiliate_files af
set expediente_classification = case
  when af.id in (
    select distinct on (d.affiliate_id,d.document_type_id) d.affiliate_file_id
    from public.affiliate_documents d
    where d.affiliate_file_id is not null
    order by d.affiliate_id,d.document_type_id,d.created_at desc,d.id desc
  ) then 'CURRENT_DOCUMENT'
  when lower(af.file_key) in (
    'html_general','codigo_popup_sutiapp','condicional_popup','imagen_principal','logotipo'
  ) or lower(af.file_key) ~ '^b([1-9]|10)$' then 'HISTORICAL_NON_DOCUMENT'
  when lower(af.file_key) in (
    'url_impresion_ahorro','aviso_caja_de_aorro','img_ppal_ahorro'
  ) then 'LEGACY_DOCUMENT'
  when lower(af.file_key) in (
    'profile_photo','ine_front','ine_back','payroll_receipt','payroll_receipt_latest',
    'membership_form','tribunal_form','credential'
  ) then 'HISTORICAL_DOCUMENT_VERSION'
  else 'UNCLASSIFIED_DOCUMENT'
end;

alter table public.affiliate_files
  alter column expediente_classification set not null,
  add constraint affiliate_files_expediente_classification_check check (
    expediente_classification in (
      'CURRENT_DOCUMENT','HISTORICAL_DOCUMENT_VERSION','LEGACY_DOCUMENT',
      'DUPLICATE_RELATION','UNCLASSIFIED_DOCUMENT','HISTORICAL_NON_DOCUMENT'
    )
  );

create index affiliate_files_expediente_classification_idx
  on public.affiliate_files(affiliate_id, expediente_classification, sort_order, url_order);

-- Keep the semantic cut correct after every upload/review lifecycle. Recomputing
-- one affiliate is intentionally favored over a second mutable authority.
create or replace function public.refresh_affiliate_expediente_classification(p_affiliate_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.affiliate_files af
  set expediente_classification = 'HISTORICAL_DOCUMENT_VERSION'
  where af.affiliate_id = p_affiliate_id
    and exists (
      select 1 from public.affiliate_documents d
      where d.affiliate_file_id = af.id
    );

  update public.affiliate_files af
  set expediente_classification = 'CURRENT_DOCUMENT'
  where af.id in (
    select distinct on (d.document_type_id) d.affiliate_file_id
    from public.affiliate_documents d
    where d.affiliate_id = p_affiliate_id
      and d.affiliate_file_id is not null
    order by d.document_type_id,d.created_at desc,d.id desc
  );
end;
$$;

revoke all on function public.refresh_affiliate_expediente_classification(uuid) from public, anon, authenticated;

create or replace function public.sync_affiliate_expediente_classification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' and old.affiliate_id is not null then
    perform public.refresh_affiliate_expediente_classification(old.affiliate_id);
  end if;
  if tg_op <> 'DELETE' and new.affiliate_id is not null
     and (tg_op = 'INSERT' or old.affiliate_id is distinct from new.affiliate_id) then
    perform public.refresh_affiliate_expediente_classification(new.affiliate_id);
  elsif tg_op = 'UPDATE' and new.affiliate_id is not null then
    perform public.refresh_affiliate_expediente_classification(new.affiliate_id);
  end if;
  return null;
end;
$$;

revoke all on function public.sync_affiliate_expediente_classification() from public, anon, authenticated;

create trigger affiliate_documents_sync_expediente_classification
after insert or update of affiliate_id,document_type_id,affiliate_file_id,created_at or delete
on public.affiliate_documents
for each row execute function public.sync_affiliate_expediente_classification();

grant select (expediente_classification) on public.affiliate_files to authenticated;

drop policy affiliate_files_authorized_read on public.affiliate_files;
create policy affiliate_files_authorized_read on public.affiliate_files
for select to authenticated using (
  public.has_admin_permission('assets.read')
  or (
    affiliate_id = public.get_effective_affiliate_id()
    and expediente_classification = 'CURRENT_DOCUMENT'
  )
);

drop policy private_assets_authorized_read on public.private_assets;
create policy private_assets_authorized_read on public.private_assets
for select to authenticated using (
  public.has_admin_permission('assets.read')
  or exists (
    select 1 from public.affiliate_files af
    where af.private_asset_id = private_assets.id
      and af.affiliate_id = public.get_effective_affiliate_id()
      and af.status = 'READY'
      and af.expediente_classification = 'CURRENT_DOCUMENT'
  )
  or exists (
    select 1
    from public.affiliate_documents d
    left join public.affiliate_files af on af.id = d.affiliate_file_id
    where coalesce(d.private_asset_id, af.private_asset_id) = private_assets.id
      and d.affiliate_id = public.get_effective_affiliate_id()
      and d.status <> 'REJECTED'
  )
);

drop policy master_private_storage_authorized_read on storage.objects;
create policy master_private_storage_authorized_read on storage.objects
for select to authenticated using (
  bucket_id = 'private-assets' and (
    public.has_admin_permission('assets.read')
    or exists (
      select 1
      from public.private_assets pa
      left join public.affiliate_files af on af.private_asset_id = pa.id
      left join public.affiliate_documents d
        on d.private_asset_id = pa.id or d.affiliate_file_id = af.id
      where pa.storage_path = name
        and pa.storage_bucket = bucket_id
        and pa.status = 'READY'
        and (
          (af.affiliate_id = public.get_effective_affiliate_id()
            and af.status = 'READY'
            and af.expediente_classification = 'CURRENT_DOCUMENT')
          or (d.affiliate_id = public.get_effective_affiliate_id() and d.status <> 'REJECTED')
        )
    )
  )
);

comment on column public.affiliate_files.expediente_classification is
  'Owner-authorized document hygiene classification. Hiding preserves relation, provenance, hash and Storage object.';

commit;
