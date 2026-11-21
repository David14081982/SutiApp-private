'use strict';
// H-HOME-POPUP-DESIGN-001: el pop-up de Inicio debe ser idéntico al diseño «PopUp Inicio».
// Renderiza el diseño (HTML de referencia) y AdminPopup con las MISMAS condiciones que la app en vivo
// (estilos de SutiApp.html + text-size.css dentro de [data-text-size] + variables de marca que fija
// app.jsx) y compara posición, tamaño, tipografía y colores de cada elemento. Luego prueba acciones.
const fs = require('fs'), path = require('path'), assert = require('assert').strict;
const { chromium } = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
const out = process.argv[2] || path.join(root, 'docs/qa/evidence/home-popup-design-20261120');
const designFile = path.join(out, 'design-reference.html');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const popup = (src) => '(function(){const {useState,useEffect}=React,I=Icon;' + src.slice(src.indexOf('  function AdminPopup('), src.indexOf('  window.AdminPopup = AdminPopup;')) + 'window.AdminPopup=AdminPopup;})();';

// Mismo contenido que el diseño (sin imagen: degradado por tono).
const DESIGN_ITEMS = [
  { id: 'pp_bienvenida', etiqueta: 'BIENVENIDA', subtitulo: 'Tu súper app sindical', titulo: '¡Hola! Bienvenida a SutiApp', contenido: 'Consulta tu crédito, credencial digital, convenios y trámites en un solo lugar. Todo tu sindicato, en tu bolsillo.', hue: 345, ctaText: 'Explorar la app', actionType: 'internal', actionTarget: 'financiera' },
  { id: 'pp_unilider', etiqueta: 'CONVENIO DESTACADO', subtitulo: 'Unilíder', titulo: '50% de descuento en tu primera compra', contenido: 'Presenta tu credencial SUTISSSTESON en cualquier sucursal Unilíder y obtén 50% en tus mensualidades. Válido este mes.', hue: 205, ctaText: 'Ver convenio', actionType: 'internal', actionTarget: 'convenios' },
];
const MANY = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, titulo: i ? 'Convenio ' + (i + 1) : 'Amco', contenido: 'Llantas, Refacciones y Servicios', hue: 345, actionType: 'none' }));

// Medición común: [selector diseño, selector app] → caja relativa a la tarjeta + tipografía.
const PARTS = { card: ['.pp-card', '.su-popup'], close: ['.pp-close', '.su-pp-close'], tag: ['.pp-tag', '.su-pp-tag'], sub: ['.pp-sub', '.su-pp-sub'], title: ['.pp-title', '.su-pp-title'], text: ['.pp-text', '.su-pp-text'], arrowL: ['.pp-arrow', '.su-pp-arrow'], dotOn: ['.pp-dot.on', '.su-pp-dot[data-active="true"]'], dotOff: ['.pp-dot:not(.on)', '.su-pp-dot[data-active="false"]'], cta: ['.pp-cta', '.su-pp-cta'], later: ['.pp-later', '.su-pp-later'] };
const measure = (page, side) => page.evaluate(({ PARTS, side }) => {
  const card = document.querySelector(PARTS.card[side]), c = card.getBoundingClientRect(), res = {};
  for (const [k, sel] of Object.entries(PARTS)) {
    const el = document.querySelector(sel[side]); if (!el) { res[k] = null; continue; }
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    res[k] = { x: Math.round(r.left - c.left), y: Math.round(r.top - c.top), w: Math.round(r.width), h: Math.round(r.height), fs: s.fontSize, lh: s.lineHeight === 'normal' ? 'normal' : Math.round(parseFloat(s.lineHeight) * 10) / 10 + 'px', fw: s.fontWeight, color: s.color, bg: s.backgroundImage !== 'none' ? s.backgroundImage : s.backgroundColor };
  }
  return res;
}, { PARTS, side });

