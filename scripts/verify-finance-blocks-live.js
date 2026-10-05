'use strict';
// Existing controlled accounts and requests only. Opens the editor and cancels;
// never creates, saves, revokes, approves, or otherwise changes business data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const target = new URL(process.env.SUTIAPP_FINANCE_BLOCKS_URL || 'https://sutiapp.com/SutiApp.html');
const expectedBundle = process.env.SUTIAPP_FINANCE_BLOCKS_EXPECTED_BUNDLE_SHA256 || '';
const browserOnly = process.env.SUTIAPP_FINANCE_BLOCKS_BROWSER_ONLY === '1';
const evidenceRoot = path.join(root, 'docs/qa/evidence/finance-blocks');
const suffix = process.env.SUTIAPP_FINANCE_BLOCKS_EVIDENCE_SUFFIX || '';
assert(/^[a-zA-Z0-9_-]*$/.test(suffix), 'INVALID_EVIDENCE_SUFFIX');
const evidenceFile = path.resolve(root, process.env.SUTIAPP_FINANCE_BLOCKS_EVIDENCE_PATH || path.join(evidenceRoot, 'release-live' + (suffix ? '-' + suffix : '') + '.json'));
const relativeEvidence = path.relative(evidenceRoot, evidenceFile);
assert(relativeEvidence && !relativeEvidence.startsWith('..') && !path.isAbsolute(relativeEvidence) && evidenceFile.endsWith('.json'), 'EVIDENCE_PATH_OUTSIDE_SCOPE');
assert(!expectedBundle || /^[a-f0-9]{64}$/i.test(expectedBundle), 'INVALID_EXPECTED_BUNDLE_SHA256');
assert(!target.username && !target.password && !target.search, 'TARGET_MUST_NOT_CONTAIN_CREDENTIALS_OR_QUERY');
const env = {};
for (const line of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
for (const name of ['H005_TEST2_EMAIL', 'H005_TEST2_PASSWORD']) if (process.env[name]) env[name] = process.env[name];
for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'H005_TEST_EMAIL', 'H005_TEST_PASSWORD']) assert(env[name], 'CONTROLLED_ENV_INCOMPLETE');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
let stage = 'initialization';
const result = { status: 'FAIL', scope: browserOnly ? 'BROWSER_ONLY_BACKEND_NOT_VERIFIED' : 'BROWSER_AND_BACKEND', target: target.origin + target.pathname, checkedAt: new Date().toISOString(), checks: [], businessWrites: 0, realDataScreenshotsSaved: false, rawResponsesSaved: false };

async function api(route, token, body) {
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  let data;
  try { data = await response.json(); } catch (_) { data = null; }
  return { ok: response.ok, status: response.status, data };
}

async function login(prefix) {
  const response = await api('/auth/v1/token?grant_type=password', null, { email: env[prefix + '_EMAIL'], password: env[prefix + '_PASSWORD'] });
  assert(response.ok && response.data?.access_token, 'CONTROLLED_LOGIN_FAILED_HTTP_' + response.status);
  return response.data.access_token;
}

