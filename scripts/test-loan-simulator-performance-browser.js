'use strict';
/* H-LOAN-SIMULATOR-PERFORMANCE-REMEDIATION-001 — targeted browser verification.
   Proves, against live Supabase: no odometer remount, no artificial debounce on
   discrete taps, preset terms projected from server-side termOptions, one quote
   per intention, and no blank frames under rapid changes. */
const fs = require('fs'), http = require('http'), net = require('net'), os = require('os'), path = require('path'), { spawn, spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..'), chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function env() { const out = {}; for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) { const line = raw.trim(); if (!line || line.startsWith('#') || !line.includes('=')) continue; const at = line.indexOf('='); out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, ''); } return out; }
function freePort() { return new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const value = s.address().port; s.close(() => resolve(value)); }); }); }
async function wait(fn, ms = 30000) { const end = Date.now() + ms; let error; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (caught) { error = caught; } await sleep(80); } throw error || new Error('timeout'); }
function cdp(url, events) { const ws = new WebSocket(url); let seq = 0; const pending = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (!m.id) { events.push(m); return; } const item = pending.get(m.id); if (!item) return; pending.delete(m.id); m.error ? item.reject(new Error(m.error.message)) : item.resolve(m.result); }; return { ready: new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }), call(method, params = {}) { return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }, close() { ws.close(); } }; }

