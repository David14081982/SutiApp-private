'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260831000500_universal_program_product_payment_simulator.sql');
const recovery=read('supabase/recovery/20260831000500_universal_program_product_payment_simulator_recovery.sql');
const edge=read('supabase/functions/financial-legacy/index.ts'),repo=read('app/financial-legacy-repository.js');
const requestRepo=read('app/program-request-repository.js'),screen=read('app/screens-program-product-payment.jsx');
const catalog=read('app/screens-catalogo.jsx'),admin=read('app/screens-admin-finanzas.jsx'),operations=read('app/operations-store.jsx');
const html=read('SutiApp.html'),sw=read('sw.js'),builder=read('scripts/build-bundle.js'),bundle=read('app/bundle.js');
for(const marker of [
  "v_process='JUB'", "make_date(extract(year from v_cursor)::integer,extract(month from v_cursor)::integer,5)",
  "v_min_date:=p_start_date+30", "'frequency',case when v_process='JUB' then 'mensual' else 'quincenal' end",
  'PROGRAM_PRODUCT_PAYMENT_V1','APPROVED_QUOTE','PRICE_CASH','resolve_suti_loan_quote_contract',
  "financial_processing_status='completed'","'google_handoff',false",'SERVICE_ROLE_REQUIRED','has_admin_permission',
])assert(migration.includes(marker),'migration marker missing: '+marker);
assert(recovery.includes('RECOVERY_BLOCKED_PROGRAM_PRODUCT_PAYMENT_HISTORY_EXISTS'));
assert(recovery.includes("delete from public.financial_session_snapshots where session_purpose='PROGRAM_PRODUCT_PAYMENT'"));
assert(!screen.includes('DATA.')&&!screen.includes('localStorage')&&!screen.includes('640'),'mock/local authority leaked into simulator');
for(const marker of ['Simula tu plan de pago','Precio autorizado','Tu enganche','Número de descuentos','Calendario de descuentos','UnifiedDocumentPhase','ProgramTermsRepository.current(\'prestamo\')','RequestSubmissionSuccess'])assert(screen.includes(marker),marker);
for(const marker of ['programPaymentSessionOpen','programPaymentSessionQuote','programPaymentSessionConfirm','generate_program_product_payment_schedule','businessDateISO'])assert(edge.includes(marker),marker);
assert(edge.includes('process === "JUB" ? "mensual" : "quincenal"'));
assert(repo.includes('openProgramPaymentSession')&&repo.includes('quoteProgramPayment')&&repo.includes('confirmProgramPayment'));
assert(requestRepo.includes('approveProductPayment')&&requestRepo.includes('approve_program_product_payment_request'));
assert(admin.includes("productPayment=detail.program_id!=='prestamo'")&&admin.includes("action === 'approveProduct'")&&admin.includes('No se enviará información a Google'));
assert(operations.includes('Producto vía nómina'));
assert(catalog.includes('ProgramProductPaymentFlow')&&!catalog.includes('VER PLAN DE PAGO')&&catalog.includes('Solicitar cotización'));
assert(builder.includes("'screens-program-product-payment.jsx', 'screens-catalogo.jsx'"));
assert(bundle.includes('Simula tu plan de pago')&&bundle.includes('approve_program_product_payment_request'));
assert(html.includes('financial-legacy-repository.js?v=10')&&html.includes('bundle.js?v=188'));
assert(sw.includes("sutiapp-v132")&&sw.includes('bundle.js?v=188'));
new vm.Script(bundle,{filename:'app/bundle.js'});
console.log(JSON.stringify({status:'PASS',calendar:'JUB_MONTHLY_DAY_5_AFTER_30_DAYS',authorities:['program_catalog_items','financial_rules:caja','program_requests'],mockAuthority:false,googleProductHandoff:false,bundleSyntax:true}));
