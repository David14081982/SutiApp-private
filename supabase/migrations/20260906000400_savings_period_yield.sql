begin;

do $$ begin
 if to_regprocedure('public.savings_identity_display(text)') is null
   or to_regprocedure('public.savings_operation_today()') is null
   or to_regclass('public.savings_withdrawal_openings') is null then raise exception 'SAVINGS_YIELD_PREREQUISITES_REQUIRED'; end if;
end $$;

-- Certified canonical accounts only. No import, identity resolution or Q backfill.
create table public.savings_yield_migration_backup(signature text primary key,definition text not null);
alter table public.savings_yield_migration_backup enable row level security;
alter table public.savings_yield_migration_backup force row level security;
revoke all on public.savings_yield_migration_backup from public,anon,authenticated,service_role;
insert into public.savings_yield_migration_backup
select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
and proname in ('admin_configure_savings_operation','admin_credit_savings_yield_period');
insert into public.savings_yield_migration_backup select '__audit_count__',count(*)::text from public.savings_audit_events;
alter table public.savings_participants add column historical_yield_reconciled_through date null;
comment on column public.savings_participants.historical_yield_reconciled_through is 'Audited canonical cutover boundary for yield already incorporated in historical Q. NULL is unresolved, never assume zero prior yield.';
alter table public.savings_yield_periods drop constraint savings_yield_disabled_check;
alter table public.savings_yield_periods add constraint savings_yield_productive_rate_check check(not productive_enabled or rate is not null);
alter table public.savings_yield_periods add constraint savings_yield_period_calendar_check check(
 extract(year from starts_on)=period_year and extract(year from ends_on)=period_year
 and extract(month from starts_on) between (semester-1)*6+1 and semester*6
 and extract(month from ends_on) between (semester-1)*6+1 and semester*6);

-- Keep one rate per ordinary period; individual extraordinary withdrawals earn none.
create function public.savings_validate_yield_opening() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.savings_yield_periods%rowtype;
begin
 select * into strict p from public.savings_yield_periods where id=new.yield_period_id for update;
 if new.cutoff_on not between p.starts_on and p.ends_on then raise exception 'SAVINGS_YIELD_CUTOFF_OUTSIDE_PERIOD'; end if;
 if new.opening_kind='EXCEPTION' then
   if new.percentage<>0 then raise exception 'SAVINGS_EXTRAORDINARY_NO_YIELD'; end if;
   return new;
 end if;
 if p.status='DISABLED' then raise exception 'SAVINGS_YIELD_PERIOD_FROZEN'; end if;
 if p.rate is not null and p.rate<>new.percentage then raise exception 'SAVINGS_PERIOD_RATE_MISMATCH'; end if;
 if exists(select 1 from public.savings_withdrawal_openings where yield_period_id=p.id and opening_kind<>'EXCEPTION' and cutoff_on<>new.cutoff_on) then raise exception 'SAVINGS_PERIOD_CUTOFF_FROZEN'; end if;
 if p.rate is null then update public.savings_yield_periods set rate=new.percentage where id=p.id; end if;
 return new;
end $$;
create trigger savings_validate_yield_opening before insert on public.savings_withdrawal_openings for each row execute function public.savings_validate_yield_opening();

create function public.savings_protect_yield_period() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.savings_withdrawal_openings where yield_period_id=old.id and opening_kind<>'EXCEPTION')
   or exists(select 1 from public.savings_yield_allocations where yield_period_id=old.id) then
   if tg_op='DELETE' then raise exception 'SAVINGS_YIELD_PERIOD_FROZEN'; end if;
   if row(new.period_year,new.semester,new.starts_on,new.ends_on,new.rate,new.eligibility_policy,new.exclusion_policy)
     is distinct from row(old.period_year,old.semester,old.starts_on,old.ends_on,old.rate,old.eligibility_policy,old.exclusion_policy)
     or (old.productive_enabled and not new.productive_enabled) or (old.status='CREDITED' and new.status<>'CREDITED') then raise exception 'SAVINGS_YIELD_PERIOD_FROZEN'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger savings_protect_yield_period before update or delete on public.savings_yield_periods for each row execute function public.savings_protect_yield_period();