async function settle(page, sel) {
  await page.waitForFunction((sel) => { const c = document.querySelector(sel); if (!c) return false; const s = getComputedStyle(c); return s.opacity === '1' && (s.transform === 'none' || s.transform === 'matrix(1, 0, 0, 1, 0, 0)'); }, sel);
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(420); // termina la animación de cambio de slide
}
const fonts = (page) => page.route('**/*', (r) => (/^(file:|data:)|fonts\.(googleapis|gstatic)\.com/.test(r.request().url()) ? r.continue() : r.abort()));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  if (!fs.existsSync(designFile)) throw new Error('Falta ' + designFile + ' (copia del diseño aprobado)');
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const report = { viewport: '390x844', design: {}, app: {}, diffs: [], extra: {}, behavior: null, errors: [] };
  try {
    // 1) Diseño de referencia.
    const d = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    d.on('pageerror', (e) => report.errors.push('design: ' + e.message)); await fonts(d);
    await d.goto('file:///' + designFile.replace(/\\/g, '/'));
    await d.locator('.pp-card').hover(); // pausa el cambio automático
    await settle(d, '.pp-card'); report.design.slide1 = await measure(d, 0); await d.screenshot({ path: path.join(out, 'diseno-1.png') });
    await d.locator('.pp-arrow[data-go="1"]').click(); await d.locator('.pp-card').hover();
    await settle(d, '.pp-card'); report.design.slide2 = await measure(d, 0); await d.screenshot({ path: path.join(out, 'diseno-2.png') });

    // 2) App con las condiciones reales.
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    page.on('pageerror', (e) => report.errors.push('app: ' + e.message)); await fonts(page);
    const html = read('SutiApp.html');
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap"><style>' + html.match(/<style>([\s\S]*?)<\/style>/)[1] + '</style><style>' + read('app/text-size.css') + '</style><style>body{margin:0;font-family:var(--font)}</style><div id="root"></div>');
    for (const f of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/motion.jsx', 'app/icons.jsx', 'app/ui.jsx', 'app/press.jsx']) await page.addScriptTag({ content: read(f) });
    await page.addScriptTag({ content: popup(read('app/admin-store.jsx')) });
    await page.evaluate(() => {
      // Variables de marca exactamente como app.jsx (color institucional por defecto #910022).
      const el = document.documentElement, p = '#910022', mix = (pct, c) => `color-mix(in srgb, ${p} ${pct}%, ${c})`;
      el.style.setProperty('--guinda', p);
      el.style.setProperty('--grad-guinda-soft', `linear-gradient(145deg, ${mix(80, '#ffffff')}, ${p})`);
      el.style.setProperty('--glow-guinda', `0 10px 26px -6px ${mix(55, 'transparent')}, 0 4px 10px -2px ${mix(42, 'transparent')}`);
      window.qaRoot = ReactDOM.createRoot(document.getElementById('root')); window.__closed = 0;
      window.renderQA = (items, size) => qaRoot.render(React.createElement('div', { 'data-text-size': size || undefined, style: { position: 'absolute', inset: 0, background: 'var(--bg)', fontSize: 'var(--text-control, 16px)' } },
        React.createElement(AdminPopup, { key: Math.random(), items, onClose: () => window.__closed++ })));
    });
    const show = async (items, size, shot) => {
      await page.evaluate(({ items, size }) => renderQA(items, size), { items, size });
      await page.locator('.su-popup').hover(); await settle(page, '.su-popup');
      if (shot) await page.screenshot({ path: path.join(out, shot) });
    };
    await show(DESIGN_ITEMS, 'normal', 'app-1.png'); report.app.slide1 = await measure(page, 1);
    await page.locator('.su-pp-arrow[aria-label="Siguiente"]').click(); await page.locator('.su-popup').hover(); await settle(page, '.su-popup');
    report.app.slide2 = await measure(page, 1); await page.screenshot({ path: path.join(out, 'app-2.png') });

    // 3) Comparación elemento por elemento (tolerancia 1 px).
    for (const slide of ['slide1', 'slide2']) for (const k of Object.keys(PARTS)) {
      const a = report.design[slide][k], b = report.app[slide][k];
      if (!a && !b) continue;
      if (!a || !b) { report.diffs.push({ slide, part: k, design: a, app: b }); continue; }
      for (const f of ['x', 'y', 'w', 'h']) if (Math.abs(a[f] - b[f]) > 1) report.diffs.push({ slide, part: k, field: f, design: a[f], app: b[f] });
      // Tipografía sólo donde hay texto visible; en iconos y puntos cuenta la caja y el fondo.
      const textual = ['tag', 'sub', 'title', 'text', 'cta', 'later'].includes(k);
      for (const f of textual ? ['fs', 'lh', 'fw', 'color', 'bg'] : ['bg']) if (a[f] !== b[f]) report.diffs.push({ slide, part: k, field: f, design: a[f], app: b[f] });
    }

    // 4) Casos extra: 7 pop-ups (sólo puntos, sin contador), letra grande, vista previa de admin.
    await show(MANY(7), 'normal', 'app-7-popups.png');
    report.extra.sevenDots = await page.locator('.su-pp-dot').count();
    assert.equal(report.extra.sevenDots, 7); assert.equal(await page.locator('.su-popup-count').count(), 0);
    const dotsBox = await page.locator('.su-pp-dots').boundingBox(), cardBox = await page.locator('.su-popup').boundingBox();
    report.extra.sevenDotsCentered = Math.abs((dotsBox.x + dotsBox.width / 2) - (cardBox.x + cardBox.width / 2)) <= 1;
    assert(report.extra.sevenDotsCentered);
    await show(DESIGN_ITEMS, 'large', 'app-letra-grande.png'); report.extra.large = await measure(page, 1);
    await show(DESIGN_ITEMS, null, 'app-vista-previa-admin.png'); report.extra.adminPreview = await measure(page, 1);

    // 5) Comportamiento (sin cambios) + áreas táctiles de 48 px invisibles.
    await show(MANY(3), 'normal');
    const slider = page.getByRole('slider', { name: 'Elegir imagen del carrusel' });
    const dots = await page.locator('.su-pp-dot').evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; }));
    for (const i of [2, 0, 1]) { await page.touchscreen.tap(dots[i].x, dots[i].y); await page.waitForFunction((v) => document.querySelector('.su-pp-range').value === v, String(i + 1)); }
    await slider.press('Home'); assert.equal(await slider.inputValue(), '1'); await slider.press('End'); assert.equal(await slider.inputValue(), '3');
    await page.locator('.su-pp-arrow[aria-label="Siguiente"]').click(); assert.equal(await slider.inputValue(), '1');
    await page.locator('.su-pp-arrow[aria-label="Anterior"]').click(); assert.equal(await slider.inputValue(), '3');
    assert((await slider.getAttribute('aria-valuetext')).startsWith('3 de 3:'));
    const hit = await page.evaluate(() => {
      const at = (x, y) => { const e = document.elementFromPoint(x, y); return e && (e.closest('button') || e).className; };
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const c = r('.su-pp-close'), a = r('.su-pp-arrow'), l = r('.su-pp-later'), t = r('.su-pp-cta');
      return { close: at(c.left - 6, c.top + c.height / 2), arrow: at(a.left + a.width / 2, a.top - 4), laterBelow: at(l.left + l.width / 2, l.bottom + 14), ctaBottom: at(t.left + t.width / 2, t.bottom - 1),
        sizes: { close: Math.round(c.width + 14), arrow: Math.round(a.height + 10), later: Math.round(l.height + 28) } };
    });
    assert.equal(hit.close, 'su-pp-close'); assert.equal(hit.arrow, 'su-pp-arrow'); assert.equal(hit.laterBelow, 'su-pp-later'); assert.equal(hit.ctaBottom, 'su-pp-cta');
    assert(hit.sizes.close >= 48 && hit.sizes.arrow >= 48 && hit.sizes.later >= 44, JSON.stringify(hit.sizes));
    for (const sel of ['.su-pp-close', '.su-pp-later', '.su-pp-cta']) {
      await show(MANY(2), 'normal'); const before = await page.evaluate(() => window.__closed);
      await page.locator(sel).click(); await page.waitForTimeout(320); assert.equal(await page.evaluate(() => window.__closed), before + 1, sel);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    report.behavior = { status: 'PASS', touchTargets: hit.sizes };
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ diffs: report.diffs, behavior: report.behavior, errors: report.errors, extra: { sevenDots: report.extra.sevenDots, centered: report.extra.sevenDotsCentered } }, null, 1));
  if (report.diffs.length || report.errors.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
