'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const repository = fs.readFileSync(path.join(root, 'app', 'affiliate-repository.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, 'app', 'document-workflow-repository.js'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'app', 'screens-documentos.jsx'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'app', 'screens-admin-identity.jsx'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'app', 'bundle.js'), 'utf8');

new vm.Script(repository);
new vm.Script(workflow);
new vm.Script(screen);
new vm.Script(admin);

assert.doesNotMatch(screen, /\bDATA\s*\(|localStorage|sessionStorage|\.docs\.map/);
assert.match(repository, /async function readDocuments\(affiliateId, historicalOnly\)/);
assert.match(repository, /getDocuments=.*readDocuments\(affiliateId,false\)/);
assert.match(repository, /getHistoricalDocuments=.*readDocuments\(affiliateId,true\)/);
assert.match(repository, /get_effective_affiliate_id/);
assert.match(repository, /from\('affiliate_files'\)/);
assert.match(repository, /createSignedUrls\(paths, DOCUMENTS\.signedUrlTtlSeconds\)/);
assert.doesNotMatch(repository, /documents\.map\(async[\s\S]*createSignedUrl/);
assert.match(repository, /signedUrlTtlSeconds:\s*300/);
assert.match(repository, /source_column,source_column_letter/);
assert.match(repository, /sha256:\s*row\.sha256/);
assert.match(screen, /data-document-authority['"]?:['"]supabase/);
assert.match(screen, /DocumentRequirementList/);
assert.match(screen, /No fue posible consultar la fuente autorizada\./);
assert.match(screen, /Reintentar/);
assert.match(workflow, /from\('affiliate_documents'\)/);
assert.match(workflow, /register_affiliate_document/);
assert.match(workflow, /crypto\.subtle\.digest\('SHA-256'/);
assert.doesNotMatch(workflow, /localStorage|sessionStorage|FileReader|data:image/);
assert.match(admin, /app\.admin\.has\('assets\.read'\)/);
assert.match(admin, /AffiliateRepository\.getHistoricalDocuments\(affiliateId\)/);
assert.match(admin, /DocumentWorkflowRepository\.list\(affiliateId\)/);
assert.match(admin, /data-admin-canonical-expediente/);
assert.match(admin, /data-admin-document-gallery/);
assert.match(admin, /data-admin-historical-gallery/);
assert.match(admin, /data-admin-duplicate-candidate/);
assert.match(admin, /DocumentInspector/);
assert.match(screen, /required_by_default/);
assert.match(bundle, /data-document-authority/);
assert.doesNotMatch(bundle.slice(bundle.indexOf('\/\* @@file screens-documentos.jsx \*\/'), bundle.indexOf('\/\* @@file admin-store.jsx \*\/')), /\bDATA\s*\(/);

console.log('Affiliate expediente authority tests passed');
