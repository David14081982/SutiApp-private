/* Savings SHADOW + NEW FOUNDATION boundary. Never reads Google, mocks, DATA,
   localStorage or the visual-reference HTML. All projections and mutations are
   server RPCs protected by identity, RLS and technical permissions. */
(function () {
  'use strict';

  const db = () => window.SutiSupabase.getClient();
  const key = () => crypto.randomUUID();

  async function rpc(name, values) {
    const result = await db().rpc(name, values || {});
    if (result.error) throw result.error;
    return result.data;
  }

  const api = {
    newIdempotencyKey: key,
    getSelfDashboard: () => rpc('get_self_savings_live_readonly'),
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
