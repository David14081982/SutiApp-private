begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Recovery for 20260917000100_banners_audience (H-SUTIAPP-CONVENIOS-ANUNCIOS-001).
-- Non-destructive: restores the previous public read policy and removes the public reader RPC.
-- The new columns and their values stay as inert data (no reader uses them after the frontend revert).
-- Run together with a frontend revert of the release commit (baseline tag: restore/pre-anuncios-segmentados-20260917).
drop function if exists public.list_public_banners(text);
drop policy if exists banners_public_read on public.banners;
create policy banners_public_read on public.banners for select to anon, authenticated using (enabled = true);
do $verify$ begin
 if (select pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.banners'::regclass and polname='banners_public_read') is distinct from '(enabled = true)' then
  raise exception 'ADS_RECOVERY_POLICY_MISMATCH';
 end if;
end $verify$;
notify pgrst,'reload schema';
commit;
