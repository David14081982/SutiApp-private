'use strict';

const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = 'https://david14081982.github.io/SutiApp-private/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function loadPlaywright() {
  for (const candidate of [process.env.SUTIAPP_PLAYWRIGHT_PATH, 'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core'].filter(Boolean)) {
    try { return require(candidate); } catch (_) {}
  }
  throw new Error('Playwright Core unavailable');
}

function env() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`HTTP_${response.status}:${data && (data.code || data.message || data.error) || 'UNKNOWN'}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

async function adminToken(values) {
  const data = await json(values.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: values.H005_TEST_EMAIL, password: values.H005_TEST_PASSWORD }),
  });
  return data.access_token;
}

async function rpc(values, token, name, body) {
  return json(values.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: values.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

async function managementSql(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  return json(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'SutiApp-AuthActivationCert/1.0' },
    body: JSON.stringify({ query }),
  });
}

async function createMailbox() {
  const domains = await json('https://api.mail.tm/domains?page=1');
  const domain = domains['hydra:member'][0].domain;
  const marker = crypto.randomBytes(7).toString('hex');
  const address = `suti-auth-cert-${marker}@${domain}`;
  const password = `M!${crypto.randomBytes(15).toString('base64url')}`;
  const account = await json('https://api.mail.tm/accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, password }),
  });
  const auth = await json('https://api.mail.tm/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, password }),
  });
  return { id: account.id, address, token: auth.token, marker };
}

async function listMessages(mailbox) {
  const data = await json('https://api.mail.tm/messages?page=1', { headers: { Authorization: 'Bearer ' + mailbox.token } });
  return data['hydra:member'] || [];
}

function linksFromMessage(message) {
  const source = [message.text || '', ...(Array.isArray(message.html) ? message.html : [message.html || ''])].join('\n');
  const decoded = source.replace(/&amp;/g, '&').replace(/&#x3D;/gi, '=').replace(/\\u0026/g, '&');
  return [...decoded.matchAll(/https:\/\/[^\s"'<>]+/g)].map((match) => match[0].replace(/[\]\)}>.,]+$/g, ''));
}

async function waitForEmail(mailbox, excludedIds, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const messages = await listMessages(mailbox);
    const next = messages.find((item) => !excludedIds.has(item.id));
    if (next) {
      const message = await json('https://api.mail.tm/messages/' + next.id, { headers: { Authorization: 'Bearer ' + mailbox.token } });
      const link = linksFromMessage(message).find((value) => value.includes('/auth/v1/verify'));
      if (link) return { id: next.id, link };
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('REAL_EMAIL_NOT_RECEIVED');
}

async function login(page, email, password) {
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.AffiliateAuth && ['authenticated', 'error', 'unlinked', 'ineligible', 'archived'].includes(window.AffiliateAuth.getState().phase), null, { timeout: 30000 });
  return page.evaluate(() => ({ phase: window.AffiliateAuth.getState().phase, affiliateId: window.AffiliateAuth.getState().affiliate && window.AffiliateAuth.getState().affiliate.id }));
}

async function field(dialog, label, selector) {
  const host = dialog.locator('label').filter({ hasText: label }).first();
  return host.locator(selector || 'input');
}

async function archiveFixture(values, affiliateId) {
  if (!affiliateId) return false;
  const token = await adminToken(values);
  const workbench = await rpc(values, token, 'get_admin_affiliate_workbench', { p_affiliate_id: affiliateId });
  if (!workbench || !workbench.profile || workbench.profile.record_origin !== 'ADMIN_AFFILIATES') throw new Error('REFUSING_TO_ARCHIVE_NON_QA_AFFILIATE');
  if (!workbench || !workbench.profile || workbench.profile.is_archived) return true;
  await rpc(values, token, 'archive_admin_affiliate', {
    p_affiliate_id: affiliateId,
    p_expected_updated_at: workbench.profile.updated_at,
    p_reason: 'Cierre de certificación Auth productiva QA',
  });
  return true;
}

async function deleteUnlinkedAuthFixture(values, email) {
  if (!email || !values.SUPABASE_SECRET_KEY) return false;
  const escaped = email.replace(/'/g, "''");
  const rows = await managementSql(values, `select u.id::text as id from auth.users u where lower(u.email)=lower('${escaped}') and not exists(select 1 from public.affiliates a where a.auth_user_id=u.id)`);
  if (rows.length === 0) return false;
  if (rows.length !== 1) throw new Error('AMBIGUOUS_QA_AUTH_CLEANUP');
  const response = await fetch(`${values.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${rows[0].id}`, {
    method: 'DELETE', headers: { apikey: values.SUPABASE_SECRET_KEY, 'User-Agent': 'SutiApp-AuthActivationCert/1.0' },
  });
  if (!response.ok && response.status !== 404) throw new Error(`AUTH_CLEANUP_HTTP_${response.status}`);
  return true;
}

async function main() {
  const values = env();
  for (const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ACCESS_TOKEN','H005_TEST_EMAIL','H005_TEST_PASSWORD']) assert(values[key], key + ' missing');
  const result = {
    status: 'FAIL', productionAsset: false, adminCreatesAffiliate: false, eligibleWithoutAuth: false,
    activationEmailReceived: false, activationCallback: false, passwordSetup: false, linkage: false,
    loginAfterActivation: false, doubleActivation: false, recoveryEmailReceived: false,
    recoveryCallback: false, loginAfterRecovery: false, cleanup: false, failure: null,
  };
  let browser;
  let mailbox;
  let affiliateId;
  let authUserId;
  let numeroControl;
  try {
    const html = await (await fetch(target, { cache: 'no-store' })).text();
    assert(html.includes('app/bundle.js?v=203'), 'Production bundle v203 not deployed');
    result.productionAsset = true;

    mailbox = await createMailbox();
    const password1 = `Su!${crypto.randomBytes(18).toString('base64url')}`;
    const password2 = `Sr!${crypto.randomBytes(18).toString('base64url')}`;
    numeroControl = `AUTHCERT-${Date.now()}`;
    const { chromium } = loadPlaywright();
    browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(target, { waitUntil: 'domcontentloaded' });
    const adminLogin = await login(page, values.H005_TEST_EMAIL, values.H005_TEST_PASSWORD);
    assert.equal(adminLogin.phase, 'authenticated', 'Controlled Admin login failed');
    const adminButton = page.getByRole('button', { name: 'Admin', exact: true });
    await adminButton.evaluate((node) => node.click());
    await page.waitForFunction(() => window.AdminRepository && window.AdminRepository.getState().phase === 'authorized', null, { timeout: 30000 });
    await page.locator('[data-admin-module="affiliates"]').evaluate((node) => node.click());
    await page.waitForSelector('[data-admin-affiliates="ready"]', { timeout: 30000 });
    await page.getByRole('button', { name: 'Nuevo afiliado' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo afiliado' });
    await dialog.waitFor();
    await (await field(dialog, 'Número de control')).fill(numeroControl);
    await (await field(dialog, 'Nombre completo')).fill('QA Certificación Activación Productiva');
    await (await field(dialog, 'Correo de contacto')).fill(mailbox.address);
    await (await field(dialog, 'Motivo del alta', 'textarea')).fill('Certificación controlada del flujo Auth productivo');
    await dialog.getByRole('button', { name: 'Crear afiliado' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 30000 });
    const createdRows = await managementSql(values, `select id::text as id from public.affiliates where record_origin='ADMIN_AFFILIATES' and numero_control='${numeroControl}'`);
    assert.equal(createdRows.length, 1, 'Admin create did not persist one controlled affiliate');
    affiliateId = createdRows[0].id;
    await page.waitForSelector(`[data-admin-affiliate-detail="${affiliateId}"]`, { timeout: 30000 });
    assert(affiliateId, 'Admin-created affiliate id missing');
    result.adminCreatesAffiliate = true;

    const anonymousStatus = await rpc(values, values.SUPABASE_PUBLISHABLE_KEY, 'get_affiliate_activation_status', { p_email: mailbox.address });
    assert.equal(anonymousStatus.status, 'ELIGIBLE', 'Admin-created affiliate is not activation eligible');
    const beforeLink = await managementSql(values, `select auth_user_id is null as unlinked from public.affiliates where id = '${affiliateId}'::uuid`);
    assert.equal(beforeLink[0] && beforeLink[0].unlinked, true, 'Controlled affiliate unexpectedly linked before activation');
    result.eligibleWithoutAuth = true;

    await page.evaluate(() => window.AffiliateAuth.signOut());
    await page.waitForFunction(() => window.AffiliateAuth.getState().phase === 'unauthenticated');
    await page.getByRole('button', { name: 'Activar mi cuenta' }).click();
    await page.locator('input[type="email"]').fill(mailbox.address);
    const activationRequestedAt = Date.now();
    await page.getByRole('button', { name: 'Enviar correo de activación' }).click();
    await page.waitForFunction(() => ['activation_sent','activation_error'].includes(window.AffiliateAuth.getState().phase), null, { timeout: 30000 });
    const activationState = await page.evaluate(() => ({ phase: window.AffiliateAuth.getState().phase, errorCode: window.AffiliateAuth.getState().errorCode || null, visibleAlert: Boolean(document.querySelector('[role="alert"]')) }));
    assert.equal(activationState.phase, 'activation_sent', `ACTIVATION_DELIVERY_REJECTED:${activationState.errorCode}:visible=${activationState.visibleAlert}`);
    const activationMail = await waitForEmail(mailbox, new Set());
    result.activationEmailReceived = true;

    await page.goto(activationMail.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'activation_password', null, { timeout: 30000 });
    const callbackUrl = new URL(page.url());
    assert.equal(callbackUrl.origin + callbackUrl.pathname, target);
    assert.equal(callbackUrl.searchParams.get('auth_flow'), 'activation');
    result.activationCallback = true;
    const activationPasswords = page.locator('input[type="password"]');
    assert.equal(await activationPasswords.count(), 2);
    await activationPasswords.nth(0).fill(password1);
    await activationPasswords.nth(1).fill(password1);
    await page.getByRole('button', { name: 'Activar cuenta', exact: true }).click();
    await page.waitForFunction(() => window.AffiliateAuth.getState().phase === 'unauthenticated' && /Cuenta activada/.test(window.AffiliateAuth.getState().notice || ''), null, { timeout: 30000 });
    result.passwordSetup = true;

    const linked = await managementSql(values, `select a.auth_user_id::text as auth_user_id, u.email_confirmed_at is not null as confirmed, length(u.encrypted_password) > 0 as password_set from public.affiliates a join auth.users u on u.id = a.auth_user_id where a.id = '${affiliateId}'::uuid`);
    assert.equal(linked.length, 1, 'Affiliate/Auth linkage absent');
    assert.equal(linked[0].confirmed, true, 'Auth email is not confirmed');
    assert.equal(linked[0].password_set, true, 'Auth password is not set');
    authUserId = linked[0].auth_user_id;
    result.linkage = true;

    const activatedLogin = await login(page, mailbox.address, password1);
    assert.equal(activatedLogin.phase, 'authenticated');
    assert.equal(activatedLogin.affiliateId, affiliateId);
    result.loginAfterActivation = true;
    await page.evaluate(() => window.AffiliateAuth.signOut());
    await page.waitForFunction(() => window.AffiliateAuth.getState().phase === 'unauthenticated');

    const beforeDouble = await listMessages(mailbox);
    await page.getByRole('button', { name: 'Activar mi cuenta' }).click();
    await page.locator('input[type="email"]').fill(mailbox.address);
    await page.getByRole('button', { name: 'Enviar correo de activación' }).click();
    await page.waitForFunction(() => window.AffiliateAuth.getState().errorCode === 'ACTIVATION_ALREADY_ACTIVE', null, { timeout: 30000 });
    await page.waitForTimeout(3500);
    const afterDouble = await listMessages(mailbox);
    assert.equal(afterDouble.length, beforeDouble.length, 'Double activation sent a duplicate email');
    result.doubleActivation = true;

    await page.getByRole('button', { name: 'Volver al inicio de sesión' }).click();
    await page.getByRole('button', { name: /Olvidé mi contraseña/ }).click();
    await page.locator('input[type="email"]').fill(mailbox.address);
    const remaining = 61000 - (Date.now() - activationRequestedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    const existingIds = new Set((await listMessages(mailbox)).map((item) => item.id));
    await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
    await page.waitForFunction(() => ['recovery_sent','recovery_error'].includes(window.AffiliateAuth.getState().phase), null, { timeout: 30000 });
    const recoveryState = await page.evaluate(() => ({ phase: window.AffiliateAuth.getState().phase, errorCode: window.AffiliateAuth.getState().errorCode || null }));
    assert.equal(recoveryState.phase, 'recovery_sent', `RECOVERY_DELIVERY_REJECTED:${recoveryState.errorCode}`);
    const recoveryMail = await waitForEmail(mailbox, existingIds);
    result.recoveryEmailReceived = true;
    await page.goto(recoveryMail.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'password_recovery', null, { timeout: 30000 });
    const recoveryUrl = new URL(page.url());
    assert.equal(recoveryUrl.origin + recoveryUrl.pathname, target);
    assert.equal(recoveryUrl.searchParams.get('auth_flow'), 'recovery');
    result.recoveryCallback = true;
    const recoveryPasswords = page.locator('input[type="password"]');
    await recoveryPasswords.nth(0).fill(password2);
    await recoveryPasswords.nth(1).fill(password2);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await page.waitForFunction(() => window.AffiliateAuth.getState().phase === 'unauthenticated', null, { timeout: 30000 });
    const recoveredLogin = await login(page, mailbox.address, password2);
    assert.equal(recoveredLogin.phase, 'authenticated');
    assert.equal(recoveredLogin.affiliateId, affiliateId);
    result.loginAfterRecovery = true;
    assert.deepEqual(pageErrors, []);
    result.status = 'PASS';
    await context.close();
  } catch (error) {
    result.failure = String(error.message || error).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/ig, '[id]').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[email]');
  } finally {
    if (browser) await browser.close().catch(() => {});
    try {
      if (!affiliateId && numeroControl) {
        const rows = await managementSql(values, `select id::text as id from public.affiliates where record_origin='ADMIN_AFFILIATES' and numero_control='${numeroControl}'`);
        if (rows.length === 1) affiliateId = rows[0].id;
      }
      if (!authUserId && affiliateId) {
        const rows = await managementSql(values, `select auth_user_id::text as auth_user_id from public.affiliates where id = '${affiliateId}'::uuid`);
        authUserId = rows[0] && rows[0].auth_user_id;
      }
      await deleteUnlinkedAuthFixture(values, mailbox && mailbox.address);
      await archiveFixture(values, affiliateId);
      if (mailbox) await fetch('https://api.mail.tm/accounts/' + mailbox.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + mailbox.token } });
      result.cleanup = Boolean(!affiliateId || mailbox);
      result.cleanupPolicy = 'QA_AFFILIATE_ARCHIVED_AUTH_AND_AUDIT_PRESERVED';
    } catch (cleanupError) {
      result.cleanup = false;
      result.cleanupFailure = String(cleanupError.message || cleanupError);
    }
  }
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', failure: error.message }));
  process.exitCode = 1;
});
