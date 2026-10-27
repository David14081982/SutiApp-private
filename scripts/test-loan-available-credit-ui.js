'use strict';
/* Isolated contracts: no credentials, network or financial mutations. */
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const listeners = {}, calls = [];
const fixture = { policy: { allow_full: false, version: 0 }, can_configure: true, can_authorize: true, person: null, funds: [], history: [] };
let response = fixture, failure = null;
const window = { addEventListener: (name, callback) => { listeners[name] = callback; },
  SutiSupabase: { getClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { data: response, error: failure }; } }) } };
const context = vm.createContext({ window, React: { createElement: () => null }, Object, Set, Number, Date, Error });
vm.runInContext(read('app/financial-legacy-repository.js'), context);
vm.runInContext(read('app/loan-availability-admin.js'), context);
const total = window.FinancialLegacyRepository.availableCreditTotal;
const program = (available, extra) => ({ id: 'cash', status: 'AVAILABLE', max_amount: 40000, available_amount: available, ...extra });
assert.equal(total({ programs: [program(30000), program(18740.25)] }), 48740.25);
assert.equal(total({ programs: [program(0), program(0)] }), 0);
assert.equal(total({ programs: [program(0.1), program(0.2)] }), 0.3);
assert.equal(total({ programs: [program(30000), program(40000, { status: 'SCHEDULED' })] }), 30000);
assert.equal(total({ programs: [] }), 0);
assert.equal(total(null), null);
for (const invalid of [null, undefined, '30000', NaN, Infinity, -1]) {
  assert.equal(total({ programs: [program(invalid)] }), null, 'Missing/invalid availability cannot use max_amount');
}
assert.equal(listeners['suti:loan-capacity-changed'], undefined, 'Signals are bound only for active authenticated consumers');
const screen = read('app/screens-loan.jsx');
const normalize = screen.slice(screen.indexOf('  const DIACRITICS'), screen.indexOf('  const programsForFund'));
const availability = screen.slice(screen.indexOf('  const availableAmountOf'), screen.indexOf('  const textOrDash'));
const selection = screen.slice(screen.indexOf('  const hasShortTerms'), screen.indexOf('  const sameSelection'));
const model = vm.createContext({});
vm.runInContext(normalize + availability + selection + '\nthis.api = { deriveSelection, availableAmountOf };', model);
const base = { id: 'cash', fund: 'Caja Chica', min_amount: 1, max_amount: 40000, available_amount: 30000, suggested_amount: 5000,
  allowed_terms: [6, 12], custom_term: { min: 1, max: 12, step: 1 } };