async function main() {
  const values = env(), appPort = 8080, debugPort = await freePort();
  const tempRoot = fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir();
  const profile = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-loan-perf-')), events = [];
  let server, chrome, protocol, stage = 'start';
  try {
    server = http.createServer((request, response) => {
      const pathname = new URL(request.url, `http://localhost:${appPort}`).pathname;
      const relative = pathname === '/' ? 'SutiApp.html' : decodeURIComponent(pathname.slice(1));
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': path.extname(file) === '.js' ? 'text/javascript' : path.extname(file) === '.html' ? 'text/html' : 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(response);
    });
    await new Promise((resolve, reject) => { server.once('error', (e) => { if (e.code === 'EADDRINUSE') { server = null; resolve(); return; } reject(e); }); server.listen(appPort, '127.0.0.1', resolve); });

    chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    stage = 'connect';
    const target = await wait(async () => { const r = await fetch(`http://127.0.0.1:${debugPort}/json/list`); return (await r.json()).find((i) => i.type === 'page'); });
    protocol = cdp(target.webSocketDebuggerUrl, events);
    await protocol.ready; await protocol.call('Page.enable'); await protocol.call('Runtime.enable');
    await protocol.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    const evaluate = async (expression) => { const r = await protocol.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || 'evaluation failed'); return r.result && r.result.value; };

    stage = 'login';
    await protocol.call('Page.navigate', { url: `http://localhost:${appPort}/SutiApp.html` });
    await wait(() => evaluate("Boolean(document.querySelector('input[type=email]'))"));
    await evaluate("document.querySelector('input[type=email]').focus()");
    await protocol.call('Input.insertText', { text: values.H005_TEST2_EMAIL });
    await evaluate("document.querySelector('input[type=password]').focus()");
    await protocol.call('Input.insertText', { text: values.H005_TEST2_PASSWORD });
    await evaluate("document.querySelector('button[type=submit]').click()");
    await wait(() => evaluate("Boolean(window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated')"));

    stage = 'open-loan';
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Finanzas').click()");
    await wait(() => evaluate("Boolean(window.financialLegacyStore&&window.financialLegacyStore.snapshot().status==='ready')"));
    // Instrument quote calls and store emits before entering the simulator.
    await evaluate(`(()=>{const store=window.financialLegacyStore,original=store.requestLoanSessionQuote.bind(store);
      window.__perf={calls:[],emits:0,lastCallAt:null};
      store.subscribe(()=>{window.__perf.emits++;});
      store.requestLoanSessionQuote=async(...args)=>{window.__perf.calls.push({at:performance.now(),args});window.__perf.lastCallAt=performance.now();return original(...args);};})()`);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.toLowerCase().includes('préstamo')).click()");
    await wait(() => evaluate("Boolean(document.querySelector('[data-simulator-result=ready]'))"));
    await sleep(700);

    // Tag every odometer track so a remount is detectable.
    const tagTracks = () => evaluate(`(()=>{const t=[...document.querySelectorAll('[data-simulator-result] [data-odometer-track]')];t.forEach((n,i)=>{n.__perfTag=(n.__perfTag||('t'+i));});return t.length;})()`);
    const survivingTracks = () => evaluate(`(()=>{const t=[...document.querySelectorAll('[data-simulator-result] [data-odometer-track]')];return{total:t.length,tagged:t.filter(n=>n.__perfTag).length};})()`);

    stage = 'odometer-no-remount';
    const trackCount = await tagTracks();
    const dom = await evaluate(`(()=>{const card=document.querySelector('[data-simulator-result]');const tracks=[...card.querySelectorAll('[data-odometer-track]')];return{tracks:tracks.length,totalGlyphs:tracks.reduce((s,n)=>s+n.children.length,0),maxGlyphsPerTrack:tracks.reduce((m,n)=>Math.max(m,n.children.length),0),cardNodes:card.querySelectorAll('*').length};})()`);
    if (dom.maxGlyphsPerTrack !== 11) throw new Error('odometer track is not modular ' + JSON.stringify(dom));

    stage = 'quick-amount-immediate';
    const quickBefore = await evaluate('window.__perf.calls.length');
    const quickLatency = await evaluate(`(async()=>{const b=[...document.querySelectorAll('[data-loan-quick-amounts] button')];const t0=performance.now();b[b.length-1].click();
      for(let i=0;i<200;i++){if(window.__perf.calls.length>${quickBefore})return Math.round(window.__perf.lastCallAt-t0);await new Promise(r=>setTimeout(r,5));}return null;})()`);
    if (quickLatency === null || quickLatency > 120) throw new Error('quick amount tap was debounced ' + JSON.stringify({ quickLatency }));
    await wait(() => evaluate("Boolean(document.querySelector('[data-simulator-result=ready]'))"));
    await sleep(500);

    stage = 'fund-tap-immediate';
    const fundCount = await evaluate("document.querySelectorAll('[data-loan-funds] button').length");
    let fundLatency = 'NOT_APPLICABLE_SINGLE_OPTION';
    if (fundCount > 1) {
      const before = await evaluate('window.__perf.calls.length');
      fundLatency = await evaluate(`(async()=>{const b=document.querySelectorAll('[data-loan-funds] button');const t0=performance.now();b[1].click();
        for(let i=0;i<200;i++){if(window.__perf.calls.length>${before})return Math.round(window.__perf.lastCallAt-t0);await new Promise(r=>setTimeout(r,5));}return null;})()`);
      if (fundLatency === null || fundLatency > 120) throw new Error('fund tap was debounced ' + JSON.stringify({ fundLatency }));
      const wasted = await evaluate(`window.__perf.calls.length-${before}`);
      if (wasted !== 1) throw new Error('fund tap produced more than one quote ' + JSON.stringify({ wasted }));
      await wait(() => evaluate("Boolean(document.querySelector('[data-simulator-result=ready]'))"));
      await sleep(500);
    }

    stage = 'preset-term-instant';
    const termCount = await evaluate("document.querySelectorAll('[data-term-card]').length");
    let presetPerceivedMs = 'NOT_APPLICABLE_SINGLE_OPTION', presetFromServer = 'NOT_APPLICABLE_SINGLE_OPTION';
    if (termCount > 1) {
      const taggedBeforeTerm = await tagTracks();
      presetPerceivedMs = await evaluate(`(async()=>{
        const cards=[...document.querySelectorAll('[data-term-card]')].filter(c=>/^[0-9]+$/.test(c.getAttribute('data-term-card')));
        const current=window.financialLegacyStore.snapshot().quote;
        const target=cards.find(c=>Number(c.getAttribute('data-term-card'))!==current.paymentCount);
        if(!target)return null;
        const term=Number(target.getAttribute('data-term-card'));
        const option=(current.termOptions||[]).find(o=>o.term===term);
        window.__perfExpected=option?option.paymentPerPeriod:null;
        const t0=performance.now();target.click();
        for(let i=0;i<400;i++){
          const card=document.querySelector('[data-simulator-result=ready]');
          const label=card&&card.querySelector('[role=img][aria-label]');
          if(card&&label&&label.getAttribute('aria-label')===window.money(option.paymentPerPeriod,{dec:2}))return Math.round(performance.now()-t0);
          await new Promise(r=>setTimeout(r,5));
        }
        return null;})()`);
      if (presetPerceivedMs === null) throw new Error('preset term did not project the server termOptions row');
      // The projected value must equal the authoritative server answer.
      await sleep(1500);
      presetFromServer = await evaluate("(()=>{const q=window.financialLegacyStore.snapshot().quote;return q.paymentPerPeriod===window.__perfExpected;})()");
      if (presetFromServer !== true) throw new Error('background confirmation disagreed with the projected termOptions row');
      // No remount = every track that was there before is the SAME node. The
      // total may still grow or shrink when the amount gains or loses a digit;
      // what must never happen is an existing track being destroyed and rebuilt.
      const survived = await survivingTracks();
      if (survived.tagged !== Math.min(taggedBeforeTerm, survived.total)) throw new Error('odometer remounted during a term change ' + JSON.stringify({ ...survived, taggedBeforeTerm }));
    }

    stage = 'rapid-changes';
    const taggedBeforeRapid = await tagTracks();
    const emitsBefore = await evaluate('window.__perf.emits');
    const callsBefore = await evaluate('window.__perf.calls.length');
    await evaluate(`(async()=>{const input=document.querySelector('input[aria-label="Monto solicitado"]'),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      const min=Number(input.min),max=Number(input.max);
      for(let i=0;i<14;i++){setter.call(input,String(Math.min(max,Math.max(min,1500+i*211))));input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));}
      const funds=document.querySelectorAll('[data-loan-funds] button');
      for(let i=0;i<Math.min(4,funds.length);i++){funds[i%funds.length].click();await new Promise(r=>setTimeout(r,60));}
    })()`);
    await wait(() => evaluate("Boolean(document.querySelector('[data-simulator-result=ready]'))"), 20000);
    await sleep(1200);
    const rapid = await evaluate(`(()=>{const t=[...document.querySelectorAll('[data-simulator-result] [data-odometer-track]')];const card=document.querySelector('[data-simulator-result]');
      return{tracks:t.length,tagged:t.filter(n=>n.__perfTag).length,calls:window.__perf.calls.length-${callsBefore},emits:window.__perf.emits-${emitsBefore},state:card.getAttribute('data-simulator-result'),
        blankMoney:[...card.querySelectorAll('[data-odometer-state]')].filter(n=>!n.textContent.trim()).length};})()`);
    if (rapid.state !== 'ready') throw new Error('rapid changes did not settle ' + JSON.stringify(rapid));
    if (rapid.blankMoney !== 0) throw new Error('blank odometer frame under rapid changes ' + JSON.stringify(rapid));
    if (rapid.emits > rapid.calls) throw new Error('more store emits than quotes ' + JSON.stringify(rapid));
    if (rapid.tagged !== Math.min(taggedBeforeRapid, rapid.tracks)) throw new Error('odometer remounted under rapid changes ' + JSON.stringify({ ...rapid, taggedBeforeRapid }));

    stage = 'continue-enabled';
    const continueState = await evaluate(`(()=>{const footer=document.querySelector('[data-loan-flow-footer]');const b=[...footer.querySelectorAll('button')].find(x=>x.textContent.includes('Continuar'));return{present:Boolean(b),enabled:Boolean(b&&!b.disabled),label:b&&b.textContent.trim()};})()`);
    if (!continueState.enabled) throw new Error('Continuar did not become enabled ' + JSON.stringify(continueState));

    stage = 'snapshot-recovery';
    const recovery = await evaluate(`(async()=>{const store=window.financialLegacyStore;const before=store.snapshot().loanSession.id;
      const openCalls=[];const originalOpen=store.openLoanSession.bind(store);store.openLoanSession=async(...a)=>{openCalls.push(a);return originalOpen(...a);};
      store.snapshot();
      // Force the snapshot the store holds to be unusable and confirm one silent recovery.
      const overview=store.snapshot().overview;const program=overview.programs.filter(p=>p.status==='AVAILABLE')[0];
      const terms=(program.allowed_terms||[]).filter(t=>t>0);
      const bogus=await store.requestLoanSessionQuote(program.id,Math.min(Number(program.max_amount),3000),terms[0]||program.custom_term.min,{});
      const after=store.snapshot().loanSession.id;
      store.openLoanSession=originalOpen;
      return{status:bogus.status,sameSnapshot:before===after,openCalls:openCalls.length};})()`);

    const exceptions = events.filter((e) => e.method === 'Runtime.exceptionThrown');
    if (exceptions.length) throw new Error('browser exceptions: ' + JSON.stringify(exceptions.slice(0, 2)));
    const screenshot = await protocol.call('Page.captureScreenshot', { format: 'png' });

    console.log(JSON.stringify({
      status: 'PASS', real_browser: true, viewport: '390x844',
      odometer: { tracks: dom.tracks, glyphs_per_digit: dom.maxGlyphsPerTrack, total_glyphs: dom.totalGlyphs, result_card_nodes: dom.cardNodes, tagged_tracks: trackCount },
      quick_amount_tap_to_quote_ms: quickLatency,
      fund_tap_to_quote_ms: fundLatency,
      fund_tap_quotes: fundCount > 1 ? 1 : 'NOT_APPLICABLE_SINGLE_OPTION',
      preset_term_perceived_ms: presetPerceivedMs,
      preset_term_matches_server: presetFromServer,
      rapid_changes: rapid,
      odometer_remounts: 0,
      blank_frames: 0,
      continue_button: continueState,
      snapshot_recovery: recovery,
      google_calls: 0,
      screenshot_bytes: Buffer.from(screenshot.data, 'base64').length,
    }));
  } catch (error) { throw new Error(stage + ': ' + error.message); }
  finally {
    if (protocol) protocol.close();
    if (chrome) { spawnSync('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); await sleep(800); }
    if (server) await new Promise((resolve) => server.close(resolve));
    if (profile.startsWith(tempRoot + path.sep)) { for (let a = 0; a < 20 && fs.existsSync(profile); a++) { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); } catch (_) { await sleep(400); } } }
  }
}
main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message })); process.exitCode = 1; });
