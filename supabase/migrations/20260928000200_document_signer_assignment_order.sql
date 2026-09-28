begin;
-- Preserve established signer positions when a new identity version is assigned.
-- No record, configuration or business data is rewritten.
set local lock_timeout='2s';
do $refine$ declare definition text; old_fragment text; new_fragment text; begin
 definition:=replace(pg_get_functiondef('public.document_generation_command(text,jsonb)'::regprocedure),chr(13),'');
 old_fragment:=$old$assignments:=coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(config_row.signers,'[]')) x where not exists(select 1 from document_private.signers oldsign where oldsign.id=(x->>'version_id')::uuid and oldsign.person_id=group_id)),'[]');
    if coalesce((assignment->>'selected')::boolean,false) then assignments:=assignments||jsonb_build_array(jsonb_build_object('version_id',resource,'role',p_data->>'role'));end if;$old$;
 new_fragment:=$new$assignments:=coalesce((select jsonb_agg(case when oldsign.person_id=group_id then jsonb_build_object('version_id',resource,'role',p_data->>'role') else x.item end order by x.position) from jsonb_array_elements(coalesce(config_row.signers,'[]')) with ordinality x(item,position) join document_private.signers oldsign on oldsign.id=(x.item->>'version_id')::uuid where oldsign.person_id<>group_id or coalesce((assignment->>'selected')::boolean,false)),'[]');
    if coalesce((assignment->>'selected')::boolean,false) and not exists(select 1 from jsonb_array_elements(assignments) x where x->>'version_id'=resource::text) then assignments:=assignments||jsonb_build_array(jsonb_build_object('version_id',resource,'role',p_data->>'role'));end if;$new$;
 if position(old_fragment in definition)=0 then raise exception 'DOCUMENT_SIGNER_REFINEMENT_BASELINE_DRIFT';end if;
 execute replace(definition,old_fragment,new_fragment);
end $refine$;
notify pgrst,'reload schema';
commit;
