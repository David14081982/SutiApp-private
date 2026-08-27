'use strict';
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidenceDir = path.join(root, 'docs', 'qa', 'evidence', 'suti-investment-screen-20260827');
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

async function wait(fn, timeout = 30000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await sleep(160);
  }
  throw last || new Error('timeout');
}

function cdp(url, onEvent) {
  const socket = new WebSocket(url);
  let sequence = 0;
  const pending = new Map();
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
    bind() {
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
          const item = pending.get(message.id); pending.delete(message.id);
          message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
        } else if (message.method) onEvent(message.method, message.params || {});
      };
    },
  };
}

async function main() {
  const values = env();
  if (!values.H005_TEST_EMAIL || !values.H005_TEST_PASSWORD) throw new Error('H005_TEST credentials unavailable');
  const serverPort = await freePort();
  const debugPort = await freePort();
  const tempRoot = process.env.SUTIAPP_TEST_TMP || (fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir());
  const profile = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-investment-'));
  const server = spawn('python', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore', windowsHide: true });
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-allow-origins=*', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const requests = [];
  let page;
  try {
    await wait(async () => (await fetch(`http://127.0.0.1:${serverPort}/SutiApp.html`)).ok);
    const target = await wait(async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      return (await response.json()).find((item) => item.type === 'page');
    });
    page = cdp(target.webSocketDebuggerUrl, (method, params) => {
      if (method === 'Network.requestWillBeSent') requests.push({ url: params.request.url, method: params.request.method });
    });
    page.bind();
    await page.ready;
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable']) await page.call(method);
    const evaluate = async (expression) => {
      const result = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception && result.exceptionDetails.exception.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/SutiApp.html` });
    await wait(() => evaluate("Boolean(document.querySelector('input[type=email]'))"));
    await evaluate("document.querySelector('input[type=email]').focus()");
    await page.call('Input.insertText', { text: values.H005_TEST_EMAIL });
    await evaluate("document.querySelector('input[type=password]').focus()");
    await page.call('Input.insertText', { text: values.H005_TEST_PASSWORD });
    await evaluate("document.querySelector('button[type=submit]').click()");
    await wait(() => evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'&&Boolean(document.querySelector('[data-affiliate-field=topbar-name]'))"), 45000);
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Finanzas').click()");
    await wait(() => evaluate("Boolean(document.querySelector('[data-finance-summary-actions]'))"), 45000);
    await evaluate("[...document.querySelector('[data-finance-summary-actions]').querySelectorAll('button')].find(button=>button.textContent.trim()==='Invertir').click()");
    await wait(() => evaluate("Boolean(document.querySelector('[data-investment-screen]'))"));
    const requestStart = requests.length;

    const snapshot = () => evaluate(`(()=>{const root=document.querySelector('[data-investment-screen]'),scroll=document.querySelector('[data-investment-scroll]'),amount=document.querySelector('[data-investment-amount]'),monthly=document.querySelector('[data-investment-monthly]'),total=document.querySelector('[data-investment-total]'),final=document.querySelector('[data-investment-final]'),chart=document.querySelector('[data-investment-chart-bars]'),footer=document.querySelector('[data-investment-footer-return]');return{screen:Boolean(root),amount:amount&&Number(amount.dataset.investmentAmount),monthly:monthly&&Number(monthly.dataset.investmentMonthly),total:total&&Number(total.dataset.investmentTotal),final:final&&Number(final.dataset.investmentFinal),bars:chart&&Number(chart.dataset.investmentChartBars),barNodes:document.querySelectorAll('.su-inv-bar').length,footer:footer&&Number(footer.dataset.investmentFooterReturn),horizontal:document.documentElement.scrollWidth<=document.documentElement.clientWidth&&root.scrollWidth<=root.clientWidth,scrollable:scroll.scrollHeight>scroll.clientHeight,sections:['Calcula tu rendimiento','Cómo funciona','Tu respaldo'].every(text=>root.innerText.includes(text))};})()`);
    const defaults = await snapshot();
    if (!(defaults.amount === 250000 && defaults.monthly === 6250 && defaults.total === 75000 && defaults.final === 250000 && defaults.bars === 12 && defaults.barNodes === 12 && defaults.footer === 75000 && defaults.horizontal && defaults.scrollable && defaults.sections)) throw new Error('DEFAULT_CONTRACT_FAILED ' + JSON.stringify(defaults));

    async function choose(amount, months) {
      await evaluate(`document.querySelector('[data-amount="${amount}"]').click();document.querySelector('[data-months="${months}"]').click()`);
      await sleep(120);
      return snapshot();
    }
    const low = await choose(50000, 6);
    if (!(low.monthly === 1250 && low.total === 7500 && low.final === 50000 && low.bars === 6 && low.barNodes === 6)) throw new Error('LOW_CASE_FAILED ' + JSON.stringify(low));
    const middle = await choose(250000, 12);
    if (!(middle.monthly === 6250 && middle.total === 75000 && middle.bars === 12)) throw new Error('MIDDLE_CASE_FAILED ' + JSON.stringify(middle));

    await evaluate(`(()=>{const range=document.querySelector('[data-investment-slider]'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(range,'500000');range.dispatchEvent(new Event('input',{bubbles:true}));range.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await sleep(100);
    const slider = await snapshot();
    if (!(slider.amount === 500000 && slider.monthly === 12500)) throw new Error('SLIDER_FAILED ' + JSON.stringify(slider));

    await evaluate("document.querySelector('[data-investment-amount]').click()");
    await wait(() => evaluate("Boolean(document.querySelector('.su-inv-amount-input'))"));
    await evaluate("document.querySelector('.su-inv-amount-input').focus();document.querySelector('.su-inv-amount-input').select()");
    await page.call('Input.insertText', { text: '2000000' });
    await evaluate("document.querySelector('.su-inv-amount-input').blur()");
    await evaluate("document.querySelector('[data-months=\"24\"]').click()");
    await sleep(120);
    const high = await snapshot();
    if (!(high.amount === 2000000 && high.monthly === 50000 && high.total === 1200000 && high.final === 2000000 && high.bars === 24 && high.barNodes === 24)) throw new Error('HIGH_DIRECT_CASE_FAILED ' + JSON.stringify(high));

    await evaluate("document.querySelector('[data-months=\"18\"]').click()");
    await sleep(80);
    const term18 = await snapshot();
    if (!(term18.bars === 18 && term18.barNodes === 18 && term18.total === 900000)) throw new Error('TERM_18_FAILED ' + JSON.stringify(term18));

    const responsive = {};
    fs.mkdirSync(evidenceDir, { recursive: true });
    for (const viewport of [[390, 844], [430, 932], [768, 1024]]) {
      await page.call('Emulation.setDeviceMetricsOverride', { width: viewport[0], height: viewport[1], deviceScaleFactor: 1, mobile: viewport[0] < 600 });
      await sleep(120);
      const key = viewport[0] + 'x' + viewport[1];
      responsive[key] = await snapshot();
      if (!responsive[key].horizontal) throw new Error('HORIZONTAL_OVERFLOW_' + key);
      await evaluate("document.querySelector('[data-investment-scroll]').scrollTop=document.querySelector('[data-investment-scroll]').scrollHeight");
      await sleep(80);
      const shot = await page.call('Page.captureScreenshot', { format: 'png', fromSurface: true });
      fs.writeFileSync(path.join(evidenceDir, 'investment-' + key + '.png'), Buffer.from(shot.data, 'base64'));
      await evaluate("document.querySelector('[data-investment-scroll]').scrollTop=0");
    }

    await evaluate("document.querySelector('[data-investment-cta]').click()");
    await wait(() => evaluate("document.body.innerText.includes('Simulación informativa · inversión no enviada')"));
    const routeStillOpen = await evaluate("Boolean(document.querySelector('[data-investment-screen]'))");
    if (!routeStillOpen) throw new Error('CTA_LEFT_INTERNAL_ROUTE');
    const screenRequests = requests.slice(requestStart);
    const forbiddenRequests = screenRequests.filter((item) => /google|wa\.me/i.test(item.url) || (/supabase\.co/i.test(item.url) && /POST|PUT|PATCH|DELETE/i.test(item.method)));
    if (forbiddenRequests.length) throw new Error('FORBIDDEN_SCREEN_REQUESTS ' + JSON.stringify(forbiddenRequests));

    await evaluate("document.querySelector('[data-investment-back]').click()");
    await wait(() => evaluate("!document.querySelector('[data-investment-screen]')&&Boolean(document.querySelector('[data-finance-summary-actions]'))"));
    console.log(JSON.stringify({ status: 'PASS', defaults, low, middle, slider, high, term18, responsive, forbiddenRequests, back: true }, null, 2));
  } finally {
    if (page) page.close();
    chrome.kill();
    server.kill();
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); } catch (_) {}
  }
}

main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.stack || error.message })); process.exitCode = 1; });
