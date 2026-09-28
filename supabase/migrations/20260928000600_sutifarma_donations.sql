begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

create schema farma_private;
revoke all on schema farma_private from public,anon,authenticated;
create table farma_private.definition_backup(signature text primary key,definition text not null);
create table farma_private.catalog_backup(item_id uuid primary key,original jsonb not null);
insert into farma_private.catalog_backup select id,to_jsonb(i) from public.program_catalog_items i where program_key='farma';
create table farma_private.inventory(
 item_id uuid primary key references public.program_catalog_items(id),opening_quantity integer not null check(opening_quantity>=0),
 quantity integer not null check(quantity>=0),unit text not null check(unit in('caja','frasco')),version integer not null default 1,
 archived_at timestamptz,updated_at timestamptz not null default now());
-- Leading number counts packages. Singular package descriptions imply one package.
insert into farma_private.inventory(item_id,opening_quantity,quantity,unit)
 select id,q,q,case when lower(quantity_raw) like '%frasco%' then 'frasco' else 'caja' end
 from public.program_catalog_items cross join lateral(select case when quantity_raw ~ '^\s*[0-9]+'
 then substring(quantity_raw from '^\s*([0-9]+)')::integer when lower(btrim(quantity_raw)) ~ '^(caja|frasco)(\s|$)' then 1 else null end q) parsed where program_key='farma';
create table farma_private.requests(
 id uuid primary key default gen_random_uuid(),folio text not null unique,affiliate_id uuid not null references public.affiliates(id),
 actor_auth_user_id uuid not null references auth.users(id),item_id uuid not null references public.program_catalog_items(id),
 product_snapshot jsonb not null,contact_snapshot jsonb not null,status text not null default 'received'
 check(status in('received','in_progress','ready','delivered','unavailable','cancelled')),
 delivered_quantity integer check(delivered_quantity>0),idempotency_key uuid not null,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(affiliate_id,idempotency_key));
create unique index farma_one_open_request on farma_private.requests(affiliate_id,item_id) where status in('received','in_progress','ready');
create index farma_request_queue on farma_private.requests(status,created_at desc);
create table farma_private.events(
 id uuid primary key default gen_random_uuid(),request_id uuid references farma_private.requests(id),item_id uuid references public.program_catalog_items(id),
 actor_auth_user_id uuid references auth.users(id),action text not null,before_data jsonb,after_data jsonb,note text not null default '',
 action_id uuid unique,created_at timestamptz not null default now());
create table farma_private.push_deliveries(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references farma_private.events(id),
 subscription_id uuid not null references public.request_push_subscriptions(id),status text not null default 'pending',
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,
 created_at timestamptz not null default now(),unique(event_id,subscription_id));
create table farma_private.push_attempts(id bigint generated always as identity primary key,delivery_id uuid not null references farma_private.push_deliveries(id),attempt integer not null,http_status integer not null,created_at timestamptz not null default now());
do $$declare t text;begin
 foreach t in array array['definition_backup','catalog_backup','inventory','requests','events','push_deliveries','push_attempts'] loop
 execute format('alter table farma_private.%I enable row level security',t);
 execute format('alter table farma_private.%I force row level security',t);
 execute format('revoke all on farma_private.%I from public,anon,authenticated',t);end loop;
end $$;

create function farma_private.allowed(p_action text default 'read') returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.has_admin_permission('program_catalog.'||case when p_action='read' then 'read' else 'write' end)
 and (not public.is_module_admin() or public.has_admin_module('farma',p_action) or public.has_admin_module('program_products',p_action))
 and not exists(select 1 from admin_support_private.context());
$$;
insert into public.admin_section_definitions(section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,module_read_permissions,module_write_permissions,module_sections,module_order)
 values('farma','Suti Farma','Suti Farma: medicamentos, existencias y solicitudes de donación',array['read','update'],'ENFORCED','farma',
 array['program_catalog.read'],array['program_catalog.write','assets.write'],array['farma'],(select coalesce(max(module_order),0)+1 from public.admin_section_definitions));

alter table public.program_catalog_items drop constraint program_catalog_items_commercial_mode_check;
alter table public.program_catalog_items add constraint program_catalog_items_commercial_mode_check check(
 commercial_mode in('PAYROLL_FIXED','PAYROLL_QUOTE','DIRECT_CONTACT','DONATION') and (commercial_mode='PAYROLL_QUOTE')=requires_quote
 and (commercial_mode<>'DONATION' or program_key='farma'));
update public.program_catalog_items set commercial_mode='DONATION',requires_quote=false,request_mode='supabase',legacy_boundary=false where program_key='farma';

