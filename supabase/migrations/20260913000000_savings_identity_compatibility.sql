begin;
-- Savings-only counterpart of pending identity 003. No affiliate trigger changes.
create function public.savings_identity_display(p_folio text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('identity_display_name',d->>'name','identity_exact_matches',d->'match_count',
 'identity_display_status',case when (d->>'match_count')::int=0 then 'SIN REGISTRO' when (d->>'match_count')::int>1 then 'DUPLICADO' else 'COINCIDENCIA EXACTA' end)
 from (select public.savings_review_identity(p_folio) d) s;
$$;
revoke all on function public.savings_identity_display(text) from public,anon,authenticated,service_role;
commit;