async function backendChecks() {
  stage = 'backend-read-only-permissions';
  const admin = await login('H005_TEST');
  const normal = env.H005_TEST2_EMAIL && env.H005_TEST2_PASSWORD ? await login('H005_TEST2') : null;
  const list = await api('/rest/v1/rpc/list_admin_finance_blocks', admin, { p_affiliate_id: null });
  assert(list.ok && Array.isArray(list.data), 'ADMIN_LIST_UNAVAILABLE');
  const self = await api('/rest/v1/rpc/get_self_finance_block', normal || admin, {});
  assert(self.ok && typeof self.data?.blocked === 'boolean', 'SELF_BLOCK_CONTRACT_INVALID');
  assert.deepEqual(Object.keys(self.data).sort(), self.data.blocked ? ['block', 'blocked'] : ['blocked'], 'SELF_PROJECTION_TOO_BROAD');
  if (self.data.blocked) assert.deepEqual(Object.keys(self.data.block).sort(), ['ends_on', 'reason', 'starts_on'], 'SELF_BLOCK_PROJECTION_TOO_BROAD');
  for (const token of normal ? [normal, null] : [null]) {
    const denied = await api('/rest/v1/rpc/list_admin_finance_blocks', token, { p_affiliate_id: null });
    assert(!denied.ok && [401, 403].includes(denied.status), 'UNAUTHORIZED_ADMIN_LIST_ALLOWED');
  }
  // No existing target or block is supplied: even a permission regression cannot
  // reach business DML. Require the authorization guard, not a later input error.
  if (normal) {
    const deniedSave = await api('/rest/v1/rpc/save_admin_finance_block', normal, {
      p_request_id: null, p_id: null, p_version: null,
      p_starts_on: '2026-10-04', p_ends_on: '2026-10-04', p_reason: 'QA denied authorization probe',
    });
    assert(!deniedSave.ok && deniedSave.status === 403 && deniedSave.data?.message === 'FINANCE_BLOCK_WRITE_DENIED', 'NORMAL_BLOCK_WRITER_NOT_DENIED_BY_PERMISSION');
  }
  const direct = [];
  for (const table of ['finance_blocks', 'finance_block_events']) {
    for (const [role, token] of [['admin', admin], ...(normal ? [['normal', normal]] : []), ['anonymous', null]]) {
      const denied = await api('/rest/v1/' + table + '?select=id&limit=1', token);
      assert(!denied.ok && [401, 403].includes(denied.status), 'DIRECT_TABLE_SELECT_ALLOWED');
      direct.push({ table, role, status: 'DENIED' });
    }
  }
  const unavailable = 'NOT_RUN_NO_CONTROLLED_CREDENTIALS';
  result.backend = { adminList: 'PASS', selfProjectionActor: normal ? 'normal' : 'admin', selfBooleanAndAllowedFields: 'PASS', normalAdminList: normal ? 'DENIED' : unavailable, anonymousAdminList: 'DENIED', normalSaveWithoutTarget: normal ? 'DENIED_BY_PERMISSION' : unavailable, normalDirectTables: normal ? 'DENIED' : unavailable, directTables: direct };
  // Keep the comparison in process memory; never persist names, controls, reasons,
  // identifiers, tokens or a reproducible digest of private rows in QA evidence.
  return async () => {
    const after = await api('/rest/v1/rpc/list_admin_finance_blocks', admin, { p_affiliate_id: null });
    assert(after.ok && sha(JSON.stringify(after.data)) === sha(JSON.stringify(list.data)), 'FINANCE_BLOCK_RECORDS_CHANGED_DURING_CHECK');
    result.backend.recordsUnchangedDuringCheck = true;
  };
}

async function installReadOnlyGuard(context, stats) {
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.origin !== new URL(env.SUPABASE_URL).origin) return route.continue();
    if (method === 'OPTIONS') return route.continue();
    let allowed = ['GET', 'HEAD'].includes(method);
    const rpc = /^\/rest\/v1\/rpc\/([^/]+)$/.exec(url.pathname);
    if (rpc) {
      allowed = /^(get_|list_|resolve_|has_|can_)/.test(rpc[1]);
      // LIST returns a SELECT projection (20260928000100, command LIST branch).
      // Every other document command, including retry/configuration, stays denied.
      if (rpc[1] === 'document_generation_command') {
        try { allowed = request.postDataJSON()?.p_action === 'LIST'; } catch (_) { allowed = false; }
      }
    }
    else if (url.pathname.startsWith('/auth/v1/')) allowed = true; // Existing login/session lifecycle only.
    else if (url.pathname.startsWith('/storage/v1/object/sign/')) allowed = ['POST', 'GET'].includes(method);
    else if (url.pathname.startsWith('/functions/v1/')) {
      let body = {};
      try { body = request.postDataJSON() || {}; } catch (_) {}
      const name = url.pathname.split('/').pop();
      // Home can open its existing derived loan snapshot; confirmation/submission
      // remains blocked. This does not create or update a program request.
      allowed = name === 'document-access' || (name === 'sicof' && body.action === 'BEHAVIOR') || (name === 'financial-legacy' && ['overview', 'catalog', 'resolveEligibility', 'resolveAvailableFunds', 'loanSessionOpen'].includes(body.action));
    }
    if (allowed) return route.continue();
    stats.blockedWriteAttempts++;
    // Route/action names only: no request parameters, IDs, reasons or headers.
    let action = '';
    try { const body = request.postDataJSON(); const value = body?.action || body?.p_action; if (typeof value === 'string' && /^[A-Za-z_]{1,80}$/.test(value)) action = value; } catch (_) {}
    const namedEndpoint = /^\/(?:rest|functions)\/v1\/([a-z_-]+)(?:\/|$)/.exec(url.pathname);
    stats.blockedOperations.push({ endpoint: rpc ? rpc[1] : namedEndpoint?.[1] || 'SUPABASE_MUTATION', action });
    return route.abort('blockedbyclient');
  });
}

