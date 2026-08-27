'use strict';
/* Deterministic end-to-end loan quote matrix, captured through the authenticated
   RPC in a real browser. Used to prove that an infrastructure change (row lock
   mode, indexes, grants) leaves every financial value byte-identical.

   Usage: node scripts/capture-loan-quote-equivalence.js <output.json> */
const fs = require('fs'), http = require('http'), net = require('net'), os = require('os'), path = require('path'), { spawn, spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..'), chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function env() { const out = {}; for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) { const line = raw.trim(); if (!line || line.startsWith('#') || !line.includes('=')) continue; const at = line.indexOf('='); out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, ''); } return out; }
function freePort() { return new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const v = s.address().port; s.close(() => resolve(v)); }); }); }
async function wait(fn, ms = 30000) { const end = Date.now() + ms; let error; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { error = e; } await sleep(80); } throw error || new Error('timeout'); }
function cdp(url, events) { const ws = new WebSocket(url); let seq = 0; const pending = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (!m.id) { events.push(m); return; } const i = pending.get(m.id); if (!i) return; pending.delete(m.id); m.error ? i.reject(new Error(m.error.message)) : i.resolve(m.result); }; return { ready: new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }), call(method, params = {}) { return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }, close() { ws.close(); } }; }

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error('USAGE: capture-loan-quote-equivalence.js <output.json>');
  const values = env(), appPort = 8080, debugPort = await freePort();
  const tempRoot = fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir();
  const profile = fs.mkdtempSync(path.join(tempRoot, 'sutiapp-quote-equiv-')), events = [];
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

    stage = 'session';
    await evaluate('window.financialLegacyStore.ensureLoanSession()');
    await wait(() => evaluate("Boolean(window.financialLegacyStore.snapshot().status==='ready'&&window.financialLegacyStore.snapshot().loanSession)"));

    stage = 'matrix';
    // Deterministic matrix: every available fund x fixed amounts x every allowed
    // term (plus the custom minimum). Only server-returned values are recorded.
    const matrix = await evaluate(`(async()=>{
      const store=window.financialLegacyStore;
      const programs=store.snapshot().overview.programs.filter(p=>p.status==='AVAILABLE')
        .slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      const rows=[];
      const overview=programs.map(p=>({id:p.id,program_id:p.program_id,fund:p.fund,label:p.label,
        min_amount:p.min_amount,max_amount:p.max_amount,suggested_amount:p.suggested_amount,
        rate:p.rate,rate_period:p.rate_period,payment_period:p.payment_period,
        allowed_terms:(p.allowed_terms||[]).slice(),custom_term:p.custom_term}));
      for(const program of programs){
        const max=Number(program.max_amount);
        const amounts=[1000,5000,Math.round(max/2),max].filter((v,i,a)=>v>0&&v<=max&&a.indexOf(v)===i);
        const terms=((program.allowed_terms||[]).slice()).concat([Number(program.custom_term&&program.custom_term.min)])
          .filter((v,i,a)=>Number.isInteger(v)&&v>0&&a.indexOf(v)===i).sort((x,y)=>x-y);
        for(const amount of amounts){
          for(const term of terms){
            const snap=await store.requestLoanSessionQuote(program.id,amount,term,{});
            if(snap.status!=='ready'){rows.push({program:program.id,amount,term,error:snap.error});continue;}
            const q=snap.quote;
            rows.push({key:program.id+'|'+amount+'|'+term,
              amount:q.amount,paymentCount:q.paymentCount,paymentPeriod:q.paymentPeriod,
              rate:q.rate,ratePeriod:q.ratePeriod,interest:q.interest,
              administrativeFeePerPayment:q.administrativeFeePerPayment,
              administrativeFeeTotal:q.administrativeFeeTotal,total:q.total,
              paymentPerPeriod:q.paymentPerPeriod,fund:q.fund,program:q.program,
              maxAmount:q.maxAmount,maxTerm:q.maxTerm,
              eligibility:q.eligibility,customTerm:q.customTerm,
              termOptions:(q.termOptions||[]).slice()});
            await new Promise(r=>setTimeout(r,60));
          }
        }
      }
      return{overview,rows};
    })()`);

    const exceptions = events.filter((e) => e.method === 'Runtime.exceptionThrown');
    const payload = { capturedAt: new Date().toISOString(), quoteCount: matrix.rows.length, exceptions: exceptions.length, overview: matrix.overview, rows: matrix.rows };
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 1), 'utf8');
    console.log(JSON.stringify({ status: 'PASS', output: outputPath, quotes: matrix.rows.length, funds: matrix.overview.length, errors: matrix.rows.filter((r) => r.error).length, exceptions: exceptions.length }));
  } catch (error) { throw new Error(stage + ': ' + error.message); }
  finally {
    if (protocol) protocol.close();
    if (chrome) { spawnSync('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); await sleep(800); }
    if (server) await new Promise((resolve) => server.close(resolve));
    if (profile.startsWith(tempRoot + path.sep)) { for (let a = 0; a < 20 && fs.existsSync(profile); a++) { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); } catch (_) { await sleep(400); } } }
  }
}
main().catch((error) => { console.error(JSON.stringify({ status: 'FAIL', error: error.message })); process.exitCode = 1; });
