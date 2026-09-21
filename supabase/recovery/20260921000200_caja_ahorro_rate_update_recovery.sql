begin;
-- Restores 2% / 4% by publishing yet another version of each rule published by the
-- migration (history stays intact; nothing is deleted). Skips rules edited afterwards.
do $$
declare
  v_old public.financial_rules%rowtype;
  v_new public.financial_rules%rowtype;
begin
  for v_old in
    select r.* from public.financial_rules r
    join public.financial_configuration_audit a on a.resource_type='RULE' and a.resource_id=r.id::text and a.action='PUBLISH'
      and a.reason='Caja de Ahorro: tasa 2% -> 1.5% (activos) y 4% -> 3% (Jubilados y Pens.)'
    where r.lifecycle_status='PUBLISHED'
    for update of r
  loop
    -- sheet row / criterion identity are unique per import batch: they move to the new live version.
    update public.financial_rules set lifecycle_status='EXPIRED',legacy_sheet_row=null,legacy_criterion_identity=null where id=v_old.id;
    insert into public.financial_rules(lineage_id,version,supersedes_rule_id,program_id,fund_id,financial_union_code,financial_union_label,
      financial_employee_category_code,financial_employee_category_label,max_amount,raw_rate,term_label,payment_count,max_term,payment_period,
      source_date_h,source_date_n,available_on,visibility_mode,lifecycle_status,enabled,legacy_sheet_row,legacy_criterion_identity,
      imported_batch_id,review_required,review_signals,published_at)
    values(v_old.lineage_id,(select max(version)+1 from public.financial_rules where lineage_id=v_old.lineage_id),v_old.id,
      v_old.program_id,v_old.fund_id,v_old.financial_union_code,v_old.financial_union_label,
      v_old.financial_employee_category_code,v_old.financial_employee_category_label,v_old.max_amount,
      case when v_old.raw_rate=0.03 then 0.04 else 0.02 end,
      v_old.term_label,v_old.payment_count,v_old.max_term,v_old.payment_period,v_old.source_date_h,v_old.source_date_n,
      v_old.available_on,v_old.visibility_mode,'PUBLISHED',v_old.enabled,v_old.legacy_sheet_row,v_old.legacy_criterion_identity,
      v_old.imported_batch_id,v_old.review_required,v_old.review_signals,now())
    returning * into v_new;
    insert into public.financial_configuration_audit(resource_type,resource_id,action,old_value,new_value,reason)
    values('RULE',v_new.id::text,'PUBLISH',jsonb_build_object('previous_live_versions',jsonb_build_array(to_jsonb(v_old))),to_jsonb(v_new),
      'Recovery: Caja de Ahorro vuelve a 2% (activos) y 4% (Jubilados y Pens.)');
  end loop;
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_RULE_PUBLISHED' where invalidated_at is null;
end $$;
commit;