async function openAdmin(page) {
  await page.waitForFunction(() => document.querySelector('[data-app-tab="admin"]') || document.querySelector('[data-admin-desktop-sidebar]'));
  if (!await page.locator('[data-admin-desktop-sidebar]').count()) await page.locator('[data-app-tab="admin"]').evaluate(element => element.click());
  await page.locator('[data-admin-desktop-sidebar]').waitFor();
  const group = page.locator('[data-admin-sidebar-group="finance"]');
  if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
  await page.locator('[data-admin-sidebar-module="finance_blocks"]').waitFor();
}

async function inspectUi(page, phase) {
  stage = phase + '-admin-navigation';
  await openAdmin(page);
  const menuOrder = await page.locator('#admin-desktop-group-finance [data-admin-sidebar-module]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-admin-sidebar-module')));
  const index = menuOrder.indexOf('finance_blocks');
  assert(index > 0 && menuOrder[index - 1] === 'finanzas' && menuOrder[index + 1] === 'sicof', 'FINANCE_MENU_ORDER_INVALID');
  stage = phase + '-block-log';
  await page.locator('[data-admin-sidebar-module="finance_blocks"]').click();
  await page.locator('[data-admin-view="finance_blocks"]').waitFor();
  await page.getByLabel('Buscar por nombre o número de control').waitFor();
  const logState = await page.locator('[data-admin-view="finance_blocks"]').evaluate(node => ({
    empty: node.textContent.includes('No hay bloqueos registrados.'),
    rows: node.querySelectorAll('[data-finance-block-id]').length > 0,
    error: !!node.querySelector('[role="alert"]'),
  }));
  assert(!logState.error && (logState.empty || logState.rows), 'FINANCE_LOG_UNAVAILABLE');
  stage = phase + '-existing-request';
  await page.locator('[data-admin-sidebar-module="finanzas"]').click();
  await page.locator('[data-financial-queue-row]').first().waitFor();
  await page.locator('[data-financial-queue-row]').first().click();
  const dialog = page.locator('dialog[open]');
  await dialog.locator('[data-financial-detail-person]').waitFor();
  const control = dialog.locator('[data-finance-block-control]');
  await control.waitFor();
  const identityVisible = await dialog.locator('[data-financial-detail-person]').evaluate(node => [...node.querySelectorAll('.finwb-kv > div')].some(cell => /control/i.test(cell.querySelector('span')?.textContent || '') && !!cell.querySelector('strong')?.textContent.trim()));
  assert(identityVisible, 'REQUEST_CONTROL_NOT_VISIBLE');
  stage = phase + '-editor-open-cancel';
  const editorButton = control.getByRole('button', { name: /^(Bloquear programas de Finanzas|Editar bloqueo|Programar nuevo bloqueo)$/ }).first();
  await editorButton.click();
  const editor = control.locator('[data-finance-block-editor]');
  await editor.waitFor();
  assert.equal(await editor.locator('input[type="date"]').count(), 2, 'EDITOR_DATE_FIELDS_INVALID');
  assert.equal(await editor.getByLabel('Fecha de inicio').getAttribute('required'), '', 'EDITOR_START_REQUIRED');
  assert.equal(await editor.getByLabel('Fecha de fin').getAttribute('required'), '', 'EDITOR_END_REQUIRED');
  assert.equal(await editor.getByLabel('Explicación visible para el afiliado').getAttribute('required'), '', 'EDITOR_REASON_REQUIRED');
  assert((await editor.innerText()).includes('Ambas fechas se incluyen.'), 'EDITOR_INCLUSIVE_DATES_NOT_EXPLAINED');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await control.locator('[data-finance-block-editor]').count(), 0, 'EDITOR_CANCEL_FAILED');
  await dialog.getByRole('button', { name: 'Cerrar detalle de solicitud', exact: true }).click();
  return { menuOrder: 'finanzas > finance_blocks > sicof', log: logState.empty ? 'EMPTY' : 'EXISTING_ROWS', requestControlVisible: true, editorDatesAndReason: 'PASS', editorCancelledWithoutSave: true };
}

