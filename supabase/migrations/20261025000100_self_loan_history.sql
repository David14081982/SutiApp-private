-- Own identity and existing approval clock only. No financial/history mutation.
begin;
create function public.get_self_loan_history_context()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare person public.affiliates%rowtype; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'HISTORY_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into person from public.affiliates where id=public.get_effective_affiliate_id();
 if person.id is null or person.is_archived then raise exception 'HISTORY_IDENTITY_DENIED' using errcode='42501'; end if;
 if person.numero_control is null or btrim(person.numero_control)='' or person.numero_control<>btrim(person.numero_control)
   or person.numero_control='0' or (select count(*) from public.affiliates a where not a.is_archived and a.numero_control=person.numero_control)<>1
 then raise exception 'HISTORY_IDENTITY_AMBIGUOUS' using errcode='42501'; end if;
 return jsonb_build_object('actor',actor,'affiliate_id',person.id,'folio',person.numero_control,'server_now',now(),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'folio',r.folio,'status',r.status,
    'approved_at',r.financial_approved_at,'financial',r.financial_processing_status is not null and r.rental_start is null,
    'created_at',r.created_at) order by r.created_at,r.id)
   from public.program_requests r where r.affiliate_id=person.id),'[]'::jsonb));
end $$;
revoke all on function public.get_self_loan_history_context() from public,anon,authenticated,service_role;
grant execute on function public.get_self_loan_history_context() to authenticated;
comment on function public.get_self_loan_history_context() is 'Own effective affiliate only; exact unambiguous control; persisted Finance approval timestamp, never a browser clock.';
commit;
