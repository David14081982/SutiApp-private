begin;

-- Internal, bounded projection for the already-authorized data-exports Edge.
-- Auth email is read by exact UUID; historical/business identity is untouched.
create or replace function public.get_data_export_auth_emails(p_auth_user_ids uuid[])
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_auth_user_ids is null or cardinality(p_auth_user_ids)>1000
     or array_position(p_auth_user_ids,null) is not null then
    raise exception 'INVALID_AUTH_EMAIL_BATCH' using errcode='22023';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('auth_user_id',u.id,'email',coalesce(u.email,'')) order by u.id),'[]'::jsonb)
    from auth.users u where u.id=any(p_auth_user_ids)
      and u.instance_id='00000000-0000-0000-0000-000000000000'::uuid
  );
end;
$$;
alter function public.get_data_export_auth_emails(uuid[]) owner to postgres;
revoke all on function public.get_data_export_auth_emails(uuid[]) from public,anon,authenticated;
grant execute on function public.get_data_export_auth_emails(uuid[]) to service_role;
comment on function public.get_data_export_auth_emails(uuid[]) is
  'Internal service-only export projection, maximum 1000 exact Auth UUIDs. The Edge checks export permission and writes its unchanged audit before returning a file. Not an identity resolver.';

notify pgrst, 'reload schema';
commit;
