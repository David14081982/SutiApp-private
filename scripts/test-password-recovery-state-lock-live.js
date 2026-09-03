'use strict';

// Focused recovery certification without SMTP. The controlled password is
// always restored through the trusted Auth Admin API before the process exits.
const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function loadEnv() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function loadPlaywright() {
  for (const candidate of [process.env.SUTIAPP_PLAYWRIGHT_PATH, 'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core'].filter(Boolean)) {
    try { return require(candidate); } catch (_) {}
  }
  throw new Error('Playwright Core no disponible');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function mime(file) {
  return ({ '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.webmanifest':'application/manifest+json' })[path.extname(file)] || 'application/octet-stream';
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  let body = null;
  try { body = await response.json(); } catch (_) {}
  return { status: response.status, ok: response.ok, body };
}

async function main() {
  const values = loadEnv();
  for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'H005_TEST_EMAIL', 'H005_TEST_PASSWORD']) {
    assert(values[key], `${key}_MISSING`);
  }
  const base = values.SUPABASE_URL.replace(/\/$/, '');
  const publicHeaders = { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  const adminHeaders = { apikey: values.SUPABASE_SECRET_KEY, Authorization: `Bearer ${values.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' };
  const originalLogin = await jsonRequest(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: publicHeaders,
    body: JSON.stringify({ email: values.H005_TEST_EMAIL, password: values.H005_TEST_PASSWORD }),
  });
  assert.equal(originalLogin.status, 200, 'CONTROLLED_LOGIN_FAILED_BEFORE_TEST');
  const authUserId = originalLogin.body && originalLogin.body.user && originalLogin.body.user.id;
  assert(authUserId, 'CONTROLLED_AUTH_USER_ID_MISSING');

  const port = await freePort();
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
    const relative = pathname === '/' ? 'SutiApp.html' : decodeURIComponent(pathname.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  const temporaryPassword = `SutiRecovery!${crypto.randomBytes(12).toString('hex')}Aa9`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  let restored = false;
  const restoreOriginalPassword = async () => {
    const restore = await jsonRequest(`${base}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
      method: 'PUT', headers: adminHeaders,
      body: JSON.stringify({ password: values.H005_TEST_PASSWORD }),
    });
    assert(restore.ok, `CONTROLLED_PASSWORD_RESTORE_FAILED_${restore.status}`);
    restored = true;
  };

  try {
    const link = await jsonRequest(`${base}/auth/v1/admin/generate_link`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ type: 'recovery', email: values.H005_TEST_EMAIL }),
    });
    assert(link.ok && link.body && link.body.hashed_token, `RECOVERY_LINK_GENERATION_FAILED_${link.status}`);
    const verified = await jsonRequest(`${base}/auth/v1/verify`, {
      method: 'POST', headers: publicHeaders,
      body: JSON.stringify({ type: 'recovery', token_hash: link.body.hashed_token }),
    });
    assert(verified.ok && verified.body && verified.body.access_token && verified.body.refresh_token, `RECOVERY_TOKEN_VERIFICATION_FAILED_${verified.status}`);

    const callback = new URL(`http://127.0.0.1:${port}/?auth_flow=recovery`);
    callback.hash = new URLSearchParams({
      access_token: verified.body.access_token,
      refresh_token: verified.body.refresh_token,
      expires_in: String(verified.body.expires_in || 3600),
      token_type: 'bearer',
      type: 'recovery',
    }).toString();

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(callback.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'password_recovery' && document.querySelectorAll('input[type="password"]').length === 2, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.AffiliateAuth.getState().phase), 'password_recovery');

    await page.evaluate(() => window.SutiSupabase.getClient().auth.refreshSession());
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.AffiliateAuth.getState().phase), 'password_recovery', 'TOKEN_REFRESHED_BYPASSED_RECOVERY');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'password_recovery' && document.querySelectorAll('input[type="password"]').length === 2, null, { timeout: 30000 });
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill(temporaryPassword);
    await passwords.nth(1).fill(temporaryPassword);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await page.waitForFunction(() => window.AffiliateAuth.getState().phase === 'unauthenticated' && document.body.innerText.includes('Contraseña actualizada'), null, { timeout: 30000 });
    assert.equal(new URL(page.url()).searchParams.has('auth_flow'), false, 'RECOVERY_CONTEXT_NOT_CLEARED');

    const newLogin = await jsonRequest(`${base}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: publicHeaders,
      body: JSON.stringify({ email: values.H005_TEST_EMAIL, password: temporaryPassword }),
    });
    assert.equal(newLogin.status, 200, 'NEW_PASSWORD_LOGIN_FAILED');
    const oldLogin = await jsonRequest(`${base}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: publicHeaders,
      body: JSON.stringify({ email: values.H005_TEST_EMAIL, password: values.H005_TEST_PASSWORD }),
    });
    assert([400, 401].includes(oldLogin.status), 'OLD_PASSWORD_WAS_NOT_REJECTED');
    await context.close();
  } finally {
    try { await restoreOriginalPassword(); }
    finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }

  assert(restored, 'CONTROLLED_PASSWORD_WAS_NOT_RESTORED');
  const restoredLogin = await jsonRequest(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: publicHeaders,
    body: JSON.stringify({ email: values.H005_TEST_EMAIL, password: values.H005_TEST_PASSWORD }),
  });
  assert.equal(restoredLogin.status, 200, 'CONTROLLED_LOGIN_FAILED_AFTER_RESTORE');
  console.log(JSON.stringify({
    status: 'PASS', smtpEmailsSent: 0, realRecoverySession: true,
    recoveryLockAfterWait: true, tokenRefreshLocked: true, reloadLocked: true,
    passwordUpdated: true, oldPasswordRejected: true, originalPasswordRestored: true,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error.message || error).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[email]') }));
  process.exitCode = 1;
});
