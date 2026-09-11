begin;

-- Extend the existing presentation authority; never copy metadata into products.
alter table public.finance_catalog_presentation
  add column program_info jsonb,
  add column program_cover_asset_id uuid references public.app_assets(id) on delete restrict;

create function public.validate_program_general_info() returns trigger
language plpgsql set search_path='' as $$
declare b jsonb; k text;
begin
  if tg_op='DELETE' then
    if old.program_info is not null then raise exception 'PROGRAM_INFO_DELETE_FORBIDDEN'; end if;
    return old;
  end if;
  if new.program_info is null then
    if tg_op='UPDATE' and old.program_info is not null then raise exception 'PROGRAM_INFO_REQUIRED'; end if;
    return new;
  end if;
  if new.item_key not in ('auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','cirugias','tours','market','rifas','donativos')
     or jsonb_typeof(new.program_info)<>'object'
     or length(btrim(coalesce(new.label_override,''))) not between 2 and 180
     or length(coalesce(new.description_override,''))>240 then raise exception 'PROGRAM_INFO_INVALID'; end if;
  if (select count(*) from jsonb_object_keys(new.program_info))<>(case when new.item_key='terrenos' then 15 else 11 end) then raise exception 'PROGRAM_INFO_FIELDS_INVALID'; end if;
  if new.item_key='terrenos' then
    foreach k in array array['map_title','map_subtitle','map_program_label','map_description'] loop
      if jsonb_typeof(new.program_info->k) is distinct from 'string' or length(new.program_info->>k)>240 then raise exception 'PROGRAM_INFO_TEXT_INVALID'; end if;
    end loop;
  end if;
  foreach k in array array['description','breadcrumb','icon','phone','whatsapp','benefits_title','catalog_title','detail'] loop
    if jsonb_typeof(new.program_info->k) is distinct from 'string'
       or length(new.program_info->>k)>(case when k='description' then 6000 else 240 end) then raise exception 'PROGRAM_INFO_TEXT_INVALID'; end if;
  end loop;
  if length(btrim(new.program_info->>'icon'))=0
     or (new.program_info->>'icon')!~'^[A-Za-z][A-Za-z0-9]*$'
     or (new.program_info->>'phone')!~'^[+0-9 ()-]{0,40}$'
     or (new.program_info->>'whatsapp')!~'^[+0-9 ()-]{0,40}$'
     or jsonb_typeof(new.program_info->'favorite_enabled') is distinct from 'boolean'
     or jsonb_typeof(new.program_info->'popular') is distinct from 'boolean'
     or jsonb_typeof(new.program_info->'benefits') is distinct from 'array' then raise exception 'PROGRAM_INFO_FIELDS_INVALID'; end if;
  if jsonb_array_length(new.program_info->'benefits')>12 then raise exception 'PROGRAM_INFO_BENEFITS_INVALID'; end if;
  for b in select value from jsonb_array_elements(new.program_info->'benefits') loop
    if jsonb_typeof(b)<>'object' or (select count(*) from jsonb_object_keys(b))<>3
      or jsonb_typeof(b->'icon') is distinct from 'string' or (b->>'icon')!~'^[A-Za-z][A-Za-z0-9]{0,39}$'
      or jsonb_typeof(b->'t') is distinct from 'string' or length(btrim(b->>'t')) not between 1 and 180
      or jsonb_typeof(b->'s') is distinct from 'string' or length(b->>'s')>1000 then raise exception 'PROGRAM_INFO_BENEFITS_INVALID'; end if;
  end loop;
  if new.program_cover_asset_id is not null and not exists (
    select 1 from public.app_assets a where a.id=new.program_cover_asset_id and a.status='READY'
    and a.storage_bucket='app-assets' and a.mime_type in ('image/png','image/jpeg','image/gif','image/webp')
  ) then raise exception 'PROGRAM_INFO_COVER_INVALID'; end if;
  return new;
end $$;
create trigger validate_program_general_info before insert or update or delete on public.finance_catalog_presentation
for each row execute function public.validate_program_general_info();

