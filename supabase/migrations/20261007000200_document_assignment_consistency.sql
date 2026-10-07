-- H-DOCUMENT-ASSIGNMENT-FIX-001. Atomic general-scope configuration; no historical writes.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
alter table document_private.installation add column assignment_consistency_recovery jsonb;
do $assignment_fix$
declare signature text; source text; patched text; old_fragment text; new_fragment text; saved jsonb:='{}'; expected text; entry jsonb;
begin
 foreach signature in array array['public.document_generation_command(text,jsonb)','public.document_layout_context(text,jsonb)','public.document_layout_persist(text,jsonb)'] loop
  select jsonb_build_object('definition',pg_get_functiondef(p.oid),'oid',p.oid,'owner',p.proowner,'acl',to_jsonb(p.proacl)) into entry from pg_proc p where p.oid=signature::regprocedure;
  expected:=case signature when 'public.document_generation_command(text,jsonb)' then '5f33b1d80ec3386ed43490587a3eba15' when 'public.document_layout_context(text,jsonb)' then 'fe9352787e81cc0dd63db3b067576017' else 'd474358df153d683954f8788960cc5f2' end;
  if md5(replace(entry->>'definition',chr(13),''))<>expected then raise exception 'DOCUMENT_ASSIGNMENT_BASELINE_DRIFT: %',signature;end if;
  saved:=saved||jsonb_build_object(signature,entry);
 end loop;
 if has_function_privilege('authenticated','public.document_layout_persist(text,jsonb)','execute') or has_function_privilege('anon','public.document_layout_persist(text,jsonb)','execute') or not has_function_privilege('service_role','public.document_layout_persist(text,jsonb)','execute') then raise exception 'DOCUMENT_ASSIGNMENT_ACL_DRIFT';end if;
 update document_private.installation set assignment_consistency_recovery=saved;

 source:=saved#>>array['public.document_generation_command(text,jsonb)','definition'];
 old_fragment:=$old$'programs',coalesce((select jsonb_agg(distinct program_key) from public.program_catalog_items),'[]'),$old$;
 new_fragment:=$new$'layout_assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'program',a.program,'document_type',a.document_type,'fund_key',a.fund_key,'layout_id',a.layout_id,'layout_name',l.name,'layout_version',l.version,'template_id',template_projection.id,'template_name',template_projection.name,'template_version',template_projection.version) order by a.program,a.document_type,a.fund_key) from (select distinct on (program,document_type,fund_key) * from document_private.layout_activations order by program,document_type,fund_key,created_at desc,id desc) a left join document_private.layouts l on l.id=a.layout_id left join document_private.templates template_projection on template_projection.id=l.template_id),'[]'),
   'programs',coalesce((select jsonb_agg(distinct program_key) from public.program_catalog_items),'[]'),$new$;
 if position(old_fragment in source)=0 then raise exception 'DOCUMENT_ASSIGNMENT_DASHBOARD_DRIFT';end if;
 patched:=replace(source,old_fragment,new_fragment);
 -- Deterministic latest metadata matches the CAS order, including equal timestamps.
 old_fragment:=$old$and n.created_at>c.created_at$old$;
 if position(old_fragment in patched)=0 then raise exception 'DOCUMENT_ASSIGNMENT_CONFIGURATION_DRIFT';end if;
 patched:=replace(patched,old_fragment,$new$and (n.created_at,n.id)>(c.created_at,c.id)$new$);
 old_fragment:=$old$elsif p_action='SAVE_CONFIGURATION' then$old$;
 patched:=replace(patched,old_fragment,$new$elsif p_action='SAVE_CONFIGURATION' then
  perform pg_advisory_xact_lock(hashtextextended('document_layout_scopes',0));$new$);
 -- A legacy writer that waited for the lock must sort after the committed version.
 old_fragment:=$old$insert into document_private.configurations(program,document_type,template_id,follow_active,signers,valid_from,valid_until,created_by)
  values(p_data->>'program',p_data->>'document_type',(p_data->>'template_id')::uuid,coalesce((p_data->>'follow_active')::boolean,false),p_data->'signers',(p_data->>'valid_from')::date,nullif(p_data->>'valid_until','')::date,uid) returning id into resource;$old$;
 new_fragment:=$new$insert into document_private.configurations(program,document_type,template_id,follow_active,signers,valid_from,valid_until,created_by,created_at)
  values(p_data->>'program',p_data->>'document_type',(p_data->>'template_id')::uuid,coalesce((p_data->>'follow_active')::boolean,false),p_data->'signers',(p_data->>'valid_from')::date,nullif(p_data->>'valid_until','')::date,uid,clock_timestamp()) returning id into resource;$new$;
 if position(old_fragment in patched)=0 then raise exception 'DOCUMENT_ASSIGNMENT_CONFIGURATION_WRITER_DRIFT';end if;
 patched:=replace(patched,old_fragment,new_fragment);
 -- Candidate-only validation leaves other PREVIEW_CONFIG consumers unchanged.
 old_fragment:=$old$assignments:='[]';
   for item in select value from jsonb_array_elements(coalesce(p_data->'signers','[]')) loop$old$;
 new_fragment:=$new$if coalesce((p_data->>'configuration_candidate')::boolean,false) then
    if nullif(p_data->>'valid_from','') is null or (p_data->>'valid_from')::date>(now() at time zone 'America/Hermosillo')::date or nullif(p_data->>'valid_until','')::date<(now() at time zone 'America/Hermosillo')::date or nullif(p_data->>'valid_until','')::date<(p_data->>'valid_from')::date then raise exception 'DOCUMENT_CONFIGURATION_NOT_EFFECTIVE';end if;
    if (result->>'valid_from')::date>(now() at time zone 'America/Hermosillo')::date then raise exception 'DOCUMENT_TEMPLATE_NOT_EFFECTIVE';end if;
    if jsonb_typeof(p_data->'signers') is distinct from 'array' or jsonb_array_length(p_data->'signers')=0 then raise exception 'DOCUMENT_SIGNERS_REQUIRED';end if;
   end if;
   assignments:='[]';
   for item in select value from jsonb_array_elements(coalesce(p_data->'signers','[]')) loop$new$;
 if position(old_fragment in patched)=0 then raise exception 'DOCUMENT_ASSIGNMENT_PREVIEW_DRIFT';end if;
 patched:=replace(patched,old_fragment,new_fragment);
 old_fragment:=$old$if s.id is null then raise exception 'DOCUMENT_SIGNERS_REQUIRED';end if;
    assignments:=assignments||jsonb_build_array(jsonb_build_object('role',item->>'role'));$old$;
 new_fragment:=$new$if s.id is null then raise exception 'DOCUMENT_SIGNERS_REQUIRED';end if;
    if coalesce((p_data->>'configuration_candidate')::boolean,false) then
     if not s.enabled or s.person_id=any(ids) or length(btrim(coalesce(item->>'role',''))) not between 1 and 120 then raise exception 'DOCUMENT_SIGNER_ASSIGNMENT_INVALID';end if;
     if s.valid_from>(now() at time zone 'America/Hermosillo')::date or s.valid_until<(now() at time zone 'America/Hermosillo')::date then raise exception 'DOCUMENT_SIGNER_NOT_EFFECTIVE';end if;
     ids:=array_append(ids,s.person_id);
    end if;
    assignments:=assignments||jsonb_build_array(jsonb_build_object('role',item->>'role'));$new$;
 if position(old_fragment in patched)=0 then raise exception 'DOCUMENT_ASSIGNMENT_PREVIEW_SIGNERS_DRIFT';end if;
 execute replace(patched,old_fragment,new_fragment);

 source:=saved#>>array['public.document_layout_context(text,jsonb)','definition'];
 patched:=replace(source,$old$p_action not in ('READ','WRITE','VERSION')$old$,$new$p_action not in ('READ','WRITE','VERSION','ASSIGNMENT')$new$);
 old_fragment:=$old$cfg:=document_private.resolve_configuration_without_layout(prog,typ,now());$old$;
 new_fragment:=$new$if p_action='ASSIGNMENT' then
  select l.* into v from document_private.layout_activations x join document_private.layouts l on l.id=x.layout_id and l.document_type=x.document_type
  where x.id=(p_data->>'id')::uuid and x.program=prog and x.document_type=typ and x.fund_key=fund;
  if v.id is null then raise exception 'DOCUMENT_LAYOUT_ASSIGNMENT_MISSING';end if;
  return to_jsonb(v)-array['created_by','context_affiliate'];
 end if;
 cfg:=document_private.resolve_configuration_without_layout(prog,typ,now());$new$;
 if patched=source or position(old_fragment in patched)=0 then raise exception 'DOCUMENT_ASSIGNMENT_CONTEXT_DRIFT';end if;
 patched:=replace(patched,old_fragment,new_fragment);
 old_fragment:=$old$return jsonb_build_object('actor',auth.uid(),'context_affiliate',public.get_effective_affiliate_id(),'config',cfg,$old$;
 new_fragment:=$new$return jsonb_build_object('actor',auth.uid(),'context_affiliate',public.get_effective_affiliate_id(),'config',cfg,
 'latest_configuration_id',(select c.id from document_private.configurations c where c.program=prog and c.document_type=typ order by c.created_at desc,c.id desc limit 1),$new$;
 if position(old_fragment in patched)=0 then raise exception 'DOCUMENT_ASSIGNMENT_CONTEXT_CONFIGURATION_DRIFT';end if;
 execute replace(patched,old_fragment,new_fragment);

 source:=saved#>>array['public.document_layout_persist(text,jsonb)','definition'];
 patched:=replace(source,$old$p_action not in ('SAVE','ACTIVATE','UNASSIGN')$old$,$new$p_action not in ('SAVE','ACTIVATE','UNASSIGN','CONFIGURE')$new$);
 old_fragment:=$old$if p_action='SAVE' then$old$;
 new_fragment:=$new$if p_action='CONFIGURE' then
  declare cfg document_private.configurations%rowtype; assigned document_private.layout_activations%rowtype; signer document_private.signers%rowtype; selected document_private.templates%rowtype; item jsonb; persons uuid[]:='{}'; request jsonb; result jsonb; configuration_id uuid; activation_id uuid; valid_from date:=(p_data->>'valid_from')::date; valid_until date:=nullif(p_data->>'valid_until','')::date; day date:=(now() at time zone 'America/Hermosillo')::date;
  begin
   if coalesce(p_data->>'fund_key','')<>'' then raise exception 'DOCUMENT_LAYOUT_FUND_INVALID';end if;
   request:=jsonb_build_object('program',prog,'document_type',typ,'fund_key','','expected_configuration_id',p_data->>'expected_configuration_id','expected_assignment_id',p_data->>'expected_assignment_id','template_id',p_data->>'template_id','signers',p_data->'signers','valid_from',valid_from,'valid_until',valid_until,'actor',actor,'context_affiliate',context_id);
   select details into prior from document_private.audit where action='LAYOUT_CONFIGURE' and resource_id=resource;
   if prior is not null then
    if prior->'request' is distinct from request then raise exception 'DOCUMENT_LAYOUT_RETRY_CONFLICT';end if;
    return prior->'result';
   end if;
   select * into cfg from document_private.configurations c where c.program=prog and c.document_type=typ order by c.created_at desc,c.id desc limit 1;
   if cfg.id is distinct from nullif(p_data->>'expected_configuration_id','')::uuid then raise exception 'DOCUMENT_CONFIGURATION_CHANGED';end if;
   select * into assigned from document_private.layout_activations a where a.program=prog and a.document_type=typ and a.fund_key='' order by a.created_at desc,a.id desc limit 1;
   if assigned.id is distinct from nullif(p_data->>'expected_assignment_id','')::uuid then raise exception 'DOCUMENT_LAYOUT_ASSIGNMENT_CHANGED';end if;
   if assigned.layout_id is null then raise exception 'DOCUMENT_LAYOUT_ASSIGNMENT_MISSING';end if;
   select * into v from document_private.layouts l where l.id=assigned.layout_id and l.document_type=typ;
   if v.id is distinct from (p_data->>'layout_id')::uuid or v.definition is distinct from p_data->'definition' then raise exception 'DOCUMENT_LAYOUT_ASSIGNMENT_CHANGED';end if;
   if valid_from is null or valid_from>day or valid_until<day or valid_until<valid_from then raise exception 'DOCUMENT_CONFIGURATION_NOT_EFFECTIVE';end if;
   select * into selected from document_private.templates where id=(p_data->>'template_id')::uuid;
   if selected.id is null then raise exception 'DOCUMENT_TEMPLATE_REQUIRED';end if;
   if selected.valid_from>day then raise exception 'DOCUMENT_TEMPLATE_NOT_EFFECTIVE';end if;
   if jsonb_typeof(p_data->'signers') is distinct from 'array' or jsonb_array_length(p_data->'signers')=0 then raise exception 'DOCUMENT_SIGNERS_REQUIRED';end if;
   for item in select value from jsonb_array_elements(p_data->'signers') loop
    select * into signer from document_private.signers where id=(item->>'version_id')::uuid;
    if signer.id is null or not signer.enabled or signer.person_id=any(persons) or length(btrim(coalesce(item->>'role',''))) not between 1 and 120 then raise exception 'DOCUMENT_SIGNER_ASSIGNMENT_INVALID';end if;
    persons:=array_append(persons,signer.person_id);
   end loop;
   insert into document_private.configurations(program,document_type,template_id,follow_active,signers,valid_from,valid_until,created_by,created_at)
   values(prog,typ,selected.id,false,p_data->'signers',valid_from,valid_until,actor,clock_timestamp()) returning id into configuration_id;
   -- Resolve the real signer/effectivity contract before any transaction can commit.
   if document_private.resolve_configuration_without_layout(prog,typ,now())->>'configuration_id' is distinct from configuration_id::text then raise exception 'DOCUMENT_CONFIGURATION_CHANGED';end if;
   layout_id:=v.id;
   if v.template_id is distinct from selected.id then
    select coalesce(max(l.version),0)+1 into revision from document_private.layouts l where l.program=prog and l.document_type=typ;
    layout_id:=gen_random_uuid();
    insert into document_private.layouts(id,program,document_type,version,template_id,contract_version,engine_version,definition,created_by,context_affiliate,name)
    values(layout_id,prog,typ,revision,selected.id,v.contract_version,v.engine_version,v.definition,actor,context_id,v.name);
   end if;
   activation_id:=gen_random_uuid();
   insert into document_private.layout_activations(id,program,document_type,fund_key,layout_id,created_by,context_affiliate) values(activation_id,prog,typ,'',layout_id,actor,context_id);
   result:=jsonb_build_object('id',resource,'configuration_id',configuration_id,'assignment_id',activation_id,'layout_id',layout_id,'template_id',selected.id);
   insert into document_private.audit(actor,context_affiliate,action,resource_id,details) values(actor,context_id,'LAYOUT_CONFIGURE',resource,jsonb_build_object('request',request,'result',result));
   return result;
  end;
 end if;
 if p_action='SAVE' then$new$;
 if patched=source or position(old_fragment in patched)=0 then raise exception 'DOCUMENT_ASSIGNMENT_PERSIST_DRIFT';end if;
 execute replace(patched,old_fragment,new_fragment);
 -- CREATE OR REPLACE preserves OID, owner, ACL and every existing action body.
 foreach signature in array array['public.document_generation_command(text,jsonb)','public.document_layout_context(text,jsonb)','public.document_layout_persist(text,jsonb)'] loop
  select jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',to_jsonb(p.proacl)) into entry from pg_proc p where p.oid=signature::regprocedure;
  if entry is distinct from (saved->signature)-'definition' then raise exception 'DOCUMENT_ASSIGNMENT_SECURITY_POSTCONDITION';end if;
  saved:=jsonb_set(saved,array[signature,'applied_hash'],to_jsonb(md5(replace(pg_get_functiondef(signature::regprocedure),chr(13),''))));
 end loop;
 update document_private.installation set assignment_consistency_recovery=saved;
end $assignment_fix$;
notify pgrst,'reload schema';
commit;