do $$ declare definition text; old_clause text:='if exists(select 1 from public.savings_withdrawal_openings o where o.yield_period_id=y and o.percentage<>(p_command->>''percentage'')::numeric)'; begin
 definition:=pg_get_functiondef('public.admin_configure_savings_operation(jsonb,uuid)'::regprocedure);
 if position(old_clause in definition)=0 then raise exception 'SAVINGS_OPENING_WRITER_CHANGED'; end if;
 execute replace(definition,old_clause,'if p_command->>''opening_kind''<>''EXCEPTION'' and exists(select 1 from public.savings_withdrawal_openings o where o.yield_period_id=y and o.opening_kind<>''EXCEPTION'' and o.percentage<>(p_command->>''percentage'')::numeric)');
end $$;

create function public.preview_savings_period_yield(p_yield_period_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare period public.savings_yield_periods%rowtype; opening public.savings_withdrawal_openings%rowtype;
 p public.savings_participants%rowtype; en public.savings_enrollments%rowtype; allocation public.savings_yield_allocations%rowtype;
 cutoff date; eligible_on date; v_basis numeric; v_amount numeric; v_status text; v_why text; ident jsonb; payload jsonb;
 source_review jsonb; source_review_pending boolean;
 rows jsonb:='[]'::jsonb; schedule record; actual numeric; posted numeric; confirmed integer; ver integer; has_ordinary boolean;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
 select * into period from public.savings_yield_periods where id=p_yield_period_id;
 if not found then raise exception 'SAVINGS_YIELD_PERIOD_NOT_FOUND'; end if;
 select o.* into opening from public.savings_withdrawal_openings o join public.savings_action_availability a on a.id=o.availability_id
 where o.yield_period_id=period.id and o.opening_kind in ('ORDINARY','EARLY') and a.scope_type='GLOBAL' order by o.created_at,o.id limit 1;
 has_ordinary:=opening.id is not null;
 cutoff:=opening.cutoff_on;
 for p in select * from public.savings_participants order by legacy_folio,id loop
   v_status:='ELIGIBLE'; v_why:=null; v_basis:=null; v_amount:=null; eligible_on:=null;
   ident:=public.savings_identity_display(p.legacy_folio);
   select * into allocation from public.savings_yield_allocations where yield_period_id=period.id and participant_id=p.id;
   select * into en from public.savings_enrollments where participant_id=p.id
    and (enrollment_started_at at time zone 'America/Hermosillo')::date<=cutoff order by sequence_number desc limit 1;
   source_review:=null;source_review_pending:=false;
   if to_regprocedure('public.get_admin_savings_financial_account(uuid,date)') is not null and to_regclass('public.savings_balance_certifications') is not null then
    execute 'select public.get_admin_savings_financial_account(record_id,null) from public.savings_balance_certifications where participant_id=$1' into source_review using p.id;
    source_review_pending:=coalesce(source_review->>'source_changed'='true',false) or coalesce(source_review#>>'{context,source_update,pending}'='true',false);
   end if;
   if not has_ordinary or period.rate is null then v_status:='RATE_PENDING'; v_why:='Tasa pendiente de registrar en la apertura del periodo';
   elsif cutoff>public.savings_operation_today() then v_status:='REVIEW_REQUIRED'; v_why:='La fecha de corte aun no ha llegado';
   elsif period.status='DISABLED' then v_status:='REVIEW_REQUIRED'; v_why:='Periodo deshabilitado';
   elsif allocation.id is not null then
     v_status:=case when allocation.status='CREDITED' then 'CREDITED' when allocation.status='EXCLUDED' then 'EXCLUDED' else 'REVIEW_REQUIRED' end;
     v_basis:=allocation.calculation_basis; v_amount:=allocation.calculated_amount; v_why:=allocation.exclusion_reason;
   elsif p.identity_status<>'RESOLVED' or (ident->>'identity_exact_matches')::integer<>1
     or not exists(select 1 from public.affiliates where id=p.affiliate_id and numero_control=p.legacy_folio and not is_archived) then
     v_status:='REVIEW_REQUIRED'; v_why:='Identidad por Folio pendiente de revision';
   elsif p.certification_status<>'CERTIFIED' or p.data_classification<>'CANONICAL' then v_status:='REVIEW_REQUIRED'; v_why:='Saldo historico pendiente de certificacion';
   elsif source_review_pending then v_status:='REVIEW_REQUIRED'; v_why:='Correcciones del saldo pendientes de confirmar';
   elsif p.import_batch_id is not null and p.historical_yield_reconciled_through is null then v_status:='REVIEW_REQUIRED'; v_why:='Periodos de rendimiento historico pendientes de conciliacion';
   elsif cutoff<=p.historical_yield_reconciled_through then v_status:='EXCLUDED'; v_why:='Periodo ya conciliado dentro del saldo historico';
   elsif period.starts_on<=p.historical_yield_reconciled_through then v_status:='REVIEW_REQUIRED'; v_why:='El periodo se superpone con rendimiento historico conciliado';
   elsif en.id is null or en.data_classification<>'CANONICAL' then v_status:='REVIEW_REQUIRED'; v_why:='Inscripcion pendiente de certificacion';
   else
     eligible_on:=((en.enrollment_started_at at time zone 'America/Hermosillo')::date+interval '6 months')::date;
     if cutoff<eligible_on then v_status:='EXCLUDED'; v_why:='No cumple seis meses de permanencia';
     elsif en.status not in ('ACTIVE','TERMINATION_PENDING','TERMINATED')
      or (en.status='TERMINATED' and en.terminated_at is null)
      or (en.terminated_at at time zone 'America/Hermosillo')::date<=cutoff then v_status:='EXCLUDED'; v_why:='Inscripcion sin ahorro activo';
     elsif exists(select 1 from public.savings_holds where participant_id=p.id and status='ACTIVE') then v_status:='REVIEW_REQUIRED'; v_why:='Retencion pendiente de revision';
     elsif exists(select 1 from public.savings_requests where participant_id=p.id and enrollment_id=en.id and status='SETTLED'
       and (settled_at at time zone 'America/Hermosillo')::date between period.starts_on and cutoff
       and (request_type='EXTRAORDINARY_WITHDRAWAL' or (settled_at at time zone 'America/Hermosillo')::date<eligible_on)) then
       v_status:='EXCLUDED'; v_why:='Retiro extraordinario o anterior a seis meses dentro del periodo';
     elsif exists(select 1 from public.savings_transactions where participant_id=p.id and effective_date<=cutoff and data_classification<>'CANONICAL') then
       v_status:='REVIEW_REQUIRED'; v_why:='Movimientos pendientes de certificacion';
     elsif not exists(select 1 from public.savings_contribution_plans where enrollment_id=en.id and data_classification='CANONICAL' and effective_from<=cutoff and (effective_to is null or effective_to>=cutoff)) then
       v_status:='REVIEW_REQUIRED'; v_why:='Plan vigente pendiente de certificacion';
     elsif exists(select 1 from public.savings_contribution_plans where enrollment_id=en.id and data_classification<>'CANONICAL' and effective_from<=cutoff and (effective_to is null or effective_to>=period.starts_on)) then
       v_status:='REVIEW_REQUIRED'; v_why:='Planes del periodo pendientes de certificacion';
     else
       for schedule in select * from public.generate_savings_schedule(en.id,greatest(period.starts_on,en.first_expected_contribution_date),cutoff) loop
         select actual_amount,version_number into actual,ver from public.savings_contribution_overrides where enrollment_id=en.id and contribution_date=schedule.contribution_date order by version_number desc limit 1;
         select count(*),coalesce(sum(case when direction='CREDIT' then amount else -amount end),0) into confirmed,posted
           from public.savings_transactions where enrollment_id=en.id and contribution_date=schedule.contribution_date and effective_date<=cutoff
           and component='CAPITAL' and transaction_type in ('CONTRIBUTION','ADJUSTMENT','REVERSAL') and data_classification='CANONICAL';
         if ver is null and confirmed=0 then v_status:='REVIEW_REQUIRED'; v_why:='Aportaciones pendientes de conciliacion'; exit; end if;
         if ver is not null and actual<>posted then v_status:='REVIEW_REQUIRED'; v_why:='Aportacion confirmada difiere del movimiento registrado'; exit; end if;
         actual:=coalesce(actual,posted);
         if actual<schedule.expected_amount then v_status:='EXCLUDED'; v_why:='Descuentos no cubiertos dentro del periodo'; exit; end if;
       end loop;
       if v_status='ELIGIBLE' then
         select coalesce(sum(case when direction='CREDIT' then amount else -amount end),0) into v_basis
           from public.savings_transactions where participant_id=p.id and component='CAPITAL' and effective_date<=cutoff and data_classification='CANONICAL';
         if v_basis<0 then v_status:='REVIEW_REQUIRED'; v_why:='Capital negativo requiere conciliacion'; v_basis:=null;
         else v_amount:=round(v_basis*period.rate/100,2); end if;
       end if;
     end if;
   end if;
   if v_status='EXCLUDED' then v_amount:=0; end if;
   rows:=rows||jsonb_build_array(jsonb_build_object('participant_id',p.id,'folio',p.legacy_folio,'name',ident->>'identity_display_name',
     'enrollment_id',en.id,'eligible_on',eligible_on,'status',v_status,'reason',v_why,'capital_basis',v_basis,'yield_amount',v_amount));
 end loop;
 payload:=jsonb_build_object('period',to_jsonb(period),'cutoff_on',cutoff,'rate',case when has_ordinary then period.rate else null end,
   'state',case when period.status='DISABLED' then 'DISABLED' when not has_ordinary or period.rate is null then 'RATE_PENDING' when cutoff>public.savings_operation_today() then 'FUTURE_CUTOFF' else 'READY' end,
   'rows',rows,'eligible_count',(select count(*) from jsonb_array_elements(rows) x where x->>'status'='ELIGIBLE'),
   'review_count',(select count(*) from jsonb_array_elements(rows) x where x->>'status'='REVIEW_REQUIRED'),
   'total_to_credit',coalesce((select sum((x->>'yield_amount')::numeric) from jsonb_array_elements(rows) x where x->>'status'='ELIGIBLE'),0));
 return payload||jsonb_build_object('fingerprint',encode(extensions.digest(payload::text,'sha256'),'hex'));
end $$;

create function public.admin_confirm_savings_period_yield(p_yield_period_id uuid,p_fingerprint text,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare preview jsonb; row jsonb; prior public.savings_audit_events%rowtype; result jsonb; command jsonb;
 allocation_id uuid; transaction_id uuid; credited integer:=0; excluded integer:=0;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 if p_client_action_id is null or p_fingerprint is null or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'SAVINGS_YIELD_CONFIRMATION_REQUIRED'; end if;
 command:=jsonb_build_object('period_id',p_yield_period_id,'fingerprint',p_fingerprint,'reason',btrim(p_reason));
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 select * into prior from public.savings_audit_events where client_action_id=p_client_action_id;
 if found then
   if prior.actor_real_auth_user_id<>auth.uid() or prior.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT'; end if;
   return prior.after_data;
 end if;
 -- One bounded period posting serializes against concurrent financial/identity writers.
 lock table public.affiliates,public.savings_participants,public.savings_enrollments,public.savings_contribution_plans,
   public.savings_contribution_overrides,public.savings_transactions,public.savings_holds,public.savings_requests,
   public.savings_yield_periods,public.savings_yield_allocations in share row exclusive mode;
 if to_regclass('public.savings_review_records') is not null then execute 'lock table public.savings_review_records in share mode';end if;
 if to_regclass('public.savings_source_observations') is not null then execute 'lock table public.savings_source_observations,public.savings_source_acceptances in share mode';end if;
 if exists(select 1 from public.savings_yield_periods where id=p_yield_period_id and status='DISABLED') then raise exception 'SAVINGS_YIELD_PERIOD_DISABLED';end if;
 preview:=public.preview_savings_period_yield(p_yield_period_id);
 if preview->>'state'<>'READY' then raise exception 'SAVINGS_YIELD_RATE_OR_CUTOFF_PENDING'; end if;
 if preview->>'fingerprint'<>p_fingerprint then raise exception 'SAVINGS_YIELD_PREVIEW_CHANGED'; end if;
 for row in select value from jsonb_array_elements(preview->'rows') loop
   if row->>'status' not in ('ELIGIBLE','EXCLUDED') or exists(select 1 from public.savings_yield_allocations where yield_period_id=p_yield_period_id and participant_id=(row->>'participant_id')::uuid) then continue; end if;
   insert into public.savings_yield_allocations(yield_period_id,participant_id,eligible,exclusion_reason,calculation_basis,calculated_amount,approved_amount,status,approved_by_auth_user_id,approved_at)
   values(p_yield_period_id,(row->>'participant_id')::uuid,row->>'status'='ELIGIBLE',row->>'reason',coalesce((row->>'capital_basis')::numeric,0),
     (row->>'yield_amount')::numeric,(row->>'yield_amount')::numeric,case when row->>'status'='ELIGIBLE' then 'CREDITED' else 'EXCLUDED' end,auth.uid(),now()) returning id into allocation_id;
   transaction_id:=null;
   if row->>'status'='ELIGIBLE' then
     credited:=credited+1;
     if (row->>'yield_amount')::numeric>0 then
       insert into public.savings_transactions(participant_id,enrollment_id,transaction_type,component,direction,amount,effective_date,idempotency_key,data_classification,created_by_auth_user_id)
       values((row->>'participant_id')::uuid,(row->>'enrollment_id')::uuid,'YIELD_CREDIT','YIELD','CREDIT',(row->>'yield_amount')::numeric,
         public.savings_operation_today(),'PERIOD_YIELD:'||p_yield_period_id||':'||(row->>'participant_id'),'CANONICAL',auth.uid()) returning id into transaction_id;
     end if;
   else excluded:=excluded+1; end if;
   insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,after_data,reason)
   values(auth.uid(),public.get_effective_affiliate_id(),(row->>'participant_id')::uuid,'savings_yield_allocations','PERIOD_REVIEW',allocation_id::text,
     row||jsonb_build_object('period_id',p_yield_period_id,'rate',preview->'rate','cutoff_on',preview->'cutoff_on','transaction_id',transaction_id),btrim(p_reason));
 end loop;
 update public.savings_yield_periods set productive_enabled=true,status=case when (preview->>'review_count')::integer=0 then 'CREDITED' else 'APPROVED' end,
   approved_by_auth_user_id=auth.uid(),approved_at=now() where id=p_yield_period_id;
 result:=jsonb_build_object('command',command,'credited_accounts',credited,'excluded_accounts',excluded,'review_pending',preview->'review_count','credited_amount',preview->'total_to_credit','reviewed_snapshot',preview);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,resource,action,target_id,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),'savings_yield_periods','CONFIRM_PERIOD_YIELD',p_yield_period_id::text,result,btrim(p_reason),p_client_action_id);
 return result;
end $$;

create or replace function public.admin_credit_savings_yield_period(p_yield_period_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.has_admin_permission('savings.approve') then raise exception 'SAVINGS_APPROVE_DENIED' using errcode='42501'; end if;
 raise exception 'SAVINGS_YIELD_REVIEW_REQUIRED' using errcode='55000';
end $$;
create trigger savings_yield_allocations_immutable before update or delete on public.savings_yield_allocations for each row execute function public.reject_savings_history_mutation();
revoke all on function public.savings_validate_yield_opening(),public.savings_protect_yield_period(),public.preview_savings_period_yield(uuid),public.admin_confirm_savings_period_yield(uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.preview_savings_period_yield(uuid),public.admin_confirm_savings_period_yield(uuid,text,text,uuid) to authenticated;
commit;
