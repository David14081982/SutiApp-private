'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const target = process.env.SUTIAPP_IMAGE_E2E_URL || 'https://david14081982.github.io/SutiApp-private/';

function loadPlaywright() {
  for (const candidate of [process.env.SUTIAPP_PLAYWRIGHT_PATH, 'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core'].filter(Boolean)) {
    try { return require(candidate); } catch (_) {}
  }
  throw new Error('Playwright Core no disponible');
}

function loadEnv() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

async function login(page, values, label = 'main') {
  if (await page.evaluate(() => window.AffiliateAuth?.getState().phase === 'authenticated')) return;
  try { await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 }); }
  catch (error) { if (await page.evaluate(() => window.AffiliateAuth?.getState().phase === 'authenticated')) return; throw new Error(`LOGIN_SURFACE_MISSING_${label}_${page.url()}_${(await page.locator('body').innerText().catch(() => '')).slice(0, 160)}`); }
  await page.locator('input[type="email"]').fill(values.H005_TEST_EMAIL);
  await page.locator('input[type="password"]').fill(values.H005_TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated', null, { timeout: 30000 });
}

async function loginSealSurface(page, label = 'main') {
  try { await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30000 }); }
  catch (error) { const phase = await page.evaluate(() => window.AffiliateAuth?.getState().phase || 'NO_AUTH').catch(() => 'EVAL_FAILED'); throw new Error(`LOGIN_SEAL_SURFACE_MISSING_${label}_${phase}_${page.url()}_${(await page.locator('body').innerText().catch(() => '')).slice(0, 160)}`); }
  await page.waitForFunction(() => [...document.images].some((image) => /sello/i.test(image.alt || '') && image.complete && image.naturalWidth > 0), null, { timeout: 30000 });
  return page.evaluate(() => {
    const image = [...document.images].find((item) => /sello/i.test(item.alt || ''));
    return { status: image && image.complete && image.naturalWidth > 0 ? 'PASS' : 'BROKEN_IMAGE', naturalWidth: image ? image.naturalWidth : 0, naturalHeight: image ? image.naturalHeight : 0 };
  });
}

