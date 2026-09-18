'use strict';
// ADR-111 focal check: the 25 editorial keys are one contract shared by the
// migration seed, the store and the screen, and the calculator stays hardcoded.
// No network, no Supabase, no business writes: the repository is stubbed.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert').strict;
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ── 1. Seed declared by the migration ──────────────────────────────────────
const sql = read('supabase/migrations/20260917000300_investment_screen_copy.sql');
const seed = {};
sql.split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*\('([^']+)','(.*)',(\d+)\)[,;]\s*$/);
  if (m) seed[m[1]] = m[2];
});
const seedKeys = Object.keys(seed);
assert.equal(seedKeys.length, 25, 'la migración debe sembrar exactamente 25 textos');

// ── 2. Minimal React + window so the real sources run unmodified ───────────
// Una sola pasada de render: los hooks devuelven su valor inicial, sin estado.
const React = {
  Fragment: 'FRAGMENT',
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect() {},
  useRef: (v) => ({ current: v }),
};
const stubComponent = (name) => function Stub() { return { type: name, props: {}, children: [] }; };
const ctx = { console, setTimeout, clearTimeout, React };
ctx.window = ctx;
ctx.Icon = stubComponent('icon');
ctx.Skeleton = stubComponent('skeleton');
ctx.SutiSeal = stubComponent('seal');
ctx.Btn = stubComponent('btn');
ctx.EmptyState = stubComponent('empty');
ctx.useBtnConfirm = () => [false, (fn) => fn && fn()];
ctx.MOTION = { reduced: () => true, frozen: () => true, animate: () => null, dur: {}, ease: {}, stagger: { max: 6, step: 35 } };
vm.createContext(ctx);

// The repository is the only seam: it answers with the migration's own seed.
let repoFails = false;
ctx.InvestmentCopyRepository = {
  list: async () => {
    if (repoFails) throw new Error('stubbed outage');
    return seedKeys.map((id, i) => ({ id, value: seed[id], sort_order: (i + 1) * 10 }));
  },
  save: async (id, value) => ({ id, value, sort_order: 0 }),
};

for (const file of ['app/investment-copy-store.jsx', 'app/screens-inversion.jsx', 'app/screens-admin-inversion.jsx']) {
  vm.runInContext(read(file), ctx, { filename: file });
}
const store = ctx.investmentCopyStore;

// ── 3. One contract of keys ────────────────────────────────────────────────
// Los arreglos nacen en el contexto vm: se comparan por contenido, no por prototipo.
assert.equal(Array.from(store.KEYS).sort().join('|'), seedKeys.slice().sort().join('|'),
  'las llaves del store y de la migración deben coincidir exactamente');

// ── 4. The shipped copy raises no advisory; a wrong figure does ────────────
seedKeys.forEach((id) => assert.equal(store.advisory(id, seed[id]), null,
  'el texto autorizado no debe disparar aviso: ' + id));
assert(store.advisory('hero.title', 'Tu dinero rinde 3% mensual'), 'un 3% debe avisar');
assert(store.advisory('hero.fact.1', 'Desde $80,000'), 'un monto ajeno debe avisar');
assert.equal(store.advisory('hero.rate.annual', '30% anual'), null, 'el anual autorizado no avisa');

// ── 5. Render helpers ──────────────────────────────────────────────────────
function texts(node, out) {
  out = out || [];
  if (node == null || node === false) return out;
  if (Array.isArray(node)) { node.forEach((n) => texts(n, out)); return out; }
  if (typeof node === 'string') { out.push(node); return out; }
  if (typeof node !== 'object') return out;
  // Un componente se invoca para leer lo que realmente pinta.
  if (typeof node.type === 'function') texts(node.type(Object.assign({}, node.props)), out);
  if (node.children) texts(node.children, out);
  return out;
}
const render = (fn, props) => fn(props);
const app = { back() {}, toast() {} };

// ── 6. Screen in error: offers retry, invents no copy ──────────────────────
repoFails = true;
(async () => {
  await store.retry();
  assert.equal(store.state().phase, 'error');
  let flat = texts(render(ctx.InvestmentScreen, { app }));
  assert(flat.includes('Reintentar'), 'la pantalla en error debe ofrecer reintentar');
  seedKeys.forEach((id) => assert(!flat.includes(seed[id]),
    'sin autoridad no se pinta copy de respaldo: ' + id));

  // ── 7. Screen loaded: the 25 texts come from the store ───────────────────
  repoFails = false;
  await store.retry();
  assert.equal(store.state().phase, 'loaded');
  flat = texts(render(ctx.InvestmentScreen, { app }));
  seedKeys.forEach((id) => assert(flat.includes(seed[id]), 'falta en pantalla: ' + id));

  // ── 8. The calculator is NOT administrable and stays literal ─────────────
  const calculator = ['Calcula tu rendimiento', 'MONTO', 'Plazo', 'Mínimo 6 meses · renovable',
    'RECIBES CADA MES', 'RENDIMIENTO ACUMULADO', 'Inviertes', 'Rendimiento total', 'Capital al final'];
  calculator.forEach((label) => {
    assert(flat.includes(label), 'la etiqueta de la calculadora debe seguir en pantalla: ' + label);
    assert(!store.KEYS.includes(label), 'la calculadora no puede tener llave administrable');
  });
  assert(!store.KEYS.some((k) => k.startsWith('calc') || k.startsWith('footer') || k.startsWith('cta')),
    'ninguna llave puede pertenecer al bloque de cálculo, pie o CTA');
  assert.equal(Object.keys(ctx.SUTI_INVESTMENT_SIMULATION).sort().join(','),
    'MAX,MIN,RATE,STEP,TERMS,calculate',
    'las constantes de la simulación no cambian');
  assert.equal(ctx.SUTI_INVESTMENT_SIMULATION.RATE, 0.025);

  // ── 9. Admin panel lists every key, grouped ──────────────────────────────
  assert.equal(typeof ctx.InversionTextosModule, 'function', 'falta window.InversionTextosModule');
  const header = (props) => ({ type: 'header', props, children: [props.title, props.sub] });
  const panel = texts(render(ctx.InversionTextosModule, { app, onBack() {}, header, canEdit: true }));
  assert(panel.includes('Suti Inversión'), 'el panel se titula Suti Inversión');
  store.GROUPS.forEach((g) => {
    assert(panel.includes(g.label), 'falta el grupo ' + g.label);
    g.items.forEach((item) => assert(panel.includes(item.label), 'falta el campo ' + item.label));
  });
  const fields = store.GROUPS.reduce((n, g) => n + g.items.length, 0);
  assert.equal(fields, 25, 'el panel debe exponer los 25 textos');

  console.log('PASS  25 llaves · migración=store=pantalla · calculadora intacta · panel completo');
})().catch((error) => { console.error('FAIL ', error.message); process.exit(1); });
