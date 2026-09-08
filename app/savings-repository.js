/* Savings SHADOW + NEW FOUNDATION boundary. Never reads Google, mocks, DATA,
   localStorage or the visual-reference HTML. All projections and mutations are
   server RPCs protected by identity, RLS and technical permissions. */
(function () {
  'use strict';

  const db = () => window.SutiSupabase.getClient();
  const key = () => crypto.randomUUID();

  // H05: one memory-only projection, reused only after backend validation.
  const selfListeners = new Set();
  let selfEntry = null, selfPending = null, selfEpoch = 0, selfSubject = '';
  let authBound = false, adminBound = false;

  function selfIdentity() {
    const auth = window.AffiliateAuth && window.AffiliateAuth.getState();
    if (!auth || auth.phase !== 'authenticated') return null;
    const session = auth.session || {}, affiliate = auth.affiliate || {};
    const actor = session.user && session.user.id;
    if (!actor || !affiliate.id) return null;
    let sessionId = session.session_id || '';
    if (!sessionId && session.access_token) {
      try { sessionId = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id || ''; } catch (_) {}
    }
    const imp = auth.impersonation || affiliate._impersonation || {};
    const admin = window.AdminRepository && window.AdminRepository.getState ? window.AdminRepository.getState() : {};
    const identity = { actor, affiliate: affiliate.id, session: sessionId, impersonation: imp.id || imp.session_id || '' };
    identity.key = JSON.stringify([actor, affiliate.id, sessionId, identity.impersonation, admin.phase || '', admin.subjectKey || '', admin.assignment || null]);
    return identity;
  }
  function invalidateSelf(notify) {
    selfEpoch++; selfEntry = null; selfPending = null;
    if (notify) selfListeners.forEach((fn) => fn());
  }
  function syncSelfIdentity() {
    if (!authBound && window.AffiliateAuth) { authBound = true; window.AffiliateAuth.subscribe(syncSelfIdentity); }
    if (!adminBound && window.AdminRepository && window.AdminRepository.subscribe) { adminBound = true; window.AdminRepository.subscribe(syncSelfIdentity); }
    const identity = selfIdentity(), next = identity ? identity.key : '';
    if (next !== selfSubject) { selfSubject = next; invalidateSelf(true); }
    return identity;
  }
  function immutableJson(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(immutableJson); Object.freeze(value);
    }
    return value;
  }
  function contextError() { return Object.assign(new Error('SAVINGS_CONTEXT_CHANGED'), { code: 'SAVINGS_CONTEXT_CHANGED' }); }
  function getSelfDashboard(options) {
    const identity = syncSelfIdentity();
    if (!identity) return Promise.reject(Object.assign(new Error('SAVINGS_AFFILIATE_REQUIRED'), { code: '42501' }));
    if (options && options.force) invalidateSelf(false);
    if (selfPending) return selfPending;
    const epoch = selfEpoch, cached = identity.session && selfEntry && selfEntry.key === identity.key ? selfEntry : null;
    const request = Promise.resolve().then(async () => {
      try {
        if (epoch !== selfEpoch) throw contextError();
        const result = await db().rpc('get_self_savings_if_changed', { p_known_version: cached ? cached.version : null });
        if (result.error) throw result.error;
        const now = syncSelfIdentity(), value = result.data || {}, context = value.context || {};
        if (epoch !== selfEpoch || !now || now.key !== identity.key ||
            context.actor_auth_user_id !== identity.actor || context.effective_affiliate_id !== identity.affiliate ||
            (context.actor_session_id || '') !== identity.session || (context.impersonation_id || '') !== identity.impersonation) throw contextError();
        if (value.modified === false) {
          if (!cached || value.cacheable !== true || value.version !== cached.version) throw new Error('SAVINGS_CACHE_VALIDATION_FAILED');
          return cached.data;
        }
        if (value.modified !== true || !value.data || typeof value.data !== 'object') throw new Error('SAVINGS_RESPONSE_INVALID');
        const data = immutableJson(value.data);
        selfEntry = value.cacheable === true && identity.session && typeof value.version === 'string'
          ? { key: identity.key, version: value.version, data } : null;
        return data;
      } catch (error) {
        if (epoch === selfEpoch) invalidateSelf(false);
        throw error;
      } finally { if (selfPending === request) selfPending = null; }
    });
    selfPending = request;
    return request;
  }

  async function rpc(name, values) {
    const writing = !/^(get_|preview_)/.test(name);
    if (writing) invalidateSelf(true);
    try {
      const result = await db().rpc(name, values || {});
      if (result.error) throw result.error;
      return result.data;
    } finally { if (writing) invalidateSelf(true); }
  }

  const api = {
    newIdempotencyKey: key,
    getSelfDashboard,
    getSelfIdentityKey: () => { const value = selfIdentity(); return value ? value.key : ''; },
    prepareSelfContext: syncSelfIdentity,
    clearSelfCache: () => invalidateSelf(false),
    subscribeSelfInvalidation: (fn) => { selfListeners.add(fn); return () => selfListeners.delete(fn); },
    getAdminDashboard: (participantId) => rpc('get_admin_savings_dashboard', { p_participant_id: participantId || null }),
    submitRequest: (values) => {
      const input = values || {};
      return rpc('submit_self_savings_request', {
        p_request_type: input.requestType,
        p_amount: input.amount == null ? null : Number(input.amount),
        p_component: input.component || null,
        p_withdrawal_kind: input.withdrawalKind || null,
        p_new_contribution_amount: input.newContributionAmount == null ? null : Number(input.newContributionAmount),
        p_continue_saving: input.continueSaving == null ? null : Boolean(input.continueSaving),
        p_effective_from: input.effectiveFrom || null,
        p_reason: input.reason || '',
        p_supporting_document_id: input.supportingDocumentId || null,
        p_idempotency_key: input.idempotencyKey || key(),
      });
    },
    replaceBeneficiaries: (beneficiaries, idempotencyKey) => rpc('replace_self_savings_beneficiaries', {
      p_beneficiaries: beneficiaries || [], p_idempotency_key: idempotencyKey || key(),
    }),
    setActionAvailability: (values) => {
      const input = values || {};
      return rpc('admin_set_savings_action', {
        p_action_code: input.actionCode,
        p_enabled: Boolean(input.enabled),
        p_scope_type: input.scopeType || 'GLOBAL',
        p_participant_id: input.participantId || null,
        p_reason: input.reason || '',
        p_effective_from: input.effectiveFrom || null,
        p_effective_to: input.effectiveTo || null,
      });
    },
    overrideContribution: (values) => {
      const input = values || {};
      return rpc('admin_override_savings_contribution', {
        p_enrollment_id: input.enrollmentId,
        p_contribution_date: input.contributionDate,
        p_actual_amount: Number(input.actualAmount),
        p_reason: input.reason || '',
        p_client_action_id: input.clientActionId || key(),
      });
    },
    reviewRequest: (values) => {
      const input = values || {};
      return rpc('admin_review_savings_request', {
        p_request_id: input.requestId,
        p_decision: input.decision,
        p_reason: input.reason || '',
        p_effective_from: input.effectiveFrom || null,
        p_first_expected_contribution_date: input.firstExpectedContributionDate || null,
        p_process: input.process || null,
      });
    },
    recordRequestApproval: (values) => {
      const input = values || {};
      return rpc('admin_record_savings_request_approval', {
        p_request_id: input.requestId,
        p_approval_role: input.approvalRole,
        p_decision: input.decision,
        p_reason: input.reason || '',
      });
    },
    settleRequest: (values) => {
      const input = values || {};
      return rpc('admin_settle_savings_request', {
        p_request_id: input.requestId,
        p_capital_amount: Number(input.capitalAmount || 0),
        p_yield_amount: Number(input.yieldAmount || 0),
        p_reason: input.reason || '',
        p_client_action_id: input.clientActionId || key(),
      });
    },
    createHold: (values) => {
      const input = values || {};
      return rpc('admin_create_savings_hold', {
        p_participant_id: input.participantId,
        p_enrollment_id: input.enrollmentId || null,
        p_component: input.component,
        p_amount: Number(input.amount),
        p_reason: input.reason || '',
      });
    },
    releaseHold: (holdId, reason) => rpc('admin_release_savings_hold', { p_hold_id: holdId, p_reason: reason || '' }),
    recordProcessChange: (participantId, process, reason) => rpc('admin_record_savings_process_change', {
      p_participant_id: participantId, p_new_process: process, p_reason: reason || '',
    }),
    reviewProcessChange: (values) => {
      const input = values || {};
      return rpc('admin_review_savings_process_change', {
        p_event_id: input.eventId,
        p_decision: input.decision,
        p_effective_from: input.effectiveFrom || null,
        p_reason: input.reason || '',
      });
    },
    saveYieldPeriod: (values) => {
      const input = values || {};
      return rpc('admin_save_savings_yield_period', {
        p_period_year: Number(input.year), p_semester: Number(input.semester),
        p_starts_on: input.startsOn, p_ends_on: input.endsOn,
        p_rate: input.rate == null || input.rate === '' ? null : Number(input.rate),
        p_eligibility_policy: input.eligibilityPolicy || {}, p_exclusion_policy: input.exclusionPolicy || {},
        p_status: input.status || 'DRAFT',
      });
    },
    creditYieldPeriod: (periodId) => rpc('admin_credit_savings_yield_period', { p_yield_period_id: periodId }),
    resolveIdentity: (participantId, affiliateId, reason) => rpc('admin_resolve_savings_identity', {
      p_participant_id: participantId, p_affiliate_id: affiliateId, p_reason: reason || '',
    }),
  };

  window.SavingsRepository = Object.freeze(api);
})();
