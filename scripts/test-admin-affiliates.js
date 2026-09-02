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
const archiveMigration=read('supabase/migrations/20260901000200_admin_affiliate_archive_and_digital_file.sql');
const archiveRecovery=read('supabase/recovery/20260901000200_admin_affiliate_archive_and_digital_file_recovery.sql');
const affiliateRepository=read('app/affiliate-repository.js');
const affiliateAuth=read('app/affiliate-auth.js');

[screen,repository,admin,documents,requests,finances,builder].forEach((source)=>new vm.Script(source));

[
  'data-admin-affiliates','data-admin-affiliate-detail','data-affiliate-row',
  'Padrón de afiliados','Buscar nombre, control, correo, teléfono, RFC o CURP',
  'Exportar Excel','Nuevo afiliado','Editar información','Cambiar estado',
  'Cargar o reemplazar','Eliminados','Archivar afiliado','Restaurar afiliado',
  'Datos generales','Afiliación','Expediente','Solicitudes','Acceso','Auditoría',
  'Auth, expediente, solicitudes e historial permanecerán intactos',
  'La afiliación administrativa y la cuenta Auth son autoridades separadas',
  '@media(max-width:1023px)'
].forEach((contract)=>assert.ok(screen.includes(contract),contract));
assert.match(screen,/pageSize:PAGE_SIZE/);
assert.match(screen,/AdminAffiliatesRepository\.duplicates/);
assert.match(screen,/onOpenModule\('documents_admin'/);
assert.match(screen,/onOpenModule\('requests'/);
assert.match(screen,/onOpenModule\('finanzas'/);
assert.match(screen,/data-admin-affiliate-upload/);
assert.match(screen,/data-affiliate-archive/);
assert.match(screen,/data-affiliate-archive-confirm/);
assert.match(screen,/DocumentViewer/);
assert.doesNotMatch(screen,/Eliminar usuario|mode:'deactivate'|data-affiliate-delete/);
assert.match(screen,/data-affiliate-actions':'header'/);
assert.doesNotMatch(screen,/h\('aside',\{className:'aff-actions'/);

[
  'list_admin_affiliates','get_admin_affiliate_workbench','find_admin_affiliate_duplicates',
  'create_admin_affiliate','update_admin_affiliate','change_admin_affiliate_status',
  'list_admin_archived_affiliates','archive_admin_affiliate','restore_admin_affiliate'
].forEach((rpc)=>assert.ok(repository.includes(rpc),rpc));
assert.match(repository,/register_admin_affiliate_document/);
assert.match(repository,/requirePermission\('documents\.write'\)/);
assert.match(repository,/storage\.from\('private-assets'\)\.upload/);
assert.match(repository,/crypto\.subtle\.digest\('SHA-256'/);
assert.match(repository,/cleanup_storage_path/);
assert.match(repository,/DocumentWorkflowRepository\.listAdminDocuments/);
assert.match(repository,/DocumentWorkflowRepository\.adminPreview/);
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

assert.match(archiveMigration,/add column is_archived boolean not null default false/);
assert.match(archiveMigration,/check\(action in \('CREATE','UPDATE','STATUS_CHANGE','ARCHIVE','RESTORE'\)\)/);
assert.match(archiveMigration,/create function public\.archive_admin_affiliate/);
assert.match(archiveMigration,/create function public\.restore_admin_affiliate/);
assert.match(archiveMigration,/where not a\.is_archived/);
assert.match(archiveMigration,/program_requests_guard_archived_affiliate/);
assert.match(archiveMigration,/raise exception 'AFFILIATE_ARCHIVED'/);
assert.match(archiveMigration,/match_state.*ARCHIVED_MATCH/s);
assert.match(archiveMigration,/replaces_document_id/);
assert.match(archiveMigration,/ADMIN_REPLACEMENT_UPLOAD/);
assert.match(archiveMigration,/force row level security/);
assert.doesNotMatch(archiveMigration,/delete from public\.(affiliates|affiliate_documents|program_requests)/);
assert.doesNotMatch(archiveMigration,/marketplace|google|apps_script/i);
assert.match(archiveRecovery,/ARCHIVE_RECOVERY_BLOCKED_BY_LIFECYCLE_ACTIVITY/);
assert.match(archiveRecovery,/ARCHIVE_RECOVERY_BLOCKED_BY_POST_MIGRATION_ACTIVITY/);
assert.match(archiveRecovery,/prior_function_definitions/);
assert.match(affiliateRepository,/get_current_affiliate_access_state/);
assert.match(affiliateRepository,/AFFILIATE_ARCHIVED/);
assert.match(affiliateAuth,/archivedIdentity/);
assert.match(affiliateAuth,/phase === 'archived'/);

console.log('Admin affiliates productive workbench static contract PASS');
