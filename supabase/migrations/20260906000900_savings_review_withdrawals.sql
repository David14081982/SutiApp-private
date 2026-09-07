begin;
create function public.get_admin_savings_review_withdrawals(p_record_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare folio text; identity_pending boolean; result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then
  raise exception 'SAVINGS_WITHDRAWALS_DENIED' using errcode='42501';
 end if;
 select r.source_folio, (r.source_data||r.proposed_data)->>'A' is distinct from r.source_folio
 into folio,identity_pending from public.savings_review_records r
 where r.id=p_record_id and r.source_sheet='Ahorro';
 if not found then raise exception 'SAVINGS_WITHDRAWALS_PARENT_NOT_FOUND';end if;
 select jsonb_build_object('publication','PRIVATE_REVIEW_ONLY','parent_id',p_record_id,'source_folio',folio,
  'identity_change_pending',identity_pending,'records',coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'source_row',r.source_row,'source_folio',r.source_folio,
   'source_data',jsonb_build_object('D',r.source_data->'D','E',r.source_data->'E','F',r.source_data->'F','G',r.source_data->'G','H',r.source_data->'H','I',r.source_data->'I'),
   'proposed_data',(select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from jsonb_each(r.proposed_data) e(k,v) where k in ('D','E','F','G','H','I')),
   'identity_change_pending',(r.source_data||r.proposed_data)->>'A' is distinct from r.source_folio,
   'review_status',r.status,'batch',jsonb_build_object('id',b.id,'observed_at',b.observed_at))
   order by b.observed_at desc,r.source_row,r.id),'[]'::jsonb)) into result
 from public.savings_review_records r join public.savings_review_batches b on b.id=r.batch_id
 where r.source_sheet='Solicitud de retiro' and r.source_folio=folio and folio is not null and folio<>'';
 return result;
end $$;
revoke all on function public.get_admin_savings_review_withdrawals(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_review_withdrawals(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
