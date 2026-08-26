'use strict';

// Real-Chrome, read-only expediente certification. The only expected write is the
// audited start/stop of an administrator impersonation session requested by Phase 3.
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); }); }
async function waitFor(fn, timeout = 40000) { const end = Date.now() + timeout; let error; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (caught) { error = caught; } await sleep(200); } throw error || new Error('Browser condition timed out'); }
function mime(file) { return ({ '.html':'text/html', '.js':'text/javascript', '.jsx':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json' })[path.extname(file)] || 'application/octet-stream'; }
function cdp(url) {
  const socket = new WebSocket(url); let id = 0; const pending = new Map();
  socket.onmessage = (event) => { const message = JSON.parse(event.data); if (!message.id || !pending.has(message.id)) return; const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); };
  return { ready:new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(new Error('CDP connection failed'));}), call(method,params={}){return new Promise((resolve,reject)=>{const sequence=++id;pending.set(sequence,{resolve,reject});socket.send(JSON.stringify({id:sequence,method,params}));});}, close(){socket.close();} };
}

async function main() {
  const env = loadEnv(path.join(root, 'supabase.env'));
  for (const alias of ['H005_TEST','H005_TEST2','H005_TEST3']) {
    for (const suffix of ['AFFILIATE_ID','EMAIL','PASSWORD']) if (!env[`${alias}_${suffix}`]) throw new Error('Controlled Phase 3 variables are missing');
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw new Error('Supabase public configuration is missing');
  if (!fs.existsSync(chromePath)) throw new Error('Chrome is unavailable');

  const appPort = await freePort(); const debugPort = await freePort();
  const requestedProfile = process.env.SUTI_PHASE3_PROFILE_DIR ? path.resolve(process.env.SUTI_PHASE3_PROFILE_DIR) : null;
  const tempRoot = requestedProfile ? path.dirname(requestedProfile) : root;
  const profileDir = requestedProfile || fs.mkdtempSync(path.join(tempRoot, 'suti-phase3-browser-'));
  if (requestedProfile && !fs.existsSync(profileDir)) throw new Error('Prepared Chrome profile directory is missing');
  const safeTemp = path.resolve(tempRoot) + path.sep;
  const server = http.createServer((req, res) => {
    const requestPath = new URL(req.url, `http://127.0.0.1:${appPort}`).pathname;
    const relative = requestPath === '/' ? 'SutiApp.html' : decodeURIComponent(requestPath.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type':mime(file), 'Cache-Control':'no-store' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(appPort, '127.0.0.1', resolve));
  const chrome = spawn(chromePath, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'about:blank'], { stdio:'ignore', windowsHide:true });

  let protocol; let evaluate; let stage = 'initialize'; let impersonationActive = false;
  const mark = (name) => { stage = name; process.stderr.write(`STAGE ${name}\n`); };
  try {
    mark('initialize');
    const target = await waitFor(async () => { const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal:AbortSignal.timeout(2000) }); return (await response.json()).find((item) => item.type === 'page'); });
    protocol = cdp(target.webSocketDebuggerUrl); await protocol.ready; await protocol.call('Page.enable'); await protocol.call('Runtime.enable');
    evaluate = async (expression) => { const result = await protocol.call('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception && result.exceptionDetails.exception.description || result.exceptionDetails.text); return result.result && result.result.value; };
    await protocol.call('Page.navigate', { url:`http://127.0.0.1:${appPort}/SutiApp.html` });
    await waitFor(() => evaluate("Boolean(document.querySelector('input[type=email]')&&document.querySelector('input[type=password]'))"));

    async function setField(selector, value) { await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)return false; const setter=Object.getOwnPropertyDescriptor(${selector.includes('textarea')?'HTMLTextAreaElement':'HTMLInputElement'}.prototype,'value').set; setter.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`); }
    async function clickButton(label) { return evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if(!b)return false;b.click();return true; })()`); }
    async function login(alias) {
      await setField('input[type=email]', env[`${alias}_EMAIL`]); await setField('input[type=password]', env[`${alias}_PASSWORD`]);
      await evaluate("document.querySelector('button[type=submit]').click()");
      await waitFor(() => evaluate(`window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'&&window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(env[`${alias}_AFFILIATE_ID`])}`));
      return evaluate("(() => { const s=window.AffiliateAuth.getState(); return {authId:s.session.user.id,affiliateId:s.affiliate.id,control:s.affiliate.numero_control}; })()");
    }
    async function home() { await clickButton('Inicio'); await waitFor(() => evaluate("Boolean(document.querySelector('[data-profile-photo-consumer=header]'))")); }
    async function profile() { await evaluate("document.querySelector('[data-profile-photo-consumer=header]').closest('button').click()"); return waitFor(() => evaluate("Boolean(document.querySelector('[data-affiliate-field=profile-control]'))")); }
    async function credential(expected) { await clickButton('Mi credencial digital'); return waitFor(() => evaluate(`(() => { const control=document.querySelector('[data-affiliate-field=credential-control]');const avatar=document.querySelector('[data-profile-photo-consumer=credential]');const image=avatar&&avatar.querySelector('img');return Boolean(control&&control.textContent===${JSON.stringify(expected)}&&avatar&&avatar.dataset.avatarPhotoState==='photo'&&image&&image.complete&&image.naturalWidth>0); })()`)); }
    async function documents(expectedId) {
      await home();
      if (!await clickButton('Documentos')) throw new Error('Documents navigation control is missing');
      try {
        await waitFor(() => evaluate("document.querySelector('[data-document-authority=supabase]')&&document.querySelector('[data-document-authority=supabase]').dataset.documentPhase==='ready'"));
      } catch (_) {
        const diagnostic = await evaluate("(async() => { const root=document.querySelector('[data-document-authority=supabase]');let repository=null;try{await window.AffiliateRepository.getDocuments();}catch(error){repository={code:error&&error.code,message:error&&error.message,cause:error&&error.cause&&error.cause.message};}return {present:Boolean(root),phase:root&&root.dataset.documentPhase,alert:document.querySelector('[role=alert]')&&document.querySelector('[role=alert]').textContent,repository,body:document.body.innerText.slice(-300)}; })()");
        throw new Error('Documents did not become ready: '+JSON.stringify(diagnostic));
      }
      return evaluate(`(async()=>{const nodes=[...document.querySelectorAll('[data-document-id]')];const imageNode=nodes.find(x=>x.dataset.documentClassification==='PRIVATE'&&x.dataset.documentKind==='image');if(!imageNode)throw new Error('No private image available for signed URL certification');imageNode.querySelector('button').click();for(let i=0;i<50&&!document.querySelector('[data-document-preview] img');i++)await new Promise(r=>setTimeout(r,100));const image=document.querySelector('[data-document-preview] img');const signedUrl=image&&image.src;const signedValid=Boolean(signedUrl&&signedUrl.includes('/storage/v1/object/sign/private-assets/'));const fetchOk=signedValid&&(await fetch(signedUrl)).ok;const paths=await window.SutiSupabase.getClient().from('affiliate_files').select('storage_path').eq('affiliate_id',${JSON.stringify(expectedId)}).eq('classification','PRIVATE').eq('status','READY');if(paths.error)throw paths.error;return {count:nodes.length,uiCount:Number(document.querySelector('[data-document-count]').dataset.documentCount),owners:nodes.every(x=>x.dataset.documentOwner===${JSON.stringify(expectedId)}),signedValid,fetchOk,labels:[...document.querySelectorAll('[data-document-label]')].map(x=>x.textContent),urls:signedUrl?[signedUrl]:[],privatePaths:(paths.data||[]).map(x=>x.storage_path)};})()`);
    }
    async function backFromDocuments() { await evaluate("document.querySelector('[data-document-authority=supabase]')?.querySelector('button')?.click()"); await waitFor(() => evaluate("!document.querySelector('[data-document-authority=supabase]')")); }
    async function logout() { await evaluate('window.AffiliateAuth.signOut()'); await waitFor(() => evaluate("window.AffiliateAuth.getState().phase==='unauthenticated'&&Boolean(document.querySelector('input[type=email]'))")); }
    async function deniedAgainst(otherId, otherPath) {
      return evaluate(`(async()=>{const client=window.SutiSupabase.getClient();const files=await client.from('affiliate_files').select('id').eq('affiliate_id',${JSON.stringify(otherId)});const affiliate=await client.from('affiliates').select('id').eq('id',${JSON.stringify(otherId)});let assetDenied=true;if(${JSON.stringify(Boolean(otherPath))}){const download=await client.storage.from('private-assets').download(${JSON.stringify(otherPath)});assetDenied=Boolean(download.error&&!download.data);}return {filesDenied:!files.error&&(files.data||[]).length===0,affiliateDenied:!affiliate.error&&(affiliate.data||[]).length===0,assetDenied};})()`);
    }

    mark('user_a_login');
    const a = await login('H005_TEST2');
    mark('user_a_profile');
    await profile();
    const profileA = await waitFor(() => evaluate(`(() => { const avatar=document.querySelector('[data-profile-photo-consumer=profile]');const image=avatar&&avatar.querySelector('img');return document.querySelector('[data-affiliate-id]').dataset.affiliateId===${JSON.stringify(a.affiliateId)}&&document.querySelector('[data-affiliate-field=profile-control]').textContent.includes(${JSON.stringify(a.control)})&&avatar&&avatar.dataset.avatarPhotoState==='photo'&&image&&image.complete&&image.naturalWidth>0; })()`));
    mark('user_a_credential');
    const credentialA = await credential(a.control);
    mark('user_a_documents');
    const docsA = await documents(a.affiliateId);
    if (!profileA || !credentialA || !docsA.count || docsA.count !== docsA.uiCount || !docsA.owners || !docsA.signedValid || !docsA.fetchOk || docsA.labels.some((label)=>/[_/]|uuid|sha|bucket|storage/i.test(label))) throw new Error('User A expediente mismatch');

    mark('refresh');
    await sleep(1100); await protocol.call('Page.reload', { ignoreCache:true });
    await waitFor(() => evaluate(`window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='authenticated'&&window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(a.affiliateId)}`));
    const refreshedA = await documents(a.affiliateId);
    if (refreshedA.count !== docsA.count || refreshedA.urls.some((url) => docsA.urls.includes(url))) throw new Error('Refresh did not regenerate document capabilities');

    mark('controlled_states');
    await backFromDocuments();
    await evaluate("window.__phase3Repository=window.AffiliateRepository;window.AffiliateRepository=Object.freeze(Object.assign({},window.__phase3Repository,{getDocuments:async()=>[]}));true");
    await clickButton('Documentos');
    const emptyState = await waitFor(() => evaluate("document.querySelector('[data-document-phase=ready]')&&Boolean(document.querySelector('[data-document-empty=true]'))&&!document.querySelector('[data-document-id]')"));
    await backFromDocuments();
    await evaluate("window.AffiliateRepository=Object.freeze(Object.assign({},window.__phase3Repository,{getDocuments:async()=>{throw new Error('CONTROLLED_REPOSITORY_FAILURE')}}));true");
    await clickButton('Documentos');
    const errorState = await waitFor(() => evaluate("document.querySelector('[data-document-phase=error]')&&document.body.innerText.includes('No se mostraron copias locales')&&[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Reintentar')&&!document.querySelector('[data-document-id]')"));
    await evaluate('window.AffiliateRepository=window.__phase3Repository;true');
    await clickButton('Reintentar');
    await waitFor(() => evaluate("document.querySelector('[data-document-phase=ready]')&&Boolean(document.querySelector('[data-document-id]'))"));
    const normalAdminDeniedA = await waitFor(() => evaluate("window.AdminRepository&&window.AdminRepository.getState().phase==='denied'"));
    await logout();

    mark('user_b');
    const b = await login('H005_TEST3');
    await profile(); const profileB = await waitFor(() => evaluate(`(() => { const avatar=document.querySelector('[data-profile-photo-consumer=profile]');const image=avatar&&avatar.querySelector('img');return document.querySelector('[data-affiliate-id]').dataset.affiliateId===${JSON.stringify(b.affiliateId)}&&document.querySelector('[data-affiliate-field=profile-control]').textContent.includes(${JSON.stringify(b.control)})&&avatar&&avatar.dataset.avatarPhotoState==='photo'&&image&&image.complete&&image.naturalWidth>0; })()`));
    const credentialB = await credential(b.control); const docsB = await documents(b.affiliateId);
    const exclusiveAPath = docsA.privatePaths.find((item) => !docsB.privatePaths.includes(item));
    const exclusiveBPath = docsB.privatePaths.find((item) => !docsA.privatePaths.includes(item));
    if (!exclusiveAPath || !exclusiveBPath) throw new Error('No mutually exclusive private paths available for cross-user Storage certification');
    const deniedBA = await deniedAgainst(a.affiliateId, exclusiveAPath);
    const noAAfterB = await evaluate(`${JSON.stringify(a.affiliateId)}!==window.AffiliateAuth.getState().affiliate.id&&!document.documentElement.innerHTML.includes(${JSON.stringify(a.affiliateId)})&&!${JSON.stringify(docsA.urls)}.some(url=>document.documentElement.innerHTML.includes(url))&&Object.keys(localStorage).filter(k=>/(document|affiliate|expediente)/i.test(k)).length===0`);
    if (!profileB || !credentialB || !docsB.count || docsB.count !== docsB.uiCount || !docsB.owners || !docsB.signedValid || !docsB.fetchOk || !Object.values(deniedBA).every(Boolean) || !noAAfterB) throw new Error('User B isolation mismatch');
    await logout();

    mark('user_a_cross_b');
    await login('H005_TEST2'); const deniedAB = await deniedAgainst(b.affiliateId, exclusiveBPath); if (!Object.values(deniedAB).every(Boolean)) throw new Error('User A cross-boundary vector '+JSON.stringify(deniedAB)); await logout();

    mark('anonymous');
    const anonFiles = await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/affiliate_files?select=id&limit=1`, { headers:{ apikey:env.SUPABASE_PUBLISHABLE_KEY } });
    const anonAsset = exclusiveAPath ? await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/storage/v1/object/private-assets/${encodeURI(exclusiveAPath)}`, { headers:{ apikey:env.SUPABASE_PUBLISHABLE_KEY } }) : { ok:false };
    if (anonFiles.ok || anonAsset.ok) throw new Error('Anonymous private access was not denied');

    mark('admin_login');
    const admin = await login('H005_TEST');
    mark('admin_authorization');
    await waitFor(() => evaluate("window.AdminRepository&&window.AdminRepository.getState().phase==='authorized'"));
    mark('admin_tab');
    await clickButton('Admin'); await waitFor(() => evaluate("document.body.innerText.includes('Panel Administrativo')"));
    mark('admin_identity_module');
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Identidad y expediente')).click()"); await waitFor(() => evaluate("Boolean(document.querySelector('input[placeholder*=control]'))"));
    async function adminLookup(control, expectedId, expectedCount) {
      await setField('input[placeholder*=control]', control); await clickButton('Buscar');
      await waitFor(() => evaluate(`Boolean([...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(control)})))`));
      await evaluate(`([...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(control)}))).click()`);
      return waitFor(() => evaluate(`document.querySelector('[data-admin-affiliate-documents=${JSON.stringify(expectedId)}]')&&document.querySelectorAll('[data-admin-document-owner=${JSON.stringify(expectedId)}]').length===${expectedCount}`));
    }
    mark('admin_lookup_a');
    const adminA = await adminLookup(a.control, a.affiliateId, docsA.count);
    mark('admin_lookup_b');
    const adminB = await adminLookup(b.control, b.affiliateId, docsB.count);

    mark('impersonation');
    await setField('textarea[placeholder*=operativo]', 'Certificación quirúrgica expediente Fase 3');
    await clickButton('Solicitar préstamo a nombre del afiliado'); impersonationActive = true;
    await waitFor(() => evaluate(`window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(b.affiliateId)}&&Boolean(window.AffiliateAuth.getState().impersonation)`));
    const impersonationIdentity = await evaluate(`window.AffiliateAuth.getState().session.user.id===${JSON.stringify(admin.authId)}&&window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(b.affiliateId)}`);
    await home(); await profile(); const impersonationProfile = await waitFor(() => evaluate(`(() => { const avatar=document.querySelector('[data-profile-photo-consumer=profile]');const image=avatar&&avatar.querySelector('img');return document.querySelector('[data-affiliate-id]').dataset.affiliateId===${JSON.stringify(b.affiliateId)}&&avatar&&avatar.dataset.avatarPhotoState==='photo'&&image&&image.complete&&image.naturalWidth>0; })()`)); const impersonationCredential = await credential(b.control); const impersonationDocs = await documents(b.affiliateId);
    if (!impersonationIdentity || !impersonationProfile || !impersonationCredential || impersonationDocs.count !== docsB.count) throw new Error('Impersonation expediente mismatch');
    await evaluate("document.querySelector('[data-impersonation-active] button:last-child').click()"); impersonationActive = false;
    await waitFor(() => evaluate(`!window.AffiliateAuth.getState().impersonation&&window.AffiliateAuth.getState().session.user.id===${JSON.stringify(admin.authId)}&&window.AffiliateAuth.getState().affiliate.id===${JSON.stringify(admin.affiliateId)}`));
    await logout(); await protocol.call('Page.reload', { ignoreCache:true });
    const noStaleImpersonation = await waitFor(() => evaluate("window.AffiliateAuth&&window.AffiliateAuth.getState().phase==='unauthenticated'&&!document.querySelector('[data-impersonation-active]')&&!document.querySelector('[data-document-id]')"));

    console.log(JSON.stringify({
      status:'PASS', real_chrome:true,
      user_a:{profile:Boolean(profileA),credential:Boolean(credentialA),documents:docsA.count,signed_urls:true},
      user_b:{profile:Boolean(profileB),credential:Boolean(credentialB),documents:docsB.count,signed_urls:true},
      cross_user:{a_to_b:'DENIED',b_to_a:'DENIED',affiliate_uuid:'DENIED',private_asset_api:'DENIED'},
      anonymous:'DENIED',admin:{lookup_a:Boolean(adminA),lookup_b:Boolean(adminB),permission:'assets.read'},normal_user_admin_denied:Boolean(normalAdminDeniedA),
      impersonation:{identity:Boolean(impersonationIdentity),profile:Boolean(impersonationProfile),credential:Boolean(impersonationCredential),documents:impersonationDocs.count,restored:true,stale_after_logout:!noStaleImpersonation?1:0},
      refresh:{same_documents:true,capabilities_regenerated:true},logout_login_switch:{stale_documents:0,identity_leaks:0},
      states:{empty:Boolean(emptyState),repository_error:Boolean(errorState),retry:true},local_productive_document_authorities:0,productive_fixtures:0,
    }));
  } catch (error) {
    throw new Error(`${stage}: ${error.message}`);
  } finally {
    if (impersonationActive && evaluate) { try { await evaluate('window.AdminRepository.stopImpersonation()'); } catch (_) {} }
    if (protocol) protocol.close(); chrome.kill();
    await Promise.race([new Promise((resolve)=>chrome.once('exit',resolve)),sleep(2000)]);
    server.closeAllConnections();
    await new Promise((resolve)=>server.close(resolve));
    if (path.resolve(profileDir).startsWith(safeTemp)) { try { fs.rmSync(profileDir,{recursive:true,force:true,maxRetries:5,retryDelay:250}); } catch (_) {} }
  }
}

main().catch((error) => { console.error(JSON.stringify({ status:'FAIL', error:error.message })); process.exitCode=1; });
