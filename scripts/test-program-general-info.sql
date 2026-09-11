-- Entire test runs inside a rolled-back transaction: no persistent test metadata/products.
create temporary table program_info_results(program_key text,status text) on commit drop;
do $$
declare k text;r public.finance_catalog_presentation%rowtype;p jsonb; denied boolean; changed jsonb;
begin
  if (select count(*) from public.finance_catalog_presentation where program_info is not null)<>14 then raise exception 'HEADER_COUNT'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.program_actor'),true);
  foreach k in array array['auto','aires','casa','solar','computo'] loop
    select * into r from public.finance_catalog_presentation where item_key=k;
    p=jsonb_build_object('label_override',r.label_override,'description_override',r.description_override,'enabled',r.enabled,'program_cover_asset_id',r.program_cover_asset_id,'program_info',r.program_info);
    p=jsonb_set(p,'{program_info,description}',to_jsonb('Descripción de prueba transaccional'::text));
    p=jsonb_set(p,'{program_info,benefits,0,t}',to_jsonb('Ventaja editable'::text));
    changed=public.save_program_general_info(k,r.updated_at,p);
    if changed#>>'{program_info,description}'<>'Descripción de prueba transaccional' then raise exception 'SAVE_FAILED'; end if;
    -- Simulate another session's version; timestamps are transaction stable.
    denied=false;begin perform public.save_program_general_info(k,r.updated_at-interval '1 second',p);exception when serialization_failure then denied=true;end;
    if not denied then raise exception 'STALE_WRITER_ALLOWED';end if;
    p=jsonb_set(p,'{program_info,phone}',to_jsonb('javascript:alert(1)'::text));
    denied=false;begin perform public.save_program_general_info(k,(changed->>'updated_at')::timestamptz,p);exception when others then denied=true;end;
    if not denied then raise exception 'INVALID_CONTACT_ALLOWED';end if;
    insert into program_info_results values(k,'PASS');
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  denied=false;begin perform public.save_program_general_info('auto',now(),'{}');exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'ANON_WRITE_ALLOWED';end if;
end $$;
select * from program_info_results order by program_key;
