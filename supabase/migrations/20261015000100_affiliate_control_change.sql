begin;
set local lock_timeout='2s';
set local statement_timeout='60s';

-- H-AFFILIATE-CONTROL-CHANGE-001. Additive, no business backfill.
-- Migration number verified available in the installed catalog on 2026-10-15.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.affiliates'::regclass
  and attname='numero_control' and atttypid='text'::regtype and not attisdropped)
  or not exists(select 1 from pg_catalog.pg_class where oid='public.affiliates'::regclass and relrowsecurity and relforcerowsecurity)
  or has_column_privilege('authenticated','public.affiliates','numero_control','UPDATE')
  or has_column_privilege('anon','public.affiliates','numero_control','UPDATE')
 then raise exception 'AFFILIATE_CONTROL_BASELINE_UNSAFE'; end if;
end $$;
create table public.affiliate_control_changes (
 id uuid primary key default gen_random_uuid(),
 affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
 old_control text,
 new_control text not null check (length(new_control) between 1 and 80),
 reason text not null default '' check (length(reason)<=500),
 impact jsonb not null check (jsonb_typeof(impact)='object'),
 client_action_id uuid not null unique,
 created_at timestamptz not null default clock_timestamp()
);
create index affiliate_control_changes_affiliate on public.affiliate_control_changes(affiliate_id,created_at desc);
create index affiliate_control_changes_old on public.affiliate_control_changes(old_control);
create index affiliate_control_changes_new on public.affiliate_control_changes(new_control);
alter table public.affiliate_control_changes enable row level security;
alter table public.affiliate_control_changes force row level security;
revoke all on public.affiliate_control_changes from public,anon,authenticated;

-- Reserve former numbers across ordinary affiliate creation as well as this RPC.
-- Existing duplicate historical rows are left intact; no UNIQUE constraint added.
create function public.affiliate_control_reservation_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.numero_control is not distinct from old.numero_control then return new; end if;
 if exists(select 1 from public.affiliate_control_changes c where c.affiliate_id<>new.id
  and (c.old_control=new.numero_control or c.new_control=new.numero_control))
 then raise exception 'AFFILIATE_CONTROL_RESERVED' using errcode='23505'; end if;
 return new;
end $$;
create trigger affiliates_control_reservation before insert or update of numero_control on public.affiliates
for each row execute function public.affiliate_control_reservation_guard();
create function public.affiliate_control_history_immutable() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'AFFILIATE_CONTROL_HISTORY_IMMUTABLE' using errcode='42501'; end $$;
create trigger affiliate_control_history_immutable before update or delete on public.affiliate_control_changes
for each row execute function public.affiliate_control_history_immutable();
revoke all on function public.affiliate_control_reservation_guard(),public.affiliate_control_history_immutable()
 from public,anon,authenticated;

-- All helpers are private to SECURITY DEFINER entry points. The inventory exposes
-- primary-key locators only, never financial amounts, JSON payloads or documents.
create function public.affiliate_control_authorize() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.has_admin_permission('affiliates.read'),false)
  or not coalesce(public.has_admin_permission('affiliates.write'),false)
  or not coalesce(public.admin_module_boundary(array['affiliates'],'update'),false)
 then raise exception 'AFFILIATE_CONTROL_DENIED' using errcode='42501'; end if;
end $$;

-- Follow declared single-column UUID foreign keys up to four edges. Cycle guard
-- excludes loops. The report explicitly describes this boundary and does not
-- pretend to inspect Google, embedded JSON/text or missing foreign keys.
create function public.affiliate_control_relation(p_table oid,p_depth integer default 0,p_seen oid[] default array[]::oid[])
returns text language plpgsql stable security definer set search_path='' as $$
declare edge record; child text; parts text[]:=array[]::text[]; alias_name text:='r'||p_depth;
begin
 if p_table='public.affiliates'::regclass then return format('%I.id=$1',alias_name); end if;
 if p_depth>=4 or p_table=any(p_seen) then return null; end if;
 for edge in
  select k.confrelid,n.nspname,c.relname,a.attname local_col,b.attname remote_col
  from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.confrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid=k.conrelid and a.attnum=k.conkey[1]
  join pg_catalog.pg_attribute b on b.attrelid=k.confrelid and b.attnum=k.confkey[1]
  where k.conrelid=p_table and k.contype='f' and cardinality(k.conkey)=1
   and a.atttypid='uuid'::regtype
   and (n.nspname='public' or right(n.nspname,8)='_private')
  order by k.conname
 loop
  child:=public.affiliate_control_relation(edge.confrelid,p_depth+1,p_seen||p_table);
  if child is not null then
   parts:=array_append(parts,format('exists(select 1 from %I.%I %I where %I.%I=%I.%I and (%s))',
    edge.nspname,edge.relname,'r'||(p_depth+1),alias_name,edge.local_col,'r'||(p_depth+1),edge.remote_col,child));
  end if;
 end loop;
 return nullif(array_to_string(parts,' or '),'');
