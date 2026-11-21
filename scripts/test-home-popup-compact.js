'use strict';
// H-HOME-POPUP-COMPACT-001: pop-up de Inicio antes (206c37c) vs. ahora; medidas, capturas y comportamiento.
const fs = require('fs'), path = require('path'), cp = require('child_process'), assert = require('assert').strict;
const { chromium } = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
const out = process.argv[2] || path.join(root, 'docs/qa/evidence/home-popup-compact-20261120');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const old = (f) => cp.execFileSync('git', ['show', '206c37c:' + f], { cwd: root, encoding: 'utf8', maxBuffer: 8e6 });
const popup = (src) => '(function(){const {useState,useEffect}=React,I=Icon;' + src.slice(src.indexOf('  function AdminPopup('), src.indexOf('  window.AdminPopup = AdminPopup;')) + 'window.AdminPopup=AdminPopup;})();';
const img = (a, b) => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="680" height="368"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="680" height="368" fill="url(#g)"/></svg>');

const AMCO = (n) => Array.from({ length: n }, (_, i) => ({ id: 'amco' + i, titulo: i ? 'Convenio ' + (i + 1) : 'Amco', contenido: 'Llantas, Refacciones y Servicios', image_url: img('#222', '#c00'), actionType: 'internal', actionTarget: 'convenios' }));
const UNILIDER = [
  { id: 'bien', etiqueta: 'BIENVENIDA', subtitulo: 'Tu súper app sindical', titulo: '¡Hola! Bienvenida a SutiApp', contenido: 'Consulta tu crédito, credencial digital, convenios y trámites en un solo lugar. Todo tu sindicato, en tu bolsillo.', image_url: img('#d11f3a', '#5a0016'), ctaText: 'Explorar la app', actionType: 'internal', actionTarget: 'financiera' },
  { id: 'uni', etiqueta: 'CONVENIO DESTACADO', subtitulo: 'Unilíder', titulo: '50% de descuento en tu primera compra', contenido: 'Presenta tu credencial SUTISSSTESON en cualquier sucursal Unilíder y obtén 50% en tus mensualidades. Válido este mes.', image_url: img('#6aa7d8', '#8a5a3a'), ctaText: 'Ver convenio', actionType: 'internal', actionTarget: 'convenios' },
];

