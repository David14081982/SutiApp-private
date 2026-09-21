begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Private, date-oriented bank review. Reuses the existing receipt and review writers.
create function public.get_admin_savings_reconciliation(p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
 if p_date is null or p_date<'2000-01-01' or p_date>public.savings_operation_today()+1098 then raise exception 'SAVINGS_DATE_INVALID'; end if;
 with imported as (
  select r.*,r.source_data||r.proposed_data d,p.id participant_id,p.identity_status,p.display_name,
   c.id certification_id,c.cutoff_on,field.key field_key,
   public.savings_panel_number((r.source_data||r.proposed_data)->field.key) recorded
  from public.savings_review_records r
  left join public.savings_participants p on p.legacy_folio=r.source_folio
  left join public.savings_balance_certifications c on c.record_id=r.id
  left join lateral(select f->>'key' key from jsonb_array_elements(r.field_defs)f
   where f->>'label' ~ '^\d{4}-\d{2}-\d{2}' and left(f->>'label',10)=p_date::text limit 1)field on true
  where r.source_sheet='Ahorro'
 ), canonical as (
  select p.id participant_id,p.legacy_folio folio,p.display_name nombre,e.id enrollment_id,
   s.expected_amount,o.actual_amount,o.version_number,o.id receipt_id,c.cutoff_on
  from public.savings_participants p
  join public.savings_enrollments e on e.participant_id=p.id and e.data_classification='CANONICAL'
  cross join lateral public.generate_savings_schedule(e.id,p_date,p_date)s
  left join public.savings_balance_certifications c on c.participant_id=p.id
  left join lateral(select * from public.savings_contribution_overrides o where o.enrollment_id=e.id
   and o.contribution_date=p_date order by version_number desc limit 1)o on true
  where c.id is null or p_date>c.cutoff_on
 ), rows as (
  select jsonb_build_object('id',c.participant_id||':'||c.enrollment_id,'participant_id',c.participant_id,
   'enrollment_id',c.enrollment_id,'record_id',null,'folio',c.folio,'name',c.nombre,'route','ACCOUNT',
   'expected',c.expected_amount,'actual',c.actual_amount,'suggested',coalesce(c.actual_amount,c.expected_amount),
   'version',coalesce(c.version_number,0),'confirmed',c.receipt_id is not null,
   'can_write',p_date<=public.savings_operation_today() and public.has_admin_permission('savings.write'),
   'note',null) row from canonical c
  union all
  select jsonb_build_object('id',i.id::text,'participant_id',i.participant_id,'enrollment_id',null,
   'record_id',i.id,'folio',i.source_folio,'name',coalesce(nullif(i.display_name,''),i.source_data->>'C'),
   'route',case when i.certification_id is not null then 'HISTORICAL' else 'REVIEW' end,
   'expected',coalesce(public.savings_panel_number(i.d->'S'),public.savings_panel_number(i.d->'R')),
   'actual',i.recorded,'suggested',i.recorded,'field',i.field_key,'version',i.version,
   'confirmed',i.certification_id is not null or exists(select 1 from public.savings_review_events ev
     where ev.record_id=i.id and ev.command->'changes'->i.field_key is not distinct from to_jsonb(i.recorded)
     and ev.observation like 'Conciliación bancaria '||p_date::text||':%'
     and ev.after_data->>'version'=i.version::text),
   'can_write',i.certification_id is null and p_date<=public.savings_operation_today() and public.savings_review_edit_allowed()
     and (i.d->>'A')=i.source_folio and i.recorded is not null,
   'note',case when i.identity_status='ORPHAN' then 'no existe en la base de afiliados'
     when i.certification_id is not null then 'Incluido en el saldo histórico certificado'
     else 'Captura histórica: se conserva para certificar el saldo' end) row
  from imported i where i.field_key is not null
   and not exists(select 1 from canonical c where c.participant_id=i.participant_id)
   and (i.certification_id is null or p_date<=i.cutoff_on)
   and public.savings_panel_date(i.d->>'F')<=p_date
   and (public.savings_panel_date(i.d->>'Z') is null or public.savings_panel_date(i.d->>'Z')>=p_date)
   and (upper(i.d->>'D')='JUB' and extract(day from p_date)=5 or i.d->>'D' in ('1','3') and
    (extract(day from p_date) in (15,30) or extract(month from p_date)=2 and extract(day from p_date)=28))
   and coalesce(public.savings_panel_number(i.d->'S'),public.savings_panel_number(i.d->'R'),0)>0
 ) select jsonb_build_object('date',p_date,'today',public.savings_operation_today(),
   'rows',coalesce(jsonb_agg(row order by row->>'name',row->>'folio',row->>'id'),'[]')) into result from rows;
 return result;
end $$;

create function public.admin_confirm_savings_reconciliation(p_date date,p_rows jsonb,p_confirmed boolean,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; current_row jsonb; view_rows jsonb; old public.savings_audit_events;
 command jsonb:=jsonb_build_object('date',p_date,'rows',p_rows,'confirmed',p_confirmed);
 results jsonb:='[]'; response jsonb; child_key uuid; actual numeric; r public.savings_review_records;
begin
 if auth.uid() is null or not public.has_admin_permission('savings.read') or not public.has_admin_permission('savings.write') then raise exception 'SAVINGS_WRITE_DENIED' using errcode='42501';end if;
 if p_confirmed is distinct from true or p_key is null or p_date is null or p_date>public.savings_operation_today()
  or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'SAVINGS_BANK_CONFIRMATION_REQUIRED';end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_rows)x)<>jsonb_array_length(p_rows) then raise exception 'SAVINGS_DUPLICATE_ROW';end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-bank:'||p_key,0));
 select * into old from public.savings_audit_events where client_action_id=p_key;
 if found then
  if old.actor_real_auth_user_id is distinct from auth.uid() or old.resource is distinct from 'savings_reconciliation' or old.after_data->'command' is distinct from command then raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT';end if;
  return old.after_data->'result';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('savings-config',0));
 view_rows:=public.get_admin_savings_reconciliation(p_date)->'rows';
 for item in select value from jsonb_array_elements(p_rows) order by value->>'id' loop
  select value into current_row from jsonb_array_elements(view_rows) where value->>'id'=item->>'id';
  if current_row is null or current_row->>'can_write' is distinct from 'true' then raise exception 'SAVINGS_ROW_NOT_WRITABLE';end if;
  if item->>'version' is distinct from current_row->>'version' then raise exception 'SAVINGS_PREVIEW_STALE';end if;
  actual:=public.savings_panel_number(item->'actual');
  if actual is null or actual<0 or actual>9999999999 or actual<>round(actual,2) then raise exception 'SAVINGS_AMOUNT_INVALID';end if;
  child_key:=md5(p_key::text||':'||(item->>'id'))::uuid;
  if current_row->>'route'='ACCOUNT' then
   perform public.savings_runtime_assert_identity((current_row->>'participant_id')::uuid);
   if current_row->>'confirmed'='true' and actual=(current_row->>'actual')::numeric then
    response:=jsonb_build_object('unchanged',true);
   else
    response:=public.admin_confirm_savings_account_receipt((current_row->>'participant_id')::uuid,
     (current_row->>'enrollment_id')::uuid,p_date,actual,(current_row->>'version')::int,
     'Conciliación bancaria '||p_date::text||': importe revisado por la encargada',child_key);
   end if;
  else
   select * into r from public.savings_review_records where id=(current_row->>'record_id')::uuid for update;
   response:=public.admin_save_savings_review(r.id,(item->>'version')::int,
    jsonb_build_object(current_row->>'field',actual),'IN_REVIEW',
    'Conciliación bancaria '||p_date::text||': importe revisado por la encargada; pendiente de certificación financiera',child_key);
  end if;
  results:=results||jsonb_build_array(jsonb_build_object('id',item->>'id','route',current_row->>'route','result',response));
 end loop;
 response:=jsonb_build_object('confirmed',jsonb_array_length(results),'date',p_date,'rows',results);
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,resource,action,target_id,after_data,reason,client_action_id)
 values(auth.uid(),public.get_effective_affiliate_id(),'savings_reconciliation','CONFIRM_BANK_BATCH',p_date::text,
 jsonb_build_object('command',command,'result',response),'Confirmación explícita contra banco',p_key);
 return response;
end $$;
revoke all on function public.get_admin_savings_reconciliation(date),public.admin_confirm_savings_reconciliation(date,jsonb,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_admin_savings_reconciliation(date),public.admin_confirm_savings_reconciliation(date,jsonb,boolean,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
