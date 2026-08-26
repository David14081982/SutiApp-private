begin;

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
  return query select u.id,u.email::text,
    coalesce(nullif(btrim((u.raw_user_meta_data->>'name')::text),''),split_part(u.email::text,'@',1))::text
   from auth.users u where lower(u.email)=lower(btrim(p_email)) and u.email_confirmed_at is not null;
end
$$;

create or replace function public.enforce_news_section_action()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_actions text[]; v_action text;
begin
  if auth.role()='service_role' or public.has_admin_permission('news.write') then return coalesce(new,old); end if;
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

revoke execute on function public.resolve_section_responsibility_user(text) from public,anon;
grant execute on function public.resolve_section_responsibility_user(text) to authenticated;

commit;
