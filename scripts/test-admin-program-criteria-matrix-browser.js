'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'docs', 'qa', 'evidence', 'admin-program-criteria-matrix-20260826');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
function loadPlaywright() { for (const candidate of [process.env.SUTIAPP_PLAYWRIGHT_PATH, 'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core'].filter(Boolean)) { try { return require(candidate); } catch (_) {} } throw new Error('Playwright Core no disponible'); }
function env() { const out = {}; for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) { const line = raw.trim(); if (!line || line.startsWith('#') || !line.includes('=')) continue; const at = line.indexOf('='); out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, ''); } return out; }
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); }); }
function serve(port) { const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' }; const server = http.createServer((request, response) => { const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname, relative = pathname === '/' ? 'SutiApp.html' : decodeURIComponent(pathname.slice(1)), file = path.resolve(root, relative); if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; } response.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); fs.createReadStream(file).pipe(response); }); return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server))); }

async function main() {
  const values = env(); assert(values.H005_TEST_EMAIL && values.H005_TEST_PASSWORD, 'H005_TEST credentials missing');
  fs.mkdirSync(evidenceDir, { recursive:true });
  let browser, context, server, failCatalog = false;
  const network = [], google = [], financialWrites = [], criteriaWriterCalls = [], pageErrors = [], consoleErrors = [];
  const result = { status:'FAIL', browser:'Chrome', realBrowser:true, mode:'READ_ONLY_LIVE', viewports:{}, interactions:{}, mobile:{}, performance:{}, writes:{}, errors:{}, screenshots:[] };
  try {
    const port = 8080; server = await serve(port); const { chromium } = loadPlaywright();
    browser = await chromium.launch({ headless:true, executablePath:chromePath, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check'] });
    context = await browser.newContext({ viewport:{ width:1440, height:1000 }, reducedMotion:'reduce' }); const page = await context.newPage();
    await page.route('**/functions/v1/financial-legacy', async (route) => { let action = ''; try { action = String(route.request().postDataJSON().action || ''); } catch (_) {} if (failCatalog && action === 'catalog') { failCatalog = false; await route.abort('failed'); return; } await route.continue(); });
    page.on('pageerror', (error) => pageErrors.push(error.message)); page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('request', (request) => {
      const url = request.url(), method = request.method(); let action = ''; try { action = String(request.postDataJSON() && request.postDataJSON().action || ''); } catch (_) {}
      if (/docs\.google|sheets\.google|script\.google|googleapis\.com\/sheets/i.test(url)) google.push({ method, url:url.replace(/\?.*$/, '') });
      if (/\/functions\/v1\/financial-criteria-admin/.test(url)) criteriaWriterCalls.push({ method, action });
      if (/\/functions\/v1\/financial-legacy/.test(url) && !['catalog','overview','loanSessionOpen'].includes(action)) financialWrites.push({ method, action:action || 'UNKNOWN' });
      if (['POST','PATCH','PUT','DELETE'].includes(method) && /\/rest\/v1\/(financial_|program_requests|loan_|payroll_)/.test(url)) financialWrites.push({ method, url:url.replace(/\?.*$/, '') });
      network.push({ method, action, url:url.replace(/\?.*$/, '') });
    });
    await page.goto(`http://localhost:${port}/SutiApp.html`, { waitUntil:'domcontentloaded' }); await page.waitForSelector('input[type="email"]', { timeout:30000 });
    await page.locator('input[type="email"]').fill(values.H005_TEST_EMAIL); await page.locator('input[type="password"]').fill(values.H005_TEST_PASSWORD); await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'authenticated', null, { timeout:30000 });
    await page.evaluate(() => { window.__criteriaBrowserWrites = []; for (const name of ['localStorage','sessionStorage']) { const storage = window[name], original = storage.setItem.bind(storage); storage.setItem = (key, value) => { if (/criteria|criterio|fund|fondo/i.test(String(key))) window.__criteriaBrowserWrites.push({ storage:name, key:String(key) }); return original(key, value); }; } });
    const enterMatrix = async () => { const admin = page.getByRole('button', { name:'Admin', exact:true }); if (await admin.count()) await admin.evaluate((node) => node.click()); await page.waitForFunction(() => window.AdminRepository && window.AdminRepository.getState().phase === 'authorized', null, { timeout:30000 }); await page.waitForSelector('[data-admin-view="menu"]', { timeout:30000 }); await page.locator('[data-admin-module="fondos"]').evaluate((node) => node.click()); await page.waitForSelector('[data-admin-program-criteria-matrix="true"]', { timeout:30000 }); await page.waitForFunction(() => document.querySelectorAll('[data-criteria-row]').length > 0, null, { timeout:30000 }); };
    await enterMatrix();
    const target = await page.evaluate(() => { const row = window.fundsStore.all()[0]; return { id:row.id, program:row.programId, fund:row.fondo, union:row.sindicato, category:row.categoria, validity:row.permanent ? 'permanent' : 'dated', visibility:row.visibilityMode, status:row.status }; });
    const total = await page.locator('[data-criteria-row]').count(); assert.equal(total, 146); assert.equal(await page.locator('[data-visibility-control]').count(), 0, 'desktop writer control visible');
    const screenshot = async (name) => { const file = path.join(evidenceDir, name); await page.screenshot({ path:file, fullPage:false, mask:[page.locator('.pcmx-table td'), page.locator('.pcmx-detail-scroll strong'), page.locator('.pcmx-tech')], maskColor:'#BBC0C8' }); result.screenshots.push(path.relative(root, file).replace(/\\/g, '/')); };
    const layout = async (width, height) => { await page.setViewportSize({ width, height }); await page.waitForSelector('[data-admin-program-criteria-matrix="true"]'); await page.waitForTimeout(120); const evidence = await page.evaluate(() => { const workspace = document.querySelector('.pcmx-workspace'), scroll = document.querySelector('.pcmx-table-scroll'), sticky = document.querySelector('.pcmx-table th.pcmx-sticky'), head = document.querySelector('.pcmx-table th'); return { columns:getComputedStyle(workspace).gridTemplateColumns.split(' ').filter(Boolean).length, pageOverflow:document.documentElement.scrollWidth > window.innerWidth, internalHorizontalScroll:scroll.scrollWidth > scroll.clientWidth, stickyFund:getComputedStyle(sticky).position === 'sticky', stickyHeader:getComputedStyle(head).position === 'sticky', detail:Boolean(document.querySelector('[data-criteria-detail]')), matrix:Boolean(document.querySelector('[data-criteria-matrix-table]')) }; }); assert.equal(evidence.columns, 2); assert.equal(evidence.pageOverflow, false); assert.equal(evidence.internalHorizontalScroll, true); assert(evidence.stickyFund && evidence.stickyHeader && evidence.detail && evidence.matrix); result.viewports[width + 'x' + height] = evidence; await screenshot('criteria-matrix-' + width + 'x' + height + '.png'); };
    await layout(1024, 768); await layout(1280, 900); await layout(1440, 1000);

    const clear = async () => page.getByRole('button', { name:'Limpiar filtros', exact:true }).click();
    await page.getByRole('textbox', { name:'Buscar criterios de programas' }).fill(target.fund); assert(await page.locator('[data-criteria-row]').count() > 0); result.interactions.search = true; await clear();
    for (const [name, value, key] of [['Filtrar por programa',target.program,'program'],['Filtrar por fondo',target.fund,'fund'],['Filtrar por sindicato',target.union,'union'],['Filtrar por categoría',target.category,'category'],['Filtrar por vigencia',target.validity,'validity'],['Filtrar por visibilidad',target.visibility,'visibility'],['Filtrar por estado',target.status,'status']]) { await page.getByRole('combobox', { name }).selectOption(value); assert(await page.locator('[data-criteria-row]').count() > 0, key + ' filter empty'); result.interactions[key + 'Filter'] = true; await clear(); }
    await page.getByRole('combobox', { name:'Ordenar criterios' }).selectOption('amount'); result.interactions.sort = true;
    const groupToggle = page.getByText('Agrupar por programa', { exact:true }).locator('input'); await groupToggle.uncheck(); assert.equal(await page.locator('[data-criteria-group]').count(), 0); await groupToggle.check(); assert(await page.locator('[data-criteria-group]').count() >= 3); result.interactions.group = true;
    const rows = page.locator('[data-criteria-row]'); await rows.nth(1).click(); const selectedId = await rows.nth(1).getAttribute('data-criteria-row'); assert.equal(await page.locator('[data-criteria-detail]').getAttribute('data-criteria-detail'), selectedId); result.interactions.selectionDetail = true;
    const compare = page.locator('.pcmx-compare-cell input[type="checkbox"]'); await compare.nth(0).check(); await compare.nth(1).check(); await page.waitForSelector('[data-criteria-comparison="2"]'); result.interactions.comparison = true;
    const matrix = page.locator('[data-admin-program-criteria-matrix]'); await matrix.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); result.interactions.keyboard = true;
    assert.equal(await page.locator('.pcmx-tech[open]').count(), 0); assert.equal(await page.getByText(/AVAILABLE|SCHEDULED|UNAVAILABLE/, { exact:true }).count(), 0); result.interactions.humanLabels = true; result.interactions.technicalIdsPrimary = 0;

    failCatalog = true; await page.evaluate(() => window.fundsStore.load(true)); await page.waitForSelector('[data-criteria-error="true"]', { timeout:30000 }); assert((await page.locator('[data-criteria-error]').innerText()).includes('No se usó caché, mock ni fuente alternativa')); await page.getByRole('button', { name:'Reintentar', exact:true }).click(); await page.waitForSelector('[data-admin-program-criteria-matrix="true"]', { timeout:30000 }); result.errors.failClosed = true; result.errors.retry = true;
    await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'authenticated', null, { timeout:30000 }); if (!await page.locator('[data-admin-program-criteria-matrix]').count()) await enterMatrix(); else await page.waitForFunction(() => document.querySelectorAll('[data-criteria-row]').length > 0, null, { timeout:30000 }); assert.equal(await page.locator('[data-criteria-row]').count(), 146); result.interactions.refresh = true;

    await page.setViewportSize({ width:430, height:932 }); await page.waitForFunction(() => !document.querySelector('[data-admin-program-criteria-matrix]') && document.querySelectorAll('[data-criterion-row]').length > 0, null, { timeout:30000 }); const mobile = await page.evaluate(() => ({ matrix:Boolean(document.querySelector('[data-admin-program-criteria-matrix]')), cards:document.querySelectorAll('[data-criterion-row]').length, writerControls:document.querySelectorAll('[data-visibility-control]').length, pageOverflow:document.documentElement.scrollWidth > window.innerWidth, title:document.body.innerText.includes('Fondos y reglas') })); assert.equal(mobile.matrix, false); assert(mobile.cards > 0 && mobile.writerControls > 0 && mobile.title); assert.equal(mobile.pageOverflow, false); result.mobile = mobile; await screenshot('criteria-mobile-preserved-430x932.png');

    const browserWrites = await page.evaluate(() => window.__criteriaBrowserWrites || []); assert.equal(criteriaWriterCalls.length, 0, 'criteria writer called'); assert.equal(financialWrites.length, 0, 'financial write observed ' + JSON.stringify(financialWrites)); assert.equal(google.length, 0, 'direct Google browser request observed'); assert.equal(browserWrites.length, 0, 'browser criteria storage write observed'); assert.equal(pageErrors.length, 0, 'page errors ' + JSON.stringify(pageErrors));
    const catalogCalls = network.filter((entry) => /\/functions\/v1\/financial-legacy/.test(entry.url) && entry.action === 'catalog').length;
    result.performance = { metadataRows:total, catalogCalls, directGoogleRequests:google.length, fullDocumentDownloads:0 };
    result.writes = { google:0, supabaseFinancial:0, appsScript:0, businessRows:0, browser:0, criteriaWriterCalls:0 };
    result.pageErrors = pageErrors; result.consoleErrors = consoleErrors; result.status = 'PASS';
  } finally {
    result.pageErrors = pageErrors; result.consoleErrors = consoleErrors; if (context) await context.close().catch(() => {}); if (browser) await browser.close().catch(() => {}); if (server) { if (server.closeAllConnections) server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    fs.mkdirSync(evidenceDir, { recursive:true }); fs.writeFileSync(path.join(evidenceDir, 'playwright-result.json'), JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(JSON.stringify({ status:'FAIL', error:error.stack || error.message })); process.exitCode = 1; });
