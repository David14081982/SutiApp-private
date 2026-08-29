'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const marketplace = read('app/screens-marketplace.jsx');
const catalogDetail = read('app/screens-catalogo.jsx');
const requestSql = read('supabase/migrations/20260822000200_create_unified_program_requests.sql');
const documentsSql = read('supabase/migrations/20260825000100_complete_documents_credentials_membership_requests.sql');
const financialSql = read('supabase/migrations/20260825000400_personalized_financial_session_snapshots.sql');
const investment = read('app/screens-inversion.jsx');

assert(marketplace.includes('Solicitar otra cotización'));
assert(catalogDetail.includes('SOLICITAR OTRA COTIZACIÓN'));
for (const source of [marketplace, catalogDetail]) {
  assert(source.includes('Nueva cotización'), 'a completed quote must keep a new-request CTA');
  assert(!source.includes('Esperando cotización del proveedor'), 'a pending quote must not replace the CTA with a disabled control');
  assert(!source.includes("'Esperando cotización'"), 'a pending item quote must not replace the CTA with a disabled control');
}

assert(requestSql.includes('constraint program_requests_idempotency_unique unique (affiliate_id,idempotency_key)'));
assert(!/unique\s*\([^)]*affiliate_id[^)]*program_(?:id|item_id)/i.test(requestSql), 'requests must not be unique per affiliate/program');
assert(!/where\s+affiliate_id\s*=\s*v_affiliate\.id[\s\S]{0,240}status\s+in\s*\(\s*'submitted'/i.test(requestSql), 'RPC must not reject a new request because another one is pending');
assert(documentsSql.includes("d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')"), 'pending or under-review documents must satisfy request attachment requirements');
assert(documentsSql.includes('where affiliate_id=v_affiliate.id and idempotency_key=p_idempotency_key'), 'membership deduplication must be scoped to the same technical submission');
assert(financialSql.includes('where affiliate_id=p_affiliate_id and idempotency_key=p_idempotency_key'), 'loan deduplication must be scoped to the same technical submission');
assert(financialSql.includes("d.status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED')"), 'loan must accept pending or under-review documents');
assert(investment.includes('no crea solicitudes de inversión'));
assert(!investment.includes('ProgramRequestRepository'));
assert(marketplace.includes("const programKey = ['prestamo', 'nomina', 'caja'].includes"), 'savings and investment must remain outside the financing writer');

console.log(JSON.stringify({
  status: 'PASS',
  repeatedSameProgram: true,
  differentProgramWhilePending: true,
  pendingDocumentsReusable: true,
  exceptions: ['ahorro', 'inversion'],
}));
