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

async function waitFor(check, timeout = 30000) {
  const end = Date.now() + timeout;
  let lastError;
  while (Date.now() < end) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError || new Error('timeout');
}

function cdp(url) {
  const socket = new WebSocket(url);
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const promise = pending.get(message.id);
    pending.delete(message.id);
    message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
  };
  return {
    ready: new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }),
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

async function adminContext(values) {
  const base = values.SUPABASE_URL.replace(/\/$/, '');
  const headers = { apikey: values.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  const login = await fetch(base + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers, body: JSON.stringify({ email: values.H005_TEST_EMAIL, password: values.H005_TEST_PASSWORD }),
  });
  if (!login.ok) throw new Error('admin login precondition failed');
  const token = (await login.json()).access_token;
  const authorized = Object.assign({}, headers, { Authorization: 'Bearer ' + token });
  const rows = await fetch(base + '/rest/v1/membership_offerings?select=id,company_raw,enabled&company_raw=eq.Bud%20Tv%20Ultra', { headers: authorized });
  const data = await rows.json();
  if (!rows.ok || data.length !== 1) throw new Error('Bud Tv Ultra precondition missing');
  return {
    row: data[0],
    async setEnabled(enabled) {
      const response = await fetch(base + '/rest/v1/membership_offerings?id=eq.' + data[0].id, {
        method: 'PATCH', headers: Object.assign({}, authorized, { Prefer: 'return=representation' }), body: JSON.stringify({ enabled }),
      });
      const result = await response.json();
      if (!response.ok || result.length !== 1 || result[0].enabled !== enabled) throw new Error('enabled precondition write failed');
    },
  };
}

async function main() {
  let stage = 'start';
  let page;
  const values = env();
  const authority = await adminContext(values);
  const appPort = await freePort();
  const debugPort = await freePort();
  const tempRoot = fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir();
  const profile = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-membership-enabled-'));
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, `http://127.0.0.1:${appPort}`).pathname;
    const relative = pathname === '/' ? 'SutiApp.html' : decodeURIComponent(pathname.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { response.writeHead(404).end(); return; }
    const ext = path.extname(file);
    response.writeHead(200, { 'Content-Type': ext === '.js' ? 'text/javascript' : ext === '.html' ? 'text/html' : 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(appPort, '127.0.0.1', resolve));
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });

  try {
    await authority.setEnabled(false);
    stage = 'connect';
    const target = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      return (await response.json()).find((item) => item.type === 'page');
    });
    page = cdp(target.webSocketDebuggerUrl);
    await page.ready;
    await page.call('Page.enable');
    await page.call('Runtime.enable');
    const evaluate = async (expression) => {
      const result = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error('browser evaluation failed');
      return result.result && result.result.value;
    };

    await page.call('Page.navigate', { url: `http://127.0.0.1:${appPort}/SutiApp.html` });
    await waitFor(() => evaluate("Boolean(document.querySelector('input[type=email]'))"));
    await evaluate("document.querySelector('input[type=email]').focus()");
    await page.call('Input.insertText', { text: values.H005_TEST_EMAIL });
    await evaluate("document.querySelector('input[type=password]').focus()");
    await page.call('Input.insertText', { text: values.H005_TEST_PASSWORD });
    await evaluate("document.querySelector('button[type=submit]').click()");
    await waitFor(() => evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'"));

    stage = 'admin switch';
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Admin').click()");
    await waitFor(() => evaluate("document.body.innerText.includes('Panel Administrativo')"));
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Membresías')).click()");
    stage = 'admin inactive state';
    await waitFor(() => evaluate("document.body.innerText.includes('5 activa(s) de 6')&&document.body.innerText.includes('Bud Tv Ultra')"));
    const clicked = await evaluate("(()=>{const b=[...document.querySelectorAll('button[aria-label=\"Activar\"]')].find(x=>x.parentElement.parentElement.innerText.includes('Bud Tv Ultra'));if(!b)return false;b.click();return true;})()");
    if (!clicked) throw new Error('Bud Tv Ultra activation switch not found');
    stage = 'admin activation persistence';
    await waitFor(() => evaluate("window.membershipStore.get(" + JSON.stringify(authority.row.id) + ")?.activo===true&&document.body.innerText.includes('6 activa(s) de 6')"));

    stage = 'desktop finance persistence';
    await page.call('Page.navigate', { url: `http://127.0.0.1:${appPort}/SutiApp.html` });
    await waitFor(() => evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'"));
    await waitFor(() => evaluate("Boolean([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Finanzas'))"));
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Finanzas').click()");
    await waitFor(() => evaluate("window.membershipStore&&window.membershipStore.state().phase==='loaded'&&document.body.innerText.includes('Bud Tv Ultra')"));
    const desktopShot = await page.call('Page.captureScreenshot', { format: 'png' });
    const desktopPath = path.join(tempRoot, 'sutiapp-membership-enabled-desktop.png');
    fs.writeFileSync(desktopPath, Buffer.from(desktopShot.data, 'base64'));

    stage = 'mobile finance';
    await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitFor(() => evaluate("document.body.innerText.includes('Bud Tv Ultra')&&innerWidth===390"));
    const mobileShot = await page.call('Page.captureScreenshot', { format: 'png' });
    const mobilePath = path.join(tempRoot, 'sutiapp-membership-enabled-mobile.png');
    fs.writeFileSync(mobilePath, Buffer.from(mobileShot.data, 'base64'));

    console.log(JSON.stringify({ status: 'PASS', real_browser: true, admin_switch: true, refresh_persistence: true, finance_card: true, desktop: 'PASS', mobile: 'PASS', screenshots: [desktopPath, mobilePath] }));
  } catch (error) {
    let debugPath = '';
    if (page) {
      try {
        const shot = await page.call('Page.captureScreenshot', { format: 'png' });
        debugPath = path.join(tempRoot, 'sutiapp-membership-enabled-failure.png');
        fs.writeFileSync(debugPath, Buffer.from(shot.data, 'base64'));
      } catch (_) {}
    }
    throw new Error(stage + ': ' + error.message + (debugPath ? ' (' + debugPath + ')' : ''));
  } finally {
    await authority.setEnabled(true).catch(() => {});
    if (page) page.close();
    chrome.kill();
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), sleep(2000)]);
    await new Promise((resolve) => server.close(resolve));
    if (profile.startsWith(tempRoot + path.sep)) {
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (_) {}
    }
  }
}

main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message })); process.exitCode = 1; });
