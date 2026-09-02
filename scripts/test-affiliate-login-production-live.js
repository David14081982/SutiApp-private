'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const target = process.env.SUTIAPP_AUTH_E2E_URL || 'https://david14081982.github.io/SutiApp-private/';

function loadPlaywright() {
  for (const candidate of [process.env.SUTIAPP_PLAYWRIGHT_PATH, 'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core'].filter(Boolean)) {
    try { return require(candidate); } catch (_) {}
  }
  throw new Error('Playwright Core no disponible');
}

function loadEnv() {
  const values = {};
  const source = fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '');
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

async function waitForLogin(page) {
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
}

async function login(page, email, password) {
  await waitForLogin(page);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.AffiliateAuth && ['authenticated', 'error', 'unlinked', 'ineligible', 'archived'].includes(window.AffiliateAuth.getState().phase), null, { timeout: 30000 });
  return page.evaluate(() => {
    const state = window.AffiliateAuth.getState();
    return { phase: state.phase, errorCode: state.errorCode || null, adminOnly: Boolean(state.adminOnly) };
  });
}

async function loginLayout(page, expectedWidth) {
  return page.evaluate((width) => {
    const email = document.querySelector('input[type="email"]');
    const submit = document.querySelector('button[type="submit"]');
    return {
      viewportWidth: innerWidth,
      expectedWidth: width,
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
      emailVisible: Boolean(email && email.getBoundingClientRect().width > 0),
      submitVisible: Boolean(submit && submit.getBoundingClientRect().width > 0),
    };
  }, expectedWidth);
}

async function validViewport(browser, values, viewport, fullLifecycle) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  let stage = 'navigate';
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    stage = 'login-layout';
    await waitForLogin(page);
    const layout = await loginLayout(page, viewport.width);
    assert.equal(layout.viewportWidth, viewport.width);
    assert.equal(layout.noHorizontalOverflow, true);
    assert.equal(layout.emailVisible, true);
    assert.equal(layout.submitVisible, true);
    const auth = await login(page, values.H005_TEST_EMAIL, values.H005_TEST_PASSWORD);
    assert.equal(auth.phase, 'authenticated');
    stage = 'authenticated';

    let refresh = null;
    let session = null;
    let logout = null;
    if (fullLifecycle) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      stage = 'refresh';
      await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'authenticated', null, { timeout: 30000 });
      refresh = true;

      const sessionPage = await context.newPage();
      stage = 'session-new-page';
      await sessionPage.goto(target, { waitUntil: 'domcontentloaded' });
      await sessionPage.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'authenticated', null, { timeout: 30000 });
      session = true;
      await sessionPage.close();

      stage = 'open-profile';
      await page.evaluate(() => {
        const marker = document.querySelector('[data-profile-photo-consumer="header"]');
        const button = marker && marker.closest('button');
        if (!button) throw new Error('Profile control unavailable');
        button.click();
      });
      await page.getByText('Mi Perfil', { exact: true }).waitFor({ state: 'visible' });
      stage = 'logout-click';
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Cerrar sesión' && item.getBoundingClientRect().width > 0);
        if (!button) throw new Error('Logout control unavailable');
        button.click();
      });
      stage = 'logout-state';
      await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'unauthenticated', null, { timeout: 30000 });
      stage = 'logout-refresh';
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForLogin(page);
      logout = true;
    } else {
      await page.evaluate(() => window.AffiliateAuth.signOut());
    }
    assert.deepEqual(pageErrors, []);
    return { width: viewport.width, validLogin: true, layout: true, refresh, session, logout, pageErrors: 0 };
  } catch (error) {
    throw new Error(`viewport-${viewport.width}:${stage}:${error.message}`);
  } finally { await context.close(); }
}

async function invalidCredentials(browser, values) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await waitForLogin(page);
    await page.locator('input[type="email"]').fill(values.H005_TEST_EMAIL);
    await page.locator('input[type="password"]').fill(`${values.H005_TEST_PASSWORD}-invalid`);
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().errorCode === 'INVALID_CREDENTIALS', null, { timeout: 30000 });
    const alert = await page.getByRole('alert').innerText();
    assert.equal(alert.trim(), 'Correo o contraseña incorrectos.');
    return { errorCode: 'INVALID_CREDENTIALS', controlledMessage: true };
  } finally { await context.close(); }
}

async function unavailableService(browser, values) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/auth/v1/token**', (route) => route.abort('failed'));
  const page = await context.newPage();
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await waitForLogin(page);
    await page.locator('input[type="email"]').fill(values.H005_TEST_EMAIL);
    await page.locator('input[type="password"]').fill(values.H005_TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().errorCode === 'CONNECTION_ERROR', null, { timeout: 30000 });
    const alert = await page.getByRole('alert').innerText();
    assert.equal(alert.trim(), 'No pudimos conectar con el servicio de acceso. Intenta nuevamente.');
    await page.getByRole('button', { name: 'Intentar nuevamente' }).waitFor({ state: 'visible' });
    return { errorCode: 'CONNECTION_ERROR', controlledMessage: true, retryVisible: true };
  } finally { await context.close(); }
}

async function main() {
  const values = loadEnv();
  assert(values.H005_TEST_EMAIL && values.H005_TEST_PASSWORD, 'Controlled login credentials missing');
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const invalid = await invalidCredentials(browser, values);
    const unavailable = await unavailableService(browser, values);
    const viewports = [];
    viewports.push(await validViewport(browser, values, { width: 390, height: 844 }, true));
    viewports.push(await validViewport(browser, values, { width: 430, height: 932 }, false));
    viewports.push(await validViewport(browser, values, { width: 1280, height: 900 }, false));
    console.log(JSON.stringify({
      status: 'PASS',
      target: target.includes('github.io') ? 'GITHUB_PAGES_PRODUCTION' : 'LOCAL_BUILD_WITH_PRODUCTION_AUTH',
      validLogin: true,
      invalidCredentials: invalid,
      unavailableService: unavailable,
      refresh: true,
      session: true,
      logout: true,
      viewports,
    }));
  } finally { await browser.close(); }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
