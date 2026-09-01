'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260831000700_program_product_commercial_mode_and_sold.sql');
const recovery=read('supabase/recovery/20260831000700_program_product_commercial_mode_and_sold_recovery.sql');
const repository=read('app/program-catalog-repository.js'),admin=read('app/screens-admin-program-products.jsx');
const catalog=read('app/screens-catalogo.jsx'),payment=read('app/screens-program-product-payment.jsx');
const edge=read('supabase/functions/financial-legacy/index.ts'),deploy=read('scripts/deploy-financial-legacy.js');

for(const mode of ['PAYROLL_FIXED','PAYROLL_QUOTE','DIRECT_CONTACT']){
  assert(migration.includes(mode),`migration missing ${mode}`);
  assert(admin.includes(mode),`Admin missing ${mode}`);
}
assert(migration.includes("when program_key='casa' then 'DIRECT_CONTACT'"));
assert(migration.includes("(commercial_mode='PAYROLL_QUOTE')=requires_quote"));
assert(migration.includes('add column sold boolean not null default false'));
assert(migration.includes('add column sold_at timestamptz'));
assert(migration.includes('add column sold_by uuid'));
assert(migration.includes('program_catalog_items_sold_audit_check'));
assert(migration.includes('program_requests_catalog_requestability'));
for(const denial of ['PROGRAM_PRODUCT_SOLD','PROGRAM_PRODUCT_DIRECT_CONTACT_ONLY','PROGRAM_PRODUCT_PAYMENT_FLOW_REQUIRED']) assert(migration.includes(denial));
assert(migration.includes("financial_submission_snapshot->>'contract_version'='PROGRAM_PRODUCT_PAYMENT_V1'"));
assert(migration.includes("has_admin_permission('program_catalog.write')"));
assert(!migration.includes("'commercial_mode','sold','enabled','sort_order','record_origin'"),'record_origin must not be browser-editable');
assert(migration.includes("'ADMIN_PROGRAM_CATALOG',null,null,null"));
assert(recovery.includes('RECOVERY_BLOCKED_PROGRAM_CATALOG_ROWS_CHANGED'));
assert(recovery.includes('RECOVERY_BLOCKED_PROGRAM_CATALOG_ADMIN_HISTORY_EXISTS'));
assert(recovery.includes('general_writer_definition'));
assert(recovery.includes('cirugias_writer_definition'));
assert(repository.includes('getDirectContact'));
assert(repository.includes("from('institutional_programs')"));
assert(repository.includes("commercial_mode,sold,sold_at"));
assert(admin.includes('data-program-product-sold-control'));
assert(admin.includes('Marca el artículo como no disponible para nuevas solicitudes.'));
assert(catalog.includes('data-program-direct-contact'));
assert(catalog.includes('Precio informativo · sin financiamiento SutiApp'));
assert(catalog.includes('data-program-product-sold-badge'));
assert(catalog.includes("!sold&&commercialMode!=='DIRECT_CONTACT'"));
assert(payment.includes('acquisitionBlocked'));
for(const denial of ['PROGRAM_PRODUCT_SOLD','PROGRAM_PRODUCT_DIRECT_CONTACT_ONLY']){
  assert(edge.includes(denial),`Edge missing ${denial}`);
  assert(deploy.includes(denial),`deploy verification missing ${denial}`);
}
for(const forbidden of ['marketplace_products','company_']) assert(!migration.includes(forbidden),`out-of-scope migration reference ${forbidden}`);
console.log(JSON.stringify({status:'PASS',authority:'program_catalog_items',commercialModes:3,soldIndependent:true,casaClassification:'DIRECT_CONTACT',serverGuard:true,recovery:true,marketplaceTouched:false,panelEmpresarialTouched:false}));
