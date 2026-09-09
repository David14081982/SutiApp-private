'use strict';
// Synthetic fixtures only. Actual screen, React and viewer; no backend connections.
const fs = require('fs'), path = require('path'), cp = require('child_process'), assert = require('assert').strict;
const { chromium } = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const evidence = path.join(root, 'docs/qa/evidence/finance-request-confirmation-20260908');
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
        window.__calls = []; window.__confirmations = []; window.__failRead = false; window.__delay = 0;
        window.confirm = text => { __confirmations.push(text); return true; };
        const writer = name => async (...args) => { __calls.push({ name, args }); throw Error('ISOLATED_WRITE_BOUNDARY'); };
        window.ProgramRequestRepository = { listAdminFlowQueue: async () => __rows, adminFlowDetail: async id => { if (__delay) await new Promise(resolve => setTimeout(resolve, __delay)); if (__failRead) throw Error('ISOLATED_READ'); return structuredClone(__rows.find(r => r.id === id)); }, newIdempotencyKey: () => 'fixture-key', recordAdminAction: writer('recordAdminAction'), transitionWorkflow: writer('transitionWorkflow'), approveProductPayment: writer('approveProductPayment') };
        window.FinancialLegacyRepository = { approveRequest: writer('approveRequest'), handoffRequest: writer('handoffRequest') };
        window.DocumentWorkflowRepository = { adminPreview: async () => ({ signedUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="#eadfe5"/><path d="M30 15h40v50H30z" fill="white"/><path d="M38 25h24M38 35h24M38 45h18" stroke="#901040"/></svg>'), expiresIn: 300 }) };
        window.__app = { admin: { has: permission => permission === 'documents.read' || writable } }; window.__onCount = () => {};
      }, { variant, writable });
      for (const file of ['app/private-resource-demand.js', 'app/image-viewer.jsx']) await page.addScriptTag({ content: read(file) });
      const source = before ? cp.execFileSync('git', ['show', 'c5e3a8f:app/screens-admin-finanzas.jsx'], { cwd: root, encoding: 'utf8' }) : read('app/screens-admin-finanzas.jsx');
      await page.addScriptTag({ content: source.replace('  function FinanzasModule(', '  window.__Workbench = DesktopFinancialWorkbench;\n  function FinanzasModule(') });
      await page.evaluate(() => { window.__root = ReactDOM.createRoot(document.getElementById('fixture')); __root.render(React.createElement(__Workbench, { app: __app, onCount: __onCount })); });
      await page.locator('[data-financial-queue-row]').first().waitFor();
      if (!before) {
        assert.equal(await page.locator('dialog[open]').count(), 0, 'no automatic detail');
        await page.locator('[data-financial-queue-row]').first().click();
      }
      await page.waitForFunction(() => document.querySelectorAll('.finwb-doc img').length === 9 && [...document.querySelectorAll('.finwb-doc img')].every(i => i.complete && i.naturalWidth));
      return page;
    }

    for (const [action, final, status] of [['advance',false,'in_review'],['advance',true,'approved'],['reject',false,'rejected'],['cancel',false,'cancelled'],['review',false,'in_review']]) {
      const page = await fixture();
      await page.evaluate(({ final }) => {
        const row=__rows[0];
        if(!final) row.workflow_state.stages[1].status_references=['in_review'];
        window.__committed=false; window.__reject=false;
        const writer=async (...args)=>{
          __calls.push(args); await new Promise(resolve=>setTimeout(resolve,350));
          if(__reject)throw Error('NETWORK_ERROR');
          const event={id:'new-event'};row.admin_events.push(event);
          const action=args[1];
          const destination=action==='REJECT'?row.workflow_state.stages[2]:row.workflow_state.stages[1];
          row.status=action==='REJECT'?'rejected':action==='CANCEL'?'cancelled':action==='MARK_IN_REVIEW'?'in_review':final?'approved':'in_review';
          row.workflow_state.current_stage=destination; __committed=true;
          return action==='CANCEL'||action==='MARK_IN_REVIEW'?event:{event};
        };
        ProgramRequestRepository.transitionWorkflow=writer;ProgramRequestRepository.recordAdminAction=writer;
      },{final});
      await page.locator('.finwb-action-select').first().selectOption(action);
      if(['reject','cancel'].includes(action))await page.locator('.finwb-note').fill('Motivo existente de prueba');
      await page.locator('.finwb-actionbar .finwb-primary').click();
      const modal=page.locator('[data-financial-confirmation]'); await modal.waitFor();
      assert.equal(await page.evaluate(()=>__calls.length),0,'no write before confirm');
      assert((await modal.textContent()).includes('SOL-2026-001'));
      await modal.getByRole('button',{name:'Volver',exact:true}).click();
      assert.equal(await page.evaluate(()=>__calls.length),0,'cancel has no write');
      await page.locator('.finwb-actionbar .finwb-primary').click();
      await page.evaluate(()=>{__reject=true;});
      await modal.locator('.finwb-primary').click();
      await modal.getByRole('alert').waitFor();
      assert.equal(await page.locator('[data-authorization-confetti]').count(),0,'no confetti on failure');
      assert.equal(await page.evaluate(()=>__rows[0].status),'submitted');
      await page.evaluate(()=>{__reject=false;});
      await modal.locator('.finwb-primary').evaluate(button=>{button.click();button.click();});
      assert.equal(await modal.getByRole('button',{name:'Procesando…'}).isDisabled(),true);
      assert.equal(await page.locator('[data-authorization-confetti]').count(),0,'no premature celebration');
      await page.locator('[data-financial-result]').waitFor();
      assert.equal(await page.evaluate(()=>__calls.length),2,'one failed request plus exactly one retry');
      assert.equal(await page.evaluate(()=>__rows[0].status),status);
      assert.equal(await page.locator('[data-authorization-confetti]').count(),final?1:0);
      assert.equal(await page.evaluate(()=>__confirmations.length),0);
      receipts.push({action,final,status:'PASS',doubleClick:'PASS',backendFailure:'PASS'});
      await page.close();
    }
    for (const [variant, action, method] of [['quote','quoteAdvance','transitionWorkflow'],['product','approveProduct','approveProductPayment'],['loan','approveLoan','approveRequest']]) {
      const page=await fixture(false,variant);
      await page.evaluate(({method})=>{
        const writer=async(...args)=>{__calls.push({method,args});await new Promise(resolve=>setTimeout(resolve,100));const row=__rows[0],event={id:'approval'};row.status='approved';row.workflow_state.current_stage=row.workflow_state.stages[1];row.admin_events.push(event);return{event};};
        if(method==='approveRequest')FinancialLegacyRepository[method]=writer;else ProgramRequestRepository[method]=writer;
      },{method});
      await page.locator('.finwb-action-select').first().selectOption(action);
      if(action==='quoteAdvance')await page.getByRole('spinbutton').fill('12000');
      await page.locator('.finwb-actionbar .finwb-primary').click();
      await page.locator('[data-financial-confirmation]').getByRole('button',{name:'Autorizar solicitud',exact:true}).click();
      await page.locator('[data-financial-result="authorized"]').waitFor();
      assert.equal(await page.locator('[data-authorization-confetti]').count(),1);
      assert.equal(await page.evaluate(()=>__calls.length),1);
      receipts.push({action,method,authorization:'PASS'});await page.close();
    }
    const mismatch=await fixture();
    await mismatch.evaluate(()=>{ProgramRequestRepository.transitionWorkflow=async()=>({event:{id:'not-persisted'}});});
    await mismatch.locator('.finwb-action-select').first().selectOption('advance');
    await mismatch.locator('.finwb-actionbar .finwb-primary').click();
    await mismatch.locator('[data-financial-confirmation] .finwb-primary').click();
    await mismatch.locator('[data-financial-confirmation]').getByRole('alert').waitFor();
    assert.equal(await mismatch.locator('[data-financial-result]').count(),0,'RPC response alone is not persistence evidence');
    receipts.push({readbackMismatch:'PASS'});await mismatch.close();
    const page=await fixture();
    await page.locator('.finwb-action-select').first().selectOption('advance');
    await page.locator('.finwb-actionbar .finwb-primary').click();
    for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:667},{width:844,height:390}]){
      await page.setViewportSize(viewport);
      const box=await page.locator('[data-financial-confirmation]').boundingBox();
      assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height,'responsive modal');
      for(let i=0;i<6;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('[data-financial-confirmation]')));}
      await page.screenshot({path:path.join(evidence,'confirmation-'+viewport.width+'.png')});
    }
    await page.keyboard.press('Escape'); assert.equal(await page.locator('[data-financial-confirmation]').count(),0);
    assert.equal(await page.locator('dialog[open]').count(),1,'Escape preserves detail'); await page.close();
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(evidence,'isolated-browser.json'),JSON.stringify({status:'PASS',receipts,errors,backendConnections:0},null,2));
    console.log(JSON.stringify({status:'PASS',cases:receipts.length}));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