do $guard$ begin if md5(pg_get_functiondef('public.save_program_catalog_item(uuid,jsonb,jsonb)'::regprocedure))<>'6d49929ae004ab7315b8a812e9a7e523' then raise exception 'FARMA_BASELINE_DRIFT';end if;end $guard$;
insert into farma_private.definition_backup values('public.save_program_catalog_item(uuid,jsonb,jsonb)',pg_get_functiondef('public.save_program_catalog_item(uuid,jsonb,jsonb)'::regprocedure));
CREATE OR REPLACE FUNCTION public.save_program_catalog_item(p_item_id uuid, p_payload jsonb, p_asset_links jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=(select auth.uid());
  v_before public.program_catalog_items%rowtype;
  v_after public.program_catalog_items%rowtype;
  v_id uuid;
  v_program text:=btrim(coalesce(p_payload->>'program_key',''));
  v_name text:=btrim(coalesce(p_payload->>'name',''));
  v_description text:=nullif(btrim(coalesce(p_payload->>'description','')),'');
  v_category text:=nullif(btrim(coalesce(p_payload->>'category_raw','')),'');
  v_price numeric;
  v_quote boolean;
  v_mode text;
  v_sold boolean;
  v_enabled boolean;
  v_sort integer;
  v_existing_asset_count integer:=0;
  v_requested_asset_count integer:=0;
  v_allowed_asset_count integer:=8;
  v_link jsonb;
  v_link_id uuid;
  v_public_asset_id uuid;
  v_kept uuid[]:='{}'::uuid[];
  v_position integer:=0;
begin
  if v_actor is null or not public.has_admin_permission('program_catalog.write') then
    raise exception 'PROGRAM_CATALOG_WRITE_REQUIRED' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or p_asset_links is null or jsonb_typeof(p_asset_links)<>'array' then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if exists(
    select 1 from jsonb_object_keys(p_payload) k
    where k not in('program_key','name','description','category_raw','price_cash','requires_quote','commercial_mode','sold','enabled','sort_order')
  ) then
    raise exception 'PROGRAM_CATALOG_FIELD_NOT_EDITABLE' using errcode='22023';
  end if;

  if p_item_id is not null then
    select * into v_before from public.program_catalog_items where id=p_item_id for update;
    if v_before.id is null then raise exception 'PROGRAM_CATALOG_ITEM_NOT_FOUND' using errcode='P0001'; end if;
    select count(*)::integer into v_existing_asset_count
    from public.program_catalog_item_assets where item_id=p_item_id and enabled;
    v_allowed_asset_count:=greatest(8,v_existing_asset_count);
  end if;

  begin
    v_price:=nullif(p_payload->>'price_cash','')::numeric;
    v_quote:=(p_payload->>'requires_quote')::boolean;
    v_enabled:=(p_payload->>'enabled')::boolean;
    v_sort:=(p_payload->>'sort_order')::integer;
    v_mode:=nullif(btrim(coalesce(p_payload->>'commercial_mode','')),'');
    v_sold:=case when p_payload ? 'sold' then (p_payload->>'sold')::boolean
      when v_before.id is not null then v_before.sold else false end;
    v_requested_asset_count:=jsonb_array_length(p_asset_links);
  exception when others then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end;
  if v_quote is null or v_enabled is null or v_sold is null or v_sort is null then
    raise exception 'PROGRAM_CATALOG_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if v_mode is null then
    v_mode:=case when v_before.id is not null then v_before.commercial_mode when v_quote then 'PAYROLL_QUOTE' else 'PAYROLL_FIXED' end;
  end if;

  if length(v_name) not between 2 and 180
     and (v_before.id is null or v_name is distinct from v_before.name) then
    raise exception 'PROGRAM_CATALOG_NAME_INVALID' using errcode='22023';
  end if;
  if length(coalesce(v_description,''))>12000
     and (v_before.id is null or v_description is distinct from v_before.description) then
    raise exception 'PROGRAM_CATALOG_DESCRIPTION_TOO_LONG' using errcode='22023';
  end if;
  if length(coalesce(v_category,''))>240
     and (v_before.id is null or v_category is distinct from v_before.category_raw) then
    raise exception 'PROGRAM_CATALOG_CATEGORY_TOO_LONG' using errcode='22023';
  end if;
  if v_sort not between 1 and 10000
     and (v_before.id is null or v_sort is distinct from v_before.sort_order) then
    raise exception 'PROGRAM_CATALOG_ORDER_INVALID' using errcode='22023';
  end if;
  if v_price<0 and (v_before.id is null or v_price is distinct from v_before.price_cash) then
    raise exception 'PROGRAM_CATALOG_PRICE_INVALID' using errcode='22023';
  end if;
  if v_mode not in('PAYROLL_FIXED','PAYROLL_QUOTE','DIRECT_CONTACT','DONATION') then
    raise exception 'PROGRAM_CATALOG_MODE_INVALID' using errcode='22023';
  end if;
  if (v_mode='PAYROLL_QUOTE')<>v_quote then
    raise exception 'PROGRAM_CATALOG_MODE_QUOTE_MISMATCH' using errcode='22023';
  end if;
  if v_mode='PAYROLL_FIXED' and (v_price is null or v_price<=0)
     and (
       v_before.id is null
       or v_before.commercial_mode<>'PAYROLL_FIXED'
       or (v_before.price_cash is not null and v_before.price_cash>0)
       or v_price is distinct from v_before.price_cash
     ) then
    raise exception 'PROGRAM_CATALOG_PRICE_REQUIRED' using errcode='22023';
  end if;
  if not exists(select 1 from public.program_catalog_items where program_key=v_program)
     and (v_before.id is null or v_program is distinct from v_before.program_key) then
    raise exception 'PROGRAM_CATALOG_PROGRAM_INVALID' using errcode='22023';
  end if;
  if v_requested_asset_count>v_allowed_asset_count then
    raise exception 'PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED' using errcode='22023',
      detail='allowed='||v_allowed_asset_count::text||',requested='||v_requested_asset_count::text;
  end if;

  if p_item_id is null then
    insert into public.program_catalog_items(
      program_key,name,description,category_raw,price_cash,requires_quote,commercial_mode,sold,sold_at,sold_by,
      request_mode,legacy_boundary,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_snapshot_hash,source_payload
    ) values(
      v_program,v_name,v_description,v_category,v_price,v_quote,v_mode,v_sold,
      case when v_sold then now() else null end,case when v_sold then v_actor else null end,
      'supabase',false,v_enabled,v_sort,'ADMIN_PROGRAM_CATALOG',null,null,null,'{}'::jsonb
    ) returning * into v_after;
    v_id:=v_after.id;
  else
    update public.program_catalog_items set
      program_key=v_program,name=v_name,description=v_description,category_raw=v_category,
      price_cash=v_price,requires_quote=v_quote,commercial_mode=v_mode,sold=v_sold,
      sold_at=case when v_sold then coalesce(v_before.sold_at,now()) else null end,
      sold_by=case when v_sold then coalesce(v_before.sold_by,v_actor) else null end,
      enabled=v_enabled,sort_order=v_sort
    where id=p_item_id returning * into v_after;
    v_id:=v_after.id;
  end if;

  update public.program_catalog_item_assets set sort_order=sort_order+10000 where item_id=v_id and enabled;
  for v_link in select value from jsonb_array_elements(p_asset_links) loop
    v_position:=v_position+1;
    begin
      v_link_id:=nullif(v_link->>'link_id','')::uuid;
      v_public_asset_id:=nullif(v_link->>'public_asset_id','')::uuid;
    exception when others then
      raise exception 'PROGRAM_CATALOG_ASSET_LINK_INVALID' using errcode='22023';
    end;
    if (v_link_id is null)=(v_public_asset_id is null) then
      raise exception 'PROGRAM_CATALOG_ASSET_LINK_INVALID' using errcode='22023';
    end if;
    if v_link_id is not null then
      if not exists(select 1 from public.program_catalog_item_assets where id=v_link_id and item_id=v_id) then
        raise exception 'PROGRAM_CATALOG_ASSET_LINK_NOT_FOUND' using errcode='P0001';
      end if;
      update public.program_catalog_item_assets set
        enabled=true,role=case when v_position=1 then 'cover' else 'gallery' end,sort_order=v_position
      where id=v_link_id;
    else
      if not exists(
        select 1 from public.app_assets
        where id=v_public_asset_id and status='READY' and storage_bucket='app-assets'
          and storage_path like 'program-products/%'
      ) then
        raise exception 'PROGRAM_CATALOG_PUBLIC_ASSET_INVALID' using errcode='22023';
      end if;
      select id into v_link_id from public.program_catalog_item_assets
      where item_id=v_id and public_asset_id=v_public_asset_id order by enabled desc limit 1;
      if v_link_id is null then
        v_link_id:=extensions.gen_random_uuid();
        insert into public.program_catalog_item_assets(
          id,item_id,public_asset_id,private_asset_id,role,sort_order,source_column,source_column_letter,enabled
        ) values(
          v_link_id,v_id,v_public_asset_id,null,case when v_position=1 then 'cover' else 'gallery' end,
          v_position,'ADMIN_UPLOAD','ADMIN_'||replace(v_link_id::text,'-',''),true
        );
      else
        update public.program_catalog_item_assets set
          enabled=true,role=case when v_position=1 then 'cover' else 'gallery' end,sort_order=v_position
        where id=v_link_id;
      end if;
    end if;
    if v_link_id=any(v_kept) then
      raise exception 'PROGRAM_CATALOG_ASSET_DUPLICATE' using errcode='22023';
    end if;
    v_kept:=array_append(v_kept,v_link_id);
  end loop;
  update public.program_catalog_item_assets set enabled=false
  where item_id=v_id and enabled and not(id=any(v_kept));

  insert into public.admin_audit_log(actor_auth_user_id,resource,action,target_id,result,details)
  values(v_actor,'program_catalog_items',case when p_item_id is null then 'INSERT' else 'UPDATE' end,v_id::text,'SUCCESS',
    jsonb_build_object(
      'program_key',v_after.program_key,
      'before',case when v_before.id is null then null else jsonb_build_object(
        'name',v_before.name,'price_cash',v_before.price_cash,'requires_quote',v_before.requires_quote,
        'commercial_mode',v_before.commercial_mode,'sold',v_before.sold,'sold_at',v_before.sold_at,
        'sold_by',v_before.sold_by,'enabled',v_before.enabled,'sort_order',v_before.sort_order
      ) end,
      'after',jsonb_build_object(
        'name',v_after.name,'price_cash',v_after.price_cash,'requires_quote',v_after.requires_quote,
        'commercial_mode',v_after.commercial_mode,'sold',v_after.sold,'sold_at',v_after.sold_at,
        'sold_by',v_after.sold_by,'enabled',v_after.enabled,'sort_order',v_after.sort_order
      ),
      'asset_count',v_position,'asset_limit',v_allowed_asset_count,'delta_aware',true
    ));
  return (to_jsonb(v_after)-'source_payload'-'sold_by');
end $function$;

do $guard$ begin if md5(pg_get_functiondef('public.admin_asset_module_boundary(text,text)'::regprocedure))<>'b785f672bc43501f9d6a0fea86aa63be' then raise exception 'FARMA_BASELINE_DRIFT';end if;end $guard$;
insert into farma_private.definition_backup values('public.admin_asset_module_boundary(text,text)',pg_get_functiondef('public.admin_asset_module_boundary(text,text)'::regprocedure));
CREATE OR REPLACE FUNCTION public.admin_asset_module_boundary(p_bucket text, p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select not public.is_module_admin() or case
  when p_bucket='private-assets' then (split_part(p_path,'/',1)='affiliate-documents' and split_part(p_path,'/',2)=public.get_effective_affiliate_id()::text)
   or public.admin_module_boundary(array['affiliates','documents_admin','requests','finanzas'],'update')
  when p_bucket='company-assets' and split_part(p_path,'/',1)='marketplace' and split_part(p_path,'/',2)~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then public.is_marketplace_company_member(split_part(p_path,'/',2)::uuid)
  when p_bucket='app-assets' and split_part(p_path,'/',1)='branding' then public.has_admin_module('branding','update')
  when split_part(p_path,'/',2)<>auth.uid()::text then false
  when p_bucket='company-assets' and split_part(p_path,'/',1)='convenios' and split_part(p_path,'/',3)~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then public.can_manage_company_ficha(split_part(p_path,'/',3)::uuid,'assets')
  when p_bucket='app-assets' and split_part(p_path,'/',1)='membership' then public.has_admin_module('membresias','update')
  when p_bucket='app-assets' and split_part(p_path,'/',1)='program-products' then public.admin_module_boundary(array['program_products','farma'],'update')
  when p_bucket='app-assets' and split_part(p_path,'/',1)='program-general' then public.admin_module_boundary(array['program_products','fincat'],'update')
  when split_part(p_path,'/',1)='sindicato' then public.has_admin_module('sindicato','update')
  when split_part(p_path,'/',1)='directory' then public.has_admin_module('sindicato','update')
  else public.has_section_action(split_part(p_path,'/',1),'assets') end;
$function$;


do $guard$ begin if md5(pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure))<>'34cddd8ba20378f564edcfe55a74ccbf' then raise exception 'FARMA_VISIBILITY_DRIFT';end if;end $guard$;
insert into farma_private.definition_backup values('admin_support_private.module_visible(uuid,text)',pg_get_functiondef('admin_support_private.module_visible(uuid,text)'::regprocedure));
CREATE OR REPLACE FUNCTION admin_support_private.module_visible(p_subject uuid, p_module text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c jsonb:=admin_support_private.get_admin_access_context(p_subject); required text; sections text[]; begin
 if admin_support_private.is_module_admin(p_subject) then return admin_support_private.has_admin_module(p_subject,p_module); end if;
 select permission,section_keys into required,sections from (values ('farma','program_catalog.read',array[]::text[]),('document_generation','document_generation.config.read',array[]::text[]),('login_history','authorization.read',array[]::text[]),('votaciones','votaciones.read',array['votaciones','votaciones_results']::text[]),('votaciones_nominal','votaciones.export_identified_votes',array['votaciones_identified']::text[]),('administrators','authorization.read',array[]::text[]),('screen_permissions','authorization.read',array[]::text[]),('impersonation','affiliates.impersonate',array[]::text[]),('affiliates','affiliates.read',array[]::text[]),('data_exports','data_exports.read',array[]::text[]),('popups','popups.read',array['popups']::text[]),('sindicato','union_content.read',array[]::text[]),('requests','program_requests.read',array[]::text[]),('finanzas','program_requests.read',array[]::text[]),('savings','savings.read',array[]::text[]),('fondos','financial_criteria.visibility.read',array[]::text[]),('fincat','workflow.read',array[]::text[]),('program_products','program_catalog.read',array[]::text[]),('flujos','workflow.read',array[]::text[]),('inversion','workflow.read',array[]::text[]),('marketplace','marketplace.read',array['marketplace']::text[]),('aprobaciones','popups.read',array[]::text[]),('planes','company_portal.read',array[]::text[]),('membresias','memberships.read',array[]::text[]),('noticias','news.read',array['news']::text[]),('education','content.read',array['education','tutorials']::text[]),('convenios','companies.read',array['agreements']::text[]),('catalogos','segmentation.read',array[]::text[]),('roles','authorization.read',array[]::text[]),('pantallas','segmentation.read',array[]::text[]),('secciones','content.read',array[]::text[]),('banners','banners.read',array['banners']::text[]),('companies_admin','companies.read',array['companies']::text[]),('documents_admin','documents.read',array['documents']::text[]),('minutes_admin','minutes.read',array['minutes']::text[]),('programs_admin','programs.read',array['programs']::text[]),('menus','content.read',array[]::text[]),('formularios','content.read',array[]::text[]),('branding','assets.read',array[]::text[])) modules(key,permission,section_keys) where key=p_module;
 if required is null then return false; end if;
 return coalesce((c->>'full_access')::boolean,false)
  or exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'section_key'=any(sections))
  or (p_module='data_exports' and exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'action'='export'))
  or admin_support_private.has_admin_permission(p_subject,required)
  or (p_module='education' and exists(select 1 from jsonb_array_elements(c->'section_actions') entry where entry->>'section_key' in ('education','tutorials')));
