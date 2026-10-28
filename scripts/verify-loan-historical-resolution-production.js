'use strict';
/* Focal authorized production verification. No loan submissions or business edits.
 * node scripts/verify-loan-historical-resolution-production.js --self-test
 * node scripts/verify-loan-historical-resolution-production.js --run [--target=https://sutiapp.com/]
 * Credentials are read only from the workspace supabase.env. Never log/store tokens.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const H = 'H-LOAN-HISTORICAL-FUND-RESOLUTION-COMPLETE-001';
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const option = (name) => process.argv.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
const uuid = (value) => { assert(/^[0-9a-f-]{36}$/i.test(String(value)), 'INVALID_UUID'); return String(value); };
function workspaceRoot() {
  let directory = root;
  while (true) {
    if (fs.existsSync(path.join(directory, 'supabase.env'))) return directory;
    const parent = path.dirname(directory); if (parent === directory) throw Error('WORKSPACE_ENV_MISSING'); directory = parent;
  }
}
function loadEnv(workspace) {
  const values = {};
  for (const raw of fs.readFileSync(path.join(workspace, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim(), at = line.indexOf('=');
    if (at > 0 && !line.startsWith('#')) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  for (const key of ['H005_TEST_EMAIL', 'H005_TEST_PASSWORD', 'SUPABASE_URL', 'SUPABASE_ACCESS_TOKEN']) assert(values[key], 'REQUIRED_WORKSPACE_CONFIG_MISSING_' + key);
  return values;
}
function blockedMutationReason(url, method, body) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return null;
  const pathname = new URL(url).pathname;
  if (/\/auth\/v1\/(token|logout)$/.test(pathname)) return null;
  const rpc = pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  if (rpc) {
    if (['start_affiliate_impersonation', 'stop_affiliate_impersonation'].includes(rpc)) return null;
    return /^(get_|list_|search_|resolve_|is_|has_|can_|check_|preview_)/.test(rpc) ? null : 'RPC_MUTATION_BLOCKED_' + rpc;
  }
  if (/\/rest\/v1\//.test(pathname)) return 'TABLE_MUTATION_BLOCKED';
  if (/\/storage\/v1\//.test(pathname)) return /\/object\/sign\//.test(pathname) ? null : 'STORAGE_MUTATION_BLOCKED';
  const edge = pathname.match(/\/functions\/v1\/([^/]+)$/)?.[1];
  if (edge) {
    let payload; try { payload = JSON.parse(body || '{}'); } catch (_) { return 'EDGE_BODY_INVALID'; }
    if (edge === 'financial-legacy') return ['overview', 'loanSessionOpen', 'loanSessionValidate', 'loanSessionQuote', 'quote'].includes(payload.action) ? null : 'FINANCIAL_MUTATION_BLOCKED';
    if (edge === 'loan-history') return ['LOAD', 'SUMMARY', 'DETAIL', 'APPROVALS'].includes(payload.action) ? null : 'HISTORY_MUTATION_BLOCKED';
    if (edge === 'document-access') return null; // Existing read-only signed document access/audit.
    return 'UNEXPECTED_EDGE_BLOCKED_' + edge;
  }
  return 'UNEXPECTED_POST_BLOCKED';
}
function expectedAssets() {
  const html = fs.readFileSync(path.join(root, 'SutiApp.html'), 'utf8'), worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const bundle = /src="(app\/bundle\.js\?v=[^"]+)"/.exec(html)?.[1];
  const repository = /src="(app\/financial-legacy-repository\.js\?v=[^"]+)"/.exec(html)?.[1];
  const serviceWorker = /serviceWorkerUrl\s*=\s*"\.\/(sw\.js\?v=[^"]+)"/.exec(html)?.[1];
  const cache = /const CACHE = '([^']+)'/.exec(worker)?.[1];
  assert(bundle && repository && serviceWorker && cache, 'LOCAL_ASSET_VERSION_CONTRACT_MISSING');
  assert(worker.includes("'./" + bundle + "'") && worker.includes("'./" + repository + "'"), 'LOCAL_SW_CORE_VERSION_MISMATCH');
  assert.equal(cache, 'sutiapp-v' + new URL(serviceWorker, 'https://local.invalid/').searchParams.get('v'), 'LOCAL_SW_CACHE_VERSION_MISMATCH');
  const bundleBytes = fs.readFileSync(path.join(root, 'app/bundle.js'));
  assert(bundleBytes.includes('HISTORICAL_LOAN_MAPPING_REQUIRED') && bundleBytes.includes('NO_CREDIT_AVAILABLE'), 'LOCAL_BUNDLE_MISSING_CORRECTION');
  return { bundle: { source: bundle, sha256: sha(bundleBytes) }, repository: { source: repository, sha256: sha(fs.readFileSync(path.join(root, 'app/financial-legacy-repository.js'))) }, serviceWorker: { source: serviceWorker, sha256: sha(worker) }, cache };
}
async function managementRead(values, query) {
  assert(/^select\b/i.test(query.trim()), 'READ_ONLY_QUERY_REQUIRED');
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + values.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, 'READ_ONLY_PREFLIGHT_HTTP_' + response.status);
  return response.json();
}
async function guardNoActiveAssistance(values, actor) {
  const result = await managementRead(values, "select count(*)::int as active_sessions from public.impersonation_sessions where actor_real_auth_user_id='" + uuid(actor) + "'::uuid and ended_at is null and expires_at>now()");
  assert.equal(Number(result[0]?.active_sessions), 0, 'EXISTING_OPERATOR_ASSISTANCE_MUST_NOT_BE_INTERRUPTED');
}
async function verifyAssets(page, expected, swMode) {
  const actual = await page.evaluate(async () => {
    const hash = async (url) => {
      const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw Error('PUBLIC_ASSET_HTTP_' + response.status);
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer())), (byte) => byte.toString(16).padStart(2, '0')).join('');
    };
    const bundle = document.querySelector('script[src*="app/bundle.js?v="]');
    const repository = document.querySelector('script[src*="app/financial-legacy-repository.js?v="]');
    if (!bundle || !repository) throw Error('PUBLIC_ASSET_TAG_MISSING');
    const worker = /serviceWorkerUrl\s*=\s*"\.\/(sw\.js\?v=[^"]+)"/.exec(document.documentElement.innerHTML)?.[1];
    if (!worker) throw Error('PUBLIC_SW_TAG_MISSING');
    return { bundle: { source: bundle.getAttribute('src'), sha256: await hash(bundle.src) },
      repository: { source: repository.getAttribute('src'), sha256: await hash(repository.src) },
      serviceWorker: { source: worker, sha256: await hash(new URL(worker, location.href)) },
      controlled: !!navigator.serviceWorker?.controller, caches: await caches.keys() };
  });
  for (const key of ['bundle', 'repository', 'serviceWorker']) assert.deepEqual(actual[key], expected[key], 'PUBLISHED_' + key.toUpperCase() + '_MISMATCH');
  if (swMode === 'allow') {
    assert(actual.controlled, 'SERVICE_WORKER_NOT_CONTROLLING');
    assert(actual.caches.includes(expected.cache), 'EXPECTED_SW_CACHE_MISSING');
  } else assert.equal(actual.controlled, false, 'UNEXPECTED_SERVICE_WORKER_CONTROL');
  return { status: 'PASS', bundleSha256: actual.bundle.sha256, repositorySha256: actual.repository.sha256, serviceWorkerSha256: actual.serviceWorker.sha256, serviceWorkerControlled: actual.controlled, expectedCachePresent: actual.caches.includes(expected.cache) };
}
async function assertTargetContext(page, actor, targetId) {
  const proof = await page.evaluate(async ({ actor, targetId }) => {
    const auth = window.AffiliateAuth.getState(), context = auth.impersonation;
    const effective = await window.SutiSupabase.getClient().rpc('get_effective_affiliate_id');
    return { actorUnchanged: auth.session?.user?.id === actor, targetExact: auth.affiliate?.id === targetId && String(auth.affiliate?.numero_control) === '12087',
      actorSeparate: actor !== auth.affiliate?.auth_user_id, effectiveMatches: !effective.error && effective.data === targetId,
      auditedContext: context?.actor_real_auth_user_id === actor && context?.usuario_contexto_affiliate_id === targetId };
  }, { actor, targetId });
  for (const [key, value] of Object.entries(proof)) assert.equal(value, true, 'CONTEXT_' + key.toUpperCase() + '_FAILED');
  return proof;
}
async function readProjectionAndQuote(page) {
  const result = await page.evaluate(async () => {
    const store = window.financialLegacyStore, opened = await store.ensureLoanSession();
    if (opened.status !== 'ready' || !opened.overview || !opened.loanSession) return { status: 'FAIL', code: opened.error || 'OVERVIEW_UNAVAILABLE' };
    const programs = opened.overview.programs.filter((item) => item.status === 'AVAILABLE');
    const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    const cents = (value) => Math.round(value * 100);
    const contract = programs.every((p) => [p.available_amount, p.max_amount, p.pending_amount, p.reserved_amount].every(finite) && p.available_amount <= p.max_amount);
    const formula = contract && programs.every((p) => cents(p.available_amount) === (['GLOBAL', 'INDIVIDUAL'].includes(p.capacity_exemption) ? cents(p.max_amount) : Math.max(0, cents(p.max_amount) - cents(p.pending_amount) - cents(p.reserved_amount))));
    const projection = programs.map((p) => ({ id: p.id, fund: p.fund, label: p.label, min_amount: p.min_amount, max_amount: p.max_amount,
      available_amount: p.available_amount, pending_amount: p.pending_amount, reserved_amount: p.reserved_amount,
      active_loans: p.active_loans, capacity_exemption: p.capacity_exemption, rate: p.rate, rate_period: p.rate_period,
      payment_period: p.payment_period, allowed_terms: p.allowed_terms, custom_term: p.custom_term })).sort((a, b) => a.id.localeCompare(b.id));
    const quotes = [];
    for (const program of programs.filter((p) => p.available_amount > 0 && p.available_amount >= Number(p.min_amount))) {
      const amount = Math.min(program.available_amount, Math.max(Number(program.min_amount), Number(program.suggested_amount) || Number(program.min_amount)));
      const term = program.allowed_terms?.find((value) => Number.isInteger(value) && value > 0) || Number(program.custom_term.min);
      const snapshot = await store.requestLoanSessionQuote(program.id, amount, term);
      if (snapshot.status !== 'ready' || !snapshot.quote) return { status: 'FAIL', code: snapshot.error || 'QUOTE_UNAVAILABLE' };
      const quote = snapshot.quote;
      if (!window.FinancialLegacyRepository.validateFinancialSimulationResult(quote) || quote.amount !== amount || quote.paymentCount !== term || quote.fund !== program.fund || quote.googleResolutionCount !== 0) return { status: 'FAIL', code: 'REAL_QUOTE_CONTRACT_MISMATCH' };
      quotes.push({ fund: quote.fund, amount: quote.amount, paymentCount: quote.paymentCount, rate: quote.rate,
        paymentPerPeriod: quote.paymentPerPeriod, interest: quote.interest, administrativeFeeTotal: quote.administrativeFeeTotal, total: quote.total });
    }
    return { status: 'PASS', contract, formula, source: opened.overview.source, sourceVersion: opened.overview.capacity_source_version,
      projection, quotes, totalMatches: window.FinancialLegacyRepository.availableCreditTotal(opened.overview) === programs.reduce((total, p) => total + cents(p.available_amount), 0) / 100 };
  });
  assert.equal(result.status, 'PASS', 'PROJECTION_OR_QUOTE_FAILED_' + (result.code || 'UNKNOWN'));
  assert(result.projection.length > 0 && result.quotes.length > 0, '12087_REQUESTABLE_FUNDS_MISSING');
  for (const field of ['contract', 'formula', 'totalMatches']) assert.equal(result[field], true, 'PROJECTION_' + field.toUpperCase() + '_FAILED');
  return result;
}
async function navigateAndVerifyLoan(page) {
  const promoClose = page.locator('div[style*="z-index: 90"] button[aria-label="Cerrar"]:visible');
  if (await promoClose.count()) await promoClose.first().click();
  await page.locator('[data-app-tab="financiera"]').click();
  await page.locator('[data-finance-summary-action="prestamo"]').click();
  await page.locator('[data-loan-funds]').waitFor({ state: 'visible', timeout: 60000 });
  const cards = await page.evaluate(() => {
    const programs = window.financialLegacyStore.snapshot().overview.programs.filter((p) => p.status === 'AVAILABLE');
    const expected = programs.map((p) => p.available_amount).sort((a, b) => a - b);
    const actual = Array.from(document.querySelectorAll('[data-fund-available]'), (node) => Number(node.dataset.fundAvailable)).sort((a, b) => a - b);
    const positive = programs.find((p) => p.available_amount > 0 && p.available_amount >= Number(p.min_amount));
    const buttons = Array.from(document.querySelectorAll('[data-loan-funds] button'));
    const match = positive && buttons.filter((button) => button.textContent.includes(positive.label || positive.fund) && Number(button.querySelector('[data-fund-available]')?.dataset.fundAvailable) === positive.available_amount);
    if (!match || match.length !== 1) throw Error('POSITIVE_FUND_CARD_NOT_UNIQUE');
    match[0].click();
    return { count: actual.length, match: JSON.stringify(actual) === JSON.stringify(expected), fourSteps: /Monto[\s\S]*Depósito[\s\S]*Documentos[\s\S]*Resumen/.test(document.querySelector('[data-loan-flow-step]')?.textContent || '') };
  });
  assert(cards.match && cards.fourSteps, 'LOAN_CARDS_OR_FLOW_MISMATCH');
  await page.waitForFunction(() => document.querySelector('[data-step-simulator-v2]')?.dataset.state === 'READY' && !document.querySelector('[data-loan-flow-footer] button')?.disabled, null, { timeout: 60000 });
  const ui = await page.evaluate(() => {
    const quote = window.financialLegacyStore.snapshot().quote, card = document.querySelector('[data-simulator-result]');
    const label = card?.querySelector('.su-result-payment [role="img"]')?.getAttribute('aria-label');
    return { ready: card?.dataset.simulatorResult === 'ready', priceMatchesServer: !!quote && label === window.money(quote.paymentPerPeriod, { dec: 2 }).replace(/\.00$/, ''),
      noPendingWheels: card?.querySelectorAll('[data-odometer-state="spinning"]').length === 0,
      noErrorNotice: !document.querySelector('[data-simulator-state="ERROR"],[data-simulator-state^="HISTORICAL_LOAN_"]'),
      continueEnabled: !document.querySelector('[data-loan-flow-footer] button').disabled,
      notUpdating: !document.querySelector('[data-loan-flow-footer]').textContent.includes('Actualizando'),
      exactControlBanner: document.querySelector('[data-impersonation-active]')?.textContent.includes('12087') === true };
  });
  for (const [key, value] of Object.entries(ui)) assert.equal(value, true, 'UI_' + key.toUpperCase() + '_FAILED');
  return { ...cards, ...ui };
}
async function main() {
  assert(process.argv.includes('--run'), 'EXPLICIT_RUN_REQUIRED_AFTER_PUBLICATION');
  const workspace = workspaceRoot(), values = loadEnv(workspace), expected = expectedAssets();
  const privateDir = path.join(workspace, '.tmp/loan-historical-resolution/production-verification');
  const evidenceDir = path.join(root, 'docs/qa/evidence/loan-historical-resolution');
  fs.mkdirSync(privateDir, { recursive: true }); fs.mkdirSync(evidenceDir, { recursive: true });
  const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
  const targets = option('target') ? [option('target')] : ['https://sutiapp.com/', 'https://david14081982.github.io/SutiApp-private/'];
  for (const target of targets) assert(/^https:\/\/(sutiapp\.com|david14081982\.github\.io)\//.test(target), 'UNEXPECTED_PRODUCTION_TARGET');
  const runId = new Date().toISOString().replace(/[:.]/g, '-'), reason = H + ': verificacion autorizada de fondos 12087, solo lectura; ' + runId;
  const report = { status: 'FAIL', checkedAt: new Date().toISOString(), targetControl: '12087', cases: [], requestSubmissions: 0, businessDataWrites: 0, financialBalancesChanged: 0, historicalRowsModified: 0, administrativeSessionsStarted: 0, administrativeSessionsEnded: 0, snapshots: 'Existing ephemeral loan sessions only' };
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-dev-shm-usage'] });
  const completed = new Map(); let expectedProjection = null, expectedSourceVersion = null, stage = 'start';
  try {
    for (const target of targets) for (const swMode of ['allow', 'block']) {
      const row = { target, serviceWorkers: swMode, status: 'FAIL' }; report.cases.push(row);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: swMode, reducedMotion: 'reduce' });
      const page = await context.newPage(), runtimeErrors = [], blockedWrites = []; let actor = null, targetId = null, sessionId = null, startAttempted = false;
      page.setDefaultTimeout(45000);
      page.on('pageerror', () => runtimeErrors.push('BROWSER_RUNTIME_ERROR'));
      await context.exposeBinding('__recordLoanBlockedWrite', (_, code) => { blockedWrites.push(String(code)); });
      await context.addInitScript({ content: '(' + function (guard) {
        const original = window.fetch.bind(window);
        window.__loanVerificationBlockedWrites = [];
        window.fetch = async function (input, init) {
          const request = new Request(input, init), body = ['GET', 'HEAD'].includes(request.method) ? '' : await request.clone().text();
          const blocked = guard(request.url, request.method, body);
          if (blocked) { window.__loanVerificationBlockedWrites.push(blocked); await window.__recordLoanBlockedWrite(blocked); throw Error(blocked); }
          return original(request);
        };
      }.toString() + ')(' + blockedMutationReason.toString() + ');' });
      try {
        stage = 'navigate-' + swMode;
        await page.goto(target, { waitUntil: 'domcontentloaded' });
        assert(['sutiapp.com', 'david14081982.github.io'].includes(new URL(page.url()).hostname), 'UNEXPECTED_PRODUCTION_REDIRECT');
        row.finalOrigin = new URL(page.url()).origin; row.redirected = row.finalOrigin !== new URL(target).origin;
        if (swMode === 'allow') await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 60000 });
        row.assets = await verifyAssets(page, expected, swMode);
        const key = row.finalOrigin + new URL(page.url()).pathname + ':' + swMode;
        if (completed.has(key)) { row.status = 'PASS'; row.reusesVerifiedCanonicalOrigin = true; continue; }
        stage = 'login-' + swMode;
        await page.locator('input[type="email"]').fill(values.H005_TEST_EMAIL);
        await page.locator('input[type="password"]').fill(values.H005_TEST_PASSWORD);
        await page.locator('button[type="submit"]').click();
        await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated', null, { timeout: 60000 });
        await page.waitForFunction(() => window.AdminRepository?.getState().phase === 'authorized', null, { timeout: 60000 });
        actor = await page.evaluate(() => window.AffiliateAuth.getState().session.user.id); uuid(actor);
        stage = 'assistance-preflight-' + swMode;
        await guardNoActiveAssistance(values, actor);
        targetId = await page.evaluate(async () => {
          if (window.AffiliateAuth.getState().impersonation) throw Error('EXISTING_BROWSER_ASSISTANCE');
          const rows = (await window.AdminRepository.searchAffiliates('12087')).filter((person) => String(person.numero_control) === '12087');
          if (rows.length !== 1) throw Error('TARGET_CONTROL_NOT_UNIQUE'); return rows[0].id || rows[0].affiliate_id;
        }); uuid(targetId);
        startAttempted = true;
        const started = await page.evaluate(async ({ targetId, reason }) => window.AdminRepository.startImpersonation(targetId, reason), { targetId, reason });
        sessionId = uuid(started?.session_id); report.administrativeSessionsStarted++;
        await page.locator('[data-impersonation-active]').waitFor({ state: 'visible', timeout: 60000 });
        row.context = await assertTargetContext(page, actor, targetId);
        stage = 'projection-' + swMode;
        const projection = await readProjectionAndQuote(page), fingerprint = sha(JSON.stringify(projection.projection));
        fs.writeFileSync(path.join(privateDir, runId + '-' + report.cases.length + '-projection.json'), JSON.stringify(projection, null, 2) + '\n');
        if (expectedProjection) { assert.equal(fingerprint, expectedProjection, 'PROJECTION_CHANGED_BETWEEN_SW_MODES'); assert.equal(projection.sourceVersion, expectedSourceVersion, 'LIVE_SOURCE_CHANGED_DURING_VERIFICATION'); }
        else { expectedProjection = fingerprint; expectedSourceVersion = projection.sourceVersion; }
        row.projection = { status: 'PASS', visibleFunds: projection.projection.length, positiveFunds: projection.quotes.length, quotedFunds: projection.quotes.length, balancesContract: projection.contract && projection.formula && projection.totalMatches, fingerprint };
        stage = 'loan-ui-' + swMode; row.ui = await navigateAndVerifyLoan(page);
        await page.screenshot({ path: path.join(privateDir, runId + '-' + report.cases.length + '-12087.png'), fullPage: true });
        stage = 'refresh-' + swMode;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('[data-impersonation-active]').waitFor({ state: 'visible', timeout: 60000 });
        await assertTargetContext(page, actor, targetId);
        row.refreshedAssets = await verifyAssets(page, expected, swMode);
        const refreshed = await readProjectionAndQuote(page);
        assert.equal(sha(JSON.stringify(refreshed.projection)), fingerprint, 'PROJECTION_CHANGED_ON_REFRESH');
        row.refreshedUi = await navigateAndVerifyLoan(page);
        row.refresh = 'PASS';
        assert.deepEqual(blockedWrites, [], 'UNEXPECTED_BUSINESS_WRITE_ATTEMPT'); assert.deepEqual(runtimeErrors, [], 'BROWSER_RUNTIME_ERRORS');
        row.status = 'PASS'; completed.set(key, true);
      } finally {
        const operationStage = stage;
        stage = 'cleanup-' + swMode;
        if (startAttempted) {
          let cleanup;
          for (let attempt = 0; attempt < 3; attempt++) {
          cleanup = await page.evaluate(async ({ actor, targetId, sessionId, reason }) => {
            const client = window.SutiSupabase.getClient(), response = await client.rpc('get_impersonation_context');
            if (response.error) throw Error('CLEANUP_CONTEXT_UNAVAILABLE');
            const active = Array.isArray(response.data) ? response.data[0] : response.data;
            if (!active) return { ended: false, alreadyEnded: true };
            if (active.actor_real_auth_user_id !== actor || active.usuario_contexto_affiliate_id !== targetId || active.reason !== reason || (sessionId && active.session_id !== sessionId)) return { ended: false, mismatch: true };
            await window.AdminRepository.stopImpersonation();
            const check = await client.rpc('get_impersonation_context');
            if (check.error || (Array.isArray(check.data) ? check.data.length : !!check.data)) throw Error('CLEANUP_SESSION_STILL_ACTIVE');
            return { ended: true };
          }, { actor, targetId, sessionId, reason }).catch(() => ({ ended: false, error: true }));
          if (!cleanup.error) break;
          }
          row.cleanup = cleanup;
          if (cleanup.ended && !sessionId) report.administrativeSessionsStarted++;
          if (cleanup.ended || (cleanup.alreadyEnded && sessionId)) report.administrativeSessionsEnded++;
          if (cleanup.mismatch || cleanup.error) { row.status = 'FAIL'; row.cleanupFailure = true; }
        }
        if (actor && !row.cleanupFailure) await page.evaluate(async () => { await window.SutiSupabase.getClient().auth.signOut({ scope: 'local' }); }).catch(() => {});
        await context.close();
        row.blockedBusinessWriteAttempts = blockedWrites.length;
        row.runtimeErrors = runtimeErrors.length;
        stage = operationStage;
      }
      assert.equal(row.status, 'PASS', 'CASE_OR_CLEANUP_FAILED');
    }
    assert.equal(report.administrativeSessionsStarted, report.administrativeSessionsEnded, 'ADMINISTRATIVE_SESSION_CLEANUP_INCOMPLETE');
    report.status = 'PASS'; report.serviceWorkerComparison = 'PASS';
  } catch (error) {
    report.stage = stage;
    report.failure = String(error.message || '').match(/[A-Z][A-Z0-9_]{5,}/)?.[0] || 'VERIFICATION_FAILED';
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(evidenceDir, 'production-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
}
function selfTest() {
  const base = 'https://project.supabase.co';
  const cases = [
    ['/rest/v1/rpc/get_impersonation_context', 'POST', '{}', false],
    ['/rest/v1/rpc/start_affiliate_impersonation', 'POST', '{}', false],
    ['/rest/v1/rpc/stop_affiliate_impersonation', 'POST', '{}', false],
    ['/rest/v1/rpc/resolve_current_loan_snapshot_quote', 'POST', '{}', false],
    ['/rest/v1/rpc/submit_loan_request', 'POST', '{}', true],
    ['/rest/v1/rpc/save_current_notification_phone', 'POST', '{}', true],
    ['/rest/v1/rpc/claim_affiliate_identity', 'POST', '{}', true],
    ['/rest/v1/program_requests', 'POST', '{}', true],
    ['/rest/v1/affiliates', 'PATCH', '{}', true],
    ['/functions/v1/financial-legacy', 'POST', '{"action":"loanSessionOpen"}', false],
    ['/functions/v1/financial-legacy', 'POST', '{"action":"loanSessionConfirm"}', true],
    ['/functions/v1/financial-legacy', 'POST', '{"action":"approve"}', true],
    ['/functions/v1/loan-history', 'POST', '{"action":"LOAD"}', false],
    ['/auth/v1/token', 'POST', '{}', false],
    ['/auth/v1/logout', 'POST', '{}', false],
    ['/storage/v1/object/sign/private-assets/photo', 'POST', '{}', false],
    ['/storage/v1/object/private-assets/photo', 'POST', '{}', true],
  ];
  for (const [endpoint, method, body, blocked] of cases) assert.equal(!!blockedMutationReason(base + endpoint, method, body), blocked, endpoint);
  assert.throws(() => uuid("'; delete from affiliates;--"));
  console.log(JSON.stringify({ status: 'PASS', isolated: true, networkRequests: 0, mutationGuardCases: cases.length, sqlUuidInjectionRejected: true }));
}
if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main().catch(() => { console.error('PRODUCTION_VERIFIER_PRECONDITION_FAILED'); process.exitCode = 1; });
}
module.exports = { blockedMutationReason, expectedAssets };
