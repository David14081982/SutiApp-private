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

function readEnv() {
  const result = {};
  const contents = fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '');
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    result[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return result;
}

async function management(env, query) {
  const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'SutiApp-RequiredDocuments/1.0' },
    body: JSON.stringify({ query }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`MANAGEMENT_${response.status}:${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const literal = (value) => value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`;

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const selected = server.address().port;
    server.close(() => resolve(selected));
  });
});

async function waitFor(check, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
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

function connectCdp(url) {
  const socket = new WebSocket(url);
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
  };
  return {
    ready: new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    }),
    call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function main() {
  let stage = 'start';
  const env = readEnv();
  const loanOnly = process.argv.includes('--loan-only');
  const testAffiliateId = loanOnly ? env.H005_TEST_AFFILIATE_ID : env.H005_TEST2_AFFILIATE_ID;
  const testEmail = loanOnly ? env.H005_TEST_EMAIL : env.H005_TEST2_EMAIL;
  const testPassword = loanOnly ? env.H005_TEST_PASSWORD : env.H005_TEST2_PASSWORD;
  const stamp = String(Date.now());
  const depositCard = '7' + stamp.padStart(15, '0').slice(-15);
  const depositClabe = '032180000118359719';
  const depositPhone = '6621234567';
  const depositBank = 'Banco Docs E2E ' + stamp.slice(-6);
  const originalPhoneRow = await management(env, `select notification_phone from public.affiliates where id='${testAffiliateId}'::uuid`);
  const originalPhone = originalPhoneRow[0] ? originalPhoneRow[0].notification_phone : null;
  const appPort = 8080;
  const debugPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'suti-required-docs-'));
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://local').pathname;
    const relative = pathname === '/' ? 'SutiApp.html' : decodeURIComponent(pathname.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': path.extname(file) === '.html' ? 'text/html' : 'text/javascript',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(appPort, '127.0.0.1', resolve);
  });

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  let page;
  try {
    stage = 'connect';
    const target = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      return (await response.json()).find((entry) => entry.type === 'page');
    });
    page = connectCdp(target.webSocketDebuggerUrl);
    await page.ready;
    await page.call('Page.enable');
    await page.call('Runtime.enable');
    const evaluate = async (expression) => {
      const result = await page.call('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        const detail = result.exceptionDetails.exception && result.exceptionDetails.exception.description;
        throw new Error(detail || result.exceptionDetails.text);
      }
      return result.result && result.result.value;
    };
    const setValue = async (selector, value) => evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const click = (label) => evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button')];
      const button = buttons.find((item) => item.textContent.trim() === ${JSON.stringify(label)})
        || buttons.find((item) => item.textContent.includes(${JSON.stringify(label)}));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    const advanceDeposit = async () => {
      await waitFor(() => evaluate("Boolean(document.querySelector('[data-loan-flow-step=\"1\"]') && document.querySelector('[data-loan-deposit-step=\"ready\"]'))"), 30000);
      if (!await evaluate("Boolean(document.querySelector('[data-deposit-account-form]'))")) await click('Agregar nueva cuenta');
      await waitFor(() => evaluate("Boolean(document.querySelector('[data-deposit-account-form]'))"));
      await setValue('[data-deposit-account-form] label:nth-of-type(1) input', depositBank);
      await setValue('[data-deposit-account-form] label:nth-of-type(2) input', depositCard);
      await setValue('[data-deposit-account-form] label:nth-of-type(3) input', depositClabe);
      await setValue('input[autocomplete="tel-national"]', depositPhone);
      await waitFor(() => evaluate("[...document.querySelectorAll('button')].some((button) => button.textContent.includes('Guardar cuenta') && !button.disabled)"));
      await click('Guardar cuenta');
      await waitFor(() => evaluate(`Boolean(document.querySelector('[data-loan-deposit-step="ready"]') && !document.querySelector('[data-deposit-account-form]') && document.body.innerText.includes('•••• ${depositCard.slice(-4)}'))`));
      await click('Continuar');
    };

    await page.call('Page.navigate', { url: `http://localhost:${appPort}/SutiApp.html` });
    await waitFor(() => evaluate("Boolean(document.querySelector('input[type=email]'))"));
    await setValue('input[type=email]', testEmail);
    await setValue('input[type=password]', testPassword);
    await evaluate("document.querySelector('button[type=submit]').click()");
    await waitFor(() => evaluate("window.AffiliateAuth?.getState().phase === 'authenticated'"));

    if (process.argv.includes('--loan-only')) {
      stage = 'loan_navigation';
      await evaluate("document.querySelector('[data-app-tab=\"financiera\"]').click()");
      stage = 'loan_finance_store';
      await evaluate("window.financialLegacyStore.loadOverview()");
      const financialState = await waitFor(() => evaluate("(() => { const value=window.financialLegacyStore.snapshot(); return ['ready','error'].includes(value.status)?{status:value.status,error:value.error||null}:null; })()"), 120000);
      if (financialState.status !== 'ready') throw new Error(`FINANCIAL_STORE_UNAVAILABLE:${JSON.stringify(financialState)}`);
      stage = 'loan_open';
      await evaluate(`(() => { const button = document.querySelector('button[aria-label^="Solicitar pr"]'); if (!button) return false; button.click(); return true; })()`);
      stage = 'loan_simulator';
      await waitFor(() => evaluate("Boolean(document.querySelector('[data-step-simulator-v2]'))"));
      stage = 'loan_quote';
      await waitFor(() => evaluate("Boolean(document.querySelector('[data-simulator-result=ready]'))"), 120000);
      await evaluate("document.querySelector('[data-loan-flow-footer] button').click()");
      stage = 'loan_deposit';
      await advanceDeposit();
      stage = 'loan_documents';
      await waitFor(() => evaluate("document.querySelector('[data-loan-flow-step=\"2\"]') && document.querySelectorAll('[data-document-type]').length > 0"));
      const loanExpected = await evaluate("window.DocumentWorkflowRepository.requirements('prestamo').then((items) => items.length)");
      const loan = await evaluate(`(() => {
        const rows = [...document.querySelectorAll('[data-document-type]')];
        return {
          rows: rows.length,
          titleCount: [...document.querySelectorAll('h2')].filter((heading) => heading.textContent.trim() === 'Verifica tus documentos').length,
          error: document.body.innerText.includes('No fue posible consultar los requisitos'),
          missingActionable: rows.filter((row) => ['MISSING', 'REUPLOAD_REQUIRED', 'REJECTED'].includes(row.dataset.documentStatus))
            .every((row) => [...row.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Subir' || button.dataset.documentAction === 'upload')),
        };
      })()`);
      if (loan.rows !== loanExpected || loan.titleCount !== 1 || loan.error || !loan.missingActionable) {
        throw new Error(`REQUIRED_DOCUMENT_UI_MISMATCH:${JSON.stringify({ loanExpected, loan })}`);
      }
      console.log(JSON.stringify({ status: 'PASS', browser: 'Chrome', loan: { requirements: loan.rows, uploadControls: true } }));
      return;
    }

    stage = 'membership_navigation';
    await click('Finanzas');
    stage = 'membership_store';
    await waitFor(() => evaluate("['loaded','error'].includes(window.membershipStore?.state().phase)"));
    const membershipState = await evaluate(`(() => {
      const state=window.membershipStore.state(),error=state.error;
      return {phase:state.phase,error:error?{message:error.message||null,code:error.code||null,details:error.details||null,hint:error.hint||null}:null,count:window.membershipStore.active().length};
    })()`);
    if (membershipState.phase !== 'loaded' || membershipState.count < 1) {
      throw new Error(`MEMBERSHIP_STORE_UNAVAILABLE:${JSON.stringify(membershipState)}`);
    }
    const membershipId = await evaluate('window.membershipStore.active()[0].id');
    const membershipExpected = await evaluate(`window.DocumentWorkflowRepository.requirements('membership', ${JSON.stringify(membershipId)}).then((items) => items.length)`);
    stage = 'membership_open';
    await evaluate(`document.querySelector('[data-reveal-key=${JSON.stringify(membershipId)}]').click()`);
    stage = 'membership_documents';
    await waitFor(() => evaluate("document.querySelector('[data-membership-application]') && document.querySelectorAll('[data-document-type]').length > 0"));
    const membership = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('[data-document-type]')];
      return {
        rows: rows.length,
        error: document.body.innerText.includes('No fue posible consultar los requisitos autorizados.'),
        missingActionable: rows.filter((row) => ['MISSING', 'REUPLOAD_REQUIRED', 'REJECTED'].includes(row.dataset.documentStatus))
          .every((row) => [...row.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Subir' || button.dataset.documentAction === 'upload')),
      };
    })()`);

    if (process.argv.includes('--membership-only')) {
      if (membership.rows !== membershipExpected || membership.error || !membership.missingActionable) {
        throw new Error(`REQUIRED_DOCUMENT_UI_MISMATCH:${JSON.stringify({ membershipExpected, membership })}`);
      }
      console.log(JSON.stringify({ status: 'PASS', browser: 'Chrome', membership: { requirements: membership.rows, uploadControls: true } }));
      return;
    }

    stage = 'loan_navigation';
    await evaluate("document.querySelector('[data-membership-application] header button').click()");
    await waitFor(() => evaluate("!document.querySelector('[data-membership-application]')"));
    await evaluate("window.financialLegacyStore.loadOverview()");
    await waitFor(() => evaluate("window.financialLegacyStore.snapshot().status === 'ready'"));
    await evaluate(`(() => { const button = document.querySelector('button[aria-label^="Solicitar pr"]'); if (!button) return false; button.click(); return true; })()`);
    stage = 'loan_simulator';
    await waitFor(() => evaluate("Boolean(document.querySelector('[data-step-simulator-v2]'))"));
    stage = 'loan_quote';
    await waitFor(() => evaluate("Boolean(document.querySelector('[data-simulator-result=ready]'))"), 120000);
    await click('Continuar');
    stage = 'loan_deposit';
    await advanceDeposit();
    stage = 'loan_documents';
    await waitFor(() => evaluate("document.querySelector('[data-loan-flow-step=\"2\"]') && document.querySelectorAll('[data-document-type]').length > 0"));
    const loanExpected = await evaluate("window.DocumentWorkflowRepository.requirements('prestamo').then((items) => items.length)");
    const loan = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('[data-document-type]')];
      return {
        rows: rows.length,
        titleCount: [...document.querySelectorAll('h2')].filter((heading) => heading.textContent.trim() === 'Verifica tus documentos').length,
        error: document.body.innerText.includes('No fue posible consultar los requisitos'),
        missingActionable: rows.filter((row) => ['MISSING', 'REUPLOAD_REQUIRED', 'REJECTED'].includes(row.dataset.documentStatus))
          .every((row) => [...row.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Subir' || button.dataset.documentAction === 'upload')),
      };
    })()`);

    if (membership.rows !== membershipExpected || membership.error || !membership.missingActionable
      || loan.rows !== loanExpected || loan.titleCount !== 1 || loan.error || !loan.missingActionable) {
      throw new Error(`REQUIRED_DOCUMENT_UI_MISMATCH:${JSON.stringify({ membershipExpected, membership, loanExpected, loan })}`);
    }
    console.log(JSON.stringify({
      status: 'PASS',
      browser: 'Chrome',
      membership: { requirements: membership.rows, uploadControls: true },
      loan: { requirements: loan.rows, uploadControls: true },
      sharedAuthority: 'program_document_requirements',
    }));
  } catch (error) {
    throw new Error(`${stage}: ${error.message}`);
  } finally {
    try {
      await management(env, `begin; delete from public.affiliate_bank_accounts where affiliate_id='${testAffiliateId}'::uuid and card_number=${literal(depositCard)} and bank_name=${literal(depositBank)}; update public.affiliates set notification_phone=${literal(originalPhone)} where id='${testAffiliateId}'::uuid; commit;`);
    } catch (_) {}
    if (page) page.close();
    chrome.kill();
    server.closeAllConnections?.();
    server.close();
    await sleep(700);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error && error.message || error) }));
  process.exitCode = 1;
});
