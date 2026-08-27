'use strict';

const assert = require('assert');
const fs = require('fs');

const home = fs.readFileSync('app/screens-home-r2.jsx', 'utf8');
const visualContent = fs.readFileSync('app/visual-content.js', 'utf8');

assert(!home.includes('function QuickActions'), 'legacy Home quick-action component remains');
for (const id of ['qa_prestamo', 'qa_credencial', 'qa_convenios', 'qa_documentos', 'quick_actions']) {
  assert(!home.includes(id), `removed Home quick action remains: ${id}`);
}

assert(home.includes('const HOME_BANNER_HEIGHT = 224;'), 'expanded Home banner height is not explicit');
assert.strictEqual((home.match(/HOME_BANNER_HEIGHT/g) || []).length, 4, 'loading, error and loaded banner states must share the expanded height');
assert.strictEqual((home.match(/data-home-banner-layout/g) || []).length, 3, 'expanded layout marker must cover every banner state');
assert(home.includes("const defOrder = ['banner_convenio', 'ecosistema', 'comite', 'noticias'];"), 'Home blocks are not ordered banner, ecosystem, committee, news');

for (const contract of ['data-home-banner-dots', 'data-home-banner-index', 'onPointerDown', 'onPointerUp', 'window.ImageViewer', 'window.openSafeContentUrl', 'objectFit: \'cover\'']) {
  assert(home.includes(contract), `banner interaction contract lost: ${contract}`);
}
assert(visualContent.includes("BannerRepository.list('home')"), 'Supabase-backed Home banner authority changed');

console.log('HOME BANNER EXPANSION static verification PASS: four top shortcuts removed, 224px banner states, carousel and authority preserved.');