async function audit(page) {
  return page.evaluate(async () => {
    const failures = [];
    const classify = (family, code, detail) => failures.push({ family, code, detail });
    const fetchAsset = async (url, expectedMime, family, signed, detail = '') => {
      if (!url) { classify(family, signed ? 'BROKEN_SIGNED_URL' : 'BROKEN_ASSET_RESOLUTION', 'URL_MISSING'); return false; }
      const expected = String(expectedMime || '').toLowerCase();
      if (expected.startsWith('image/')) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            await new Promise((resolve, reject) => {
              const image = new Image();
              const timer = setTimeout(() => { image.src = ''; reject(new Error('IMAGE_TIMEOUT')); }, 20000);
              image.onload = () => { clearTimeout(timer); image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve() : reject(new Error('IMAGE_EMPTY')); };
              image.onerror = () => { clearTimeout(timer); reject(new Error('IMAGE_ERROR')); };
              image.src = url;
            });
            return true;
          } catch (error) {
            if (attempt === 2) { classify(family, signed ? 'BROKEN_SIGNED_URL' : 'BROKEN_IMAGE', `${detail}${error.message}`); return false; }
          }
        }
      }
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
          const type = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
          if (!response.ok) { if (attempt < 2) continue; classify(family, signed && [400, 401, 403, 404].includes(response.status) ? 'BROKEN_SIGNED_URL' : 'BROKEN_IMAGE', `${detail}HTTP_${response.status}`); return false; }
          if (expected === 'application/pdf' && type !== 'application/pdf') { classify(family, 'BROKEN_ASSET_RESOLUTION', `${detail}MIME_${type || 'MISSING'}`); return false; }
          try { await response.body?.cancel(); } catch (_) {}
          return true;
        } catch (error) { if (attempt === 2) { const reason = `${error && error.name || 'ERROR'}_${error && error.message || ''}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120); classify(family, signed ? 'BROKEN_SIGNED_URL' : 'BROKEN_IMAGE', `${detail}FETCH_FAILED_${reason}`); return false; } }
      }
      return false;
    };
    const unique = (values) => [...new Set(values.filter(Boolean))];
    const parallelPassed = async (items, worker, concurrency = 12) => {
      let cursor = 0, passed = 0;
      const consume = async () => {
        while (cursor < items.length) {
          const index = cursor++;
          if (await worker(items[index])) passed++;
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, consume));
      return passed;
    };
    const report = { families: {}, surfaces: {}, failures };

    const branding = await window.BrandingRepository.get();
    const brandingEntries = [
      ['APP_ICON', branding.app_icon_url], ['INSTITUTIONAL_SEAL', branding.institutional_seal_url], ['FAVICON', branding.favicon_url],
      ['APPLE_TOUCH', branding.apple_touch_url], ['PWA_192', branding.pwa_icon_192_url], ['PWA_512', branding.pwa_icon_512_url],
      ['PWA_MASKABLE_512', branding.pwa_maskable_512_url], ['HOME_HEADER', branding.home_header_collapsed_url],
      ...(branding.install_screens || []).map((url, index) => [`INSTALL_${index + 1}`, url]),
    ].filter((entry) => entry[1]);
    const brandingUrls = unique(brandingEntries.map((entry) => entry[1]));
    const brandingPass = await parallelPassed(brandingEntries, ([label, url]) => fetchAsset(url, 'image/png', 'A_APP_ASSETS_PUBLIC', false, `BRANDING_${label}_`));
    report.surfaces.loginSeal = brandingPass === brandingUrls.length ? 'PASS' : 'BROKEN_IMAGE';

    const db = window.SutiSupabase.getClient();
    const assetsResult = await db.from('app_assets').select('id,storage_bucket,storage_path,mime_type,status').eq('status', 'READY').like('mime_type', 'image/%');
    if (assetsResult.error) throw assetsResult.error;
    const publicPass = await parallelPassed(assetsResult.data || [], (asset) => {
      const url = db.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl;
      return fetchAsset(url, asset.mime_type, 'A_APP_ASSETS_PUBLIC', false, `ASSET_${asset.id}_${asset.storage_bucket}_`);
    });
    report.families.appAssets = { status: publicPass === (assetsResult.data || []).length ? 'PASS' : 'FAIL', checked: (assetsResult.data || []).length, passed: publicPass };
    report.surfaces.publicBranding = { status: brandingPass === brandingEntries.length ? 'PASS' : 'FAIL', checked: brandingEntries.length, passed: brandingPass };

    const auth = window.AffiliateAuth.getState();
    const profileUrl = auth.affiliateView && auth.affiliateView.photoUrl;
    const profilePass = await fetchAsset(profileUrl, 'image/', 'D_PROFILE_PHOTOS', true);
    report.families.profilePhotos = { status: profilePass ? 'PASS' : 'FAIL', checked: 1 };
    report.surfaces.headerProfileCredential = profilePass ? 'PASS' : 'BROKEN_SIGNED_URL';

    const currentDocuments = await window.AffiliateRepository.getDocuments();
    const historicalDocuments = await window.AffiliateRepository.getHistoricalDocuments();
    const legacyAll = [...currentDocuments, ...historicalDocuments];
    const legacyPdf = legacyAll.find((doc) => doc.mimeType === 'application/pdf' && doc.signedUrl) || null;
    const legacyPass = await parallelPassed(legacyAll, (doc) => fetchAsset(doc.signedUrl, doc.mimeType, 'G_LEGACY_AFFILIATE_FILES', doc.classification === 'PRIVATE'));
    report.families.legacyAffiliateFiles = { status: legacyPass === legacyAll.length ? 'PASS' : 'FAIL', checked: legacyAll.length, passed: legacyPass, images: legacyAll.filter((doc) => String(doc.mimeType || '').startsWith('image/')).length, pdfs: legacyAll.filter((doc) => doc.mimeType === 'application/pdf').length };
    report.surfaces.expediente = report.families.legacyAffiliateFiles.status;

    const workflowPurpose = ['SELF_SERVICE_EXPEDIENTE', 'SELF_SERVICE_LOAN', 'SELF_SERVICE_MEMBERSHIP'];
    const workflow = [];
    for (const purpose of workflowPurpose) {
      const rows = await window.DocumentWorkflowRepository.listSelfDocuments(purpose);
      const candidates = rows.filter((row) => row.available && ['PENDING_REVIEW', 'UNDER_REVIEW', 'VERIFIED'].includes(row.status));
      const representative = candidates.find((row) => String(row.mimeType || '').startsWith('image/')) || candidates.find((row) => row.mimeType === 'application/pdf');
      if (!representative) { workflow.push({ purpose, status: 'NOT_APPLICABLE' }); continue; }
      try {
        const preview = await window.DocumentWorkflowRepository.selfPreview(representative, purpose);
        const ok = await fetchAsset(preview.signedUrl, preview.mimeType || representative.mimeType, 'C_AFFILIATE_DOCUMENTS', true);
        workflow.push({ purpose, status: ok ? 'PASS' : 'FAIL', mime: String(preview.mimeType || representative.mimeType).startsWith('image/') ? 'IMAGE' : 'PDF' });
      } catch (_) { classify('C_AFFILIATE_DOCUMENTS', 'BROKEN_SIGNED_URL', purpose); workflow.push({ purpose, status: 'FAIL' }); }
    }
    report.families.affiliateDocuments = { status: workflow.every((row) => row.status === 'PASS' || row.status === 'NOT_APPLICABLE') ? 'PASS' : 'FAIL', purposes: workflow };
    report.surfaces.membershipDocuments = workflow.find((row) => row.purpose === 'SELF_SERVICE_MEMBERSHIP')?.status || 'NOT_APPLICABLE';
    report.surfaces.loanDocuments = workflow.find((row) => row.purpose === 'SELF_SERVICE_LOAN')?.status || 'NOT_APPLICABLE';

    const ownId = auth.affiliate.id;
    const adminDocuments = await window.DocumentWorkflowRepository.listAdminDocuments(ownId, 'ADMIN_AFFILIATE_PROFILE');
    const adminRepresentative = adminDocuments.find((row) => row.available && String(row.mimeType || '').startsWith('image/'));
    let adminPreview = 'NOT_APPLICABLE';
    if (adminRepresentative) {
      try {
        const preview = await window.DocumentWorkflowRepository.adminPreview(adminRepresentative.id, ownId, 'ADMIN_AFFILIATE_PROFILE');
        adminPreview = await fetchAsset(preview.signedUrl, preview.mimeType || adminRepresentative.mimeType, 'B_PRIVATE_ASSETS_ADMIN', true) ? 'PASS' : 'FAIL';
      } catch (_) { classify('B_PRIVATE_ASSETS_ADMIN', 'BROKEN_SIGNED_URL', 'ADMIN_AFFILIATE_PROFILE'); adminPreview = 'FAIL'; }
    }
    report.families.privateAssetsAdmin = { status: adminPreview, checked: adminRepresentative ? 1 : 0 };

    const programItems = await window.ProgramCatalogRepository.listItems();
    const programUrls = unique(programItems.flatMap((item) => item.imagenes || []));
    const programGallery = programItems.find((item) => (item.imagenes || []).length > 1) || null;
    const programPass = await parallelPassed(programUrls, (url) => fetchAsset(url, 'image/', 'E_PROGRAM_CATALOG_ITEM_ASSETS', url.includes('/object/sign/')));
    report.families.programCatalogAssets = { status: programPass === programUrls.length ? 'PASS' : 'FAIL', checked: programUrls.length, passed: programPass, items: programItems.length };
    report.surfaces.programCatalog = report.families.programCatalogAssets.status;

    const products = await window.MarketplaceRepository.listProducts({ admin: false });
    const categories = await window.MarketplaceRepository.listCategories(false);
    const marketplaceUrls = unique([...products.flatMap((item) => item.imagenes || []), ...categories.map((item) => item.image_url)]);
    const marketplacePass = await parallelPassed(marketplaceUrls, (url) => fetchAsset(url, 'image/', 'A_APP_ASSETS_MARKETPLACE', false));
    report.surfaces.marketplace = { status: marketplacePass === marketplaceUrls.length ? 'PASS' : 'FAIL', checked: marketplaceUrls.length, passed: marketplacePass };

    const memberships = await window.MembershipRepository.list();
    const membershipUrls = unique(memberships.map((item) => item.logo));
    const membershipLogoPass = await parallelPassed(membershipUrls, (url) => fetchAsset(url, 'image/', 'A_APP_ASSETS_MEMBERSHIP', false));
    report.surfaces.membershipLogos = { status: membershipLogoPass === membershipUrls.length ? 'PASS' : 'FAIL', checked: membershipUrls.length, passed: membershipLogoPass };

    const staticEntries = performance.getEntriesByType('resource').filter((entry) => new URL(entry.name, location.href).origin === location.origin && /\.(?:js|css|png|webp|svg|ico|webmanifest)(?:\?|$)/i.test(entry.name));
    report.families.staticBundle = { status: staticEntries.every((entry) => entry.transferSize > 0 || entry.decodedBodySize > 0 || entry.duration > 0) ? 'PASS' : 'FAIL', checked: staticEntries.length };

    const host = document.createElement('div');
    host.id = 'global-image-regression-viewer-harness';
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    window.__globalImageViewerClosed = false;
    root.render(React.createElement(window.ImageViewer, { sources: [profileUrl], alt: 'Imagen protegida de prueba', onClose: () => { window.__globalImageViewerClosed = true; } }));
    const viewerDeadline = Date.now() + 15000;
    while (Date.now() < viewerDeadline) {
      const image = document.querySelector('#global-image-regression-viewer-harness [data-image-viewer="open"] img');
      if (image && image.complete && image.naturalWidth > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const viewerImage = document.querySelector('#global-image-regression-viewer-harness [data-image-viewer="open"] img');
    const viewerPass = Boolean(viewerImage && viewerImage.complete && viewerImage.naturalWidth > 0);
    document.querySelector('#global-image-regression-viewer-harness button[aria-label="Cerrar"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    root.unmount();
    host.remove();
    report.surfaces.fullscreenViewer = viewerPass ? 'PASS' : 'BROKEN_IMAGE';
    if (!viewerPass) classify('F_SHARED_VIEWER', 'BROKEN_IMAGE', 'FULLSCREEN_REAL_SIGNED_IMAGE');

    if (legacyPdf) {
      const pdfHost = document.createElement('div');
      pdfHost.id = 'global-image-regression-pdf-harness';
      document.body.appendChild(pdfHost);
      const pdfRoot = ReactDOM.createRoot(pdfHost);
      pdfRoot.render(React.createElement(window.DocumentViewer, { source: legacyPdf.signedUrl, mimeType: legacyPdf.mimeType, title: 'Documento PDF protegido', onClose: () => {} }));
      const pdfDeadline = Date.now() + 30000;
      while (Date.now() < pdfDeadline) {
        const frame = document.querySelector('#global-image-regression-pdf-harness [data-document-viewer="pdf"] iframe');
        if (frame && getComputedStyle(frame).opacity === '1') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const pdfFrame = document.querySelector('#global-image-regression-pdf-harness [data-document-viewer="pdf"] iframe');
      const pdfPass = Boolean(pdfFrame && getComputedStyle(pdfFrame).opacity === '1');
      pdfRoot.unmount();
      pdfHost.remove();
      report.surfaces.affiliateDocumentPdf = pdfPass ? 'PASS' : 'OTHER';
      if (!pdfPass) classify('C_AFFILIATE_DOCUMENTS', 'OTHER', 'PDF_VIEWER_DID_NOT_LOAD');
    } else {
      report.surfaces.affiliateDocumentPdf = 'NOT_APPLICABLE_CURRENT_ACCOUNT';
    }

    if (programGallery) {
      const galleryHost = document.createElement('div');
      galleryHost.id = 'global-image-regression-gallery-harness';
      document.body.appendChild(galleryHost);
      const galleryRoot = ReactDOM.createRoot(galleryHost);
      galleryRoot.render(React.createElement(window.ImageViewer, { sources: programGallery.imagenes, alt: 'Galería protegida de producto', onClose: () => {} }));
      const firstDeadline = Date.now() + 20000;
      while (Date.now() < firstDeadline) {
        const image = document.querySelector('#global-image-regression-gallery-harness [data-image-viewer="open"] img');
        if (image && image.complete && image.naturalWidth > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const first = document.querySelector('#global-image-regression-gallery-harness [data-image-viewer="open"] img');
      const firstSource = first && first.src;
      document.querySelector('#global-image-regression-gallery-harness button[aria-label="Imagen siguiente"]')?.click();
      const secondDeadline = Date.now() + 20000;
      while (Date.now() < secondDeadline) {
        const image = document.querySelector('#global-image-regression-gallery-harness [data-image-viewer="open"] img');
        if (image && image.src !== firstSource && image.complete && image.naturalWidth > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const second = document.querySelector('#global-image-regression-gallery-harness [data-image-viewer="open"] img');
      const galleryPass = Boolean(firstSource && second && second.src !== firstSource && second.complete && second.naturalWidth > 0);
      galleryRoot.unmount();
      galleryHost.remove();
      report.surfaces.programProductGallery = galleryPass ? 'PASS' : 'BROKEN_IMAGE';
      if (!galleryPass) classify('E_PROGRAM_CATALOG_ITEM_ASSETS', 'BROKEN_IMAGE', 'REAL_GALLERY_VIEWER');
    } else {
      report.surfaces.programProductGallery = 'OTHER';
      classify('E_PROGRAM_CATALOG_ITEM_ASSETS', 'OTHER', 'LEGITIMATE_GALLERY_FIXTURE_UNAVAILABLE');
    }

    report.cache = {
      serviceWorkerControlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      serviceWorkerScript: navigator.serviceWorker?.controller ? new URL(navigator.serviceWorker.controller.scriptURL).pathname.split('/').pop() : null,
      cacheNames: typeof caches === 'undefined' ? [] : await caches.keys(),
    };
    report.status = failures.length ? 'FAIL' : 'PASS';
    return report;
  });
}

async function adminSurface(page) {
  await page.evaluate(() => {
    const button = document.querySelector('[data-app-tab="admin"]');
    if (!button) throw new Error('Admin tab unavailable');
    button.click();
  });
  await page.locator('[data-admin-view="menu"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.evaluate(() => {
    const button = document.querySelector('[data-admin-module="affiliates"]');
    if (!button) throw new Error('Admin affiliates module unavailable');
    button.click();
  });
  await page.locator('[data-admin-affiliates="ready"]').waitFor({ state: 'visible', timeout: 30000 });
  const own = await page.evaluate(() => ({ id: window.AffiliateAuth.getState().affiliate.id, control: window.AffiliateAuth.getState().affiliate.numero_control }));
  await page.evaluate((control) => {
    const input = document.querySelector('[data-admin-affiliates] .aff-search input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, control);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, own.control);
  await page.waitForTimeout(700);
  await page.locator('[data-admin-affiliates="ready"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.evaluate(() => document.querySelector('[data-admin-affiliates] .aff-table-body > button')?.click());
  await page.locator(`[data-admin-affiliate-detail="${own.id}"]`).waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('[data-admin-affiliate-detail]').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('[data-admin-affiliates] .aff-avatar img')];
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
  }, null, { timeout: 30000 });
  const photos = await page.evaluate(() => {
    const images = [...document.querySelectorAll('[data-admin-affiliates] .aff-avatar img')];
    return { checked: images.length, passed: images.filter((image) => image.complete && image.naturalWidth > 0).length };
  });
  const expedition = page.getByRole('button', { name: 'Expediente', exact: true });
  if (await expedition.count()) await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Expediente')?.click());
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('[data-admin-affiliates] .aff-document-thumb img')];
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
  }, null, { timeout: 30000 }).catch(() => {});
  const documents = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-admin-affiliates] .aff-document-card')];
    const images = cards.map((card, index) => ({ card, image: card.querySelector('.aff-document-thumb img'), index })).filter((item) => item.image);
    const failed = images.filter((item) => !item.image.complete || item.image.naturalWidth < 1).map((item) => ({
      index: item.index,
      type: item.card.querySelector('strong')?.textContent.trim() || 'Documento',
      state: item.card.querySelector('small')?.textContent.trim() || '',
    }));
    return { checked: images.length, passed: images.filter((item) => item.image.complete && item.image.naturalWidth > 0).length, failed };
  });
  return {
    status: photos.checked > 0 && photos.passed === photos.checked && documents.passed === documents.checked ? 'PASS' : 'FAIL',
    photos,
    documentThumbnails: documents,
  };
}

async function freshProfileWithoutServiceWorker(browser, values) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    const seal = await loginSealSurface(page, 'fresh-no-service-worker');
    await login(page, values, 'fresh-no-service-worker');
    const result = await page.evaluate(async () => {
      const render = (url) => new Promise((resolve) => {
        if (!url) return resolve(false);
        const image = new Image(), timer = setTimeout(() => resolve(false), 30000);
        image.onload = () => { clearTimeout(timer); resolve(image.naturalWidth > 0 && image.naturalHeight > 0); };
        image.onerror = () => { clearTimeout(timer); resolve(false); };
        image.src = url;
      });
      const auth = window.AffiliateAuth.getState();
      const photo = await window.AffiliateRepository.getProfilePhoto(auth.affiliate.id);
      const programs = await window.ProgramCatalogRepository.listItems();
      const programImage = programs.flatMap((item) => item.imagenes || [])[0] || null;
      return {
        controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
        profile: await render(photo && photo.signedUrl),
        programImage: await render(programImage),
      };
    });
    return { status: seal.status === 'PASS' && !result.controlled && result.profile && result.programImage ? 'PASS' : 'FAIL', seal: seal.status, ...result };
  } finally { await context.close(); }
}

async function legitimatePdfSurface(browser, values) {
  for (const alias of ['H005_TEST', 'H005_TEST2', 'H005_TEST3']) {
    if (!values[`${alias}_EMAIL`] || !values[`${alias}_PASSWORD`]) continue;
    const context = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
      await login(page, { H005_TEST_EMAIL: values[`${alias}_EMAIL`], H005_TEST_PASSWORD: values[`${alias}_PASSWORD`] }, `pdf-${alias}`);
      const result = await page.evaluate(async (adminMode) => {
        let source = null;
        if (adminMode) {
          const queue = await window.DocumentWorkflowRepository.reviewQueue();
          let pdf = queue.find((doc) => doc.mimeType === 'application/pdf');
          if (!pdf) {
            const listed = await window.SutiSupabase.getClient().from('affiliate_documents')
              .select('id,affiliate_id,private_asset:private_assets!private_asset_id(mime_type),affiliate_file:affiliate_files!affiliate_file_id(mime_type)')
              .order('created_at', { ascending: false }).limit(1000);
            if (listed.error) throw listed.error;
            const row = (listed.data || []).find((item) => String((item.private_asset || item.affiliate_file || {}).mime_type || '').toLowerCase() === 'application/pdf');
            if (row) pdf = { id: row.id, affiliate_id: row.affiliate_id, mimeType: 'application/pdf' };
          }
          if (pdf) {
            const preview = await window.DocumentWorkflowRepository.adminPreview(pdf.id, pdf.affiliate_id, 'ADMIN_DOCUMENT_REVIEW');
            source = { signedUrl: preview.signedUrl, mimeType: preview.mimeType || pdf.mimeType };
          }
        } else {
          const documents = [...await window.AffiliateRepository.getDocuments(), ...await window.AffiliateRepository.getHistoricalDocuments()];
          const pdf = documents.find((doc) => doc.mimeType === 'application/pdf' && doc.signedUrl);
          if (pdf) source = pdf;
        }
        if (!source) return { found: false };
        let response = null;
        for (let attempt = 1; attempt <= 2 && !response; attempt++) {
          try { response = await fetch(source.signedUrl, { cache: 'no-store', signal: AbortSignal.timeout(30000) }); }
          catch (_) { if (attempt === 2) return { found: true, http: 0, mime: '', opened: false }; }
        }
        const mime = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
        try { await response.body?.cancel(); } catch (_) {}
        const host = document.createElement('div');
        host.id = 'global-image-regression-legitimate-pdf';
        document.body.appendChild(host);
        const root = ReactDOM.createRoot(host);
        root.render(React.createElement(window.DocumentViewer, { source: source.signedUrl, mimeType: source.mimeType, title: 'Documento PDF protegido', onClose: () => {} }));
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          const frame = document.querySelector('#global-image-regression-legitimate-pdf [data-document-viewer="pdf"] iframe');
          if (frame && getComputedStyle(frame).opacity === '1') break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const frame = document.querySelector('#global-image-regression-legitimate-pdf [data-document-viewer="pdf"] iframe');
        const opened = Boolean(frame && getComputedStyle(frame).opacity === '1');
        root.unmount();
        host.remove();
        return { found: true, http: response.status, mime, opened };
      }, alias === 'H005_TEST');
      if (result.found) return { status: result.http === 200 && result.mime === 'application/pdf' && result.opened ? 'PASS' : 'FAIL', account: alias, ...result };
    } finally { await context.close(); }
  }
  return { status: 'FAIL_SAFE', reason: 'LEGITIMATE_PDF_FIXTURE_UNAVAILABLE' };
}

async function main() {
  const values = loadEnv();
  assert(values.H005_TEST_EMAIL && values.H005_TEST_PASSWORD, 'Controlled login credentials missing');
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    const loginSeal = await loginSealSurface(page, 'initial');
    await login(page, values, 'initial');
    const initial = await audit(page);
    initial.surfaces.loginSeal = loginSeal.status;
    const admin = await adminSurface(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated', null, { timeout: 30000 });
    const refreshed = await page.evaluate(async () => {
      const render = (url) => new Promise((resolve) => {
        if (!url) return resolve(false);
        const image = new Image(), timer = setTimeout(() => resolve(false), 30000);
        image.onload = () => { clearTimeout(timer); resolve(image.naturalWidth > 0 && image.naturalHeight > 0); };
        image.onerror = () => { clearTimeout(timer); resolve(false); };
        image.src = url;
      });
      const branding = await window.BrandingRepository.get();
      const auth = window.AffiliateAuth.getState();
      const profilePhoto = await window.AffiliateRepository.getProfilePhoto(auth.affiliate.id);
      return {
        profile: await render(profilePhoto && profilePhoto.signedUrl),
        seal: await render(branding.institutional_seal_url),
      };
    });
    const unregistered = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return 0;
      const registrations = await navigator.serviceWorker.getRegistrations();
      const results = await Promise.all(registrations.map((registration) => registration.unregister()));
      return results.filter(Boolean).length;
    });
    const noServiceWorker = await freshProfileWithoutServiceWorker(browser, values);
    const pdfSurface = await legitimatePdfSurface(browser, values);
    assert.equal(initial.status, 'PASS', JSON.stringify(initial.failures));
    assert.equal(admin.status, 'PASS', JSON.stringify(admin));
    assert.deepEqual(refreshed, { profile: true, seal: true });
    assert.equal(noServiceWorker.status, 'PASS', JSON.stringify(noServiceWorker));
    assert.equal(pdfSurface.status, 'PASS', JSON.stringify(pdfSurface));
    assert.deepEqual(browserErrors, []);
    console.log(JSON.stringify({
      status: 'PASS',
      target: target.includes('github.io') ? 'GITHUB_PAGES_PRODUCTION' : 'LOCAL_BUILD_WITH_PRODUCTION_BACKEND',
      initial,
      loginSeal,
      admin,
      refresh: refreshed,
      cacheComparison: { freshProfile: true, serviceWorkerUnregistered: unregistered > 0, withoutServiceWorker: noServiceWorker },
      legitimatePdf: pdfSurface,
      browserErrors: 0,
      productionDataMutations: 0,
      rawUrlsLogged: 0,
    }));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
