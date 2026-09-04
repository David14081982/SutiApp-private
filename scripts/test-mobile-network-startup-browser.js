'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..');
const site = path.resolve(root, process.argv[2] || '_site-mobile-hardening');
const playwrightPath = process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core';
const { chromium, webkit } = require(playwrightPath);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp',
};

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(site, relative);
    if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function firstLoad(browserType, launchOptions, baseUrl, engine) {
  const browser = await browserType.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(baseUrl) && /\.(?:js|html)(?:\?|$)/.test(url)) await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  });
  try {
    const navigation = page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('#suti-startup-title').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal((await page.locator('#suti-startup-title').innerText()).trim(), 'Cargando SutiApp…');
    await navigation;
    await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 });
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
    const critical = resources.filter((url) => /\/app\/vendor\/(?:react|react-dom|supabase-js)-/.test(url));
    assert.equal(critical.length, 3, `${engine}: local critical resource count`);
    assert(critical.every((url) => new URL(url).origin === new URL(baseUrl).origin), `${engine}: external critical resource`);
    assert(!resources.some((url) => /(?:unpkg\.com|cdn\.jsdelivr\.net)/.test(url)), `${engine}: startup CDN requested`);
    return { engine, loadingVisible: true, loginSurface: true, criticalScriptsLocal: true };
  } finally { await browser.close(); }
}

async function controlledFailure(browserType, launchOptions, baseUrl, engine) {
  const browser = await browserType.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/app/vendor/react-18.3.1/react.production.min.js', (route) => route.abort('failed'));
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByText('No fue posible iniciar SutiApp', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: 'Reintentar' }).waitFor({ state: 'visible' });
    const result = await page.evaluate(() => ({
      error: document.getElementById('suti-startup-status').dataset.startupError,
      bodyVisible: document.body.getBoundingClientRect().height > 0,
      background: getComputedStyle(document.body).backgroundColor,
    }));
    assert(result.error);
    assert.equal(result.bodyVisible, true);
    assert.notEqual(result.background, 'rgba(0, 0, 0, 0)');
    return { engine, fallbackVisible: true, retryVisible: true, blankScreen: false };
  } finally { await browser.close(); }
}

async function oldCacheRecovery(baseUrl) {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(async () => { const cache = await caches.open('sutiapp-v148'); await cache.put('/old-shell', new Response('old')); });
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.register('/sw.js'); await registration.update(); await navigator.serviceWorker.ready; });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30000 });
    await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ type: 'SUTIAPP_PURGE_OLD_CACHES' }));
    await page.waitForFunction(async () => { const keys = await caches.keys(); return keys.includes('sutiapp-v149') && !keys.includes('sutiapp-v148'); }, null, { timeout: 30000 });
    const keys = await page.evaluate(() => caches.keys());
    return { oldCacheRemoved: !keys.includes('sutiapp-v148'), newCacheActive: keys.includes('sutiapp-v149'), controlled: true };
  } finally { await browser.close(); }
}

(async () => {
  assert(fs.statSync(path.join(site, 'index.html')).isFile(), 'built site missing');
  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/`;
  try {
    const chromiumOptions = { headless: true, executablePath: chromePath, args: ['--no-sandbox'] };
    const webkitOptions = { headless: true };
    const engines = [];
    engines.push({ startup: await firstLoad(chromium, chromiumOptions, baseUrl, 'CHROME_MOBILE_EMULATED'), failure: await controlledFailure(chromium, chromiumOptions, baseUrl, 'CHROME_MOBILE_EMULATED') });
    engines.push({ startup: await firstLoad(webkit, webkitOptions, baseUrl, 'WEBKIT_AUTOMATED'), failure: await controlledFailure(webkit, webkitOptions, baseUrl, 'WEBKIT_AUTOMATED') });
    const cache = await oldCacheRecovery(baseUrl);
    console.log(JSON.stringify({ status: 'PASS', engines, cache }));
  } finally { await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message })); process.exitCode = 1; });