assert.equal(model.api.deriveSelection(base, { amount: 35000, term: 12 }).amount, 30000);
assert.equal(model.api.deriveSelection({ ...base, available_amount: 1874.25 }, null).amount, 1874.25);
assert.equal(model.api.deriveSelection({ ...base, available_amount: 0 }, null).amount, 0);
assert.equal(model.api.deriveSelection({ ...base, available_amount: 0.25 }, null).amount, 0);
assert.equal(model.api.deriveSelection({ ...base, available_amount: null }, null).amount, 0);
assert.equal(model.api.deriveSelection({ ...base, available_amount: 40000 }, { amount: 40000, term: 12 }).amount, 40000);
assert.equal(base.max_amount, 40000);
for (const invalid of [null, undefined, '30000', -1, NaN]) assert.equal(model.api.availableAmountOf({ ...base, available_amount: invalid }), null);
assert.match(screen, /NO_AVAILABLE_BALANCE/);
assert.match(screen, /current: validSelection && state === 'READY'/);
assert.match(screen, /inactive: capacityExhausted \|\| capacityUnknown/);
assert.match(screen, /data-fund-available/);
assert.doesNotMatch(screen, /max = Number\(program\.max_amount\)/);
for (const file of ['app/app.jsx', 'app/screens-financiera.jsx']) {
  const source = read(file);
  assert.match(source, /FinancialLegacyRepository\.availableCreditTotal\(financial\.overview\)/);
  assert.match(source, /dec: Number\.isInteger\(availableCredit\) \? 0 : 2/);
}
async function main() {
  const repo = window.LoanAvailabilityRepository;
  await repo.read('00123');
  assert.equal(calls.at(-1).name, 'get_admin_loan_capacity');
  assert.equal(calls.at(-1).args.p_numero_control, '00123');
  await repo.setGlobal({ allowFull: true, version: 0, reason: 'Autorización de prueba aislada', key: 'global-isolated' });
  assert.equal(calls.at(-1).name, 'set_admin_loan_capacity_policy');
  assert.equal(calls.at(-1).args.p_allow_full, true);
  assert.equal(calls.at(-1).args.p_expected_version, 0);
  await repo.setIndividual({ affiliate: 'isolated-person', fund: 'isolated-fund', allowFull: false, version: 2, reason: 'Revocación de prueba aislada', key: 'individual-isolated' });
  assert.equal(calls.at(-1).name, 'set_admin_loan_capacity_override');
  assert.equal(calls.at(-1).args.p_affiliate_id, 'isolated-person');
  assert.equal(calls.at(-1).args.p_fund_id, 'isolated-fund');
  assert.equal(calls.at(-1).args.p_allow_full, false);
  for (const invalid of [null, {}, { ...fixture, policy: { allow_full: 'false', version: 0 } }, { ...fixture, can_authorize: undefined }, { ...fixture, funds: [{ id: 'x', label: 'X', allow_full: false, version: -1 }] }]) {
    response = invalid;
    await assert.rejects(() => repo.read(null), /LOAN_CAPACITY_INVALID_RESPONSE/);
  }
  response = fixture; failure = new Error('LOAN_CAPACITY_WRITE_DENIED');
  await assert.rejects(() => repo.setGlobal({ allowFull: true }), /LOAN_CAPACITY_WRITE_DENIED/);
  await testPublicationSignals();
  console.log(JSON.stringify({ status: 'PASS', isolated: true, availability: ['pending-debt', 'zero', 'cents', 'visible-only', 'fail-closed', 'profile-maximum-preserved'], admin: ['exact-control', 'global', 'individual', 'version', 'response-validation', 'denied'], freshness: ['publication-invalidation', 'duplicate-signal', 'focus-validation', 'discard-old-response', 'impersonation-isolation', 'signout-clear', 'unsubscribe'] }));
}
async function testPublicationSignals() {
  const events = new Map(), documentEvents = new Map(), authListeners = new Set(), channels = [], removed = [];
  let auth = { phase: 'authenticated', session: { user: { id: 'actor-a' }, session_id: 'session-a' }, affiliate: { id: 'affiliate-a', numero_control: '00123' } };
  let version = 1, hold = false, release, opens = 0, validates = 0;
  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  const response = () => ({ programs: [{ status: 'AVAILABLE', available_amount: 1000 * version }], capacity_source_version: 'v' + version,
    loanSession: { id: auth.affiliate.id + '-v' + version, expires_at: new Date(Date.now() + 900000).toISOString() } });
  const client = {
    auth: { getSession: async () => ({ data: { session: auth.session } }) },
    functions: { invoke: async (_, { body }) => {
      if (body.action === 'loanSessionValidate') {
        validates++;
        return body.snapshot_id === response().loanSession.id ? { data: { data: { googleResolutionCount: 0, loanSession: response().loanSession } } } : { error: { message: 'SNAPSHOT_INVALID' } };
      }
      assert.equal(body.action, 'loanSessionOpen'); opens++;
      const captured = response();
      if (hold) { hold = false; await new Promise((resolve) => { release = resolve; }); }
      return { data: { data: captured } };
    } },
    channel: () => { const channel = { on: (_, filter, callback) => { channel.change = callback; channel.filter = filter; return channel; }, subscribe: (callback) => { channel.connected = callback; return channel; } }; channels.push(channel); return channel; },
    removeChannel: async (channel) => { removed.push(channel); },
  };
  const document = { hidden: false, addEventListener: (name, fn) => documentEvents.set(name, fn), removeEventListener: (name) => documentEvents.delete(name) };
  const scopeWindow = { SutiSupabase: { getClient: () => client }, AffiliateAuth: { getState: () => auth, subscribe: (fn) => { authListeners.add(fn); return () => authListeners.delete(fn); } },
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: (name) => events.delete(name) };
  const scope = vm.createContext({ window: scopeWindow, document, Object, Set, Number, Date, Error });
  vm.runInContext(read('app/financial-legacy-repository.js'), scope);
  const store = scopeWindow.financialLegacyStore;
  const unsubscribe = store.subscribe(() => {});
  assert.equal(channels.length, 1);
  assert.equal(channels[0].filter.table, 'loan_history_publication');
  await store.openLoanSession(false);
  assert.equal(store.snapshot().overview.capacity_source_version, 'v1');
  channels[0].connected('SUBSCRIBED'); await settle();
  assert.equal(validates, 1);
  version = 2; channels[0].change({ new: { version: 'v2' } });
  assert.equal(store.snapshot().overview, null);
  await settle(); assert.equal(store.snapshot().overview.capacity_source_version, 'v2');
  const previousOpens = opens; channels[0].change({ new: { version: 'v2' } }); await settle(); assert.equal(opens, previousOpens);
  version = 3; events.get('focus')(); await settle(); assert.equal(store.snapshot().overview.capacity_source_version, 'v3');
  version = 4; hold = true; channels[0].change({ new: { version: 'v4' } }); await settle();
  const releaseOld = release;
  version = 5; channels[0].change({ new: { version: 'v5' } }); await settle();
  assert.equal(store.snapshot().overview.capacity_source_version, 'v5');
  releaseOld(); await settle(); assert.equal(store.snapshot().overview.capacity_source_version, 'v5');
  hold = true; version = 6; channels[0].change({ new: { version: 'v6' } }); await settle();
  const releaseOldAffiliate = release;
  auth = { ...auth, affiliate: { id: 'affiliate-b', numero_control: '00456' }, impersonation: { id: 'assisted-b' } };
  authListeners.forEach((fn) => fn()); await settle();
  assert.equal(store.snapshot().loanSession.id, 'affiliate-b-v6');
  releaseOldAffiliate(); await settle(); assert.equal(store.snapshot().loanSession.id, 'affiliate-b-v6');
  const staleChannel = channels[0]; staleChannel.change({ new: { version: 'old-owner-event' } }); await settle();
  assert.equal(store.snapshot().loanSession.id, 'affiliate-b-v6');
  auth = { phase: 'anonymous', session: null }; authListeners.forEach((fn) => fn()); await settle();
  assert.equal(store.snapshot().overview, null); assert.equal(store.snapshot().loanSession, null);
  unsubscribe(); assert.equal(events.size, 0); assert.equal(documentEvents.size, 0); assert.equal(authListeners.size, 0); assert.equal(removed.length, 2);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
