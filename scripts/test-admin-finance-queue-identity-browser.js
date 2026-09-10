'use strict';
// Isolated fixtures. No external service, real React + screen + focal repository + demand coordinator.
const fs = require('fs'), path = require('path'), assert = require('assert').strict;
const { chromium } = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const out = path.join(root, 'docs/qa/evidence/finance-queue-identity-20260909');
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [], checks = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    await page.setContent('<style>:root{--surface:#fff;--surface-2:#edf0f5;--hairline:#e1e5ed;--ink:#172033;--ink-2:#364154;--ink-3:#657086;--guinda:#901040;--mono:monospace}*{box-sizing:border-box}body{font-family:Arial;background:#f3f5f9;margin:16px}button,input,textarea,select{font-family:inherit}</style><div id="fixture"></div>');
    for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js']) await page.addScriptTag({ content: read(file) });
    await page.evaluate(() => {
      window.Icon = () => null; window.money = n => '$' + n;
      window.AffiliateAuth = { getState: () => ({ phase: 'authenticated', session: { user: { id: 'fixture' }, access_token: 'fixture' }, affiliate: { id: 'fixture' } }), subscribe: () => () => {} };
      window.AdminRepository = { getState: () => ({ phase: 'authorized' }), subscribe: () => () => {} };
      const stage = { id: 'received', label: 'Solicitud recibida', responsible: 'Administración', state: 'current' };
      window.__rows = Array.from({ length: 35 }, (_, i) => ({ id: 'r' + i, affiliate_id: 'a' + Math.floor(i / 2), folio: 'SR-2026-' + String(210 - i).padStart(6, '0'), nombre: 'MARÍA', affiliate: { full_name: 'María Fernanda López Hernández ' + i, display_name: 'MARÍA' }, numero_control: '00001326', program_id: i === 4 ? 'casa' : 'prestamo', program_item: { name: i === 4 ? 'Terreno Los Olivos' : 'Suti Préstamo' }, requested_amount: 6000, requested_term: 12, requested_term_semantics: 'quincenal', status: 'submitted', request_type: 'benefit', created_at: new Date(Date.now() - i * 60000).toISOString(), ts: Date.now() - i * 60000, workflow_state: { available: true, stages: [stage], current_stage: stage } }));
      window.__fundReads = 0; window.__photoReads = []; window.__failFunds = false; window.__writes = 0;
      window.ProgramRequestRepository = { listAdminFlowQueue: async () => __rows, adminFlowDetail: async id => __rows.find(row => row.id === id), listFinancialMobile: async () => { __fundReads++; if (__failFunds) throw Error('DENIED'); return __rows.map(({ id }) => ({ id, financial_submission_snapshot: { financialResult: { fund: id === 'r3' ? null : id === 'r1' ? 'Fondo de Emergencia' : 'Caja Chica' } } })); } };
      const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#e5ced8"/><circle cx="36" cy="26" r="13" fill="#906877"/><ellipse cx="36" cy="70" rx="27" ry="28" fill="#906877"/></svg>');
      window.AffiliateRepository = { getProfilePhoto: async id => { __photoReads.push(id); await new Promise(resolve => setTimeout(resolve, 30)); if (id === 'a1') return null; if (id === 'a2') throw Error('PHOTO_DENIED'); return { signedUrl: image, expiresAt: Date.now() + 300000 }; } };
      window.__app = { admin: { has: () => false } }; window.__onCount = () => {};
    });
    for (const file of ['app/private-resource-demand.js', 'app/admin-finance-queue-repository.js', 'app/screens-admin-finanzas.jsx']) {
      await page.addScriptTag({ content: read(file).replace('  function FinanzasModule(', '  window.__Workbench = DesktopFinancialWorkbench;\n  function FinanzasModule(') });
    }
    await page.evaluate(() => { window.__root = ReactDOM.createRoot(document.getElementById('fixture')); __root.render(React.createElement(__Workbench, { app: __app, onCount: __onCount })); });
    const rows = page.locator('[data-financial-queue-row]'); await rows.first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.finwb-profile-photo img')].some(i => i.complete && i.naturalWidth));
    assert.deepEqual(await page.locator('.finwb-queue-head>span').allTextContents(), ['Folio', 'Foto', 'Afiliado / programa', 'Monto / plazo', 'Estado / etapa', 'Antig.']);
    assert.equal(await rows.first().locator('[data-financial-queue-person]').textContent(), 'María Fernanda López Hernández 0');
    assert((await rows.nth(0).textContent()).includes('Caja Chica'));
    assert((await rows.nth(1).textContent()).includes('Fondo de Emergencia'));
    assert((await rows.nth(3).textContent()).includes('Fondo no registrado'));
    assert((await rows.nth(4).textContent()).includes('Terreno Los Olivos'));
    assert.equal(await page.locator('[data-financial-queue-photo="a1"][data-photo-state="initials"]').count(), 2);
    await page.waitForSelector('[data-financial-queue-photo="a2"][data-photo-state="error"]');
    const readMetrics = await page.evaluate(() => ({ funds: __fundReads, photos: __photoReads.length, uniquePhotos: new Set(__photoReads).size }));
    assert.equal(readMetrics.funds, 1); assert.equal(readMetrics.photos, readMetrics.uniquePhotos); assert(readMetrics.photos < 18);
    checks.push({ case: 'full name, distinct funds, program product, missing fund, real photo element, empty/error states, visible demand and deduplication', ...readMetrics, status: 'PASS' });
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 667 }]) {
      await page.setViewportSize(viewport);
      const metrics = await rows.first().evaluate(row => {
        const c = [...row.children], r = c.map(el => el.getBoundingClientRect());
        return { overflow: document.documentElement.scrollWidth > innerWidth || row.scrollWidth > row.clientWidth, order: r[0].right <= r[1].left && r[1].right <= r[2].left, nameVisible: getComputedStyle(c[2]).display !== 'none', photoVisible: r[1].width >= 32 };
      });
      assert(!metrics.overflow && metrics.order && metrics.nameVisible && metrics.photoVisible, JSON.stringify({ viewport, metrics }));
      await page.screenshot({ path: path.join(out, 'queue-' + viewport.width + '.png') }); checks.push({ viewport, ...metrics, status: 'PASS' });
    }
    const search = page.locator('.finwb-filters input').first();
    await search.fill('López Hernández 0'); assert.equal(await rows.count(), 1);
    await search.fill('Fondo de Emergencia'); assert.equal(await rows.count(), 1);
    await search.fill('');
    await rows.first().locator('[data-financial-queue-photo]').click(); await page.locator('dialog[open]').waitFor();
    await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.evaluate(() => { __failFunds = true; });
    await page.evaluate(() => __root.render(React.createElement(__Workbench, { key: 'reload', app: __app, onCount: __onCount })));
    await page.getByText('No fue posible cargar las solicitudes.', { exact: false }).waitFor(); assert.equal(await rows.count(), 0);
    await page.evaluate(() => { __failFunds = false; }); await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await rows.first().waitFor();
    assert.deepEqual(errors, []); checks.push({ case: 'surname/fund search, photo opens existing dialog, Escape, failed authoritative read and retry', status: 'PASS' });
    fs.writeFileSync(path.join(out, 'browser-result.json'), JSON.stringify({ status: 'PASS', checks, errors, backendConnections: 0 }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'PASS', cases: checks.length }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
