begin;

create function public.list_current_deposit_accounts()
returns setof public.affiliate_bank_accounts
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_affiliate uuid;
begin
  if auth.uid() is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  v_affiliate:=public.get_effective_affiliate_id();
  if v_affiliate is null then raise exception 'AFFILIATE_REQUIRED' using errcode='42501'; end if;
  return query
    select account.* from public.affiliate_bank_accounts account
    where account.affiliate_id=v_affiliate
    order by account.is_primary desc,account.created_at,account.id;
end $$;

revoke all on function public.list_current_deposit_accounts() from public,anon,authenticated;
grant execute on function public.list_current_deposit_accounts() to authenticated;

notify pgrst, 'reload schema';
commit;
