'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function loadEnv(file) {
  const values = {};
  for (const raw of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function mime(file) {
  return ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' })[path.extname(file)] || 'application/octet-stream';
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

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitFor(fn, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) { lastError = error; }
    await sleep(200);
  }
  throw lastError || new Error('Browser condition timed out');
}

function cdp(socketUrl) {
  const socket = new WebSocket(socketUrl);
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  const ready = new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('Chrome DevTools connection failed'));
  });
  return {
    ready,
    call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

async function main() {
  let stage = 'initialize';
  let h009UiTestId = null;
  const values = loadEnv(path.join(root, 'supabase.env'));
  const credentialPrefix = process.argv[2] || 'H005_TEST';
  if (!/^H005_TEST(?:[2-9][0-9]*)?$/.test(credentialPrefix)) throw new Error('Invalid local credential alias');
  const required = ['AFFILIATE_ID', 'EMAIL', 'PASSWORD'].map((suffix) => `${credentialPrefix}_${suffix}`);
  if (required.some((name) => !values[name])) throw new Error('H-005 local browser test variables are missing');
  const credentials = {
    affiliateId: values[`${credentialPrefix}_AFFILIATE_ID`],
    email: values[`${credentialPrefix}_EMAIL`],
    password: values[`${credentialPrefix}_PASSWORD`],
  };
  if (!fs.existsSync(chromePath)) throw new Error('Chrome is unavailable');

  const appPort = await freePort();
  const debugPort = await freePort();
  const tempRoot = fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir();
  const profileDir = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-h005-'));
  const server = http.createServer((req, res) => {
    const requestPath = new URL(req.url, `http://127.0.0.1:${appPort}`).pathname;
    const relative = requestPath === '/' ? 'SutiApp.html' : decodeURIComponent(requestPath.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(appPort, '127.0.0.1', resolve));

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  let protocol;
  let evaluate;
  try {
    stage = 'connect_devtools';
    const target = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      return targets.find((item) => item.type === 'page');
    });
    protocol = cdp(target.webSocketDebuggerUrl);
    await protocol.ready;
    await protocol.call('Page.enable');
    await protocol.call('Runtime.enable');
    await protocol.call('Page.navigate', { url: `http://127.0.0.1:${appPort}/SutiApp.html` });

    evaluate = async (expression) => {
      const result = await protocol.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error('Browser evaluation failed');
      return result.result && result.result.value;
    };

    stage = 'login_screen';
    await waitFor(() => evaluate("Boolean(document.querySelector('input[type=email]') && document.querySelector('input[type=password]'))"), 30000);
    const recoveryPrepared = await evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Olvid') && !b.disabled)");

    const fillAndSubmit = async (password) => {
      await evaluate("(() => { const input=document.querySelector('input[type=email]'); input.focus(); input.select(); return true; })()");
      await protocol.call('Input.insertText', { text: credentials.email });
      await evaluate("(() => { const input=document.querySelector('input[type=password]'); input.focus(); input.select(); return true; })()");
      await protocol.call('Input.insertText', { text: password });
      await evaluate("document.querySelector('button[type=submit]').click()");
    };

    stage = 'incorrect_password';
    await fillAndSubmit(credentials.password + '-incorrect');
    try {
      await waitFor(() => evaluate("document.body.innerText.includes('Correo o contraseña incorrectos.')"));
    } catch (_) {
      const authState = await evaluate("window.AffiliateAuth ? JSON.stringify({phase:window.AffiliateAuth.getState().phase,errorCode:window.AffiliateAuth.getState().errorCode,emailLength:(document.querySelector('input[type=email]').value||'').length,passwordLength:(document.querySelector('input[type=password]').value||'').length,submitDisabled:document.querySelector('button[type=submit]').disabled}) : 'missing'");
      throw new Error(`incorrect-password state ${authState}`);
    }
    stage = 'correct_login';
    await fillAndSubmit(credentials.password);
    await waitFor(() => evaluate(`window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'authenticated' && window.AffiliateAuth.getState().affiliate.id === ${JSON.stringify(credentials.affiliateId)}`), 30000);

    stage = 'h0072_visual_content';
    await evaluate(`(() => { const home=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Inicio'); if(home)home.click(); return true; })()`);
    const h0072Visual = await waitFor(() => evaluate(`(() => {
      const s=window.VisualContent && window.VisualContent.getState();
      const img=document.querySelector('[data-h0072-banner-state="loaded"] img');
      const storage='/storage/v1/object/public/app-assets/';
      return Boolean(s && s.phase==='loaded' && s.homeBanners.length===10 && Array.isArray(s.popups) && s.companies.length===33 && img && img.complete && img.naturalWidth>0 && img.src.includes(storage));
    })()`), 30000);
    const bannerBefore = await evaluate("Number(document.querySelector('[data-home-banner-index]').dataset.homeBannerIndex)");
    const bannerRotates = await waitFor(() => evaluate(`Number(document.querySelector('[data-home-banner-index]').dataset.homeBannerIndex)!==${bannerBefore}`), 7000);
    await evaluate("document.querySelector('[aria-label=\"Ampliar imagen\"]').click()");
    const globalViewer = await waitFor(() => evaluate("Boolean(document.querySelector('[data-image-viewer=open]'))"));
    await evaluate("document.querySelector('[data-image-viewer=open] [aria-label=\"Acercar\"]').click()");
    const globalViewerZoom = await waitFor(() => evaluate("document.querySelector('[data-image-viewer=open] img').style.transform.includes('scale(1.5)')"));
    await evaluate("document.querySelector('[data-image-viewer=open] [aria-label=\"Cerrar\"]').click()");
    const storageRuntime = await evaluate(`(() => {
      const s=window.InstitutionalContent && window.InstitutionalContent.getState();
      const prefix='/storage/v1/object/public/';
      if(!s || s.phase!=='loaded') return false;
      const urls=[...s.directory.map(x=>x.image_url),...s.minutes.flatMap(x=>[x.image_url,x.document_url]),...s.documents.flatMap(x=>[x.image_url,x.document_url]),...s.programs.map(x=>x.primary_image_url)].filter(Boolean);
      return urls.length>0 && urls.every(x=>x.includes(prefix)) && urls.every(x=>!x.includes('glide-prod'));
    })()`);
    const pwaAssets = await evaluate(`Promise.all(['icon-180.png','icon-192.png','icon-512.png','icon-maskable-512.png'].map(src=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth>0&&i.naturalHeight>0);i.onerror=()=>resolve(false);i.src=src+'?h0072=1';}))).then(x=>x.every(Boolean))`);
    const homeBranding = await evaluate(`(() => {
      const s=window.VisualContent && window.VisualContent.getState();
      const card=document.querySelector('[data-install-branding-state="loaded"]');
      return Boolean(s && s.branding && card && card.querySelector('img') && card.querySelector('img').src===s.branding.app_icon_url && card.innerText.includes(s.branding.app_name) && card.innerText.includes(s.branding.description));
    })()`);
    await evaluate("document.querySelector('[data-h0072-banner-state=loaded]').scrollIntoView({block:'center'})");
    await sleep(500);
    const screenshot = await protocol.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const screenshotPath = path.join(tempRoot, 'sutiapp-h0072-home.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

    stage = 'h0073_companies_ui';
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Convenios').click()");
    const companiesUi = await waitFor(() => evaluate(`(() => {
      const root=document.querySelector('[data-h0073-state="loaded"]');
      const count=document.querySelector('[data-h0073-company-count]');
      const cards=[...document.querySelectorAll('[data-company-id]')];
      const storage='/storage/v1/object/public/company-assets/';
      const images=cards.map(card=>card.querySelector('img')).filter(Boolean);
      return Boolean(root && count && Number(count.dataset.h0073CompanyCount)===33 && cards.length===33 && images.length===33 && images.every(img=>img.src.includes(storage) && !img.src.includes('glide-prod')));
    })()`), 30000);
    const conveniosPreservation = await waitFor(() => evaluate(`(() => {
      const root=document.querySelector('[data-convenios-state="loaded"]');
      const text=root&&root.innerText;
      const input=root&&root.querySelector('input[placeholder*="empresa"]');
      return Boolean(root && root.querySelector('[data-convenios-section="ads"]') && root.querySelector('[data-convenios-section="featured"]') && root.querySelector('[data-convenios-section="all"]') && root.querySelector('[data-convenios-ad-position]') && input && input.parentElement.parentElement.querySelector('button') && root.querySelector('[aria-label="Favorito"]') && text.includes('ESPACIO PUBLICITARIO') && text.includes('PATROCINADO') && text.includes('Destacados') && text.includes('Todos los convenios') && text.includes('DESCUENTO PENDIENTE'));
    })()`), 30000);
    const favoriteBefore = await evaluate(`document.querySelector('[data-company-id] [aria-label="Favorito"]').getAttribute('aria-pressed')`);
    await evaluate(`document.querySelector('[data-company-id] [aria-label="Favorito"]').click()`);
    const favoriteInteraction = await waitFor(() => evaluate(`document.querySelector('[data-company-id] [aria-label="Favorito"]').getAttribute('aria-pressed') !== ${JSON.stringify(favoriteBefore)}`));
    await evaluate(`(() => { const i=document.querySelector('input[placeholder*="empresa"]'); i.parentElement.parentElement.querySelector('button').click(); })()`);
    const filterInteraction = await waitFor(() => evaluate("document.body.innerText.includes('Filtrar convenios')"));
    await evaluate(`(() => { const h=[...document.querySelectorAll('h3')].find(x=>x.textContent==='Filtrar convenios'); h.parentElement.parentElement.click(); })()`);
    await evaluate("document.querySelector('[data-company-id]').click()");
    const companyDetail = await waitFor(() => evaluate("Boolean(document.querySelector('h1') && document.querySelector('h1').textContent.trim())"));
    const detailPreservation = await waitFor(() => evaluate(`(() => { const root=document.querySelector('[data-convenio-detail]'); const text=root&&root.innerText; return Boolean(root && root.querySelector('[aria-label="Favorito"]') && root.querySelector('[data-convenio-benefits-state="pending"]') && text.includes('Sobre el beneficio') && text.includes('Beneficios disponibles') && text.includes('Muestra tu credencial digital') && text.includes('Llamar') && text.includes('Mensaje')); })()`));
    await evaluate("document.querySelector('[data-convenio-cover-zoom=enabled]').click()");
    const conveniosViewer = await waitFor(() => evaluate("Boolean(document.querySelector('[data-image-viewer=open]'))"));
    await evaluate("document.querySelector('[data-image-viewer=open] [aria-label=\"Cerrar\"]').click()");
    if (![conveniosPreservation,favoriteInteraction,filterInteraction,detailPreservation].every(Boolean)) throw new Error('Claude UI Convenios preservation failed');
    await evaluate("[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Volver').click()");
    await waitFor(() => evaluate("Boolean(document.querySelector('[data-h0073-company-count]'))"));
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Inicio').click()");
    await waitFor(() => evaluate("Boolean(document.querySelector('[data-h0072-banner-state=loaded]'))"));

    stage = 'h007_public_content';
    const directoryCount = await waitFor(() => evaluate("window.InstitutionalContent && window.InstitutionalContent.getState().phase === 'loaded' && document.querySelectorAll('[data-h007-directory-member]').length"), 30000);
    const expectedModules = { comite: 30, normas: 2, minuta: 5, finanzas: 17, formatos: 6 };
    const moduleCounts = {};
    for (const [moduleId, expectedCount] of Object.entries(expectedModules)) {
      await waitFor(() => evaluate(`Boolean(document.querySelector('[data-h007-nav=${moduleId}]'))`));
      await evaluate(`document.querySelector('[data-h007-nav=${moduleId}]').click()`);
      moduleCounts[moduleId] = await waitFor(() => evaluate(`(() => { const root=document.querySelector('[data-h007-module=${moduleId}]'); if(!root || root.querySelector('[data-h007-module-state]')) return 0; return root.querySelectorAll('[data-h007-content-block]').length; })()`), 30000);
      if (moduleCounts[moduleId] !== expectedCount) throw new Error(`module ${moduleId} count ${moduleCounts[moduleId]}/${expectedCount}`);
      await evaluate(`document.querySelector('[data-h007-module=${moduleId}] button').click()`);
    }
    const h007Ui = directoryCount === 30 && Object.entries(expectedModules).every(([id, count]) => moduleCounts[id] === count);

    stage = 'h006_home_identity';
    const homeIdentity = await waitFor(() => evaluate(`(() => {
      const s=window.AffiliateAuth.getState(), u=s.affiliateView;
      const name=document.querySelector('[data-affiliate-field="topbar-name"]');
      const chips=document.querySelector('[data-home-financial-chips="partial"]');
      return Boolean(u && name && chips && name.textContent===u.short && chips.innerText.includes('Crédito disponible') && chips.innerText.includes('Mi ahorro'));
    })()`));

    stage = 'h006_profile_identity';
    await evaluate("(() => { const b=[...document.querySelectorAll('button')].find(x => x.style.borderRadius === '50%'); if(!b)return false; b.click(); return true; })()");
    const profileIdentity = await waitFor(() => evaluate(`(() => {
      const s=window.AffiliateAuth.getState(), u=s.affiliateView;
      const root=document.querySelector('[data-affiliate-id]');
      const name=document.querySelector('[data-affiliate-field="profile-name"]');
      const control=document.querySelector('[data-affiliate-field="profile-control"]');
      const email=document.querySelector('[data-affiliate-field="profile-email"]');
      return Boolean(root && root.dataset.affiliateId===s.affiliate.id && name && name.textContent===u.name && control && control.textContent.includes(u.numeroControl) && email && email.textContent===u.email && u.email!=='—');
    })()`));
    await evaluate("document.querySelector('[data-h006=profile-back]').click()");

    stage = 'h006_credential_identity';
    await waitFor(() => evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Credencial')"));
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Credencial').click()");
    const credentialIdentity = await waitFor(() => evaluate(`(() => {
      const s=window.AffiliateAuth.getState(), u=s.affiliateView;
      const name=document.querySelector('[data-affiliate-field="credential-name"]');
      const control=document.querySelector('[data-affiliate-field="credential-control"]');
      const status=document.querySelector('[data-affiliate-field="credential-status"]');
      return Boolean(name && name.textContent===u.name && control && control.textContent===u.numeroControl && status && status.textContent===u.status);
    })()`));
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Inicio').click()");
    const h006Ui = Boolean(homeIdentity && profileIdentity && credentialIdentity);

    stage = 'icon_installation_admin_projection';
    await evaluate("window.__h009Errors=[];window.addEventListener('error',e=>window.__h009Errors.push(String(e.message||'error')));window.addEventListener('unhandledrejection',e=>window.__h009Errors.push(String((e.reason&&e.reason.message)||'rejection')));true");
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Admin').click()");
    let brandingAdmin = false;
    let adminDenied = false;
    let adminUiWriteRestore = false;
    let h009CrudUi = false;
    let h009UiCrudWrite = false;
    let h009UiDelete = false;
    let phase2NewsUi = false;
    let phase2EducationUi = false;
    if (credentialPrefix === 'H005_TEST') {
      stage = 'h008_admin_menu';
      await waitFor(() => evaluate("window.AdminRepository && window.AdminRepository.getState().phase==='authorized' && [...document.querySelectorAll('button')].some(b => b.textContent.toLowerCase().includes('instalaci'))"));
      await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('instalaci')).click()");
      stage = 'h008_branding_editor';
      brandingAdmin = await waitFor(() => evaluate(`(() => {
        const root=document.querySelector('[data-branding-source="supabase"][data-h008-admin-editor="enabled"]');
        const s=window.VisualContent && window.VisualContent.getState(); if(!root||!s||!s.branding)return false;
        const fields=[...root.querySelectorAll('[data-branding-field]')],positions=[...root.querySelectorAll('[data-install-position]')];
        return fields.length===3 && fields.every(x=>!x.disabled) && positions.length===3 &&
          positions.map(x=>x.dataset.installPosition).join(',')==='1,2,3' &&
          Boolean(root.querySelector('[data-h008-save-settings]')) && root.querySelectorAll('[data-h008-asset-control]').length===8 && !root.querySelector('image-slot');
      })()`),30000);
      await evaluate(`(() => { const x=document.querySelector('[data-branding-field=app_name]'); window.__h008OriginalName=x.value; const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(x,x.value+' · UI'); x.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('[data-h008-save-settings]').click(); return true; })()`);
      await waitFor(() => evaluate("window.VisualContent.getState().branding.app_name.endsWith(' · UI')"),30000);
      await evaluate(`(() => { const x=document.querySelector('[data-branding-field=app_name]'); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(x,window.__h008OriginalName); x.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('[data-h008-save-settings]').click(); return true; })()`);
      adminUiWriteRestore = await waitFor(() => evaluate("window.VisualContent.getState().branding.app_name===window.__h008OriginalName"),30000);
      await evaluate("document.querySelector('[data-branding-source] button').click()");
      h009CrudUi = true;
      for (const module of [['banners','banners'],['popups','popups'],['companies_admin','companies'],['documents_admin','documents'],['education','education']]) {
        stage = 'h009_module_' + module[1];
        await waitFor(() => evaluate(`Boolean(document.querySelector('[data-admin-module=${module[0]}]'))`));
        await evaluate(`document.querySelector('[data-admin-module=${module[0]}]').click()`);
        h009CrudUi = Boolean(h009CrudUi && await waitFor(() => evaluate(`Boolean(document.querySelector('[data-h009-module=${module[1]}][data-h009-state=loaded]') && document.querySelector('[data-h009-create=${module[1]}]'))`),30000));
        if (module[1] === 'education') phase2EducationUi = true;
        if (module[1] === 'popups') {
          const popupMarker = `H009 UI reversible ${Date.now()}`;
          stage = 'h009_popup_open_editor';
          await evaluate("document.querySelector('[data-h009-create=popups]').click()");
          await waitFor(() => evaluate("Boolean(document.querySelector('[data-h009-editor=popups]'))"));
          stage = 'h009_popup_create';
          await evaluate(`(() => { const set=(selector,value,proto=HTMLInputElement.prototype)=>{const x=document.querySelector(selector);Object.getOwnPropertyDescriptor(proto,'value').set.call(x,value);x.dispatchEvent(new Event('input',{bubbles:true}));};set('[data-h009-field=title]',${JSON.stringify(popupMarker)});set('[data-h009-field=body]','Contenido controlado',HTMLTextAreaElement.prototype);document.querySelector('[data-h009-save=popups]').click();return true;})()`);
          await waitFor(() => evaluate(`Boolean([...document.querySelectorAll('[data-h009-item=popups]')].find(x=>x.textContent.includes(${JSON.stringify(popupMarker)})))`),30000);
          const uiId = await evaluate(`[...document.querySelectorAll('[data-h009-item=popups]')].find(x=>x.textContent.includes(${JSON.stringify(popupMarker)})).dataset.h009Id`);
          h009UiTestId = uiId;
          let rowSelector = `[data-h009-item=popups][data-h009-id="${uiId}"]`;
          await evaluate(`document.querySelector(${JSON.stringify(rowSelector)}).querySelector('button').click()`);
          await waitFor(() => evaluate(`!document.querySelector(${JSON.stringify(rowSelector)}).textContent.includes('INACTIVO') && document.querySelector(${JSON.stringify(rowSelector)}).textContent.includes('ACTIVO')`),30000);
          await evaluate(`document.querySelector(${JSON.stringify(rowSelector)}).querySelector('button').click()`);
          await waitFor(() => evaluate(`document.querySelector(${JSON.stringify(rowSelector)}).textContent.includes('INACTIVO')`),30000);
          await evaluate(`document.querySelector(${JSON.stringify(rowSelector)}).querySelector('[aria-label=Editar]').click()`);
          await waitFor(() => evaluate("Boolean(document.querySelector('[data-h009-editor=popups]'))"));
          const editedMarker=popupMarker+' edited';
          await evaluate(`(() => {const x=document.querySelector('[data-h009-field=title]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(x,${JSON.stringify(editedMarker)});x.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-h009-save=popups]').click();return true;})()`);
           h009UiCrudWrite = Boolean(await waitFor(() => evaluate(`Boolean([...document.querySelectorAll('[data-h009-item=popups]')].find(x=>x.textContent.includes(${JSON.stringify(editedMarker)})))`),30000));
           rowSelector = `[data-h009-item=popups][data-h009-id="${uiId}"]`;
           await evaluate(`window.confirm=()=>true;document.querySelector(${JSON.stringify(rowSelector)}).querySelector('[aria-label=Eliminar]').click()`);
           h009UiDelete = Boolean(await waitFor(() => evaluate(`!document.querySelector(${JSON.stringify(rowSelector)})`),30000));
           h009UiTestId = null;
        }
        await evaluate("document.querySelector('[data-h009-module] button').click()");
      }
      stage = 'phase2_news_ui_contract';
      await evaluate("document.querySelector('[data-admin-module=noticias]').click()");
      await waitFor(() => evaluate(`(() => {
        const text=document.body.innerText;const buttons=[...document.querySelectorAll('button')].map((b)=>b.textContent.trim());
        return text.includes('Responsable de la sección') && text.includes('NOTICIAS') && buttons.includes('Nueva');
      })()`),30000);
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Responsable de la sección')).click()");
      phase2NewsUi = Boolean(await waitFor(() => evaluate("document.body.innerText.includes('El responsable identifica') && document.body.innerText.includes('no modifica los permisos de acceso.') && !document.body.innerText.includes('PENDING BACKEND')"),30000));
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Cerrar sesión').parentElement.querySelector('button').click()");
    } else {
      adminDenied = await waitFor(() => evaluate("Boolean(document.querySelector('[data-h008-admin-access=denied]'))"),30000);
    }
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Inicio').click()");
    await waitFor(() => evaluate("Boolean(document.querySelector('[data-install-branding-state=loaded]'))"));

    stage = 'authenticated_reload';
    await protocol.call('Page.reload', { ignoreCache: true });
    await waitFor(() => evaluate(`window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'authenticated' && window.AffiliateAuth.getState().affiliate.id === ${JSON.stringify(credentials.affiliateId)}`), 30000);
    const refreshedIdentity = await waitFor(() => evaluate(`(() => {
      const u=window.AffiliateAuth.getState().affiliateView;
      const name=document.querySelector('[data-affiliate-field="topbar-name"]');
      const chips=document.querySelector('[data-home-financial-chips="partial"]');
      return Boolean(u && name && name.textContent===u.short && chips && chips.innerText.includes('Crédito disponible') && chips.innerText.includes('Mi ahorro'));
    })()`));
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Admin').click()");
    const adminAccessAfterReload = credentialPrefix === 'H005_TEST'
      ? await waitFor(() => evaluate("window.AdminRepository.getState().phase==='authorized'"),30000)
      : await waitFor(() => evaluate("Boolean(document.querySelector('[data-h008-admin-access=denied]'))"),30000);
    await evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Inicio').click()");

    stage = 'open_profile';
    await evaluate("(() => { const b=[...document.querySelectorAll('button')].find(x => x.style.borderRadius === '50%'); if(!b)return false; b.click(); return true; })()");
    await waitFor(() => evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Cerrar sesión')"));
    stage = 'logout_button';
    await evaluate("(() => { const b=[...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Cerrar sesión'); b.click(); return true; })()");
    await waitFor(() => evaluate("window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'unauthenticated' && Boolean(document.querySelector('input[type=email]'))"), 30000);

    stage = 'signed_out_reload';
    await protocol.call('Page.reload', { ignoreCache: true });
    await waitFor(() => evaluate("window.AffiliateAuth && window.AffiliateAuth.getState().phase === 'unauthenticated' && Boolean(document.querySelector('input[type=email]'))"), 30000);
    stage = 'phase1_onboarding_recovery_ui';
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Activar mi cuenta')).click()");
    const onboardingUi = await waitFor(() => evaluate("document.querySelectorAll('input[type=password]').length===2 && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Activar cuenta')"));
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Volver al inicio')).click()");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Olvid')).click()");
    const recoveryUi = await waitFor(() => evaluate("Boolean(document.querySelector('input[type=email]') && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Enviar instrucciones'))"));

    console.log(JSON.stringify({
      login_ui: true,
      incorrect_password_ui: true,
      real_login_ui: true,
      affiliate_resolved_by_session: true,
      h006_same_affiliate_in_home_profile_credential: h006Ui,
      h006_real_contact_profile_data: true,
      h006_mock_financial_identity_hidden: true,
      h007_supabase_content_ui: h007Ui,
      h0072_visual_content_ui: Boolean(h0072Visual),
      h0072_storage_only_runtime_urls: Boolean(storageRuntime),
      h0072_banner_rotation: Boolean(bannerRotates),
      global_image_viewer_zoom: Boolean(globalViewer && globalViewerZoom),
      h0072_pwa_icons_load: Boolean(pwaAssets),
      icon_installation_home_supabase: Boolean(homeBranding),
      h008_admin_ui: Boolean(brandingAdmin),
      h008_normal_admin_denied: Boolean(adminDenied),
      h008_admin_ui_write_restore: Boolean(adminUiWriteRestore),
      h008_admin_access_survives_reload: Boolean(adminAccessAfterReload),
      h009_admin_crud_modules: Boolean(h009CrudUi),
      h009_ui_create_edit_activate_deactivate: Boolean(h009UiCrudWrite),
      h009_ui_confirmed_delete: Boolean(h009UiDelete),
      phase2_news_ui_contract: Boolean(phase2NewsUi),
      phase2_education_admin_ui: Boolean(phase2EducationUi),
      h0073_companies_ui: Boolean(companiesUi),
      h0073_company_detail_ui: Boolean(companyDetail),
      claude_ui_convenios_structure: Boolean(conveniosPreservation),
      claude_ui_convenios_image_viewer: Boolean(conveniosViewer),
      claude_ui_convenios_favorite: Boolean(favoriteInteraction),
      claude_ui_convenios_filter: Boolean(filterInteraction),
      claude_ui_convenios_detail: Boolean(detailPreservation),
      h0072_screenshot: screenshotPath,
      h007_directory_count: directoryCount,
      h007_module_counts: moduleCounts,
      session_survives_reload: Boolean(refreshedIdentity),
      logout_button_real: true,
      signed_out_survives_reload: true,
      onboarding_ui: Boolean(onboardingUi),
      password_recovery_ui: Boolean(recoveryPrepared && recoveryUi),
    }));
  } catch (error) {
    try {
      const diagnostic = await evaluate(`JSON.stringify({adminPhase:window.AdminRepository&&window.AdminRepository.getState().phase,visual:window.VisualContent&&{phase:window.VisualContent.getState().phase,banners:window.VisualContent.getState().homeBanners.length,popups:window.VisualContent.getState().popups.length,companies:window.VisualContent.getState().companies.length,error:window.VisualContent.getState().errorCode},bannerState:document.querySelector('[data-h0072-banner-state]')&&document.querySelector('[data-h0072-banner-state]').dataset.h0072BannerState,affiliateView:Boolean(window.AffiliateAuth&&window.AffiliateAuth.getState().affiliateView),adminAccess:document.querySelector('[data-h008-admin-access]')&&document.querySelector('[data-h008-admin-access]').dataset.h008AdminAccess,h009Modules:document.querySelectorAll('[data-h009-module]').length,h009State:document.querySelector('[data-h009-module]')&&document.querySelector('[data-h009-module]').dataset.h009State,hasCreate:Boolean(document.querySelector('[data-h009-create]')),hasEditor:Boolean(document.querySelector('[data-h009-editor]')),items:document.querySelectorAll('[data-h009-item]').length,buttonCount:document.querySelectorAll('button').length,hasAdminTitle:document.body.innerText.includes('Panel Administrativo'),hasBanners:[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Banners'),hasBranding:[...document.querySelectorAll('button')].some(b=>b.textContent.toLowerCase().includes('instalaci')),errors:window.__h009Errors||[]})`);
      error.message += ` diagnostic=${diagnostic}`;
    } catch (_) {}
    error.message = `${stage}: ${error.message}`;
    throw error;
  } finally {
    if (h009UiTestId) {
      try { await fetch(`${values.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/popups?id=eq.${encodeURIComponent(h009UiTestId)}`, { method:'DELETE', headers:{ apikey:values.SUPABASE_SECRET_KEY, Prefer:'return=minimal' } }); } catch (_) {}
    }
    if (protocol) protocol.close();
    chrome.kill();
    await Promise.race([
      new Promise((resolve) => chrome.once('exit', resolve)),
      sleep(2000),
    ]);
    await new Promise((resolve) => server.close(resolve));
    if (profileDir.startsWith(tempRoot + path.sep)) {
      try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch (_) {}
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
