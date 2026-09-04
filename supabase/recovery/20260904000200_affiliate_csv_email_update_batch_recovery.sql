begin;

do $$
begin
  if exists (
    select 1
    from public.affiliate_csv_email_update_batches
    where status = 'APPLIED'
  ) then
    raise exception 'RECOVER_APPLIED_BATCH_FIRST_WITH_public.recover_affiliate_csv_email_update';
  end if;
end
$$;

drop function public.recover_affiliate_csv_email_update(uuid);
drop function public.apply_affiliate_csv_email_update(uuid, text, text, text, integer, jsonb);
drop table public.affiliate_csv_email_update_snapshot;
drop table public.affiliate_csv_email_update_batches;

notify pgrst, 'reload schema';
commit;
