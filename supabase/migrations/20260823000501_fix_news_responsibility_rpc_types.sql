begin;

-- PostgreSQL RETURN QUERY requires the auth.users varchar columns to match
-- the declared text result exactly.
create or replace function public.list_section_responsibilities(p_section_key text)
returns table(assignment_id uuid,auth_user_id uuid,email text,display_name text,action text,enabled boolean,
  assigned_by uuid,assigned_at timestamptz,revoked_by uuid,revoked_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.has_admin_permission('authorization.read') then
    raise exception 'AUTHORIZATION_DENIED' using errcode='42501';
  end if;
  return query select r.id,r.auth_user_id,u.email::text,
    coalesce(nullif(btrim((u.raw_user_meta_data->>'name')::text),''),split_part(u.email::text,'@',1))::text,
    r.action::text,r.enabled,r.granted_by_auth_user_id,r.assigned_at,r.revoked_by_auth_user_id,r.revoked_at
  from public.admin_section_responsibilities r join auth.users u on u.id=r.auth_user_id
  where r.section_key=p_section_key order by r.enabled desc,u.email,r.action;
end
$$;

revoke execute on function public.list_section_responsibilities(text) from public,anon;
grant execute on function public.list_section_responsibilities(text) to authenticated;

commit;
