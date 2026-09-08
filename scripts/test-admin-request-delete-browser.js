'use strict';
// Synthetic fixtures only. Actual screen, React and viewer; no backend connections.
const fs = require('fs'), path = require('path'), cp = require('child_process'), assert = require('assert').strict;
const { chromium } = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const evidence = path.join(root, 'docs/qa/evidence/admin-request-delete-20260908');
async function main() {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const receipts = [], errors = [];
  try {
    async function fixture(before = false, variant = 'normal', writable = true) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
      await page.setContent('<style>:root{--surface:#fff;--surface-2:#edf0f5;--hairline:#e1e5ed;--ink:#172033;--ink-2:#364154;--ink-3:#657086;--guinda:#901040;--mono:monospace}*{box-sizing:border-box}body{font-family:Arial;background:#f3f5f9;margin:24px}#fixture{min-height:1800px}button,input,textarea,select{font-family:inherit}</style><div id="fixture"></div>');
      for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js']) await page.addScriptTag({ content: read(file) });
      await page.evaluate(({ variant, writable }) => {
        window.Icon = () => null; window.money = n => '$' + n;
        window.AffiliateAuth = { getState: () => ({ phase: 'authenticated', session: { user: { id: 'fixture' }, access_token: 'fixture' }, affiliate: { id: 'fixture' } }), subscribe: () => () => {} };
        window.AdminRepository = { getState: () => ({ phase: 'authorized', assignment: { role: 'admin' } }), subscribe: () => () => {} };
        const steps = [{ id: 'received', label: 'Solicitud recibida', responsible: 'Administración', state: 'current' }, { id: 'approved', label: 'Autorización de la solicitud', responsible: 'Finanzas', state: 'upcoming', status_references: ['approved'] }, { id: 'rejected', label: 'Rechazada', state: 'upcoming', outcome: 'failure' }];
        const doc = { id: 'doc', affiliate_document_id: 'doc', mimeType: 'image/svg+xml', status: 'VERIFIED', document_type: { label: 'Identificación oficial' } };
        const financialResult = { amount: 12000, paymentCount: 12, paymentPeriod: 'quincenas', paymentPerPeriod: 1000, rate: 0, total: 12000, fund: 'Programa de prueba' };
        const base = { id: 'r1', affiliate_id: 'a1', folio: 'SOL-2026-001', nombre: 'María Fernanda López Hernández', numero_control: 'QA-001', program_id: 'nomina', program_item: { name: 'Programa de apoyo al afiliado' }, status: 'submitted', request_type: 'benefit', created_at: '2026-09-01', ts: 2, requested_amount: 12000, requested_term: 12, notes: 'Información original de la solicitud. '.repeat(12), documents_available: true, current_documents_available: true, request_documents: Array.from({ length: 8 }, (_, i) => ({ ...doc, id: 'doc' + i, affiliate_document_id: 'doc' + i })), current_affiliate_documents: [doc], financial_submission_snapshot: { financialResult }, financial_approval_snapshot: { financialResult }, terms_accepted: true, terms_available: true, terms_version: { title: 'Términos del programa', version: 1 }, admin_events_available: true, admin_events: Array.from({ length: 6 }, (_, i) => ({ id: 'event' + i, action: 'COMMENT', created_at: '2026-09-02', comment: 'Observación histórica preservada ' + i })), workflow_state: { available: true, current_stage: steps[0], stages: steps, workflow_name: 'Flujo de atención', workflow_version: 1 } };
        if (variant === 'quote') { base.request_type = 'quote'; base.financial_processing_status = null; }
        if (variant === 'loan' || variant === 'handoff') { base.program_id = 'prestamo'; base.financial_processing_status = 'pending'; }
        if (variant === 'handoff') { base.status = 'approved'; base.financial_processing_status = 'ready_for_handoff'; }
        if (variant === 'product') { base.financial_processing_status = 'pending'; base.financial_submission_snapshot = { contract_version: 'PROGRAM_PRODUCT_PAYMENT_V1', product: { name: 'Producto de prueba' }, authorized_price: 12000, financed_amount: 12000, term: 12, payment_schedule: { rows: [{ number: 1, date: '2026-09-15', payment: 1000 }] } }; }
        window.__rows = [base, { ...base, id: 'r2', folio: 'SOL-2026-002', nombre: 'Carlos Pérez', ts: 1 }];
        window.__deleteCalls=[];window.__deleteMode='success';window.__confirmDelete=true;
        window.AdminRequestDeletionRepository={preview:async id=>{const r=__rows.find(r=>r.id===id);return {request_id:id,folio:r.folio,updated_at:'2026-09-08',documents_count:r.request_documents.length,phase:'available'};},remove:async(...args)=>{__deleteCalls.push(args);if(__deleteMode==='error')throw Error('REQUEST_DELETE_GOOGLE_UNAVAILABLE');if(__deleteMode==='wait')await new Promise(resolve=>window.__finishDelete=resolve);__rows=__rows.filter(r=>r.id!==args[0].request_id);return{deleted:true};}};
        window.__calls = []; window.__confirmations = []; window.__failRead = false; window.__delay = 0;
        window.confirm = text => { __confirmations.push(text); return __confirmDelete; };
        const writer = name => async (...args) => { __calls.push({ name, args }); throw Error('ISOLATED_WRITE_BOUNDARY'); };
        window.ProgramRequestRepository = { listAdminFlowQueue: async () => __rows, adminFlowDetail: async id => { if (__delay) await new Promise(resolve => setTimeout(resolve, __delay)); if (__failRead) throw Error('ISOLATED_READ'); return __rows.find(r => r.id === id); }, newIdempotencyKey: () => 'fixture-key', recordAdminAction: writer('recordAdminAction'), transitionWorkflow: writer('transitionWorkflow'), approveProductPayment: writer('approveProductPayment') };
        window.FinancialLegacyRepository = { approveRequest: writer('approveRequest'), handoffRequest: writer('handoffRequest') };
        window.DocumentWorkflowRepository = { adminPreview: async () => ({ signedUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="#eadfe5"/><path d="M30 15h40v50H30z" fill="white"/><path d="M38 25h24M38 35h24M38 45h18" stroke="#901040"/></svg>'), expiresIn: 300 }) };
        window.__app = { admin: { has: permission => permission === 'documents.read' || writable } }; window.__onCount = () => {};
      }, { variant, writable });
      for (const file of ['app/private-resource-demand.js', 'app/image-viewer.jsx']) await page.addScriptTag({ content: read(file) });
      const source = before ? cp.execFileSync('git', ['show', 'ed19f77:app/screens-admin-finanzas.jsx'], { cwd: root, encoding: 'utf8' }) : read('app/screens-admin-finanzas.jsx');
      await page.addScriptTag({ content: source.replace('  function FinanzasModule(', '  window.__Workbench = DesktopFinancialWorkbench;\n  function FinanzasModule(') });
      await page.evaluate(() => { window.__root = ReactDOM.createRoot(document.getElementById('fixture')); __root.render(React.createElement(__Workbench, { app: __app, onCount: __onCount })); });
      await page.locator('[data-financial-queue-row]').first().waitFor();
      {
        assert.equal(await page.locator('dialog[open]').count(), 0, 'no automatic detail');
        await page.locator('[data-financial-queue-row]').first().click();
      }
      await page.waitForFunction(() => document.querySelectorAll('.finwb-doc img').length === 9 && [...document.querySelectorAll('.finwb-doc img')].every(i => i.complete && i.naturalWidth));
      return page;
    }
    const before = await fixture(true), page = await fixture();
    assert.deepEqual(await page.locator('.finwb-detail-scroll').textContent(), await before.locator('.finwb-detail-scroll').textContent(), 'all original detail content (layout whitespace excluded)');
    await before.close(); receipts.push({ case: 'exact visible content compared with released screen', status: 'PASS' });
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 667 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      for (const action of ['review', 'advance']) {
        await page.locator('.finwb-action-select').first().selectOption(action);
        const metrics = await page.evaluate(() => {
          const modal = document.querySelector('dialog'), scroll = modal.querySelector('.finwb-detail-scroll'), footer = modal.querySelector('.finwb-actionbar'), header = modal.querySelector('header');
          const initial = { header: header.getBoundingClientRect().top, footer: footer.getBoundingClientRect().top };
          scroll.scrollTop = scroll.scrollHeight;
          return { width: modal.getBoundingClientRect().width, overflow: modal.scrollWidth > modal.clientWidth || scroll.scrollWidth > scroll.clientWidth || document.documentElement.scrollWidth > innerWidth, scrolled: scroll.scrollTop > 0, centerHeight: scroll.clientHeight, locked: document.body.style.overflow === 'hidden', buttonsVisible: [...footer.querySelectorAll('button,select,textarea')].every(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), fixed: initial.header === header.getBoundingClientRect().top && initial.footer === footer.getBoundingClientRect().top };
        });
        assert(!metrics.overflow && metrics.scrolled && metrics.centerHeight > 50 && metrics.locked && metrics.buttonsVisible && metrics.fixed, JSON.stringify({ viewport, action, metrics }));
        if (viewport.width === 1440) assert(metrics.width >= 1440 * .85 && metrics.width <= 1440 * .90);
        receipts.push({ case: 'responsive sticky controls', viewport, action, ...metrics, status: 'PASS' });
      }
      await page.locator('.finwb-detail-scroll').evaluate(e => { e.scrollTop = 0; });
      await page.screenshot({ path: path.join(evidence, 'isolated-' + viewport.width + 'x' + viewport.height + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.finwb-note').fill('Borrador que debe conservarse');
    await page.getByRole('button', { name: 'Cerrar detalle de solicitud' }).click();
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-financial-queue-row')), 'r1');
    await page.locator('[data-financial-queue-row="r1"]').click();
    assert.equal(await page.locator('.finwb-note').inputValue(), 'Borrador que debe conservarse');
    await page.locator('[data-financial-detail-person]').click(); assert.equal(await page.locator('dialog[open]').count(), 1);
    const backgroundY = await page.evaluate(() => scrollY); await page.mouse.move(5, 500); await page.mouse.wheel(0, 800); await page.waitForTimeout(100); assert.equal(await page.evaluate(() => scrollY), backgroundY);
    for (let n = 0; n < 25; n++) { await page.keyboard.press('Tab'); assert(await page.evaluate(() => !!document.activeElement.closest('dialog')), 'focus escaped modal'); }
    await page.getByRole('button', { name: 'Ampliar', exact: true }).first().click(); await page.waitForSelector('[data-image-viewer]');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('[data-image-viewer]').count(), 0); assert.equal(await page.locator('dialog[open]').count(), 1); assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await page.locator('[data-financial-queue-row="r1"]').click();
    await page.getByRole('button', { name: 'Siguiente solicitud', exact: true }).click(); await page.waitForFunction(() => document.querySelector('dialog h2')?.textContent === 'Carlos Pérez');
    await page.getByRole('button', { name: 'Anterior', exact: true }).click(); await page.waitForFunction(() => document.querySelector('dialog h2')?.textContent.includes('María'));
    assert.equal(await page.evaluate(() => __calls.length), 0);
    receipts.push({ case: 'X, Escape, nested document viewer, draft retention, focus trap/restore, backdrop scroll lock, previous/next, zero writes', status: 'PASS' });
    await page.close();
    const quote = await fixture(false, 'quote');
    await quote.locator('.finwb-action-select').first().selectOption('quoteAdvance');
    for (const viewport of [{ width: 320, height: 667 }, { width: 768, height: 1024 }, { width: 844, height: 390 }]) {
      await quote.setViewportSize(viewport);
      assert(await quote.evaluate(() => {
        const center = document.querySelector('.finwb-detail-scroll'), footer = document.querySelector('.finwb-actionbar');
        return center.clientHeight > 50 && footer.scrollWidth <= footer.clientWidth && [...footer.querySelectorAll('button,input,select,textarea')].every(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; });
      }), 'quote inputs/controls overflow: ' + JSON.stringify(viewport));
    }
    await quote.evaluate(() => { __failRead = true; __delay = 200; });
    await quote.getByRole('button', { name: 'Siguiente solicitud', exact: true }).click();
    await quote.getByText('No fue posible cargar el detalle.', { exact: false }).waitFor();
    assert.equal(await quote.locator('.finwb-actionbar').count(), 1);
    await quote.getByRole('button', { name: 'Cerrar detalle de solicitud' }).click();
    assert.equal(await quote.locator('dialog[open]').count(), 0);
    receipts.push({ case: 'quote inputs on short/mobile/tablet viewports, read error navigation and close', status: 'PASS' });
    await quote.close();
    const readonly = await fixture(false, 'normal', false);
    assert.equal(await readonly.locator('[data-request-delete]').count(),0); assert.equal(await readonly.locator('.finwb-primary').count(), 0); await readonly.getByRole('button', { name: 'Siguiente solicitud', exact: true }).click(); await readonly.waitForFunction(() => document.querySelector('dialog h2')?.textContent === 'Carlos Pérez'); await readonly.close();
    for (const [variant, action, method] of [['normal', 'review', 'recordAdminAction'], ['normal', 'reject', 'transitionWorkflow'], ['normal', 'advance', 'transitionWorkflow'], ['normal', 'cancel', 'recordAdminAction'], ['normal', 'note', 'recordAdminAction'], ['quote', 'quoteAdvance', 'transitionWorkflow'], ['product', 'approveProduct', 'approveProductPayment'], ['loan', 'approveLoan', 'approveRequest'], ['handoff', 'handoff', 'handoffRequest']]) {
      const traces = [];
      for (const baseline of [true, false]) {
        const p = await fixture(baseline, variant);
        await p.locator('.finwb-action-select').first().selectOption(action);
        if (action !== 'handoff') await p.locator('.finwb-note').fill('Observación aislada');
        if (action === 'quoteAdvance') { await p.getByRole('spinbutton').fill('12000'); await p.getByLabel('Vigencia de la cotización').fill('2026-10-01'); }
        await p.locator('.finwb-primary').click(); await p.waitForFunction(() => __calls.length === 1);
        traces.push(await p.evaluate(() => ({ calls: __calls, confirmations: __confirmations })));
        await p.close();
      }
      assert.deepEqual(traces[1], traces[0], 'changed callback or confirmation: ' + action); assert.equal(traces[1].calls[0].name, method);
      receipts.push({ case: 'identical baseline callback and confirmation', action, method, status: 'PASS' });
    }
    const cancel=await fixture();
    await cancel.evaluate(()=>{__confirmDelete=false;});
    await cancel.locator('[data-request-delete]').click();
    await cancel.waitForFunction(()=>!document.querySelector('[data-request-delete]').disabled);
    assert.equal(await cancel.evaluate(()=>__deleteCalls.length),0);
    assert.equal(await cancel.locator('dialog[open]').count(),1);
    assert(await cancel.evaluate(()=>__confirmations.at(-1).includes('SOL-2026-001')&&__confirmations.at(-1).includes('8 documentos')&&__confirmations.at(-1).includes('Google')&&__confirmations.at(-1).includes('expediente')));
    await cancel.evaluate(()=>{__confirmDelete=true;__deleteMode='error';});
    await cancel.locator('[data-request-delete]').click();
    await cancel.locator('[data-financial-action-feedback="error"]').waitFor();
    assert.equal(await cancel.locator('dialog[open]').count(),1);
    assert.equal(await cancel.locator('[data-financial-current-documents] img').count(),1);
    assert.equal(await cancel.locator('[data-financial-queue-row]').count(),2);
    await cancel.evaluate(()=>{__deleteMode='wait';});
    await cancel.locator('[data-request-delete]').click();
    await cancel.waitForFunction(()=>typeof __finishDelete==='function');
    await cancel.keyboard.press('Escape');assert.equal(await cancel.locator('dialog[open]').count(),1);
    assert(await cancel.getByRole('button',{name:'Siguiente solicitud',exact:true}).isDisabled());
    await cancel.evaluate(()=>__finishDelete());
    await cancel.waitForFunction(()=>document.querySelectorAll('[data-financial-queue-row]').length===1);
    assert.equal(await cancel.locator('dialog[open]').count(),0);
    assert.equal(await cancel.evaluate(()=>__calls.length),0);
    assert.deepEqual(await cancel.evaluate(()=>__deleteCalls.map(c=>c[0].request_id)),['r1','r1']);
    await cancel.locator('[data-financial-queue-row="r2"]').click();
    await cancel.locator('[data-financial-current-documents] img').waitFor();
    assert.equal(await cancel.locator('[data-financial-documents] img').count(),8);
    await cancel.close();
    receipts.push({case:'confirmation cancel, error keeps dossier, busy/retry, selected request only, no approval calls',status:'PASS'});
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(evidence, 'isolated-browser.json'), JSON.stringify({ status: 'PASS', receipts, consoleErrors: errors, backendConnections: 0 }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'PASS', cases: receipts.length, evidence }));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
