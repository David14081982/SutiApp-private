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
const uploadMigration=read('supabase/migrations/20260827001300_admin_affiliate_document_upload.sql');
const uploadRecovery=read('supabase/recovery/20260827001300_admin_affiliate_document_upload_recovery.sql');
const storageGuardMigration=read('supabase/migrations/20260827001310_admin_affiliate_document_storage_path.sql');
const storageGuardRecovery=read('supabase/recovery/20260827001310_admin_affiliate_document_storage_path_recovery.sql');
const cleanupGuardMigration=read('supabase/migrations/20260827001320_admin_affiliate_document_cleanup_guard.sql');
const cleanupGuardRecovery=read('supabase/recovery/20260827001320_admin_affiliate_document_cleanup_guard_recovery.sql');

[screen,repository,admin,documents,requests,finances,builder].forEach((source)=>new vm.Script(source));

[
  'data-admin-affiliates','data-admin-affiliate-detail','data-affiliate-row',
  'Padrón de afiliados','Buscar nombre, control, correo, teléfono, RFC o CURP',
  'Exportar Excel','Nuevo afiliado','Editar información','Cambiar estado',
  'Cargar documento','Eliminar usuario','Baja administrativa reversible',
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
assert.match(screen,/data-admin-affiliate-upload/);
assert.match(screen,/data-affiliate-delete/);
assert.match(screen,/mode:'deactivate'/);

[
  'list_admin_affiliates','get_admin_affiliate_workbench','find_admin_affiliate_duplicates',
  'create_admin_affiliate','update_admin_affiliate','change_admin_affiliate_status'
].forEach((rpc)=>assert.ok(repository.includes(rpc),rpc));
assert.match(repository,/register_admin_affiliate_document/);
assert.match(repository,/requirePermission\('documents\.write'\)/);
assert.match(repository,/storage\.from\('private-assets'\)\.upload/);
assert.match(repository,/crypto\.subtle\.digest\('SHA-256'/);
assert.match(repository,/cleanup_storage_path/);
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

assert.match(uploadMigration,/create function public\.register_admin_affiliate_document/);
assert.match(uploadMigration,/has_admin_permission\('documents\.write'\)/);
assert.match(uploadMigration,/p_affiliate_id uuid/);
assert.match(uploadMigration,/owner_id=auth\.uid\(\)::text/);
assert.match(uploadMigration,/affiliate-documents\/\[0-9a-f\]/);
assert.match(uploadMigration,/VERIFIED_DOCUMENT_IMMUTABLE/);
assert.match(uploadMigration,/sensitive_change_audit/);
assert.match(uploadMigration,/ADMIN_UPLOAD/);
assert.doesNotMatch(uploadMigration,/delete from public\.affiliates/);
assert.match(uploadRecovery,/drop function public\.register_admin_affiliate_document/);
assert.match(uploadRecovery,/Documents already registered through the retired RPC remain canonical history/);
assert.match(storageGuardMigration,/create function public\.can_admin_upload_affiliate_document_path/);
assert.match(storageGuardMigration,/security definer/);
assert.match(storageGuardMigration,/has_admin_permission\('documents\.write'\)/);
assert.match(storageGuardMigration,/exists\(\s*select 1 from public\.affiliates/);
assert.match(storageGuardMigration,/can_admin_upload_affiliate_document_path\(name\)/);
assert.match(storageGuardRecovery,/drop function public\.can_admin_upload_affiliate_document_path/);
assert.match(cleanupGuardMigration,/create function public\.can_delete_unreferenced_affiliate_document_object/);
assert.match(cleanupGuardMigration,/security definer/);
assert.match(cleanupGuardMigration,/not exists\(\s*select 1 from public\.private_assets/);
assert.match(cleanupGuardMigration,/can_delete_unreferenced_affiliate_document_object\(name\)/);
assert.match(cleanupGuardRecovery,/drop function public\.can_delete_unreferenced_affiliate_document_object/);

console.log('Admin affiliates productive workbench static contract PASS');
