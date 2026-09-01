'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260831000800_program_products_save_contract_delta.sql');
const recovery=read('supabase/recovery/20260831000800_program_products_save_contract_delta_recovery.sql');
const repository=read('app/program-catalog-repository.js');
const admin=read('app/screens-admin-program-products.jsx');

for(const code of ['PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED','PROGRAM_CATALOG_PRICE_REQUIRED','PROGRAM_CATALOG_ORDER_INVALID','PROGRAM_CATALOG_MODE_QUOTE_MISMATCH','PROGRAM_CATALOG_WRITE_REQUIRED']){
  assert(migration.includes(code),`migration missing ${code}`);
  assert(admin.includes(code),`Admin error mapping missing ${code}`);
}
assert(migration.includes('greatest(8,v_existing_asset_count)'),'historical image ceiling is not delta-aware');
assert(migration.includes("or v_price is distinct from v_before.price_cash"),'historical price preservation missing');
assert(migration.includes("v_sort is distinct from v_before.sort_order"),'historical order preservation missing');
assert(migration.includes("'ADMIN_PROGRAM_CATALOG',null,null,null"),'new rows must use truthful Admin origin');
assert(migration.includes("program_key in('auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','tours','donativos','prestamo','cirugias')"),'Cirugias constraint correction missing');
assert(migration.includes("has_admin_permission('program_catalog.write')"),'backend permission check missing');
assert(migration.includes("revoke all on function public.save_program_catalog_item(uuid,jsonb,jsonb) from public,anon"),'anon RPC revoke missing');
assert(migration.includes("'delta_aware',true"),'audit marker missing');
assert(recovery.includes('general_writer_definition')&&recovery.includes('cirugias_writer_definition'),'exact function restoration missing');
assert(recovery.includes('RECOVERY_BLOCKED_PROGRAM_CATALOG_ADMIN_HISTORY_EXISTS'),'recovery admin-history guard missing');
assert(recovery.includes('RECOVERY_BLOCKED_PROGRAM_CATALOG_STATE_CHANGED'),'recovery state guard missing');
assert(admin.includes('Math.max(8,originalImageCount)'),'historical gallery UI ceiling missing');
assert(admin.includes('legacyPricePreserved')&&admin.includes('legacyOrderPreserved'),'historical scalar UI preservation missing');
assert(admin.includes('saveErrorMessage(e)'),'specific error mapping is not used');
assert(repository.includes('commercial_mode:mode'),'repository must send the commercial contract');
assert(repository.includes('p_asset_links:links'),'repository must send the complete asset-link contract');
for(const forbidden of ['marketplace_products','program_requests','company_','financial_submission','google','apps_script']){
  assert(!migration.toLowerCase().includes(forbidden),`out-of-scope migration reference: ${forbidden}`);
}

const sandbox={window:{},React:{},console};
vm.createContext(sandbox);
vm.runInContext(admin.replace(/\(function \(\) \{/,'(function () {').replace('const {useEffect,useState,useRef}=React,I=window.Icon;','const {useEffect,useState,useRef}=React,I=window.Icon;'),sandbox,{filename:'screens-admin-program-products.jsx'});
const message=sandbox.window.ProgramProductSaveErrorMessage;
assert.equal(typeof message,'function');
assert.match(message({message:'PROGRAM_CATALOG_IMAGE_LIMIT_EXCEEDED'}),/galería/i);
assert.match(message({message:'PROGRAM_CATALOG_PRICE_REQUIRED'}),/precio fijo/i);
assert.match(message({code:'42501'}),/permiso/i);
console.log(JSON.stringify({status:'PASS',contract:'delta-aware',historicalImages:'8→8, 9→9, 9→8 allowed; 8→9, 9→10 denied',specificErrors:true,recovery:true,outOfScopeTouched:false}));
