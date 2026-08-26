begin;

alter table public.program_catalog_items drop constraint program_catalog_items_program_check;
alter table public.program_catalog_items add constraint program_catalog_items_program_check check (
  program_key in ('auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','tours','donativos','prestamo')
);

insert into public.program_catalog_items(
  id,program_key,name,description,category_raw,requires_quote,request_mode,legacy_boundary,enabled,
  sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,source_payload
) values(
  '7e8c1f55-a5e3-4e5f-9f3b-6d9524725bc3','prestamo','Suti Préstamo',
  'Solicitud inicial de préstamo; condiciones y cálculo se resuelven en la autoridad financiera legacy.',
  'Liquidez inmediata',true,'supabase',true,true,0,'OWNER_DECISION_2026_08_24','OWNER_DECISION',2,
  'D2A5335ED9653ED9C15FD1BF24038762A5A7CCDD0E3AFEC2755D0BF814945C26',
  jsonb_build_object('decision','OWNER_DECISION_2026-08-24','scope','REQUEST_ROUTING_ONLY','financial_authority','GOOGLE_LEGACY')
);

commit;
