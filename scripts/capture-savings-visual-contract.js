'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core');

const root = path.resolve(__dirname, '..');
const source = 'C:\\Users\\david\\Downloads\\Ahorro por año.html';
const output = path.join(root, 'docs', 'qa', 'evidence', 'savings-user-ui-live-readonly-20260902', 'reference');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); fs.createReadStream(source).pipe(response); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const referenceUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    for (const [width, height] of [[390, 844], [1440, 1100]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      await page.goto(referenceUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(10000);
      await page.screenshot({ path: path.join(output, `contract-${width}x${height}.png`), fullPage: false });
      if (await page.locator('#__bundler_err').count()) throw new Error('VISUAL_BUNDLE_RUNTIME_ERROR_' + (await page.locator('#__bundler_err').innerText()).slice(0, 300));
      await context.close();
    }
    console.log(JSON.stringify({ status: 'PASS', source: 'OWNER_VISUAL_CONTRACT', screenshots: 2, dataImported: false }));
  } finally { await browser.close(); if (server.closeAllConnections) server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message })); process.exitCode = 1; });
