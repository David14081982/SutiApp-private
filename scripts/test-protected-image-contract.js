'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const agents = read('AGENTS.md');
const invariants = read('docs/INVARIANTS.md');
const matrix = read('scripts/test-global-image-regression-production-live.js');

for (const protectedToken of [
  'AssetRepository', 'DocumentWorkflowRepository', 'app_assets', 'private_assets',
  'Storage', 'URLs firmadas', 'bundle', 'service worker', 'viewer compartido',
]) {
  assert(agents.includes(protectedToken), `AGENTS protected-image rule lost token: ${protectedToken}`);
}

assert.match(invariants, /INV-173:[\s\S]*matriz global protegida de imágenes/);
assert.match(agents, /test-global-image-regression-production-live\.js/);

for (const requiredContract of [
  'BrandingRepository.get', 'AffiliateRepository.getProfilePhoto', 'data-admin-affiliates',
  'DocumentWorkflowRepository.selfPreview', 'DocumentWorkflowRepository.adminPreview',
  'ProgramCatalogRepository.listItems', 'MarketplaceRepository.listProducts',
  'MembershipRepository.list', 'window.ImageViewer', 'window.DocumentViewer',
  'programProductGallery', 'legitimatePdf', 'serviceWorkerUnregistered',
  'GITHUB_PAGES_PRODUCTION', 'LOCAL_BUILD_WITH_PRODUCTION_BACKEND',
]) {
  assert(matrix.includes(requiredContract), `Protected image matrix lost contract: ${requiredContract}`);
}

assert.doesNotMatch(matrix, /service_role|SUPABASE_SECRET_KEY|SUPABASE_ACCESS_TOKEN/);
assert.match(matrix, /productionDataMutations: 0/);
assert.match(matrix, /rawUrlsLogged: 0/);

console.log(JSON.stringify({ status: 'PASS', invariant: 'INV-173', protectedContracts: 14, productionDataMutations: 0 }));
