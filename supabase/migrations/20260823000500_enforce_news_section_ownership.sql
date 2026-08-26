begin;

-- H-MASTER-REM-NEWS-001. Pilot only: Noticias del Sindicato.
-- Requires 20260823000400. No other section is activated.

do $$
begin
  if to_regclass('public.admin_section_definitions') is null
     or to_regclass('public.admin_section_responsibilities') is null then
    raise exception 'SECTION_CAPABILITY_FOUNDATION_REQUIRED';
  end if;
  if (select count(*) from public.admin_section_definitions where enforcement_status='ENFORCED') <> 0 then
    raise exception 'UNEXPECTED_ENFORCED_SECTION';
  end if;
end $$;

create or replace function public.news_article_required_actions(
  p_old public.news_articles,
  p_new public.news_articles,
  p_operation text
)
returns text[] language plpgsql immutable set search_path=''
as $$
declare v_actions text[]:='{}'::text[];
begin
  if p_operation='INSERT' then
    v_actions:=array_append(v_actions,'create');
    if p_new.published or p_new.publish_from is not null or p_new.publish_until is not null then
      v_actions:=array_append(v_actions,'publish');
    end if;
    if p_new.image_asset_id is not null then v_actions:=array_append(v_actions,'assets'); end if;
  elsif p_operation='UPDATE' then
    if p_old.record_origin is distinct from p_new.record_origin then
      raise exception 'NEWS_RECORD_ORIGIN_IMMUTABLE' using errcode='42501';
    end if;
    if row(p_old.title,p_old.tag,p_old.body,p_old.accent_hue,p_old.display_date,p_old.reading_minutes)
       is distinct from row(p_new.title,p_new.tag,p_new.body,p_new.accent_hue,p_new.display_date,p_new.reading_minutes) then
      v_actions:=array_append(v_actions,'update');
    end if;
    if p_old.image_asset_id is distinct from p_new.image_asset_id then v_actions:=array_append(v_actions,'assets'); end if;
    if row(p_old.published,p_old.publish_from,p_old.publish_until)
       is distinct from row(p_new.published,p_new.publish_from,p_new.publish_until) then
      v_actions:=array_append(v_actions,'publish');
    end if;
    if p_old.sort_order is distinct from p_new.sort_order then v_actions:=array_append(v_actions,'order'); end if;
  elsif p_operation='DELETE' then
    v_actions:=array_append(v_actions,'delete');
  else
    raise exception 'INVALID_NEWS_OPERATION' using errcode='22023';
  end if;
  return v_actions;
end
$$;

create or replace function public.enforce_news_section_action()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actions text[]; v_action text;
begin
  if public.has_admin_permission('news.write') then return coalesce(new,old); end if;
  v_actions:=public.news_article_required_actions(old,new,tg_op);
  foreach v_action in array v_actions loop
    if not public.has_section_action('news',v_action) then
      raise exception 'NEWS_ACTION_DENIED: %',v_action using errcode='42501';
    end if;
  end loop;
  if tg_op='DELETE' and old.record_origin<>'ADMIN_PHASE2' then
    raise exception 'NEWS_HISTORICAL_DELETE_DENIED' using errcode='42501';
  end if;
  return coalesce(new,old);
end
$$;

create or replace function public.audit_news_section_action()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actions text[]; v_action text; v_id uuid;
begin
  if auth.uid() is null then return coalesce(new,old); end if;
  v_actions:=public.news_article_required_actions(old,new,tg_op);
  v_id:=case when tg_op='DELETE' then old.id else new.id end;
  foreach v_action in array v_actions loop
    insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
    values(auth.uid(),'news_articles','NEWS_'||upper(v_action),v_id::text,'SUCCESS',
      jsonb_build_object('section_key','news','section_action',v_action));
  end loop;
  return coalesce(new,old);
end
$$;

create trigger news_articles_action_guard before insert or update or delete on public.news_articles
for each row execute function public.enforce_news_section_action();
create trigger news_articles_section_action_audit after insert or update or delete on public.news_articles
for each row execute function public.audit_news_section_action();

drop policy if exists news_admin_read on public.news_articles;
drop policy if exists news_admin_write on public.news_articles;
create policy news_admin_read on public.news_articles for select to authenticated using (
  public.has_admin_permission('news.read') or public.has_admin_permission('news.write')
  or public.has_section_action('news','read')
);
create policy news_admin_insert on public.news_articles for insert to authenticated with check (
  (public.has_admin_permission('news.write') or public.has_section_action('news','create'))
  and record_origin='ADMIN_PHASE2'
);
create policy news_admin_update on public.news_articles for update to authenticated
using (
  public.has_admin_permission('news.write')
  or public.has_section_action('news','update')
  or public.has_section_action('news','publish')
  or public.has_section_action('news','order')
  or public.has_section_action('news','assets')
)
with check (
  public.has_admin_permission('news.write')
  or public.has_section_action('news','update')
  or public.has_section_action('news','publish')
  or public.has_section_action('news','order')
  or public.has_section_action('news','assets')
);
create policy news_admin_delete on public.news_articles for delete to authenticated using (
  (public.has_admin_permission('news.write') or public.has_section_action('news','delete'))
  and record_origin='ADMIN_PHASE2'
);

drop policy if exists news_settings_admin_update on public.news_settings;
create policy news_settings_admin_update on public.news_settings for update to authenticated
using (public.has_admin_permission('news.write') or public.has_section_action('news','update'))
with check (public.has_admin_permission('news.write') or public.has_section_action('news','update'));

