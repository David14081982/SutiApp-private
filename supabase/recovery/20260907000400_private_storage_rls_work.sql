-- H04: equivalent private Storage authorization; no data or grant changes.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
set local search_path='';
do $guard$
declare p record;
begin
 select polcmd,polpermissive,polwithcheck,
  md5(pg_get_expr(polqual,polrelid)) hash,
  array(select r.rolname::text from pg_catalog.pg_roles r where r.oid=any(polroles) order by 1) roles
 into strict p from pg_catalog.pg_policy
 where polrelid='storage.objects'::regclass and polname='master_private_storage_authorized_read';
 if p.hash is null or p.hash <> all(array['767fe699b0dc607481bfbb0e68ca1680','be9066257c7206214dcf5cbc4038984d'])
 or p.roles <> array['authenticated']::text[] or p.polcmd <> 'r'
 or not p.polpermissive or p.polwithcheck is not null then
  raise exception 'H04_POLICY_DRIFT';
 end if;
 if not (select relrowsecurity from pg_catalog.pg_class where oid='storage.objects'::regclass)
 or (select public from storage.buckets where id='private-assets') is distinct from false then
  raise exception 'H04_STORAGE_SECURITY_DRIFT';
 end if;
end;
$guard$;
alter policy master_private_storage_authorized_read on storage.objects using (((bucket_id = 'private-assets'::text) AND (public.has_admin_permission('assets.read'::text) OR (EXISTS ( SELECT 1
   FROM ((public.private_assets pa
     LEFT JOIN public.affiliate_files af ON ((af.private_asset_id = pa.id)))
     LEFT JOIN public.affiliate_documents d ON (((d.private_asset_id = pa.id) OR (d.affiliate_file_id = af.id))))
  WHERE ((pa.storage_path = objects.name) AND (pa.storage_bucket = objects.bucket_id) AND (pa.status = 'READY'::text) AND (((af.affiliate_id = public.get_effective_affiliate_id()) AND (af.status = 'READY'::text) AND (af.expediente_classification = 'CURRENT_DOCUMENT'::text)) OR ((d.affiliate_id = public.get_effective_affiliate_id()) AND (d.status <> 'REJECTED'::text)))))))));
do $guard$
declare p record;
begin
 select polcmd,polpermissive,polwithcheck,
  md5(pg_get_expr(polqual,polrelid)) hash,
  array(select r.rolname::text from pg_catalog.pg_roles r where r.oid=any(polroles) order by 1) roles
 into strict p from pg_catalog.pg_policy
 where polrelid='storage.objects'::regclass and polname='master_private_storage_authorized_read';
 if p.hash is null or p.hash <> all(array['be9066257c7206214dcf5cbc4038984d'])
 or p.roles <> array['authenticated']::text[] or p.polcmd <> 'r'
 or not p.polpermissive or p.polwithcheck is not null then
  raise exception 'H04_POLICY_DRIFT';
 end if;
 if not (select relrowsecurity from pg_catalog.pg_class where oid='storage.objects'::regclass)
 or (select public from storage.buckets where id='private-assets') is distinct from false then
  raise exception 'H04_STORAGE_SECURITY_DRIFT';
 end if;
end;
$guard$;
commit;
