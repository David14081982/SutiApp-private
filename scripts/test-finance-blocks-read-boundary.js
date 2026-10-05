'use strict';
// Isolated browser boundary: no network, business data, or evidence-file writes.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function fixture() {
  const calls = { checks: 0, notices: [], edge: [], events: 0 };
  const state = { blocked: true, race: false, upstreamFailure: false };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'synthetic-actor' } } } }) },
    rpc: async (name) => {
      assert.equal(name, 'get_self_finance_block');
      calls.checks++;
      return { data: { blocked: state.blocked, block: { starts_on: '2026-10-04', ends_on: '2026-10-20', reason: 'Synthetic restriction' } } };
    },
    functions: { invoke: async (name, { body }) => {
      assert.equal(name, 'financial-legacy');
      calls.edge.push(body.action);
      if (state.race) {
        state.blocked = true;
        return { error: { message: 'FINANCE_REQUEST_BLOCKED' } };
      }
      if (state.upstreamFailure) return { error: { message: 'UPSTREAM_UNAVAILABLE' } };
      if (body.action === 'programPaymentSessionOpen') return { data: { data: { status: 'QUOTE_REQUIRED', googleResolutionCount: 0 } } };
      return { data: { data: { programs: [], loanSession: { id: 'synthetic-session', expires_at: '2099-01-01T00:00:00Z' } } } };
    } },
  };
  const window = {
    SutiSupabase: { getClient: () => client },
    AffiliateAuth: { getState: () => ({ session: { user: { id: 'synthetic-actor' } }, affiliate: { id: 'synthetic-affiliate' } }) },
    FinanceBlocksUI: { show: (block) => calls.notices.push(block) },
    dispatchEvent: () => calls.events++,
  };
  const context = vm.createContext({ window, React: {}, Event: function Event() {} });
  for (const file of ['app/finance-blocks-repository.js', 'app/financial-legacy-repository.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return { calls, state, store: window.financialLegacyStore, repository: window.FinancialLegacyRepository };
}

async function main() {
  const checks = [];
  const reader = fixture();
  const home = await reader.store.ensureLoanSession();
  assert.equal(home.status, 'ready');
  assert(home.overview);
  assert.equal((await reader.repository.openProgramPaymentSession('synthetic-item')).status, 'QUOTE_REQUIRED');
  for (const action of ['overview', 'resolveEligibility', 'resolveAvailableFunds', 'approvalReview', 'approve', 'handoff']) {
    await reader.repository.invoke({ action });
  }
  assert.equal(reader.calls.checks, 0);
  assert.equal(reader.calls.notices.length, 0);
  checks.push('blocked affiliate retains Home overview, session reads and actions on prior requests without restriction RPC or notice');

  for (const action of ['loanSessionConfirm', 'programPaymentSessionConfirm']) {
    const blocked = fixture();
    await assert.rejects(() => blocked.repository.invoke({ action }), /FINANCE_REQUEST_BLOCKED/);
    assert.equal(blocked.calls.checks, 1);
    assert.equal(blocked.calls.notices.length, 1);
    assert.equal(blocked.calls.notices[0].ends_on, '2026-10-20');
    assert.equal(blocked.calls.edge.length, 0);
    assert.equal(blocked.calls.events, 0);

    const raced = fixture();
    raced.state.blocked = false;
    raced.state.race = true;
    await assert.rejects(() => raced.repository.invoke({ action }), /FINANCE_REQUEST_BLOCKED/);
    assert.equal(raced.calls.checks, 2);
    assert.deepEqual(raced.calls.edge, [action]);
    assert.equal(raced.calls.notices.length, 1);
    assert.equal(raced.calls.events, 0);

    const unavailable = fixture();
    unavailable.state.blocked = false;
    unavailable.state.upstreamFailure = true;
    await assert.rejects(() => unavailable.repository.invoke({ action }), /UPSTREAM_UNAVAILABLE/);
    assert.equal(unavailable.calls.checks, 2);
    assert.equal(unavailable.calls.notices.length, 0);
    assert.equal(unavailable.calls.events, 0);
  }
  checks.push('both confirmations deny before sending and show dates/reason');
  checks.push('both confirmation failures recheck a newly activated block and preserve unrelated errors');
  console.log(JSON.stringify({ status: 'PASS', checks, productionTouched: false }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
