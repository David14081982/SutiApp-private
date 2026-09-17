begin;
do $$ begin
  if exists(select 1 from public.sensitive_change_audit where resource='profile_photo' and action='SELF_REPLACE') then
    raise exception 'PROFILE_PHOTO_RECOVERY_BLOCKED_BY_ACTIVITY';
  end if;
end $$;
drop function public.set_self_profile_photo(text,text,bigint,text);
drop index public.affiliate_files_current_profile_photo;
alter table public.affiliate_files drop column is_current_profile_photo;
commit;
