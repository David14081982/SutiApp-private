-- H-SUTIAPP-VOTACIONES-CONSULTAS-004. Runs after the recovery, in the same always-rolled-back transaction as the matrix:
-- the previous functions come back byte for byte while the rows created with the new features are preserved.
do $$declare s record; r jsonb;
begin
 select * into s from vc_who;
 perform pg_temp.vc_check(to_regprocedure('public.cast_voting_answer(uuid,uuid,text,text)') is null and to_regprocedure('public.voting_clean_options(text,jsonb)') is null
  and to_regprocedure('public.voting_clean_presentation(jsonb)') is null and to_regprocedure('public.voting_question_options(text,jsonb)') is null,'recovery_drops_new_functions');
 perform pg_temp.vc_check(not exists(select 1 from vc_fn_before b where to_regprocedure('public.'||b.sig) is null
   or md5(pg_get_functiondef(('public.'||b.sig)::regprocedure)) is distinct from b.md5
   or (select proacl::text from pg_proc where oid=('public.'||b.sig)::regprocedure) is distinct from b.acl)
  and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%voting%')=(select count(*) from vc_fn_before),'recovery_restores_exact_functions');
 -- Rows that use the new features exist in this transaction, so their columns must survive (nothing is lost).
 perform pg_temp.vc_check(exists(select 1 from information_schema.columns where table_schema='public' and table_name='voting_votes' and column_name='answer_text')
  and exists(select 1 from public.voting_votes where answer_text is not null) and exists(select 1 from public.voting_consultations where closes_on is null),'recovery_keeps_columns_in_use');
 perform pg_temp.vc_check((select display_name from public.admin_section_definitions where section_key='admin_votaciones')='Votaciones','recovery_menu_name');
 perform pg_temp.vc_as(s.actor,'vc-after-recovery');
 r:=public.list_voting_consultations(true);
 perform pg_temp.vc_check(not exists(select 1 from vc_before b where b.admin_item is distinct from (select x from jsonb_array_elements(r->'consultations') x where x->>'id'=b.id::text))
  and not exists(select 1 from vc_before b where b.results is distinct from public.export_voting_consultation(b.id,false) or b.identified is distinct from public.export_voting_consultation(b.id,true)),'recovery_existing_consultations_identical');
 insert into vc_checks values('recovery_with_data');
end $$;