end $function$
;

create function farma_private.catalog_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and public.is_module_admin() and not public.has_admin_module('program_products','update') then
  if not public.has_admin_module('farma','update') or new.program_key<>'farma' or (tg_op='UPDATE' and old.program_key<>'farma') then raise exception 'FARMA_CATALOG_SCOPE_DENIED' using errcode='42501';end if;
 end if;
 if new.program_key='farma' and new.enabled and exists(select 1 from farma_private.inventory where item_id=new.id and archived_at is not null) then raise exception 'FARMA_ARCHIVED';end if;
 if (new.program_key='farma' and new.commercial_mode<>'DONATION') or (tg_op='UPDATE' and old.program_key='farma' and new.program_key<>'farma') then raise exception 'FARMA_DONATION_REQUIRED';end if;
 return new;
end $$;
create trigger farma_catalog_boundary before insert or update on public.program_catalog_items for each row execute function farma_private.catalog_guard();
create function farma_private.block_financial_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.program_id='farma' or exists(select 1 from public.program_catalog_items where id=new.program_item_id and program_key='farma') then raise exception 'FARMA_USE_DONATION_REQUEST';end if;return new;
end $$;
create trigger farma_no_financial_request before insert on public.program_requests for each row execute function farma_private.block_financial_request();
create function farma_private.immutable_event() returns trigger language plpgsql as $$begin raise exception 'FARMA_HISTORY_IMMUTABLE';end $$;
create trigger farma_event_immutable before update or delete on farma_private.events for each row execute function farma_private.immutable_event();

