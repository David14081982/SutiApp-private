'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'docs', 'qa', 'evidence', 'admin-desktop-shell-20260826');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function loadPlaywright() {
  const candidates = [
    process.env.SUTIAPP_PLAYWRIGHT_PATH,
    'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (_) {}
  }
  throw new Error('Playwright Core no está disponible. Define SUTIAPP_PLAYWRIGHT_PATH.');
}

function env() {
  const out = {};
  const file = path.join(root, 'supabase.env');
  for (const raw of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port;
      server.close(() => resolve(value));
    });
  });
}

function serve(port) {
  const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
    const relative = pathname === '/' ? 'SutiApp.html' : decodeURIComponent(pathname.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const values = env();
  assert(values.H005_TEST_EMAIL && values.H005_TEST_PASSWORD, 'Faltan credenciales H005_TEST');
  fs.mkdirSync(evidenceDir, { recursive:true });
  const { chromium } = loadPlaywright();
  const port = await freePort();
  const server = await serve(port);
  const browser = await chromium.launch({
    headless:true,
    executablePath:chromePath,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check'],
  });
  const context = await browser.newContext({
    viewport:{ width:1440, height:1000 },
    reducedMotion:'reduce',
  });
  const page = await context.newPage();
  const exceptions = [];
  const consoleErrors = [];
  const failedRequests = [];
  const productiveWrites = [];
  page.on('pageerror', (error) => exceptions.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => failedRequests.push({ url:request.url(), error:request.failure() && request.failure().errorText }));
  await page.route('**/*', async (route) => {
    const request=route.request(),method=request.method(),url=request.url();
    if (!/supabase\.co/.test(url)) { await route.continue();return; }
    const tablePost = method === 'POST' && /\/rest\/v1\/(?!rpc\/)/.test(url);
    const storageWrite = method === 'POST' && /\/storage\/v1\/object\/(?!sign\/)/.test(url);
    if (['PATCH','PUT','DELETE'].includes(method) || tablePost || storageWrite) {
      productiveWrites.push({ method, url:url.replace(/\?.*$/, '') });
      await route.abort('blockedbyclient');return;
    }
    await route.continue();
  });

  const result = { status:'FAIL', breakpoint:1024, viewports:{}, desktopModules:[], navigatedModules:[], mobileModules:[], overlays:{}, permissionProjection:{}, productiveWrites:[], exceptions:[] };
  const menuReady = async () => page.waitForFunction(() => Boolean(document.querySelector('[data-admin-view="menu"]')));
  const setViewport = async (width, height, desktop) => {
    await page.setViewportSize({ width, height });
    if (desktop) {
      try { await page.waitForSelector('[data-admin-desktop-shell="true"]', { timeout:30000 }); }
      catch (_) {
        const diagnostic=await page.evaluate(() => ({htmlAdmin:document.documentElement.getAttribute('data-admin-desktop'),text:document.body.innerText.slice(0,800),root:document.getElementById('root')&&document.getElementById('root').innerHTML.slice(0,1000),viewport:window.innerWidth,adminState:window.AdminRepository&&window.AdminRepository.getState()}));
        throw new Error('DESKTOP_SHELL_NO_RENDER '+JSON.stringify({diagnostic,exceptions,consoleErrors,failedRequests}));
      }
    }
    else await page.waitForFunction(() => !document.querySelector('[data-admin-desktop-shell]'));
    await page.waitForTimeout(180);
    const layout = await page.evaluate(() => {
      const rootRect = document.getElementById('root').getBoundingClientRect();
      const nav = document.querySelector('[data-app-bottom-nav]');
      return {
        root:{ x:Math.round(rootRect.x), width:Math.round(rootRect.width), height:Math.round(rootRect.height) },
        shell:Boolean(document.querySelector('[data-admin-desktop-shell]')),
        sidebar:Boolean(document.querySelector('[data-admin-desktop-sidebar]')),
        header:Boolean(document.querySelector('[data-admin-desktop-header]')),
        workspace:Boolean(document.querySelector('[data-admin-desktop-workspace]')),
        bottomNav:nav ? getComputedStyle(nav).display : 'missing',
      };
    });
    assert.strictEqual(layout.shell, desktop, `shell incorrecto a ${width}`);
    assert.strictEqual(layout.bottomNav === 'none', desktop, `bottom nav incorrecto a ${width}`);
    if (desktop) {
      assert(layout.sidebar && layout.header && layout.workspace, `estructura desktop incompleta a ${width}`);
      assert.strictEqual(layout.root.width, width, `root no ocupa viewport a ${width}`);
    } else if (width >= 760) {
      assert.strictEqual(layout.root.width, 430, `marco móvil alterado a ${width}`);
    } else {
      assert.strictEqual(layout.root.width, width, `viewport móvil alterado a ${width}`);
    }
    result.viewports[`${width}x${height}`] = layout;
  };

  try {
    await page.goto(`http://127.0.0.1:${port}/SutiApp.html`, { waitUntil:'domcontentloaded' });
    try {
      await page.waitForSelector('input[type="email"]', { timeout:30000 });
    } catch (_) {
      const diagnostic=await page.evaluate(() => ({title:document.title,text:document.body.innerText.slice(0,600),html:document.getElementById('root')&&document.getElementById('root').innerHTML.slice(0,600),globals:{React:Boolean(window.React),ReactDOM:Boolean(window.ReactDOM),supabase:Boolean(window.supabase),auth:Boolean(window.AffiliateAuth)}}));
      throw new Error('LOGIN_NO_RENDER '+JSON.stringify({diagnostic,exceptions,consoleErrors,failedRequests}));
    }
    await page.locator('input[type="email"]').fill(values.H005_TEST_EMAIL);
    await page.locator('input[type="password"]').fill(values.H005_TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    try { await page.waitForFunction(() => window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'authenticated', null, { timeout:30000 }); }
    catch (_) {
      const diagnostic=await page.evaluate(() => {const state=window.AffiliateAuth&&window.AffiliateAuth.getState();return{auth:state&&{phase:state.phase,errorCode:state.errorCode,hasSession:Boolean(state.session)},text:document.body.innerText.slice(0,700)};});
      throw new Error('AUTH_NO_RESOLUTION '+JSON.stringify({diagnostic,productiveWrites,failedRequests,consoleErrors,exceptions}));
    }
    await page.evaluate(() => { const button=[...document.querySelectorAll('button')].find((item)=>item.textContent.trim()==='Admin');if(!button)throw new Error('ADMIN_TAB_BUTTON_MISSING');button.click(); });
    await page.waitForSelector('[data-app-tab-scroll="admin"]');
    await page.waitForFunction(() => window.AdminRepository && window.AdminRepository.getState().phase === 'authorized', null, { timeout:30000 });
    await setViewport(1440, 1000, true);
    await menuReady();

    const actualIds = await page.locator('[data-admin-module]').evaluateAll((nodes) => nodes.map((node) => node.dataset.adminModule));
    const projectedIds = await page.evaluate(() => {
      const state=window.AdminRepository.getState();
      return window.AdminDesktopAccess.visibleModules({admin:{assignment:state.assignment,has:window.AdminRepository.has}});
    });
    assert.deepStrictEqual(actualIds.slice().sort(), projectedIds.slice().sort(), 'dashboard y proyección de permisos divergen');
    assert(actualIds.length >= 10, 'se requieren al menos 10 módulos accesibles para la navegación desktop');
    result.desktopModules = actualIds;

    result.permissionProjection = await page.evaluate(() => {
      const technical={admin:{assignment:{permissions:['news.read'],sectionActions:[]},has:(permission)=>permission==='news.read'}};
      const section={admin:{assignment:{permissions:[],sectionActions:[{section_key:'news',action:'read'}]},has:(permission)=>permission==='news.read'}};
      return {technical:window.AdminDesktopAccess.visibleModules(technical),section:window.AdminDesktopAccess.visibleModules(section)};
    });
    assert(result.permissionProjection.technical.includes('noticias') && !result.permissionProjection.technical.includes('marketplace'), 'filtro técnico no respeta permiso');
    assert.deepStrictEqual(result.permissionProjection.section, ['noticias'], 'responsable de sección ve módulos ajenos');

    for (const id of actualIds.slice(0, 12)) {
      process.stdout.write(`NAV ${id}\n`);
      await page.locator(`[data-admin-module="${id}"]`).evaluate((node) => node.click());
      try { await page.waitForFunction(() => !document.querySelector('[data-admin-view="menu"]'), null, { timeout:10000 }); }
      catch (_) {
        const diagnostic=await page.evaluate((moduleId)=>({moduleId,menu:Boolean(document.querySelector('[data-admin-view="menu"]')),title:document.querySelector('[data-admin-desktop-header] h1')&&document.querySelector('[data-admin-desktop-header] h1').textContent,button:document.querySelector(`[data-admin-module="${moduleId}"]`)&&{aria:document.querySelector(`[data-admin-module="${moduleId}"]`).getAttribute('aria-disabled'),text:document.querySelector(`[data-admin-module="${moduleId}"]`).innerText}}),id);
        throw new Error('ADMIN_NAVIGATION_STALLED '+JSON.stringify(diagnostic));
      }
      const activeCount = await page.locator('.admin-desktop-module-host > *').count();
      assert.strictEqual(activeCount, 1, `más de un módulo activo en ${id}`);
      assert(await page.locator('[data-admin-desktop-header] h1').count(), `header desktop ausente en ${id}`);
      result.navigatedModules.push(id);
      await page.locator('[data-admin-desktop-header] button[aria-label="Volver al panel administrativo"]').evaluate((node) => node.click());
      await menuReady();
    }

    await page.screenshot({ path:path.join(evidenceDir, 'admin-1440x1000.png') });
    await setViewport(1280, 900, true);
    await setViewport(1024, 768, true);
    await page.screenshot({ path:path.join(evidenceDir, 'admin-1024x768.png') });
    await setViewport(768, 900, false);
    await setViewport(430, 932, false);
    await menuReady();
    await page.screenshot({ path:path.join(evidenceDir, 'admin-430x932.png') });

    for (const id of ['marketplace','documents_admin','fondos','data_exports'].filter((item) => actualIds.includes(item))) {
      await page.locator(`[data-admin-module="${id}"]`).evaluate((node) => node.click());
      await page.waitForFunction(() => !document.querySelector('[data-admin-view="menu"]'), null, { timeout:10000 });
      assert.strictEqual(await page.locator('[data-admin-desktop-shell]').count(), 0, `shell desktop apareció en móvil: ${id}`);
      assert.strictEqual(await page.locator('[data-app-bottom-nav]').evaluate((node) => getComputedStyle(node).display === 'none'), false, `bottom nav oculto en móvil: ${id}`);
      result.mobileModules.push(id);
      await page.locator('button[aria-label="Volver al panel administrativo"]').first().evaluate((node) => node.click());
      await menuReady();
    }

    await setViewport(1440, 1000, true);
    await page.evaluate(() => {
      const host=document.createElement('div');host.id='admin-overlay-test-host';document.body.appendChild(host);
      function Harness(){
        const[drawer,setDrawer]=React.useState(false),[modal,setModal]=React.useState(false);
        return React.createElement(React.Fragment,null,
          React.createElement('button',{id:'drawer-trigger',onClick:()=>setDrawer(true)},'Abrir drawer'),
          React.createElement('button',{id:'modal-trigger',onClick:()=>setModal(true)},'Abrir modal'),
          React.createElement(window.AdminDesktopDrawer,{open:drawer,title:'Detalle de prueba',subtitle:'Infraestructura aislada',onClose:()=>setDrawer(false)},React.createElement('button',{id:'drawer-last'},'Acción local')),
          React.createElement(window.AdminDesktopModal,{open:modal,title:'Confirmación de prueba',description:'No ejecuta acciones productivas.',danger:true,onCancel:()=>setModal(false),onConfirm:()=>{}},React.createElement('div',null,'Contenido local')));
      }
      window.__adminOverlayTestRoot=ReactDOM.createRoot(host);window.__adminOverlayTestRoot.render(React.createElement(Harness));
    });
    await page.locator('#drawer-trigger').evaluate((node) => { node.focus();node.click(); });
    await page.waitForSelector('[data-admin-drawer]');
    const drawerAria = await page.locator('[data-admin-drawer] [role="dialog"]').evaluate((node) => ({modal:node.getAttribute('aria-modal'),labelledby:Boolean(node.getAttribute('aria-labelledby'))}));
    assert.deepStrictEqual(drawerAria, {modal:'true',labelledby:true});
    await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute('aria-label') === 'Cerrar panel');
    await page.locator('#drawer-last').focus();
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'drawer-last', 'no se puede enfocar la última acción del drawer');
    await page.locator('#drawer-last').dispatchEvent('keydown',{key:'Tab'});
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')), 'Cerrar panel', 'focus trap drawer no vuelve al inicio');
    await page.locator('[data-admin-drawer] button[aria-label="Cerrar panel"]').dispatchEvent('keydown',{key:'Escape'});
    await page.waitForFunction(() => !document.querySelector('[data-admin-drawer]'));
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'drawer-trigger', 'drawer no restaura el foco');
    result.overlays.drawer = { aria:true, focusTrap:true, escape:true, focusRestore:true };

    await page.locator('#modal-trigger').evaluate((node) => { node.focus();node.click(); });
    await page.waitForSelector('[data-admin-modal="danger"]');
    assert.strictEqual(await page.locator('[data-admin-modal] [role="dialog"]').getAttribute('aria-modal'), 'true');
    await page.waitForFunction(() => document.activeElement && document.activeElement.textContent === 'Cancelar');
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.textContent), 'Cancelar', 'modal no enfoca la acción segura');
    await page.locator('[data-admin-modal] button[data-autofocus]').dispatchEvent('keydown',{key:'Escape'});
    await page.waitForFunction(() => !document.querySelector('[data-admin-modal]'));
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'modal-trigger', 'modal no restaura el foco');
    result.overlays.modal = { aria:true, danger:true, safeInitialFocus:true, escape:true, focusRestore:true };
    await page.evaluate(() => { window.__adminOverlayTestRoot.unmount();document.getElementById('admin-overlay-test-host').remove();delete window.__adminOverlayTestRoot; });

    assert.strictEqual(productiveWrites.length, 0, 'la prueba emitió escrituras productivas '+JSON.stringify(productiveWrites));
    assert.strictEqual(exceptions.length, 0, 'hubo excepciones de página');
    result.productiveWrites = productiveWrites;
    result.exceptions = exceptions;
    result.status = 'PASS';
    fs.writeFileSync(path.join(evidenceDir, 'playwright-result.json'), JSON.stringify(result, null, 2) + '\n');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally {
    await context.close();
    await browser.close();
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status:'FAIL', error:error.stack || error.message }));
  process.exitCode = 1;
});