async function browserChecks() {
  const browser = await chromium.launch({ executablePath: process.env.SUTIAPP_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let activePage = null;
  try {
    for (const serviceWorkers of ['block', 'allow']) {
      stage = 'browser-' + serviceWorkers;
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers });
      const stats = { blockedWriteAttempts: 0, blockedOperations: [], pageErrors: 0, authResponseStatuses: [] };
      result.activeBrowserStats = stats;
      await installReadOnlyGuard(context, stats);
      const page = await context.newPage();
      activePage = page;
      page.setDefaultTimeout(30000);
      page.on('pageerror', () => { stats.pageErrors++; });
      const bundleResponses = [];
      page.on('response', response => {
        if (new URL(response.url()).pathname.endsWith('/app/bundle.js')) bundleResponses.push(response.body().then(body => sha(body), () => null));
        if (new URL(response.url()).pathname === '/auth/v1/token') stats.authResponseStatuses.push(response.status());
      });
      stage = 'browser-' + serviceWorkers + '-navigate';
      await page.goto(target.href, { waitUntil: 'domcontentloaded' });
      stage = 'browser-' + serviceWorkers + '-login';
      await page.locator('input[type="email"]').fill(env.H005_TEST_EMAIL);
      await page.locator('input[type="password"]').fill(env.H005_TEST_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated');
      const initial = await inspectUi(page, 'initial-' + serviceWorkers);
      stage = 'browser-refresh-' + serviceWorkers;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated');
      const refresh = await inspectUi(page, 'refresh-' + serviceWorkers);
      const hashes = await Promise.all(bundleResponses);
      assert(hashes.length >= 2 && hashes.every(Boolean), 'LOADED_BUNDLE_HASH_UNAVAILABLE');
      assert(hashes.every(hash => hash === hashes[0]), 'LOADED_BUNDLE_CHANGED_DURING_CHECK');
      if (expectedBundle) assert(hashes.every(hash => hash === expectedBundle.toLowerCase()), 'LOADED_BUNDLE_HASH_MISMATCH');
      assert.equal(stats.blockedWriteAttempts, 0, 'BUSINESS_WRITE_ATTEMPTED');
      assert.equal(stats.pageErrors, 0, 'BROWSER_RUNTIME_ERRORS');
      result.checks.push({ serviceWorkers, initial, refresh, bundleSha256: hashes[0], expectedBundleMatched: expectedBundle ? true : null, controlledAfterRefresh: await page.evaluate(() => !!navigator.serviceWorker?.controller), ...stats });
      await context.close();
      delete result.activeBrowserStats;
    }
  } catch (error) {
    if (activePage && !activePage.isClosed()) result.browserState = await activePage.evaluate(() => ({
      authPhase: window.AffiliateAuth?.getState().phase || null,
      adminPhase: window.AdminRepository?.getState().phase || null,
      loginFieldsPresent: !!document.querySelector('input[type="email"]'),
      desktopSidebarPresent: !!document.querySelector('[data-admin-desktop-sidebar]'),
      financeRowsPresent: !!document.querySelector('[data-financial-queue-row]'),
      financeBlockControlPresent: !!document.querySelector('[data-finance-block-control]'),
      financeBlockEditorPresent: !!document.querySelector('[data-finance-block-editor]'),
    })).catch(() => ({ inspectionUnavailable: true }));
    throw error;
  } finally { await browser.close(); }
}

async function main() {
  const heartbeat = setInterval(() => console.log(JSON.stringify({ status: 'RUNNING', stage, scope: result.scope })), 20000);
  heartbeat.unref();
  try {
    const confirmUnchanged = browserOnly ? null : await backendChecks();
    await browserChecks();
    stage = 'records-unchanged';
    if (confirmUnchanged) await confirmUnchanged();
    result.status = 'PASS';
  } catch (error) {
    // Playwright errors can embed DOM values. Persist only a fixed stage/code.
    result.failedStage = stage;
    const firstLine = typeof error.message === 'string' ? error.message.split('\n')[0].trim() : '';
    result.errorCode = /^[A-Z][A-Z0-9_]+$/.test(firstLine) ? firstLine : 'LIVE_VERIFICATION_FAILED';
    const transportCode = error.cause?.code || error.code;
    if (typeof transportCode === 'string' && /^[A-Z][A-Z0-9_]+$/.test(transportCode)) result.transportCode = transportCode;
    process.exitCode = 1;
  } finally {
    clearInterval(heartbeat);
    fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
    fs.writeFileSync(evidenceFile, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  }
}
main();
