'use strict';

// Focused browser certification: no content/admin writes and no account creation.
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function loadEnv(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}
function freePort() { return new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); }); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function waitFor(fn, timeout = 30000) { const end = Date.now() + timeout; let error; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (e) { error = e; } await sleep(200); } throw error || new Error('Browser condition timed out'); }
function mime(file) { return ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json' })[path.extname(file)] || 'application/octet-stream'; }
function cdp(url) {
  const socket = new WebSocket(url); let id = 0; const pending = new Map();
  socket.onmessage = event => { const message = JSON.parse(event.data); if (!message.id || !pending.has(message.id)) return; const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); };
  return {
    ready: new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('CDP connection failed')); }),
    call(method, params = {}) { return new Promise((resolve, reject) => { const sequence = ++id; pending.set(sequence, { resolve, reject }); socket.send(JSON.stringify({ id: sequence, method, params })); }); },
    close() { socket.close(); },
  };
}

async function main() {
  const env = loadEnv(path.join(root, 'supabase.env'));
  const aliases = ['H005_TEST2', 'H005_TEST3'];
  for (const alias of aliases) for (const suffix of ['AFFILIATE_ID','EMAIL','PASSWORD']) if (!env[`${alias}_${suffix}`]) throw new Error('Controlled browser variables missing');
  if (!fs.existsSync(chromePath)) throw new Error('Chrome unavailable');
  const appPort = await freePort(); const debugPort = await freePort();
  const tempRoot = fs.existsSync('C:\\tmp') ? 'C:\\tmp' : os.tmpdir();
  const profileDir = fs.mkdtempSync(path.join(tempRoot, 'suti-phase1-browser-'));
  const resolvedTempRoot = path.resolve(tempRoot) + path.sep;
  if (!path.resolve(profileDir).startsWith(resolvedTempRoot)) throw new Error('Unsafe temporary profile path');
  const server = http.createServer((req, res) => {
    const requestPath = new URL(req.url, `http://127.0.0.1:${appPort}`).pathname;
    const relative = requestPath === '/' ? 'SutiApp.html' : decodeURIComponent(requestPath.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control':'no-store' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(appPort, '127.0.0.1', resolve));
  const chrome = spawn(chromePath, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'about:blank'], { stdio:'ignore', windowsHide:true });
  let protocol; let evaluate; let stage = 'initialize'; let recoveryUserId = null;
  async function restoreRecoveryPassword() {
    if (!recoveryUserId) return;
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/admin/users/${recoveryUserId}`, {
      method:'PUT', headers:{ apikey:env.SUPABASE_SECRET_KEY, 'Content-Type':'application/json' },
      body:JSON.stringify({ password:env.H005_TEST3_PASSWORD }),
    });
    if (!response.ok) throw new Error(`Recovery password restoration failed (${response.status})`);
  }
  try {
    const target = await waitFor(async () => { const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`); return (await response.json()).find(item => item.type === 'page'); });
    protocol = cdp(target.webSocketDebuggerUrl); await protocol.ready; await protocol.call('Page.enable'); await protocol.call('Runtime.enable');
    evaluate = async expression => { const result = await protocol.call('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true }); if (result.exceptionDetails) throw new Error('Browser evaluation failed'); return result.result && result.result.value; };
    await protocol.call('Page.navigate', { url:`http://127.0.0.1:${appPort}/SutiApp.html` });
    await waitFor(() => evaluate("Boolean(document.querySelector('input[type=email]')&&document.querySelector('input[type=password]'))"));

    async function setField(selector, value) {
      await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    }
    async function submit(email, password) { await setField('input[type=email]', email); await setField('input[type=password]', password); await evaluate("document.querySelector('button[type=submit]').click()"); }
    async function login(alias) {
      await submit(env[`${alias}_EMAIL`], env[`${alias}_PASSWORD`]);
      await waitFor(() => evaluate(`window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'&&window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(env[`${alias}_AFFILIATE_ID`])}`));
      return evaluate(`(() => { const s=window.AffiliateAuth.getState(); return {authId:s.session.user.id,affiliateId:s.affiliate.id,numeroControl:s.affiliate.numero_control,viewControl:s.affiliateView.numeroControl}; })()`);
    }
    async function logoutFromProfile() {
      await evaluate("(() => { const b=[...document.querySelectorAll('button')].find(x=>x.style.borderRadius==='50%'); if(!b)return false; b.click(); return true; })()");
      await waitFor(() => evaluate("Boolean(document.querySelector('[data-affiliate-field=profile-control]'))"));
      const profile = await evaluate("(() => { const s=window.AffiliateAuth.getState(); return document.querySelector('[data-affiliate-id]').dataset.affiliateId===s.affiliate.id&&document.querySelector('[data-affiliate-field=profile-control]').innerText.includes(s.affiliate.numero_control); })()");
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cerrar sesión').click()");
      await waitFor(() => evaluate("window.AffiliateAuth.getState().phase==='unauthenticated'&&Boolean(document.querySelector('input[type=email]'))"));
      return profile;
    }

    stage = 'wrong_password';
    await submit(env.H005_TEST2_EMAIL, env.H005_TEST2_PASSWORD + '-wrong');
    await waitFor(() => evaluate("window.AffiliateAuth.getState().errorCode==='INVALID_CREDENTIALS'"));
    stage = 'nonexistent_account';
    await submit('nonexistent-phase1-browser@example.invalid', 'not-a-real-password');
    await waitFor(() => evaluate("window.AffiliateAuth.getState().errorCode==='INVALID_CREDENTIALS'"));

    stage = 'user_a'; const a = await login('H005_TEST2');
    if (a.numeroControl !== a.viewControl || typeof a.numeroControl !== 'string') throw new Error('User A numero_control projection mismatch');
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Credencial').click()");
    const credentialA = await waitFor(() => evaluate("(() => { const s=window.AffiliateAuth.getState(); const root=document.querySelector('[data-affiliate-id]'); const control=document.querySelector('[data-affiliate-field=credential-control]'); return Boolean(root&&control&&root.dataset.affiliateId===s.affiliate.id&&control.textContent===s.affiliate.numero_control); })()"));
    const forbiddenIdentityKeysA = await evaluate("Object.keys(localStorage).filter(k=>/(suti_user_photo|suti_bank_v1|suti_admin_viewer_v1|affiliate|profile)/i.test(k))");
    await protocol.call('Page.reload', { ignoreCache:true });
    await waitFor(() => evaluate(`window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'&&window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(env.H005_TEST2_AFFILIATE_ID)}`));
    const profileA = await logoutFromProfile();
    await protocol.call('Page.reload', { ignoreCache:true });
    await waitFor(() => evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='unauthenticated'"));

    stage = 'user_b'; const b = await login('H005_TEST3');
    if (b.affiliateId === a.affiliateId || b.authId === a.authId || b.numeroControl !== b.viewControl) throw new Error('A/B context did not change exactly');
    const noAContext = await evaluate(`${JSON.stringify(a.affiliateId)}!==window.AffiliateAuth.getState().affiliate.id&&${JSON.stringify(a.authId)}!==window.AffiliateAuth.getState().session.user.id`);
    const profileB = await logoutFromProfile();

    stage = 'activation_recovery_ui';
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Activar mi cuenta')).click()");
    const activationUi = await waitFor(() => evaluate("document.querySelectorAll('input[type=password]').length===2&&[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Activar cuenta')"));
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Volver al inicio')).click()");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Olvid')).click()");
    await setField('input[type=email]', 'nonexistent-phase1-browser@example.invalid');
    await evaluate("document.querySelector('button[type=submit]').click()");
    const recoveryEnumerationSafe = await waitFor(() => evaluate("document.body.innerText.includes('Si existe una cuenta para ese correo')"));

    stage = 'real_recovery_callback';
    recoveryUserId = b.authId;
    const temporaryPassword = `Phase1!${Date.now()}Aa9`;
    const linkResponse = await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/admin/generate_link`, {
      method:'POST', headers:{ apikey:env.SUPABASE_SECRET_KEY, 'Content-Type':'application/json' },
      body:JSON.stringify({ type:'recovery', email:env.H005_TEST3_EMAIL }),
    });
    if (!linkResponse.ok) throw new Error(`Recovery link generation failed (${linkResponse.status})`);
    const linkBody = await linkResponse.json();
    if (!linkBody.hashed_token) throw new Error('Recovery hashed token missing');
    const verifyResponse = await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/verify`, {
      method:'POST', headers:{ apikey:env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type':'application/json' },
      body:JSON.stringify({ type:'recovery', token_hash:linkBody.hashed_token }),
    });
    if (!verifyResponse.ok) throw new Error(`Recovery token verification failed (${verifyResponse.status})`);
    const recoverySession = await verifyResponse.json();
    if (!recoverySession.access_token || !recoverySession.refresh_token) throw new Error('Recovery session missing');
    const callback = new URL(`http://127.0.0.1:${appPort}/SutiApp.html?recovery=${Date.now()}`);
    callback.hash = new URLSearchParams({
      access_token:recoverySession.access_token, refresh_token:recoverySession.refresh_token,
      expires_in:String(recoverySession.expires_in || 3600), token_type:'bearer', type:'recovery',
    }).toString();
    await protocol.call('Page.navigate', { url:callback.toString() });
    stage = 'recovery_event';
    try {
      await waitFor(() => evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='password_recovery'&&document.querySelectorAll('input[type=password]').length===2"));
    } catch (_) {
      const diagnostic = await evaluate("(() => { const s=window.AffiliateAuth&&window.AffiliateAuth.getState(); return JSON.stringify({phase:s&&s.phase,errorCode:s&&s.errorCode,hasSession:Boolean(s&&s.session),passwordInputs:document.querySelectorAll('input[type=password]').length,hashKeys:location.hash.slice(1).split('&').map(x=>x.split('=')[0]).filter(Boolean)}); })()");
      throw new Error(`Recovery callback state ${diagnostic}`);
    }
    const recoveryPrincipal = await evaluate("window.AffiliateAuth.getState().session.user.id");
    if (recoveryPrincipal !== b.authId) throw new Error('Recovery callback changed principal');
    await setField('input[type=password]', temporaryPassword);
    await evaluate(`(() => { const el=document.querySelectorAll('input[type=password]')[1]; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,${JSON.stringify(temporaryPassword)}); el.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    stage = 'recovery_password_update';
    await waitFor(() => evaluate("!document.querySelector('button[type=submit]').disabled"));
    await evaluate("document.querySelector('button[type=submit]').click()");
    try {
      await waitFor(() => evaluate("window.AffiliateAuth.getState().phase==='unauthenticated'&&document.body.innerText.includes('Contraseña actualizada')"));
    } catch (_) {
      const diagnostic = await evaluate("(() => { const s=window.AffiliateAuth.getState(); return JSON.stringify({phase:s.phase,errorCode:s.errorCode,hasSession:Boolean(s.session),submitDisabled:document.querySelector('button[type=submit]')&&document.querySelector('button[type=submit]').disabled,passwordInputs:document.querySelectorAll('input[type=password]').length}); })()");
      throw new Error(`Recovery update state ${diagnostic}`);
    }
    stage = 'recovery_new_login';
    const recoveredLogin = await (async () => {
      await submit(env.H005_TEST3_EMAIL, temporaryPassword);
      await waitFor(() => evaluate(`window.AffiliateAuth.getState().phase==='authenticated'&&window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(env.H005_TEST3_AFFILIATE_ID)}`));
      return true;
    })();
    await restoreRecoveryPassword();
    stage = 'recovery_logout';
    await evaluate("window.AffiliateAuth.signOut()");
    await waitFor(() => evaluate("window.AffiliateAuth.getState().phase==='unauthenticated'"));
    // Prove the original owner-authorized credential is restored.
    stage = 'recovery_original_login';
    await login('H005_TEST3');
    await evaluate("window.AffiliateAuth.signOut()");
    await waitFor(() => evaluate("window.AffiliateAuth.getState().phase==='unauthenticated'"));

    console.log(JSON.stringify({
      status:'PASS', real_browser:true, wrong_password_controlled:true, nonexistent_account_controlled:true,
      user_a_binding:true, user_b_binding:true, same_numero_control_projection:true,
      credential_projection:Boolean(credentialA), profile_projection:Boolean(profileA&&profileB),
      session_survives_refresh:true, logout_survives_refresh:true, a_context_absent_after_b_login:Boolean(noAContext),
      stale_identity_keys:forbiddenIdentityKeysA.length, activation_ui:Boolean(activationUi),
      recovery_request_ui:true, recovery_enumeration_safe:Boolean(recoveryEnumerationSafe),
      recovery_callback:true, recovery_password_update:true, recovery_new_login:Boolean(recoveredLogin), recovery_original_password_restored:true,
    }));
  } catch (error) { throw new Error(`${stage}: ${error.message}`); }
  finally {
    try { await restoreRecoveryPassword(); } catch (cleanupError) { console.error(JSON.stringify({ status:'FAIL', cleanup:cleanupError.message })); process.exitCode = 1; }
    if (protocol) protocol.close(); chrome.kill();
    await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), sleep(2000)]);
    await new Promise(resolve => server.close(resolve));
    if (path.resolve(profileDir).startsWith(resolvedTempRoot)) fs.rmSync(profileDir, { recursive:true, force:true, maxRetries:5, retryDelay:250 });
  }
}
main().catch(error => { console.error(JSON.stringify({ status:'FAIL', error:error.message })); process.exitCode = 1; });
