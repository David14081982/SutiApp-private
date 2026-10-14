begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- Read-only projection of operational withdrawals. Keep every existing reader,
-- writer, historical request, document and financial source unchanged.
create function public.get_admin_savings_withdrawal_history(
 p_search text default '',p_status text default 'all',p_offset integer default 0,p_limit integer default 20
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then
  raise exception 'SAVINGS_READ_DENIED' using errcode='42501';
 end if;
 if p_status is null or p_status not in ('all','pending','approved','settled','rejected','cancelled')
  or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50
  or length(coalesce(p_search,''))>200 then
  raise exception 'SAVINGS_PAGE_INVALID' using errcode='22023';
 end if;
 with base as materialized (
  select r.id,r.participant_id,r.folio,p.legacy_folio saver_folio,
   public.savings_affiliate_display_name(p.id) name,r.request_type,r.status,r.requested_amount,
   case when r.status='SETTLED' then r.requested_capital_amount end delivered_capital,
   case when r.status='SETTLED' then r.requested_yield_amount end delivered_yield,
   -- The settlement writer records actual delivered components in these columns.
   -- SQL null propagation preserves a missing component instead of inventing zero.
   case when r.status='SETTLED' then r.requested_capital_amount+r.requested_yield_amount end delivered_amount,
   r.continue_saving,r.submitted_at,r.reviewed_at,r.settled_at
  from public.savings_requests r join public.savings_participants p on p.id=r.participant_id
  where r.data_classification='CANONICAL' and p.data_classification='CANONICAL'
   and r.metadata->>'origin'='SAVINGS_RUNTIME_V1'
   and r.request_type in ('WITHDRAW','EXTRAORDINARY_WITHDRAWAL')
 ), filtered as materialized (
  select * from base
  where (coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(name,'')))>0
   or position(lower(p_search) in lower(coalesce(saver_folio,'')))>0
   or position(lower(p_search) in lower(folio))>0)
   and (p_status='all'
    or p_status='pending' and status in ('SUBMITTED','UNDER_REVIEW')
    or p_status='approved' and status='APPROVED'
    or p_status='settled' and status='SETTLED'
    or p_status='rejected' and status='REJECTED'
    or p_status='cancelled' and status='CANCELLED')
 ), page as materialized (
  select * from filtered order by submitted_at desc,id desc offset p_offset limit p_limit
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.submitted_at desc,p.id desc) from page p),'[]'::jsonb),
  'total',(select count(*) from filtered),'offset',p_offset,'limit',p_limit
 ) into result;
 return result;
end $$;
revoke all on function public.get_admin_savings_withdrawal_history(text,text,integer,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_withdrawal_history(text,text,integer,integer) to authenticated;
comment on function public.get_admin_savings_withdrawal_history(text,text,integer,integer)
 is 'Read-only, savings.read-gated paginated operational withdrawal history. Existing requests, settlement writers and private document authorization remain authoritative.';
notify pgrst,'reload schema';
commit;
