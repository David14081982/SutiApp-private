'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const registry = read('app/assets-registry.jsx');
const store = read('app/assets-store.jsx');
const resolver = read('app/assets-resolver.jsx');
const visualRepositories = read('app/visual-repositories.js');
const visualContent = read('app/visual-content.js');
const adminRepository = read('app/admin-repository.js');
const admin = read('app/screens-admin-branding.jsx');
const app = read('app/app.jsx');
const financialRepository = read('app/financial-legacy-repository.js');
const sw = read('sw.js');

assert(registry.includes("ENTRIES['home.header.collapsed']"));
assert(registry.includes("label: 'Foto del header colapsado (Inicio)'"));
assert(registry.includes("group: 'Inicio'"));
assert(registry.includes("slot: 'home-header-collapsed'"));
assert(registry.includes("src: './assets/branding/home-header-collapsed.webp'"));
assert(registry.includes("icon: 'image'"));

assert(resolver.indexOf("source: 'override'") < resolver.indexOf("source: 'slot'"));
assert(resolver.indexOf("source: 'slot'") < resolver.indexOf("source: 'registry-src'"));
assert(resolver.indexOf("source: 'registry-src'") < resolver.indexOf("source: 'registry-icon'"));
assert(store.includes('setAuthoritative'));
assert(visualRepositories.includes("getByKey('home.header.collapsed')"));
assert(visualContent.includes("setAuthoritative('home.header.collapsed'"));

assert(app.includes("window.useAsset('home.header.collapsed')"));
assert(app.includes("(p - .35) / .65"));
assert(app.includes('TRAVEL * .55 * p'));
assert(app.includes('1.08 - .08 * p'));
assert(app.includes("objectPosition:'50% 32%'"));
assert(app.includes("pointerEvents:'none'"));
assert(app.includes("right: 0, top: '50%', marginTop: -100"), 'el sello de Inicio debe quedar centrado verticalmente y alineado a la derecha');
assert(app.includes("right: 0, top: '50%', marginTop: -90"), 'el sello de las cabeceras internas debe quedar centrado verticalmente y alineado a la derecha');
assert(!/home-header-collapsed\.(?:png|webp)/.test(app), 'Inicio no debe referenciar el archivo directo');
assert(app.includes("saludoHome() + ','"));
assert(app.includes("h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'"));
assert(app.includes("'data-home-financial-chips': 'partial'"));
assert(app.includes("'data-home-credit-state': availableCreditReady ? 'ready'"));
assert(app.includes("'data-home-savings-state': 'pending-source'"));
assert(app.includes("balChip('Crédito disponible', availableCreditReady ? window.money(availableCredit) : '—', 'cash')"));
assert(app.includes("balChip('Mi ahorro', '—', 'piggy')"));
assert(app.includes("typeof window.FinancialLegacyRepository.availableCreditTotal === 'function'"));
assert(!app.includes("'data-affiliate-field': 'topbar-control'"));
assert(financialRepository.includes("program.status === 'AVAILABLE'"));
assert(financialRepository.includes('Number(program.max_amount)'));
assert(financialRepository.includes('amounts.reduce((total, amount) => total + amount, 0)'));

const financeContext = { window: {}, React: {} };
vm.createContext(financeContext);
vm.runInContext(financialRepository, financeContext, { filename: 'financial-legacy-repository.js' });
const totalAvailable = financeContext.window.FinancialLegacyRepository.availableCreditTotal;
assert.strictEqual(totalAvailable({ programs: [
  { status: 'AVAILABLE', max_amount: 20000 },
  { status: 'AVAILABLE', max_amount: 30000 },
  { status: 'AVAILABLE', max_amount: 10000 },
  { status: 'SCHEDULED', max_amount: 90000 },
  { status: 'UNAVAILABLE', max_amount: 80000 },
] }), 60000);
assert.strictEqual(totalAvailable({ programs: [] }), 0);
assert.strictEqual(totalAvailable({ programs: [{ status: 'AVAILABLE', max_amount: null }] }), null);

assert(admin.includes("title:'Foto de la cabecera de Inicio'"));
assert(admin.includes("window.useAsset('home.header.collapsed')"));
assert(admin.includes("uploadResourceAsset(file,'home.header.collapsed')"));
assert(admin.includes("resetResourceAsset('home.header.collapsed')"));
assert(admin.includes("ratio:'12 / 5'"));
assert(admin.includes("position:'50% 32%'"));
assert(admin.includes('mínimo 1200 × 500 px'));
assert(adminRepository.includes("new Set(['home.header.collapsed'])"));
assert(adminRepository.includes("status:'DISABLED'"));

assert(sw.includes("'./assets/branding/home-header-collapsed.webp'"));
require('./verification-helpers').assertPwaVersionSync(root);
assert(sw.includes("'./app/financial-legacy-repository.js?v=10'"));
assert(fs.statSync(path.join(root, 'assets/branding/home-header-collapsed.webp')).size > 0);

const memory = {};
const context = {
  console,
  localStorage: {
    getItem: (key) => memory[key] || null,
    setItem: (key, value) => { memory[key] = value; },
  },
  window: {
    ICON_CATALOG: { fallback: 'grid' },
    ImageSlotAPI: { subscribe: () => () => {}, get: () => 'user://header' },
  },
};
vm.createContext(context);
vm.runInContext(store, context);
context.window.ASSETS_REGISTRY = { get: () => ({ key:'home.header.collapsed', kind:'image', slot:'home-header-collapsed', src:'./assets/branding/home-header-collapsed.webp', icon:'image' }) };
vm.runInContext(resolver, context);
let notifications = 0;
context.window.assetsStore.subscribe(() => { notifications += 1; });
context.window.assetsStore.setAuthoritative('home.header.collapsed', { url:'admin://header' });
assert.strictEqual(context.window.AssetsResolver.resolve('home.header.collapsed').source, 'override');
context.window.assetsStore.setAuthoritative('home.header.collapsed', { url:null });
assert.strictEqual(context.window.AssetsResolver.resolve('home.header.collapsed').source, 'slot');
context.window.ImageSlotAPI.get = () => null;
assert.strictEqual(context.window.AssetsResolver.resolve('home.header.collapsed').source, 'registry-src');
assert.strictEqual(notifications, 2, 'el store debe notificar cada cambio autoritativo sin polling');

console.log('home header collapsed resource: PASS');
