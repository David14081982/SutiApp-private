/* Phase 7: read-only browser boundary. Financial identity and calculations stay server-side. */
(function () {
  const SIMULATION_FIELDS = Object.freeze([
    'amount', 'paymentCount', 'paymentPeriod', 'rate', 'ratePeriod',
    'interest', 'administrativeFeePerPayment', 'administrativeFeeTotal',
    'total', 'paymentPerPeriod', 'fund', 'program', 'maxAmount', 'maxTerm',
    'eligibility',
  ]);
  const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  function validatePayrollImpact(value) {
    if (!value || typeof value !== 'object' || value.source !== 'SUPABASE_DECLARED_PAYROLL' ||
        !['EMPTY', 'READY', 'ERROR'].includes(value.status)) return false;
    if (value.status !== 'READY') return true;
    return ['grossPayPerFortnight', 'deductionsPerFortnight', 'netPayPerFortnight',
      'loanPaymentPerFortnight', 'remainingNetPay', 'loanToNetPercent',
      'existingDeductionsBarPercent', 'loanBarPercent', 'remainingBarPercent',
      'guidelinePercent', 'version'].every((field) => finiteNumber(value[field])) &&
      typeof value.withinGuideline === 'boolean';
  }
  function validateFinancialSimulationResult(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (!SIMULATION_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(value, field))) return false;
    if (!['amount', 'paymentCount', 'rate', 'interest', 'administrativeFeePerPayment',
      'administrativeFeeTotal', 'total', 'paymentPerPeriod', 'maxAmount', 'maxTerm']
      .every((field) => finiteNumber(value[field]))) return false;
    if (value.amount <= 0 || value.paymentCount <= 0 || value.maxAmount <= 0 || value.maxTerm <= 0) return false;
    if (!['paymentPeriod', 'ratePeriod', 'fund', 'program']
      .every((field) => typeof value[field] === 'string' && value[field].trim().length > 0)) return false;
    if (value.eligibility === undefined || value.eligibility === null) return false;
    if (!Array.isArray(value.termOptions) || !value.termOptions.every((option) =>
      option && Number.isInteger(option.term) && option.term > 0 &&
      ['paymentCount', 'interest', 'administrativeFeePerPayment', 'administrativeFeeTotal', 'total', 'paymentPerPeriod']
        .every((field) => finiteNumber(option[field])))) return false;
    if (!value.customTerm || !Number.isInteger(value.customTerm.min) || !Number.isInteger(value.customTerm.max) ||
        !Number.isInteger(value.customTerm.step) || value.customTerm.min <= 0 || value.customTerm.max < value.customTerm.min ||
        value.customTerm.step <= 0) return false;
    return value.payrollImpact === undefined || validatePayrollImpact(value.payrollImpact);
  }
  function assertFinancialSimulationResult(value) {
    if (!validateFinancialSimulationResult(value)) throw new Error('FINANCIAL_SIMULATION_CONTRACT_MISMATCH');
    return Object.freeze({ ...value });
  }
  function availableCreditTotal(overview) {
    if (!overview || !Array.isArray(overview.programs)) return null;
    const visible = overview.programs.filter((program) => program && program.status === 'AVAILABLE');
    if (!visible.length) return 0;
    const amounts = visible.map((program) => Number(program.max_amount));
    if (!amounts.every((amount) => Number.isFinite(amount) && amount > 0)) return null;
    return amounts.reduce((total, amount) => total + amount, 0);
  }
  const state = { status: 'idle', overview: null, quote: null, loanSession: null, authContextKey: null, error: null };
  let loanSessionOpenPromise = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  function snapshot() { return Object.freeze({ status: state.status, overview: state.overview, quote: state.quote, loanSession: state.loanSession, error: state.error }); }
  async function throwInvocationError(error, data, fallback) {
    let payload = data && typeof data === 'object' ? data : null;
    if ((!payload || !payload.error) && error && error.context && typeof error.context.clone === 'function') {
      try { payload = await error.context.clone().json(); } catch (_) { /* Non-JSON upstream failure. */ }
    }
    const code = payload && typeof payload.error === 'string' ? payload.error : (error && error.message) || fallback;
    const failure = new Error(code);
    failure.code = code;
    throw failure;
  }
  function abortedInvocation() {
    const failure = new Error('SIMULATION_REQUEST_ABORTED');
    failure.code = 'SIMULATION_REQUEST_ABORTED';
    return failure;
  }
  async function invoke(payload, options) {
    const client = window.SutiSupabase && window.SutiSupabase.getClient();
    if (!client) throw new Error('SUPABASE_NOT_CONFIGURED');
    const signal = options && options.signal;
    if (signal && signal.aborted) throw abortedInvocation();
    const { data, error } = await client.functions.invoke('financial-legacy', { body: payload, signal });
    if (signal && signal.aborted) throw abortedInvocation();
    if (error) await throwInvocationError(error, data, 'FINANCIAL_LEGACY_UNAVAILABLE');
    if (!data || !data.data) throw new Error('FINANCIAL_LEGACY_INVALID_RESPONSE');
    return data.data;
  }
  async function invokeLoanSnapshotRpc(payload, options) {
    const client = window.SutiSupabase && window.SutiSupabase.getClient();
    if (!client) throw new Error('SUPABASE_NOT_CONFIGURED');
    const signal = options && options.signal;
    if (signal && signal.aborted) throw abortedInvocation();
    let request = client.rpc('resolve_current_loan_snapshot_quote', payload);
    if (signal && typeof request.abortSignal === 'function') request = request.abortSignal(signal);
    const { data, error } = await request;
    if (signal && signal.aborted) throw abortedInvocation();
    if (error) {
      const code = error.message || 'FINANCIAL_SNAPSHOT_RPC_UNAVAILABLE';
      const failure = new Error(code); failure.code = code; throw failure;
    }
    if (!data || typeof data !== 'object') throw new Error('FINANCIAL_SNAPSHOT_RPC_INVALID_RESPONSE');
    return data;
  }
  async function currentAuthContextKey() {
    const client = window.SutiSupabase && window.SutiSupabase.getClient();
    if (!client) return null;
    const result = await client.auth.getSession();
    return result && result.data && result.data.session && result.data.session.user && result.data.session.user.id || null;
  }
  async function invokeCriteriaAdmin(payload) {
    const client = window.SutiSupabase && window.SutiSupabase.getClient();
    if (!client) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { data, error } = await client.functions.invoke('financial-criteria-admin', { body: payload });
    if (error) throw new Error(error.message || 'FINANCIAL_CRITERIA_ADMIN_UNAVAILABLE');
    if (!data || !data.data) throw new Error('FINANCIAL_CRITERIA_ADMIN_INVALID_RESPONSE');
    return data.data;
  }
  async function invokeFinancialAdminRpc(name, payload) {
    const client = window.SutiSupabase && window.SutiSupabase.getClient();
    if (!client) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { data, error } = await client.rpc(name, payload || {});
    if (error) {
      const failure = new Error(error.message || 'FINANCIAL_ADMIN_RPC_FAILED');
      failure.code = failure.message; throw failure;
    }
    if (!data || typeof data !== 'object') throw new Error('FINANCIAL_ADMIN_RPC_INVALID_RESPONSE');
    return data;
  }
  const store = {
    snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async loadOverview() {
      state.status = 'loading'; state.error = null; emit();
      try { state.overview = await invoke({ action: 'overview' }); state.status = 'ready'; }
      catch (error) { state.overview = null; state.status = 'error'; state.error = error.message; }
      emit(); return snapshot();
    },
    async openLoanSession(preserveExisting) {
      if (loanSessionOpenPromise) return loanSessionOpenPromise;
      loanSessionOpenPromise = (async () => {
        const contextKey = await currentAuthContextKey();
        if (preserveExisting !== true || !contextKey || state.authContextKey !== contextKey) {
          state.overview = null; state.quote = null; state.loanSession = null;
        }
        state.status = 'loading'; state.error = null; emit();
        try {
          const result = await invoke({ action: 'loanSessionOpen' });
          state.overview = result;
          state.loanSession = result.loanSession || null;
          state.authContextKey = contextKey;
          state.status = 'ready';
          if (!state.loanSession && Array.isArray(result.programs) && result.programs.some((program) => program.status === 'AVAILABLE')) {
            throw new Error('FINANCIAL_SESSION_SNAPSHOT_MISSING');
          }
        } catch (error) {
          state.overview = null; state.loanSession = null; state.authContextKey = contextKey;
          state.status = 'error'; state.error = error.code || error.message;
        }
        emit(); return snapshot();
      })();
      try { return await loanSessionOpenPromise; } finally { loanSessionOpenPromise = null; }
    },
    async ensureLoanSession() {
      const contextKey = await currentAuthContextKey();
      const expiresAt = state.loanSession && Date.parse(state.loanSession.expires_at);
      if (contextKey && state.authContextKey === contextKey && state.overview && state.loanSession &&
          Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        try {
          const validated = await invoke({ action: 'loanSessionValidate', snapshot_id: state.loanSession.id });
          if (validated.googleResolutionCount === 0 && validated.loanSession && validated.loanSession.id === state.loanSession.id) {
            state.loanSession = validated.loanSession; state.status = 'ready'; state.error = null; emit(); return snapshot();
          }
        } catch (_) { /* Effective affiliate or impersonation context changed. */ }
      }
      return store.openLoanSession(false);
    },
    async requestQuote(programId, amount, term) {
      state.status = 'loading'; state.quote = null; state.error = null; emit();
      try {
        const result = await invoke({ action: 'quote', program_id: String(programId), amount: Number(amount), term: Number(term) });
        state.quote = assertFinancialSimulationResult(result); state.status = 'ready';
      }
      catch (error) { state.quote = null; state.status = 'error'; state.error = error.message; }
      emit(); return snapshot();
    },
    async requestLoanSessionQuote(programId, amount, term, options) {
      state.status = 'loading'; state.error = null; emit();
      const signal = options && options.signal;
      try {
        if (!state.loanSession || !state.loanSession.id) throw Object.assign(new Error('SNAPSHOT_INVALID'), { code: 'SNAPSHOT_INVALID' });
        const result = await invokeLoanSnapshotRpc({ p_snapshot_id: state.loanSession.id,
          p_program_id: String(programId), p_amount: Number(amount), p_term: Number(term) }, { signal });
        if (signal && signal.aborted) throw abortedInvocation();
        state.loanSession = result.loanSession || state.loanSession;
        state.quote = assertFinancialSimulationResult(result); state.status = 'ready';
      } catch (error) {
        if ((error.code || error.message) === 'SIMULATION_REQUEST_ABORTED') {
          state.status = state.overview ? 'ready' : 'idle'; state.error = null; emit(); throw error;
        }
        state.status = 'error'; state.error = error.code || error.message;
      }
      emit(); return snapshot();
    },
    async confirmLoanSession(values) {
      const value = values || {};
      if (!state.loanSession || !state.loanSession.id) throw Object.assign(new Error('SNAPSHOT_INVALID'), { code: 'SNAPSHOT_INVALID' });
      try {
        return await invoke({
          action: 'loanSessionConfirm', snapshot_id: state.loanSession.id,
          program_id: String(value.programId), amount: Number(value.amount), term: Number(value.term),
          program_item_id: String(value.programItemId), notes: String(value.notes || ''),
          signature_data: String(value.signature || ''), terms_accepted: value.terms === true,
          terms_version_id: String(value.termsVersionId), document_ids: (value.documentIds || []).map(String),
          idempotency_key: String(value.idempotencyKey),
        });
      } catch (error) {
        const code = error.code || error.message;
        if (code === 'CONDITIONS_CHANGED' || code === 'SNAPSHOT_INVALID') await store.openLoanSession(true);
        throw error;
      }
    },
    clearQuote() { state.quote = null; emit(); },
  };
  async function handoffRequest(requestId) {
    return invoke({ action: 'handoff', request_id: String(requestId) });
  }
  async function approveRequest(requestId) { return invoke({ action: 'approve', request_id: String(requestId) }); }
  window.FinancialLegacyRepository = Object.freeze({
    invoke, handoffRequest, approveRequest,
    resolveEligibility: () => invoke({ action: 'resolveEligibility' }),
    resolveAvailableFunds: () => invoke({ action: 'resolveAvailableFunds' }),
    resolveSimulation: (programId, amount, term) => invoke({ action: 'resolveSimulation', program_id: String(programId), amount: Number(amount), term: Number(term) }).then(assertFinancialSimulationResult),
    listCriteriaCatalog: () => invoke({ action: 'catalog' }),
    getFinancialAdminCatalog: () => invokeFinancialAdminRpc('get_financial_admin_catalog'),
    saveFinancialProgram: (value) => invokeFinancialAdminRpc('save_financial_program', value),
    saveFinancialFund: (value) => invokeFinancialAdminRpc('save_financial_fund', value),
    saveFinancialRuleDraft: (value) => invokeFinancialAdminRpc('save_financial_rule_draft', value),
    publishFinancialRule: (ruleId, reason) => invokeFinancialAdminRpc('publish_financial_rule', {
      p_rule_id: String(ruleId), p_reason: String(reason || ''), p_confirmation: 'PUBLICAR',
    }),
    previewFinancialRuleImpact: (ruleId) => invokeFinancialAdminRpc('preview_financial_rule_impact', { p_rule_id: String(ruleId) }),
    setCriteriaVisibility: (criterionIdentity, visibilityMode, reason) => invokeCriteriaAdmin({
      action: 'setVisibility', criterion_identity: String(criterionIdentity),
      visibility_mode: String(visibilityMode), reason: String(reason || ''),
    }),
    SIMULATION_FIELDS,
    validateFinancialSimulationResult, assertFinancialSimulationResult, validatePayrollImpact, availableCreditTotal,
  });
  window.financialLegacyStore = store;
  window.useFinancialLegacy = function () {
    const [, rerender] = React.useState(0);
    React.useEffect(() => store.subscribe(() => rerender((value) => value + 1)), []);
    return store.snapshot();
  };
})();