create function public.save_program_general_info(p_program_key text,p_expected_updated_at timestamptz,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare oldrow public.finance_catalog_presentation%rowtype; saved public.finance_catalog_presentation%rowtype;
begin
  if auth.uid() is null or not (public.has_admin_permission('program_catalog.write') or public.has_admin_permission('workflow.write')) then
    raise exception 'PROGRAM_INFO_WRITE_REQUIRED' using errcode='42501';
  end if;
  select * into oldrow from public.finance_catalog_presentation where item_key=p_program_key for update;
  if oldrow.program_info is null then raise exception 'PROGRAM_INFO_NOT_FOUND'; end if;
  if oldrow.updated_at is distinct from p_expected_updated_at then raise exception 'PROGRAM_INFO_CONFLICT' using errcode='40001'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or
     (select count(*) from jsonb_object_keys(p_payload))<>5 or not p_payload ?& array['label_override','description_override','program_info','program_cover_asset_id','enabled']
     or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean'
     or jsonb_typeof(p_payload->'label_override') is distinct from 'string'
     or jsonb_typeof(p_payload->'description_override') is distinct from 'string' then raise exception 'PROGRAM_INFO_PAYLOAD_INVALID'; end if;
  update public.finance_catalog_presentation set label_override=btrim(p_payload->>'label_override'),
    description_override=p_payload->>'description_override',program_info=p_payload->'program_info',
    program_cover_asset_id=(p_payload->>'program_cover_asset_id')::uuid,enabled=(p_payload->>'enabled')::boolean
  where item_key=p_program_key returning * into saved;
  return to_jsonb(saved);
end $$;
revoke all on function public.save_program_general_info(text,timestamptz,jsonb) from public,anon;
grant execute on function public.save_program_general_info(text,timestamptz,jsonb) to authenticated;
revoke all on function public.validate_program_general_info() from public,anon,authenticated;

-- Dedicated cover path, reusing app-assets but never a product's object.
create policy program_general_cover_insert on storage.objects for insert to authenticated
with check(bucket_id='app-assets' and name like 'program-general/'||auth.uid()::text||'/%'
  and (public.has_admin_permission('program_catalog.write') or public.has_admin_permission('workflow.write')));
create function public.register_program_general_cover(p_path text,p_mime text,p_size bigint,p_sha text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null or not (public.has_admin_permission('program_catalog.write') or public.has_admin_permission('workflow.write')) then raise exception 'PROGRAM_INFO_WRITE_REQUIRED' using errcode='42501'; end if;
  if p_path is null or p_path not like 'program-general/'||auth.uid()::text||'/%'
    or p_mime not in ('image/png','image/jpeg','image/gif','image/webp') or p_size not between 1 and 10485760
    or upper(coalesce(p_sha,''))!~'^[A-F0-9]{64}$'
    or not exists(select 1 from storage.objects where bucket_id='app-assets' and name=p_path)
    then raise exception 'PROGRAM_INFO_COVER_INVALID'; end if;
  insert into public.app_assets(asset_key,asset_type,title,alt_text,storage_bucket,storage_path,mime_type,file_size,content_sha256,status)
  values('program.general.'||extensions.gen_random_uuid()::text,'image','Portada de programa','Portada de programa','app-assets',p_path,p_mime,p_size,upper(p_sha),'READY') returning id into result;
  return result;
end $$;
revoke all on function public.register_program_general_cover(text,text,bigint,text) from public,anon;
grant execute on function public.register_program_general_cover(text,text,bigint,text) to authenticated;

-- INITIAL_PRESENTATION: appended by the preparation script from audited current UI.
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('auto','bienes','Suti Auto','Autos disponibles',0,'{"description":"Consulta los vehículos disponibles. Las condiciones de financiamiento se revisan después de registrar tu solicitud.","breadcrumb":"","icon":"car","phone":"6621670367","whatsapp":"6621670367","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'1e09fcc3-94a2-53e4-be9a-1879ef0f1af1'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('renta','bienes','Renta Car','Vehículos en renta',1,'{"description":"Consulta los vehículos disponibles para renta y registra tu solicitud desde aquí.","breadcrumb":"","icon":"key","phone":"6621670367","whatsapp":"6621670367","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'f84f0e1f-9c12-5e73-8499-1eff07636292'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('casa','bienes','Suti Casa','Propiedades',2,'{"description":"Explora propiedades publicadas en el catálogo histórico de Suti Casa.","breadcrumb":"","icon":"house","phone":"6621670367","whatsapp":"6621670367","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'6c8c8e9c-e49f-5d29-9119-8af3d34f25d8'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('terrenos','bienes','Suti Terrenos','Lotes disponibles',3,'{"description":"Consulta los terrenos publicados. El cálculo de financiamiento se realiza durante la revisión.","breadcrumb":"","icon":"land","phone":"6621670367","whatsapp":"6621670367","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false,"map_title":"El Fresnillo","map_subtitle":"Reserva Campestre · Hermosillo, Sonora","map_program_label":"SUTI TERRENO","map_description":"Lotes a plazos · descuento vía nómina"}'::jsonb,'2d904d0d-ead3-5c34-aac4-6ddd8f13fe5f'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('solar','bienes','Paneles Solares','Ahorra en luz',4,'{"description":"Los paneles solares requieren poco mantenimiento, reducen tu recibo de luz y aumentan el valor de tu propiedad. Financiamiento verde a meses sin intereses.","breadcrumb":"","icon":"solar","phone":"6311480129","whatsapp":"6311480129","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'19e7ed24-be2e-5ed6-b691-488711eb390f'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('aires','bienes','Aires Acondicionados','Equipos disponibles',5,'{"description":"Consulta equipos de aire acondicionado disponibles y su precio de contado histórico.","breadcrumb":"","icon":"ac","phone":"6622315407","whatsapp":"6622315407","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'c9f40168-4431-5b9b-aeda-384438657d91'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('puertas','bienes','Puertas de Seguridad','Protege tu hogar',6,'{"description":"Consulta modelos de puertas de seguridad disponibles.","breadcrumb":"","icon":"door","phone":"6622315407","whatsapp":"6622315407","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'7e24d6ed-0ec6-5590-a794-663902b23415'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('computo','bienes','Equipos de Cómputo','Tecnología',7,'{"description":"Consulta equipos de cómputo disponibles.","breadcrumb":"","icon":"laptop","phone":"6622315407","whatsapp":"6622315407","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'a4039eb5-6ccf-5ddc-b9e3-6a1288c5c460'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('farma','bienestar','Suti Farma','Medicamentos disponibles',0,'{"description":"Consulta medicamentos y presentaciones disponibles del catálogo histórico de Suti Farma.","breadcrumb":"","icon":"pharmacy","phone":"6621670367","whatsapp":"6621670367","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'c8f86f83-abe2-5e16-a48e-9eb3d6edcfd4'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('cirugias','bienestar','Suti Cirugías','Estéticas y mayores',1,'{"description":"Estéticas y mayores. Conoce el beneficio. Solicítalo con las mejores condiciones gracias a tu sindicato, con descuento cómodo vía nómina y sin letras chiquitas.","breadcrumb":"","icon":"surgery","phone":"6622315407","whatsapp":"6622315407","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Conoce el beneficio","popular":false}'::jsonb,'e7bf9a5f-6803-550f-b37a-12a420cc992a'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('tours','bienestar','Suti Tours','Viajes y paquetes',2,'{"description":"Explora viajes, alojamientos y experiencias disponibles en el catálogo de Suti Tours.","breadcrumb":"","icon":"plane","phone":"6624755475","whatsapp":"6624755475","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Explora opciones","popular":false}'::jsonb,'49a61e0a-7b19-553c-aa6f-e26ca5590166'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('market','bienestar','Suti Market','Productos del hogar',3,'{"description":"Productos del hogar. Conoce el beneficio. Solicítalo con las mejores condiciones gracias a tu sindicato, con descuento cómodo vía nómina y sin letras chiquitas.","breadcrumb":"","icon":"cart","phone":"6621670367","whatsapp":"6621670367","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Conoce el beneficio","popular":false}'::jsonb,'458278c6-75f0-5c8e-a060-7ccef969d45d'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('rifas','bienestar','Suti Rifas','Boletos activos',4,'{"description":"Boletos activos. Consulta disponibilidad. Solicítalo con las mejores condiciones gracias a tu sindicato, con descuento cómodo vía nómina y sin letras chiquitas.","breadcrumb":"","icon":"ticket","phone":"6621670367","whatsapp":"6621670367","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Consulta disponibilidad","popular":false}'::jsonb,'3bcd4aa5-67b5-588a-a236-619f5163c0b6'::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
insert into public.finance_catalog_presentation(item_key,group_key,label_override,description_override,sort_order,program_info,program_cover_asset_id)
values('donativos','bienestar','Donativos','Apoya una causa',5,'{"description":"Consulta las organizaciones y causas publicadas para donativos.","breadcrumb":"","icon":"heart","phone":"","whatsapp":"","favorite_enabled":true,"benefits_title":"Por qué te conviene","benefits":[{"icon":"checkCircle","t":"Catálogo verificado","s":"Filas históricas reconciliadas sin productos simulados"},{"icon":"image","t":"Información disponible","s":"Imágenes y datos vigentes de cada opción"},{"icon":"shield","t":"Proceso protegido","s":"Tu solicitud se registra antes de cualquier revisión financiera"}],"catalog_title":"Disponibles ahora","detail":"Conoce el beneficio","popular":false}'::jsonb,null::uuid)
on conflict(item_key) do update set program_info=excluded.program_info,program_cover_asset_id=excluded.program_cover_asset_id
where public.finance_catalog_presentation.program_info is null;
notify pgrst,'reload schema';
commit;
