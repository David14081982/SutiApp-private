-- Suti Inversion: editorial copy of the presentational simulator becomes admin-managed.
-- ADR-070 is amended only for text. Rate, amount bounds, terms and the projection
-- formula stay fixed in code; this table never stores a number used by the calculator.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

create table public.investment_screen_copy (
  id text primary key check(id ~ '^[a-z]+(\.[a-z0-9]+)*$'),
  value text not null check(length(btrim(value)) between 1 and 400),
  sort_order integer not null,
  updated_at timestamptz not null default now()
);

comment on table public.investment_screen_copy is
  'Editorial copy of the Suti Inversion screen. Rows are fixed by migration: the panel updates values only.';

-- Seeded with the exact strings authorized in H-SUTI-INVERSION-SCREEN-001 so the
-- published screen is byte-identical on the day this ships.
insert into public.investment_screen_copy(id,value,sort_order) values
  ('hero.title','Tu dinero rinde 2.5% mensual',10),
  ('hero.lede.strong','Haz que tu dinero trabaje para ti.',20),
  ('hero.lede.body','Tu inversión ayuda a financiar préstamos para otros afiliados, mientras tú recibes rendimientos.',30),
  ('hero.rate.value','2.5',40),
  ('hero.rate.label','MENSUAL FIJO',50),
  ('hero.rate.annual','30% anual',60),
  ('hero.rate.note','Tasa fija: 2.5% del capital cada mes, sin interés compuesto',70),
  ('hero.fact.1','Desde $50,000',80),
  ('hero.fact.2','Plazo mínimo 6 meses',90),
  ('hero.fact.3','Cero comisiones',100),
  ('steps.title','Cómo funciona',110),
  ('step.1.title','Eliges monto y plazo',120),
  ('step.1.body','Desde $50,000, a 6 y 12 meses. Firmas el contrato con tu firma digital.',130),
  ('step.2.title','El fondo lo presta a afiliados',140),
  ('step.2.body','Tu dinero financia préstamos de nómina del propio sindicato, con descuento garantizado.',150),
  ('step.3.title','Cobras el 2.5% cada mes',160),
  ('step.3.body','Se deposita en tu cuenta bancaria registrada el día 5 de cada mes, todos los meses del plazo.',170),
  ('guarantees.title','Tu respaldo',180),
  ('guarantee.1.title','Respaldado por el patrimonio del SUTI',190),
  ('guarantee.1.body','El fondo responde con reservas propias; no se invierte en bolsa ni en instrumentos de riesgo.',200),
  ('guarantee.2.title','Auditado por el Comité de Vigilancia',210),
  ('guarantee.2.body','Revisión mensual y asamblea informativa cada semestre, abierta a todos los afiliados.',220),
  ('guarantee.3.title','Tu capital regresa completo',230),
  ('guarantee.3.body','Los rendimientos ya se te pagaron mes a mes: al cerrar el plazo (mínimo 6 meses) recibes íntegro el capital, o lo renuevas.',240),
  ('legal.note','Producto exclusivo para afiliados con antigüedad mínima de un año. Los rendimientos pasados no garantizan rendimientos futuros.',250);

create trigger investment_screen_copy_updated_at before update on public.investment_screen_copy
for each row execute function public.set_h0072_updated_at();
create trigger investment_screen_copy_admin_audit after insert or update or delete on public.investment_screen_copy
for each row execute function public.audit_admin_write();

alter table public.investment_screen_copy enable row level security;
alter table public.investment_screen_copy force row level security;
revoke all on public.investment_screen_copy from public,anon,authenticated;

-- The panel edits existing rows; it can never create or destroy the contract of keys.
grant select on public.investment_screen_copy to anon;
grant select,update on public.investment_screen_copy to authenticated;

create policy investment_copy_read on public.investment_screen_copy
  for select to anon,authenticated using(true);
create policy investment_copy_write on public.investment_screen_copy
  for update to authenticated
  using(public.has_admin_permission('workflow.write'))
  with check(public.has_admin_permission('workflow.write'));

-- The module joins the delegable catalog so a scoped administrator can be granted
-- it like any other panel, reusing the workflow permissions of its neighbours.
insert into public.admin_section_definitions(
  section_key,display_name,data_boundary,allowed_actions,enforcement_status,
  module_key,module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order)
values('admin_inversion','Suti Inversión · Textos','Administrative module: inversion',
  array['read','update'],'ENFORCED','inversion',
  array['workflow.read']::text[],array['workflow.write']::text[],array[]::text[],false,36);

-- Restrictive scope: a module administrator writes here only if granted this module.
-- Reading stays open, or the affiliate who is also a scoped admin could not open
-- the investment screen at all.
create policy module_scope_update on public.investment_screen_copy
  as restrictive for update to authenticated
  using(public.admin_module_boundary(array['inversion']::text[],'update'))
  with check(public.admin_module_boundary(array['inversion']::text[],'update'));

commit;