create function farma_private.project(r farma_private.requests,p_admin boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'folio',r.folio,'item_id',r.item_id,'product',r.product_snapshot,'contact',r.contact_snapshot,
 'status',r.status,'version',r.version,'delivered_quantity',r.delivered_quantity,'created_at',r.created_at,'updated_at',r.updated_at,
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'created_at',e.created_at,'status',e.after_data->>'status','note',case when p_admin then e.note else null end) order by e.created_at,e.id) from farma_private.events e where e.request_id=r.id),'[]'::jsonb));
$$;
create function public.farma_command(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();affiliate uuid; r farma_private.requests; inv farma_private.inventory; item public.program_catalog_items;
 result jsonb; contact jsonb; key uuid; eid uuid; v_quantity integer; desired text; old_status text;
begin
 if actor is null then raise exception 'FARMA_AUTH_REQUIRED' using errcode='42501';end if;
 if p_action in('CONTACT','SUBMIT','MINE') then
  affiliate:=public.get_effective_affiliate_id();if affiliate is null then raise exception 'FARMA_AFFILIATE_REQUIRED' using errcode='42501';end if;
 else
  if not farma_private.allowed(case when p_action in('INVENTORY','QUEUE') then 'read' else 'update' end) then raise exception 'FARMA_ADMIN_DENIED' using errcode='42501';end if;
 end if;
 if p_action='CONTACT' then
  select jsonb_build_object('name',coalesce(display_name,full_name),'numero_control',numero_control,'phone',public.get_current_notification_phone()->>'notification_phone') into result from public.affiliates where id=affiliate;return result;
 elsif p_action='MINE' then
  select coalesce(jsonb_agg(farma_private.project(q) order by q.created_at desc),'[]') into result from farma_private.requests q where q.affiliate_id=affiliate;return result;
 elsif p_action='INVENTORY' then
  select coalesce(jsonb_agg(to_jsonb(i) order by i.item_id),'[]') into result from farma_private.inventory i where i.archived_at is null;return result;
 elsif p_action='QUEUE' then
  select coalesce(jsonb_agg(farma_private.project(q,true) order by q.created_at desc),'[]') into result from farma_private.requests q;return result;
 elsif p_action='SUBMIT' then
  key:=(p_data->>'idempotency_key')::uuid;if key is null then raise exception 'FARMA_KEY_REQUIRED';end if;
  perform pg_advisory_xact_lock(hashtextextended('farma:'||affiliate::text,0));
  select * into r from farma_private.requests where affiliate_id=affiliate and idempotency_key=key;
  if r.id is not null then
   if r.item_id is distinct from (p_data->>'item_id')::uuid then raise exception 'FARMA_KEY_CONFLICT';end if;return farma_private.project(r);
  end if;
  select * into item from public.program_catalog_items where id=(p_data->>'item_id')::uuid and program_key='farma' for share;
  select * into inv from farma_private.inventory where item_id=item.id for share;
  if item.id is null or not item.enabled or inv.item_id is null or inv.archived_at is not null or inv.quantity=0 then raise exception 'FARMA_UNAVAILABLE';end if;
  select * into r from farma_private.requests where affiliate_id=affiliate and item_id=item.id and status in('received','in_progress','ready');
  if r.id is not null then return farma_private.project(r)||jsonb_build_object('existing',true);end if;
  perform public.save_current_notification_phone(p_data->>'phone');
  select jsonb_build_object('name',coalesce(display_name,full_name),'numero_control',numero_control,'phone',notification_phone) into contact from public.affiliates where id=affiliate;
  insert into farma_private.requests(folio,affiliate_id,actor_auth_user_id,item_id,product_snapshot,contact_snapshot,idempotency_key)
  values('SF-'||upper(replace(gen_random_uuid()::text,'-','')),affiliate,actor,item.id,jsonb_build_object('name',item.name,'presentation',item.presentation_raw),contact,key) returning * into r;
  insert into farma_private.events(request_id,item_id,actor_auth_user_id,action,after_data) values(r.id,item.id,actor,'SUBMITTED',jsonb_build_object('status','received')) returning id into eid;
  insert into farma_private.push_deliveries(event_id,subscription_id)
   select eid,s.id from public.request_push_subscriptions s where s.revoked_at is null and (s.expiration_at is null or s.expiration_at>now())
   and admin_support_private.has_admin_module(s.auth_user_id,'farma','read')
   and public.request_push_affiliate(s.auth_user_id)=s.affiliate_id and exists(select 1 from public.request_push_config where enabled);
  return farma_private.project(r);
 elsif p_action='SAVE_PRODUCT' then
  v_quantity:=(p_data->>'quantity')::integer;
  if v_quantity is null or v_quantity<0 or v_quantity>1000000 or coalesce(p_data->>'unit','') not in('caja','frasco') or length(coalesce(p_data->>'presentation',''))>240 then raise exception 'FARMA_STOCK_INVALID';end if;
  if nullif(p_data->>'item_id','') is not null then
   select * into item from public.program_catalog_items where id=(p_data->>'item_id')::uuid and program_key='farma' for update;
   if item.id is null then raise exception 'FARMA_PRODUCT_NOT_FOUND';end if;
   select * into inv from farma_private.inventory where item_id=item.id for update;
   if inv.item_id is null or inv.archived_at is not null or inv.version is distinct from (p_data->>'version')::integer then raise exception 'FARMA_VERSION_CONFLICT';end if;
  end if;
  result:=public.save_program_catalog_item(item.id,(p_data->'product')||jsonb_build_object('program_key','farma','commercial_mode','DONATION','requires_quote',false,'price_cash',null,'sold',false),p_data->'assets');
  update public.program_catalog_items set presentation_raw=nullif(btrim(p_data->>'presentation'),'') where id=(result->>'id')::uuid;
  insert into farma_private.inventory(item_id,opening_quantity,quantity,unit) values((result->>'id')::uuid,v_quantity,v_quantity,p_data->>'unit')
  on conflict(item_id) do update set quantity=excluded.quantity,unit=excluded.unit,version=farma_private.inventory.version+1,updated_at=now();
  insert into farma_private.events(item_id,actor_auth_user_id,action,before_data,after_data) values((result->>'id')::uuid,actor,'STOCK_SAVED',case when inv.item_id is not null then to_jsonb(inv) else null end,jsonb_build_object('quantity',v_quantity,'unit',p_data->>'unit'));
  return result;
 elsif p_action='ARCHIVE' then
  select * into item from public.program_catalog_items where id=(p_data->>'item_id')::uuid and program_key='farma' for update;
  select * into inv from farma_private.inventory where item_id=item.id for update;
  if inv.item_id is null or inv.archived_at is not null or inv.version is distinct from (p_data->>'version')::integer then raise exception 'FARMA_VERSION_CONFLICT';end if;
  update farma_private.inventory set archived_at=now(),version=version+1,updated_at=now() where item_id=item.id;
  update public.program_catalog_items set enabled=false where id=item.id;
  insert into farma_private.events(item_id,actor_auth_user_id,action,before_data) values(item.id,actor,'ARCHIVED',to_jsonb(inv));return jsonb_build_object('archived',true);
 elsif p_action='TRANSITION' then
  key:=(p_data->>'action_id')::uuid;if key is null then raise exception 'FARMA_KEY_REQUIRED';end if;
  select * into r from farma_private.requests where id=(p_data->>'request_id')::uuid for update;
  if r.id is null then raise exception 'FARMA_REQUEST_NOT_FOUND';end if;
  if exists(select 1 from farma_private.events where action_id=key and request_id=r.id) then return farma_private.project(r,true);end if;
  if r.version is distinct from (p_data->>'version')::integer then raise exception 'FARMA_VERSION_CONFLICT';end if;
  desired:=p_data->>'status';old_status:=r.status;
  if desired is null or not ((r.status='received' and desired in('in_progress','unavailable','cancelled')) or (r.status='in_progress' and desired in('ready','unavailable','cancelled')) or (r.status='ready' and desired in('delivered','unavailable','cancelled'))) then raise exception 'FARMA_TRANSITION_INVALID';end if;
  if length(coalesce(p_data->>'note',''))>2000 then raise exception 'FARMA_NOTE_TOO_LONG';end if;
  if desired='delivered' then
   v_quantity:=(p_data->>'quantity')::integer;if v_quantity is null or v_quantity<=0 then raise exception 'FARMA_QUANTITY_REQUIRED';end if;
   select * into inv from farma_private.inventory where item_id=r.item_id for update;
   if inv.quantity<v_quantity then raise exception 'FARMA_INSUFFICIENT_STOCK';end if;
   update farma_private.inventory set quantity=inventory.quantity-v_quantity,version=version+1,updated_at=now() where item_id=r.item_id;
  end if;
  update farma_private.requests set status=desired,delivered_quantity=case when desired='delivered' then v_quantity else null end,version=version+1,updated_at=now() where id=r.id returning * into r;
  insert into farma_private.events(request_id,item_id,actor_auth_user_id,action,before_data,after_data,note,action_id)
   values(r.id,r.item_id,actor,'STATUS_CHANGED',jsonb_build_object('status',old_status,'quantity',inv.quantity),jsonb_build_object('status',desired,'delivered_quantity',r.delivered_quantity),coalesce(p_data->>'note',''),key);
  return farma_private.project(r,true);
 end if;
 raise exception 'FARMA_ACTION_INVALID';
end $$;
revoke all on function public.farma_command(text,jsonb) from public,anon;
grant execute on function public.farma_command(text,jsonb) to authenticated;
revoke all on all functions in schema farma_private from public,anon,authenticated;

create function public.claim_farma_push_batch() returns setof jsonb language plpgsql security definer set search_path='' as $$
declare job record;sub public.request_push_subscriptions;token uuid;
begin
 if not exists(select 1 from public.request_push_config where enabled) then return;end if;
 for job in select d.*,e.request_id from farma_private.push_deliveries d join farma_private.events e on e.id=d.event_id
 where d.status in('pending','sending') and d.next_attempt_at<=now() and (d.lease_until is null or d.lease_until<now()) order by d.next_attempt_at limit 30 for update of d skip locked loop
  select * into sub from public.request_push_subscriptions where id=job.subscription_id;
  if sub.revoked_at is not null or sub.expiration_at<=now() or public.request_push_affiliate(sub.auth_user_id) is distinct from sub.affiliate_id
   or not admin_support_private.has_admin_module(sub.auth_user_id,'farma','read') or job.attempts>=5 or job.created_at<now()-interval '24 hours' then
   update farma_private.push_deliveries set status='suppressed',lease_token=null,lease_until=null where id=job.id;continue;end if;
  token:=gen_random_uuid();update farma_private.push_deliveries set status='sending',attempts=attempts+1,lease_token=token,lease_until=now()+interval '90 seconds' where id=job.id;
  return next jsonb_build_object('id',job.id,'lease_token',token,'event_id',job.event_id,'request_id',job.request_id,'subscription_id',sub.id,'endpoint',sub.endpoint,'keys',jsonb_build_object('p256dh',sub.p256dh,'auth',sub.auth_key),'kind','farma');
 end loop;
end $$;
create function public.finish_farma_push(p_id uuid,p_lease_token uuid,p_http_status integer) returns boolean language plpgsql security definer set search_path='' as $$
declare job farma_private.push_deliveries;outcome text;
begin
 select * into job from farma_private.push_deliveries where id=p_id and lease_token=p_lease_token and status='sending' for update;
 if job.id is null then return false;end if;
 outcome:=case when p_http_status between 200 and 299 then 'accepted' when p_http_status in(404,410) then 'suppressed' when job.attempts>=5 or (p_http_status between 400 and 499 and p_http_status not in(408,429)) then 'failed' else 'pending' end;
 insert into farma_private.push_attempts(delivery_id,attempt,http_status) values(job.id,job.attempts,p_http_status);
 update farma_private.push_deliveries set status=outcome,lease_token=null,lease_until=null,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,job.attempts)::integer)) where id=job.id;
 if p_http_status in(404,410) then update public.request_push_subscriptions set revoked_at=now(),endpoint=null,p256dh=null,auth_key=null,updated_at=now() where id=job.subscription_id;end if;
 return true;
