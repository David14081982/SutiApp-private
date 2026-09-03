begin;

create or replace function public.get_affiliate_activation_status(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_count integer;
  v_candidate public.affiliates%rowtype;
begin
  if length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    return jsonb_build_object('status', 'INVALID_EMAIL');
  end if;

  select count(*) into v_count
  from public.affiliates a
  where a.historical_email_normalized = v_email;

  if v_count = 0 then
    return jsonb_build_object('status', 'NOT_REGISTERED');
  end if;
  if v_count <> 1 then
    return jsonb_build_object('status', 'AMBIGUOUS');
  end if;

  select * into v_candidate
  from public.affiliates a
  where a.historical_email_normalized = v_email;

  if v_candidate.is_archived or v_candidate.auth_eligibility <> 'eligible' then
    return jsonb_build_object('status', 'NOT_ELIGIBLE');
  end if;
  if v_candidate.auth_user_id is not null then
    return jsonb_build_object('status', 'ALREADY_ACTIVATED');
  end if;

  return jsonb_build_object('status', 'ELIGIBLE');
end;
$$;

revoke all on function public.get_affiliate_activation_status(text) from public;
grant execute on function public.get_affiliate_activation_status(text) to anon, authenticated;

comment on function public.get_affiliate_activation_status(text) is
  'Minimal public activation preflight. Returns only a status code; never exposes affiliate identity or selects a candidate when email is ambiguous.';

notify pgrst, 'reload schema';
commit;
