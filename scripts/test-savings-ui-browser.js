'use strict';
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidenceDir = path.join(root, 'docs', 'qa', 'evidence', 'savings-shadow-20260902');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function env() { const values = {}; for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) { const line = raw.trim(); if (!line || line.startsWith('#') || !line.includes('=')) continue; const at = line.indexOf('='); values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, ''); } return values; }
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)); }); }); }
async function wait(fn, timeout = 30000) { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (error) { last = error; } await sleep(150); } throw last || new Error('timeout'); }
function cdp(url, onEvent) { const socket = new WebSocket(url); let sequence = 0, readyResolve, readyReject; const pending = new Map(), ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; }); const fail = (error) => { readyReject(error); for (const item of pending.values()) item.reject(error); pending.clear(); }; socket.onopen = readyResolve; socket.onerror = () => fail(new Error('Chrome DevTools WebSocket error')); socket.onclose = () => fail(new Error('Chrome DevTools WebSocket closed')); socket.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); return; } if (message.method) onEvent(message.method, message.params || {}); }; return { ready, call(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000); pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); }); }, close() { socket.close(); } }; }

async function main() {
  const values = env();
  if (!values.H005_TEST_EMAIL || !values.H005_TEST_PASSWORD) throw new Error('H005_TEST credentials unavailable');
  const serverPort = await freePort(), debugPort = await freePort();
  const tempRoot = process.env.SUTIAPP_TEST_TMP || path.join(root, '.tmp');
  fs.mkdirSync(tempRoot, { recursive: true });
  const profile = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-savings-'));
  const server = spawn('python', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore', windowsHide: true });
  const chrome = spawn(chromePath, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-allow-origins=*', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let chromeError = '';
  chrome.stderr.on('data', (chunk) => { chromeError += String(chunk); });
  const requests = [], responses = [], browserErrors = []; let page;
  try {
    console.error('savings-ui: waiting for local server');
    await wait(async () => (await fetch(`http://127.0.0.1:${serverPort}/SutiApp.html`)).ok);
    console.error('savings-ui: waiting for Chrome DevTools');
    const target = await wait(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((item) => item.type === 'page'));
    page = cdp(target.webSocketDebuggerUrl, (method, params) => { if (method === 'Network.requestWillBeSent') requests.push({ url: params.request.url, method: params.request.method }); else if (method === 'Network.responseReceived') responses.push({ url: params.response.url, status: params.response.status }); else if (method === 'Network.loadingFailed') responses.push({ failed: true, error: params.errorText }); else if (method === 'Runtime.exceptionThrown') browserErrors.push(params.exceptionDetails && (params.exceptionDetails.exception && params.exceptionDetails.exception.description || params.exceptionDetails.text)); });
    await Promise.race([page.ready, sleep(30000).then(() => { throw new Error('Chrome DevTools websocket timeout'); })]);
    console.error('savings-ui: browser connected');
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await page.call(method);
    const evaluate = async (expression) => { const result = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception && result.exceptionDetails.exception.description || result.exceptionDetails.text); return result.result.value; };
    await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/SutiApp.html` });
    try { await wait(() => evaluate("Boolean(document.querySelector('input[type=email]'))")); }
    catch (error) { const boot = await evaluate("({url:location.href,readyState:document.readyState,title:document.title,body:document.body.innerText.slice(0,600),root:document.getElementById('root')&&document.getElementById('root').innerHTML.slice(0,600),bundle:Boolean(window.SavingsRepository),react:Boolean(window.React)})"); throw new Error(`login timeout ${JSON.stringify({ boot, browserErrors, requests, responses })}`); }
    console.error('savings-ui: logging in');
    await evaluate("document.querySelector('input[type=email]').focus()"); await page.call('Input.insertText', { text: values.H005_TEST_EMAIL });
    await evaluate("document.querySelector('input[type=password]').focus()"); await page.call('Input.insertText', { text: values.H005_TEST_PASSWORD });
    await evaluate("document.querySelector('button[type=submit]').click()");
    await wait(() => evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'&&Boolean(document.querySelector('[data-affiliate-field=topbar-name]'))"), 45000);
    console.error('savings-ui: authenticated');

    const fixture = {
      authority: 'SHADOW', cutover_status: 'NOT_CUTOVER', certified: true,
      participant: { id: 'p1', participant_type: 'AFFILIATE', identity_status: 'RESOLVED', certification_status: 'CERTIFIED', current_process: 'PROCESS_1', data_classification: 'SHADOW' },
      enrollment: { id: 'e1', sequence_number: 2, status: 'ACTIVE', enrollment_started_at: '2026-01-10T12:00:00Z', requested_at: '2026-01-10T12:00:00Z', approved_at: '2026-01-11T12:00:00Z', first_expected_contribution_date: '2026-01-15', first_actual_contribution_date: '2026-01-15', process_snapshot: 'PROCESS_1', current_contribution_amount: 350, frequency: 'TWICE_MONTHLY', yield_eligibility: 'NOT_ENABLED', continue_saving: true },
      balances: { capital: 43000, yield: 5315.2, total: 48315.2, held_capital: 500, held_yield: 0, held: 500, available: 47815.2 },
      annual: [{ year: 2026, capital: 7000, yield: 815.2, subtotal: 7815.2 }, { year: 2025, capital: 36000, yield: 4500, subtotal: 40500 }],
      history: [{ id: 't2', transaction_type: 'YIELD_CREDIT', component: 'YIELD', direction: 'CREDIT', amount: 815.2, effective_date: '2026-06-30' }, { id: 't1', transaction_type: 'CONTRIBUTION', component: 'CAPITAL', direction: 'CREDIT', amount: 350, effective_date: '2026-06-15' }],
      upcoming: [{ contribution_date: '2026-09-15', expected_amount: 350, process_snapshot: 'PROCESS_1' }, { contribution_date: '2026-09-30', expected_amount: 350, process_snapshot: 'PROCESS_1' }],
      beneficiaries: [{ id: 'b1', full_name: 'Persona Beneficiaria', relationship: 'Familiar', percentage: 100 }],
      requests: [{ id: 'r1', folio: 'AHO-2026-TEST0001', request_type: 'CHANGE_AMOUNT', status: 'UNDER_REVIEW', submitted_at: '2026-08-30T12:00:00Z' }],
      actions: { JOIN: false, CHANGE_AMOUNT: true, WITHDRAW: true, TERMINATE: true },
    };
    await evaluate(`(()=>{const fixture=${JSON.stringify(fixture)};window.__savingsTest={loads:0,submissions:[],beneficiaries:[]};window.SavingsRepository=Object.freeze({getSelfDashboard:async()=>{window.__savingsTest.loads++;return structuredClone(fixture);},submitRequest:async(v)=>{window.__savingsTest.submissions.push(v);return {id:'test'};},replaceBeneficiaries:async(v)=>{window.__savingsTest.beneficiaries.push(v);return {version_number:2};}});window.savingsStore.clearSelf();})()`);
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Finanzas').click()");
    await wait(() => evaluate("Boolean(document.querySelector('[data-finance-summary-actions]'))"), 45000);
    const requestStart = requests.length;
    await evaluate("document.querySelector('[data-finance-summary-action=ahorro]').click()");
    await wait(() => evaluate("Boolean(document.querySelector('[data-savings-screen][data-savings-authority=SHADOW]'))"));
    console.error('savings-ui: savings screen loaded');
    const snapshot = () => evaluate(`(()=>{const root=document.querySelector('[data-savings-screen]'),total=document.querySelector('[data-savings-total]'),summary=document.querySelector('.sav-balance-summary');return{screen:Boolean(root),authority:root&&root.dataset.savingsAuthority,cutover:root&&root.dataset.savingsCutover,total:total&&Number(total.dataset.savingsTotal),summaryOnly:Boolean(summary)&&summary.children.length===2&&!summary.querySelector('.sav-split,[data-savings-capital],[data-savings-yield]'),summaryCentered:Boolean(summary)&&getComputedStyle(summary).textAlign==='center',years:document.querySelectorAll('[data-savings-year]').length,upcoming:document.querySelectorAll('[data-savings-upcoming] .sav-next').length,history:document.querySelectorAll('[data-savings-history] .sav-tx').length,actions:document.querySelectorAll('[data-savings-action]').length,sections:['Saldo actual total','Detalle por año','Mi inscripción','Próximos descuentos','Historial'].every(text=>root.innerText.includes(text)),horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth&&root.scrollWidth<=root.clientWidth,scrollable:document.querySelector('.sav-scroll').scrollHeight>document.querySelector('.sav-scroll').clientHeight};})()`);
    const initial = await snapshot();
    if (!(initial.screen && initial.authority === 'SHADOW' && initial.cutover === 'NOT_CUTOVER' && initial.total === 48315.2 && initial.summaryOnly && initial.summaryCentered && initial.years === 2 && initial.upcoming === 2 && initial.history === 2 && initial.actions === 3 && initial.sections && initial.horizontal && initial.scrollable)) throw new Error('SAVINGS_VISUAL_CONTRACT_FAILED ' + JSON.stringify(initial));

    await evaluate("document.querySelector('[data-savings-action=CHANGE_AMOUNT]').click()");
    await wait(() => evaluate("Boolean(document.querySelector('.sav-sheet[aria-label=\"Modificar monto\"]'))"));
    await evaluate(`(()=>{const sheet=document.querySelector('.sav-sheet');const amount=sheet.querySelector('input[type=number]'),day=sheet.querySelector('input[type=date]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(amount,'500');amount.dispatchEvent(new Event('input',{bubbles:true}));amount.dispatchEvent(new Event('change',{bubbles:true}));setter.call(day,'2026-10-15');day.dispatchEvent(new Event('input',{bubbles:true}));day.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await sleep(100);
    await evaluate("[...document.querySelectorAll('.sav-sheet button')].find(button=>button.textContent.includes('Enviar solicitud')).click()");
    await wait(() => evaluate("window.__savingsTest.submissions.length===1&&!document.querySelector('.sav-sheet')"));
    const submitted = await evaluate("window.__savingsTest.submissions[0]");
    if (!(submitted.requestType === 'CHANGE_AMOUNT' && Number(submitted.newContributionAmount) === 500 && submitted.effectiveFrom === '2026-10-15')) throw new Error('CHANGE_AMOUNT_FLOW_FAILED ' + JSON.stringify(submitted));

    await evaluate("document.querySelector('[data-savings-action=WITHDRAW]').click()");
    await wait(() => evaluate("Boolean(document.querySelector('.sav-sheet[aria-label=Retirar]'))"));
    await evaluate("(()=>{const select=document.querySelector('.sav-sheet select'),setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(select,'TOTAL');select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await sleep(100);
    await evaluate("[...document.querySelectorAll('.sav-sheet button')].find(button=>button.textContent.includes('Enviar solicitud')).click()");
    await wait(() => evaluate("window.__savingsTest.submissions.length===2&&!document.querySelector('.sav-sheet')"));
    const totalWithdrawal = await evaluate("window.__savingsTest.submissions[1]");
    if (!(totalWithdrawal.requestType === 'WITHDRAW' && totalWithdrawal.withdrawalKind === 'TOTAL' && totalWithdrawal.component === 'CAPITAL' && Number(totalWithdrawal.amount) === 42500)) throw new Error('TOTAL_WITHDRAWAL_FLOW_FAILED ' + JSON.stringify(totalWithdrawal));

    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Beneficiarios').click()");
    await wait(() => evaluate("Boolean(document.querySelector('.sav-sheet[aria-label=Beneficiarios]'))"));
    const beneficiaryTotal = await evaluate("document.querySelector('.sav-sheet').innerText.includes('Total asignado: 100.00%')");
    if (!beneficiaryTotal) throw new Error('BENEFICIARY_TOTAL_NOT_VISIBLE');
    await evaluate("[...document.querySelectorAll('.sav-sheet button')].find(button=>button.textContent.includes('Guardar versión')).click()");
    await wait(() => evaluate("window.__savingsTest.beneficiaries.length===1&&!document.querySelector('.sav-sheet')"));
    await sleep(3600);

    const responsive = {}; fs.mkdirSync(evidenceDir, { recursive: true });
    for (const viewport of [[390, 844], [430, 932], [1366, 900]]) {
      await page.call('Emulation.setDeviceMetricsOverride', { width: viewport[0], height: viewport[1], deviceScaleFactor: 1, mobile: viewport[0] < 600 }); await sleep(160);
      const key = viewport.join('x'); responsive[key] = await snapshot(); if (!responsive[key].horizontal) throw new Error('SAVINGS_HORIZONTAL_OVERFLOW_' + key);
      const shot = await page.call('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(evidenceDir, 'savings-' + key + '.png'), Buffer.from(shot.data, 'base64'));
    }
    const screenRequests = requests.slice(requestStart); const forbiddenWrites = screenRequests.filter((item) => /supabase\.co\/rest\/v1\/(?:savings_|rpc\/[^?]*savings)/i.test(item.url) && /POST|PUT|PATCH|DELETE/i.test(item.method));
    if (forbiddenWrites.length) throw new Error('UNEXPECTED_REAL_SAVINGS_WRITE ' + JSON.stringify(forbiddenWrites));
    await evaluate("document.querySelector('.sav-back').click()"); await wait(() => evaluate("!document.querySelector('[data-savings-screen]')&&Boolean(document.querySelector('[data-finance-summary-actions]'))"));
    const adminFixture = {
      authority: 'SHADOW', cutover_status: 'NOT_CUTOVER', yield_productive_enabled: false,
      kpis: { active_enrollments: 1, capital_total: 43000, yield_total: 5315.2, balance_total: 48315.2, held_total: 500, pending_withdrawals: 1, pending_amount_changes: 1, process_reviews: 1, ambiguous_identity: 5, orphan_identity: 1 },
      participants: [{ id: 'p1', affiliate_id: '11111111-1111-4111-8111-111111111111', legacy_folio: '10001', display_name: 'Persona de prueba', participant_type: 'AFFILIATE', identity_status: 'RESOLVED', certification_status: 'CERTIFIED', current_process: 'PROCESS_1', process_source: 'SHADOW', data_classification: 'SHADOW', legacy_reported_balance: 48315.2, capital: 43000, yield: 5315.2, total: 48315.2, held: 500, available: 47815.2, legacy_balance_status: 'MATCH', enrollment_id: 'e1', enrollment_status: 'ACTIVE', sequence_number: 2, enrollment_started_at: '2026-01-10T12:00:00Z', first_expected_contribution_date: '2026-01-15', first_actual_contribution_date: '2026-01-15', process_snapshot: 'PROCESS_1', current_contribution_amount: 350, frequency: 'TWICE_MONTHLY' }],
      contributions: [{ id: 'o1', contribution_date: '2026-08-31', expected_amount: 350, actual_amount: 350, version_number: 1, reason: 'Cierre validado', editor_auth_user_id: 'admin', created_at: '2026-08-31T12:00:00Z' }],
      history: [{ id: 't1', effective_date: '2026-08-31', transaction_type: 'CONTRIBUTION', component: 'CAPITAL', direction: 'CREDIT', amount: 350, data_classification: 'SHADOW', created_at: '2026-08-31T12:00:00Z' }],
      calendar: [{ contribution_date: '2026-09-15', expected_amount: 350, process_snapshot: 'PROCESS_1', plan_id: 'plan1' }],
      amount_changes: [], withdrawals: [], terminations: [], beneficiaries: [], yield_periods: [], omissions: [], holds: [],
      process_changes: [{ id: 'pc1', legacy_folio: '10001', old_process: 'PROCESS_1', new_process: 'JUB', status: 'SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED', current_plan_snapshot: { amount: 350, process_snapshot: 'PROCESS_1' }, reason: 'Cambio detectado desde Admin Afiliados', created_at: '2026-09-01T12:00:00Z' }],
      pending_identity: [{ id: 'p-pending', legacy_folio: '10002', participant_type: 'LEGACY_UNRESOLVED', identity_status: 'AMBIGUOUS', certification_status: 'PENDING_REVIEW', data_classification: 'LEGACY', possible_matches_count: 2, financial_record_exists: true }], documents: [], reports: [], audit: [], configuration: [],
    };
    await evaluate("(()=>{const fixture=" + JSON.stringify(adminFixture) + ";window.SavingsRepository=Object.freeze({getAdminDashboard:async()=>structuredClone(fixture)});const host=document.createElement('div');host.id='savings-admin-test';host.style.cssText='position:fixed;inset:0;z-index:9999;background:#f3f5f8;overflow:auto';document.body.appendChild(host);window.__savingsAdminRoot=ReactDOM.createRoot(host);const app={admin:{has:()=>true},toast:()=>{}};const header=(p)=>React.createElement('header',{style:{padding:'14px 18px',background:'#8f002b',color:'#fff'}},React.createElement('strong',null,p.title+' · '+p.sub));window.__savingsAdminRoot.render(React.createElement(window.SavingsAdminModule,{app,onBack:()=>{},header,initialAffiliateId:null}));})()");
    await wait(() => evaluate("document.querySelector('[data-admin-savings=ready]')&&document.querySelectorAll('[data-savings-admin-tab]').length===17"));
    const adminInitial = await evaluate("(()=>{const root=document.querySelector('#savings-admin-test');return{authority:root.querySelector('[data-admin-savings]').dataset.savingsAuthority,cutover:root.querySelector('[data-admin-savings]').dataset.savingsCutover,tabs:root.querySelectorAll('[data-savings-admin-tab]').length,kpis:root.querySelectorAll('.sava-kpi').length,participants:root.querySelectorAll('.sava-person').length,summary:root.innerText.includes('Movimientos recientes'),googleAuthority:root.innerText.includes('Google continúa como autoridad histórica/productiva.')};})()");
    if (!(adminInitial.authority === 'SHADOW' && adminInitial.cutover === 'NOT_CUTOVER' && adminInitial.tabs === 17 && adminInitial.kpis === 10 && adminInitial.participants === 1 && adminInitial.summary && adminInitial.googleAuthority)) throw new Error('ADMIN_SAVINGS_CONTRACT_FAILED ' + JSON.stringify(adminInitial));
    await evaluate("document.querySelector('[data-savings-admin-tab=process]').click()");
    await wait(() => evaluate("document.querySelector('#savings-admin-test').innerText.includes('Admin Afiliados aparecen automáticamente')&&document.querySelector('#savings-admin-test').innerText.includes('Descartar')"));
    await evaluate("document.querySelector('[data-savings-admin-tab=identity]').click()");
    await sleep(300);
    const identityState = await evaluate("(()=>{const root=document.querySelector('#savings-admin-test');return{text:root.innerText.slice(-2000),active:root.querySelector('[data-savings-admin-tab=identity]').getAttribute('aria-current'),rows:root.querySelectorAll('.sava-table tbody tr').length};})()");
    const identityText = identityState.text.toLocaleLowerCase('es');
    adminInitial.identityMinimum = identityText.includes('coincidencias exactas') && identityText.includes('expediente financiero') && identityText.includes('10002') && !identityText.includes('nombre legacy');
    if (!adminInitial.identityMinimum) throw new Error('ADMIN_SAVINGS_IDENTITY_MINIMUM_FAILED ' + JSON.stringify(identityState));
    await evaluate("document.querySelector('[data-savings-admin-tab=config]').click()");
    await wait(() => evaluate("document.querySelectorAll('#savings-admin-test .sava-setting').length===8"));
    const adminShot = await page.call('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(evidenceDir, 'savings-admin-1366x900.png'), Buffer.from(adminShot.data, 'base64'));
    await evaluate("window.__savingsAdminRoot.unmount();document.querySelector('#savings-admin-test').remove()");
    console.log(JSON.stringify({ status: 'PASS', initial, submitted, totalWithdrawal, beneficiaryTotal, responsive, admin: adminInitial, forbiddenWrites, back: true }, null, 2));
  } finally {
    if (chromeError.trim()) console.error(chromeError.trim().slice(-4000));
    if (page) page.close(); chrome.kill(); server.kill(); await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); } catch (_) {}
  }
}
main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.stack || error.message })); process.exitCode = 1; });
