begin;
create function public.get_admin_savings_recorded_history(p_participant_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare folio text; result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then
  raise exception 'SAVINGS_HISTORY_DENIED' using errcode='42501';
 end if;
 select p.legacy_folio into folio from public.savings_participants p where p.id=p_participant_id;
 if not found then raise exception 'SAVINGS_HISTORY_PARTICIPANT_NOT_FOUND'; end if;
 select jsonb_build_object('publication','PRIVATE_REVIEW_ONLY','participant_id',p_participant_id,'folio',folio,
  'records',coalesce(jsonb_agg(jsonb_build_object('id',r.id,'source_folio',r.source_folio,
   'source_sheet',r.source_sheet,'source_row',r.source_row,'source_data',r.source_data,
   'proposed_data',r.proposed_data,'field_defs',r.field_defs,'status',r.status,
   'identity_change_pending',(r.source_data||r.proposed_data)->>'A' is distinct from r.source_folio,
   'batch',jsonb_build_object('observed_at',b.observed_at,'source_name',b.source_name))
   order by b.observed_at desc,r.source_row,r.id),'[]'::jsonb)) into result
 from public.savings_review_records r join public.savings_review_batches b on b.id=r.batch_id
 where r.source_sheet='Ahorro' and r.source_folio=folio and folio is not null and folio<>'';
 return result;
end $$;
revoke all on function public.get_admin_savings_recorded_history(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_recorded_history(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