end $$;

create function public.affiliate_control_inventory(p_affiliate_id uuid,p_old text,p_new text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tab record; col record; related text; old_match text; new_match text; locator text;
 rows_found jsonb; new_conflicts bigint; groups jsonb:='[]'; checked integer:=0; keys_found text[];
begin
 for tab in select c.oid,n.nspname,c.relname from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and (n.nspname='public' or right(n.nspname,8)='_private')
   and not c.relispartition and c.relname not in ('affiliates','affiliate_control_changes')
  order by n.nspname,c.relname
 loop
  related:=public.affiliate_control_relation(tab.oid);
  old_match:=null; new_match:=null;
  for col in select a.attname from pg_catalog.pg_attribute a where a.attrelid=tab.oid
   and a.attnum>0 and not a.attisdropped and a.atttypid in ('text'::regtype,'varchar'::regtype)
   and a.attname in ('numero_control','legacy_folio','source_folio','from_numero_control','to_numero_control')
   order by a.attname
  loop
   old_match:=concat_ws(' or ',old_match,format('r0.%I=$2',col.attname));
   new_match:=concat_ws(' or ',new_match,format('r0.%I=$3',col.attname));
  end loop;
  if related is null and old_match is null then continue; end if;
  checked:=checked+1;
  select array_agg(a.attname order by pos.ordinality) into keys_found
   from pg_catalog.pg_constraint k cross join lateral unnest(k.conkey) with ordinality pos(num,ordinality)
   join pg_catalog.pg_attribute a on a.attrelid=k.conrelid and a.attnum=pos.num
   where k.conrelid=tab.oid and k.contype='p';
  select 'jsonb_build_object('||string_agg(format('%L,r0.%I',key,key),',')||')' into locator
   from unnest(keys_found) key;
  -- An unkeyed row is counted and reported as such; no invented locator.
  locator:=coalesce(locator,'''{}''::jsonb');
  execute format('select coalesce(jsonb_agg(item order by item::text),''[]''::jsonb) from
   (select jsonb_build_object(''key'',%s,''number_match'',coalesce((%s),false),''related'',coalesce((%s),false)) item
    from %I.%I r0 where (%s)) s',locator,coalesce(old_match,'false'),coalesce(related,'false'),
    tab.nspname,tab.relname,concat_ws(' or ',related,old_match))
   into rows_found using p_affiliate_id,p_old,p_new;
  new_conflicts:=0;
  if new_match is not null then
   execute format('select count(*) from %I.%I r0 where (%s) and not coalesce((%s),false)',
    tab.nspname,tab.relname,new_match,coalesce(related,'false'))
    into new_conflicts using p_affiliate_id,p_old,p_new;
  end if;
  if jsonb_array_length(rows_found)>0 or new_conflicts>0 then
   groups:=groups||jsonb_build_array(jsonb_build_object('source',tab.nspname||'.'||tab.relname,
    'count',jsonb_array_length(rows_found),'records',rows_found,'new_number_conflicts',new_conflicts,
    'has_primary_key',keys_found is not null));
  end if;
 end loop;
 return jsonb_build_object('groups',groups,'tables_checked',checked,
  'scope','FK_UUID_DEPTH_4_AND_EXACT_CONTROL_COLUMNS',
  'excluded',jsonb_build_array('Google Sheets / Apps Script','Archivos y documentos emitidos',
   'Valores dentro de JSON o texto libre','Relaciones sin FK, FK compuestas o de más de cuatro pasos'));
end $$;

create function public.preview_admin_affiliate_control(p_affiliate_id uuid,p_new_control text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare person public.affiliates%rowtype; report jsonb; blocks jsonb:='[]'; link_risk boolean:=false;
begin
 perform public.affiliate_control_authorize();
 select * into person from public.affiliates where id=p_affiliate_id;
 if person.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
 if person.is_archived then raise exception 'AFFILIATE_ARCHIVED' using errcode='22023'; end if;
 if p_new_control is null or length(p_new_control) not between 1 and 80 or p_new_control<>btrim(p_new_control)
  or p_new_control ~ '[[:cntrl:]]' then raise exception 'AFFILIATE_CONTROL_INVALID' using errcode='22023'; end if;
 if person.numero_control is not distinct from p_new_control then raise exception 'AFFILIATE_NO_CHANGE' using errcode='22023'; end if;
 if exists(select 1 from public.affiliates where id<>person.id and numero_control=p_new_control)
  or exists(select 1 from public.affiliate_control_changes where affiliate_id<>person.id
   and (old_control=p_new_control or new_control=p_new_control))
 then blocks:=blocks||jsonb_build_array('NUMBER_ALREADY_ASSIGNED'); end if;
 report:=public.affiliate_control_inventory(person.id,person.numero_control,p_new_control);
 if exists(select 1 from jsonb_array_elements(report->'groups') g where (g->>'new_number_conflicts')::bigint>0)
 then blocks:=blocks||jsonb_build_array('NUMBER_HAS_UNRELATED_RECORDS'); end if;
 -- A historical CSV certification can be the only valid login proof. Never
 -- silently invalidate it, nor rewrite historical certification to make it fit.
 select exists(select 1 from auth.users u where u.id=person.auth_user_id
  and public.has_certified_affiliate_auth_link(u.id,person.id,u.email)
  and (person.historical_email_normalized is distinct from lower(btrim(u.email))
   or (select count(*) from public.affiliates a where a.historical_email_normalized=lower(btrim(u.email)))<>1)) into link_risk;
 if link_risk then blocks:=blocks||jsonb_build_array('ACCESS_REPAIR_REQUIRED'); end if;
 report:=report||jsonb_build_object('affiliate_id',person.id,'old_control',person.numero_control,
  'new_control',p_new_control,'expected_updated_at',person.updated_at,'blockers',blocks,
  'automatic_changes',jsonb_build_array('Número vigente del afiliado','Invalidación de cotizaciones anteriores'),
  'manual_review_required',true);
 return report||jsonb_build_object('fingerprint',md5(report::text));
end $$;

create function public.change_admin_affiliate_control(p_affiliate_id uuid,p_new_control text,
 p_expected_updated_at timestamptz,p_expected_fingerprint text,p_reason text,p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare person public.affiliates%rowtype; report jsonb; saved public.affiliate_control_changes%rowtype;
begin
 perform public.affiliate_control_authorize();
 if p_client_action_id is null or length(coalesce(p_reason,''))>500 then raise exception 'AFFILIATE_CONTROL_INPUT_INVALID' using errcode='22023'; end if;
 -- Serialize with ordinary create/edit as well, including concurrent creations
 -- of the desired number. No global unique constraint on historical numbers.
 lock table public.affiliates in share row exclusive mode;
 select * into saved from public.affiliate_control_changes where client_action_id=p_client_action_id;
 if saved.id is not null then
  if saved.affiliate_id<>p_affiliate_id or saved.new_control is distinct from p_new_control
   or saved.actor_auth_user_id<>auth.uid() or saved.reason is distinct from coalesce(p_reason,'')
  then raise exception 'AFFILIATE_CONTROL_ACTION_CONFLICT' using errcode='22023'; end if;
  return jsonb_build_object('change',to_jsonb(saved),'replayed',true);
 end if;
 select * into person from public.affiliates where id=p_affiliate_id for update;
 if person.id is null then raise exception 'AFFILIATE_NOT_FOUND' using errcode='P0001'; end if;
 if person.updated_at is distinct from p_expected_updated_at then raise exception 'AFFILIATE_VERSION_CONFLICT' using errcode='PT409'; end if;
 report:=public.preview_admin_affiliate_control(p_affiliate_id,p_new_control);
 if jsonb_array_length(report->'blockers')>0 then raise exception 'AFFILIATE_CONTROL_BLOCKED' using errcode='22023'; end if;
 if report->>'fingerprint' is distinct from p_expected_fingerprint then raise exception 'AFFILIATE_CONTROL_IMPACT_CHANGED' using errcode='PT409'; end if;
 update public.affiliates set numero_control=p_new_control,
  financial_profile_version=financial_profile_version+1,
  financial_profile_updated_at=now(),financial_profile_updated_by=auth.uid(),updated_at=clock_timestamp()
 where id=person.id;
 insert into public.affiliate_control_changes(affiliate_id,actor_auth_user_id,old_control,new_control,reason,impact,client_action_id)
 values(person.id,auth.uid(),person.numero_control,p_new_control,coalesce(p_reason,''),report,p_client_action_id)
 returning * into saved;
 insert into public.affiliate_admin_events(affiliate_id,actor_auth_user_id,action,before_values,after_values,changed_fields,reason)
 values(person.id,auth.uid(),'UPDATE',jsonb_build_object('numero_control',person.numero_control),
  jsonb_build_object('numero_control',p_new_control,'control_change_id',saved.id),array['numero_control'],coalesce(p_reason,''));
 return jsonb_build_object('change',to_jsonb(saved),'replayed',false);
end $$;

create function public.list_admin_affiliate_control_changes(p_affiliate_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.affiliate_control_authorize();
 return (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc,c.id),'[]')
  from public.affiliate_control_changes c where c.affiliate_id=p_affiliate_id);
end $$;

revoke all on function public.affiliate_control_authorize(),public.affiliate_control_relation(oid,integer,oid[]),
 public.affiliate_control_inventory(uuid,text,text),public.preview_admin_affiliate_control(uuid,text),
 public.change_admin_affiliate_control(uuid,text,timestamptz,text,text,uuid),
 public.list_admin_affiliate_control_changes(uuid) from public,anon,authenticated;
grant execute on function public.preview_admin_affiliate_control(uuid,text),
 public.change_admin_affiliate_control(uuid,text,timestamptz,text,text,uuid),
 public.list_admin_affiliate_control_changes(uuid) to authenticated;
commit;
