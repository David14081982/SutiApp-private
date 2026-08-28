'use strict';

const assert=require('assert').strict;
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const screen=read('app/screens-admin-affiliates.jsx');
const repository=read('app/admin-affiliates-repository.js');
const admin=read('app/screens-admin.jsx');
const documents=read('app/screens-admin-documents.jsx');
const requests=read('app/screens-admin-requests.jsx');
const finances=read('app/screens-admin-finanzas.jsx');
const builder=read('scripts/build-bundle.js');
const bundle=read('app/bundle.js');
const migration=read('supabase/migrations/20260827001200_admin_affiliates_workbench.sql');
const recovery=read('supabase/recovery/20260827001200_admin_affiliates_workbench_recovery.sql');

[screen,repository,admin,documents,requests,finances,builder].forEach((source)=>new vm.Script(source));

[
  'data-admin-affiliates','data-admin-affiliate-detail','data-affiliate-row',
  'Padrón de afiliados','Buscar nombre, control, correo, teléfono, RFC o CURP',
  'Exportar Excel','Nuevo afiliado','Editar información','Cambiar estado',
  'Datos generales','Afiliación','Expediente','Solicitudes','Acceso','Auditoría',
  'No se borrarán documentos, solicitudes, Auth ni historial',
  'La afiliación administrativa y la cuenta Auth son autoridades separadas',
  '@media(max-width:1023px)'
].forEach((contract)=>assert.ok(screen.includes(contract),contract));
assert.match(screen,/pageSize:PAGE_SIZE/);
assert.match(screen,/AdminAffiliatesRepository\.duplicates/);
assert.match(screen,/onOpenModule\('documents_admin'/);
assert.match(screen,/onOpenModule\('requests'/);
assert.match(screen,/onOpenModule\('finanzas'/);

[
  'list_admin_affiliates','get_admin_affiliate_workbench','find_admin_affiliate_duplicates',
  'create_admin_affiliate','update_admin_affiliate','change_admin_affiliate_status'
].forEach((rpc)=>assert.ok(repository.includes(rpc),rpc));
assert.match(repository,/requirePermission\('affiliates\.read'\)/);
assert.match(repository,/requirePermission\('affiliates\.write'\)/);
assert.match(repository,/requirePermission\('data_exports\.read'\)/);
assert.match(repository,/DataExportRepository\.download\('affiliates','xlsx'/);
assert.doesNotMatch(repository+screen,/\.from\('affiliates'\)|localStorage|sessionStorage|IndexedDB/);

assert.match(admin,/id: 'affiliates'.*label: 'Afiliados'.*Padrón, expedientes y solicitudes/);
assert.doesNotMatch(admin,/id: 'identity_access'/);
assert.match(admin,/window\.AffiliatesAdminModule/);
assert.match(admin,/initialAffiliateId:affiliateContext&&affiliateContext\.affiliateId/);
assert.match(documents,/function DocumentsAdminModule\(\{app,onBack,header,initialAffiliateId\}\)/);
assert.match(requests,/const scopedRows=initialAffiliateId\?rows\.filter/);
assert.match(finances,/const scoped=initialAffiliateId\?source\.filter/);
assert.match(finances,/const belongsToAffiliate=/);

assert.match(builder,/admin-affiliates-repository\.js/);
assert.match(builder,/screens-admin-affiliates\.jsx/);
assert.match(bundle,/@@file admin-affiliates-repository\.js/);
assert.match(bundle,/@@file screens-admin-affiliates\.jsx/);

assert.match(migration,/add column record_origin text not null default 'HISTORICAL_IMPORT'/);
assert.match(migration,/record_origin in \('HISTORICAL_IMPORT','ADMIN_AFFILIATES'\)/);
assert.match(migration,/record_origin='ADMIN_AFFILIATES' and source_row_ordinal is null and source_file_hash is null/);
assert.match(migration,/create table public\.affiliate_admin_events/);
assert.match(migration,/alter table public\.affiliate_admin_events force row level security/);
assert.match(migration,/has_admin_permission\('affiliates\.read'\)/);
assert.match(migration,/has_admin_permission\('affiliates\.write'\)/);
assert.match(migration,/on delete restrict/);
assert.doesNotMatch(migration,/delete from public\.affiliates/);
assert.match(recovery,/RECOVERY_BLOCKED_ADMIN_AFFILIATES_EXIST/);
assert.match(recovery,/RECOVERY_BLOCKED_AFFILIATE_AUDIT_EXISTS/);

console.log('Admin affiliates productive workbench static contract PASS');