end $$;
create function public.wake_farma_push() returns bigint language plpgsql security definer set search_path='' as $$
declare edge_url text;worker_key text;result bigint;
begin
 if not exists(select 1 from public.request_push_config where enabled) or not exists(select 1 from farma_private.push_deliveries where status in('pending','sending') and next_attempt_at<=now() and (lease_until is null or lease_until<now())) then return null;end if;
 select decrypted_secret into edge_url from vault.decrypted_secrets where name='request_push_edge_url';
 select decrypted_secret into worker_key from vault.decrypted_secrets where name='request_push_worker_key';
 if edge_url is null or worker_key is null then raise exception 'PUSH_WORKER_NOT_CONFIGURED';end if;
 select net.http_post(url:=edge_url,headers:=jsonb_build_object('Content-Type','application/json','x-request-push-key',worker_key),body:='{}'::jsonb,timeout_milliseconds:=60000) into result;return result;
end $$;
revoke all on function public.claim_farma_push_batch(),public.finish_farma_push(uuid,uuid,integer),public.wake_farma_push() from public,anon,authenticated;
grant execute on function public.claim_farma_push_batch(),public.finish_farma_push(uuid,uuid,integer) to service_role;
select cron.schedule('farma-web-push','* * * * *','select public.wake_farma_push()');
notify pgrst,'reload schema';
commit;
