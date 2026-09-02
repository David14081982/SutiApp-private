begin;

create function public.get_self_savings_live_readonly()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_affiliate uuid := public.get_effective_affiliate_id();
  v_participant public.savings_participants%rowtype;
  v_batch public.savings_import_batches%rowtype;
  v_participant_evidence public.savings_legacy_evidence%rowtype;
  v_enrollment_evidence public.savings_legacy_evidence%rowtype;
  v_plan_evidence public.savings_legacy_evidence%rowtype;
  v_historical_process text;
  v_status text;
  v_start_date date;
  v_current_amount numeric;
  v_actions jsonb;
begin
  if auth.uid() is null or v_affiliate is null then
    raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';
  end if;

  select p.* into v_participant
  from public.savings_participants p
  join public.savings_import_batches b on b.id=p.import_batch_id
  where p.affiliate_id=v_affiliate
    and p.identity_status='RESOLVED'
    and b.certification_status='CERTIFIED'
    and b.status='APPLIED';

  v_actions:=jsonb_build_object(
    'JOIN',public.savings_effective_action('JOIN',v_participant.id),
    'CHANGE_AMOUNT',public.savings_effective_action('CHANGE_AMOUNT',v_participant.id),
    'WITHDRAW',public.savings_effective_action('WITHDRAW',v_participant.id),
    'TERMINATE',public.savings_effective_action('TERMINATE',v_participant.id)
  );

  if v_participant.id is null then
    return jsonb_build_object(
      'schema_version','SAVINGS_USER_LIVE_READONLY_V1',
      'authority','GOOGLE_LEGACY_AUTHORITY',
      'projection','SHADOW_MIRROR',
      'cutover_status','NOT_CUTOVER',
      'canonical_ledger_used',false,
      'yield_calculated',false,
      'mismatches_block_ui',false,
      'participant',null,
      'enrollment',null,
      'balances',null,
      'annual','[]'::jsonb,
      'history','[]'::jsonb,
      'upcoming','[]'::jsonb,
      'withdrawals','[]'::jsonb,
      'plan_changes','[]'::jsonb,
      'beneficiaries','[]'::jsonb,
      'requests','[]'::jsonb,
      'actions',v_actions,
      'write_capabilities',jsonb_build_object('requests',false,'beneficiaries',false)
    );
  end if;

  select b.* into strict v_batch from public.savings_import_batches b where b.id=v_participant.import_batch_id;
  select e.* into v_participant_evidence from public.savings_legacy_evidence e
    where e.participant_id=v_participant.id and e.source_sheet='Ahorro' and e.record_type='PARTICIPANT'
    order by e.source_row desc limit 1;
  select e.* into v_enrollment_evidence from public.savings_legacy_evidence e
    where e.participant_id=v_participant.id and e.source_sheet='Ahorro' and e.record_type='ENROLLMENT'
    order by e.source_row desc limit 1;
  select e.* into v_plan_evidence from public.savings_legacy_evidence e
    where e.participant_id=v_participant.id and e.source_sheet='Ahorro' and e.record_type='PLAN'
    order by e.source_row desc limit 1;

  v_historical_process:=nullif(v_participant_evidence.raw_payload->>'process_status','');
  v_status:=coalesce(
    nullif(v_enrollment_evidence.raw_payload#>>'{status,value}',''),
    case when jsonb_typeof(v_enrollment_evidence.raw_payload->'status')='string' then nullif(v_enrollment_evidence.raw_payload->>'status','') end
  );
  v_start_date:=coalesce(
    v_enrollment_evidence.observed_on,
    case when coalesce(v_enrollment_evidence.raw_payload->>'start_date','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then (v_enrollment_evidence.raw_payload->>'start_date')::date end
  );
  v_current_amount:=case
    when coalesce(v_plan_evidence.raw_payload#>>'{current_amount,value}',v_plan_evidence.raw_payload->>'current_amount','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then coalesce(v_plan_evidence.raw_payload#>>'{current_amount,value}',v_plan_evidence.raw_payload->>'current_amount')::numeric
    else null
  end;

  return jsonb_build_object(
    'schema_version','SAVINGS_USER_LIVE_READONLY_V1',
    'authority','GOOGLE_LEGACY_AUTHORITY',
    'projection','SHADOW_MIRROR',
    'cutover_status','NOT_CUTOVER',
    'canonical_ledger_used',false,
    'yield_calculated',false,
    'mismatches_block_ui',false,
    'source_batch',jsonb_build_object('id',v_batch.id,'manifest_sha256',v_batch.source_snapshot_sha256,'certification_status',v_batch.certification_status,'status',v_batch.status),
    'participant',jsonb_build_object(
      'id',v_participant.id,
      'legacy_folio',v_participant.legacy_folio,
      'participant_type',v_participant.participant_type,
      'identity_status',v_participant.identity_status,
      'source_certification','CERTIFIED_SHADOW_IMPORT',
      'participant_review_status',v_participant.certification_status,
      'historical_process',v_historical_process,
      'current_process',v_participant.current_process,
      'data_classification','SHADOW_MIRROR'
    ),
    'enrollment',case when v_enrollment_evidence.id is null then null else jsonb_build_object(
      'source','GOOGLE_LEGACY_AUTHORITY',
      'status',v_status,
      'enrollment_started_at',v_start_date,
      'start_date_evidence_status',replace(coalesce(v_enrollment_evidence.raw_payload->>'start_date_status','START_DATE_MISSING'),'START_DATE_',''),
      'current_contribution_amount',v_current_amount,
      'amount_cell_kind',coalesce(v_plan_evidence.raw_payload#>>'{current_amount,cell_kind}','EMPTY'),
      'historical_process',v_historical_process,
      'current_process',v_participant.current_process,
      'frequency',case when v_historical_process='JUB' then 'MONTHLY' when v_historical_process in ('PROCESS_1','PROCESS_3') then 'TWICE_MONTHLY' else null end,
      'source_hash',v_enrollment_evidence.source_row_sha256
    ) end,
    'balances',jsonb_build_object(
      'legacy_reported_balance_Q',v_participant.legacy_reported_balance,
      'total',v_participant.legacy_reported_balance,
      'total_source','LEGACY_REPORTED_BALANCE_Q',
      'capital',(select case when e.raw_payload->>'capital' ~ '^-?[0-9]+([.][0-9]+)?$' then (e.raw_payload->>'capital')::numeric end
        from public.savings_legacy_evidence e where e.participant_id=v_participant.id and e.record_type='DP_DW_CELL'
          and coalesce(e.raw_payload->>'period','') !~ '^CUMULATIVE' and e.raw_payload->>'capital' ~ '^-?[0-9]+([.][0-9]+)?$'
        order by case when e.raw_payload->>'period' ~ '^[0-9]{4}' then substring(e.raw_payload->>'period' from 1 for 4)::integer else 0 end desc,e.source_column desc limit 1),
      'capital_source','DP_DW_LEGACY_DIRECT',
      'yield',(select case when e.raw_payload->>'yield' ~ '^-?[0-9]+([.][0-9]+)?$' then (e.raw_payload->>'yield')::numeric end
        from public.savings_legacy_evidence e where e.participant_id=v_participant.id and e.record_type='DP_DW_CELL'
          and coalesce(e.raw_payload->>'period','') !~ '^CUMULATIVE' and e.raw_payload->>'yield' ~ '^-?[0-9]+([.][0-9]+)?$'
        order by case when e.raw_payload->>'period' ~ '^[0-9]{4}' then substring(e.raw_payload->>'period' from 1 for 4)::integer else 0 end desc,e.source_column desc limit 1),
      'yield_source','DP_DW_LEGACY_DIRECT',
      'canonical',false
    ),
    'annual',coalesce((select jsonb_agg(jsonb_build_object(
      'year',q.period,
      'capital',q.capital,
      'yield',q.yield_amount,
      'capital_cell_kind',q.capital_cell_kind,
      'yield_cell_kind',q.yield_cell_kind,
      'source_hash',q.source_hash
    ) order by q.year_sort desc,q.period desc) from (
      select e.raw_payload->>'period' period,
        case when e.raw_payload->>'period' ~ '^[0-9]{4}' then substring(e.raw_payload->>'period' from 1 for 4)::integer else 0 end year_sort,
        case when e.raw_payload->>'capital' ~ '^-?[0-9]+([.][0-9]+)?$' then (e.raw_payload->>'capital')::numeric end capital,
        case when e.raw_payload->>'yield' ~ '^-?[0-9]+([.][0-9]+)?$' then (e.raw_payload->>'yield')::numeric end yield_amount,
        coalesce(e.raw_payload->>'capital_cell_kind','EMPTY') capital_cell_kind,
        coalesce(e.raw_payload->>'yield_cell_kind','EMPTY') yield_cell_kind,
        e.source_row_sha256 source_hash
      from public.savings_legacy_evidence e
      where e.participant_id=v_participant.id and e.record_type='DP_DW_CELL'
        and coalesce(e.raw_payload->>'period','') !~ '^CUMULATIVE'
    ) q where q.capital is not null or q.yield_amount is not null),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,
      'effective_date',e.observed_on,
      'amount',e.numeric_value,
      'expected_amount',case when e.raw_payload->>'cell_kind'='FORMULA' then e.numeric_value end,
      'recorded_amount',case when e.raw_payload->>'cell_kind'='MANUAL' then e.numeric_value end,
      'cell_kind',coalesce(e.raw_payload->>'cell_kind','EMPTY'),
      'source_hash',e.source_row_sha256,
      'source','AA_DO_LEGACY_EVIDENCE'
    ) order by e.observed_on desc,e.source_column desc)
      from public.savings_legacy_evidence e
      where e.participant_id=v_participant.id and e.record_type='AA_DO_CELL'
        and e.observed_on<=current_date and e.numeric_value>0),'[]'::jsonb),
    'upcoming',coalesce((select jsonb_agg(jsonb_build_object(
      'contribution_date',e.observed_on,
      'expected_amount',e.numeric_value,
      'cell_kind',coalesce(e.raw_payload->>'cell_kind','EMPTY'),
      'process_snapshot',v_historical_process,
      'source_hash',e.source_row_sha256
    ) order by e.observed_on)
      from public.savings_legacy_evidence e
      where e.participant_id=v_participant.id and e.record_type='AA_DO_CELL'
        and e.observed_on>current_date and e.numeric_value>0),'[]'::jsonb),
    'withdrawals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,
      'effective_date',e.observed_on,
      'amount',e.numeric_value,
      'withdrawal_kind',e.raw_payload#>>'{values,4}',
      'continue_saving',e.raw_payload#>>'{values,5}',
      'status',e.raw_payload#>>'{values,7}',
      'source_hash',e.source_row_sha256,
      'source','SOLICITUD_DE_RETIRO_LEGACY'
    ) order by e.observed_on desc,e.source_row desc)
      from public.savings_legacy_evidence e
      where e.participant_id=v_participant.id and e.source_sheet='Solicitud de retiro' and e.record_type='WITHDRAWAL'),'[]'::jsonb),
    'plan_changes',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,
      'effective_date',e.observed_on,
      'old_amount',case when e.raw_payload#>>'{values,2}' ~ '^-?[0-9]+([.][0-9]+)?$' then (e.raw_payload#>>'{values,2}')::numeric end,
      'new_amount',case when e.raw_payload#>>'{values,3}' ~ '^-?[0-9]+([.][0-9]+)?$' then (e.raw_payload#>>'{values,3}')::numeric end,
      'applied',e.raw_payload#>>'{values,4}',
      'source_hash',e.source_row_sha256,
      'source','SOLICITUD_CAMBIO_AHORRO_LEGACY'
    ) order by e.observed_on desc,e.source_row desc)
      from public.savings_legacy_evidence e
      where e.participant_id=v_participant.id and e.source_sheet='Solicitud Cambio ahorro' and e.record_type='AMOUNT_CHANGE'),'[]'::jsonb),
    'beneficiaries',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'full_name',b.full_name,'relationship',b.relationship,'percentage',b.percentage
    ) order by b.id) from public.savings_beneficiary_versions bv
      join public.savings_beneficiaries b on b.version_id=bv.id
      where bv.participant_id=v_participant.id and bv.status='ACTIVE'),'[]'::jsonb),
    'requests','[]'::jsonb,
    'actions',v_actions,
    'write_capabilities',jsonb_build_object('requests',false,'beneficiaries',false)
  );
end $$;

revoke all on function public.get_self_savings_live_readonly() from public,anon,authenticated;
grant execute on function public.get_self_savings_live_readonly() to authenticated;

comment on function public.get_self_savings_live_readonly() is
  'Self-only read model over the certified Savings SHADOW mirror. Q remains the recognized legacy balance; no canonical ledger or yield calculation is used.';

commit;
