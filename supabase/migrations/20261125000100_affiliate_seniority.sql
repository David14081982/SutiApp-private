begin;

-- Additive, read-only projection. No affiliate rows, policies or existing readers change.
create schema seniority_private;
revoke all on schema seniority_private from public, anon, authenticated, service_role;

create function seniority_private.entry_date(p_raw text)
returns date language plpgsql immutable set search_path = ''
as $$
declare v text := btrim(p_raw); parts text[];
begin
  -- Observed raw dates are D/M/YYYY, optionally followed by a local clock.
  -- An incomplete date or two-digit year cannot establish completed seniority.
  parts := regexp_match(v, '^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})(, ([0-9]{1,2}):([0-9]{2}):([0-9]{2}))?$');
  if parts is null then return null; end if;
  if parts[5] is not null and (parts[5]::int > 23 or parts[6]::int > 59 or parts[7]::int > 59) then return null; end if;
  return make_date(parts[3]::int, parts[2]::int, parts[1]::int);
exception when datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then return null;
end;
$$;
revoke all on function seniority_private.entry_date(text) from public, anon, authenticated, service_role;

create function public.get_affiliate_seniority(p_offset integer default 0, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_today date := (statement_timestamp() at time zone 'America/Hermosillo')::date; v_result jsonb;
begin
  if auth.uid() is null or not coalesce((
    (public.get_current_affiliate_access_state() = 'ACTIVE' and public.get_effective_affiliate_id() is not null)
    or public.has_admin_permission('affiliates.read')
  ), false) then raise exception 'SENIORITY_ACCESS_DENIED' using errcode = '42501'; end if;
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'SENIORITY_INVALID_PAGE' using errcode = '22023';
  end if;
  with eligible as materialized (
    select a.id, a.numero_control, coalesce(nullif(btrim(a.full_name), ''), nullif(btrim(a.display_name), '')) as name,
      nullif(btrim(a.city_raw), '') as city, nullif(upper(btrim(a.unit_raw)), '') as unit,
      a.employment_entry_date_raw as raw_date, a.updated_at
    from public.affiliates a
    where upper(btrim(a.financial_union_code)) = 'SUTISSSTESON'
      and upper(btrim(a.affiliate_status_raw)) = 'ACTIVO'
      and upper(btrim(a.financial_employee_category_code)) not in ('BASE', 'JUBILADOS_PENSIONADOS')
  ), parsed as (
    select e.*, seniority_private.entry_date(e.raw_date) as entry_date from eligible e
  ), dated as (
    select p.*, case when nullif(btrim(raw_date), '') is null then 'MISSING'
      when entry_date is null then 'INVALID' when entry_date > v_today then 'FUTURE' else 'VALID' end as date_status,
      case when entry_date <= v_today then entry_date end as order_date from parsed p
  ), ranked as (
    select id, numero_control, name, city, unit, entry_date, date_status,
      case when date_status = 'VALID' then
        (extract(year from v_today)::int - extract(year from entry_date)::int) * 12
        + extract(month from v_today)::int - extract(month from entry_date)::int
        - case when extract(day from v_today) < extract(day from entry_date) then 1 else 0 end
      end as tenure_months,
      count(*) over(partition by unit)::int as unit_total,
      row_number() over(partition by unit order by order_date asc nulls last, name collate "C" nulls last, id)::int as rank,
      row_number() over(order by unit collate "C" nulls last, order_date asc nulls last, name collate "C" nulls last, id) as ordinal
    from dated
  ), page as (
    select * from ranked order by ordinal offset p_offset limit p_limit
  ), meta as (
    select count(*)::int as total, md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) as revision from eligible e
  )
  select jsonb_build_object('as_of', v_today, 'revision', meta.revision, 'total', meta.total,
    'next_offset', least(p_offset + p_limit, meta.total),
    'items', coalesce((select jsonb_agg(to_jsonb(p) - 'ordinal' order by p.ordinal) from page p), '[]'::jsonb))
  into v_result from meta;
  return v_result;
end;
$$;
revoke all on function public.get_affiliate_seniority(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_affiliate_seniority(integer, integer) to authenticated;
comment on function public.get_affiliate_seniority(integer, integer) is
  'Authenticated minimal seniority directory; public.affiliates remains sole authority. Read-only, filtered, paginated; no private profile fields.';
commit;