create policy app_assets_news_insert on public.app_assets for insert to authenticated with check (
  public.has_section_action('news','assets') and asset_type='NEWS_IMAGE'
  and storage_bucket='app-assets' and owner_company_id is null
  and storage_path like ('news/'||auth.uid()::text||'/%')
);
create policy app_assets_news_update on public.app_assets for update to authenticated
using (public.has_section_action('news','assets') and asset_type='NEWS_IMAGE'
  and storage_bucket='app-assets' and storage_path like ('news/'||auth.uid()::text||'/%'))
with check (public.has_section_action('news','assets') and asset_type='NEWS_IMAGE'
  and storage_bucket='app-assets' and owner_company_id is null
  and storage_path like ('news/'||auth.uid()::text||'/%'));
create policy app_assets_news_delete on public.app_assets for delete to authenticated using (
  public.has_section_action('news','assets') and asset_type='NEWS_IMAGE'
  and storage_bucket='app-assets' and storage_path like ('news/'||auth.uid()::text||'/%')
  and not exists(select 1 from public.news_articles n where n.image_asset_id=app_assets.id)
);
create policy asset_sources_news_insert on public.asset_sources for insert to authenticated with check (
  source_sheet='ADMIN_NEWS_OWNER' and source_column='news.image'
  and exists(select 1 from public.app_assets a where a.id=asset_id and a.asset_type='NEWS_IMAGE'
    and a.storage_bucket='app-assets' and a.storage_path like ('news/'||auth.uid()::text||'/%')
    and public.has_section_action('news','assets'))
);

create policy news_section_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='app-assets' and (storage.foldername(name))[1]='news'
  and (storage.foldername(name))[2]=auth.uid()::text
  and public.has_section_action('news','assets')
);
create policy news_section_storage_update on storage.objects for update to authenticated
using (bucket_id='app-assets' and (storage.foldername(name))[1]='news'
  and (storage.foldername(name))[2]=auth.uid()::text and public.has_section_action('news','assets'))
with check (bucket_id='app-assets' and (storage.foldername(name))[1]='news'
  and (storage.foldername(name))[2]=auth.uid()::text and public.has_section_action('news','assets'));
create policy news_section_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='app-assets' and (storage.foldername(name))[1]='news'
  and (storage.foldername(name))[2]=auth.uid()::text and public.has_section_action('news','assets')
);

create or replace function public.resolve_section_responsibility_user(p_email text)
returns table(auth_user_id uuid,email text,display_name text)
language plpgsql stable security definer set search_path=''
as $$
declare v_count integer;
begin
  if not public.has_admin_permission('authorization.write') then
    raise exception 'AUTHORIZATION_DENIED' using errcode='42501';
  end if;
  select count(*) into v_count from auth.users u
   where lower(u.email)=lower(btrim(p_email)) and u.email_confirmed_at is not null;
  if v_count=0 then raise exception 'CONFIRMED_AUTH_USER_NOT_FOUND' using errcode='P0001'; end if;
  if v_count<>1 then raise exception 'AUTH_USER_EMAIL_AMBIGUOUS' using errcode='P0001'; end if;
  return query select u.id,u.email,coalesce(nullif(btrim(u.raw_user_meta_data->>'name'),''),split_part(u.email,'@',1))
   from auth.users u where lower(u.email)=lower(btrim(p_email)) and u.email_confirmed_at is not null;
end
$$;

create or replace function public.list_section_responsibilities(p_section_key text)
returns table(assignment_id uuid,auth_user_id uuid,email text,display_name text,action text,enabled boolean,
  assigned_by uuid,assigned_at timestamptz,revoked_by uuid,revoked_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.has_admin_permission('authorization.read') then
    raise exception 'AUTHORIZATION_DENIED' using errcode='42501';
  end if;
  return query select r.id,r.auth_user_id,u.email,
    coalesce(nullif(btrim(u.raw_user_meta_data->>'name'),''),split_part(u.email,'@',1)),
    r.action,r.enabled,r.granted_by_auth_user_id,r.assigned_at,r.revoked_by_auth_user_id,r.revoked_at
  from public.admin_section_responsibilities r join auth.users u on u.id=r.auth_user_id
  where r.section_key=p_section_key order by r.enabled desc,u.email,r.action;
end
$$;

create or replace function public.list_section_responsibility_audit(p_section_key text)
returns table(audit_id bigint,actor_auth_user_id uuid,action text,target_id text,details jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.has_admin_permission('authorization.read') then
    raise exception 'AUTHORIZATION_DENIED' using errcode='42501';
  end if;
  return query select l.id,l.actor_auth_user_id,l.action,l.target_id,l.details,l.created_at
  from public.admin_audit_log l
  where l.resource='admin_section_responsibilities' and l.details->>'section_key'=p_section_key
  order by l.created_at desc limit 50;
end
$$;

revoke execute on function public.resolve_section_responsibility_user(text) from public,anon;
revoke execute on function public.list_section_responsibilities(text) from public,anon;
revoke execute on function public.list_section_responsibility_audit(text) from public,anon;
grant execute on function public.resolve_section_responsibility_user(text) to authenticated;
grant execute on function public.list_section_responsibilities(text) to authenticated;
grant execute on function public.list_section_responsibility_audit(text) to authenticated;

update public.admin_section_definitions set enforcement_status='ENFORCED',updated_at=now()
where section_key='news' and enforcement_status='DESIGN_ONLY';
do $$ begin
  if (select count(*) from public.admin_section_definitions where enforcement_status='ENFORCED')<>1
     or not exists(select 1 from public.admin_section_definitions where section_key='news' and enforcement_status='ENFORCED') then
    raise exception 'NEWS_ENFORCEMENT_STATE_MISMATCH';
  end if;
end $$;

commit;
