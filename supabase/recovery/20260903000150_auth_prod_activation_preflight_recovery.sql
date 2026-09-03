begin;

-- Revert the frontend activation caller before removing this additive RPC.
revoke all on function public.get_affiliate_activation_status(text) from public, anon, authenticated;
drop function public.get_affiliate_activation_status(text);

notify pgrst, 'reload schema';
commit;
