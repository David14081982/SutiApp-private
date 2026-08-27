'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function port() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)); }); }); }
async function wait(fn, timeout = 10000) { const end = Date.now() + timeout; let failure; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (error) { failure = error; } await sleep(50); } throw failure || new Error('timeout'); }
function cdp(url) { const socket = new WebSocket(url); let id = 0; const pending = new Map(); socket.onmessage = (event) => { const message = JSON.parse(event.data); if (!message.id) return; const item = pending.get(message.id); if (!item) return; pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); }; return { ready: new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }), call(method, params = {}) { return new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, close() { socket.close(); } }; }

(async () => {
  const appPort = await port();
  const debugPort = await port();
  const tempRoot = 'C:\\tmp';
  const profile = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-home-banner-'));
  let server;
  let chrome;
  let protocol;
  let stage = 'start';
  try {
    server = http.createServer((request, response) => {
      const pathname = new URL(request.url, `http://127.0.0.1:${appPort}`).pathname;
      const relative = pathname === '/' ? 'SutiApp.html' : decodeURIComponent(pathname.slice(1));
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': path.extname(file) === '.js' ? 'text/javascript' : path.extname(file) === '.html' ? 'text/html' : 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(response);
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(appPort, '127.0.0.1', resolve); });
    chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    const target = await wait(async () => { const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`); return (await response.json()).find((item) => item.type === 'page'); });
    protocol = cdp(target.webSocketDebuggerUrl);
    await protocol.ready;
    await protocol.call('Page.enable');
    await protocol.call('Runtime.enable');
    const evaluate = async (expression) => { const result = await protocol.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception && result.exceptionDetails.exception.description || 'evaluation failed'); return result.result && result.result.value; };
    await protocol.call('Page.navigate', { url: `http://127.0.0.1:${appPort}/SutiApp.html?home-banner-test=1` });
    stage = 'boot';
    await wait(() => evaluate('Boolean(window.React && window.ReactDOM && window.HomeScreen)'));
    stage = 'mount';
    await evaluate(`(() => {
      if (window.__homeBannerRoot) window.__homeBannerRoot.unmount();
      document.body.innerHTML = '<div id="root"></div><div id="home-banner-host"></div>';
      window.TopBar = () => React.createElement('header', {'data-test-topbar': '', style: {height: 96}});
      window.SectionHead = ({title}) => React.createElement('h2', null, title);
      window.SutiSeal = () => React.createElement('span');
      window.Icon = () => React.createElement('span');
      window.useReveal = () => {};
      window.UNION_SCREEN_REGISTRY = [];
      window.useQuoteStore = () => null;
      window.useFinancialLegacy = () => ({status: 'error', overview: null});
      window.financialLegacyStore = null;
      const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="760" height="448"><rect width="100%" height="100%" fill="#8f0025"/></svg>');
      const banners = [{id: 'a', title: 'Banner A', image_url: 'data:image/svg+xml,' + svg}, {id: 'b', title: 'Banner B', image_url: 'data:image/svg+xml,' + svg}];
      const app = {user: {short: 'Fixture', name: 'Fixture'}, visual: {phase: 'loaded', homeBanners: banners, branding: null}, editorial: {phase: 'loaded', news: []}, institutional: {phase: 'loaded', directory: []}, push() {}, setTab() {}, toast() {}};
      window.__homeBannerRoot = ReactDOM.createRoot(document.getElementById('home-banner-host'));
      window.__homeBannerRoot.render(React.createElement(window.HomeScreen, {app}));
      return true;
    })()`);

    const viewports = [[390, 844], [430, 932]];
    const results = [];
    for (const [width, height] of viewports) {
      await protocol.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2.75, mobile: true, screenWidth: width, screenHeight: height });
      const measured = await wait(() => evaluate(`(() => {
        const host = document.getElementById('home-banner-host');
        const banner = host && host.querySelector('[data-home-banner-layout="expanded"]');
        const first = host && host.querySelector('[data-reveal-key]');
        if (!banner || !first) return null;
        return {height: banner.getBoundingClientRect().height, first: first.getAttribute('data-reveal-key'), order: [...host.querySelectorAll('[data-reveal-key]')].map((node) => node.getAttribute('data-reveal-key')), quick: Boolean(host.querySelector('[data-reveal-key="quick_actions"]')), dots: host.querySelectorAll('[data-home-banner-dots] button').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, objectFit: getComputedStyle(banner.querySelector('img')).objectFit};
      })()`));
      if (measured.height !== 224 || measured.first !== 'banner_convenio' || measured.order.slice(0, 4).join(',') !== 'banner_convenio,ecosistema,comite,noticias' || measured.quick || measured.dots !== 2 || measured.overflow > 0 || measured.objectFit !== 'cover') throw new Error(`${width}x${height} layout mismatch ${JSON.stringify(measured)}`);
      results.push({viewport: `${width}x${height}`, ...measured});
    }
    stage = 'carousel';
    await evaluate(`document.querySelectorAll('#home-banner-host [data-home-banner-dots] button')[1].click()`);
    const index = await wait(() => evaluate(`document.querySelector('#home-banner-host [data-home-banner-index]').getAttribute('data-home-banner-index') === '1' ? 1 : 0`));
    if (index !== 1) throw new Error('banner dot navigation did not update selection');
    console.log(JSON.stringify({status: 'PASS', real_browser: true, results, carousel_dot_navigation: 'PASS', removed_home_quick_actions: 4}));
  } catch (error) {
    throw new Error(stage + ': ' + error.message);
  } finally {
    if (protocol) protocol.close();
    if (chrome) { spawnSync('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], {stdio: 'ignore', windowsHide: true}); await sleep(300); }
    if (server) await new Promise((resolve) => server.close(resolve));
    if (profile.startsWith(tempRoot + path.sep)) try { fs.rmSync(profile, {recursive: true, force: true, maxRetries: 8, retryDelay: 100}); } catch (_) {}
  }
})().catch((error) => { console.error(JSON.stringify({status: 'FAIL', error: error.message})); process.exitCode = 1; });
