'use strict';

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidenceDir = path.join(root, 'docs', 'qa', 'evidence', 'membership-request-ui-cutover-20260827');
const secondary = process.argv.includes('--secondary');
const accountKey = secondary ? 'H005_TEST3' : 'H005_TEST2';
const artifactPrefix = secondary ? 'membership-secondary-' : 'membership-';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readEnv() {
  const values = {};
  const contents = fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '');
  for (const raw of contents.split(/\r?\n/)) {
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

async function waitFor(check, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(180);
  }
  throw lastError || new Error('timeout');
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
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

async function browserAuthority() {
  const id = window.__membershipTestId;
  const [requirements, documents, terms] = await Promise.all([
    window.DocumentWorkflowRepository.requirements('membership', id),
    window.DocumentWorkflowRepository.list(),
    window.ProgramTermsRepository.current('membership', id),
  ]);
  const offering = window.membershipStore.get(id);
  const accepted = new Set(['PENDING_REVIEW', 'UNDER_REVIEW', 'VERIFIED']);
  return {
    company: offering.empresa,
    concept: offering.concepto,
    total: Number(offering.monto),
    installments: Number(offering.pagos),
    fortnight: Number(offering.monto) / Math.max(1, Number(offering.pagos)),
    requirementCount: requirements.length,
    requiredCount: requirements.filter((row) => row.required === true).length,
    satisfiedRequired: requirements.filter((row) => row.required === true
      && documents.some((doc) => doc.document_type_id === row.document_type_id && accepted.has(doc.status))).length,
    termsPublished: Boolean(terms),
  };
}

async function browserMembershipSelection() {
  const offerings = window.membershipStore.active();
  const rows = await Promise.all(offerings.map(async (offering) => ({
    id: offering.id,
    company: offering.empresa,
    termsPublished: Boolean(await window.ProgramTermsRepository.current('membership', offering.id)),
  })));
  const selected = rows.find((row) => row.termsPublished) || rows[0];
  return { selectedId: selected.id, offerings: rows };
}

function browserSnapshot() {
  const root = document.querySelector('[data-membership-application]');
  const scroll = root.querySelector('.mr-scroll');
  const hero = root.querySelector('.mr-hero');
  const tracker = root.querySelector('.mr-tracker');
  const footer = root.querySelector('.mr-footer');
  const grid = root.querySelector('[data-document-grid=membership]');
  const submit = root.querySelector('[data-membership-submit]');
  const rootRect = root.getBoundingClientRect();
  const heroRect = hero.getBoundingClientRect();
  const trackerRect = tracker.getBoundingClientRect();
  const footerRect = footer.getBoundingClientRect();
  return {
    viewport: [innerWidth, innerHeight],
    screen: Boolean(root),
    phase: root.dataset.membershipPhase,
    company: root.querySelector('[data-membership-company]')?.textContent || '',
    concept: root.querySelector('[data-membership-concept]')?.textContent || '',
    total: Number(root.querySelector('[data-membership-total]')?.dataset.membershipTotal),
    installments: Number(root.querySelector('[data-membership-installments]')?.dataset.membershipInstallments),
    fortnight: Number(root.querySelector('[data-membership-fortnight]')?.dataset.membershipFortnight),
    trackerTotal: Number(tracker.dataset.requirementCount),
    trackerMissing: Number(tracker.dataset.requirementMissing),
    trackerText: tracker.querySelector('.mr-count')?.textContent || '',
    chips: [...tracker.querySelectorAll('[data-missing-kind]')].map((chip) => ({
      kind: chip.dataset.missingKind,
      label: chip.textContent.trim(),
    })),
    documents: [...root.querySelectorAll('[data-document-type]')].map((row) => ({
      code: row.dataset.documentType,
      status: row.dataset.documentStatus,
      required: row.dataset.documentRequired,
      action: row.querySelector('[data-document-action]')?.dataset.documentAction || '',
    })),
    thumbnailCount: root.querySelectorAll('.mr-doc-thumb').length,
    fields: [...root.querySelectorAll('[data-membership-field]')].map((row) => ({
      id: row.dataset.membershipField,
      filled: Boolean(row.querySelector('input').value),
      valid: Boolean(row.querySelector('.mr-field-mark svg')),
      invalidVisible: row.classList.contains('is-bad'),
    })),
    sections: [...root.querySelectorAll('.mr-section-head h2')].map((node) => node.textContent.trim()),
    privacy: root.querySelector('.mr-privacy')?.textContent.trim() || '',
    termsMissing: root.innerText.includes('aún no tiene términos publicados'),
    submitReady: submit.dataset.membershipReady === 'true',
    submitDisabled: submit.disabled,
    submitText: submit.textContent.trim(),
    gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
    horizontal: document.documentElement.scrollWidth <= document.documentElement.clientWidth && root.scrollWidth <= root.clientWidth,
    scrollable: scroll.scrollHeight > scroll.clientHeight,
    footerFixed: Math.abs(rootRect.bottom - footerRect.bottom) < 1,
    trackerOverlap: trackerRect.top < heroRect.bottom && trackerRect.bottom > heroRect.bottom,
    sealPresent: Boolean(root.querySelector('.mr-seal [data-branding-seal-state]')),
    logoSource: root.querySelector('[data-membership-logo-source]')?.dataset.membershipLogoSource || '',
    oldLayoutRemaining: Boolean(root.querySelector('.su-list-documents,.membership-old-layout')),
  };
}

function browserClickFirstChip() {
  const chip = document.querySelector('.mr-chip');
  if (!chip) return null;
  const result = { kind: chip.dataset.missingKind, id: chip.dataset.missingId };
  chip.click();
  return result;
}

function browserChipFocus() {
  const active = document.activeElement;
  return {
    activeField: active?.closest('[data-membership-field]')?.dataset.membershipField || '',
    activeAction: active?.dataset.documentAction || '',
    highlighted: Boolean(document.querySelector('.mr-doc-tile.is-highlighted,.mr-row.is-highlighted')),
  };
}

function browserInvalidatePhone() {
  const input = document.querySelector('#membership-phone');
  window.__membershipPhoneBeforeTest = input.value;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  input.focus();
  setter.call(input, '1');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
  input.blur();
}

function browserRestorePhone() {
  const row = document.querySelector('[data-membership-field=phone]');
  const input = row.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const result = {
    invalidVisible: row.classList.contains('is-bad'),
    ariaInvalid: input.getAttribute('aria-invalid'),
  };
  setter.call(input, window.__membershipPhoneBeforeTest || '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  delete window.__membershipPhoneBeforeTest;
  return result;
}

async function main() {
  const env = readEnv();
  if (!env[accountKey + '_EMAIL'] || !env[accountKey + '_PASSWORD']) throw new Error(accountKey + ' credentials unavailable');
  const serverPort = await freePort();
  const debugPort = await freePort();
  const tempRoot = process.env.SUTIAPP_MEMBERSHIP_TEST_TMP || (fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir());
  const profile = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-membership-ui-'));
  const server = spawn('python', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true,
  });
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--remote-allow-origins=*',
    '--remote-debugging-port=' + debugPort,
    '--user-data-dir=' + profile,
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  let page;
  try {
    await waitFor(async () => (await fetch('http://127.0.0.1:' + serverPort + '/SutiApp.html')).ok);
    const target = await waitFor(async () => {
      const response = await fetch('http://127.0.0.1:' + debugPort + '/json/list');
      return (await response.json()).find((item) => item.type === 'page');
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
    const setInput = (selector, value) => evaluate("(() => { const input=document.querySelector(" + JSON.stringify(selector)
      + "); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,"
      + JSON.stringify(value) + "); input.dispatchEvent(new Event('input',{bubbles:true})); })()");

    await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.call('Page.navigate', { url: 'http://127.0.0.1:' + serverPort + '/SutiApp.html' });
    await waitFor(() => evaluate("Boolean(document.querySelector('input[type=email]'))"));
    await setInput('input[type=email]', env[accountKey + '_EMAIL']);
    await setInput('input[type=password]', env[accountKey + '_PASSWORD']);
    await evaluate("document.querySelector('button[type=submit]').click()");
    await waitFor(() => evaluate("window.AffiliateAuth?.getState().phase === 'authenticated'"), 60000);
    await evaluate("[...document.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Finanzas').click()");
    await waitFor(() => evaluate("window.membershipStore?.state().phase === 'loaded' && window.membershipStore.active().length > 0"), 60000);

    const membershipSelection = await evaluate('(' + browserMembershipSelection.toString() + ')()');
    const membershipId = membershipSelection.selectedId;
    await evaluate('window.__membershipTestId=' + JSON.stringify(membershipId));
    const authority = await evaluate('(' + browserAuthority.toString() + ')()');
    await evaluate("document.querySelector('[data-reveal-key=\"' + window.__membershipTestId + '\"]').click()");
    await waitFor(() => evaluate("document.querySelector('[data-membership-application][data-membership-phase=\"ready\"]') && document.querySelectorAll('[data-document-type]').length > 0"), 60000);

    const snapshot = () => evaluate('(' + browserSnapshot.toString() + ')()');
    const responsive = {};
    fs.mkdirSync(evidenceDir, { recursive: true });
    await evaluate("(() => { const style=document.createElement('style'); style.id='membership-evidence-redaction'; style.textContent='.mr-doc-thumb{visibility:hidden!important}.mr-input{-webkit-text-security:disc!important;color:transparent!important;text-shadow:none!important}'; document.head.appendChild(style); })()");
    for (const viewport of [[390, 844], [430, 932], [768, 1024]]) {
      const width = viewport[0];
      const height = viewport[1];
      await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      await sleep(180);
      await evaluate("document.querySelector('.mr-scroll').scrollTop=0");
      await sleep(100);
      const key = width + 'x' + height;
      responsive[key] = await snapshot();
      if (!responsive[key].horizontal || !responsive[key].footerFixed || !responsive[key].trackerOverlap || responsive[key].gridColumns !== 2) {
        throw new Error('RESPONSIVE_CONTRACT_FAILED_' + key + ' ' + JSON.stringify(responsive[key]));
      }
      const top = await page.call('Page.captureScreenshot', { format: 'png', fromSurface: true });
      fs.writeFileSync(path.join(evidenceDir, artifactPrefix + key + '-top.png'), Buffer.from(top.data, 'base64'));
      await evaluate("document.querySelector('.mr-scroll').scrollTop=document.querySelector('.mr-scroll').scrollHeight");
      await sleep(120);
      const bottom = await page.call('Page.captureScreenshot', { format: 'png', fromSurface: true });
      fs.writeFileSync(path.join(evidenceDir, artifactPrefix + key + '-bottom.png'), Buffer.from(bottom.data, 'base64'));
    }
    await page.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('.mr-scroll').scrollTop=0");
    await sleep(100);
    const current = await snapshot();

    if (current.company !== authority.company || current.concept !== authority.concept
      || current.total !== authority.total || current.installments !== authority.installments
      || Math.abs(current.fortnight - authority.fortnight) > 0.001) {
      throw new Error('ADMIN_DATA_MISMATCH ' + JSON.stringify({ authority, current }));
    }
    if (current.documents.length !== authority.requirementCount || current.trackerTotal !== authority.requiredCount + 3) {
      throw new Error('DYNAMIC_REQUIREMENT_MISMATCH ' + JSON.stringify({ authority, current }));
    }
    if (current.chips.length !== current.trackerMissing) throw new Error('MISSING_CHIP_MISMATCH ' + JSON.stringify(current));
    if (!current.sections.includes('Documentos') || !current.sections.includes('Tus datos') || !current.privacy.includes('cifrados')) {
      throw new Error('VISUAL_SECTION_MISMATCH ' + JSON.stringify(current));
    }
    const missingDocumentControls = current.documents
      .filter((row) => ['MISSING', 'REJECTED', 'REUPLOAD_REQUIRED'].includes(row.status))
      .every((row) => row.action === 'upload');
    if (!missingDocumentControls) throw new Error('UPLOAD_ACTION_MISMATCH ' + JSON.stringify(current.documents));
    const shouldEnable = current.trackerMissing === 0 && authority.termsPublished;
    if (current.submitReady !== shouldEnable || current.submitDisabled === shouldEnable) {
      throw new Error('CTA_STATE_MISMATCH ' + JSON.stringify({ authority, current }));
    }

    const firstChip = await evaluate('(' + browserClickFirstChip.toString() + ')()');
    let chipFocus = { skipped: !firstChip };
    if (firstChip) {
      await sleep(120);
      chipFocus = await evaluate('(' + browserChipFocus.toString() + ')()');
      if (!chipFocus.highlighted || (firstChip.kind === 'field' ? chipFocus.activeField !== firstChip.id : chipFocus.activeAction !== 'upload')) {
        throw new Error('CHIP_FOCUS_FAILED ' + JSON.stringify({ firstChip, chipFocus }));
      }
    }

    await evaluate('(' + browserInvalidatePhone.toString() + ')()');
    await waitFor(() => evaluate("document.querySelector('[data-membership-field=phone]').classList.contains('is-bad') && [...document.querySelectorAll('.mr-chip')].some((chip)=>chip.textContent.includes('Teléfono'))"));
    await evaluate("[...document.querySelectorAll('.mr-chip')].find((chip)=>chip.textContent.includes('Teléfono')).click()");
    await sleep(120);
    const generatedChipFocus = await evaluate('(' + browserChipFocus.toString() + ')()');
    if (!generatedChipFocus.highlighted || generatedChipFocus.activeField !== 'phone') {
      throw new Error('GENERATED_CHIP_FOCUS_FAILED ' + JSON.stringify(generatedChipFocus));
    }
    const validation = await evaluate('(' + browserRestorePhone.toString() + ')()');
    if (!validation.invalidVisible || validation.ariaInvalid !== 'true') throw new Error('FIELD_VALIDATION_FAILED ' + JSON.stringify(validation));

    await evaluate("document.querySelector('.mr-back').click()");
    await waitFor(() => evaluate("!document.querySelector('[data-membership-application]')"));
    const result = {
      status: 'PASS',
      browser: 'Chrome',
      account: accountKey,
      membershipSelection,
      authority,
      current,
      responsive,
      chipFocus,
      generatedChipFocus,
      validation,
      navigationBack: true,
      supabaseWritesExecuted: 0,
      realSubmitExecuted: false,
      evidenceRedaction: 'Document previews hidden; personal fields masked before every screenshot.',
    };
    fs.writeFileSync(path.join(evidenceDir, secondary ? 'browser-result-secondary.json' : 'browser-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (page) page.close();
    chrome.kill();
    server.kill();
    await sleep(500);
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
    } catch (_) {}
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.stack || error.message }));
  process.exitCode = 1;
});