async function ready(page) {
  await page.locator('h3').waitFor();
  await page.waitForFunction(() => { const b = document.querySelector('button[aria-label="Cerrar"]'); if (!b) return false; const s = getComputedStyle(b.parentElement); return s.opacity === '1' && s.transform === 'matrix(1, 0, 0, 1, 0, 0)'; });
  await page.evaluate(() => document.fonts.ready);
}
const measure = (page) => page.evaluate(() => {
  const card = document.querySelector('button[aria-label="Cerrar"]').parentElement, c = card.getBoundingClientRect();
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +(r.left - c.left).toFixed(1), y: +(r.top - c.top).toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const close = document.querySelector('button[aria-label="Cerrar"]'), prev = document.querySelector('button[aria-label="Anterior"]');
  const later = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ahora no');
  const cta = card.querySelector('.su-btn');
  const dots = [...card.querySelectorAll('[data-popup-dot]')].map((d) => { const r = d.getBoundingClientRect(), a = getComputedStyle(d, '::after'); const w = a.content !== 'none' ? parseFloat(a.width) : r.width; return { cx: +((r.left + r.right) / 2 - c.left).toFixed(1), w }; });
  const title = card.querySelector('h3');
  return {
    card: +c.height.toFixed(1), closeHit: R(close), closeVisual: R(close.firstElementChild && close.firstElementChild.tagName === 'SPAN' ? close.firstElementChild : close),
    arrowHit: R(prev), arrowVisual: R(prev && (prev.firstElementChild.tagName === 'SPAN' ? prev.firstElementChild : prev)),
    title: R(title), titleLH: getComputedStyle(title).lineHeight, text: R(card.querySelector('p')), cta: R(cta), later: R(later),
    laterText: later && (() => { const rg = document.createRange(); rg.selectNodeContents(later); const r = rg.getBoundingClientRect(); return { y: +(r.top - c.top).toFixed(1), h: +r.height.toFixed(1) }; })(),
    dots, counter: card.querySelector('.su-popup-count') && card.querySelector('.su-popup-count').textContent,
  };
});

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const report = {}, errors = [];
  try {
    for (const [label, src, css] of [['antes', old('app/admin-store.jsx'), old('app/text-size.css')], ['despues', read('app/admin-store.jsx'), read('app/text-size.css')]]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
      page.on('pageerror', (e) => errors.push(label + ': ' + e.message));
      await page.route('**/*', (r) => (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url()) ? r.continue() : r.abort()));
      const html = read('SutiApp.html');
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap"><style>' + html.match(/<style>([\s\S]*?)<\/style>/)[1] + '</style><style>' + css + '</style><style>body{margin:0;font-family:var(--font)}</style><div id="root"></div>');
      for (const f of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/icons.jsx', 'app/ui.jsx']) await page.addScriptTag({ content: read(f) });
      await page.addScriptTag({ content: popup(src) });
      await page.evaluate(() => {
        window.qaRoot = ReactDOM.createRoot(document.getElementById('root')); window.__closed = 0;
        window.renderQA = (items, size) => qaRoot.render(React.createElement('div', { 'data-text-size': size || undefined, style: { position: 'absolute', inset: 0, background: 'linear-gradient(#a3142f,#f2f3f5 45%)', fontSize: 'var(--text-control, 16px)' } }, React.createElement(AdminPopup, { key: Math.random(), items, onClose: () => window.__closed++ })));
      });
      const scenarios = [['amco-7', AMCO(7), 'normal'], ['unilider-2', UNILIDER, 'normal'], ['amco-3', AMCO(3), 'normal'], ['uno-solo', AMCO(1), 'normal'], ['amco-7-masgrande', AMCO(7), 'largest'], ['admin-preview-3', AMCO(3), null]];
      report[label] = {};
      for (const [name, items, size] of scenarios) {
        await page.evaluate(({ items, size }) => renderQA(items, size), { items, size });
        await ready(page);
        report[label][name] = await measure(page);
        await page.screenshot({ path: path.join(out, label + '-' + name + '.png') });
      }
      if (label === 'despues') {
        // Comportamiento: los mismos controles siguen funcionando.
        const slider = page.getByRole('slider', { name: 'Elegir imagen del carrusel' });
        await page.evaluate((items) => renderQA(items, 'normal'), AMCO(3)); await ready(page);
        const dots = await page.locator('[data-popup-dot]').evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; }));
        for (const i of [2, 0, 1]) { await page.touchscreen.tap(dots[i].x, dots[i].y); await page.waitForFunction((v) => document.querySelector('.su-popup-track input').value === v, String(i + 1)); }
        await page.mouse.click(dots[2].x, dots[2].y); assert.equal(await slider.inputValue(), '3');
        await slider.press('Home'); assert.equal(await slider.inputValue(), '1'); await slider.press('ArrowRight'); assert.equal(await slider.inputValue(), '2');
        await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); assert.equal(await slider.inputValue(), '3');
        await page.getByRole('button', { name: 'Anterior', exact: true }).click(); assert.equal(await slider.inputValue(), '2');
        assert.equal(await page.locator('h3').innerText(), 'Convenio 2');
        // Contador con 7: flechas y teclado siguen funcionando; tocar el contador no salta.
        await page.evaluate((items) => renderQA(items, 'normal'), AMCO(7)); await ready(page);
        assert.equal(await page.locator('.su-popup-count').innerText(), '1 de 7');
        await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); assert.equal(await page.locator('.su-popup-count').innerText(), '2 de 7');
        const cb = await page.locator('.su-popup-count').boundingBox(); await page.touchscreen.tap(cb.x + cb.width - 2, cb.y + cb.height / 2); await page.waitForTimeout(150);
        assert.equal(await page.locator('.su-popup-count').innerText(), '2 de 7');
        await slider.focus(); await slider.press('End'); assert.equal(await page.locator('.su-popup-count').innerText(), '7 de 7');
        assert((await slider.getAttribute('aria-valuetext')).startsWith('7 de 7:'));
        // Cerrar con ✕, con «Ahora no» y con el botón principal.
        for (const name of ['Cerrar', 'Ahora no', 'Continuar']) {
          await page.evaluate((items) => renderQA(items, 'normal'), AMCO(2).map((p) => ({ ...p, actionType: 'none' }))); await ready(page);
          const before = await page.evaluate(() => window.__closed);
          await page.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(320);
          assert.equal(await page.evaluate(() => window.__closed), before + 1, name);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        report.behavior = 'PASS';
      }
      await page.close();
    }
  } finally { await browser.close(); }
  report.errors = errors;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
