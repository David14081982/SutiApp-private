'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let currentStage = 'initialize';

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

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

async function waitFor(fn, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (error) { lastError = error; }
    await sleep(200);
  }
  throw lastError || new Error(`Browser condition timed out at ${currentStage}`);
}

function cdp(socketUrl) {
  const socket = new WebSocket(socketUrl);
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id); pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
  };
  const ready = new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('Chrome DevTools connection failed')); });
  return {
    ready,
    call(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); },
    close() { socket.close(); },
  };
}

function mime(file) {
  return ({ '.html':'text/html', '.js':'text/javascript', '.jsx':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json' })[path.extname(file)] || 'application/octet-stream';
}

async function main() {
  const env = loadEnv(path.join(root, 'supabase.env'));
  const aliases = ['H005_TEST','H005_TEST2','H005_TEST3'];
  const credentials = aliases.map((alias) => ({ alias, id: env[`${alias}_AFFILIATE_ID`], email: env[`${alias}_EMAIL`], password: env[`${alias}_PASSWORD`] }));
  if (credentials.some((item) => !item.id || !item.email || !item.password)) throw new Error('Profile-photo browser credentials are missing');
  if (!fs.existsSync(chromePath)) throw new Error('Chrome is unavailable');

  const appPort = await freePort();
  const debugPort = await freePort();
  const tempRoot = fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir();
  const profileDir = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-profile-photo-'));
  const server = http.createServer((req, res) => {
    const requestPath = new URL(req.url, `http://127.0.0.1:${appPort}`).pathname;
    const relative = requestPath === '/' ? 'SutiApp.html' : decodeURIComponent(requestPath.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(appPort, '127.0.0.1', resolve));
  const chrome = spawn(chromePath, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'about:blank'], { stdio:'ignore', windowsHide:true });

  let protocol;
  let stage = currentStage = 'initialize';
  try {
    const target = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      return (await response.json()).find((item) => item.type === 'page');
    });
    protocol = cdp(target.webSocketDebuggerUrl);
    await protocol.ready;
    await protocol.call('Page.enable');
    await protocol.call('Runtime.enable');
    await protocol.call('Page.navigate', { url: `http://127.0.0.1:${appPort}/SutiApp.html` });
    const evaluate = async (expression) => {
      const result = await protocol.call('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
      if (result.exceptionDetails) throw new Error(`Browser evaluation failed at ${stage}: ${result.exceptionDetails.exception && result.exceptionDetails.exception.description || result.exceptionDetails.text}`);
      return result.result && result.result.value;
    };
    const markerOk = (name, expectedSize) => evaluate(`(() => { const s=window.AffiliateAuth.getState(); const el=document.querySelector('[data-profile-photo-consumer="${name}"]'); const img=el&&el.querySelector('img'); if(!el||!img)return false; const rect=el.getBoundingClientRect(); const style=getComputedStyle(el); return Boolean(el.dataset.avatarPhotoState==='photo'&&img.complete&&img.naturalWidth>0&&img.src===s.affiliateView.photoUrl&&img.src.includes('/storage/v1/object/sign/private-assets/')&&Math.round(rect.width)===${expectedSize}&&Math.round(rect.height)===${expectedSize}&&style.borderRadius==='50%'&&getComputedStyle(img).objectFit==='cover'); })()`);
    const results = {};
    let previousUrl = null;

    for (const credential of credentials) {
      stage = currentStage = credential.alias + ':login';
      await waitFor(() => evaluate("Boolean(document.querySelector('input[type=email]')&&document.querySelector('input[type=password]'))"));
      await evaluate("document.querySelector('input[type=email]').focus()");
      await protocol.call('Input.insertText', { text: credential.email });
      await evaluate("document.querySelector('input[type=password]').focus()");
      await protocol.call('Input.insertText', { text: credential.password });
      await evaluate("document.querySelector('button[type=submit]').click()");
      await waitFor(() => evaluate(`window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'&&window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(credential.id)}&&Boolean(window.AffiliateAuth.getState().affiliateView.photoUrl)`));
      const currentUrl = await evaluate('window.AffiliateAuth.getState().affiliateView.photoUrl');
      if (currentUrl === previousUrl) throw new Error(`${credential.alias} retained previous user photo URL`);
      await waitFor(() => markerOk('header', 44));

      await evaluate("document.querySelector('[data-profile-photo-consumer=header]').closest('button').click()");
      await waitFor(() => markerOk('profile', 84));
      await evaluate("document.querySelector('[data-h006=profile-back]').click()");
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Credencial').click()");
      await waitFor(() => markerOk('credential', 76));

      const sameSource = await evaluate("(() => { const u=window.AffiliateAuth.getState().affiliateView.photoUrl; return [...document.querySelectorAll('[data-profile-photo-consumer] img')].every(img=>img.src===u); })()");
      if (!sameSource) throw new Error(`${credential.alias} consumers use different photo sources`);
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Inicio').click()");
      await waitFor(() => markerOk('header', 44));
      let adminPhoto = null;
      if (credential.alias === 'H005_TEST') {
        stage = currentStage = credential.alias + ':admin-tab';
        await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Admin').click()");
        await waitFor(() => evaluate("document.body.innerText.includes('Panel Administrativo')&&[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Identidad y expediente'))"));
        stage = currentStage = credential.alias + ':admin-target';
        const target = await evaluate(`(async()=>{const rows=await window.AdminRepository.searchAffiliates('00');for(const row of rows){const photo=await window.AffiliateRepository.getProfilePhoto(row.id);if(photo)return {query:row.numero_control||row.full_name||row.display_name,id:row.id};}throw new Error('No searchable affiliate with PHOTO');})()`);
        await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Identidad y expediente')).click()");
        stage = currentStage = credential.alias + ':admin-search';
        try { await waitFor(() => evaluate("Boolean(document.querySelector('input[placeholder*=control]'))"), 10000); }
        catch (error) { const snapshot=await evaluate("({text:document.body.innerText.slice(0,1200),inputs:[...document.querySelectorAll('input')].map(i=>i.placeholder),buttons:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,40)})"); throw new Error(`Identity module did not render: ${JSON.stringify(snapshot)}`); }
        await evaluate("document.querySelector('input[placeholder*=control]').focus()");
        await protocol.call('Input.insertText', { text: target.query });
        await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Buscar').click()");
        adminPhoto = await waitFor(() => evaluate(`(async()=>{const photo=await window.AffiliateRepository.getProfilePhoto(${JSON.stringify(target.id)});const el=document.querySelector('[data-profile-photo-consumer=admin-affiliate]');const img=el&&el.querySelector('img');if(!photo||!el||!img)return false;const rect=el.getBoundingClientRect();return Boolean(el.dataset.avatarPhotoState==='photo'&&img.complete&&img.naturalWidth>0&&img.src===photo.signedUrl&&Math.round(rect.width)===40&&Math.round(rect.height)===40&&getComputedStyle(el).borderRadius==='50%'&&getComputedStyle(img).objectFit==='cover');})()`));
        stage = currentStage = credential.alias + ':admin-return';
        await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Inicio').click()");
        await waitFor(() => markerOk('header', 44));
      }
      await evaluate("document.querySelector('[data-profile-photo-consumer=header]').closest('button').click()");
      await waitFor(() => markerOk('profile', 84));
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Cerrar sesión')).click()");
      await waitFor(() => evaluate("window.AffiliateAuth.getState().phase==='unauthenticated'&&Boolean(document.querySelector('input[type=email]'))&&!document.querySelector('[data-profile-photo-consumer]')"));
      results[credential.alias] = { login:true, affiliate:true, header:true, profile:true, credential:true, admin:adminPhoto, logout:true, no_previous_photo:true };
      previousUrl = currentUrl;
    }

    await protocol.call('Page.reload', { ignoreCache:true });
    await waitFor(() => evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='unauthenticated'&&!document.querySelector('[data-profile-photo-consumer]')"));
    console.log(JSON.stringify({ status:'PASS', accounts:results, cross_user_photo_leakage:false, refresh_re_resolves_from_supabase:true }));
  } finally {
    if (protocol) protocol.close();
    chrome.kill();
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), sleep(2000)]);
    await new Promise((resolve) => server.close(resolve));
    if (profileDir.startsWith(tempRoot + path.sep)) {
      try { fs.rmSync(profileDir, { recursive:true, force:true, maxRetries:5, retryDelay:300 }); } catch (_) {}
    }
  }
}

main().catch((error) => { console.error(JSON.stringify({ status:'FAIL', error:error.message })); process.exitCode=1; });
