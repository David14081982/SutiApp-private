create function pg_temp.photo_check(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'PHOTO_CHECK_FAILED:%',label;end if;end$$;
do $$
declare a record;b record;p text;other_path text;photo uuid;photo2 uuid;old_id uuid;h text;denied boolean;before_count bigint;after_count bigint;
begin
  select f.id,f.auth_user_id into a from public.affiliates f join auth.users u on u.id=f.auth_user_id
  where not f.is_archived and f.auth_eligibility='eligible' and u.email_confirmed_at is not null
  and lower(u.email)=f.historical_email_normalized and (select count(*) from public.affiliates x where x.historical_email_normalized=f.historical_email_normalized)=1
  and not exists(select 1 from public.admin_assignments x where x.auth_user_id=f.auth_user_id and x.enabled) limit 1;
  select f.id,f.auth_user_id into b from public.affiliates f join auth.users u on u.id=f.auth_user_id
  where f.id<>a.id and not f.is_archived and f.auth_eligibility='eligible' and u.email_confirmed_at is not null
  and lower(u.email)=f.historical_email_normalized and (select count(*) from public.affiliates x where x.historical_email_normalized=f.historical_email_normalized)=1 limit 1;
  perform pg_temp.photo_check(a.id is not null and b.id is not null,'two principals');
  perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a.auth_user_id,'role','authenticated','session_id',extensions.gen_random_uuid())::text,true);
  perform pg_temp.photo_check(public.get_effective_affiliate_id()=a.id,'identity');
  select id into old_id from public.affiliate_files where affiliate_id=a.id and is_current_profile_photo;
  select count(*) into before_count from public.affiliate_documents;
  p:='affiliate-documents/'||a.id||'/'||extensions.gen_random_uuid()||'.jpg';
  h:=upper(encode(extensions.digest(p,'sha256'),'hex'));
  perform set_config('role','authenticated',true);
  insert into storage.objects(bucket_id,name,owner_id,metadata) values('private-assets',p,a.auth_user_id::text,'{"size":100,"mimetype":"image/jpeg"}');
  perform set_config('role','authenticated',true);
  photo:=public.set_self_profile_photo(p,'image/jpeg',100,h);
  perform pg_temp.photo_check((select is_current_profile_photo from public.affiliate_files where id=photo),'owner write/read');
  perform pg_temp.photo_check(public.set_self_profile_photo(p,'image/jpeg',100,h)=photo,'idempotent');
  perform set_config('role','none',true);
  select count(*) into after_count from public.affiliate_documents;
  perform pg_temp.photo_check(before_count=after_count,'documents preserved');
  perform pg_temp.photo_check(old_id is null or exists(select 1 from public.affiliate_files where id=old_id and status='READY' and not is_current_profile_photo),'old photo preserved');
  perform pg_temp.photo_check((select count(*)=1 from public.affiliate_files where affiliate_id=a.id and is_current_profile_photo),'single authority');
  perform pg_temp.photo_check(exists(select 1 from public.sensitive_change_audit where target_id=photo and actor_auth_user_id=a.auth_user_id and affiliate_id=a.id),'audit');
  other_path:='affiliate-documents/'||b.id||'/'||extensions.gen_random_uuid()||'.jpg';
  insert into storage.objects(bucket_id,name,owner_id,metadata) values('private-assets',other_path,b.auth_user_id::text,'{"size":100,"mimetype":"image/jpeg"}');
  perform set_config('request.jwt.claim.sub',b.auth_user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b.auth_user_id,'role','authenticated','session_id',extensions.gen_random_uuid())::text,true);
  perform set_config('role','authenticated',true);
  perform pg_temp.photo_check(not exists(select 1 from public.affiliate_files where id=photo),'cross-user read denied');
  perform pg_temp.photo_check(not exists(select 1 from storage.objects where bucket_id='private-assets' and name=p),'cross-user storage denied');
  denied:=false;begin insert into storage.objects(bucket_id,name,owner_id,metadata) values('private-assets','affiliate-documents/'||a.id||'/'||extensions.gen_random_uuid()||'.jpg',b.auth_user_id::text,'{"size":100,"mimetype":"image/jpeg"}');exception when insufficient_privilege then denied:=true;end;
  perform pg_temp.photo_check(denied,'cross-user upload denied');
  denied:=false;begin perform public.set_self_profile_photo(p,'image/jpeg',100,h);exception when others then denied:=true;end;
  perform pg_temp.photo_check(denied,'cross-user path denied');
  denied:=false;begin perform public.set_self_profile_photo(other_path,'image/jpeg',100,h);exception when insufficient_privilege then denied:=true;end;
  perform pg_temp.photo_check(denied,'cross-user hash denied');
  denied:=false;begin perform public.set_self_profile_photo(other_path,'image/jpeg',101,repeat('F',64));exception when insufficient_privilege then denied:=true;end;
  perform pg_temp.photo_check(denied,'metadata mismatch denied');
  denied:=false;begin update public.affiliate_files set is_current_profile_photo=true where id=photo;exception when insufficient_privilege then denied:=true;end;
  perform pg_temp.photo_check(denied,'direct write denied');
  perform set_config('role','none',true);
  perform pg_temp.photo_check(not has_function_privilege('anon','public.set_self_profile_photo(text,text,bigint,text)','execute'),'anon denied');
end $$;
select 'PASS' status,'owner, idempotency, history, documents, audit, cross-user read/storage/path/hash, metadata, direct write, anon' checks;
