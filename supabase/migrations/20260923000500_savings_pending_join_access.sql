begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Explicit owner extension: a submitted JOIN qualifies at zero enrollment months.
do $patch$
declare before_def text; after_def text;
begin
 select pg_get_functiondef('public.savings_loan_eligibility(uuid)'::regprocedure) into before_def;
 if strpos(before_def,'e.approved_at<=now()')=0 or strpos(before_def,'if e.id is null or')=0
 or strpos(before_def,'ordinary boolean:=false; why text;')=0 then raise exception 'SAVINGS_PENDING_JOIN_DEFINITION_DRIFT';end if;
 after_def:=replace(before_def,'ordinary boolean:=false; why text;','ordinary boolean:=false; why text; join_request public.savings_requests%rowtype;');
 after_def:=replace(after_def,'if e.id is null or',$branch$
 select r.* into join_request from public.savings_requests r
 join public.savings_participants sp on sp.id=r.participant_id
 join public.affiliates af on af.id=sp.affiliate_id and not coalesce(af.is_archived,false)
 where sp.affiliate_id=p_affiliate_id and sp.identity_status='RESOLVED'
 and sp.certification_status='CERTIFIED' and sp.data_classification='CANONICAL'
 and r.usuario_contexto_affiliate_id=p_affiliate_id and r.request_type='JOIN' and r.data_classification='CANONICAL'
 order by r.submitted_at desc,r.id desc limit 1;
 if p.minimum_months=0 and p.starts_from='ENROLLMENT'
   and join_request.status in ('SUBMITTED','UNDER_REVIEW') and join_request.submitted_at<=now()
   and join_request.new_contribution_amount>0 then
  ordinary:=true; why:='JOIN_REQUEST_PENDING';
  start_on:=(join_request.submitted_at at time zone 'America/Hermosillo')::date;
  eligible_on:=start_on;
 elsif e.id is null or$branch$);
 insert into public.savings_loan_function_backup(signature,definition,installed_definition)
 values('public.savings_loan_eligibility(uuid):20260923000500',before_def,after_def);
 execute after_def;
end $patch$;
update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='SAVINGS_PENDING_JOIN_ACCESS_CHANGED'
where invalidated_at is null and session_purpose='LOAN';
commit;
