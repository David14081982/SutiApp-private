'use strict';
const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');
const read = (file) => fs.readFileSync(file, 'utf8');
const storeSource = read('app/savings-store.jsx');
const savings = read('app/screens-savings.jsx');
const home = read('app/app.jsx');
const finance = read('app/screens-financiera.jsx');
const bundle = read('app/bundle.js');

for (const [file, source] of [['app/screens-savings.jsx', savings], ['app/app.jsx', home], ['app/screens-financiera.jsx', finance], ['app/bundle.js', bundle]]) new vm.Script(source, { filename: file });

global.React = { useEffect() {}, useState() { return [0, () => {}]; } };
global.window = { SavingsRepository: { getSelfDashboard: async () => ({}) } };
vm.runInThisContext(storeSource, { filename: 'app/savings-store.jsx' });
const select = window.SavingsBalanceReadModel.select;

assert.deepEqual(select({ selfPhase: 'ready', self: { participant: { id: 'test' }, balances: { total: 8000 } } }), { status: 'ready', value: 8000, label: '$8,000.00' });
assert.deepEqual(select({ selfPhase: 'ready', self: { participant: null, balances: null } }), { status: 'empty', value: null, label: '—' });
assert.deepEqual(select({ selfPhase: 'ready', self: { participant: { id: 'test' }, balances: { total: null } } }), { status: 'invalid', value: null, label: 'Por confirmar' });
assert.deepEqual(select({ selfPhase: 'error', self: null }), { status: 'error', value: null, label: '—' });

assert(storeSource.includes('dashboard.balances && dashboard.balances.total'));
assert(savings.includes('window.SavingsBalanceReadModel.select(state)'));
assert(home.includes('window.useSelfSavingsBalance(variant === \'home\')'));
assert(finance.includes('window.useSelfSavingsBalance(true)'));
assert(!home.includes("'data-home-savings-state': 'pending-source'"));
assert(!finance.includes('overview.savings && overview.savings.balance'));
assert(bundle.includes('window.SavingsBalanceReadModel = balanceReadModel'));
assert(bundle.includes("window.useSelfSavingsBalance(variant === 'home')"));
assert(bundle.includes('window.useSelfSavingsBalance(true)'));
assert(!bundle.includes('overview.savings && overview.savings.balance'));
for (const source of [storeSource, savings, home, finance]) assert(!/localStorage|sessionStorage|DP:DW|annual\.reduce|history\.reduce/.test(source));

console.log(JSON.stringify({ status: 'PASS', authority: 'get_self_savings_live_readonly', readModel: 'SavingsBalanceReadModel', active: '$8,000.00', empty: '—', invalid: 'Por confirmar', alternateSources: 0 }));
