begin;

-- Caja de Ahorro: tasa 2% -> 1.5% (personas en activo) y 4% -> 3% (Jubilados y Pens.).
-- Sólo cambia raw_rate. Cada regla recibe una versión nueva publicada, como hace
-- publish_financial_rule, pero legacy_criterion_identity y legacy_sheet_row pasan de la
-- versión anterior a la nueva (son únicos por lote; la fila anterior completa queda en
-- financial_configuration_audit.old_value): así las solicitudes existentes, que se
-- aprueban buscando su criterion_identity, siguen resolviendo su regla y el id de
-- runtime no cambia.
-- No toca solicitudes, montos, plazos ni visibilidad.
do $$
declare
  v_reason constant text := 'Caja de Ahorro: tasa 2% -> 1.5% (activos) y 4% -> 3% (Jubilados y Pens.)';
  v_old public.financial_rules%rowtype;
  v_new public.financial_rules%rowtype;
  v_count integer := 0;
begin
  if (select count(*) from public.financial_rules r join public.financial_funds f on f.id=r.fund_id
      where f.name='Caja de Ahorro' and r.program_id='prestamo' and r.lifecycle_status='PUBLISHED'
        and ((r.raw_rate=0.02 and r.financial_employee_category_code<>'JUBILADOS_PENSIONADOS')
          or (r.raw_rate=0.04 and r.financial_employee_category_code='JUBILADOS_PENSIONADOS'))) <> 22 then
    raise exception 'CAJA_AHORRO_RATE_UPDATE_PRECONDITION_FAILED' using errcode='P0001';
  end if;

  for v_old in
    select r.* from public.financial_rules r join public.financial_funds f on f.id=r.fund_id
    where f.name='Caja de Ahorro' and r.program_id='prestamo' and r.lifecycle_status='PUBLISHED'
      and ((r.raw_rate=0.02 and r.financial_employee_category_code<>'JUBILADOS_PENSIONADOS')
        or (r.raw_rate=0.04 and r.financial_employee_category_code='JUBILADOS_PENSIONADOS'))
    order by r.financial_union_code, r.financial_employee_category_code
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
      case when v_old.raw_rate=0.04 then 0.03 else 0.015 end,
      v_old.term_label,v_old.payment_count,v_old.max_term,v_old.payment_period,v_old.source_date_h,v_old.source_date_n,
      v_old.available_on,v_old.visibility_mode,'PUBLISHED',v_old.enabled,v_old.legacy_sheet_row,v_old.legacy_criterion_identity,
      v_old.imported_batch_id,v_old.review_required,v_old.review_signals,now())
    returning * into v_new;
    insert into public.financial_configuration_audit(resource_type,resource_id,action,old_value,new_value,reason)
    values('RULE',v_new.id::text,'PUBLISH',jsonb_build_object('previous_live_versions',jsonb_build_array(to_jsonb(v_old))),to_jsonb(v_new),v_reason);
    v_count := v_count + 1;
  end loop;

  if v_count <> 22 then raise exception 'CAJA_AHORRO_RATE_UPDATE_COUNT_MISMATCH %', v_count using errcode='P0001'; end if;
  update public.financial_session_snapshots set invalidated_at=now(),invalidation_reason='FINANCIAL_RULE_PUBLISHED' where invalidated_at is null;
end $$;

commit;
