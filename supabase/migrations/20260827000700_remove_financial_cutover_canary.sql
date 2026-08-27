begin;

drop function if exists public.get_financial_shadow_runtime_rules();

comment on function public.financial_runtime_rules_for_batch(uuid) is
  'Internal no-grant projection used only by the authoritative financial runtime RPC.';

notify pgrst,'reload schema';
commit;
